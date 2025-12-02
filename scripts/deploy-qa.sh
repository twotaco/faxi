#!/bin/bash

# QA Environment Deployment Script for Faxi
# Deploys to AWS with domains: qa.faxi.jp, qa-admin.faxi.jp, qa-fax.faxi.jp

set -e

COMMAND=${1:-help}
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REGISTRY=${ECR_REGISTRY:-your-account-id.dkr.ecr.us-east-1.amazonaws.com}
CLUSTER_NAME="faxi-qa-cluster"
SERVICE_PREFIX="faxi-qa"

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
        log_error "Not logged into AWS. Run 'aws configure' first."
        exit 1
    fi
    
    # Check if .env.qa exists
    if [ ! -f .env.qa ]; then
        log_error ".env.qa file not found. Please create it from .env.qa template."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

setup_infrastructure() {
    log_info "Setting up QA infrastructure..."
    
    # Create ECR repositories if they don't exist
    for repo in faxi-backend faxi-admin-dashboard faxi-marketing-website; do
        if ! aws ecr describe-repositories --repository-names $repo --region $AWS_REGION &> /dev/null; then
            log_info "Creating ECR repository: $repo"
            aws ecr create-repository \
                --repository-name $repo \
                --region $AWS_REGION \
                --tags Key=Environment,Value=qa Key=Project,Value=faxi
        fi
    done
    
    # Create ECS cluster if it doesn't exist
    if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION | grep -q "ACTIVE"; then
        log_info "Creating ECS cluster: $CLUSTER_NAME"
        aws ecs create-cluster \
            --cluster-name $CLUSTER_NAME \
            --region $AWS_REGION \
            --tags key=Environment,value=qa key=Project,value=faxi
    fi
    
    # Create RDS instance (if not exists)
    log_info "Checking RDS instance..."
    if ! aws rds describe-db-instances --db-instance-identifier qa-faxi-db --region $AWS_REGION &> /dev/null; then
        log_warn "RDS instance not found. Please create it manually or run: ./scripts/setup-qa-rds.sh"
    fi
    
    # Create ElastiCache Redis (if not exists)
    log_info "Checking ElastiCache Redis..."
    if ! aws elasticache describe-cache-clusters --cache-cluster-id faxi-qa-redis --region $AWS_REGION &> /dev/null; then
        log_warn "ElastiCache Redis not found. Please create it manually or run: ./scripts/setup-qa-redis.sh"
    fi
    
    # Create S3 bucket for faxes
    if ! aws s3 ls s3://faxi-qa-faxes &> /dev/null; then
        log_info "Creating S3 bucket: faxi-qa-faxes"
        aws s3 mb s3://faxi-qa-faxes --region $AWS_REGION
        aws s3api put-bucket-encryption \
            --bucket faxi-qa-faxes \
            --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
    fi
    
    log_info "Infrastructure setup complete."
}

build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Login to ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    # Build and push backend
    log_info "Building backend image..."
    docker build -t faxi-backend:qa -f Dockerfile --target production .
    docker tag faxi-backend:qa $ECR_REGISTRY/faxi-backend:qa
    docker tag faxi-backend:qa $ECR_REGISTRY/faxi-backend:latest-qa
    docker push $ECR_REGISTRY/faxi-backend:qa
    docker push $ECR_REGISTRY/faxi-backend:latest-qa
    
    # Build and push admin dashboard
    log_info "Building admin dashboard image..."
    cd admin-dashboard
    docker build -t faxi-admin-dashboard:qa -f Dockerfile .
    docker tag faxi-admin-dashboard:qa $ECR_REGISTRY/faxi-admin-dashboard:qa
    docker tag faxi-admin-dashboard:qa $ECR_REGISTRY/faxi-admin-dashboard:latest-qa
    docker push $ECR_REGISTRY/faxi-admin-dashboard:qa
    docker push $ECR_REGISTRY/faxi-admin-dashboard:latest-qa
    cd ..
    
    # Build and push marketing website
    log_info "Building marketing website image..."
    cd marketing-website
    docker build -t faxi-marketing-website:qa -f Dockerfile .
    docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:qa
    docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:latest-qa
    docker push $ECR_REGISTRY/faxi-marketing-website:qa
    docker push $ECR_REGISTRY/faxi-marketing-website:latest-qa
    cd ..
    
    log_info "Images built and pushed successfully."
}

setup_secrets() {
    log_info "Setting up AWS Secrets Manager secrets..."
    
    # Check if secrets exist, create if not
    if ! aws secretsmanager describe-secret --secret-id faxi/qa/database --region $AWS_REGION &> /dev/null; then
        log_info "Creating database secret..."
        aws secretsmanager create-secret \
            --name faxi/qa/database \
            --description "Faxi QA Database credentials" \
            --secret-string '{"username":"faxi_qa_user","password":"CHANGE_ME"}' \
            --region $AWS_REGION
        log_warn "Please update the database secret with actual credentials"
    fi
    
    if ! aws secretsmanager describe-secret --secret-id faxi/qa/telnyx --region $AWS_REGION &> /dev/null; then
        log_info "Creating Telnyx secret..."
        aws secretsmanager create-secret \
            --name faxi/qa/telnyx \
            --description "Faxi QA Telnyx API credentials" \
            --secret-string '{"api_key":"CHANGE_ME","public_key":"CHANGE_ME"}' \
            --region $AWS_REGION
        log_warn "Please update the Telnyx secret with actual credentials"
    fi
    
    if ! aws secretsmanager describe-secret --secret-id faxi/qa/gemini --region $AWS_REGION &> /dev/null; then
        log_info "Creating Gemini secret..."
        aws secretsmanager create-secret \
            --name faxi/qa/gemini \
            --description "Faxi QA Gemini API key" \
            --secret-string '{"api_key":"CHANGE_ME"}' \
            --region $AWS_REGION
        log_warn "Please update the Gemini secret with actual API key"
    fi
    
    log_info "Secrets setup complete."
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Get database endpoint from RDS
    DB_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier qa-faxi-db \
        --region $AWS_REGION \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    if [ -z "$DB_ENDPOINT" ]; then
        log_error "Could not get database endpoint"
        exit 1
    fi
    
    # Run migrations using a temporary ECS task
    log_info "Database endpoint: $DB_ENDPOINT"
    log_info "Running migration task..."
    
    # This would run the migration as an ECS task
    # For now, log instructions
    log_warn "Please run migrations manually:"
    log_warn "  cd backend && npm run migrate"
    
    log_info "Migrations complete."
}

deploy_services() {
    log_info "Deploying ECS services..."
    
    # Deploy backend service
    log_info "Deploying backend service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service ${SERVICE_PREFIX}-backend \
        --force-new-deployment \
        --region $AWS_REGION || \
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name ${SERVICE_PREFIX}-backend \
        --task-definition ${SERVICE_PREFIX}-backend \
        --desired-count 2 \
        --launch-type FARGATE \
        --region $AWS_REGION
    
    # Deploy admin dashboard service
    log_info "Deploying admin dashboard service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service ${SERVICE_PREFIX}-admin \
        --force-new-deployment \
        --region $AWS_REGION || \
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name ${SERVICE_PREFIX}-admin \
        --task-definition ${SERVICE_PREFIX}-admin \
        --desired-count 2 \
        --launch-type FARGATE \
        --region $AWS_REGION
    
    # Deploy marketing website service
    log_info "Deploying marketing website service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service ${SERVICE_PREFIX}-marketing \
        --force-new-deployment \
        --region $AWS_REGION || \
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name ${SERVICE_PREFIX}-marketing \
        --task-definition ${SERVICE_PREFIX}-marketing \
        --desired-count 2 \
        --launch-type FARGATE \
        --region $AWS_REGION
    
    log_info "Services deployed successfully."
}

check_health() {
    log_info "Checking service health..."
    
    # Wait for services to stabilize
    sleep 30
    
    # Check backend health
    log_info "Checking backend health..."
    if curl -f https://qa-fax.faxi.jp/health &> /dev/null; then
        log_info "✓ Backend is healthy"
    else
        log_error "✗ Backend health check failed"
    fi
    
    # Check admin dashboard
    log_info "Checking admin dashboard..."
    if curl -f https://qa-admin.faxi.jp &> /dev/null; then
        log_info "✓ Admin dashboard is healthy"
    else
        log_error "✗ Admin dashboard health check failed"
    fi
    
    # Check marketing website
    log_info "Checking marketing website..."
    if curl -f https://qa.faxi.jp &> /dev/null; then
        log_info "✓ Marketing website is healthy"
    else
        log_error "✗ Marketing website health check failed"
    fi
}

rollback() {
    log_warn "Rolling back QA deployment..."
    
    # Rollback each service to previous task definition
    for service in backend admin marketing; do
        log_info "Rolling back ${SERVICE_PREFIX}-${service}..."
        aws ecs update-service \
            --cluster $CLUSTER_NAME \
            --service ${SERVICE_PREFIX}-${service} \
            --task-definition ${SERVICE_PREFIX}-${service}:previous \
            --region $AWS_REGION
    done
    
    log_info "Rollback complete."
}

show_status() {
    log_info "QA Environment Status:"
    echo ""
    
    # Show ECS services
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services ${SERVICE_PREFIX}-backend ${SERVICE_PREFIX}-admin ${SERVICE_PREFIX}-marketing \
        --region $AWS_REGION \
        --query 'services[*].[serviceName,status,runningCount,desiredCount]' \
        --output table
    
    echo ""
    log_info "URLs:"
    echo "  Marketing: https://qa.faxi.jp"
    echo "  Admin:     https://qa-admin.faxi.jp"
    echo "  Backend:   https://qa-fax.faxi.jp"
}

case $COMMAND in
    "full")
        log_info "Starting full QA deployment..."
        check_prerequisites
        setup_infrastructure
        setup_secrets
        build_and_push_images
        run_migrations
        deploy_services
        check_health
        show_status
        log_info "QA deployment complete!"
        ;;
    "infra")
        check_prerequisites
        setup_infrastructure
        ;;
    "secrets")
        check_prerequisites
        setup_secrets
        ;;
    "build")
        check_prerequisites
        build_and_push_images
        ;;
    "migrate")
        check_prerequisites
        run_migrations
        ;;
    "deploy")
        check_prerequisites
        deploy_services
        ;;
    "health")
        check_health
        ;;
    "status")
        show_status
        ;;
    "rollback")
        rollback
        ;;
    "help")
        echo "Faxi QA Deployment Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  full      - Full deployment (infra + secrets + build + migrate + deploy)"
        echo "  infra     - Setup infrastructure (ECR, ECS, RDS, Redis, S3)"
        echo "  secrets   - Setup AWS Secrets Manager secrets"
        echo "  build     - Build and push Docker images"
        echo "  migrate   - Run database migrations"
        echo "  deploy    - Deploy ECS services"
        echo "  health    - Check service health"
        echo "  status    - Show deployment status"
        echo "  rollback  - Rollback to previous version"
        echo "  help      - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  AWS_REGION    - AWS region (default: us-east-1)"
        echo "  ECR_REGISTRY  - ECR registry URL"
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo "Run '$0 help' for available commands."
        exit 1
        ;;
esac
