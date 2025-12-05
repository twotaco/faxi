# Faxi System Disaster Recovery Runbook

## Overview

This document provides step-by-step procedures for recovering the Faxi system from various failure scenarios. The procedures are designed to minimize downtime and data loss while ensuring system integrity.

## Recovery Objectives

- **RTO (Recovery Time Objective)**: 1 hour for complete system recovery
- **RPO (Recovery Point Objective)**: 2 hours maximum data loss
- **Availability Target**: 99.9% uptime

## Prerequisites

### Required Access
- SSH access to production servers
- Database administrator credentials
- AWS console access (for S3 and other services)
- Docker/Kubernetes cluster access
- Backup storage access

### Required Tools
- `kubectl` (for Kubernetes deployments)
- `docker` and `docker-compose`
- `pg_dump` and `psql` (PostgreSQL tools)
- `redis-cli` (Redis tools)
- `aws` CLI (for S3 operations)

### Contact Information
- **On-call Engineer**: [Your contact info]
- **Database Administrator**: [DBA contact info]
- **Infrastructure Team**: [Infrastructure contact info]
- **Management Escalation**: [Management contact info]

## Failure Scenarios and Recovery Procedures

### Scenario 1: Database Failure

**Symptoms:**
- Application health checks failing
- Database connection errors in logs
- PostgreSQL service not responding

**Recovery Steps:**

1. **Assess the Situation**
   ```bash
   # Check database status
   kubectl get pods -l app=postgres
   docker-compose ps postgres
   
   # Check logs
   kubectl logs -l app=postgres --tail=100
   docker-compose logs postgres
   ```

2. **Stop Application Services**
   ```bash
   # Kubernetes
   kubectl scale deployment faxi-app --replicas=0
   
   # Docker Compose
   docker-compose stop faxi-app
   ```

3. **Attempt Database Recovery**
   ```bash
   # Try restarting database
   kubectl delete pod -l app=postgres
   docker-compose restart postgres
   
   # Wait for startup
   sleep 30
   
   # Test connection
   kubectl exec -it postgres-pod -- psql -U faxi_user -d faxi -c "SELECT 1;"
   ```

4. **If Database Cannot Start, Restore from Backup**
   ```bash
   # Find latest backup
   ls -la /var/backups/faxi/database/ | head -5
   
   # Or check S3
   aws s3 ls s3://faxi-backups/ --recursive | grep database | tail -5
   
   # Download backup if needed
   aws s3 cp s3://faxi-backups/faxi_db_20241118_020000.sql.gz ./
   
   # Stop database
   kubectl delete deployment postgres
   docker-compose stop postgres
   
   # Remove old data (CAUTION: This deletes all data)
   kubectl delete pvc postgres-data
   docker volume rm faxi_postgres_data
   
   # Start fresh database
   kubectl apply -f k8s/postgres.yaml
   docker-compose up -d postgres
   
   # Wait for database to be ready
   sleep 60
   
   # Restore backup
   gunzip -c faxi_db_20241118_020000.sql.gz | \
   kubectl exec -i postgres-pod -- psql -U faxi_user -d faxi
   
   # Or for Docker
   gunzip -c faxi_db_20241118_020000.sql.gz | \
   docker-compose exec -T postgres psql -U faxi_user -d faxi
   ```

5. **Verify Database Recovery**
   ```bash
   # Test basic queries
   kubectl exec -it postgres-pod -- psql -U faxi_user -d faxi -c "
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM fax_jobs;
   SELECT MAX(created_at) FROM fax_jobs;
   "
   ```

6. **Restart Application Services**
   ```bash
   # Kubernetes
   kubectl scale deployment faxi-app --replicas=3
   
   # Docker Compose
   docker-compose up -d faxi-app
   ```

7. **Verify System Recovery**
   ```bash
   # Check health endpoint
   curl http://localhost:4000/health
   
   # Check logs
   kubectl logs -l app=faxi-app --tail=50
   ```

**Estimated Recovery Time:** 30-45 minutes

### Scenario 2: Redis Cache Failure

**Symptoms:**
- Queue processing stopped
- Redis connection errors
- Background jobs not processing

**Recovery Steps:**

1. **Check Redis Status**
   ```bash
   kubectl get pods -l app=redis
   docker-compose ps redis
   
   kubectl logs -l app=redis --tail=100
   ```

2. **Attempt Redis Restart**
   ```bash
   kubectl delete pod -l app=redis
   docker-compose restart redis
   
   # Test connection
   kubectl exec -it redis-pod -- redis-cli ping
   ```

3. **If Redis Cannot Start, Restore from Backup**
   ```bash
   # Find latest Redis backup
   ls -la /var/backups/faxi/redis/ | head -5
   
   # Stop Redis
   kubectl delete deployment redis
   docker-compose stop redis
   
   # Remove old data
   kubectl delete pvc redis-data
   docker volume rm faxi_redis_data
   
   # Start fresh Redis
   kubectl apply -f k8s/redis.yaml
   docker-compose up -d redis
   
   # Restore backup (if RDB format)
   kubectl cp faxi_redis_20241118_020000.rdb redis-pod:/data/dump.rdb
   kubectl delete pod -l app=redis  # Restart to load RDB
   ```

4. **Verify Redis Recovery**
   ```bash
   kubectl exec -it redis-pod -- redis-cli info replication
   kubectl exec -it redis-pod -- redis-cli dbsize
   ```

5. **Restart Queue Workers**
   ```bash
   kubectl delete pods -l app=faxi-app  # Restart to reconnect to Redis
   docker-compose restart faxi-app
   ```

**Estimated Recovery Time:** 15-20 minutes

### Scenario 3: Complete System Failure

**Symptoms:**
- All services down
- Infrastructure failure
- Data center outage

**Recovery Steps:**

1. **Assess Infrastructure**
   ```bash
   # Check cluster status
   kubectl cluster-info
   kubectl get nodes
   
   # Check Docker daemon
   docker info
   ```

2. **Restore Infrastructure**
   ```bash
   # If using Kubernetes, ensure cluster is healthy
   kubectl get pods --all-namespaces
   
   # If using Docker Compose, ensure Docker is running
   systemctl status docker
   ```

3. **Restore from Full Backup**
   ```bash
   # Download latest full backup
   aws s3 cp s3://faxi-backups/faxi_full_20241118_010000.tar.gz ./
   
   # Extract backup
   mkdir -p /tmp/faxi-restore
   tar -xzf faxi_full_20241118_010000.tar.gz -C /tmp/faxi-restore
   
   # Check backup contents
   ls -la /tmp/faxi-restore/
   cat /tmp/faxi-restore/backup_metadata.json
   ```

4. **Restore Configuration**
   ```bash
   # Extract and restore configuration
   tar -xzf /tmp/faxi-restore/faxi_config_*.tar.gz
   
   # Verify environment files
   ls -la .env*
   ```

5. **Deploy Infrastructure**
   ```bash
   # Kubernetes deployment
   kubectl apply -f k8s/namespace.yaml
   kubectl apply -f k8s/secrets.yaml
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/postgres.yaml
   kubectl apply -f k8s/redis.yaml
   
   # Wait for databases to be ready
   kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s
   kubectl wait --for=condition=ready pod -l app=redis --timeout=300s
   
   # Or Docker Compose
   docker-compose up -d postgres redis
   sleep 60
   ```

6. **Restore Database**
   ```bash
   # Restore database backup
   gunzip -c /tmp/faxi-restore/faxi_db_*.sql.gz | \
   kubectl exec -i postgres-pod -- psql -U faxi_user -d faxi
   ```

7. **Restore Redis**
   ```bash
   # If RDB backup available
   kubectl cp /tmp/faxi-restore/faxi_redis_*.rdb redis-pod:/data/dump.rdb
   kubectl delete pod -l app=redis
   ```

8. **Deploy Application**
   ```bash
   # Kubernetes
   kubectl apply -f k8s/faxi-app.yaml
   kubectl wait --for=condition=ready pod -l app=faxi-app --timeout=300s
   
   # Docker Compose
   docker-compose up -d faxi-app
   ```

9. **Verify Complete Recovery**
   ```bash
   # Check all services
   kubectl get pods
   curl http://localhost:4000/health
   
   # Test fax processing
   curl -X POST http://localhost:4000/test/fax/receive \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

**Estimated Recovery Time:** 45-60 minutes

### Scenario 4: S3 Storage Failure

**Symptoms:**
- Fax image upload/download failures
- S3 connection errors
- Missing fax images

**Recovery Steps:**

1. **Check S3 Status**
   ```bash
   # Test S3 connectivity
   aws s3 ls s3://faxi-fax-images/
   
   # Check AWS service status
   curl -s https://status.aws.amazon.com/
   ```

2. **If S3 Service Issue**
   - Monitor AWS status page
   - Implement temporary local storage fallback
   - Notify users of potential delays

3. **If Bucket Access Issue**
   ```bash
   # Check IAM permissions
   aws sts get-caller-identity
   aws s3api get-bucket-location --bucket faxi-fax-images
   
   # Test with different credentials if needed
   aws configure list
   ```

4. **If Data Loss**
   ```bash
   # Check S3 versioning
   aws s3api list-object-versions --bucket faxi-fax-images --max-items 10
   
   # Restore from backup bucket if available
   aws s3 sync s3://faxi-backups/s3-backup/ s3://faxi-fax-images/
   ```

**Estimated Recovery Time:** 10-30 minutes (depending on AWS response)

## Post-Recovery Procedures

### 1. System Validation

After any recovery, perform these validation steps:

```bash
# Health check
curl http://localhost:4000/health

# Database connectivity
kubectl exec -it postgres-pod -- psql -U faxi_user -d faxi -c "SELECT COUNT(*) FROM users;"

# Redis connectivity
kubectl exec -it redis-pod -- redis-cli ping

# S3 connectivity
aws s3 ls s3://faxi-fax-images/ | head -5

# Queue processing
curl http://localhost:4000/monitoring/stats

# Test fax processing pipeline
curl -X POST http://localhost:4000/test/fax/receive \
  -H "Content-Type: application/json" \
  -d '{"from": "+1234567890", "test": true}'
```

### 2. Data Integrity Checks

```bash
# Check for data consistency
kubectl exec -it postgres-pod -- psql -U faxi_user -d faxi -c "
SELECT 
  (SELECT COUNT(*) FROM users) as user_count,
  (SELECT COUNT(*) FROM fax_jobs) as fax_count,
  (SELECT MAX(created_at) FROM fax_jobs) as latest_fax;
"

# Verify recent transactions
kubectl exec -it postgres-pod -- psql -U faxi_user -d faxi -c "
SELECT * FROM fax_jobs 
WHERE created_at > NOW() - INTERVAL '24 hours' 
ORDER BY created_at DESC 
LIMIT 10;
"
```

### 3. Performance Monitoring

```bash
# Monitor system performance for 30 minutes
watch -n 30 'curl -s http://localhost:4000/health | jq .'

# Check resource usage
kubectl top pods
docker stats --no-stream
```

### 4. Notification and Documentation

1. **Notify Stakeholders**
   - Send recovery completion notification
   - Update status page
   - Inform customer support team

2. **Document the Incident**
   - Record timeline of events
   - Document root cause
   - Update runbook if needed
   - Schedule post-mortem meeting

## Backup Verification

### Daily Backup Checks

```bash
# Verify latest backups exist
ls -la /var/backups/faxi/database/ | head -3
aws s3 ls s3://faxi-backups/ | tail -5

# Test backup integrity
./scripts/backup-system.sh --verify-latest

# Test restore procedure (on staging)
./scripts/backup-system.sh --test-restore
```

### Weekly Disaster Recovery Tests

1. **Staging Environment Recovery Test**
   - Perform full recovery on staging
   - Validate all functionality
   - Document any issues

2. **Backup Restoration Test**
   - Test database restore
   - Test Redis restore
   - Test configuration restore

## Emergency Contacts

### Escalation Matrix

| Severity | Contact | Response Time |
|----------|---------|---------------|
| Critical | On-call Engineer | 15 minutes |
| High | Team Lead | 30 minutes |
| Medium | Engineering Manager | 2 hours |
| Low | Next business day | 24 hours |

### External Vendors

- **AWS Support**: [Support case system]
- **Telnyx Support**: [Support contact]
- **Stripe Support**: [Support contact]

## Recovery Time Tracking

| Component | Target RTO | Actual RTO | Notes |
|-----------|------------|------------|-------|
| Database | 30 min | ___ min | |
| Redis | 15 min | ___ min | |
| Application | 10 min | ___ min | |
| Full System | 60 min | ___ min | |

## Lessons Learned Template

After each incident, document:

1. **What happened?**
2. **What was the root cause?**
3. **What went well during recovery?**
4. **What could be improved?**
5. **Action items for prevention**

---

**Document Version**: 1.0  
**Last Updated**: November 18, 2025  
**Next Review**: December 18, 2025