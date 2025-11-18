# Faxi Core System - Deployment Guide

This guide covers deployment options for the Faxi Core System across different environments and platforms.

## Table of Contents

1. [Docker Deployment](#docker-deployment)
2. [Kubernetes Deployment](#kubernetes-deployment)
3. [AWS ECS Deployment](#aws-ecs-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Security Considerations](#security-considerations)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

## Docker Deployment

### Local Development

For local development with Docker Compose:

```bash
# Start development environment
./scripts/docker-dev.sh start

# Run database migrations
./scripts/docker-dev.sh migrate

# View logs
./scripts/docker-dev.sh logs

# Stop environment
./scripts/docker-dev.sh stop
```

### Production with Docker Compose

1. **Configure environment:**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with actual values
   ```

2. **Set up SSL certificates:**
   ```bash
   mkdir -p ssl
   # Place your SSL certificate files:
   # ssl/faxi.crt
   # ssl/faxi.key
   ```

3. **Deploy:**
   ```bash
   ./scripts/docker-prod.sh deploy
   ```

4. **Monitor:**
   ```bash
   ./scripts/docker-prod.sh status
   ./scripts/docker-prod.sh logs
   ```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Ingress controller (nginx recommended)
- Storage class for persistent volumes

### Quick Deployment

1. **Update secrets:**
   ```bash
   # Edit k8s/secrets.yaml with actual values
   # Replace all 'CHANGE_ME' placeholders
   vim k8s/secrets.yaml
   ```

2. **Deploy:**
   ```bash
   ./scripts/k8s-deploy.sh deploy
   ```

3. **Check status:**
   ```bash
   ./scripts/k8s-deploy.sh status
   ```

### Step-by-Step Deployment

1. **Deploy secrets:**
   ```bash
   ./scripts/k8s-deploy.sh secrets
   ```

2. **Deploy infrastructure:**
   ```bash
   ./scripts/k8s-deploy.sh infrastructure
   ```

3. **Run migrations:**
   ```bash
   ./scripts/k8s-deploy.sh migrate
   ```

4. **Deploy application:**
   ```bash
   ./scripts/k8s-deploy.sh app
   ```

5. **Deploy monitoring (optional):**
   ```bash
   ./scripts/k8s-deploy.sh monitoring
   ```

### Scaling

```bash
# Scale to 5 replicas
./scripts/k8s-deploy.sh scale 5

# Auto-scaling is configured via HPA
# Scales between 2-10 replicas based on CPU/memory
```

### Updates

```bash
# Update to new image
./scripts/k8s-deploy.sh update myregistry/faxi:v2.0

# Rollback if needed
./scripts/k8s-deploy.sh rollback
```

## AWS ECS Deployment

### Prerequisites

- AWS CLI configured
- Docker installed
- SSL certificate in AWS Certificate Manager
- Domain name configured

### Infrastructure Setup

1. **Create SSL certificate:**
   ```bash
   # Request certificate in AWS Certificate Manager
   aws acm request-certificate \
     --domain-name api.faxi.jp \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Update deployment script:**
   ```bash
   # Edit scripts/aws-deploy.sh
   # Update CERTIFICATE_ARN with your certificate ARN
   ```

### Deployment

1. **Full deployment:**
   ```bash
   ./scripts/aws-deploy.sh deploy
   ```

2. **Step-by-step:**
   ```bash
   # Create secrets
   ./scripts/aws-deploy.sh secrets
   
   # Build and push image
   ./scripts/aws-deploy.sh build
   
   # Deploy infrastructure
   ./scripts/aws-deploy.sh infrastructure
   
   # Deploy application
   ./scripts/aws-deploy.sh app
   ```

3. **Update secrets:**
   ```bash
   # Update secrets in AWS Secrets Manager console
   # or use AWS CLI:
   aws secretsmanager update-secret \
     --secret-id faxi/telnyx \
     --secret-string '{"api_key":"your_real_key","public_key":"your_real_public_key"}'
   ```

### Monitoring

```bash
# Check status
./scripts/aws-deploy.sh status

# View logs
./scripts/aws-deploy.sh logs
```

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_PASSWORD` | PostgreSQL password | `SecurePassword123!` |
| `TELNYX_API_KEY` | Telnyx API key | `KEY_xxx` |
| `TELNYX_PUBLIC_KEY` | Telnyx public key for webhooks | `xxx` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSyxxx` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_xxx` |
| `S3_ACCESS_KEY_ID` | S3 access key | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_MODE` | Enable test mode (bypasses Telnyx) | `false` |
| `LOG_LEVEL` | Logging level | `info` |
| `DATABASE_POOL_MAX` | Max database connections | `20` |
| `REDIS_PASSWORD` | Redis password | (none) |

### Test Mode Configuration

For development and testing:

```bash
# Enable test mode
TEST_MODE=true

# Access test UI
http://localhost:3000/test
```

Test mode features:
- Bypasses Telnyx integration
- Mock fax sender
- Test webhook endpoints
- Sample fax fixtures

## Security Considerations

### Network Security

- **Kubernetes**: Network policies restrict pod-to-pod communication
- **Docker**: Internal network isolation
- **AWS**: Security groups and VPC configuration

### Secrets Management

- **Kubernetes**: Kubernetes secrets with RBAC
- **Docker**: Environment files (not committed to git)
- **AWS**: AWS Secrets Manager integration

### Application Security

- Non-root container user (UID 1001)
- Read-only root filesystem where possible
- Security headers via reverse proxy
- Rate limiting on webhook endpoints

### SSL/TLS

- HTTPS enforced in production
- TLS 1.2+ only
- Strong cipher suites
- HSTS headers

## Monitoring and Logging

### Health Checks

All deployments include health checks:
- Application: `GET /health`
- Database: Connection test
- Redis: Ping test
- S3: Bucket access test

### Logging

- Structured JSON logs
- Log rotation (10MB, 3 files)
- Centralized collection in Kubernetes/AWS
- Debug level in development

### Metrics (Kubernetes)

With Prometheus operator:
- Application metrics via `/health` endpoint
- Resource usage (CPU, memory)
- Custom alerts for fax processing

### AWS CloudWatch

- ECS task metrics
- Application logs
- Custom dashboards
- Alarms for critical metrics

## Backup and Recovery

### Database Backups

**Docker:**
```bash
./scripts/docker-prod.sh backup
```

**Kubernetes:**
```bash
# Manual backup
kubectl exec postgres-xxx -n faxi -- pg_dump -U faxi_user faxi > backup.sql
```

**AWS:**
- Automated RDS backups (7 days retention)
- Point-in-time recovery available

### Redis Backups

- Automatic persistence enabled
- RDB snapshots included in backups
- ElastiCache automatic backups (AWS)

### Application Data

- Fax images stored in S3/object storage
- Lifecycle policies for automatic cleanup
- Cross-region replication (production)

## Troubleshooting

### Common Issues

1. **Database connection failures:**
   ```bash
   # Check database status
   kubectl get pods -n faxi -l app.kubernetes.io/name=postgres
   
   # Check logs
   kubectl logs -n faxi -l app.kubernetes.io/name=postgres
   ```

2. **Redis connection issues:**
   ```bash
   # Test Redis connectivity
   kubectl exec -it faxi-app-xxx -n faxi -- redis-cli -h redis-service ping
   ```

3. **Image pull errors:**
   ```bash
   # Check image exists
   docker pull your-registry/faxi-core-system:latest
   
   # Check registry credentials
   kubectl get secrets -n faxi
   ```

4. **Webhook failures:**
   ```bash
   # Check webhook logs
   kubectl logs -n faxi -l app.kubernetes.io/name=faxi-app | grep webhook
   
   # Test webhook endpoint
   curl -X POST http://localhost:3000/webhooks/telnyx/fax/received
   ```

### Debug Commands

**Docker:**
```bash
# Shell access
./scripts/docker-dev.sh shell

# Service logs
./scripts/docker-dev.sh logs postgres
```

**Kubernetes:**
```bash
# Shell access
./scripts/k8s-deploy.sh shell

# Pod logs
./scripts/k8s-deploy.sh logs faxi-app

# Describe pod
kubectl describe pod faxi-app-xxx -n faxi
```

**AWS:**
```bash
# ECS logs
./scripts/aws-deploy.sh logs

# Task details
aws ecs describe-tasks --cluster faxi-core-system-cluster --tasks task-id
```

### Performance Issues

1. **High memory usage:**
   - Check for memory leaks in logs
   - Increase memory limits
   - Scale horizontally

2. **Slow database queries:**
   - Check database logs
   - Monitor connection pool usage
   - Consider read replicas

3. **Queue backlog:**
   - Monitor Redis queue length
   - Scale worker processes
   - Check for processing errors

### Recovery Procedures

1. **Application failure:**
   ```bash
   # Restart application
   kubectl rollout restart deployment/faxi-app -n faxi
   ```

2. **Database corruption:**
   ```bash
   # Restore from backup
   ./scripts/docker-prod.sh restore ./backups/20241118_143000
   ```

3. **Complete disaster:**
   - Restore infrastructure from IaC
   - Restore database from latest backup
   - Redeploy application
   - Verify all services

## Support and Maintenance

### Regular Maintenance

- **Weekly**: Check logs for errors
- **Monthly**: Update dependencies
- **Quarterly**: Security patches
- **Annually**: Certificate renewal

### Monitoring Checklist

- [ ] Application health checks passing
- [ ] Database connections stable
- [ ] Redis queue processing normally
- [ ] Fax processing pipeline working
- [ ] External API integrations functional
- [ ] SSL certificates valid
- [ ] Backup procedures working

### Scaling Guidelines

- **CPU > 70%**: Scale horizontally
- **Memory > 80%**: Increase limits or scale
- **Queue length > 100**: Add workers
- **Database connections > 80%**: Increase pool or add replicas