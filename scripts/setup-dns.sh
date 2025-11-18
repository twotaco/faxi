#!/bin/bash

# Faxi Core System - DNS Setup Script
# This script helps configure DNS records for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-faxi.jp}"
API_SUBDOMAIN="${API_SUBDOMAIN:-api}"
EMAIL_SUBDOMAIN="${EMAIL_SUBDOMAIN:-me}"
MAIL_SUBDOMAIN="${MAIL_SUBDOMAIN:-mail}"
SERVER_IP="${SERVER_IP:-}"
EMAIL_PROVIDER="${EMAIL_PROVIDER:-sendgrid}"

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
    echo "  generate        Generate DNS records configuration"
    echo "  validate        Validate current DNS configuration"
    echo "  cloudflare      Set up DNS records via Cloudflare API"
    echo "  route53         Set up DNS records via AWS Route53"
    echo "  help            Show this help message"
    echo
    echo "Options:"
    echo "  --domain DOMAIN         Domain name (default: faxi.jp)"
    echo "  --server-ip IP          Server IP address"
    echo "  --email-provider PROVIDER   Email provider (sendgrid|ses|postfix)"
    echo "  --dry-run               Show commands without executing"
    echo
    echo "Environment Variables:"
    echo "  CLOUDFLARE_API_TOKEN    Cloudflare API token"
    echo "  AWS_PROFILE             AWS profile for Route53"
    echo
    echo "Examples:"
    echo "  $0 generate --domain faxi.jp --server-ip 1.2.3.4"
    echo "  $0 validate --domain faxi.jp"
    echo "  $0 cloudflare --domain faxi.jp --server-ip 1.2.3.4"
}

# Generate DNS records configuration
generate_dns_records() {
    local domain="$1"
    local server_ip="$2"
    local email_provider="$3"
    
    log_info "Generating DNS records for domain: $domain"
    
    local api_domain="${API_SUBDOMAIN}.${domain}"
    local email_domain="${EMAIL_SUBDOMAIN}.${domain}"
    local mail_domain="${MAIL_SUBDOMAIN}.${domain}"
    
    cat << EOF

====================================
DNS Records Configuration
====================================
Domain: $domain
Server IP: $server_ip
Email Provider: $email_provider

# Main Application Records
$api_domain.        300    IN    A        $server_ip
www.$domain.        300    IN    CNAME    $api_domain.

# Email-to-Fax Records
$email_domain.      300    IN    MX       10    $mail_domain.
$mail_domain.       300    IN    A        $server_ip

# Email Authentication Records
EOF

    case "$email_provider" in
        sendgrid)
            cat << EOF
# SendGrid SPF Record
$email_domain.      300    IN    TXT      "v=spf1 include:sendgrid.net ~all"
$domain.            300    IN    TXT      "v=spf1 include:sendgrid.net ~all"

# SendGrid DKIM Records (replace with actual values from SendGrid)
s1._domainkey.$email_domain.    300    IN    CNAME    s1.domainkey.u1234567.wl123.sendgrid.net.
s2._domainkey.$email_domain.    300    IN    CNAME    s2.domainkey.u1234567.wl123.sendgrid.net.
s1._domainkey.$domain.          300    IN    CNAME    s1.domainkey.u1234567.wl123.sendgrid.net.
s2._domainkey.$domain.          300    IN    CNAME    s2.domainkey.u1234567.wl123.sendgrid.net.

# SendGrid Domain Authentication (replace with actual values)
em1234.$email_domain.           300    IN    CNAME    u1234567.wl123.sendgrid.net.
EOF
            ;;
        ses)
            cat << EOF
# AWS SES SPF Record
$email_domain.      300    IN    TXT      "v=spf1 include:amazonses.com ~all"
$domain.            300    IN    TXT      "v=spf1 include:amazonses.com ~all"

# AWS SES Domain Verification (replace with actual token)
_amazonses.$email_domain.       300    IN    TXT      "verification-token-from-ses"
_amazonses.$domain.             300    IN    TXT      "verification-token-from-ses"

# AWS SES DKIM Records (replace with actual tokens from SES)
token1._domainkey.$email_domain.    300    IN    CNAME    token1.dkim.amazonses.com.
token2._domainkey.$email_domain.    300    IN    CNAME    token2.dkim.amazonses.com.
token3._domainkey.$email_domain.    300    IN    CNAME    token3.dkim.amazonses.com.
EOF
            ;;
        postfix)
            cat << EOF
# Self-hosted SPF Record
$email_domain.      300    IN    TXT      "v=spf1 a mx ip4:$server_ip ~all"
$domain.            300    IN    TXT      "v=spf1 a mx ip4:$server_ip ~all"

# Self-hosted DKIM Record (generate with opendkim-genkey)
default._domainkey.$email_domain.   300    IN    TXT    "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY_HERE"
default._domainkey.$domain.         300    IN    TXT    "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY_HERE"
EOF
            ;;
    esac

    cat << EOF

# DMARC Records
_dmarc.$email_domain.   300    IN    TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@$domain; ruf=mailto:dmarc-failures@$domain; fo=1"
_dmarc.$domain.         300    IN    TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@$domain; ruf=mailto:dmarc-failures@$domain; fo=1"

# Security Records
$domain.            300    IN    CAA      0 issue "letsencrypt.org"
$domain.            300    IN    CAA      0 issue "amazon.com"
$domain.            300    IN    CAA      0 iodef "mailto:security@$domain"

====================================
Next Steps:
====================================
1. Add these records to your DNS provider
2. Wait for DNS propagation (up to 48 hours)
3. Validate configuration: $0 validate --domain $domain
4. Set up SSL certificates
5. Test email routing and webhooks

EOF
}

# Validate DNS configuration
validate_dns() {
    local domain="$1"
    
    log_info "Validating DNS configuration for domain: $domain"
    
    local api_domain="${API_SUBDOMAIN}.${domain}"
    local email_domain="${EMAIL_SUBDOMAIN}.${domain}"
    local mail_domain="${MAIL_SUBDOMAIN}.${domain}"
    
    local errors=0
    
    # Check A records
    log_info "Checking A records..."
    
    if dig +short "$api_domain" A >/dev/null 2>&1; then
        local ip
        ip=$(dig +short "$api_domain" A | head -1)
        log_success "$api_domain resolves to $ip"
    else
        log_error "$api_domain does not resolve"
        ((errors++))
    fi
    
    if dig +short "$mail_domain" A >/dev/null 2>&1; then
        local ip
        ip=$(dig +short "$mail_domain" A | head -1)
        log_success "$mail_domain resolves to $ip"
    else
        log_error "$mail_domain does not resolve"
        ((errors++))
    fi
    
    # Check MX records
    log_info "Checking MX records..."
    
    if dig +short "$email_domain" MX >/dev/null 2>&1; then
        local mx
        mx=$(dig +short "$email_domain" MX | head -1)
        log_success "$email_domain has MX record: $mx"
    else
        log_error "$email_domain has no MX record"
        ((errors++))
    fi
    
    # Check SPF records
    log_info "Checking SPF records..."
    
    if dig +short "$email_domain" TXT | grep -q "v=spf1"; then
        local spf
        spf=$(dig +short "$email_domain" TXT | grep "v=spf1" | head -1)
        log_success "$email_domain has SPF record: $spf"
    else
        log_warning "$email_domain has no SPF record"
    fi
    
    # Check DKIM records
    log_info "Checking DKIM records..."
    
    local dkim_selectors=("s1" "s2" "default" "token1")
    local dkim_found=false
    
    for selector in "${dkim_selectors[@]}"; do
        if dig +short "${selector}._domainkey.${email_domain}" CNAME >/dev/null 2>&1 || \
           dig +short "${selector}._domainkey.${email_domain}" TXT >/dev/null 2>&1; then
            log_success "$email_domain has DKIM record for selector: $selector"
            dkim_found=true
            break
        fi
    done
    
    if [[ "$dkim_found" == "false" ]]; then
        log_warning "$email_domain has no DKIM records found"
    fi
    
    # Check DMARC records
    log_info "Checking DMARC records..."
    
    if dig +short "_dmarc.${email_domain}" TXT | grep -q "v=DMARC1"; then
        local dmarc
        dmarc=$(dig +short "_dmarc.${email_domain}" TXT | grep "v=DMARC1" | head -1)
        log_success "$email_domain has DMARC record: $dmarc"
    else
        log_warning "$email_domain has no DMARC record"
    fi
    
    # Check SSL certificates
    log_info "Checking SSL certificates..."
    
    if command -v openssl >/dev/null 2>&1; then
        if echo | openssl s_client -connect "$api_domain:443" -servername "$api_domain" >/dev/null 2>&1; then
            log_success "$api_domain has valid SSL certificate"
        else
            log_warning "$api_domain SSL certificate check failed"
        fi
    else
        log_warning "openssl not available, skipping SSL check"
    fi
    
    # Summary
    echo
    if [[ $errors -eq 0 ]]; then
        log_success "DNS validation completed successfully!"
    else
        log_error "DNS validation found $errors critical errors"
        return 1
    fi
}

# Set up DNS via Cloudflare API
setup_cloudflare_dns() {
    local domain="$1"
    local server_ip="$2"
    local dry_run="$3"
    
    if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
        log_error "CLOUDFLARE_API_TOKEN environment variable not set"
        exit 1
    fi
    
    log_info "Setting up DNS records via Cloudflare API for domain: $domain"
    
    # Get zone ID
    local zone_id
    zone_id=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$domain" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" | \
        jq -r '.result[0].id')
    
    if [[ "$zone_id" == "null" || -z "$zone_id" ]]; then
        log_error "Could not find Cloudflare zone for domain: $domain"
        exit 1
    fi
    
    log_info "Found Cloudflare zone ID: $zone_id"
    
    local api_domain="${API_SUBDOMAIN}.${domain}"
    local email_domain="${EMAIL_SUBDOMAIN}.${domain}"
    local mail_domain="${MAIL_SUBDOMAIN}.${domain}"
    
    # DNS records to create
    local records=(
        "$api_domain:A:$server_ip"
        "www.$domain:CNAME:$api_domain"
        "$mail_domain:A:$server_ip"
        "$email_domain:MX:10 $mail_domain"
        "$email_domain:TXT:v=spf1 include:sendgrid.net ~all"
        "$domain:TXT:v=spf1 include:sendgrid.net ~all"
        "_dmarc.$email_domain:TXT:v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@$domain"
        "_dmarc.$domain:TXT:v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@$domain"
        "$domain:CAA:0 issue \"letsencrypt.org\""
        "$domain:CAA:0 issue \"amazon.com\""
    )
    
    for record in "${records[@]}"; do
        local name="${record%%:*}"
        local type="${record#*:}"
        type="${type%%:*}"
        local content="${record##*:}"
        
        local json_data
        if [[ "$type" == "MX" ]]; then
            local priority="${content%% *}"
            local mx_content="${content#* }"
            json_data="{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$mx_content\",\"priority\":$priority,\"ttl\":300}"
        elif [[ "$type" == "CAA" ]]; then
            local flags="${content%% *}"
            local tag_value="${content#* }"
            local tag="${tag_value%% *}"
            local value="${tag_value#* }"
            json_data="{\"type\":\"$type\",\"name\":\"$name\",\"data\":{\"flags\":$flags,\"tag\":\"$tag\",\"value\":$value},\"ttl\":300}"
        else
            json_data="{\"type\":\"$type\",\"name\":\"$name\",\"content\":\"$content\",\"ttl\":300}"
        fi
        
        if [[ "$dry_run" == "true" ]]; then
            echo "Would create DNS record: $name $type $content"
        else
            log_info "Creating DNS record: $name $type $content"
            
            local response
            response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records" \
                -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                -H "Content-Type: application/json" \
                --data "$json_data")
            
            local success
            success=$(echo "$response" | jq -r '.success')
            
            if [[ "$success" == "true" ]]; then
                log_success "Created DNS record: $name $type"
            else
                local errors
                errors=$(echo "$response" | jq -r '.errors[].message' | tr '\n' ' ')
                log_warning "Failed to create DNS record $name $type: $errors"
            fi
        fi
    done
    
    if [[ "$dry_run" != "true" ]]; then
        log_success "Cloudflare DNS setup completed!"
        echo
        log_info "Next steps:"
        echo "1. Wait for DNS propagation (5-10 minutes)"
        echo "2. Validate configuration: $0 validate --domain $domain"
        echo "3. Set up SendGrid domain authentication"
        echo "4. Configure SSL certificates"
    fi
}

# Set up DNS via AWS Route53
setup_route53_dns() {
    local domain="$1"
    local server_ip="$2"
    local dry_run="$3"
    
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI not installed"
        exit 1
    fi
    
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_info "Setting up DNS records via AWS Route53 for domain: $domain"
    
    # Get hosted zone ID
    local zone_id
    zone_id=$(aws route53 list-hosted-zones-by-name --dns-name "$domain" --query "HostedZones[?Name=='$domain.'].Id" --output text | cut -d'/' -f3)
    
    if [[ -z "$zone_id" ]]; then
        log_error "Could not find Route53 hosted zone for domain: $domain"
        exit 1
    fi
    
    log_info "Found Route53 hosted zone ID: $zone_id"
    
    local api_domain="${API_SUBDOMAIN}.${domain}"
    local email_domain="${EMAIL_SUBDOMAIN}.${domain}"
    local mail_domain="${MAIL_SUBDOMAIN}.${domain}"
    
    # Create change batch JSON
    local change_batch_file="/tmp/route53-changes.json"
    
    cat > "$change_batch_file" << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$api_domain",
                "Type": "A",
                "TTL": 300,
                "ResourceRecords": [{"Value": "$server_ip"}]
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "www.$domain",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [{"Value": "$api_domain"}]
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$mail_domain",
                "Type": "A",
                "TTL": 300,
                "ResourceRecords": [{"Value": "$server_ip"}]
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$email_domain",
                "Type": "MX",
                "TTL": 300,
                "ResourceRecords": [{"Value": "10 $mail_domain"}]
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "$email_domain",
                "Type": "TXT",
                "TTL": 300,
                "ResourceRecords": [{"Value": "\"v=spf1 include:sendgrid.net ~all\""}]
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "_dmarc.$email_domain",
                "Type": "TXT",
                "TTL": 300,
                "ResourceRecords": [{"Value": "\"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@$domain\""}]
            }
        }
    ]
}
EOF
    
    if [[ "$dry_run" == "true" ]]; then
        echo "Would create Route53 change batch:"
        cat "$change_batch_file"
    else
        log_info "Creating Route53 DNS records..."
        
        local change_id
        change_id=$(aws route53 change-resource-record-sets \
            --hosted-zone-id "$zone_id" \
            --change-batch "file://$change_batch_file" \
            --query 'ChangeInfo.Id' \
            --output text)
        
        log_success "Route53 change submitted: $change_id"
        
        log_info "Waiting for change to propagate..."
        aws route53 wait resource-record-sets-changed --id "$change_id"
        
        log_success "Route53 DNS setup completed!"
    fi
    
    # Clean up
    rm -f "$change_batch_file"
    
    if [[ "$dry_run" != "true" ]]; then
        echo
        log_info "Next steps:"
        echo "1. Validate configuration: $0 validate --domain $domain"
        echo "2. Set up email provider domain authentication"
        echo "3. Configure SSL certificates"
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
            --server-ip)
                SERVER_IP="$2"
                shift 2
                ;;
            --email-provider)
                EMAIL_PROVIDER="$2"
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
    
    case "$command" in
        generate)
            if [[ -z "$SERVER_IP" ]]; then
                log_error "Server IP is required for generate command"
                echo "Use: $0 generate --domain $DOMAIN --server-ip 1.2.3.4"
                exit 1
            fi
            generate_dns_records "$DOMAIN" "$SERVER_IP" "$EMAIL_PROVIDER"
            ;;
        validate)
            validate_dns "$DOMAIN"
            ;;
        cloudflare)
            if [[ -z "$SERVER_IP" ]]; then
                log_error "Server IP is required for cloudflare command"
                exit 1
            fi
            setup_cloudflare_dns "$DOMAIN" "$SERVER_IP" "$dry_run"
            ;;
        route53)
            if [[ -z "$SERVER_IP" ]]; then
                log_error "Server IP is required for route53 command"
                exit 1
            fi
            setup_route53_dns "$DOMAIN" "$SERVER_IP" "$dry_run"
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

# Check dependencies
if ! command -v dig >/dev/null 2>&1; then
    log_error "dig command not found. Please install dnsutils (Ubuntu/Debian) or bind-utils (CentOS/RHEL)"
    exit 1
fi

# Run main function
main "$@"