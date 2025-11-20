#!/bin/bash

# Faxi Core System - Production Secrets Setup
# This script helps set up secrets management for different deployment platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    echo "Usage: $0 <platform> [options]"
    echo
    echo "Platforms:"
    echo "  aws         Set up AWS Secrets Manager"
    echo "  k8s         Set up Kubernetes secrets"
    echo "  docker      Set up Docker secrets"
    echo "  env         Generate environment file template"
    echo
    echo "Options:"
    echo "  --dry-run   Show commands without executing"
    echo "  --help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0 aws                    # Set up AWS secrets"
    echo "  $0 k8s --dry-run          # Show K8s commands"
    echo "  $0 env                    # Generate .env template"
}

# Generate secure random password
generate_password() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
}

# Setup AWS Secrets Manager
setup_aws_secrets() {
    local dry_run="$1"
    
    log_info "Setting up AWS Secrets Manager for Faxi Core System"
    
    # Check if AWS CLI is available
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    local region="${AWS_DEFAULT_REGION:-us-east-1}"
    log_info "Using AWS region: $region"
    
    # Database secrets
    local db_password
    db_password=$(generate_password 24)
    
    local db_secret='{
        "host": "CHANGE_ME_RDS_ENDPOINT",
        "port": "5432",
        "name": "faxi",
        "user": "faxi_user",
        "password": "'$db_password'",
        "pool_min": "5",
        "pool_max": "20"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/database --description 'Faxi database configuration' --secret-string '$db_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/database \
            --description "Faxi database configuration" \
            --secret-string "$db_secret" \
            --region "$region" || log_warning "Database secret may already exist"
    fi
    
    # Redis secrets
    local redis_password
    redis_password=$(generate_password 24)
    
    local redis_secret='{
        "host": "CHANGE_ME_REDIS_ENDPOINT",
        "port": "6379",
        "password": "'$redis_password'",
        "db": "0"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/redis --description 'Faxi Redis configuration' --secret-string '$redis_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/redis \
            --description "Faxi Redis configuration" \
            --secret-string "$redis_secret" \
            --region "$region" || log_warning "Redis secret may already exist"
    fi
    
    # Telnyx secrets
    local telnyx_secret='{
        "api_key": "CHANGE_ME_TELNYX_API_KEY",
        "public_key": "CHANGE_ME_TELNYX_PUBLIC_KEY",
        "fax_number": "+1234567890",
        "webhook_timeout": "5"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/telnyx --description 'Faxi Telnyx configuration' --secret-string '$telnyx_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/telnyx \
            --description "Faxi Telnyx configuration" \
            --secret-string "$telnyx_secret" \
            --region "$region" || log_warning "Telnyx secret may already exist"
    fi
    
    # Google Gemini secrets
    local gemini_secret='{
        "api_key": "CHANGE_ME_GEMINI_API_KEY",
        "model": "gemini-2.5-flash"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/gemini --description 'Faxi Google Gemini configuration' --secret-string '$gemini_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/gemini \
            --description "Faxi Google Gemini configuration" \
            --secret-string "$gemini_secret" \
            --region "$region" || log_warning "Gemini secret may already exist"
    fi
    
    # Stripe secrets
    local stripe_secret='{
        "secret_key": "CHANGE_ME_STRIPE_SECRET_KEY",
        "publishable_key": "CHANGE_ME_STRIPE_PUBLISHABLE_KEY",
        "webhook_secret": "CHANGE_ME_STRIPE_WEBHOOK_SECRET"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/stripe --description 'Faxi Stripe configuration' --secret-string '$stripe_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/stripe \
            --description "Faxi Stripe configuration" \
            --secret-string "$stripe_secret" \
            --region "$region" || log_warning "Stripe secret may already exist"
    fi
    
    # Email secrets
    local email_secret='{
        "provider": "sendgrid",
        "sendgrid_api_key": "CHANGE_ME_SENDGRID_API_KEY",
        "webhook_secret": "CHANGE_ME_EMAIL_WEBHOOK_SECRET",
        "from_domain": "me.faxi.jp",
        "smtp_host": "mail.faxi.jp",
        "smtp_port": "587",
        "smtp_user": "noreply@faxi.jp",
        "smtp_pass": "CHANGE_ME_SMTP_PASSWORD"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/email --description 'Faxi email configuration' --secret-string '$email_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/email \
            --description "Faxi email configuration" \
            --secret-string "$email_secret" \
            --region "$region" || log_warning "Email secret may already exist"
    fi
    
    # S3 secrets
    local s3_secret='{
        "endpoint": "https://s3.amazonaws.com",
        "region": "'$region'",
        "bucket": "CHANGE_ME_S3_BUCKET_NAME",
        "access_key_id": "CHANGE_ME_S3_ACCESS_KEY_ID",
        "secret_access_key": "CHANGE_ME_S3_SECRET_ACCESS_KEY"
    }'
    
    if [[ "$dry_run" == "true" ]]; then
        echo "aws secretsmanager create-secret --name faxi/s3 --description 'Faxi S3 configuration' --secret-string '$s3_secret'"
    else
        aws secretsmanager create-secret \
            --name faxi/s3 \
            --description "Faxi S3 configuration" \
            --secret-string "$s3_secret" \
            --region "$region" || log_warning "S3 secret may already exist"
    fi
    
    if [[ "$dry_run" != "true" ]]; then
        log_success "AWS secrets created successfully!"
        echo
        log_info "Next steps:"
        echo "1. Update the secret values in AWS Secrets Manager console:"
        echo "   - Replace all 'CHANGE_ME_*' placeholders with actual values"
        echo "2. Update your ECS task definition to use these secrets"
        echo "3. Ensure your ECS task execution role has SecretsManager permissions"
        echo
        log_info "To update a secret:"
        echo "aws secretsmanager update-secret --secret-id faxi/database --secret-string '{\"host\":\"actual-endpoint\"}'"
    fi
}

# Setup Kubernetes secrets
setup_k8s_secrets() {
    local dry_run="$1"
    
    log_info "Setting up Kubernetes secrets for Faxi Core System"
    
    # Check if kubectl is available
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl is not installed. Please install it first."
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "kubectl is not connected to a cluster. Please configure kubectl first."
        exit 1
    fi
    
    local namespace="faxi"
    
    # Create namespace
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create namespace $namespace"
    else
        kubectl create namespace "$namespace" 2>/dev/null || log_warning "Namespace $namespace may already exist"
    fi
    
    # Generate passwords
    local db_password
    db_password=$(generate_password 24)
    local redis_password
    redis_password=$(generate_password 24)
    
    # Database secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-database --namespace=$namespace \\"
        echo "  --from-literal=host=CHANGE_ME_RDS_ENDPOINT \\"
        echo "  --from-literal=port=5432 \\"
        echo "  --from-literal=name=faxi \\"
        echo "  --from-literal=user=faxi_user \\"
        echo "  --from-literal=password=$db_password"
    else
        kubectl create secret generic faxi-database \
            --namespace="$namespace" \
            --from-literal=host="CHANGE_ME_RDS_ENDPOINT" \
            --from-literal=port="5432" \
            --from-literal=name="faxi" \
            --from-literal=user="faxi_user" \
            --from-literal=password="$db_password" \
            2>/dev/null || log_warning "Database secret may already exist"
    fi
    
    # Redis secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-redis --namespace=$namespace \\"
        echo "  --from-literal=host=CHANGE_ME_REDIS_ENDPOINT \\"
        echo "  --from-literal=port=6379 \\"
        echo "  --from-literal=password=$redis_password \\"
        echo "  --from-literal=db=0"
    else
        kubectl create secret generic faxi-redis \
            --namespace="$namespace" \
            --from-literal=host="CHANGE_ME_REDIS_ENDPOINT" \
            --from-literal=port="6379" \
            --from-literal=password="$redis_password" \
            --from-literal=db="0" \
            2>/dev/null || log_warning "Redis secret may already exist"
    fi
    
    # Telnyx secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-telnyx --namespace=$namespace \\"
        echo "  --from-literal=api-key=CHANGE_ME_TELNYX_API_KEY \\"
        echo "  --from-literal=public-key=CHANGE_ME_TELNYX_PUBLIC_KEY \\"
        echo "  --from-literal=fax-number=+1234567890"
    else
        kubectl create secret generic faxi-telnyx \
            --namespace="$namespace" \
            --from-literal=api-key="CHANGE_ME_TELNYX_API_KEY" \
            --from-literal=public-key="CHANGE_ME_TELNYX_PUBLIC_KEY" \
            --from-literal=fax-number="+1234567890" \
            2>/dev/null || log_warning "Telnyx secret may already exist"
    fi
    
    # Google Gemini secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-gemini --namespace=$namespace \\"
        echo "  --from-literal=api-key=CHANGE_ME_GEMINI_API_KEY \\"
        echo "  --from-literal=model=gemini-2.5-flash"
    else
        kubectl create secret generic faxi-gemini \
            --namespace="$namespace" \
            --from-literal=api-key="CHANGE_ME_GEMINI_API_KEY" \
            --from-literal=model="gemini-2.5-flash" \
            2>/dev/null || log_warning "Gemini secret may already exist"
    fi
    
    # Stripe secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-stripe --namespace=$namespace \\"
        echo "  --from-literal=secret-key=CHANGE_ME_STRIPE_SECRET_KEY \\"
        echo "  --from-literal=publishable-key=CHANGE_ME_STRIPE_PUBLISHABLE_KEY \\"
        echo "  --from-literal=webhook-secret=CHANGE_ME_STRIPE_WEBHOOK_SECRET"
    else
        kubectl create secret generic faxi-stripe \
            --namespace="$namespace" \
            --from-literal=secret-key="CHANGE_ME_STRIPE_SECRET_KEY" \
            --from-literal=publishable-key="CHANGE_ME_STRIPE_PUBLISHABLE_KEY" \
            --from-literal=webhook-secret="CHANGE_ME_STRIPE_WEBHOOK_SECRET" \
            2>/dev/null || log_warning "Stripe secret may already exist"
    fi
    
    # Email secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-email --namespace=$namespace \\"
        echo "  --from-literal=provider=sendgrid \\"
        echo "  --from-literal=sendgrid-api-key=CHANGE_ME_SENDGRID_API_KEY \\"
        echo "  --from-literal=webhook-secret=CHANGE_ME_EMAIL_WEBHOOK_SECRET \\"
        echo "  --from-literal=from-domain=me.faxi.jp \\"
        echo "  --from-literal=smtp-host=mail.faxi.jp \\"
        echo "  --from-literal=smtp-port=587 \\"
        echo "  --from-literal=smtp-user=noreply@faxi.jp \\"
        echo "  --from-literal=smtp-pass=CHANGE_ME_SMTP_PASSWORD"
    else
        kubectl create secret generic faxi-email \
            --namespace="$namespace" \
            --from-literal=provider="sendgrid" \
            --from-literal=sendgrid-api-key="CHANGE_ME_SENDGRID_API_KEY" \
            --from-literal=webhook-secret="CHANGE_ME_EMAIL_WEBHOOK_SECRET" \
            --from-literal=from-domain="me.faxi.jp" \
            --from-literal=smtp-host="mail.faxi.jp" \
            --from-literal=smtp-port="587" \
            --from-literal=smtp-user="noreply@faxi.jp" \
            --from-literal=smtp-pass="CHANGE_ME_SMTP_PASSWORD" \
            2>/dev/null || log_warning "Email secret may already exist"
    fi
    
    # S3 secret
    if [[ "$dry_run" == "true" ]]; then
        echo "kubectl create secret generic faxi-s3 --namespace=$namespace \\"
        echo "  --from-literal=endpoint=https://s3.amazonaws.com \\"
        echo "  --from-literal=region=us-east-1 \\"
        echo "  --from-literal=bucket=CHANGE_ME_S3_BUCKET_NAME \\"
        echo "  --from-literal=access-key-id=CHANGE_ME_S3_ACCESS_KEY_ID \\"
        echo "  --from-literal=secret-access-key=CHANGE_ME_S3_SECRET_ACCESS_KEY"
    else
        kubectl create secret generic faxi-s3 \
            --namespace="$namespace" \
            --from-literal=endpoint="https://s3.amazonaws.com" \
            --from-literal=region="us-east-1" \
            --from-literal=bucket="CHANGE_ME_S3_BUCKET_NAME" \
            --from-literal=access-key-id="CHANGE_ME_S3_ACCESS_KEY_ID" \
            --from-literal=secret-access-key="CHANGE_ME_S3_SECRET_ACCESS_KEY" \
            2>/dev/null || log_warning "S3 secret may already exist"
    fi
    
    if [[ "$dry_run" != "true" ]]; then
        log_success "Kubernetes secrets created successfully!"
        echo
        log_info "Next steps:"
        echo "1. Update the secret values:"
        echo "   kubectl patch secret faxi-database -n $namespace --type='json' -p='[{\"op\": \"replace\", \"path\": \"/data/host\", \"value\":\"<base64-encoded-value>\"}]'"
        echo "2. Update your deployment manifests to use these secrets"
        echo "3. Apply RBAC policies to restrict secret access"
        echo
        log_info "To view secrets:"
        echo "kubectl get secrets -n $namespace"
        echo "kubectl describe secret faxi-database -n $namespace"
    fi
}

# Setup Docker secrets
setup_docker_secrets() {
    local dry_run="$1"
    
    log_info "Setting up Docker secrets for Faxi Core System"
    
    # Check if docker is available
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker Swarm is initialized
    if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then
        log_warning "Docker Swarm is not initialized. Initializing now..."
        if [[ "$dry_run" != "true" ]]; then
            docker swarm init
        else
            echo "docker swarm init"
        fi
    fi
    
    # Generate passwords
    local db_password
    db_password=$(generate_password 24)
    local redis_password
    redis_password=$(generate_password 24)
    
    # Create secrets
    local secrets=(
        "faxi_db_password:$db_password"
        "faxi_redis_password:$redis_password"
        "faxi_telnyx_api_key:CHANGE_ME_TELNYX_API_KEY"
        "faxi_telnyx_public_key:CHANGE_ME_TELNYX_PUBLIC_KEY"
        "faxi_gemini_api_key:CHANGE_ME_GEMINI_API_KEY"
        "faxi_stripe_secret_key:CHANGE_ME_STRIPE_SECRET_KEY"
        "faxi_stripe_webhook_secret:CHANGE_ME_STRIPE_WEBHOOK_SECRET"
        "faxi_sendgrid_api_key:CHANGE_ME_SENDGRID_API_KEY"
        "faxi_email_webhook_secret:CHANGE_ME_EMAIL_WEBHOOK_SECRET"
        "faxi_smtp_password:CHANGE_ME_SMTP_PASSWORD"
        "faxi_s3_access_key_id:CHANGE_ME_S3_ACCESS_KEY_ID"
        "faxi_s3_secret_access_key:CHANGE_ME_S3_SECRET_ACCESS_KEY"
    )
    
    for secret_def in "${secrets[@]}"; do
        local secret_name="${secret_def%%:*}"
        local secret_value="${secret_def#*:}"
        
        if [[ "$dry_run" == "true" ]]; then
            echo "echo '$secret_value' | docker secret create $secret_name -"
        else
            echo "$secret_value" | docker secret create "$secret_name" - 2>/dev/null || log_warning "Secret $secret_name may already exist"
        fi
    done
    
    if [[ "$dry_run" != "true" ]]; then
        log_success "Docker secrets created successfully!"
        echo
        log_info "Next steps:"
        echo "1. Update the secret values:"
        echo "   echo 'actual_value' | docker secret create faxi_telnyx_api_key_new -"
        echo "   docker service update --secret-rm faxi_telnyx_api_key --secret-add faxi_telnyx_api_key_new faxi_app"
        echo "2. Update your docker-compose.yml to use these secrets"
        echo "3. Deploy your stack with: docker stack deploy -c docker-compose.yml faxi"
        echo
        log_info "To view secrets:"
        echo "docker secret ls"
    fi
}

# Generate environment file template
generate_env_template() {
    local output_file=".env.production.template"
    
    log_info "Generating production environment template: $output_file"
    
    cat > "$output_file" << 'EOF'
# Faxi Core System - Production Environment Configuration
# Copy this file to .env.production and update with actual values
# Generated on: $(date)

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
DATABASE_HOST=your-rds-endpoint.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=faxi
DATABASE_USER=faxi_user
DATABASE_PASSWORD=CHANGE_ME_STRONG_DATABASE_PASSWORD
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================
REDIS_HOST=your-redis-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD
REDIS_DB=0

# =============================================================================
# S3 CONFIGURATION
# =============================================================================
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=faxi-production-fax-images-123456789012
S3_ACCESS_KEY_ID=AKIA_CHANGE_ME_ACCESS_KEY
S3_SECRET_ACCESS_KEY=CHANGE_ME_SECRET_ACCESS_KEY

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
TEST_MODE=false

# =============================================================================
# TELNYX CONFIGURATION
# =============================================================================
TELNYX_API_KEY=KEY_CHANGE_ME_TELNYX_API_KEY
TELNYX_PUBLIC_KEY=CHANGE_ME_TELNYX_PUBLIC_KEY
TELNYX_FAX_NUMBER=+1234567890
TELNYX_WEBHOOK_TIMEOUT=5

# =============================================================================
# GOOGLE GEMINI CONFIGURATION
# =============================================================================
GEMINI_API_KEY=AIzaSy_CHANGE_ME_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash

# =============================================================================
# EMAIL CONFIGURATION
# =============================================================================
EMAIL_PROVIDER=sendgrid
EMAIL_WEBHOOK_SECRET=CHANGE_ME_EMAIL_WEBHOOK_SECRET
EMAIL_FROM_DOMAIN=me.faxi.jp

# SendGrid Configuration (if using SendGrid)
SENDGRID_API_KEY=SG.CHANGE_ME_SENDGRID_API_KEY

# AWS SES Configuration (if using AWS SES)
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIA_CHANGE_ME_SES_ACCESS_KEY
AWS_SES_SECRET_ACCESS_KEY=CHANGE_ME_SES_SECRET_ACCESS_KEY

# SMTP Configuration
SMTP_HOST=mail.faxi.jp
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@faxi.jp
SMTP_PASS=CHANGE_ME_SMTP_PASSWORD

# =============================================================================
# STRIPE CONFIGURATION
# =============================================================================
STRIPE_SECRET_KEY=sk_live_CHANGE_ME_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_CHANGE_ME_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_CHANGE_ME_STRIPE_WEBHOOK_SECRET

# =============================================================================
# BASE URL AND WEBHOOKS
# =============================================================================
BASE_URL=https://api.faxi.jp

# =============================================================================
# DOCKER COMPOSE CONFIGURATION
# =============================================================================
POSTGRES_PASSWORD=CHANGE_ME_STRONG_DATABASE_PASSWORD

# =============================================================================
# WORKER CONFIGURATION (OPTIONAL)
# =============================================================================
WORKER_CONCURRENCY=2
WORKER_MAX_STALLED_COUNT=1
WORKER_STALLED_INTERVAL=30000

# =============================================================================
# SECURITY NOTES
# =============================================================================
# 1. Replace ALL 'CHANGE_ME_*' placeholders with actual values
# 2. Use strong, unique passwords (minimum 24 characters)
# 3. Use production API keys (not test keys)
# 4. Ensure BASE_URL uses HTTPS
# 5. Keep this file secure and never commit to version control
# 6. Use secrets management in production (AWS Secrets Manager, K8s secrets, etc.)
EOF

    log_success "Environment template created: $output_file"
    echo
    log_info "Next steps:"
    echo "1. Copy the template: cp $output_file .env.production"
    echo "2. Replace all 'CHANGE_ME_*' placeholders with actual values"
    echo "3. Validate configuration: ./scripts/validate-production-config.sh"
    echo "4. Deploy your application"
    echo
    log_warning "Security reminder:"
    echo "- Never commit .env.production to version control"
    echo "- Use strong, unique passwords"
    echo "- Use production API keys (not test keys)"
    echo "- Consider using secrets management systems for production"
}

# Main function
main() {
    local platform="$1"
    local dry_run="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                if [[ -z "$platform" ]]; then
                    platform="$1"
                fi
                shift
                ;;
        esac
    done
    
    if [[ -z "$platform" ]]; then
        log_error "Platform not specified"
        show_usage
        exit 1
    fi
    
    echo "======================================"
    echo "Faxi Production Secrets Setup"
    echo "======================================"
    echo
    
    case "$platform" in
        aws)
            setup_aws_secrets "$dry_run"
            ;;
        k8s|kubernetes)
            setup_k8s_secrets "$dry_run"
            ;;
        docker)
            setup_docker_secrets "$dry_run"
            ;;
        env|environment)
            generate_env_template
            ;;
        *)
            log_error "Unknown platform: $platform"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"