# Docker Deployment Guide

This document describes how to deploy the Faxi Core System using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers
- 10GB disk space for images and data

## Development Environment

### Quick Start

1. **Start the development environment:**
   ```bash
   ./scripts/docker-dev.sh start
   ```

2. **Access the services:**
   - Faxi API: http://localhost:3000
   - Test UI: http://localhost:3000/test
   - pgAdmin: http://localhost:5050 (admin@faxi.jp / admin)
   - Redis Commander: http://localhost:8081
   - MinIO Console: http://localhost:9001 (minioadmin / minioadmin)

3. **Run database migrations:**
   ```bash
   ./scripts/docker-dev.sh migrate
   ```

### Development Commands

```bash
# Start services
./scripts/docker-dev.sh start

# Stop services
./scripts/docker-dev.sh stop

# View logs
./scripts/docker-dev.sh logs
./scripts/docker-dev.sh logs postgres

# Open shell in app container
./scripts/docker-dev.sh shell

# Restart main application
./scripts/docker-dev.sh restart

# Reset environment (deletes all data)
./scripts/docker-dev.sh reset

# Build application image
./scripts/docker-dev.sh build

# Show service status
./scripts/docker-dev.sh status
```

### Development Features

- **Hot Reload**: Source code changes are automatically reflected
- **Database Management**: pgAdmin for PostgreSQL administration
- **Redis Management**: Redis Commander for queue inspection
- **Object Storage**: MinIO for S3-compatible storage
- **Test Mode**: Enabled by default, bypasses Telnyx integration

## Production Environment

### Setup

1. **Create production environment file:**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your actual values
   ```

2. **Configure SSL certificates:**
   ```bash
   mkdir -p ssl
   # Place your SSL certificate files:
   # ssl/faxi.crt
   # ssl/faxi.key
   ```

3. **Deploy to production:**
   ```bash
   ./scripts/docker-prod.sh deploy
   ```

### Production Commands

```bash
# Deploy/update production
./scripts/docker-prod.sh deploy

# Stop production services
./scripts/docker-prod.sh stop

# Scale application instances
./scripts/docker-prod.sh scale 4

# View logs
./scripts/docker-prod.sh logs
./scripts/docker-prod.sh logs nginx

# Create backup
./scripts/docker-prod.sh backup

# Restore from backup
./scripts/docker-prod.sh restore ./backups/20241118_143000

# Update deployment
./scripts/docker-prod.sh update

# Check health
./scripts/docker-prod.sh health

# Show status
./scripts/docker-prod.sh status
```

### Production Features

- **Load Balancing**: Nginx reverse proxy with multiple app instances
- **SSL Termination**: HTTPS with configurable certificates
- **Rate Limiting**: Protection against abuse
- **Health Checks**: Automated service monitoring
- **Resource Limits**: CPU and memory constraints
- **Logging**: Structured logs with rotation
- **Backup/Restore**: Database and Redis backup utilities

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_PASSWORD` | PostgreSQL password | `strong_password_123` |
| `TELNYX_API_KEY` | Telnyx API key | `KEY_xxx` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaSyxxx` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_xxx` |
| `S3_ACCESS_KEY_ID` | S3 access key | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_MODE` | Enable test mode | `false` |
| `LOG_LEVEL` | Logging level | `info` |
| `DATABASE_POOL_MAX` | Max DB connections | `10` |
| `REDIS_PASSWORD` | Redis password | (none) |

## Storage and Persistence

### Volumes

- **postgres_data**: PostgreSQL database files
- **redis_data**: Redis persistence files
- **app_data**: Application uploads and logs (production)
- **minio_data**: MinIO object storage (development)

### Backup Strategy

Production backups include:
- PostgreSQL database dump
- Redis RDB snapshot
- Application logs (via Docker logging)

Backups are stored in `./backups/` with timestamp directories.

## Networking

### Development Ports

- 3000: Faxi API
- 5432: PostgreSQL
- 6379: Redis
- 9000: MinIO API
- 9001: MinIO Console
- 5050: pgAdmin
- 8081: Redis Commander

### Production Ports

- 80: HTTP (redirects to HTTPS)
- 443: HTTPS (Nginx + Faxi API)

## Monitoring and Health Checks

### Health Endpoints

- `GET /health`: Application health check
- Returns service status for all dependencies

### Docker Health Checks

All services include Docker health checks:
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **MinIO**: HTTP health endpoint
- **Faxi App**: HTTP health endpoint

### Logging

Production logging configuration:
- JSON format for structured logs
- 10MB max file size
- 3 file rotation
- Centralized via Docker logging driver

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 5432, 6379 are available
2. **Memory issues**: Increase Docker memory limit to 4GB+
3. **Permission errors**: Check file permissions on volumes
4. **SSL errors**: Verify certificate files in `ssl/` directory

### Debug Commands

```bash
# Check container logs
docker-compose logs faxi-app

# Inspect container
docker-compose exec faxi-app sh

# Check resource usage
docker stats

# Verify network connectivity
docker-compose exec faxi-app ping postgres
```

### Reset Development Environment

```bash
# Complete reset (deletes all data)
./scripts/docker-dev.sh reset

# Or manually:
docker-compose down -v
docker system prune -f
docker-compose up -d
```

## Security Considerations

### Development

- Default passwords are used (change for any external access)
- Test mode bypasses authentication
- Services exposed on localhost only

### Production

- Strong passwords required in `.env.production`
- SSL/TLS encryption enforced
- Rate limiting enabled
- Non-root container user
- Resource limits enforced
- Security headers configured

## Performance Tuning

### Database

- Connection pooling configured
- Appropriate resource limits
- Regular backup schedule

### Redis

- Memory limits with LRU eviction
- Persistence enabled
- Connection pooling

### Application

- Multi-instance deployment
- Resource limits and reservations
- Health check optimization

## Scaling

### Horizontal Scaling

```bash
# Scale to 4 instances
./scripts/docker-prod.sh scale 4
```

### Vertical Scaling

Modify resource limits in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
```

### Database Scaling

For high load, consider:
- Read replicas
- Connection pooling (PgBouncer)
- External managed database service