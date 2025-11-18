#!/bin/bash

# Faxi Core System - Production Configuration Validator
# This script validates that all required external services are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE="${1:-.env.production}"
VERBOSE="${VERBOSE:-false}"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_CHECKS++))
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

check_command() {
    local cmd="$1"
    local name="$2"
    
    ((TOTAL_CHECKS++))
    if command -v "$cmd" >/dev/null 2>&1; then
        log_success "$name is installed"
        return 0
    else
        log_error "$name is not installed"
        return 1
    fi
}

check_env_var() {
    local var_name="$1"
    local description="$2"
    local required="${3:-true}"
    
    ((TOTAL_CHECKS++))
    if [[ -n "${!var_name}" ]]; then
        log_success "$description is configured"
        log_verbose "$var_name=${!var_name}"
        return 0
    else
        if [[ "$required" == "true" ]]; then
            log_error "$description is missing (${var_name})"
        else
            log_warning "$description is not configured (${var_name}) - optional"
        fi
        return 1
    fi
}

test_api_endpoint() {
    local url="$1"
    local description="$2"
    local expected_status="${3:-200}"
    
    ((TOTAL_CHECKS++))
    log_verbose "Testing $url"
    
    if command -v curl >/dev/null 2>&1; then
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 || echo "000")
        
        if [[ "$status_code" == "$expected_status" ]]; then
            log_success "$description is accessible (HTTP $status_code)"
            return 0
        else
            log_error "$description returned HTTP $status_code (expected $expected_status)"
            return 1
        fi
    else
        log_warning "curl not available, skipping $description test"
        return 1
    fi
}

test_dns_record() {
    local domain="$1"
    local record_type="$2"
    local description="$3"
    
    ((TOTAL_CHECKS++))
    if command -v dig >/dev/null 2>&1; then
        local result
        result=$(dig +short "$domain" "$record_type" 2>/dev/null)
        
        if [[ -n "$result" ]]; then
            log_success "$description DNS record exists"
            log_verbose "$domain $record_type -> $result"
            return 0
        else
            log_error "$description DNS record not found"
            return 1
        fi
    else
        log_warning "dig not available, skipping DNS test for $description"
        return 1
    fi
}

# Main validation function
main() {
    echo "======================================"
    echo "Faxi Production Configuration Validator"
    echo "======================================"
    echo
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file $ENV_FILE not found"
        echo "Please create the file or specify a different path:"
        echo "  $0 /path/to/.env.production"
        exit 1
    fi
    
    log_info "Loading environment from $ENV_FILE"
    
    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    echo
    log_info "Checking required tools..."
    
    # Check required tools
    check_command "curl" "curl"
    check_command "dig" "dig (DNS lookup)"
    check_command "node" "Node.js"
    check_command "npm" "npm"
    
    echo
    log_info "Validating environment variables..."
    
    # Database configuration
    check_env_var "DATABASE_HOST" "Database host"
    check_env_var "DATABASE_PORT" "Database port"
    check_env_var "DATABASE_NAME" "Database name"
    check_env_var "DATABASE_USER" "Database user"
    check_env_var "DATABASE_PASSWORD" "Database password"
    
    # Redis configuration
    check_env_var "REDIS_HOST" "Redis host"
    check_env_var "REDIS_PORT" "Redis port"
    check_env_var "REDIS_PASSWORD" "Redis password" false
    
    # S3 configuration
    check_env_var "S3_ENDPOINT" "S3 endpoint"
    check_env_var "S3_REGION" "S3 region"
    check_env_var "S3_BUCKET" "S3 bucket"
    check_env_var "S3_ACCESS_KEY_ID" "S3 access key ID"
    check_env_var "S3_SECRET_ACCESS_KEY" "S3 secret access key"
    
    # Telnyx configuration
    check_env_var "TELNYX_API_KEY" "Telnyx API key"
    check_env_var "TELNYX_PUBLIC_KEY" "Telnyx public key"
    check_env_var "TELNYX_FAX_NUMBER" "Telnyx fax number"
    
    # Google Gemini configuration
    check_env_var "GEMINI_API_KEY" "Google Gemini API key"
    check_env_var "GEMINI_MODEL" "Google Gemini model"
    
    # Stripe configuration
    check_env_var "STRIPE_SECRET_KEY" "Stripe secret key"
    check_env_var "STRIPE_PUBLISHABLE_KEY" "Stripe publishable key"
    check_env_var "STRIPE_WEBHOOK_SECRET" "Stripe webhook secret"
    
    # Email configuration
    check_env_var "EMAIL_PROVIDER" "Email provider"
    check_env_var "EMAIL_FROM_DOMAIN" "Email from domain"
    
    if [[ "$EMAIL_PROVIDER" == "sendgrid" ]]; then
        check_env_var "SENDGRID_API_KEY" "SendGrid API key"
    elif [[ "$EMAIL_PROVIDER" == "ses" ]]; then
        check_env_var "AWS_SES_REGION" "AWS SES region"
        check_env_var "AWS_SES_ACCESS_KEY_ID" "AWS SES access key ID"
        check_env_var "AWS_SES_SECRET_ACCESS_KEY" "AWS SES secret access key"
    fi
    
    # Application configuration
    check_env_var "NODE_ENV" "Node environment"
    check_env_var "BASE_URL" "Base URL"
    
    echo
    log_info "Testing external API connectivity..."
    
    # Test Telnyx API
    if [[ -n "$TELNYX_API_KEY" ]]; then
        test_api_endpoint "https://api.telnyx.com/v2/fax_applications" "Telnyx API" "200"
    fi
    
    # Test Google Gemini API (basic connectivity)
    if [[ -n "$GEMINI_API_KEY" ]]; then
        test_api_endpoint "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" "Google Gemini API" "200"
    fi
    
    # Test Stripe API
    if [[ -n "$STRIPE_SECRET_KEY" ]]; then
        # Use a simple API call that doesn't require additional setup
        local stripe_test_url="https://api.stripe.com/v1/account"
        ((TOTAL_CHECKS++))
        local stripe_result
        stripe_result=$(curl -s -u "$STRIPE_SECRET_KEY:" "$stripe_test_url" --max-time 10 2>/dev/null || echo "error")
        
        if [[ "$stripe_result" != "error" ]] && echo "$stripe_result" | grep -q '"id"'; then
            log_success "Stripe API is accessible"
        else
            log_error "Stripe API test failed"
        fi
    fi
    
    # Test SendGrid API
    if [[ -n "$SENDGRID_API_KEY" ]]; then
        ((TOTAL_CHECKS++))
        local sendgrid_result
        sendgrid_result=$(curl -s -H "Authorization: Bearer $SENDGRID_API_KEY" \
            "https://api.sendgrid.com/v3/user/account" --max-time 10 2>/dev/null || echo "error")
        
        if [[ "$sendgrid_result" != "error" ]] && echo "$sendgrid_result" | grep -q '"type"'; then
            log_success "SendGrid API is accessible"
        else
            log_error "SendGrid API test failed"
        fi
    fi
    
    echo
    log_info "Testing DNS configuration..."
    
    # Extract domain from BASE_URL
    local domain
    domain=$(echo "$BASE_URL" | sed 's|https\?://||' | sed 's|/.*||')
    
    if [[ -n "$domain" ]]; then
        test_dns_record "$domain" "A" "Main application domain"
    fi
    
    # Test email domain DNS
    if [[ -n "$EMAIL_FROM_DOMAIN" ]]; then
        test_dns_record "$EMAIL_FROM_DOMAIN" "MX" "Email domain MX record"
        test_dns_record "$EMAIL_FROM_DOMAIN" "TXT" "Email domain SPF record"
    fi
    
    echo
    log_info "Validating configuration values..."
    
    # Validate NODE_ENV
    ((TOTAL_CHECKS++))
    if [[ "$NODE_ENV" == "production" ]]; then
        log_success "Node environment is set to production"
    else
        log_warning "Node environment is not set to production (current: $NODE_ENV)"
    fi
    
    # Validate TEST_MODE
    ((TOTAL_CHECKS++))
    if [[ "$TEST_MODE" == "false" || -z "$TEST_MODE" ]]; then
        log_success "Test mode is disabled"
    else
        log_warning "Test mode is enabled - should be disabled in production"
    fi
    
    # Validate API keys are not test keys
    ((TOTAL_CHECKS++))
    if [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
        log_success "Stripe secret key is a live key"
    elif [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
        log_error "Stripe secret key is a test key - should be live key in production"
    else
        log_warning "Could not determine Stripe key type"
    fi
    
    ((TOTAL_CHECKS++))
    if [[ "$STRIPE_PUBLISHABLE_KEY" == pk_live_* ]]; then
        log_success "Stripe publishable key is a live key"
    elif [[ "$STRIPE_PUBLISHABLE_KEY" == pk_test_* ]]; then
        log_error "Stripe publishable key is a test key - should be live key in production"
    else
        log_warning "Could not determine Stripe publishable key type"
    fi
    
    # Validate Telnyx API key format
    ((TOTAL_CHECKS++))
    if [[ "$TELNYX_API_KEY" == KEY_* ]]; then
        log_success "Telnyx API key has correct format"
    else
        log_error "Telnyx API key does not have expected format (should start with KEY_)"
    fi
    
    # Validate fax number format
    ((TOTAL_CHECKS++))
    if [[ "$TELNYX_FAX_NUMBER" =~ ^\+[1-9][0-9]{7,14}$ ]]; then
        log_success "Telnyx fax number has valid format"
    else
        log_error "Telnyx fax number format is invalid (should be +1234567890)"
    fi
    
    # Validate BASE_URL is HTTPS
    ((TOTAL_CHECKS++))
    if [[ "$BASE_URL" == https://* ]]; then
        log_success "Base URL uses HTTPS"
    else
        log_error "Base URL should use HTTPS in production"
    fi
    
    echo
    log_info "Testing S3 connectivity..."
    
    # Test S3 access if AWS CLI is available
    if command -v aws >/dev/null 2>&1 && [[ -n "$S3_BUCKET" ]]; then
        ((TOTAL_CHECKS++))
        
        # Set AWS credentials for this test
        export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
        export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
        export AWS_DEFAULT_REGION="$S3_REGION"
        
        if aws s3 ls "s3://$S3_BUCKET" >/dev/null 2>&1; then
            log_success "S3 bucket is accessible"
        else
            log_error "S3 bucket is not accessible"
        fi
    else
        log_warning "AWS CLI not available or S3 bucket not configured, skipping S3 test"
    fi
    
    echo
    echo "======================================"
    echo "Validation Summary"
    echo "======================================"
    echo "Total checks: $TOTAL_CHECKS"
    echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
    echo
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log_success "All critical checks passed! Your production configuration looks good."
        echo
        echo "Next steps:"
        echo "1. Deploy your application"
        echo "2. Run end-to-end tests"
        echo "3. Set up monitoring and alerting"
        echo "4. Configure backup procedures"
        exit 0
    else
        log_error "Some checks failed. Please review the errors above before deploying to production."
        echo
        echo "Common fixes:"
        echo "- Update environment variables in $ENV_FILE"
        echo "- Verify API keys are correct and have proper permissions"
        echo "- Check DNS configuration and propagation"
        echo "- Ensure all external services are properly set up"
        exit 1
    fi
}

# Show usage if help requested
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    echo "Usage: $0 [ENV_FILE]"
    echo
    echo "Validates production configuration for Faxi Core System"
    echo
    echo "Arguments:"
    echo "  ENV_FILE    Path to environment file (default: .env.production)"
    echo
    echo "Environment variables:"
    echo "  VERBOSE     Set to 'true' for verbose output"
    echo
    echo "Examples:"
    echo "  $0                           # Use .env.production"
    echo "  $0 .env.staging              # Use custom env file"
    echo "  VERBOSE=true $0              # Verbose output"
    exit 0
fi

# Run main function
main "$@"