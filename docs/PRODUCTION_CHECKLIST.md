# Faxi Core System - Production Deployment Checklist

This checklist ensures all components are properly configured before deploying to production.

## Pre-Deployment Checklist

### 1. External Service Configuration ✅

#### Telnyx Setup
- [ ] Telnyx account created and verified
- [ ] Production API key obtained (starts with `KEY_`)
- [ ] Public key for webhook verification obtained
- [ ] Fax number purchased and assigned
- [ ] Fax application configured with webhook URL
- [ ] Webhook URL: `https://api.faxi.jp/webhooks/telnyx/fax/received`
- [ ] Test fax sent and received successfully

#### Google Gemini API Setup
- [ ] Google Cloud project created
- [ ] Generative Language API enabled
- [ ] Production API key created and restricted
- [ ] Usage quotas configured for production load
- [ ] Billing alerts configured
- [ ] Test API call successful

#### Stripe Configuration
- [ ] Stripe account activated for live payments
- [ ] Live API keys obtained (start with `sk_live_` and `pk_live_`)
- [ ] Webhook endpoint configured: `https://api.faxi.jp/webhooks/stripe`
- [ ] Webhook events selected: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Webhook signing secret obtained
- [ ] Test payment processed successfully

#### Email Service Provider Setup
- [ ] Email service provider account created (SendGrid/AWS SES)
- [ ] Domain authentication completed
- [ ] API keys obtained
- [ ] Inbound email parsing configured for `me.faxi.jp`
- [ ] Test email sent and received successfully

#### AWS S3 Configuration
- [ ] S3 bucket created with encryption enabled
- [ ] Lifecycle policy configured (90-day retention)
- [ ] IAM user created with minimal permissions
- [ ] Access keys generated and tested
- [ ] Test file upload/download successful

### 2. Domain and DNS Configuration ✅

#### Domain Setup
- [ ] Domain registered and accessible
- [ ] DNS provider configured
- [ ] A record: `api.faxi.jp` → Server IP
- [ ] A record: `mail.faxi.jp` → Server IP
- [ ] MX record: `me.faxi.jp` → `mail.faxi.jp`
- [ ] CNAME record: `www.faxi.jp` → `api.faxi.jp` (optional)

#### Email Authentication
- [ ] SPF record configured: `"v=spf1 include:sendgrid.net ~all"`
- [ ] DKIM records configured (from email provider)
- [ ] DMARC policy configured: `"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@faxi.jp"`
- [ ] Email authentication tests passed

#### SSL Certificates
- [ ] SSL certificates obtained (Let's Encrypt or ACM)
- [ ] Certificates valid for all domains (api, me, mail)
- [ ] Auto-renewal configured
- [ ] HTTPS redirects working
- [ ] SSL test passed (A+ rating recommended)

### 3. Infrastructure Setup

#### Server/Container Configuration
- [ ] Production server provisioned
- [ ] Docker and Docker Compose installed (if using Docker)
- [ ] Kubernetes cluster ready (if using K8s)
- [ ] AWS ECS cluster configured (if using ECS)
- [ ] Load balancer configured with SSL termination
- [ ] Health checks configured

#### Database Setup
- [ ] PostgreSQL database provisioned
- [ ] Database user created with appropriate permissions
- [ ] Connection pooling configured
- [ ] Backup strategy implemented
- [ ] Database migrations tested

#### Redis Setup
- [ ] Redis instance provisioned
- [ ] Redis password configured
- [ ] Persistence enabled
- [ ] Memory limits configured
- [ ] Connection tested

#### Reverse Proxy/Load Balancer
- [ ] Nginx/ALB configured with SSL termination
- [ ] Rate limiting configured
- [ ] Security headers configured
- [ ] Gzip compression enabled
- [ ] Log rotation configured

### 4. Application Configuration

#### Environment Variables
- [ ] Production environment file created (`.env.production`)
- [ ] All `CHANGE_ME_*` placeholders replaced with actual values
- [ ] `NODE_ENV=production`
- [ ] `TEST_MODE=false`
- [ ] `BASE_URL=https://api.faxi.jp`
- [ ] All API keys are production keys (not test keys)
- [ ] Database connection string configured
- [ ] Redis connection configured

#### Secrets Management
- [ ] Secrets stored securely (not in code)
- [ ] AWS Secrets Manager configured (if using AWS)
- [ ] Kubernetes secrets configured (if using K8s)
- [ ] Docker secrets configured (if using Docker Swarm)
- [ ] File permissions secured (600 for secret files)

#### Application Build
- [ ] Production Docker image built
- [ ] Image pushed to container registry
- [ ] Image scanned for vulnerabilities
- [ ] Dependencies updated to latest stable versions
- [ ] Build artifacts tested

### 5. Security Configuration

#### Network Security
- [ ] Firewall rules configured (only necessary ports open)
- [ ] Security groups configured (AWS)
- [ ] Network policies configured (Kubernetes)
- [ ] VPC configuration secured (if applicable)
- [ ] SSH access restricted to authorized IPs

#### Application Security
- [ ] Security headers configured in reverse proxy
- [ ] Rate limiting configured for all endpoints
- [ ] Input validation enabled
- [ ] CORS configured appropriately
- [ ] Webhook signature verification enabled
- [ ] Error messages don't expose sensitive information

#### Access Control
- [ ] Admin access restricted
- [ ] Service accounts have minimal permissions
- [ ] API keys have appropriate scopes
- [ ] Database access restricted
- [ ] Log access controlled

### 6. Monitoring and Logging

#### Application Monitoring
- [ ] Health check endpoint configured (`/health`)
- [ ] Application metrics collection configured
- [ ] Error tracking configured (Sentry/similar)
- [ ] Performance monitoring configured
- [ ] Uptime monitoring configured

#### Infrastructure Monitoring
- [ ] Server/container metrics collected
- [ ] Database performance monitored
- [ ] Redis performance monitored
- [ ] Disk space monitoring configured
- [ ] Memory usage monitoring configured

#### Logging
- [ ] Structured logging configured (JSON format)
- [ ] Log levels configured appropriately
- [ ] Log rotation configured
- [ ] Centralized log collection configured
- [ ] Log retention policy configured

#### Alerting
- [ ] Critical error alerts configured
- [ ] Performance degradation alerts configured
- [ ] Resource usage alerts configured
- [ ] SSL certificate expiration alerts configured
- [ ] Alert notification channels configured

### 7. Backup and Recovery

#### Database Backups
- [ ] Automated database backups configured
- [ ] Backup retention policy configured
- [ ] Backup restoration tested
- [ ] Point-in-time recovery available
- [ ] Cross-region backup replication (if required)

#### Application Data Backups
- [ ] S3 bucket backup configured
- [ ] Configuration backups automated
- [ ] Secrets backup strategy implemented
- [ ] Recovery procedures documented
- [ ] Disaster recovery plan created

#### Testing Recovery
- [ ] Database restore tested
- [ ] Application restore tested
- [ ] Recovery time objectives (RTO) measured
- [ ] Recovery point objectives (RPO) verified
- [ ] Failover procedures tested

## Deployment Validation

### 1. Configuration Validation
```bash
# Run configuration validator
./scripts/validate-production-config.sh

# Expected: All checks pass
```

### 2. DNS Validation
```bash
# Validate DNS configuration
./scripts/setup-dns.sh validate --domain faxi.jp

# Expected: All DNS records resolve correctly
```

### 3. SSL Validation
```bash
# Validate SSL certificates
./scripts/setup-ssl.sh validate --domain faxi.jp

# Expected: All certificates valid and properly configured
```

### 4. Application Health Check
```bash
# Test application health
curl -f https://api.faxi.jp/health

# Expected: HTTP 200 with healthy status
```

### 5. Webhook Endpoint Tests
```bash
# Test Telnyx webhook
curl -X POST https://api.faxi.jp/webhooks/telnyx/fax/received \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test email webhook
curl -X POST https://api.faxi.jp/webhooks/email/received \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Test Stripe webhook
curl -X POST https://api.faxi.jp/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Expected: All return HTTP 200
```

### 6. End-to-End Testing
```bash
# Send test email to email-to-fax address
echo "Test message for production validation" | mail -s "Production Test" test@me.faxi.jp

# Expected: Email processed and converted to fax
```

## Post-Deployment Checklist

### 1. Immediate Verification (0-1 hour)
- [ ] Application starts successfully
- [ ] Health checks pass
- [ ] Database connections established
- [ ] Redis connections established
- [ ] All webhook endpoints responding
- [ ] SSL certificates working
- [ ] DNS resolution working
- [ ] Email routing working

### 2. Short-term Monitoring (1-24 hours)
- [ ] No critical errors in logs
- [ ] Performance metrics within acceptable ranges
- [ ] Memory usage stable
- [ ] CPU usage reasonable
- [ ] Disk space sufficient
- [ ] Network connectivity stable
- [ ] External API calls successful

### 3. Functional Testing (24-48 hours)
- [ ] Test fax processing end-to-end
- [ ] Test email-to-fax conversion
- [ ] Test AI vision interpretation
- [ ] Test shopping workflow
- [ ] Test payment processing
- [ ] Test error handling
- [ ] Test rate limiting

### 4. Performance Validation (48-72 hours)
- [ ] Response times acceptable
- [ ] Throughput meets requirements
- [ ] Queue processing efficient
- [ ] Database performance good
- [ ] Memory leaks absent
- [ ] Error rates low

## Rollback Plan

### Preparation
- [ ] Previous version image tagged and available
- [ ] Database migration rollback scripts prepared
- [ ] Configuration rollback plan documented
- [ ] DNS rollback plan prepared (if needed)
- [ ] Monitoring for rollback triggers configured

### Rollback Triggers
- [ ] Critical application errors
- [ ] Performance degradation > 50%
- [ ] Error rate > 5%
- [ ] External service integration failures
- [ ] Security vulnerabilities discovered

### Rollback Procedure
1. **Immediate Actions**
   - [ ] Stop new deployments
   - [ ] Assess impact and scope
   - [ ] Notify stakeholders

2. **Application Rollback**
   - [ ] Deploy previous version
   - [ ] Rollback database migrations (if needed)
   - [ ] Restore previous configuration
   - [ ] Verify rollback successful

3. **Post-Rollback**
   - [ ] Monitor application stability
   - [ ] Investigate root cause
   - [ ] Plan fix and re-deployment
   - [ ] Update procedures based on lessons learned

## Production Maintenance

### Daily Tasks
- [ ] Check application health and logs
- [ ] Monitor error rates and performance
- [ ] Verify backup completion
- [ ] Check SSL certificate status

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Check security alerts
- [ ] Update dependencies (if needed)
- [ ] Test backup restoration

### Monthly Tasks
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Capacity planning review
- [ ] Disaster recovery test

### Quarterly Tasks
- [ ] Full security assessment
- [ ] Infrastructure cost review
- [ ] Technology stack updates
- [ ] Business continuity plan review

## Emergency Contacts

### Technical Support
- **Infrastructure**: [Your infrastructure team]
- **Application**: [Your development team]
- **Database**: [Your database team]
- **Security**: [Your security team]

### External Services
- **Telnyx Support**: support@telnyx.com
- **Google Cloud Support**: Via Google Cloud Console
- **Stripe Support**: support@stripe.com
- **SendGrid Support**: support@sendgrid.com
- **AWS Support**: Via AWS Console

### Escalation Procedures
1. **Level 1**: On-call engineer
2. **Level 2**: Team lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO/VP Engineering

## Documentation Links

- [Production Setup Guide](PRODUCTION_SETUP.md)
- [DNS Configuration Guide](DNS_CONFIGURATION.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Troubleshooting Guide](../README.md#troubleshooting)
- [API Documentation](../src/test/README.md)

---

**Deployment Approval**

- [ ] Technical Lead Approval: _________________ Date: _________
- [ ] Security Review Approval: _________________ Date: _________
- [ ] Operations Approval: _________________ Date: _________
- [ ] Business Approval: _________________ Date: _________

**Deployment Information**

- Deployment Date: _________________
- Deployed By: _________________
- Version/Tag: _________________
- Rollback Plan Confirmed: [ ] Yes [ ] No
- Monitoring Confirmed: [ ] Yes [ ] No