# Faxi Core System - Production Setup Guide

This guide provides step-by-step instructions for configuring external service integrations for production deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Telnyx Configuration](#telnyx-configuration)
3. [Google Gemini API Setup](#google-gemini-api-setup)
4. [Stripe Configuration](#stripe-configuration)
5. [Email Service Provider Setup](#email-service-provider-setup)
6. [AWS S3 Configuration](#aws-s3-configuration)
7. [Domain and DNS Configuration](#domain-and-dns-configuration)
8. [SSL Certificate Setup](#ssl-certificate-setup)
9. [Environment Variables](#environment-variables)
10. [Verification and Testing](#verification-and-testing)

## Prerequisites

Before starting, ensure you have:
- Domain name registered (e.g., faxi.jp)
- AWS account with appropriate permissions
- Access to domain DNS management
- Production-ready server or cloud infrastructure

## Telnyx Configuration

### 1. Create Telnyx Account

1. Sign up at [telnyx.com](https://telnyx.com)
2. Complete account verification and billing setup
3. Navigate to the API Keys section

### 2. Generate API Keys

```bash
# In Telnyx Portal:
# 1. Go to Auth > API Keys
# 2. Create new API key with "Full Access" permissions
# 3. Save the API key securely
```

### 3. Configure Fax Application

1. Go to **Numbers > Fax Applications**
2. Create new Fax Application:
   - **Name**: Faxi Production
   - **Webhook URL**: `https://api.faxi.jp/webhooks/telnyx/fax/received`
   - **Webhook Failover URL**: `https://api-backup.faxi.jp/webhooks/telnyx/fax/received` (optional)
   - **HTTP Request Method**: POST
   - **Connection Timeout**: 5 seconds
   - **Response Timeout**: 10 seconds

### 4. Purchase and Configure Fax Number

1. Go to **Numbers > Search & Buy Numbers**
2. Search for available fax numbers in your desired area
3. Purchase the number
4. Assign the number to your Fax Application

### 5. Configure Webhook Security

1. Go to **Auth > Public Keys**
2. Copy the public key for webhook signature verification
3. Save both API key and public key for environment configuration

**Environment Variables:**
```bash
TELNYX_API_KEY=KEY_your_production_api_key_here
TELNYX_PUBLIC_KEY=your_public_key_for_webhook_verification
TELNYX_FAX_NUMBER=+1234567890  # Your purchased fax number
```

## Google Gemini API Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing one
3. Enable billing for the project

### 2. Enable Gemini API

1. Navigate to **APIs & Services > Library**
2. Search for "Generative Language API"
3. Click "Enable"

### 3. Create API Key

1. Go to **APIs & Services > Credentials**
2. Click "Create Credentials" > "API Key"
3. Restrict the API key:
   - **Application restrictions**: HTTP referrers or IP addresses
   - **API restrictions**: Generative Language API only
4. Save the API key securely

### 4. Configure Usage Limits

1. Go to **APIs & Services > Quotas**
2. Set appropriate quotas for production usage
3. Configure billing alerts

**Environment Variables:**
```bash
GEMINI_API_KEY=AIzaSy_your_production_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

## Stripe Configuration

### 1. Create Stripe Account

1. Sign up at [stripe.com](https://stripe.com)
2. Complete business verification
3. Activate your account for live payments

### 2. Get API Keys

1. Go to **Developers > API Keys**
2. Copy the **Publishable key** and **Secret key** from the "Standard keys" section
3. Keep test keys for development/staging environments

### 3. Configure Webhooks

1. Go to **Developers > Webhooks**
2. Add endpoint: `https://api.faxi.jp/webhooks/stripe`
3. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `customer.subscription.updated`
4. Copy the webhook signing secret

### 4. Configure Products and Pricing

1. Go to **Products** and create products for convenience store payments
2. Set up pricing tiers if needed
3. Configure tax settings for your jurisdiction

**Environment Variables:**
```bash
STRIPE_SECRET_KEY=sk_live_your_production_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here
```

## Email Service Provider Setup

### Option 1: SendGrid (Recommended)

#### 1. Create SendGrid Account

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Complete sender verification
3. Set up domain authentication

#### 2. Domain Authentication

1. Go to **Settings > Sender Authentication**
2. Click "Authenticate Your Domain"
3. Add the provided DNS records to your domain:
   ```
   Type: CNAME
   Host: s1._domainkey.faxi.jp
   Value: s1.domainkey.u1234567.wl123.sendgrid.net
   
   Type: CNAME
   Host: s2._domainkey.faxi.jp
   Value: s2.domainkey.u1234567.wl123.sendgrid.net
   ```

#### 3. Create API Key

1. Go to **Settings > API Keys**
2. Create new API key with "Full Access" or "Mail Send" permissions
3. Save the API key securely

#### 4. Configure Inbound Parse

1. Go to **Settings > Inbound Parse**
2. Add hostname: `me.faxi.jp`
3. Set destination URL: `https://api.faxi.jp/webhooks/email/received`
4. Check "POST the raw, full MIME message"

**Environment Variables:**
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_production_api_key_here
EMAIL_FROM_DOMAIN=me.faxi.jp
EMAIL_WEBHOOK_SECRET=your_webhook_secret_here
```

### Option 2: AWS SES

#### 1. Set up AWS SES

1. Go to AWS SES Console
2. Verify your domain `faxi.jp`
3. Add required DNS records for domain verification
4. Request production access (remove sandbox limitations)

#### 2. Configure SMTP Credentials

1. Go to **SMTP Settings**
2. Create SMTP credentials
3. Note the SMTP endpoint for your region

#### 3. Set up Configuration Set

1. Create configuration set for tracking
2. Add event destinations for bounces/complaints

**Environment Variables:**
```bash
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIA_your_access_key_here
AWS_SES_SECRET_ACCESS_KEY=your_secret_access_key_here
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
```

## AWS S3 Configuration

### 1. Create S3 Bucket

```bash
# Create bucket with versioning and encryption
aws s3 mb s3://faxi-production-fax-images-$(aws sts get-caller-identity --query Account --output text)

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket faxi-production-fax-images-$(aws sts get-caller-identity --query Account --output text) \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket faxi-production-fax-images-$(aws sts get-caller-identity --query Account --output text) \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 2. Configure Lifecycle Policy

```bash
# Create lifecycle policy to delete old fax images
aws s3api put-bucket-lifecycle-configuration \
  --bucket faxi-production-fax-images-$(aws sts get-caller-identity --query Account --output text) \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "DeleteOldFaxes",
      "Status": "Enabled",
      "Expiration": {
        "Days": 90
      }
    }]
  }'
```

### 3. Create IAM User and Policy

```bash
# Create IAM user for S3 access
aws iam create-user --user-name faxi-s3-user

# Create and attach policy
aws iam put-user-policy --user-name faxi-s3-user --policy-name FaxiS3Access --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::faxi-production-fax-images-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::faxi-production-fax-images-*"
    }
  ]
}'

# Create access keys
aws iam create-access-key --user-name faxi-s3-user
```

**Environment Variables:**
```bash
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=faxi-production-fax-images-123456789012
S3_ACCESS_KEY_ID=AKIA_your_access_key_here
S3_SECRET_ACCESS_KEY=your_secret_access_key_here
```

## Domain and DNS Configuration

### 1. Main Application Domain

Set up DNS records for your main application:

```dns
# A record for API
api.faxi.jp.    300    IN    A    1.2.3.4

# CNAME for www (optional)
www.faxi.jp.    300    IN    CNAME    api.faxi.jp.

# CNAME for backup (optional)
api-backup.faxi.jp.    300    IN    CNAME    api.faxi.jp.
```

### 2. Email-to-Fax Domain (me.faxi.jp)

Configure MX records for email-to-fax functionality:

```dns
# MX record pointing to your email service
me.faxi.jp.    300    IN    MX    10    api.faxi.jp.

# A record for the mail server
mail.faxi.jp.    300    IN    A    1.2.3.4

# SPF record for email authentication
me.faxi.jp.    300    IN    TXT    "v=spf1 include:sendgrid.net ~all"

# DKIM records (from SendGrid)
s1._domainkey.me.faxi.jp.    300    IN    CNAME    s1.domainkey.u1234567.wl123.sendgrid.net.
s2._domainkey.me.faxi.jp.    300    IN    CNAME    s2.domainkey.u1234567.wl123.sendgrid.net.

# DMARC policy
_dmarc.me.faxi.jp.    300    IN    TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@faxi.jp"
```

### 3. Verification

```bash
# Test DNS resolution
dig api.faxi.jp A
dig me.faxi.jp MX
dig s1._domainkey.me.faxi.jp CNAME

# Test email routing
echo "Test email" | mail -s "Test" test@me.faxi.jp
```

## SSL Certificate Setup

### Option 1: AWS Certificate Manager (for AWS deployment)

```bash
# Request certificate
aws acm request-certificate \
  --domain-name api.faxi.jp \
  --subject-alternative-names me.faxi.jp mail.faxi.jp \
  --validation-method DNS \
  --region us-east-1

# Add DNS validation records as provided by ACM
# Wait for validation to complete
```

### Option 2: Let's Encrypt (for self-hosted)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Request certificate
sudo certbot certonly --standalone \
  -d api.faxi.jp \
  -d me.faxi.jp \
  -d mail.faxi.jp \
  --email admin@faxi.jp \
  --agree-tos \
  --non-interactive

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Environment Variables

Create your production environment file:

```bash
# Copy template
cp .env.production.example .env.production

# Edit with actual values
vim .env.production
```

**Complete production configuration:**

```bash
# Database Configuration
DATABASE_HOST=your-rds-endpoint.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=faxi
DATABASE_USER=faxi_user
DATABASE_PASSWORD=your_secure_database_password
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis Configuration
REDIS_HOST=your-redis-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# S3 Configuration
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=faxi-production-fax-images-123456789012
S3_ACCESS_KEY_ID=AKIA_your_access_key_here
S3_SECRET_ACCESS_KEY=your_secret_access_key_here

# Application Configuration
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
TEST_MODE=false

# Telnyx Configuration
TELNYX_API_KEY=KEY_your_production_api_key_here
TELNYX_PUBLIC_KEY=your_public_key_for_webhook_verification
TELNYX_FAX_NUMBER=+1234567890
TELNYX_WEBHOOK_TIMEOUT=5

# Google Gemini Configuration
GEMINI_API_KEY=AIzaSy_your_production_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Email Configuration
EMAIL_PROVIDER=sendgrid
EMAIL_WEBHOOK_SECRET=your_webhook_secret_here
EMAIL_FROM_DOMAIN=me.faxi.jp
SENDGRID_API_KEY=SG.your_production_api_key_here

# SMTP Configuration
SMTP_HOST=mail.faxi.jp
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=contact@faxi.jp
SMTP_PASS=your_smtp_password

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_production_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here

# Base URL for webhooks and redirects
BASE_URL=https://api.faxi.jp

# PostgreSQL password for docker-compose
POSTGRES_PASSWORD=your_secure_database_password
```

## Verification and Testing

### 1. Test External Service Connections

```bash
# Test Telnyx API
curl -X GET "https://api.telnyx.com/v2/fax_applications" \
  -H "Authorization: Bearer $TELNYX_API_KEY"

# Test Gemini API
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'

# Test Stripe API
curl -X GET "https://api.stripe.com/v1/account" \
  -H "Authorization: Bearer $STRIPE_SECRET_KEY"

# Test SendGrid API
curl -X GET "https://api.sendgrid.com/v3/user/account" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"

# Test S3 access
aws s3 ls s3://$S3_BUCKET --profile production
```

### 2. Test Webhook Endpoints

```bash
# Test Telnyx webhook (should return 200)
curl -X POST "https://api.faxi.jp/webhooks/telnyx/fax/received" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test email webhook (should return 200)
curl -X POST "https://api.faxi.jp/webhooks/email/received" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test Stripe webhook (should return 200)
curl -X POST "https://api.faxi.jp/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 3. Test Email Routing

```bash
# Send test email to email-to-fax address
echo "Test message for fax conversion" | mail -s "Test Fax" test@me.faxi.jp

# Check application logs for processing
docker logs faxi-app | grep "email received"
```

### 4. Health Check

```bash
# Application health check
curl https://api.faxi.jp/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-18T14:30:00.000Z",
#   "services": {
#     "database": "connected",
#     "redis": "connected",
#     "s3": "accessible",
#     "telnyx": "configured",
#     "gemini": "configured",
#     "stripe": "configured",
#     "email": "configured"
#   }
# }
```

## Security Checklist

- [ ] All API keys are production keys (not test keys)
- [ ] Webhook endpoints use HTTPS with valid SSL certificates
- [ ] Database passwords are strong and unique
- [ ] S3 bucket has proper access controls and encryption
- [ ] Email domain has SPF, DKIM, and DMARC records configured
- [ ] All secrets are stored securely (not in code or logs)
- [ ] Firewall rules restrict access to necessary ports only
- [ ] Regular security updates are scheduled
- [ ] Monitoring and alerting are configured
- [ ] Backup procedures are tested and documented

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Verify Telnyx public key is correct
   - Check system clock synchronization
   - Ensure webhook URL is accessible from internet

2. **Email delivery fails**
   - Verify DNS records are propagated
   - Check SPF/DKIM/DMARC configuration
   - Confirm email service provider settings

3. **S3 access denied**
   - Verify IAM user permissions
   - Check bucket policy and ACLs
   - Confirm region settings match

4. **API rate limits exceeded**
   - Implement exponential backoff
   - Monitor usage quotas
   - Consider upgrading service plans

### Support Contacts

- **Telnyx Support**: support@telnyx.com
- **Google Cloud Support**: Via Google Cloud Console
- **Stripe Support**: support@stripe.com
- **SendGrid Support**: support@sendgrid.com
- **AWS Support**: Via AWS Console

## Next Steps

After completing this setup:

1. Deploy the application using your chosen deployment method
2. Configure monitoring and alerting
3. Set up backup procedures
4. Perform end-to-end testing
5. Create operational runbooks
6. Train support staff on troubleshooting procedures

For deployment instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md).