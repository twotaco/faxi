#!/bin/bash

# Faxi Core System - SSL Certificate Setup Script
# This script helps set up SSL certificates for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-faxi.jp}"
EMAIL="${EMAIL:-admin@faxi.jp}"
CERT_METHOD="${CERT_METHOD:-letsencrypt}"
WEBROOT_PATH="${WEBROOT_PATH:-/var/www/certbot}"
CERT_PATH="${CERT_PATH:-/etc/nginx/ssl}"

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
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  letsencrypt     Set up Let's Encrypt certificates"
    echo "  acm             Set up AWS Certificate Manager"
    echo "  self-signed     Generate self-signed certificates (development only)"
    echo "  renew           Renew existing certificates"
    echo "  validate        Validate existing certificates"
    echo "  help            Show this help message"
    echo
    echo "Options:"
    echo "  --domain DOMAIN         Domain name (default: faxi.jp)"
    echo "  --email EMAIL           Email for certificate notifications"
    echo "  --webroot PATH          Webroot path for HTTP challenge"
    echo "  --cert-path PATH        Certificate output path"
    echo "  --dry-run               Test certificate request without saving"
    echo
    echo "Environment Variables:"
    echo "  AWS_PROFILE             AWS profile for ACM operations"
    echo "  AWS_DEFAULT_REGION      AWS region for ACM"
    echo
    echo "Examples:"
    echo "  $0 letsencrypt --domain faxi.jp --email admin@faxi.jp"
    echo "  $0 acm --domain faxi.jp"
    echo "  $0 renew"
}

# Set up Let's Encrypt certificates
setup_letsencrypt() {
    local domain="$1"
    local email="$2"
    local dry_run="$3"
    
    log_info "Setting up Let's Encrypt certificates for domain: $domain"
    
    # Check if certbot is installed
    if ! command -v certbot >/dev/null 2>&1; then
        log_info "Installing certbot..."
        
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y certbot python3-certbot-nginx
        elif command -v brew >/dev/null 2>&1; then
            brew install certbot
        else
            log_error "Could not install certbot. Please install it manually."
            exit 1
        fi
    fi
    
    local api_domain="api.${domain}"
    local email_domain="me.${domain}"
    local mail_domain="mail.${domain}"
    
    # Prepare certbot command
    local certbot_cmd="certbot certonly"
    
    if [[ "$dry_run" == "true" ]]; then
        certbot_cmd="$certbot_cmd --dry-run"
    fi
    
    # Check if nginx is running (use webroot method)
    if systemctl is-active --quiet nginx 2>/dev/null || pgrep nginx >/dev/null 2>&1; then
        log_info "Using webroot method (nginx is running)"
        
        # Ensure webroot directory exists
        sudo mkdir -p "$WEBROOT_PATH"
        sudo chown -R www-data:www-data "$WEBROOT_PATH" 2>/dev/null || \
        sudo chown -R nginx:nginx "$WEBROOT_PATH" 2>/dev/null || \
        sudo chown -R $(whoami):$(whoami) "$WEBROOT_PATH"
        
        certbot_cmd="$certbot_cmd --webroot -w $WEBROOT_PATH"
    else
        log_info "Using standalone method (nginx not running)"
        certbot_cmd="$certbot_cmd --standalone"
    fi
    
    # Add domains and email
    certbot_cmd="$certbot_cmd -d $api_domain -d $email_domain -d $mail_domain"
    certbot_cmd="$certbot_cmd --email $email --agree-tos --non-interactive"
    
    log_info "Running: $certbot_cmd"
    
    if sudo $certbot_cmd; then
        log_success "Let's Encrypt certificates obtained successfully!"
        
        if [[ "$dry_run" != "true" ]]; then
            # Set up auto-renewal
            setup_certbot_renewal
            
            # Copy certificates to nginx directory
            copy_letsencrypt_certs "$domain"
        fi
    else
        log_error "Failed to obtain Let's Encrypt certificates"
        exit 1
    fi
}

# Set up certbot auto-renewal
setup_certbot_renewal() {
    log_info "Setting up automatic certificate renewal..."
    
    # Create renewal script
    local renewal_script="/usr/local/bin/certbot-renew.sh"
    
    sudo tee "$renewal_script" > /dev/null << 'EOF'
#!/bin/bash
# Certbot renewal script for Faxi Core System

# Renew certificates
/usr/bin/certbot renew --quiet

# Reload nginx if certificates were renewed
if [ $? -eq 0 ]; then
    # Copy certificates to nginx directory
    DOMAIN="faxi.jp"
    API_DOMAIN="api.$DOMAIN"
    
    if [ -f "/etc/letsencrypt/live/$API_DOMAIN/fullchain.pem" ]; then
        cp "/etc/letsencrypt/live/$API_DOMAIN/fullchain.pem" "/etc/nginx/ssl/faxi.crt"
        cp "/etc/letsencrypt/live/$API_DOMAIN/privkey.pem" "/etc/nginx/ssl/faxi.key"
        
        # Reload nginx
        systemctl reload nginx 2>/dev/null || docker exec nginx nginx -s reload 2>/dev/null || true
    fi
fi
EOF
    
    sudo chmod +x "$renewal_script"
    
    # Add cron job
    local cron_job="0 12 * * * $renewal_script"
    
    if ! sudo crontab -l 2>/dev/null | grep -q "$renewal_script"; then
        (sudo crontab -l 2>/dev/null; echo "$cron_job") | sudo crontab -
        log_success "Added cron job for automatic renewal"
    else
        log_info "Cron job for renewal already exists"
    fi
}

# Copy Let's Encrypt certificates to nginx directory
copy_letsencrypt_certs() {
    local domain="$1"
    local api_domain="api.${domain}"
    
    log_info "Copying certificates to nginx directory..."
    
    # Create nginx ssl directory
    sudo mkdir -p "$CERT_PATH"
    
    # Copy certificates
    if [[ -f "/etc/letsencrypt/live/$api_domain/fullchain.pem" ]]; then
        sudo cp "/etc/letsencrypt/live/$api_domain/fullchain.pem" "$CERT_PATH/faxi.crt"
        sudo cp "/etc/letsencrypt/live/$api_domain/privkey.pem" "$CERT_PATH/faxi.key"
        
        # Set proper permissions
        sudo chmod 644 "$CERT_PATH/faxi.crt"
        sudo chmod 600 "$CERT_PATH/faxi.key"
        sudo chown root:root "$CERT_PATH/faxi.crt" "$CERT_PATH/faxi.key"
        
        log_success "Certificates copied to $CERT_PATH"
    else
        log_error "Let's Encrypt certificates not found"
        exit 1
    fi
}

# Set up AWS Certificate Manager
setup_acm() {
    local domain="$1"
    local dry_run="$2"
    
    log_info "Setting up AWS Certificate Manager for domain: $domain"
    
    # Check if AWS CLI is installed
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    local region="${AWS_DEFAULT_REGION:-us-east-1}"
    local api_domain="api.${domain}"
    local email_domain="me.${domain}"
    local mail_domain="mail.${domain}"
    
    log_info "Using AWS region: $region"
    
    if [[ "$dry_run" == "true" ]]; then
        echo "Would request certificate for domains:"
        echo "  - $api_domain"
        echo "  - $email_domain"
        echo "  - $mail_domain"
        return 0
    fi
    
    # Request certificate
    log_info "Requesting ACM certificate..."
    
    local cert_arn
    cert_arn=$(aws acm request-certificate \
        --domain-name "$api_domain" \
        --subject-alternative-names "$email_domain" "$mail_domain" \
        --validation-method DNS \
        --region "$region" \
        --query 'CertificateArn' \
        --output text)
    
    if [[ -n "$cert_arn" ]]; then
        log_success "Certificate requested: $cert_arn"
        
        # Wait a moment for the certificate to be processed
        sleep 5
        
        # Get validation records
        log_info "Getting DNS validation records..."
        
        local validation_records
        validation_records=$(aws acm describe-certificate \
            --certificate-arn "$cert_arn" \
            --region "$region" \
            --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
            --output table)
        
        echo
        log_info "Add these DNS validation records to your domain:"
        echo "$validation_records"
        echo
        
        log_info "Waiting for certificate validation..."
        log_info "This may take several minutes. You can check status with:"
        echo "aws acm describe-certificate --certificate-arn $cert_arn --region $region"
        
        # Wait for validation (with timeout)
        local timeout=1800  # 30 minutes
        local elapsed=0
        local interval=30
        
        while [[ $elapsed -lt $timeout ]]; do
            local status
            status=$(aws acm describe-certificate \
                --certificate-arn "$cert_arn" \
                --region "$region" \
                --query 'Certificate.Status' \
                --output text)
            
            if [[ "$status" == "ISSUED" ]]; then
                log_success "Certificate validated and issued!"
                break
            elif [[ "$status" == "FAILED" ]]; then
                log_error "Certificate validation failed"
                exit 1
            else
                log_info "Certificate status: $status (waiting...)"
                sleep $interval
                ((elapsed += interval))
            fi
        done
        
        if [[ $elapsed -ge $timeout ]]; then
            log_warning "Certificate validation timed out. Check AWS console for status."
        fi
        
        echo
        log_info "Certificate ARN: $cert_arn"
        log_info "Use this ARN in your CloudFormation template or ELB configuration"
        
    else
        log_error "Failed to request ACM certificate"
        exit 1
    fi
}

# Generate self-signed certificates (development only)
setup_self_signed() {
    local domain="$1"
    
    log_warning "Generating self-signed certificates (DEVELOPMENT ONLY)"
    log_warning "Do NOT use self-signed certificates in production!"
    
    local api_domain="api.${domain}"
    
    # Create certificate directory
    sudo mkdir -p "$CERT_PATH"
    
    # Generate private key
    sudo openssl genrsa -out "$CERT_PATH/faxi.key" 2048
    
    # Generate certificate signing request
    sudo openssl req -new -key "$CERT_PATH/faxi.key" -out "$CERT_PATH/faxi.csr" -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Faxi/CN=$api_domain"
    
    # Generate self-signed certificate
    sudo openssl x509 -req -days 365 -in "$CERT_PATH/faxi.csr" -signkey "$CERT_PATH/faxi.key" -out "$CERT_PATH/faxi.crt" \
        -extensions v3_req -extfile <(cat << EOF
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $api_domain
DNS.2 = me.$domain
DNS.3 = mail.$domain
EOF
)
    
    # Set permissions
    sudo chmod 644 "$CERT_PATH/faxi.crt"
    sudo chmod 600 "$CERT_PATH/faxi.key"
    sudo chown root:root "$CERT_PATH/faxi.crt" "$CERT_PATH/faxi.key"
    
    # Clean up CSR
    sudo rm -f "$CERT_PATH/faxi.csr"
    
    log_success "Self-signed certificates generated at $CERT_PATH"
    log_warning "Remember: These certificates will show security warnings in browsers"
}

# Renew existing certificates
renew_certificates() {
    log_info "Renewing SSL certificates..."
    
    if command -v certbot >/dev/null 2>&1; then
        log_info "Renewing Let's Encrypt certificates..."
        
        if sudo certbot renew --quiet; then
            log_success "Let's Encrypt certificates renewed successfully"
            
            # Copy renewed certificates
            copy_letsencrypt_certs "$DOMAIN"
            
            # Reload nginx
            if systemctl is-active --quiet nginx 2>/dev/null; then
                sudo systemctl reload nginx
                log_success "Nginx reloaded"
            elif docker ps --format "table {{.Names}}" | grep -q nginx; then
                docker exec nginx nginx -s reload
                log_success "Nginx container reloaded"
            fi
        else
            log_warning "No certificates were renewed (they may not be due for renewal yet)"
        fi
    else
        log_warning "Certbot not found, skipping Let's Encrypt renewal"
    fi
    
    # Check ACM certificates (they auto-renew, just report status)
    if command -v aws >/dev/null 2>&1 && aws sts get-caller-identity >/dev/null 2>&1; then
        log_info "Checking ACM certificate status..."
        
        local certs
        certs=$(aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`api.'$DOMAIN'`].CertificateArn' --output text)
        
        if [[ -n "$certs" ]]; then
            for cert_arn in $certs; do
                local status
                status=$(aws acm describe-certificate --certificate-arn "$cert_arn" --query 'Certificate.Status' --output text)
                log_info "ACM Certificate $cert_arn: $status"
            done
        else
            log_info "No ACM certificates found for domain: $DOMAIN"
        fi
    fi
}

# Validate existing certificates
validate_certificates() {
    local domain="$1"
    local api_domain="api.${domain}"
    
    log_info "Validating SSL certificates for domain: $domain"
    
    local errors=0
    
    # Check local certificate files
    if [[ -f "$CERT_PATH/faxi.crt" && -f "$CERT_PATH/faxi.key" ]]; then
        log_info "Checking local certificate files..."
        
        # Check certificate validity
        local expiry
        expiry=$(sudo openssl x509 -in "$CERT_PATH/faxi.crt" -noout -enddate | cut -d= -f2)
        log_info "Certificate expires: $expiry"
        
        # Check if certificate is valid for domain
        local cert_domains
        cert_domains=$(sudo openssl x509 -in "$CERT_PATH/faxi.crt" -noout -text | grep -A1 "Subject Alternative Name" | tail -1 | tr ',' '\n' | grep DNS | cut -d: -f2 | tr -d ' ')
        
        if echo "$cert_domains" | grep -q "$api_domain"; then
            log_success "Certificate is valid for $api_domain"
        else
            log_error "Certificate is not valid for $api_domain"
            ((errors++))
        fi
        
        # Check certificate expiration (warn if < 30 days)
        local expiry_epoch
        expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry" +%s 2>/dev/null)
        local current_epoch
        current_epoch=$(date +%s)
        local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [[ $days_until_expiry -lt 30 ]]; then
            log_warning "Certificate expires in $days_until_expiry days - consider renewal"
        else
            log_success "Certificate is valid for $days_until_expiry days"
        fi
        
    else
        log_warning "Local certificate files not found at $CERT_PATH"
    fi
    
    # Check online certificate
    if command -v openssl >/dev/null 2>&1; then
        log_info "Checking online certificate..."
        
        if echo | openssl s_client -connect "$api_domain:443" -servername "$api_domain" >/dev/null 2>&1; then
            local online_expiry
            online_expiry=$(echo | openssl s_client -connect "$api_domain:443" -servername "$api_domain" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
            log_success "Online certificate is valid, expires: $online_expiry"
            
            # Check certificate chain
            local chain_length
            chain_length=$(echo | openssl s_client -connect "$api_domain:443" -servername "$api_domain" -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE")
            log_info "Certificate chain length: $chain_length"
            
        else
            log_error "Could not connect to $api_domain:443 or certificate is invalid"
            ((errors++))
        fi
    fi
    
    # Summary
    echo
    if [[ $errors -eq 0 ]]; then
        log_success "SSL certificate validation completed successfully!"
    else
        log_error "SSL certificate validation found $errors errors"
        return 1
    fi
}

# Main function
main() {
    local command="$1"
    shift
    
    local dry_run="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --webroot)
                WEBROOT_PATH="$2"
                shift 2
                ;;
            --cert-path)
                CERT_PATH="$2"
                shift 2
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    echo "======================================"
    echo "Faxi SSL Certificate Setup"
    echo "======================================"
    echo "Domain: $DOMAIN"
    echo "Email: $EMAIL"
    echo "Certificate Path: $CERT_PATH"
    echo
    
    case "$command" in
        letsencrypt)
            setup_letsencrypt "$DOMAIN" "$EMAIL" "$dry_run"
            ;;
        acm)
            setup_acm "$DOMAIN" "$dry_run"
            ;;
        self-signed)
            setup_self_signed "$DOMAIN"
            ;;
        renew)
            renew_certificates
            ;;
        validate)
            validate_certificates "$DOMAIN"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"