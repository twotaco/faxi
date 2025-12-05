# QA Environment Deployment Guide

**Last Updated**: December 2, 2025
**Status**: Fully Operational

## Overview

This guide covers deploying all Faxi services to the QA environment on AWS ECS.

| Service | Domain | Port (Local) | Port (QA) | Status |
|---------|--------|--------------|-----------|--------|
| Backend API | qa-fax.faxi.jp | 4000 | 4000 | ✅ |
| Admin Dashboard | qa-admin.faxi.jp | 4001 | 3000 | ✅ |
| Marketing Website | qa.faxi.jp | 4003 | 3000 | ✅ |

**Note**: Local dev ports (400x) differ from QA ports (3000 for Next.js apps). The `npm start` command respects the `PORT` environment variable set in Docker.

## Quick Status Check

```bash
# Check all services
aws ecs describe-services \
  --cluster faxi-qa-cluster \
  --services faxi-qa-backend faxi-qa-admin faxi-qa-marketing \
  --region us-east-1 \
  --query 'services[*].[serviceName,runningCount,desiredCount]' \
  --output table

# Check target health
for tg in backend admin marketing; do
  echo "=== $tg ===" && aws elbv2 describe-target-health \
    --target-group-arn $(aws elbv2 describe-target-groups --names qa-faxi-$tg-tg --region us-east-1 --query 'TargetGroups[0].TargetGroupArn' --output text) \
    --region us-east-1 \
    --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
    --output table
done

# Test endpoints (HTTP)
curl -s -o /dev/null -w "%{http_code}" http://qa-fax.faxi.jp/health
curl -s -o /dev/null -w "%{http_code}" http://qa-admin.faxi.jp
curl -s -o /dev/null -w "%{http_code}" http://qa.faxi.jp/en
```

## Infrastructure Details

| Resource | Value |
|----------|-------|
| **AWS Account** | 223882168768 |
| **Region** | us-east-1 |
| **ECS Cluster** | faxi-qa-cluster |
| **ECR Registry** | 223882168768.dkr.ecr.us-east-1.amazonaws.com |
| **ALB** | qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com |
| **Database** | qa-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com:5432 |
| **Redis** | qa-faxi-redis.ub4jqi.0001.use1.cache.amazonaws.com:6379 |
| **S3 Bucket** | qa-faxi-faxes |

### Network Configuration

```
VPC Subnets (Private):
  - subnet-0817ac5e2270a799a (us-east-1a)
  - subnet-02425484c058e6838 (us-east-1b)

Security Group: sg-00d7e2a7f3769c777

Target Groups:
  - qa-faxi-backend-tg (port 4000)
  - qa-faxi-admin-tg (port 3000)
  - qa-faxi-marketing-tg (port 3000)
```

## Deployment Steps

### Prerequisites

```bash
# 1. Verify AWS credentials
aws sts get-caller-identity

# 2. Set environment variables
export AWS_REGION=us-east-1
export ECR_REGISTRY=223882168768.dkr.ecr.us-east-1.amazonaws.com

# 3. Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY
```

### Deploy Marketing Website (qa.faxi.jp)

```bash
cd marketing-website

# 1. Build for linux/amd64 (REQUIRED for ECS Fargate)
docker build --platform linux/amd64 -t faxi-marketing-website:qa -f Dockerfile .

# 2. Tag and push to ECR
docker tag faxi-marketing-website:qa $ECR_REGISTRY/faxi-marketing-website:qa
docker push $ECR_REGISTRY/faxi-marketing-website:qa

# 3. Create CloudWatch log group (first time only)
aws logs create-log-group --log-group-name /ecs/faxi-qa-marketing --region us-east-1

# 4. Register task definition (see aws/qa-marketing-task-definition.json)
aws ecs register-task-definition \
  --cli-input-json file://aws/qa-marketing-task-definition.json \
  --region us-east-1

# 5. Create/update service
aws ecs update-service \
  --cluster faxi-qa-cluster \
  --service faxi-qa-marketing \
  --force-new-deployment \
  --region us-east-1

# Or create new service:
aws ecs create-service \
  --cluster faxi-qa-cluster \
  --service-name faxi-qa-marketing \
  --task-definition faxi-qa-marketing \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0817ac5e2270a799a,subnet-02425484c058e6838],securityGroups=[sg-00d7e2a7f3769c777],assignPublicIp=DISABLED}' \
  --load-balancers 'targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:223882168768:targetgroup/qa-faxi-marketing-tg/3adaca4fd34f7ff8,containerName=marketing,containerPort=3000' \
  --region us-east-1

# 6. Update health check path (Next.js with i18n redirects / to /en)
aws elbv2 modify-target-group \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:223882168768:targetgroup/qa-faxi-marketing-tg/3adaca4fd34f7ff8 \
  --health-check-path "/en" \
  --region us-east-1
```

### Deploy Admin Dashboard (qa-admin.faxi.jp)

```bash
cd admin-dashboard

# 1. Build for linux/amd64
docker build --platform linux/amd64 -t faxi-admin-dashboard:qa -f Dockerfile .

# 2. Tag with unique timestamp (prevents caching issues)
TAG="qa-$(date +%Y%m%d%H%M%S)"
docker tag faxi-admin-dashboard:qa $ECR_REGISTRY/faxi-admin-dashboard:$TAG
docker push $ECR_REGISTRY/faxi-admin-dashboard:$TAG

# 3. Update task definition with new image tag
# Edit the image in task definition, then register:
aws ecs register-task-definition \
  --cli-input-json file://aws/qa-admin-task-definition.json \
  --region us-east-1

# 4. Update service
aws ecs update-service \
  --cluster faxi-qa-cluster \
  --service faxi-qa-admin \
  --task-definition faxi-qa-admin \
  --force-new-deployment \
  --region us-east-1
```

### Deploy Backend (qa-fax.faxi.jp)

```bash
cd backend

# 1. Build for linux/amd64
docker build --platform linux/amd64 -t faxi-backend:qa -f Dockerfile --target production .

# 2. Tag and push
docker tag faxi-backend:qa $ECR_REGISTRY/faxi-backend:qa
docker push $ECR_REGISTRY/faxi-backend:qa

# 3. Update service
aws ecs update-service \
  --cluster faxi-qa-cluster \
  --service faxi-qa-backend \
  --force-new-deployment \
  --region us-east-1
```

## Common Issues & Fixes

### 1. Docker Image Platform Mismatch

**Error**: `image Manifest does not contain descriptor matching platform 'linux/amd64'`

**Cause**: Image built on Mac ARM (Apple Silicon) but ECS needs linux/amd64

**Fix**: Always use `--platform linux/amd64` when building:
```bash
docker build --platform linux/amd64 -t myimage:tag .
```

### 2. Health Check Failing with 307

**Error**: `Target.ResponseCodeMismatch: Health checks failed with these codes: [307]`

**Cause**: Next.js with next-intl redirects `/` to `/en` or `/ja`

**Fix**: Update health check path:
```bash
aws elbv2 modify-target-group \
  --target-group-arn <target-group-arn> \
  --health-check-path "/en" \
  --region us-east-1
```

### 3. CloudWatch Log Group Missing

**Error**: `failed to create Cloudwatch log group: AccessDeniedException`

**Cause**: ECS task execution role can't create log groups

**Fix**: Create log group manually:
```bash
aws logs create-log-group --log-group-name /ecs/faxi-qa-<service> --region us-east-1
```

### 4. Port Mismatch (App not responding)

**Error**: Health checks failing, 502 Bad Gateway

**Cause**: App running on different port than target group expects

**Symptoms in logs**: `http://localhost:4001` when target group expects 3000

**Fix**: Ensure `package.json` start script respects PORT env var:
```json
{
  "scripts": {
    "dev": "next dev -p 4001",
    "start": "next start"  // Uses PORT env var, NOT hardcoded port
  }
}
```

**Important**: Keep local dev ports (4001, 4003) separate from the `start` command. Docker sets `PORT=3000`.

### 5. ECS Image Caching

**Error**: New code not deploying despite push

**Cause**: ECS caches images by tag; using same `:qa` tag may not pull new image

**Fix**: Use unique tags:
```bash
TAG="qa-$(date +%Y%m%d%H%M%S)"
docker tag myimage:qa $ECR_REGISTRY/myimage:$TAG
docker push $ECR_REGISTRY/myimage:$TAG

# Update task definition to use new tag, then deploy
```

### 6. Database Migrations Not Run

**Error**: `relation "application_logs" does not exist`

**Fix**: Run migrations via ECS run-task:
```bash
aws ecs run-task \
  --cluster faxi-qa-cluster \
  --task-definition faxi-qa-backend \
  --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0817ac5e2270a799a,subnet-02425484c058e6838],securityGroups=[sg-00d7e2a7f3769c777],assignPublicIp=DISABLED}' \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","migrate"]}]}' \
  --region us-east-1
```

### 7. HTTPS Not Working

**Error**: Connection timeout on port 443

**Cause**: ALB only has HTTP listener (port 80), no HTTPS listener

**Current Status**: QA uses HTTP only. For HTTPS, need to:
1. Request ACM certificate for *.faxi.jp
2. Add HTTPS listener to ALB
3. Configure listener rules for HTTPS

## Port Configuration Summary

| Environment | Backend | Admin | Marketing |
|-------------|---------|-------|-----------|
| Local Dev (`npm run dev`) | 4000 | 4001 | 4003 |
| Docker/QA (`npm start`) | 4000 | 3000 | 3000 |

**Why different?**
- Local dev: Each app needs unique port to run simultaneously
- Docker: Uses PORT env var (3000) set in Dockerfile for Next.js apps
- Backend: Always uses 4000 (its standard port)

## Monitoring & Logs

```bash
# Stream logs
aws logs tail /ecs/faxi-qa-backend --follow --region us-east-1
aws logs tail /ecs/faxi-qa-admin --follow --region us-east-1
aws logs tail /ecs/faxi-qa-marketing --follow --region us-east-1

# Check service events
aws ecs describe-services \
  --cluster faxi-qa-cluster \
  --services faxi-qa-backend \
  --region us-east-1 \
  --query 'services[0].events[0:5]'
```

## Environment Configuration

See `docs/ENVIRONMENT_CONFIGURATION_GUIDE.md` for details on:
- AWS Secrets Manager setup
- ECS task definition environment variables
- Local vs QA configuration

## Task Definition Files

Located in `aws/` directory:
- `qa-backend-task-definition.json`
- `qa-admin-task-definition.json`
- `qa-marketing-task-definition.json`

## Production Deployment

For production deployment, follow same steps but:
1. Use production domain names
2. Configure HTTPS with ACM certificates
3. Use production secrets in AWS Secrets Manager
4. Scale desired count appropriately
5. Enable auto-scaling

---

**Quick Reference**:
- Backend: http://qa-fax.faxi.jp
- Admin: http://qa-admin.faxi.jp
- Marketing: http://qa.faxi.jp
