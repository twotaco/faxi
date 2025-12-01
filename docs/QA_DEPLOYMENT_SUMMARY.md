# Faxi QA Deployment - Complete Setup Summary

## Overview

I've created a complete QA deployment infrastructure for Faxi with the following domain structure:

- **Marketing Website**: https://qa.faxi.jp (localhost:4003)
- **Admin Dashboard**: https://qa-admin.faxi.jp (localhost:4001)
- **Backend API/Test Harness**: https://qa-fax.faxi.jp (localhost:4000)

## Files Created

### 1. Environment Configuration Files

- **`.env.qa`** - Backend environment variables for QA
- **`admin-dashboard/.env.qa`** - Admin dashboard QA config
- **`marketing-website/.env.qa`** - Marketing website QA config

### 2. Docker Configuration

- **`docker-compose.qa.yml`** - Complete Docker Compose setup for QA environment
- **`nginx-qa.conf`** - Nginx reverse proxy configuration with SSL and routing

### 3. Deployment Scripts

- **`scripts/deploy-qa.sh`** - Comprehensive deployment automation script

### 4. AWS Infrastructure

- **`aws/cloudformation-qa.yaml`** - Complete CloudFormation template for AWS infrastructure

### 5. Documentation

- **`docs/QA_DEPLOYMENT_GUIDE.md`** - Detailed deployment guide
- **`docs/QA_DEPLOYMENT_SUMMARY.md`** - This summary document

## Quick Start Guide

### Option 1: Local Docker Deployment

```bash
# 1. Configure environment
cp .env.qa .env.qa.local
# Edit .env.qa.local with actual values

# 2. Start services
docker-compose -f docker-compose.qa.yml up -d

# 3. Run migrations
docker-compose -f docker-compose.qa.yml exec backend npm run migrate

# 4. Check health
curl http://localhost:4000/health
```

### Option 2: AWS Deployment

```bash
# 1. Deploy infrastructure with CloudFormation
aws cloudformation create-stack \
  --stack-name faxi-qa-infrastructure \
  --template-body file://aws/cloudformation-qa.yaml \
  --parameters \
    ParameterKey=DatabasePassword,ParameterValue=YOUR_SECURE_PASSWORD \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:... \
    ParameterKey=HostedZoneId,ParameterValue=Z... \
  --capabilities CAPABILITY_IAM

# 2. Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name faxi-qa-infrastructure

# 3. Run deployment script
./scripts/deploy-qa.sh full
```

## Infrastructure Components

### AWS Resources Created by CloudFormation

1. **Networking**
   - VPC (10.1.0.0/16)
   - 2 Public Subnets (for ALB)
   - 2 Private Subnets (for ECS, RDS, Redis)
   - Internet Gateway
   - NAT Gateway
   - Route Tables

2. **Compute**
   - ECS Cluster (Fargate)
   - 3 ECS Services (backend, admin, marketing)
   - Auto-scaling configuration

3. **Database & Cache**
   - RDS PostgreSQL 15 (db.t3.small)
   - ElastiCache Redis 7 (cache.t3.micro)
   - Automated backups (7 days)

4. **Storage**
   - S3 Bucket (encrypted, versioned)
   - Lifecycle policies (90-day retention)

5. **Load Balancing**
   - Application Load Balancer
   - 3 Target Groups (one per service)
   - SSL/TLS termination
   - Host-based routing

6. **DNS**
   - Route 53 A records for all three domains

7. **Security**
   - Security Groups (ALB, ECS, RDS, Redis)
   - IAM Roles (Task Execution, Task Role)
   - Secrets Manager integration

## Domain Routing

The Nginx configuration routes traffic based on hostname:

```
qa.faxi.jp          → marketing-website:3000
qa-admin.faxi.jp    → admin-dashboard:3000
qa-fax.faxi.jp      → backend:4000
```

### Backend Endpoints

- `GET /health` - Health check (no rate limit)
- `POST /webhooks/*` - Webhook receivers (rate limited: 5 req/s)
- `GET /api/*` - API endpoints (rate limited: 10 req/s)
- `GET /test` - Test harness (QA only)
- `GET /metrics` - Prometheus metrics (internal IPs only)

## Deployment Script Commands

The `deploy-qa.sh` script provides these commands:

```bash
./scripts/deploy-qa.sh full      # Full deployment
./scripts/deploy-qa.sh infra     # Setup infrastructure
./scripts/deploy-qa.sh secrets   # Setup secrets
./scripts/deploy-qa.sh build     # Build and push images
./scripts/deploy-qa.sh migrate   # Run migrations
./scripts/deploy-qa.sh deploy    # Deploy services
./scripts/deploy-qa.sh health    # Check health
./scripts/deploy-qa.sh status    # Show status
./scripts/deploy-qa.sh rollback  # Rollback deployment
```

## Configuration Checklist

Before deploying, update these values:

### Backend (.env.qa)
- [ ] `DATABASE_PASSWORD` - Secure password (16+ chars)
- [ ] `REDIS_PASSWORD` - Secure password
- [ ] `TELNYX_API_KEY` - Test account API key
- [ ] `TELNYX_PUBLIC_KEY` - Test account public key
- [ ] `GEMINI_API_KEY` - QA API key
- [ ] `STRIPE_SECRET_KEY` - Test mode key (sk_test_...)
- [ ] `S3_ACCESS_KEY_ID` - AWS access key
- [ ] `S3_SECRET_ACCESS_KEY` - AWS secret key
- [ ] `ADMIN_JWT_SECRET` - Random 32+ character string

### Admin Dashboard (.env.qa)
- [ ] `NEXTAUTH_SECRET` - Random 32+ character string

### AWS Secrets Manager
- [ ] `faxi/qa/database` - Database credentials
- [ ] `faxi/qa/telnyx` - Telnyx API keys
- [ ] `faxi/qa/gemini` - Gemini API key
- [ ] `faxi/qa/stripe` - Stripe keys
- [ ] `faxi/qa/aws` - AWS credentials

### SSL Certificates
- [ ] Request ACM certificate for `*.faxi.jp` or individual certs
- [ ] Validate certificate via DNS
- [ ] Update CloudFormation parameter with ARN

### DNS Configuration
- [ ] Get Route 53 Hosted Zone ID for faxi.jp
- [ ] CloudFormation will create A records automatically

## Cost Estimate (Monthly)

QA environment estimated costs:

- **ECS Fargate**: ~$50 (6 tasks × 0.5 vCPU × 1GB RAM)
- **RDS db.t3.small**: ~$30
- **ElastiCache cache.t3.micro**: ~$15
- **ALB**: ~$20
- **NAT Gateway**: ~$35
- **S3 Storage**: ~$5 (assuming 100GB)
- **Data Transfer**: ~$10

**Total**: ~$165/month

### Cost Optimization Tips

1. **Stop during off-hours**: Scale ECS to 0 tasks at night
2. **Use Fargate Spot**: 70% discount for non-critical tasks
3. **Single NAT Gateway**: Already configured (vs 2 for HA)
4. **S3 Lifecycle**: Automatically transitions to cheaper storage

## Security Features

1. **Network Isolation**
   - ECS tasks in private subnets
   - No direct internet access
   - All traffic through NAT Gateway

2. **Encryption**
   - RDS encryption at rest
   - S3 encryption (AES-256)
   - TLS 1.2+ for all HTTPS traffic

3. **Access Control**
   - IAM roles with least privilege
   - Security groups restrict traffic
   - Secrets in AWS Secrets Manager

4. **Rate Limiting**
   - API endpoints: 10 req/s
   - Webhooks: 5 req/s
   - Burst allowance configured

5. **Security Headers**
   - X-Frame-Options: SAMEORIGIN
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: enabled
   - HSTS: 1 year

## Monitoring and Logging

### CloudWatch Logs

All services log to CloudWatch:
- `/ecs/faxi-qa-backend`
- `/ecs/faxi-qa-admin`
- `/ecs/faxi-qa-marketing`

### Health Checks

- **Tier 0**: System integrity (services, ports, database, Redis)
- **Tier 1**: API smoke tests (endpoints, webhooks)
- **Tier 2**: E2E functional tests (critical paths)

### Metrics

Available at `https://qa-fax.faxi.jp/metrics` (internal IPs only):
- Request rates
- Response times
- Error rates
- Queue lengths
- Database connections

## Testing in QA

### Smoke Tests
```bash
cd backend
TEST_API_URL=https://qa-fax.faxi.jp npm run test:smoke
```

### Integration Tests
```bash
cd backend
TEST_API_URL=https://qa-fax.faxi.jp npm run test:integration
```

### Manual Testing
- Test Harness: https://qa-fax.faxi.jp/test
- Admin Dashboard: https://qa-admin.faxi.jp
- Marketing Demo: https://qa.faxi.jp/demo

## Troubleshooting

### Common Issues

1. **Services won't start**
   - Check CloudWatch logs
   - Verify secrets are configured
   - Check security group rules

2. **Database connection fails**
   - Verify RDS security group allows ECS
   - Check database credentials in secrets
   - Ensure tasks are in correct subnets

3. **SSL certificate errors**
   - Verify certificate is validated in ACM
   - Check certificate ARN in CloudFormation
   - Ensure DNS records point to ALB

4. **Health checks failing**
   - Check target group health in AWS Console
   - Verify health check paths are correct
   - Check application logs for errors

### Debug Commands

```bash
# View ECS task logs
aws logs tail /ecs/faxi-qa-backend --follow

# Describe ECS service
aws ecs describe-services \
  --cluster faxi-qa-cluster \
  --services faxi-qa-backend

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN>

# Test from ECS task
aws ecs execute-command \
  --cluster faxi-qa-cluster \
  --task <TASK_ID> \
  --container backend \
  --interactive \
  --command "/bin/sh"
```

## Next Steps

1. **Deploy Infrastructure**
   ```bash
   aws cloudformation create-stack \
     --stack-name faxi-qa-infrastructure \
     --template-body file://aws/cloudformation-qa.yaml \
     --parameters file://aws/qa-parameters.json \
     --capabilities CAPABILITY_IAM
   ```

2. **Configure Secrets**
   ```bash
   ./scripts/deploy-qa.sh secrets
   # Then update secrets with actual values in AWS Console
   ```

3. **Build and Deploy**
   ```bash
   ./scripts/deploy-qa.sh build
   ./scripts/deploy-qa.sh migrate
   ./scripts/deploy-qa.sh deploy
   ```

4. **Verify Deployment**
   ```bash
   ./scripts/deploy-qa.sh health
   ./scripts/deploy-qa.sh status
   ```

5. **Test Services**
   - Visit https://qa.faxi.jp
   - Login to https://qa-admin.faxi.jp
   - Test fax processing at https://qa-fax.faxi.jp/test

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review deployment guide: `docs/QA_DEPLOYMENT_GUIDE.md`
3. Check ECS task status and events
4. Review security group rules
5. Verify secrets are configured correctly

## Maintenance

### Regular Tasks
- **Daily**: Monitor CloudWatch alarms
- **Weekly**: Review logs for errors
- **Monthly**: Update dependencies and redeploy
- **Quarterly**: Rotate secrets

### Backup and Recovery
- RDS automated backups (7 days)
- Redis snapshots (5 days)
- S3 versioning enabled
- CloudFormation template in git

## Production Comparison

| Feature | QA | Production |
|---------|-----|------------|
| Domain | qa.faxi.jp | faxi.jp |
| RDS Instance | db.t3.small | db.t3.medium |
| Redis Instance | cache.t3.micro | cache.t3.small |
| ECS Tasks | 2 per service | 3+ per service |
| Multi-AZ | No | Yes |
| Backups | 7 days | 30 days |
| Auto-scaling | 1-3 tasks | 3-10 tasks |
| Cost | ~$165/mo | ~$400/mo |

---

**Created**: December 1, 2024
**Last Updated**: December 1, 2024
**Version**: 1.0
