# Faxi QA Environment Deployment Guide

This guide covers deploying the Faxi application to a QA environment on AWS with the following domains:

- **Marketing Website**: https://qa.faxi.jp (port 4003 locally)
- **Admin Dashboard**: https://qa-admin.faxi.jp (port 4001 locally)
- **Backend API**: https://qa-fax.faxi.jp (port 4000 locally)

## Architecture Overview

The QA environment mirrors production but with:
- Separate AWS resources (RDS, ElastiCache, S3, ECS)
- Test API keys for external services (Telnyx, Stripe, Gemini)
- Debug endpoints enabled
- Lower resource limits
- Separate domain names with `qa-` prefix

## Prerequisites

### Required Tools

- AWS CLI (configured with appropriate credentials)
- Docker Desktop
- Node.js 20+
- Git

### AWS Resources Needed

1. **ECS Cluster**: `faxi-qa-cluster`
2. **RDS PostgreSQL**: `faxi-qa-db` (PostgreSQL 15)
3. **ElastiCache Redis**: `faxi-qa-redis` (Redis 7)
4. **S3 Bucket**: `faxi-qa-faxes`
5. **ECR Repositories**: 
   - `faxi-backend`
   - `faxi-admin-dashboard`
   - `faxi-marketing-website`
6. **Application Load Balancer**: With SSL certificates for all three domains
7. **Route 53**: DNS records for qa.faxi.jp, qa-admin.faxi.jp, qa-fax.faxi.jp

### SSL Certificates

Request SSL certificates in AWS Certificate Manager for:
- `qa.faxi.jp`
- `qa-admin.faxi.jp`
- `qa-fax.faxi.jp`

Or use a wildcard certificate: `*.faxi.jp`

## Quick Start

### 1. Configure Environment Variables

```bash
# Copy QA environment template
cp .env.qa .env.qa.local

# Edit with actual values
vim .env.qa.local
```

Update these critical values:
- Database credentials
- Telnyx API keys (test account)
- Gemini API key
- Stripe keys (test mode)
- AWS credentials
- JWT secrets

### 2. Full Deployment

```bash
# Run full deployment
./scripts/deploy-qa.sh full
```

This will:
1. Check prerequisites
2. Setup AWS infrastructure
3. Create secrets in AWS Secrets Manager
4. Build and push Docker images
5. Run database migrations
6. Deploy ECS services
7. Perform health checks

### 3. Verify Deployment

```bash
# Check service status
./scripts/deploy-qa.sh status

# Check health endpoints
curl https://qa-fax.faxi.jp/health
curl https://qa-admin.faxi.jp
curl https://qa.faxi.jp
```

## Step-by-Step Deployment

### Step 1: Setup Infrastructure

```bash
./scripts/deploy-qa.sh infra
```

This creates:
- ECR repositories for Docker images
- ECS cluster
- Checks for RDS and ElastiCache (warns if missing)
- Creates S3 bucket with encryption

### Step 2: Setup Secrets

```bash
./scripts/deploy-qa.sh secrets
```

Creates AWS Secrets Manager secrets:
- `faxi/qa/database` - Database credentials
- `faxi/qa/telnyx` - Telnyx API keys
- `faxi/qa/gemini` - Gemini API key
- `faxi/qa/stripe` - Stripe keys
- `faxi/qa/aws` - AWS credentials

**Important**: Update secrets with actual values:

```bash
# Update database secret
aws secretsmanager update-secret \
  --secret-id faxi/qa/database \
  --secret-string '{"username":"faxi_qa_user","password":"YOUR_SECURE_PASSWORD"}' \
  --region us-east-1

# Update Telnyx secret
aws secretsmanager update-secret \
  --secret-id faxi/qa/telnyx \
  --secret-string '{"api_key":"YOUR_TEST_KEY","public_key":"YOUR_PUBLIC_KEY"}' \
  --region us-east-1

# Update Gemini secret
aws secretsmanager update-secret \
  --secret-id faxi/qa/gemini \
  --secret-string '{"api_key":"YOUR_GEMINI_KEY"}' \
  --region us-east-1
```

### Step 3: Build and Push Images

```bash
./scripts/deploy-qa.sh build
```

Builds Docker images for:
- Backend (Express.js API)
- Admin Dashboard (Next.js)
- Marketing Website (Next.js)

Tags and pushes to ECR with `qa` and `latest-qa` tags.

### Step 4: Run Database Migrations

```bash
./scripts/deploy-qa.sh migrate
```

Runs database migrations to setup schema.

### Step 5: Deploy Services

```bash
./scripts/deploy-qa.sh deploy
```

Deploys or updates ECS services:
- `faxi-qa-backend` (2 tasks)
- `faxi-qa-admin` (2 tasks)
- `faxi-qa-marketing` (2 tasks)

### Step 6: Health Checks

```bash
./scripts/deploy-qa.sh health
```

Verifies all services are responding correctly.

## DNS Configuration

### Route 53 Setup

Create A records (or CNAME) pointing to the Application Load Balancer:

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers \
  --names faxi-qa-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text

# Create Route 53 records
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch file://qa-dns-records.json
```

Example `qa-dns-records.json`:

```json
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "qa.faxi.jp",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "faxi-qa-alb-123456789.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "qa-admin.faxi.jp",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "faxi-qa-alb-123456789.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "qa-fax.faxi.jp",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "faxi-qa-alb-123456789.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
```

## Load Balancer Configuration

### Target Groups

Create three target groups:
1. `faxi-qa-backend-tg` - Port 4000
2. `faxi-qa-admin-tg` - Port 3000
3. `faxi-qa-marketing-tg` - Port 3000

### Listener Rules

Configure ALB listener rules (HTTPS:443):

1. **Host: qa.faxi.jp** → Forward to `faxi-qa-marketing-tg`
2. **Host: qa-admin.faxi.jp** → Forward to `faxi-qa-admin-tg`
3. **Host: qa-fax.faxi.jp** → Forward to `faxi-qa-backend-tg`

### Health Checks

- Backend: `GET /health` (expect 200)
- Admin: `GET /` (expect 200)
- Marketing: `GET /` (expect 200)

## Environment-Specific Configuration

### Backend (.env.qa)

Key differences from production:
- `TEST_MODE=false` (use real APIs but test accounts)
- `ENABLE_DEBUG_ENDPOINTS=true`
- `ALLOW_TEST_WEBHOOKS=true`
- Test Telnyx account
- Stripe test mode keys
- Separate S3 bucket

### Admin Dashboard

- `NEXT_PUBLIC_ENVIRONMENT=qa`
- `NEXT_PUBLIC_ENABLE_DEBUG=true`
- Points to QA backend API

### Marketing Website

- `NEXT_PUBLIC_ENVIRONMENT=qa`
- `NEXT_PUBLIC_SHOW_QA_BANNER=true` (shows QA environment banner)
- Points to QA backend API

## Monitoring and Debugging

### View Logs

```bash
# Backend logs
aws logs tail /ecs/faxi-qa-backend --follow

# Admin dashboard logs
aws logs tail /ecs/faxi-qa-admin --follow

# Marketing website logs
aws logs tail /ecs/faxi-qa-marketing --follow
```

### ECS Service Status

```bash
./scripts/deploy-qa.sh status
```

### Health Endpoints

```bash
# Backend health
curl https://qa-fax.faxi.jp/health

# Backend metrics (from allowed IPs)
curl https://qa-fax.faxi.jp/metrics

# Test harness (QA only)
open https://qa-fax.faxi.jp/test
```

### Database Access

```bash
# Connect to RDS
psql -h faxi-qa-db.xxxxx.us-east-1.rds.amazonaws.com \
     -U faxi_qa_user \
     -d faxi_qa
```

### Redis Access

```bash
# Connect via bastion or ECS task
redis-cli -h faxi-qa-redis.xxxxx.cache.amazonaws.com -p 6379
```

## Updating the QA Environment

### Code Updates

```bash
# Build new images
./scripts/deploy-qa.sh build

# Deploy updated services
./scripts/deploy-qa.sh deploy

# Check health
./scripts/deploy-qa.sh health
```

### Configuration Updates

```bash
# Update secrets
aws secretsmanager update-secret \
  --secret-id faxi/qa/database \
  --secret-string '{"username":"user","password":"new_password"}'

# Force new deployment to pick up changes
./scripts/deploy-qa.sh deploy
```

### Database Migrations

```bash
# Run new migrations
./scripts/deploy-qa.sh migrate
```

## Rollback

If deployment fails or issues are detected:

```bash
./scripts/deploy-qa.sh rollback
```

This reverts all services to their previous task definitions.

## Troubleshooting

### Service Won't Start

1. Check ECS task logs:
```bash
aws ecs describe-tasks \
  --cluster faxi-qa-cluster \
  --tasks TASK_ID \
  --region us-east-1
```

2. Check CloudWatch logs for errors

3. Verify secrets are correctly configured

### Health Checks Failing

1. Check service is running:
```bash
./scripts/deploy-qa.sh status
```

2. Check target group health:
```bash
aws elbv2 describe-target-health \
  --target-group-arn TARGET_GROUP_ARN
```

3. Test health endpoint directly from ECS task

### Database Connection Issues

1. Verify security groups allow ECS → RDS traffic
2. Check database credentials in secrets
3. Verify RDS is in same VPC as ECS tasks
4. Check RDS security group inbound rules

### External API Issues

1. Verify API keys are for test/QA accounts
2. Check webhook URLs point to QA domain
3. Test API connectivity from ECS task
4. Review API rate limits

## Cost Optimization

QA environment uses smaller resources:
- RDS: db.t3.small (vs db.t3.medium in prod)
- ElastiCache: cache.t3.micro (vs cache.t3.small in prod)
- ECS Tasks: 0.5 vCPU, 1GB RAM (vs 1 vCPU, 2GB in prod)
- 2 tasks per service (vs 3+ in prod)

### Auto-Scaling

Configure ECS auto-scaling for cost savings:
- Min: 1 task (off-hours)
- Max: 3 tasks (peak hours)
- Target CPU: 70%

### Scheduled Scaling

Stop QA environment during off-hours:

```bash
# Stop services at night (optional)
aws ecs update-service \
  --cluster faxi-qa-cluster \
  --service faxi-qa-backend \
  --desired-count 0

# Start in morning
aws ecs update-service \
  --cluster faxi-qa-cluster \
  --service faxi-qa-backend \
  --desired-count 2
```

## Security Considerations

### Network Security

- ECS tasks in private subnets
- ALB in public subnets
- Security groups restrict traffic:
  - ALB → ECS: Only required ports
  - ECS → RDS: Port 5432
  - ECS → Redis: Port 6379
  - ECS → Internet: HTTPS only (for APIs)

### Secrets Management

- All secrets in AWS Secrets Manager
- ECS task role has read-only access to QA secrets
- Secrets rotated quarterly
- No secrets in environment variables or code

### Access Control

- IAM roles for ECS tasks (least privilege)
- Admin dashboard requires authentication
- Test harness restricted to QA environment
- Metrics endpoint restricted to internal IPs

## Testing in QA

### Smoke Tests

```bash
# Run smoke tests against QA
cd backend
TEST_API_URL=https://qa-fax.faxi.jp npm run test:smoke
```

### Integration Tests

```bash
# Run integration tests
cd backend
TEST_API_URL=https://qa-fax.faxi.jp npm run test:integration
```

### E2E Tests

```bash
# Run E2E tests against QA
cd admin-dashboard
NEXT_PUBLIC_API_URL=https://qa-fax.faxi.jp npm run test:e2e
```

### Manual Testing

1. **Fax Processing**: Upload test fax via test harness
2. **Shopping Flow**: Test product search and ordering
3. **Email Integration**: Send test email to fax
4. **Admin Dashboard**: Verify job monitoring and user management
5. **Marketing Site**: Test demo and metrics display

## Maintenance

### Regular Tasks

- **Daily**: Check CloudWatch alarms
- **Weekly**: Review logs for errors
- **Monthly**: Update dependencies and redeploy
- **Quarterly**: Rotate secrets

### Backup and Recovery

QA backups (7-day retention):
- RDS automated backups
- Redis snapshots
- S3 versioning enabled

Restore from backup:
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier faxi-qa-db-restored \
  --db-snapshot-identifier faxi-qa-db-snapshot-20241201
```

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review ECS task status
3. Test health endpoints
4. Contact DevOps team

## Appendix

### Useful Commands

```bash
# View all QA resources
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Environment,Values=qa Key=Project,Values=faxi

# Scale services
aws ecs update-service \
  --cluster faxi-qa-cluster \
  --service faxi-qa-backend \
  --desired-count 3

# View task definitions
aws ecs list-task-definitions \
  --family-prefix faxi-qa

# Describe service
aws ecs describe-services \
  --cluster faxi-qa-cluster \
  --services faxi-qa-backend
```

### Environment Comparison

| Resource | Development | QA | Production |
|----------|-------------|-----|------------|
| Domain | localhost | qa.faxi.jp | faxi.jp |
| RDS | Local PostgreSQL | db.t3.small | db.t3.medium |
| Redis | Local Redis | cache.t3.micro | cache.t3.small |
| ECS Tasks | N/A | 2 per service | 3+ per service |
| Auto-scaling | No | Yes (1-3) | Yes (3-10) |
| Backups | Manual | 7 days | 30 days |
| SSL | Self-signed | ACM | ACM |
| Monitoring | Basic | CloudWatch | CloudWatch + Alerts |
