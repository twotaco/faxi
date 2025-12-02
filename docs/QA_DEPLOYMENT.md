# QA Environment Deployment Guide

**Last Updated**: December 2, 2024  
**Status**: Infrastructure Complete, Backend Ready, Needs Final Deployment

## Current Status

### ✅ Completed (85%)
1. **AWS Infrastructure** - VPC, RDS, Redis, ALB, ECS, S3, ECR all provisioned
2. **Configuration** - `backend/.env.qa` updated with actual endpoints
3. **Secrets** - AWS Secrets Manager configured (needs real API keys)
4. **Backend Image** - Built and pushed to ECR

### ⏳ Remaining Steps (15%)
1. Add DNS records
2. Update secrets with real API keys
3. Deploy backend ECS service
4. Run database migrations
5. Test deployment

## Quick Start Commands

### 1. Add DNS Records (Do This First)

Add these CNAME records to your DNS provider:

```
qa.faxi.jp → qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com
qa-admin.faxi.jp → qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com
qa-fax.faxi.jp → qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com
```

### 2. Update Secrets with Real API Keys

```bash
# Telnyx (test account)
aws secretsmanager update-secret \
  --secret-id faxi/qa/telnyx \
  --secret-string '{"api_key":"YOUR_TEST_KEY","public_key":"YOUR_PUBLIC_KEY"}' \
  --region us-east-1

# Gemini
aws secretsmanager update-secret \
  --secret-id faxi/qa/gemini \
  --secret-string '{"api_key":"YOUR_GEMINI_KEY"}' \
  --region us-east-1

# Stripe (test mode)
aws secretsmanager update-secret \
  --secret-id faxi/qa/stripe \
  --secret-string '{"secret_key":"sk_test_...","publishable_key":"pk_test_..."}' \
  --region us-east-1
```

### 3. Deploy Backend Service

```bash
# Create log group
aws logs create-log-group --log-group-name /ecs/faxi-qa-backend --region us-east-1

# Create task definition
cat > task-def-backend.json << 'EOF'
{
  "family": "faxi-qa-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::223882168768:role/faxi-qa-infrastructure-ECSTaskExecutionRole-Aq3cBooTamV5",
  "taskRoleArn": "arn:aws:iam::223882168768:role/faxi-qa-infrastructure-ECSTaskRole-lW6TQEqXXhnz",
  "containerDefinitions": [{
    "name": "backend",
    "image": "223882168768.dkr.ecr.us-east-1.amazonaws.com/faxi-backend:qa",
    "portMappings": [{"containerPort": 4000, "protocol": "tcp"}],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "4000"},
      {"name": "DATABASE_HOST", "value": "qa-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com"},
      {"name": "DATABASE_PORT", "value": "5432"},
      {"name": "DATABASE_NAME", "value": "faxi_qa"},
      {"name": "DATABASE_USER", "value": "faxi_qa_user"},
      {"name": "REDIS_HOST", "value": "qa-faxi-redis.ub4jqi.0001.use1.cache.amazonaws.com"},
      {"name": "REDIS_PORT", "value": "6379"},
      {"name": "S3_BUCKET", "value": "qa-faxi-faxes"},
      {"name": "S3_REGION", "value": "us-east-1"}
    ],
    "secrets": [
      {"name": "DATABASE_PASSWORD", "valueFrom": "arn:aws:secretsmanager:us-east-1:223882168768:secret:faxi/qa/database-mvT9Ay:password::"},
      {"name": "TELNYX_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:223882168768:secret:faxi/qa/telnyx-VfqOGA:api_key::"},
      {"name": "GEMINI_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:223882168768:secret:faxi/qa/gemini-fqlfIc:api_key::"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/faxi-qa-backend",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
EOF

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-def-backend.json --region us-east-1

# Create service
aws ecs create-service \
  --cluster qa-faxi-cluster \
  --service-name faxi-qa-backend \
  --task-definition faxi-qa-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-02425484c058e6838,subnet-0817ac5e2270a799a],securityGroups=[sg-00d7e2a7f3769c777],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:223882168768:targetgroup/qa-faxi-backend-tg/fe895bcaef39aefc,containerName=backend,containerPort=4000" \
  --enable-execute-command \
  --region us-east-1
```

### 4. Run Database Migrations

```bash
# Wait for task to be running (check AWS Console or wait 2 minutes)

# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster qa-faxi-cluster --service-name faxi-qa-backend --query 'taskArns[0]' --output text --region us-east-1)

# Run migrations
aws ecs execute-command \
  --cluster qa-faxi-cluster \
  --task $TASK_ARN \
  --container backend \
  --interactive \
  --command "/bin/sh" \
  --region us-east-1

# Then inside the container:
npm run migrate
exit
```

### 5. Test Deployment

```bash
# Test health endpoint (after DNS propagates)
curl http://qa-fax.faxi.jp/health

# Should return: {"status":"ok",...}
```

## Infrastructure Details

| Resource | Value |
|----------|-------|
| **Database** | qa-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com:5432 |
| **Redis** | qa-faxi-redis.ub4jqi.0001.use1.cache.amazonaws.com:6379 |
| **ALB** | qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com |
| **S3 Bucket** | qa-faxi-faxes |
| **ECS Cluster** | qa-faxi-cluster |
| **ECR Registry** | 223882168768.dkr.ecr.us-east-1.amazonaws.com |

## Configuration Files

- **`backend/.env.qa`** - Reference showing QA configuration (actual values in AWS)
- **`docker-compose.qa.yml`** - For local QA testing
- **`aws/cloudformation-qa-http-only.yaml`** - Infrastructure template used
- **`scripts/deploy-qa.sh`** - Deployment automation script

## Environment Configuration

**Local Development**: Use `.env` files in each app directory  
**QA Deployment**: 
- Sensitive data → AWS Secrets Manager
- Configuration → ECS Task Definition
- Reference → `backend/.env.qa`

See `docs/ENVIRONMENT_CONFIGURATION_GUIDE.md` for details.

## Troubleshooting

### Service Won't Start
```bash
# Check task status
aws ecs describe-tasks \
  --cluster qa-faxi-cluster \
  --tasks $(aws ecs list-tasks --cluster qa-faxi-cluster --query 'taskArns[0]' --output text) \
  --region us-east-1

# View logs
aws logs tail /ecs/faxi-qa-backend --follow --region us-east-1
```

### Database Connection Issues
- Verify security group allows ECS → RDS
- Check database password in secrets
- Ensure tasks are in private subnets

### DNS Not Resolving
```bash
dig qa-fax.faxi.jp
# Wait 5-10 minutes for propagation
```

## Cost Estimate

**Monthly**: ~$127 (with backend only)
- VPC/NAT: $35
- RDS: $30
- Redis: $15
- ALB: $20
- ECS: $25
- S3/ECR: $2

## Next Steps

1. Add DNS records
2. Update secrets with real API keys
3. Deploy backend service (commands above)
4. Run migrations
5. Test: `curl http://qa-fax.faxi.jp/health`

---

**For detailed environment configuration**: See `docs/ENVIRONMENT_CONFIGURATION_GUIDE.md`  
**For general deployment info**: See `DEPLOYMENT.md` at project root
