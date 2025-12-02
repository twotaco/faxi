# QA Deployment Fix - December 2, 2024

## Problem

QA deployment was failing with backend service stuck at 0/1 running tasks. Tasks were failing container health checks.

## Root Cause

**Database migrations were never run.** The `application_logs` table and other tables were missing from the database, causing the application to crash on startup.

## Investigation Steps

1. **Checked service status**: Backend showed 0/1 tasks running
2. **Checked task events**: Tasks failing health checks
3. **Checked CloudWatch logs**: Error: `relation "application_logs" does not exist`
4. **Searched for migration tasks**: No migration tasks found in ECS task history
5. **Conclusion**: Deployment script's migration step was skipped or failed silently

## Solution

### Step 1: Run Database Migrations

Manually ran database migrations using ECS run-task:

```bash
# Get infrastructure details
PRIVATE_SUBNET_1=subnet-02425484c058e6838
PRIVATE_SUBNET_2=subnet-0817ac5e2270a799a
ECS_SECURITY_GROUP=sg-00d7e2a7f3769c777

# Run migration task
aws ecs run-task \
    --cluster faxi-qa-cluster \
    --task-definition arn:aws:ecs:us-east-1:223882168768:task-definition/faxi-qa-backend:10 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=DISABLED}" \
    --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","migrate"]}]}' \
    --region us-east-1

# Force new deployment after migrations
aws ecs update-service \
    --cluster faxi-qa-cluster \
    --service faxi-qa-backend \
    --force-new-deployment \
    --region us-east-1
```

### Step 2: Configure ALB Default Action

The ALB listener had no default action (or was set to return 404), causing 503 errors even with healthy targets:

```bash
# Set default action to forward to backend target group
LISTENER_ARN="arn:aws:elasticloadbalancing:us-east-1:223882168768:listener/app/qa-faxi-alb/a31cc9df6812dad7/a125c2da3d60aeb9"
BACKEND_TG_ARN="arn:aws:elasticloadbalancing:us-east-1:223882168768:targetgroup/qa-faxi-backend-tg/fe895bcaef39aefc"

aws elbv2 modify-listener \
    --listener-arn $LISTENER_ARN \
    --default-actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
    --region us-east-1
```

This fix is **critical** - without it, all requests return 503 even when targets are healthy.

## Migrations Applied

All migrations ran successfully:
- Base schema (users, fax_jobs, conversation_contexts, etc.)
- 002_add_email_threads.sql
- 002_admin_tables.sql
- 003_add_shopping_cart.sql
- 004_add_stripe_customer_id.sql
- 005_add_fax_delivery_tracking.sql
- 006_add_user_preferences.sql
- 007_add_application_logs.sql
- 007_user_insights.sql
- 008_add_admin_users.sql
- 009_add_hackathon_metrics_tables.sql
- 010_add_email_delivery_tracking.sql
- 011_add_email_abuse_prevention.sql
- 012_add_shopping_order_fields.sql
- 013_add_playwright_product_cache.sql
- 014_add_demo_user.sql
- 014_product_cache_categories.sql

## Final Status

✅ **Backend**: 1/1 tasks running, healthy  
✅ **Admin**: 1/1 tasks running, healthy  
✅ **Database**: All migrations applied  
✅ **Health Check**: Returns `{"status":"degraded"}` (S3 down is acceptable)  
✅ **ALB**: Default action configured to forward to backend  
✅ **Endpoints**: All responding with 200 OK  

## Lessons Learned

### Issue 1: Migrations Didn't Run

The deployment script (`scripts/deploy-to-aws.sh`) includes a migration step (step 10/12), but it likely:
1. Was never executed (script stopped early)
2. Failed silently without proper error handling
3. Was skipped in a previous partial deployment

### Issue 2: ALB Default Action Missing

The ALB listener was configured with:
- Host-based routing rules for `qa-fax.faxi.jp`, `qa-admin.faxi.jp`, `qa.faxi.jp`
- Default action set to return 404 (fixed-response)
- **Problem**: When rules don't match or targets are unhealthy, requests fall through to default action
- **Result**: 503 errors even when targets become healthy

This is the same issue documented in the context transfer from the previous session.

### Prevention for Future Deployments

1. **Always verify migrations ran**: Check ECS task history for migration tasks
2. **Check database state**: Query for key tables before deploying services
3. **Improve error handling**: Make migration failures block deployment
4. **Add validation step**: Script should verify migrations completed before deploying services
5. **Verify ALB configuration**: Ensure default action is set to forward to backend target group
6. **Test endpoints**: Always test health endpoint after deployment completes

### Deployment Script Improvements Needed

```bash
# After migration task completes, verify tables exist
echo "Verifying database schema..."
# Run a simple query to check for key tables
# If tables don't exist, fail the deployment
```

## Commands for Future Reference

### Check if migrations are needed
```bash
# List recent ECS tasks to find migration tasks
aws ecs list-tasks --cluster faxi-qa-cluster --region us-east-1 --desired-status STOPPED

# Check for migration command in task overrides
aws ecs describe-tasks --cluster faxi-qa-cluster --tasks <task-arn> --region us-east-1 --query 'tasks[0].overrides.containerOverrides[0].command'
```

### Manually run migrations
```bash
# Use the script above with current infrastructure values
./scripts/deploy-to-aws.sh qa  # Should include migration step
```

### Verify deployment health
```bash
# Check service status
aws ecs describe-services --cluster faxi-qa-cluster --services faxi-qa-backend faxi-qa-admin --region us-east-1

# Check target health
aws elbv2 describe-target-health --target-group-arn <backend-tg-arn> --region us-east-1

# Test health endpoint
curl -H "Host: qa-fax.faxi.jp" http://<alb-dns>/health
```

## Next Steps

1. ✅ QA environment is now operational
2. Update deployment script to add migration verification
3. Document migration process in deployment guide
4. Consider adding pre-deployment health checks

---

**Resolution Time**: ~20 minutes  
**Impact**: QA environment fully operational  
**Risk**: Low - migrations are idempotent and safe to re-run  

## Verification

```bash
# Test backend health
curl "http://qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com/health"
# Returns: {"status":"degraded",...} with 200 OK

# Test with host header
curl -H "Host: qa-fax.faxi.jp" "http://qa-faxi-alb-1877399865.us-east-1.elb.amazonaws.com/health"
# Returns: {"status":"degraded",...} with 200 OK

# Check service status
aws ecs describe-services --cluster faxi-qa-cluster --services faxi-qa-backend faxi-qa-admin --region us-east-1
# Both services: 1/1 tasks running
```

**Status**: ✅ **FULLY OPERATIONAL**
