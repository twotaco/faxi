#!/bin/bash

# Automated AWS Deployment Script for Faxi
# Usage: ./scripts/deploy-to-aws.sh <environment>
# Example: ./scripts/deploy-to-aws.sh qa

set -e

ENVIRONMENT=${1:-qa}
AWS_REGION=${AWS_REGION:-us-east-1}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(qa|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 <qa|staging|production>"
    exit 1
fi

log_info "Starting deployment to $ENVIRONMENT environment"

# Step 1: Get CloudFormation outputs
log_step "1/10 - Getting infrastructure information..."
STACK_NAME="faxi-${ENVIRONMENT}-infrastructure"

if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &>/dev/null; then
    log_error "CloudFormation stack $STACK_NAME not found. Please run infrastructure setup first."
    exit 1
fi

ECR_REGISTRY=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
PRIVATE_SUBNET_1=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet1Id`].OutputValue' --output text)
PRIVATE_SUBNET_2=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`PrivateSubnet2Id`].OutputValue' --output text)
ECS_SECURITY_GROUP=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text)
BACKEND_TG_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupArn`].OutputValue' --output text)
ADMIN_TG_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`AdminTargetGroupArn`].OutputValue' --output text)

log_info "ECR Registry: $ECR_REGISTRY"
log_info "Subnets: $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"

# Step 2: Create CloudWatch log groups
log_step "2/10 - Creating CloudWatch log groups..."
aws logs create-log-group --log-group-name /ecs/faxi-${ENVIRONMENT}-backend --region $AWS_REGION 2>/dev/null || log_info "Backend log group already exists"
aws logs create-log-group --log-group-name /ecs/faxi-${ENVIRONMENT}-admin --region $AWS_REGION 2>/dev/null || log_info "Admin log group already exists"

# Step 3: Login to ECR
log_step "3/10 - Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Step 4: Build backend image
log_step "4/10 - Building backend Docker image (AMD64)..."
cd "$PROJECT_ROOT"
docker build --platform linux/amd64 -t faxi-backend:${ENVIRONMENT} -f Dockerfile --target production .
docker tag faxi-backend:${ENVIRONMENT} $ECR_REGISTRY/faxi-backend:${ENVIRONMENT}
docker tag faxi-backend:${ENVIRONMENT} $ECR_REGISTRY/faxi-backend:latest-${ENVIRONMENT}

# Step 5: Push backend image
log_step "5/10 - Pushing backend image to ECR..."
docker push $ECR_REGISTRY/faxi-backend:${ENVIRONMENT}
docker push $ECR_REGISTRY/faxi-backend:latest-${ENVIRONMENT}

# Step 6: Build admin dashboard image
log_step "6/10 - Building admin dashboard Docker image (AMD64)..."
cd "$PROJECT_ROOT/admin-dashboard"
docker build --platform linux/amd64 -t faxi-admin-dashboard:${ENVIRONMENT} -f Dockerfile .
docker tag faxi-admin-dashboard:${ENVIRONMENT} $ECR_REGISTRY/faxi-admin-dashboard:${ENVIRONMENT}
docker tag faxi-admin-dashboard:${ENVIRONMENT} $ECR_REGISTRY/faxi-admin-dashboard:latest-${ENVIRONMENT}

# Step 7: Push admin dashboard image
log_step "7/10 - Pushing admin dashboard image to ECR..."
docker push $ECR_REGISTRY/faxi-admin-dashboard:${ENVIRONMENT}
docker push $ECR_REGISTRY/faxi-admin-dashboard:latest-${ENVIRONMENT}

cd "$PROJECT_ROOT"

# Step 8: Register task definitions
log_step "8/10 - Registering ECS task definitions..."

# Update task definition with actual values
BACKEND_TASK_DEF=$(cat aws/${ENVIRONMENT}-backend-task-definition.json | \
    sed "s|223882168768.dkr.ecr.us-east-1.amazonaws.com|$ECR_REGISTRY|g")

ADMIN_TASK_DEF=$(cat aws/${ENVIRONMENT}-admin-task-definition.json | \
    sed "s|223882168768.dkr.ecr.us-east-1.amazonaws.com|$ECR_REGISTRY|g")

BACKEND_TASK_ARN=$(echo "$BACKEND_TASK_DEF" | aws ecs register-task-definition --cli-input-json file:///dev/stdin --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)
ADMIN_TASK_ARN=$(echo "$ADMIN_TASK_DEF" | aws ecs register-task-definition --cli-input-json file:///dev/stdin --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)

log_info "Backend task: $BACKEND_TASK_ARN"
log_info "Admin task: $ADMIN_TASK_ARN"

# Step 9: Create ECS cluster if needed
log_step "9/10 - Ensuring ECS cluster exists..."
CLUSTER_NAME="faxi-${ENVIRONMENT}-cluster"
if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION | grep -q "ACTIVE"; then
    log_info "Creating ECS cluster..."
    aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $AWS_REGION
fi

# Step 10: Run database migrations
log_step "10/10 - Running database migrations..."
log_info "Starting migration task..."
MIGRATION_TASK_ARN=$(aws ecs run-task \
    --cluster $CLUSTER_NAME \
    --task-definition $BACKEND_TASK_ARN \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=DISABLED}" \
    --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","migrate"]}]}' \
    --region $AWS_REGION \
    --query 'tasks[0].taskArn' \
    --output text)

log_info "Migration task: $MIGRATION_TASK_ARN"
log_info "Waiting for migrations to complete..."

# Wait for migration task to complete
for i in {1..60}; do
    TASK_STATUS=$(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $MIGRATION_TASK_ARN --region $AWS_REGION --query 'tasks[0].lastStatus' --output text)
    if [ "$TASK_STATUS" = "STOPPED" ]; then
        EXIT_CODE=$(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $MIGRATION_TASK_ARN --region $AWS_REGION --query 'tasks[0].containers[0].exitCode' --output text)
        if [ "$EXIT_CODE" = "0" ]; then
            log_info "✓ Migrations completed successfully"
            break
        else
            log_error "✗ Migrations failed with exit code $EXIT_CODE"
            log_error "Check logs: aws logs tail /ecs/faxi-${ENVIRONMENT}-backend --region $AWS_REGION --since 5m"
            exit 1
        fi
    fi
    echo -n "."
    sleep 5
done
echo ""

# Step 11: Deploy or update backend service
log_step "11/12 - Deploying backend service..."
if aws ecs describe-services --cluster $CLUSTER_NAME --services faxi-${ENVIRONMENT}-backend --region $AWS_REGION | grep -q "ACTIVE"; then
    log_info "Updating existing backend service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service faxi-${ENVIRONMENT}-backend \
        --task-definition $BACKEND_TASK_ARN \
        --force-new-deployment \
        --region $AWS_REGION >/dev/null
else
    log_info "Creating backend service..."
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name faxi-${ENVIRONMENT}-backend \
        --task-definition $BACKEND_TASK_ARN \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=DISABLED}" \
        --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=backend,containerPort=4000" \
        --health-check-grace-period-seconds 60 \
        --region $AWS_REGION >/dev/null
fi

# Step 12: Deploy or update admin service
log_step "12/12 - Deploying admin dashboard service..."
if aws ecs describe-services --cluster $CLUSTER_NAME --services faxi-${ENVIRONMENT}-admin --region $AWS_REGION | grep -q "ACTIVE"; then
    log_info "Updating existing admin service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service faxi-${ENVIRONMENT}-admin \
        --task-definition $ADMIN_TASK_ARN \
        --force-new-deployment \
        --region $AWS_REGION >/dev/null
else
    log_info "Creating admin service..."
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name faxi-${ENVIRONMENT}-admin \
        --task-definition $ADMIN_TASK_ARN \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=DISABLED}" \
        --load-balancers "targetGroupArn=$ADMIN_TG_ARN,containerName=admin,containerPort=3000" \
        --health-check-grace-period-seconds 60 \
        --region $AWS_REGION >/dev/null
fi

# Wait for services to stabilize
log_info "Waiting for services to become healthy..."
sleep 30

# Check service status
log_info "Deployment Status:"
aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services faxi-${ENVIRONMENT}-backend faxi-${ENVIRONMENT}-admin \
    --region $AWS_REGION \
    --query 'services[*].[serviceName,runningCount,desiredCount,deployments[0].rolloutState]' \
    --output table

log_info ""
log_info "✓ Deployment complete!"
log_info ""
log_info "Next steps:"
log_info "1. Monitor deployment: aws ecs describe-services --cluster $CLUSTER_NAME --services faxi-${ENVIRONMENT}-backend --region $AWS_REGION"
log_info "2. Check logs: aws logs tail /ecs/faxi-${ENVIRONMENT}-backend --region $AWS_REGION --follow"
log_info "3. Verify health: Check ALB target groups in AWS Console"
