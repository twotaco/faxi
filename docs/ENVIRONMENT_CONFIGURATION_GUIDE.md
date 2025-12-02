# Environment Configuration Guide

## Overview

Faxi uses different configuration strategies for different environments:
- **Local Development**: `.env` files in each app directory
- **QA/Production**: AWS Secrets Manager + ECS Task Definition

## File Structure

```
faxi/
├── backend/
│   ├── .env                    # Local development (gitignored)
│   ├── .env.example            # Template for local setup
│   └── .env.qa                 # QA reference (actual values in AWS)
├── admin-dashboard/
│   ├── .env.local              # Local development (gitignored)
│   └── .env.example            # Template
└── marketing-website/
    ├── .env.local              # Local development (gitignored)
    └── .env.example            # Template
```

## Configuration Sources by Environment

### Local Development

**Files Used**: `backend/.env`, `admin-dashboard/.env.local`, `marketing-website/.env.local`

**Contains**:
- Local database: `localhost:5432`
- Local Redis: `localhost:6379`
- Local MinIO: `localhost:9000`
- Test API keys
- `TEST_MODE=true`

**Example** (`backend/.env`):
```bash
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=faxi_dev
DATABASE_USER=faxi_user
DATABASE_PASSWORD=local_dev_password
REDIS_HOST=localhost
REDIS_PORT=6379
TEST_MODE=true
```

### QA Environment

**Configuration comes from 3 sources**:

#### 1. AWS Secrets Manager (Sensitive Data)
Stored in AWS, pulled at runtime by ECS:

```bash
# Database password
faxi/qa/database
  └─ password: "FaxiQA2024SecurePassword!"

# Telnyx API keys
faxi/qa/telnyx
  ├─ api_key: "YOUR_TEST_KEY"
  └─ public_key: "YOUR_PUBLIC_KEY"

# Gemini API key
faxi/qa/gemini
  └─ api_key: "YOUR_GEMINI_KEY"

# Stripe keys (test mode)
faxi/qa/stripe
  ├─ secret_key: "sk_test_..."
  └─ publishable_key: "pk_test_..."
```

**To update**:
```bash
aws secretsmanager update-secret \
  --secret-id faxi/qa/telnyx \
  --secret-string '{"api_key":"YOUR_REAL_KEY","public_key":"YOUR_PUBLIC_KEY"}' \
  --region us-east-1
```

#### 2. ECS Task Definition (Non-Sensitive Config)
Defined in the task definition JSON:

```json
"environment": [
  {"name": "NODE_ENV", "value": "production"},
  {"name": "DATABASE_HOST", "value": "qa-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com"},
  {"name": "DATABASE_PORT", "value": "5432"},
  {"name": "DATABASE_NAME", "value": "faxi_qa"},
  {"name": "REDIS_HOST", "value": "qa-faxi-redis.ub4jqi.0001.use1.cache.amazonaws.com"},
  {"name": "S3_BUCKET", "value": "qa-faxi-faxes"}
]
```

#### 3. Reference File (Documentation Only)
`backend/.env.qa` - Shows what values are needed, but actual values come from AWS:

```bash
# This file is for REFERENCE ONLY
# Actual values are in AWS Secrets Manager and ECS Task Definition

# Database Configuration (from ECS Task Definition)
DATABASE_HOST=qa-faxi-db.cazismkei51t.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=faxi_qa
DATABASE_USER=faxi_qa_user
# DATABASE_PASSWORD is in AWS Secrets Manager: faxi/qa/database

# Redis Configuration (from ECS Task Definition)
REDIS_HOST=qa-faxi-redis.ub4jqi.0001.use1.cache.amazonaws.com
REDIS_PORT=6379

# API Keys (from AWS Secrets Manager)
# TELNYX_API_KEY is in: faxi/qa/telnyx
# GEMINI_API_KEY is in: faxi/qa/gemini
# STRIPE_SECRET_KEY is in: faxi/qa/stripe
```

## Why This Separation?

### Security
- **Secrets Manager**: Encrypted at rest, access controlled by IAM, audit logged
- **Task Definition**: Public configuration, no sensitive data
- **Local .env**: Never committed to git (in .gitignore)

### Flexibility
- Change secrets without redeploying (just restart tasks)
- Different secrets per environment (dev/qa/staging/prod)
- Easy rotation of credentials

### Best Practices
- ✅ Secrets in AWS Secrets Manager
- ✅ Configuration in Task Definition
- ✅ Local development in .env files
- ❌ Never commit secrets to git
- ❌ Never put secrets in Task Definition environment variables

## Quick Reference

### What Goes Where?

| Type | Local Dev | QA/Production |
|------|-----------|---------------|
| **Database Password** | `.env` file | AWS Secrets Manager |
| **API Keys** | `.env` file | AWS Secrets Manager |
| **JWT Secrets** | `.env` file | AWS Secrets Manager |
| **Database Host** | `.env` file | ECS Task Definition |
| **Redis Host** | `.env` file | ECS Task Definition |
| **S3 Bucket** | `.env` file | ECS Task Definition |
| **Feature Flags** | `.env` file | ECS Task Definition |
| **Port Numbers** | `.env` file | ECS Task Definition |

## How ECS Accesses Secrets

When you define secrets in the task definition:

```json
"secrets": [
  {
    "name": "DATABASE_PASSWORD",
    "valueFrom": "arn:aws:secretsmanager:us-east-1:223882168768:secret:faxi/qa/database-mvT9Ay:password::"
  }
]
```

ECS automatically:
1. Pulls the value from Secrets Manager at task startup
2. Injects it as an environment variable `DATABASE_PASSWORD`
3. Your app reads it like any other env var: `process.env.DATABASE_PASSWORD`

## Common Workflows

### Setting Up Local Development

```bash
# 1. Copy example files
cp backend/.env.example backend/.env
cp admin-dashboard/.env.example admin-dashboard/.env.local
cp marketing-website/.env.example marketing-website/.env.local

# 2. Start local infrastructure
docker-compose up -d postgres redis minio

# 3. Update .env files with local values (already set in examples)

# 4. Run migrations
cd backend && npm run migrate

# 5. Start development
npm run dev
```

### Updating QA Secrets

```bash
# Update a secret
aws secretsmanager update-secret \
  --secret-id faxi/qa/telnyx \
  --secret-string '{"api_key":"NEW_KEY","public_key":"NEW_PUBLIC_KEY"}' \
  --region us-east-1

# Restart ECS tasks to pick up new values
aws ecs update-service \
  --cluster qa-faxi-cluster \
  --service faxi-qa-backend \
  --force-new-deployment \
  --region us-east-1
```

### Viewing Current Secrets

```bash
# List all QA secrets
aws secretsmanager list-secrets \
  --filters Key=name,Values=faxi/qa/ \
  --region us-east-1

# Get a specific secret value
aws secretsmanager get-secret-value \
  --secret-id faxi/qa/database \
  --region us-east-1 \
  --query SecretString \
  --output text
```

## Summary

**For Local Development**: Use `.env` files in each app directory

**For QA/Production Deployment**:
- Sensitive data → AWS Secrets Manager
- Configuration → ECS Task Definition
- Reference → `backend/.env.qa` (documentation only)

**Never**:
- ❌ Commit secrets to git
- ❌ Put secrets in Task Definition environment variables
- ❌ Share secrets in Slack/email

**Always**:
- ✅ Use AWS Secrets Manager for production secrets
- ✅ Rotate credentials regularly
- ✅ Use different secrets per environment
- ✅ Keep `.env` files in `.gitignore`

---

**Current QA Setup**:
- ✅ Secrets created in AWS Secrets Manager
- ✅ Task definition references secrets correctly
- ⏳ Need to update placeholder values with real API keys
- ✅ `backend/.env.qa` exists as reference
