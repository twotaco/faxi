#!/bin/bash

# AWS ECS deployment script for Faxi Core System

set -e

COMMAND=${1:-help}
STACK_NAME="faxi-core-system"
REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

create_ecr_repository() {
    log_info "Creating ECR repository..."
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    REPOSITORY_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/faxi-core-system"
    
    # Create repository if it doesn't exist
    if ! aws ecr describe-repositories --repository-names faxi-core-system --region $REGION &> /dev/null; then
        aws ecr create-repository \
            --repository-name faxi-core-system \
            --region $REGION \
            --image-scanning-configuration scanOnPush=true
        log_info "ECR repository created"
    else
        log_info "ECR repository already exists"
    fi
    
    echo $REPOSITORY_URI
}

build_and_push_image() {
    log_info "Building and pushing Docker image..."
    
    REPOSITORY_URI=$(create_ecr_repository)
    
    # Login to ECR
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REPOSITORY_URI
    
    # Build image
    docker build -t faxi-core-system .
    docker tag faxi-core-system:latest $REPOSITORY_URI:latest
    
    # Push image
    docker push $REPOSITORY_URI:latest
    
    log_info "Image pushed to $REPOSITORY_URI:latest"
    echo $REPOSITORY_URI
}

create_secrets() {
    log_info "Creating AWS Secrets Manager secrets..."
    
    # Database secret
    if ! aws secretsmanager describe-secret --secret-id faxi/database --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/database \
            --description "Faxi database credentials" \
            --secret-string '{"password":"CHANGE_ME_STRONG_PASSWORD"}' \
            --region $REGION
        log_info "Database secret created"
    fi
    
    # Redis secret
    if ! aws secretsmanager describe-secret --secret-id faxi/redis --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/redis \
            --description "Faxi Redis credentials" \
            --secret-string '{"password":"CHANGE_ME_REDIS_PASSWORD"}' \
            --region $REGION
        log_info "Redis secret created"
    fi
    
    # S3 secret
    if ! aws secretsmanager describe-secret --secret-id faxi/s3 --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/s3 \
            --description "Faxi S3 credentials" \
            --secret-string '{"access_key_id":"CHANGE_ME","secret_access_key":"CHANGE_ME"}' \
            --region $REGION
        log_info "S3 secret created"
    fi
    
    # Telnyx secret
    if ! aws secretsmanager describe-secret --secret-id faxi/telnyx --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/telnyx \
            --description "Faxi Telnyx credentials" \
            --secret-string '{"api_key":"CHANGE_ME","public_key":"CHANGE_ME"}' \
            --region $REGION
        log_info "Telnyx secret created"
    fi
    
    # Gemini secret
    if ! aws secretsmanager describe-secret --secret-id faxi/gemini --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/gemini \
            --description "Faxi Google Gemini credentials" \
            --secret-string '{"api_key":"CHANGE_ME"}' \
            --region $REGION
        log_info "Gemini secret created"
    fi
    
    # Email secret
    if ! aws secretsmanager describe-secret --secret-id faxi/email --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/email \
            --description "Faxi email credentials" \
            --secret-string '{"webhook_secret":"CHANGE_ME"}' \
            --region $REGION
        log_info "Email secret created"
    fi
    
    # SendGrid secret
    if ! aws secretsmanager describe-secret --secret-id faxi/sendgrid --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/sendgrid \
            --description "Faxi SendGrid credentials" \
            --secret-string '{"api_key":"CHANGE_ME"}' \
            --region $REGION
        log_info "SendGrid secret created"
    fi
    
    # SMTP secret
    if ! aws secretsmanager describe-secret --secret-id faxi/smtp --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/smtp \
            --description "Faxi SMTP credentials" \
            --secret-string '{"password":"CHANGE_ME"}' \
            --region $REGION
        log_info "SMTP secret created"
    fi
    
    # Stripe secret
    if ! aws secretsmanager describe-secret --secret-id faxi/stripe --region $REGION &> /dev/null; then
        aws secretsmanager create-secret \
            --name faxi/stripe \
            --description "Faxi Stripe credentials" \
            --secret-string '{"secret_key":"CHANGE_ME","publishable_key":"CHANGE_ME","webhook_secret":"CHANGE_ME"}' \
            --region $REGION
        log_info "Stripe secret created"
    fi
    
    log_warn "Please update all secrets in AWS Secrets Manager with actual values before deploying the application"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure with CloudFormation..."
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION &> /dev/null; then
        log_info "Updating existing stack..."
        aws cloudformation update-stack \
            --stack-name $STACK_NAME \
            --template-body file://aws/cloudformation-template.yaml \
            --parameters ParameterKey=DatabasePassword,ParameterValue=CHANGE_ME_STRONG_PASSWORD \
                        ParameterKey=CertificateArn,ParameterValue=CHANGE_ME_CERTIFICATE_ARN \
            --capabilities CAPABILITY_IAM \
            --region $REGION
        
        aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $REGION
    else
        log_info "Creating new stack..."
        aws cloudformation create-stack \
            --stack-name $STACK_NAME \
            --template-body file://aws/cloudformation-template.yaml \
            --parameters ParameterKey=DatabasePassword,ParameterValue=CHANGE_ME_STRONG_PASSWORD \
                        ParameterKey=CertificateArn,ParameterValue=CHANGE_ME_CERTIFICATE_ARN \
            --capabilities CAPABILITY_IAM \
            --region $REGION
        
        aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $REGION
    fi
    
    log_info "Infrastructure deployment completed"
}

deploy_application() {
    log_info "Deploying application to ECS..."
    
    # Get stack outputs
    CLUSTER_NAME=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSCluster`].OutputValue' \
        --output text)
    
    TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`TargetGroup`].OutputValue' \
        --output text)
    
    TASK_EXECUTION_ROLE=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRole`].OutputValue' \
        --output text)
    
    TASK_ROLE=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskRole`].OutputValue' \
        --output text)
    
    # Update task definition with actual values
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/faxi-core-system:latest"
    
    # Create updated task definition
    sed "s/ACCOUNT_ID/$ACCOUNT_ID/g; s/REGION/$REGION/g" aws/ecs-task-definition.json > /tmp/task-definition.json
    sed -i "s|\"executionRoleArn\": \".*\"|\"executionRoleArn\": \"$TASK_EXECUTION_ROLE\"|g" /tmp/task-definition.json
    sed -i "s|\"taskRoleArn\": \".*\"|\"taskRoleArn\": \"$TASK_ROLE\"|g" /tmp/task-definition.json
    sed -i "s|\"image\": \".*\"|\"image\": \"$IMAGE_URI\"|g" /tmp/task-definition.json
    
    # Register task definition
    TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
        --cli-input-json file:///tmp/task-definition.json \
        --region $REGION \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    log_info "Task definition registered: $TASK_DEFINITION_ARN"
    
    # Create or update service
    if aws ecs describe-services --cluster $CLUSTER_NAME --services faxi-app --region $REGION &> /dev/null; then
        log_info "Updating existing service..."
        aws ecs update-service \
            --cluster $CLUSTER_NAME \
            --service faxi-app \
            --task-definition $TASK_DEFINITION_ARN \
            --region $REGION
    else
        log_info "Creating new service..."
        aws ecs create-service \
            --cluster $CLUSTER_NAME \
            --service-name faxi-app \
            --task-definition $TASK_DEFINITION_ARN \
            --desired-count 2 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
            --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=faxi-app,containerPort=3000" \
            --region $REGION
    fi
    
    log_info "Application deployment completed"
}

case $COMMAND in
    "deploy")
        log_info "Starting full AWS deployment..."
        check_prerequisites
        create_secrets
        build_and_push_image
        deploy_infrastructure
        deploy_application
        log_info "Deployment completed successfully!"
        ;;
    
    "secrets")
        check_prerequisites
        create_secrets
        ;;
    
    "build")
        check_prerequisites
        build_and_push_image
        ;;
    
    "infrastructure")
        check_prerequisites
        deploy_infrastructure
        ;;
    
    "app")
        check_prerequisites
        deploy_application
        ;;
    
    "status")
        log_info "Checking deployment status..."
        aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query 'Stacks[0].StackStatus' --output text
        echo ""
        aws ecs describe-services --cluster faxi-core-system-cluster --services faxi-app --region $REGION --query 'services[0].status' --output text
        ;;
    
    "logs")
        log_info "Showing application logs..."
        aws logs tail /ecs/faxi-core-system --follow --region $REGION
        ;;
    
    "cleanup")
        log_warn "This will delete all AWS resources"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cleaning up resources..."
            aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION
            aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $REGION
            log_info "Cleanup completed"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
    
    "help")
        echo "Faxi AWS ECS Deployment Helper"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  deploy        Full deployment (secrets, build, infrastructure, app)"
        echo "  secrets       Create AWS Secrets Manager secrets"
        echo "  build         Build and push Docker image to ECR"
        echo "  infrastructure Deploy infrastructure with CloudFormation"
        echo "  app           Deploy application to ECS"
        echo "  status        Show deployment status"
        echo "  logs          Show application logs"
        echo "  cleanup       Delete all resources (WARNING: destructive)"
        echo "  help          Show this help message"
        ;;
    
    *)
        log_error "Unknown command: $COMMAND"
        echo "Run '$0 help' for available commands."
        exit 1
        ;;
esac