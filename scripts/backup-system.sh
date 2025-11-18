#!/bin/bash

# Faxi System Backup Script
# This script creates backups of the Faxi system components

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/faxi}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-faxi-backups}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

# Check dependencies
check_dependencies() {
    local deps=("pg_dump" "redis-cli" "aws" "gzip" "tar")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency '$dep' is not installed"
            exit 1
        fi
    done
    
    success "All dependencies are available"
}

# Create backup directory
setup_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/redis"
    mkdir -p "$BACKUP_DIR/config"
    mkdir -p "$BACKUP_DIR/full"
    
    success "Backup directories created"
}

# Database backup
backup_database() {
    log "Starting database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/database/faxi_db_$timestamp.sql.gz"
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Create database backup
    PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
        -h "$DATABASE_HOST" \
        -p "$DATABASE_PORT" \
        -U "$DATABASE_USER" \
        -d "$DATABASE_NAME" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create | gzip > "$backup_file"
    
    if [ $? -eq 0 ]; then
        success "Database backup created: $backup_file"
        echo "$backup_file"
    else
        error "Database backup failed"
        return 1
    fi
}

# Redis backup
backup_redis() {
    log "Starting Redis backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/redis/faxi_redis_$timestamp.rdb.gz"
    
    # Load environment variables
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Trigger Redis BGSAVE
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} BGSAVE
    
    # Wait for background save to complete
    while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} LASTSAVE)" = "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} LASTSAVE)" ]; do
        sleep 1
    done
    
    # Copy and compress RDB file
    local redis_data_dir="${REDIS_DATA_DIR:-/var/lib/redis}"
    if [ -f "$redis_data_dir/dump.rdb" ]; then
        gzip -c "$redis_data_dir/dump.rdb" > "$backup_file"
        success "Redis backup created: $backup_file"
        echo "$backup_file"
    else
        warning "Redis RDB file not found, creating JSON dump instead"
        
        # Fallback: create JSON dump of all keys
        local json_file="$BACKUP_DIR/redis/faxi_redis_$timestamp.json.gz"
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} --json KEYS '*' | \
        while read -r key; do
            echo "$key: $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} DUMP "$key")"
        done | gzip > "$json_file"
        
        success "Redis JSON backup created: $json_file"
        echo "$json_file"
    fi
}

# Configuration backup
backup_config() {
    log "Starting configuration backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/config/faxi_config_$timestamp.tar.gz"
    
    # List of configuration files and directories to backup
    local config_items=(
        ".env"
        ".env.production"
        "package.json"
        "package-lock.json"
        "tsconfig.json"
        "docker-compose.yml"
        "docker-compose.prod.yml"
        "k8s/"
        "aws/"
        "nginx.conf"
        "nginx-production.conf"
        "scripts/"
        "docs/"
    )
    
    # Create list of existing items
    local existing_items=()
    for item in "${config_items[@]}"; do
        if [ -e "$item" ]; then
            existing_items+=("$item")
        fi
    done
    
    if [ ${#existing_items[@]} -gt 0 ]; then
        tar -czf "$backup_file" "${existing_items[@]}"
        success "Configuration backup created: $backup_file"
        echo "$backup_file"
    else
        warning "No configuration files found to backup"
        return 1
    fi
}

# Full system backup
backup_full() {
    log "Starting full system backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local temp_dir="$BACKUP_DIR/temp_$timestamp"
    local backup_file="$BACKUP_DIR/full/faxi_full_$timestamp.tar.gz"
    
    mkdir -p "$temp_dir"
    
    # Create individual backups in temp directory
    local db_backup=$(backup_database)
    local redis_backup=$(backup_redis)
    local config_backup=$(backup_config)
    
    # Copy backups to temp directory
    [ -n "$db_backup" ] && cp "$db_backup" "$temp_dir/"
    [ -n "$redis_backup" ] && cp "$redis_backup" "$temp_dir/"
    [ -n "$config_backup" ] && cp "$config_backup" "$temp_dir/"
    
    # Create metadata file
    cat > "$temp_dir/backup_metadata.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "type": "full_system",
    "components": {
        "database": "$(basename "$db_backup")",
        "redis": "$(basename "$redis_backup")",
        "config": "$(basename "$config_backup")"
    },
    "system_info": {
        "hostname": "$(hostname)",
        "os": "$(uname -a)",
        "faxi_version": "1.0.0"
    }
}
EOF
    
    # Create compressed archive
    tar -czf "$backup_file" -C "$temp_dir" .
    
    # Clean up temp directory
    rm -rf "$temp_dir"
    
    success "Full system backup created: $backup_file"
    echo "$backup_file"
}

# Upload backup to S3
upload_to_s3() {
    local backup_file="$1"
    local s3_key="$(basename "$backup_file")"
    
    if [ -n "$S3_BACKUP_BUCKET" ] && command -v aws &> /dev/null; then
        log "Uploading backup to S3: s3://$S3_BACKUP_BUCKET/$s3_key"
        
        aws s3 cp "$backup_file" "s3://$S3_BACKUP_BUCKET/$s3_key" \
            --storage-class STANDARD_IA \
            --metadata "created=$(date -Iseconds),type=backup"
        
        if [ $? -eq 0 ]; then
            success "Backup uploaded to S3"
        else
            error "Failed to upload backup to S3"
        fi
    else
        warning "S3 upload skipped (bucket not configured or AWS CLI not available)"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local dirs=("database" "redis" "config" "full")
    local deleted_count=0
    
    for dir in "${dirs[@]}"; do
        local backup_dir="$BACKUP_DIR/$dir"
        if [ -d "$backup_dir" ]; then
            local old_files=$(find "$backup_dir" -type f -mtime +$RETENTION_DAYS)
            if [ -n "$old_files" ]; then
                echo "$old_files" | while read -r file; do
                    rm -f "$file"
                    log "Deleted old backup: $file"
                    ((deleted_count++))
                done
            fi
        fi
    done
    
    success "Cleanup completed. Deleted $deleted_count old backup files"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$NOTIFICATION_EMAIL" ] && command -v mail &> /dev/null; then
        local subject="Faxi Backup $status - $(hostname)"
        echo "$message" | mail -s "$subject" "$NOTIFICATION_EMAIL"
        log "Notification sent to $NOTIFICATION_EMAIL"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity: $backup_file"
    
    # Test gzip integrity
    if [[ "$backup_file" == *.gz ]]; then
        gzip -t "$backup_file"
        if [ $? -eq 0 ]; then
            success "Backup integrity verified"
            return 0
        else
            error "Backup integrity check failed"
            return 1
        fi
    fi
    
    # Test tar integrity
    if [[ "$backup_file" == *.tar.gz ]]; then
        tar -tzf "$backup_file" > /dev/null
        if [ $? -eq 0 ]; then
            success "Backup archive integrity verified"
            return 0
        else
            error "Backup archive integrity check failed"
            return 1
        fi
    fi
    
    success "Backup file exists and is readable"
    return 0
}

# Main backup function
main() {
    local backup_type="${1:-full}"
    local start_time=$(date +%s)
    
    log "Starting Faxi system backup (type: $backup_type)"
    
    # Check dependencies and setup
    check_dependencies
    setup_backup_dir
    
    local backup_file=""
    local success_message=""
    
    case "$backup_type" in
        "database")
            backup_file=$(backup_database)
            success_message="Database backup completed successfully"
            ;;
        "redis")
            backup_file=$(backup_redis)
            success_message="Redis backup completed successfully"
            ;;
        "config")
            backup_file=$(backup_config)
            success_message="Configuration backup completed successfully"
            ;;
        "full")
            backup_file=$(backup_full)
            success_message="Full system backup completed successfully"
            ;;
        *)
            error "Invalid backup type: $backup_type"
            echo "Usage: $0 [database|redis|config|full]"
            exit 1
            ;;
    esac
    
    if [ -n "$backup_file" ]; then
        # Verify backup integrity
        if verify_backup "$backup_file"; then
            # Upload to S3 if configured
            upload_to_s3 "$backup_file"
            
            # Calculate backup size and duration
            local backup_size=$(du -h "$backup_file" | cut -f1)
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            success "$success_message"
            log "Backup file: $backup_file"
            log "Backup size: $backup_size"
            log "Duration: ${duration}s"
            
            # Send success notification
            send_notification "SUCCESS" "$success_message
Backup file: $backup_file
Backup size: $backup_size
Duration: ${duration}s"
        else
            error "Backup verification failed"
            send_notification "FAILED" "Backup verification failed for $backup_file"
            exit 1
        fi
    else
        error "Backup creation failed"
        send_notification "FAILED" "Backup creation failed for type: $backup_type"
        exit 1
    fi
    
    # Clean up old backups
    cleanup_old_backups
    
    success "Backup process completed successfully"
}

# Handle script arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Faxi System Backup Script"
    echo ""
    echo "Usage: $0 [backup_type]"
    echo ""
    echo "Backup types:"
    echo "  database  - Backup PostgreSQL database only"
    echo "  redis     - Backup Redis data only"
    echo "  config    - Backup configuration files only"
    echo "  full      - Full system backup (default)"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_DIR           - Backup directory (default: /var/backups/faxi)"
    echo "  RETENTION_DAYS       - Days to keep backups (default: 30)"
    echo "  S3_BACKUP_BUCKET     - S3 bucket for backup storage"
    echo "  NOTIFICATION_EMAIL   - Email for backup notifications"
    echo ""
    exit 0
fi

# Run main function
main "$@"