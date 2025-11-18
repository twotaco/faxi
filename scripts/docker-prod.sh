#!/bin/bash

# Production Docker helper script

set -e

COMMAND=${1:-help}

case $COMMAND in
  "deploy")
    echo "Deploying Faxi to production..."
    
    # Check if .env.production exists
    if [ ! -f .env.production ]; then
      echo "Error: .env.production file not found!"
      echo "Copy .env.production.example to .env.production and configure it."
      exit 1
    fi
    
    # Build and deploy
    docker-compose -f docker-compose.prod.yml build
    docker-compose -f docker-compose.prod.yml up -d
    
    echo "Production deployment complete."
    echo "Check status with: $0 status"
    ;;
  "stop")
    echo "Stopping production environment..."
    docker-compose -f docker-compose.prod.yml down
    ;;
  "restart")
    SERVICE=${2:-faxi-app}
    echo "Restarting $SERVICE in production..."
    docker-compose -f docker-compose.prod.yml restart $SERVICE
    ;;
  "logs")
    SERVICE=${2:-faxi-app}
    docker-compose -f docker-compose.prod.yml logs -f $SERVICE
    ;;
  "status")
    docker-compose -f docker-compose.prod.yml ps
    ;;
  "scale")
    REPLICAS=${2:-2}
    echo "Scaling faxi-app to $REPLICAS replicas..."
    docker-compose -f docker-compose.prod.yml up -d --scale faxi-app=$REPLICAS
    ;;
  "backup")
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    echo "Creating database backup..."
    docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U faxi_user faxi > $BACKUP_DIR/database.sql
    
    echo "Creating Redis backup..."
    docker-compose -f docker-compose.prod.yml exec redis redis-cli BGSAVE
    docker cp $(docker-compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb $BACKUP_DIR/redis.rdb
    
    echo "Backup created in $BACKUP_DIR"
    ;;
  "restore")
    BACKUP_DIR=${2}
    if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
      echo "Error: Please specify a valid backup directory"
      echo "Usage: $0 restore <backup_directory>"
      exit 1
    fi
    
    echo "Restoring from $BACKUP_DIR..."
    
    if [ -f "$BACKUP_DIR/database.sql" ]; then
      echo "Restoring database..."
      docker-compose -f docker-compose.prod.yml exec -T postgres psql -U faxi_user faxi < $BACKUP_DIR/database.sql
    fi
    
    if [ -f "$BACKUP_DIR/redis.rdb" ]; then
      echo "Restoring Redis..."
      docker-compose -f docker-compose.prod.yml stop redis
      docker cp $BACKUP_DIR/redis.rdb $(docker-compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb
      docker-compose -f docker-compose.prod.yml start redis
    fi
    
    echo "Restore complete."
    ;;
  "update")
    echo "Updating production deployment..."
    
    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull
    
    # Rebuild application
    docker-compose -f docker-compose.prod.yml build faxi-app
    
    # Rolling update
    docker-compose -f docker-compose.prod.yml up -d --no-deps faxi-app
    
    echo "Update complete."
    ;;
  "health")
    echo "Checking service health..."
    curl -f http://localhost/health || echo "Health check failed"
    ;;
  "help")
    echo "Faxi Production Docker Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy to production"
    echo "  stop      Stop production environment"
    echo "  restart   Restart service (optionally specify service name)"
    echo "  logs      Show logs (optionally specify service name)"
    echo "  status    Show service status"
    echo "  scale     Scale faxi-app (specify number of replicas)"
    echo "  backup    Create database and Redis backup"
    echo "  restore   Restore from backup directory"
    echo "  update    Update production deployment"
    echo "  health    Check service health"
    echo "  help      Show this help message"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Run '$0 help' for available commands."
    exit 1
    ;;
esac