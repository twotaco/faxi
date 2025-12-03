#!/bin/bash

# QA Environment Deployment Script for Faxi
# Deploys to AWS with domains: qa.faxi.jp, qa-admin.faxi.jp, qa-fax.faxi.jp
#
# IMPORTANT: This script addresses common deployment issues:
# - Builds images for linux/amd64 (required for ECS Fargate)
# - Uses timestamp tags to avoid Docker/ECS caching issues
# - Creates CloudWatch log groups before service deployment
# - Configures proper health check paths for Next.js i18n
# - Uses HTTP endpoints (ALB has no HTTPS listener in QA)

set -e

COMMAND=${1:-help}
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY=${ECR_REGISTRY:-223882168768.dkr.ecr.us-east-1.amazonaws.com}
CLUSTER_NAME="faxi-qa-cluster"
SERVICE_PREFIX="faxi-qa"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install it first."
        exit 1
    fi

    # Check if logged into AWS
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Not logged into AWS. Run 'aws configure' or refresh your SSO session."
        exit 1
    fi

    # Get AWS account ID dynamically
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    log_info "AWS Account: $AWS_ACCOUNT_ID"
    log_info "ECR Registry: $ECR_REGISTRY"
    log_info "Prerequisites check passed."
}

create_log_groups() {
    log_step "Creating CloudWatch log groups..."

    for service in backend admin marketing; do
        LOG_GROUP="/ecs/faxi-qa-${service}"
        if ! aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region $AWS_REGION --query "logGroups[?logGroupName=='$LOG_GROUP']" --output text | grep -q "$LOG_GROUP"; then
            log_info "Creating log group: $LOG_GROUP"
            aws logs create-log-group --log-group-name "$LOG_GROUP" --region $AWS_REGION || true
        else
            log_info "Log group exists: $LOG_GROUP"
        fi
    done
}

build_and_push_images() {
    log_step "Building and pushing Docker images..."
    log_info "Using timestamp tag: $TIMESTAMP"

    # Login to ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

    # Ensure ECR repositories exist
    for repo in faxi-backend faxi-admin-dashboard faxi-marketing-website; do
        if ! aws ecr describe-repositories --repository-names $repo --region $AWS_REGION &> /dev/null; then
            log_info "Creating ECR repository: $repo"
            aws ecr create-repository --repository-name $repo --region $AWS_REGION
        fi
    done

    cd "$PROJECT_ROOT"

    # Build all images in PARALLEL for faster deployment
    log_info "Building all images in parallel (linux/amd64)..."

    # Backend build in background
    log_info "Starting backend build..."
    docker build --platform linux/amd64 --no-cache -t faxi-backend:qa -f Dockerfile --target production . &
    PID_BACKEND=$!

    # Admin dashboard build in background (subshell to handle cd)
    # --no-cache ensures NEXT_PUBLIC_API_URL is always baked fresh into the bundle
    log_info "Starting admin dashboard build..."
    (cd admin-dashboard && docker build --platform linux/amd64 --no-cache --build-arg NEXT_PUBLIC_API_URL=http://qa-fax.faxi.jp -t faxi-admin-dashboard:qa -f Dockerfile .) &
    PID_ADMIN=$!

    # Marketing website build in background (subshell to handle cd)
    # --no-cache ensures NEXT_PUBLIC_API_URL is always baked fresh into the bundle
    log_info "Starting marketing website build..."
    (cd marketing-website && docker build --platform linux/amd64 --no-cache --build-arg NEXT_PUBLIC_API_URL=http://qa-fax.faxi.jp -t faxi-marketing-website:qa -f Dockerfile .) &
    PID_MARKETING=$!

    # Wait for all builds to complete
    log_info "Waiting for all builds to complete..."
    wait $PID_BACKEND || { log_error "Backend build failed"; exit 1; }
    log_info "Backend build completed"
    wait $PID_ADMIN || { log_error "Admin build failed"; exit 1; }
    log_info "Admin build completed"
    wait $PID_MARKETING || { log_error "Marketing build failed"; exit 1; }
    log_info "Marketing build completed"

    log_info "All builds completed. Pushing images..."

    # Tag and push backend
    docker tag faxi-backend:qa $ECR_REGISTRY/faxi-backend:qa
    docker tag faxi-backend:qa $ECR_REGISTRY/faxi-backend:qa-$TIMESTAMP
    docker push $ECR_REGISTRY/faxi-backend:qa
    docker push $ECR_REGISTRY/faxi-backend:qa-$TIMESTAMP
    log_info "Backend image pushed: qa-$TIMESTAMP"

    # Tag and push admin dashboard
    docker tag faxi-admin-dashboard:qa $ECR_REGISTRY/faxi-admin-dashboard:qa
    docker tag faxi-admin-dashboard:qa $ECR_REGISTRY/faxi-admin-dashboard:qa-$TIMESTAMP
    docker push $ECR_REGISTRY/faxi-admin-dashboard:qa
    docker push $ECR_REGISTRY/faxi-admin-dashboard:qa-$TIMESTAMP
    log_info "Admin dashboard image pushed: qa-$TIMESTAMP"

    # Tag and push marketing website
    docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:qa
    docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:qa-$TIMESTAMP
    docker push $ECR_REGISTRY/faxi-marketing-website:qa
    docker push $ECR_REGISTRY/faxi-marketing-website:qa-$TIMESTAMP
    log_info "Marketing website image pushed: qa-$TIMESTAMP"

    log_info "All images built and pushed successfully."
    echo ""
    log_info "Image tags used:"
    echo "  - Backend: qa-$TIMESTAMP"
    echo "  - Admin: qa-$TIMESTAMP"
    echo "  - Marketing: qa-$TIMESTAMP"
}

update_task_definitions() {
    log_step "Updating task definitions with new image tags..."

    # Update each service's task definition with the new timestamp tag
    for service in backend admin marketing; do
        TASK_FAMILY="faxi-qa-${service}"

        # Get current task definition
        CURRENT_TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $AWS_REGION 2>/dev/null || echo "")

        if [ -z "$CURRENT_TASK_DEF" ]; then
            log_warn "Task definition $TASK_FAMILY not found. Skipping update."
            continue
        fi

        # Map service name to repo name
        case $service in
            backend) REPO_NAME="faxi-backend" ;;
            admin) REPO_NAME="faxi-admin-dashboard" ;;
            marketing) REPO_NAME="faxi-marketing-website" ;;
        esac

        NEW_IMAGE="${ECR_REGISTRY}/${REPO_NAME}:qa-${TIMESTAMP}"

        log_info "Updating $TASK_FAMILY with image: $NEW_IMAGE"

        # Create new task definition with updated image
        NEW_TASK_DEF=$(echo "$CURRENT_TASK_DEF" | python3 -c "
import json, sys
td = json.load(sys.stdin)['taskDefinition']
# Remove fields that can't be in register-task-definition
for key in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
    td.pop(key, None)
# Update image
td['containerDefinitions'][0]['image'] = '$NEW_IMAGE'
print(json.dumps(td))
")

        # Register new task definition
        echo "$NEW_TASK_DEF" > /tmp/task-def-${service}.json
        NEW_REVISION=$(aws ecs register-task-definition \
            --cli-input-json file:///tmp/task-def-${service}.json \
            --region $AWS_REGION \
            --query 'taskDefinition.revision' \
            --output text)

        log_info "$TASK_FAMILY updated to revision $NEW_REVISION"
    done
}

deploy_services() {
    log_step "Deploying ECS services..."

    for service in backend admin marketing; do
        SERVICE_NAME="${SERVICE_PREFIX}-${service}"
        TASK_FAMILY="faxi-qa-${service}"

        # Check if service exists
        if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION --query 'services[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
            log_info "Updating service: $SERVICE_NAME"
            aws ecs update-service \
                --cluster $CLUSTER_NAME \
                --service $SERVICE_NAME \
                --task-definition $TASK_FAMILY \
                --force-new-deployment \
                --region $AWS_REGION \
                --query 'service.serviceName' \
                --output text
        else
            log_warn "Service $SERVICE_NAME does not exist. Please create it first using the AWS console or CloudFormation."
        fi
    done

    log_info "Deployment initiated. Waiting for services to stabilize..."
}

wait_for_deployment() {
    log_step "Waiting for services to become healthy..."

    MAX_WAIT=180  # 3 minutes
    INTERVAL=15
    ELAPSED=0

    while [ $ELAPSED -lt $MAX_WAIT ]; do
        ALL_HEALTHY=true
        DEPLOYMENT_FAILED=false

        for service in backend admin marketing; do
            SERVICE_NAME="${SERVICE_PREFIX}-${service}"

            # Get service info including deployment status
            SERVICE_INFO=$(aws ecs describe-services \
                --cluster $CLUSTER_NAME \
                --services $SERVICE_NAME \
                --region $AWS_REGION \
                --output json 2>/dev/null || echo '{"services":[]}')

            RUNNING=$(echo "$SERVICE_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['services'][0]['runningCount'] if d['services'] else 0)" 2>/dev/null || echo "0")
            DESIRED=$(echo "$SERVICE_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['services'][0]['desiredCount'] if d['services'] else 1)" 2>/dev/null || echo "1")

            # Check for failed deployments in service events
            RECENT_EVENT=$(echo "$SERVICE_INFO" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if d['services'] and d['services'][0].get('events'):
    msg = d['services'][0]['events'][0].get('message', '')
    print(msg)
" 2>/dev/null || echo "")

            # Detect deployment failures from events
            if echo "$RECENT_EVENT" | grep -qi "stopped task\|unable to\|failed\|error\|unhealthy"; then
                log_error "  $SERVICE_NAME: Deployment failure detected!"
                log_error "  Event: $RECENT_EVENT"
                DEPLOYMENT_FAILED=true
            fi

            # Check for tasks that have stopped/failed
            TASK_ARNS=$(aws ecs list-tasks \
                --cluster $CLUSTER_NAME \
                --service-name $SERVICE_NAME \
                --region $AWS_REGION \
                --query 'taskArns' \
                --output text 2>/dev/null || echo "")

            if [ -n "$TASK_ARNS" ] && [ "$TASK_ARNS" != "None" ]; then
                # Check task statuses
                TASK_STATUSES=$(aws ecs describe-tasks \
                    --cluster $CLUSTER_NAME \
                    --tasks $TASK_ARNS \
                    --region $AWS_REGION \
                    --query 'tasks[*].[lastStatus,containers[0].lastStatus,containers[0].exitCode]' \
                    --output text 2>/dev/null || echo "")

                # Look for stopped tasks with non-zero exit codes
                if echo "$TASK_STATUSES" | grep -qE "STOPPED.*[1-9]"; then
                    log_error "  $SERVICE_NAME: Task stopped with non-zero exit code!"
                    DEPLOYMENT_FAILED=true
                fi
            fi

            if [ "$RUNNING" != "$DESIRED" ] || [ "$RUNNING" == "0" ]; then
                ALL_HEALTHY=false
                log_info "  $SERVICE_NAME: $RUNNING/$DESIRED running"
            else
                log_info "  $SERVICE_NAME: $RUNNING/$DESIRED running ✓"
            fi
        done

        # Fail fast if deployment errors detected
        if [ "$DEPLOYMENT_FAILED" = true ]; then
            log_error "Deployment failure detected. Aborting wait."
            log_info "Run './deploy-qa.sh troubleshoot' for details."
            return 1
        fi

        if [ "$ALL_HEALTHY" = true ]; then
            log_info "All services are healthy!"
            return 0
        fi

        log_info "Waiting $INTERVAL seconds... ($ELAPSED/$MAX_WAIT)"
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done

    log_warn "Services did not become healthy within $MAX_WAIT seconds"
    return 1
}

troubleshoot() {
    log_step "Troubleshooting deployment..."
    echo ""

    # Check ECS service status
    log_info "=== ECS Service Status ==="
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services ${SERVICE_PREFIX}-backend ${SERVICE_PREFIX}-admin ${SERVICE_PREFIX}-marketing \
        --region $AWS_REGION \
        --query 'services[*].[serviceName,status,runningCount,desiredCount]' \
        --output table 2>/dev/null || log_warn "Could not get service status"
    echo ""

    # Check target group health
    log_info "=== Target Group Health ==="
    for tg_suffix in backend admin marketing; do
        TG_NAME="qa-faxi-${tg_suffix}-tg"
        TG_ARN=$(aws elbv2 describe-target-groups --names $TG_NAME --region $AWS_REGION --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")

        if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
            echo "$TG_NAME:"
            aws elbv2 describe-target-health \
                --target-group-arn "$TG_ARN" \
                --region $AWS_REGION \
                --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
                --output table 2>/dev/null || echo "  Could not get target health"
        else
            log_warn "Target group $TG_NAME not found"
        fi
    done
    echo ""

    # Check recent service events
    log_info "=== Recent Service Events ==="
    for service in backend admin marketing; do
        SERVICE_NAME="${SERVICE_PREFIX}-${service}"
        echo "$SERVICE_NAME:"
        aws ecs describe-services \
            --cluster $CLUSTER_NAME \
            --services $SERVICE_NAME \
            --region $AWS_REGION \
            --query 'services[0].events[0:3].[createdAt,message]' \
            --output table 2>/dev/null || echo "  No events"
        echo ""
    done

    # Check CloudWatch logs
    log_info "=== Recent Logs (last 5 entries per service) ==="
    for service in backend admin marketing; do
        LOG_GROUP="/ecs/faxi-qa-${service}"
        echo "$LOG_GROUP:"
        aws logs tail "$LOG_GROUP" --since 10m --region $AWS_REGION 2>/dev/null | tail -5 || echo "  No recent logs"
        echo ""
    done

    # Common issues
    log_info "=== Common Issues Checklist ==="
    echo "1. Platform mismatch: Images must be built with --platform linux/amd64"
    echo "2. Port mismatch: Check npm start uses PORT env var, not hardcoded port"
    echo "3. Health check path: Marketing uses /en (Next.js i18n redirects /)"
    echo "4. Log group missing: Run './deploy-qa.sh logs' to create log groups"
    echo "5. Image caching: Use timestamp tags to force new image pull"
}

run_migrations() {
    log_step "Running database migrations..."

    # Get task definition ARN for backend
    TASK_DEF_ARN=$(aws ecs describe-task-definition \
        --task-definition faxi-qa-backend \
        --region $AWS_REGION \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text 2>/dev/null)

    if [ -z "$TASK_DEF_ARN" ] || [ "$TASK_DEF_ARN" == "None" ]; then
        log_error "Backend task definition not found"
        exit 1
    fi

    # Get network configuration from existing service
    NETWORK_CONFIG=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services ${SERVICE_PREFIX}-backend \
        --region $AWS_REGION \
        --query 'services[0].networkConfiguration' \
        --output json 2>/dev/null)

    if [ -z "$NETWORK_CONFIG" ] || [ "$NETWORK_CONFIG" == "null" ]; then
        log_error "Could not get network configuration"
        exit 1
    fi

    log_info "Starting migration task..."

    # Run migration as one-off task
    TASK_ARN=$(aws ecs run-task \
        --cluster $CLUSTER_NAME \
        --task-definition "$TASK_DEF_ARN" \
        --launch-type FARGATE \
        --network-configuration "$NETWORK_CONFIG" \
        --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","migrate"]}]}' \
        --region $AWS_REGION \
        --query 'tasks[0].taskArn' \
        --output text)

    log_info "Migration task started: $TASK_ARN"
    log_info "Waiting for migration to complete..."

    # Wait for task to complete
    aws ecs wait tasks-stopped --cluster $CLUSTER_NAME --tasks "$TASK_ARN" --region $AWS_REGION

    # Check exit code
    EXIT_CODE=$(aws ecs describe-tasks \
        --cluster $CLUSTER_NAME \
        --tasks "$TASK_ARN" \
        --region $AWS_REGION \
        --query 'tasks[0].containers[0].exitCode' \
        --output text)

    if [ "$EXIT_CODE" == "0" ]; then
        log_info "Migrations completed successfully"
    else
        log_error "Migrations failed with exit code: $EXIT_CODE"
        log_info "Check logs: aws logs tail /ecs/faxi-qa-backend --since 10m --region $AWS_REGION"
        exit 1
    fi
}

show_status() {
    log_step "QA Environment Status"
    echo ""

    # Show ECS services
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services ${SERVICE_PREFIX}-backend ${SERVICE_PREFIX}-admin ${SERVICE_PREFIX}-marketing \
        --region $AWS_REGION \
        --query 'services[*].[serviceName,status,runningCount,desiredCount]' \
        --output table 2>/dev/null || log_warn "Could not get service status"

    echo ""
    log_info "URLs (HTTP - QA has no SSL):"
    echo "  Marketing: http://qa.faxi.jp"
    echo "  Admin:     http://qa-admin.faxi.jp"
    echo "  Backend:   http://qa-fax.faxi.jp"
}

rollback() {
    log_step "Rolling back QA deployment..."

    for service in backend admin marketing; do
        SERVICE_NAME="${SERVICE_PREFIX}-${service}"
        TASK_FAMILY="faxi-qa-${service}"

        # Get previous task definition revision
        CURRENT_REVISION=$(aws ecs describe-services \
            --cluster $CLUSTER_NAME \
            --services $SERVICE_NAME \
            --region $AWS_REGION \
            --query 'services[0].taskDefinition' \
            --output text | sed 's/.*://')

        PREVIOUS_REVISION=$((CURRENT_REVISION - 1))

        if [ $PREVIOUS_REVISION -gt 0 ]; then
            log_info "Rolling back $SERVICE_NAME to revision $PREVIOUS_REVISION..."
            aws ecs update-service \
                --cluster $CLUSTER_NAME \
                --service $SERVICE_NAME \
                --task-definition "${TASK_FAMILY}:${PREVIOUS_REVISION}" \
                --force-new-deployment \
                --region $AWS_REGION \
                --query 'service.serviceName' \
                --output text
        else
            log_warn "No previous revision for $SERVICE_NAME"
        fi
    done

    log_info "Rollback initiated. Run './deploy-qa.sh status' to monitor."
}

case $COMMAND in
    "full")
        log_step "Starting full QA deployment..."
        check_prerequisites
        create_log_groups
        build_and_push_images
        update_task_definitions
        run_migrations || { log_error "Migrations failed. Aborting deployment."; exit 1; }
        deploy_services
        wait_for_deployment || { log_error "Services failed to stabilize. Deployment FAILED."; exit 1; }
        show_status
        log_info "QA deployment complete!"
        ;;
    "build")
        check_prerequisites
        build_and_push_images
        ;;
    "deploy")
        check_prerequisites
        update_task_definitions
        deploy_services
        wait_for_deployment || { log_error "Services failed to stabilize. Deployment FAILED."; exit 1; }
        ;;
    "logs")
        check_prerequisites
        create_log_groups
        ;;
    "migrate")
        check_prerequisites
        run_migrations
        ;;
    "health")
        troubleshoot
        ;;
    "status")
        check_prerequisites
        show_status
        ;;
    "troubleshoot")
        check_prerequisites
        troubleshoot
        ;;
    "rollback")
        check_prerequisites
        rollback
        ;;
    "help"|*)
        echo "Faxi QA Deployment Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  full         - Full deployment (logs + build + migrate + deploy + health check)"
        echo "  build        - Build and push Docker images (with linux/amd64)"
        echo "  deploy       - Update task definitions and deploy services"
        echo "  logs         - Create CloudWatch log groups"
        echo "  migrate      - Run database migrations via ECS task"
        echo "  health       - Check service health endpoints"
        echo "  status       - Show deployment status"
        echo "  troubleshoot - Diagnose deployment issues"
        echo "  rollback     - Rollback to previous version"
        echo "  help         - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  AWS_REGION    - AWS region (default: us-east-1)"
        echo ""
        echo "Examples:"
        echo "  ./deploy-qa.sh full           # Full deployment"
        echo "  ./deploy-qa.sh build          # Just build and push images"
        echo "  ./deploy-qa.sh troubleshoot   # Diagnose issues"
        ;;
esac
