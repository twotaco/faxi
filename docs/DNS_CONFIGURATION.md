# Faxi Core System - DNS Configuration Guide

This guide provides detailed instructions for configuring DNS records for the Faxi Core System production deployment.

## Table of Contents

1. [Overview](#overview)
2. [Required DNS Records](#required-dns-records)
3. [Domain Setup](#domain-setup)
4. [Email Authentication](#email-authentication)
5. [SSL Certificate Validation](#ssl-certificate-validation)
6. [Verification and Testing](#verification-and-testing)
7. [Troubleshooting](#troubleshooting)

## Overview

The Faxi Core System requires several DNS records to function properly:

- **api.faxi.jp**: Main application API endpoint
- **me.faxi.jp**: Email-to-fax domain for receiving emails
- **mail.faxi.jp**: SMTP server for sending emails
- Various authentication records (SPF, DKIM, DMARC)

## Required DNS Records

### 1. Main Application Records

```dns
# Main API endpoint
api.faxi.jp.        300    IN    A        1.2.3.4

# Optional: WWW redirect
www.faxi.jp.        300    IN    CNAME    api.faxi.jp.

# Optional: Backup endpoint
api-backup.faxi.jp. 300    IN    A        5.6.7.8
```

### 2. Email-to-Fax Records

```dns
# MX record for email-to-fax functionality
me.faxi.jp.         300    IN    MX       10    mail.faxi.jp.

# Mail server A record
mail.faxi.jp.       300    IN    A        1.2.3.4

# Optional: Backup MX record
me.faxi.jp.         300    IN    MX       20    backup-mail.faxi.jp.
```

### 3. Email Authentication Records

#### SPF (Sender Policy Framework)
```dns
# SPF record for me.faxi.jp (using SendGrid)
me.faxi.jp.         300    IN    TXT      "v=spf1 include:sendgrid.net ~all"

# SPF record for main domain
faxi.jp.            300    IN    TXT      "v=spf1 include:sendgrid.net ~all"
```

#### DKIM (DomainKeys Identified Mail)
```dns
# DKIM records (values provided by SendGrid)
s1._domainkey.me.faxi.jp.    300    IN    CNAME    s1.domainkey.u1234567.wl123.sendgrid.net.
s2._domainkey.me.faxi.jp.    300    IN    CNAME    s2.domainkey.u1234567.wl123.sendgrid.net.

# DKIM for main domain
s1._domainkey.faxi.jp.       300    IN    CNAME    s1.domainkey.u1234567.wl123.sendgrid.net.
s2._domainkey.faxi.jp.       300    IN    CNAME    s2.domainkey.u1234567.wl123.sendgrid.net.
```

#### DMARC (Domain-based Message Authentication)
```dns
# DMARC policy for me.faxi.jp
_dmarc.me.faxi.jp.  300    IN    TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@faxi.jp; ruf=mailto:dmarc-failures@faxi.jp; fo=1"

# DMARC policy for main domain
_dmarc.faxi.jp.     300    IN    TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@faxi.jp; ruf=mailto:dmarc-failures@faxi.jp; fo=1"
```

### 4. SSL Certificate Validation Records

#### For Let's Encrypt (ACME Challenge)
```dns
# ACME challenge records (temporary, created automatically by certbot)
_acme-challenge.api.faxi.jp.     300    IN    TXT    "challenge-token-here"
_acme-challenge.me.faxi.jp.      300    IN    TXT    "challenge-token-here"
_acme-challenge.mail.faxi.jp.    300    IN    TXT    "challenge-token-here"
```

#### For AWS Certificate Manager
```dns
# DNS validation records (provided by ACM)
_validation.api.faxi.jp.     300    IN    CNAME    _validation.acm-validations.aws.
_validation.me.faxi.jp.      300    IN    CNAME    _validation.acm-validations.aws.
_validation.mail.faxi.jp.    300    IN    CNAME    _validation.acm-validations.aws.
```

### 5. Additional Security Records

#### CAA (Certificate Authority Authorization)
```dns
# Restrict certificate issuance to specific CAs
faxi.jp.            300    IN    CAA      0 issue "letsencrypt.org"
faxi.jp.            300    IN    CAA      0 issue "amazon.com"
faxi.jp.            300    IN    CAA      0 iodef "mailto:security@faxi.jp"
```

## Domain Setup

### Step 1: Configure Main Application Domain

1. **Point your domain to your server:**
   ```bash
   # For AWS ALB
   api.faxi.jp.    300    IN    CNAME    your-alb-123456789.us-east-1.elb.amazonaws.com.
   
   # For direct IP
   api.faxi.jp.    300    IN    A        1.2.3.4
   ```

2. **Test DNS resolution:**
   ```bash
   dig api.faxi.jp A
   nslookup api.faxi.jp
   ```

### Step 2: Configure Email Domain

1. **Set up MX records:**
   ```bash
   # Primary MX record
   me.faxi.jp.     300    IN    MX       10    mail.faxi.jp.
   
   # Mail server A record
   mail.faxi.jp.   300    IN    A        1.2.3.4
   ```

2. **Test MX records:**
   ```bash
   dig me.faxi.jp MX
   nslookup -type=MX me.faxi.jp
   ```

### Step 3: Configure Subdomains

```bash
# Additional subdomains as needed
admin.faxi.jp.      300    IN    CNAME    api.faxi.jp.
status.faxi.jp.     300    IN    CNAME    api.faxi.jp.
docs.faxi.jp.       300    IN    CNAME    api.faxi.jp.
```

## Email Authentication

### SendGrid Configuration

1. **Domain Authentication in SendGrid:**
   - Go to SendGrid Console → Settings → Sender Authentication
   - Click "Authenticate Your Domain"
   - Enter your domain: `me.faxi.jp`
   - Add the provided DNS records

2. **Example SendGrid DNS Records:**
   ```dns
   # CNAME records provided by SendGrid
   em1234.me.faxi.jp.               300    IN    CNAME    u1234567.wl123.sendgrid.net.
   s1._domainkey.me.faxi.jp.        300    IN    CNAME    s1.domainkey.u1234567.wl123.sendgrid.net.
   s2._domainkey.me.faxi.jp.        300    IN    CNAME    s2.domainkey.u1234567.wl123.sendgrid.net.
   
   # MX record for inbound parsing
   me.faxi.jp.                      300    IN    MX       10    mx.sendgrid.net.
   ```

### AWS SES Configuration

1. **Domain Verification:**
   ```bash
   # Add TXT record for domain verification
   _amazonses.me.faxi.jp.    300    IN    TXT    "verification-token-from-ses"
   ```

2. **DKIM Configuration:**
   ```bash
   # DKIM CNAME records (provided by SES)
   token1._domainkey.me.faxi.jp.    300    IN    CNAME    token1.dkim.amazonses.com.
   token2._domainkey.me.faxi.jp.    300    IN    CNAME    token2.dkim.amazonses.com.
   token3._domainkey.me.faxi.jp.    300    IN    CNAME    token3.dkim.amazonses.com.
   ```

### Self-Hosted Email Configuration

1. **MX Records:**
   ```dns
   me.faxi.jp.     300    IN    MX       10    mail.faxi.jp.
   mail.faxi.jp.   300    IN    A        1.2.3.4
   ```

2. **SPF Record:**
   ```dns
   me.faxi.jp.     300    IN    TXT      "v=spf1 a mx ip4:1.2.3.4 ~all"
   ```

3. **DKIM Setup:**
   ```bash
   # Generate DKIM keys
   opendkim-genkey -t -s default -d me.faxi.jp
   
   # Add public key to DNS
   default._domainkey.me.faxi.jp.   300    IN    TXT    "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."
   ```

## SSL Certificate Validation

### Let's Encrypt with Certbot

1. **Request certificate:**
   ```bash
   sudo certbot certonly --standalone \
     -d api.faxi.jp \
     -d me.faxi.jp \
     -d mail.faxi.jp \
     --email admin@faxi.jp \
     --agree-tos \
     --non-interactive
   ```

2. **DNS challenge (if HTTP challenge fails):**
   ```bash
   sudo certbot certonly --manual \
     --preferred-challenges dns \
     -d api.faxi.jp \
     -d me.faxi.jp \
     -d mail.faxi.jp
   ```

### AWS Certificate Manager

1. **Request certificate:**
   ```bash
   aws acm request-certificate \
     --domain-name api.faxi.jp \
     --subject-alternative-names me.faxi.jp mail.faxi.jp \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Add validation records:**
   ```bash
   # Get validation records
   aws acm describe-certificate --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
   
   # Add the provided CNAME records to your DNS
   ```

## Verification and Testing

### DNS Propagation Check

```bash
# Check DNS propagation globally
dig @8.8.8.8 api.faxi.jp A
dig @1.1.1.1 api.faxi.jp A
dig @208.67.222.222 api.faxi.jp A

# Check from multiple locations
nslookup api.faxi.jp 8.8.8.8
nslookup api.faxi.jp 1.1.1.1
```

### Email Authentication Test

```bash
# Test SPF record
dig me.faxi.jp TXT | grep spf

# Test DKIM records
dig s1._domainkey.me.faxi.jp CNAME
dig s2._domainkey.me.faxi.jp CNAME

# Test DMARC record
dig _dmarc.me.faxi.jp TXT
```

### MX Record Test

```bash
# Test MX records
dig me.faxi.jp MX

# Test mail server connectivity
telnet mail.faxi.jp 25
```

### SSL Certificate Test

```bash
# Test SSL certificate
openssl s_client -connect api.faxi.jp:443 -servername api.faxi.jp

# Check certificate details
echo | openssl s_client -connect api.faxi.jp:443 -servername api.faxi.jp 2>/dev/null | openssl x509 -noout -dates
```

### Complete System Test

```bash
# Test application health
curl -I https://api.faxi.jp/health

# Test webhook endpoints
curl -X POST https://api.faxi.jp/webhooks/telnyx/fax/received \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test email routing
echo "Test message" | mail -s "Test" test@me.faxi.jp
```

## Troubleshooting

### Common DNS Issues

1. **DNS not propagating:**
   ```bash
   # Check TTL values (should be low during setup)
   dig api.faxi.jp A | grep "IN"
   
   # Force DNS refresh
   sudo systemctl flush-dns  # Linux
   sudo dscacheutil -flushcache  # macOS
   ```

2. **MX record issues:**
   ```bash
   # Verify MX record syntax
   dig me.faxi.jp MX
   
   # Test mail server
   telnet mail.faxi.jp 25
   ```

3. **SSL certificate issues:**
   ```bash
   # Check certificate chain
   openssl s_client -connect api.faxi.jp:443 -showcerts
   
   # Verify certificate matches domain
   echo | openssl s_client -connect api.faxi.jp:443 2>/dev/null | openssl x509 -noout -subject
   ```

### Email Authentication Issues

1. **SPF failures:**
   ```bash
   # Test SPF record
   dig me.faxi.jp TXT | grep "v=spf1"
   
   # Validate SPF syntax
   # Use online SPF checker tools
   ```

2. **DKIM failures:**
   ```bash
   # Check DKIM records
   dig s1._domainkey.me.faxi.jp CNAME
   
   # Verify DKIM key format
   dig default._domainkey.me.faxi.jp TXT
   ```

3. **DMARC issues:**
   ```bash
   # Check DMARC record
   dig _dmarc.me.faxi.jp TXT
   
   # Validate DMARC syntax
   # Use online DMARC checker tools
   ```

### Performance Issues

1. **Slow DNS resolution:**
   ```bash
   # Test DNS response times
   time dig api.faxi.jp A
   
   # Use faster DNS servers
   # Configure 1.1.1.1, 8.8.8.8 as DNS servers
   ```

2. **High TTL values:**
   ```bash
   # Check current TTL
   dig api.faxi.jp A | grep "IN"
   
   # Reduce TTL for faster updates (300 seconds recommended)
   ```

## DNS Configuration Checklist

- [ ] Main application domain (api.faxi.jp) resolves to correct IP
- [ ] Email domain (me.faxi.jp) has correct MX records
- [ ] Mail server (mail.faxi.jp) resolves to correct IP
- [ ] SPF records are configured for all sending domains
- [ ] DKIM records are configured and verified
- [ ] DMARC policy is configured
- [ ] SSL certificates are valid for all domains
- [ ] DNS propagation is complete (check multiple DNS servers)
- [ ] Email routing is working (test with actual email)
- [ ] Webhook endpoints are accessible via HTTPS
- [ ] All subdomains resolve correctly
- [ ] CAA records restrict certificate issuance (optional but recommended)

## Maintenance

### Regular Tasks

1. **Monitor DNS health:**
   ```bash
   # Weekly DNS health check
   ./scripts/validate-production-config.sh
   ```

2. **Certificate renewal:**
   ```bash
   # Let's Encrypt auto-renewal (cron job)
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

3. **DNS record updates:**
   - Keep TTL values reasonable (300-3600 seconds)
   - Update IP addresses when infrastructure changes
   - Monitor email authentication reports

### Emergency Procedures

1. **DNS failover:**
   ```bash
   # Update A records to backup server
   api.faxi.jp.    60    IN    A    backup.server.ip
   ```

2. **Email routing issues:**
   ```bash
   # Add backup MX record
   me.faxi.jp.     300    IN    MX    20    backup-mail.faxi.jp.
   ```

3. **SSL certificate issues:**
   ```bash
   # Emergency certificate renewal
   sudo certbot renew --force-renewal
   ```

For additional support, consult your DNS provider's documentation or contact their support team.