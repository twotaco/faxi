#!/bin/bash

# Setup automated backup cron jobs for Faxi system

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-system.sh"
CRON_USER="${CRON_USER:-root}"
LOG_DIR="${LOG_DIR:-/var/log/faxi}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Faxi backup cron jobs...${NC}"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Create cron jobs
CRON_JOBS="
# Faxi System Backup Jobs
# Daily database backup at 2:00 AM
0 2 * * * $BACKUP_SCRIPT database >> $LOG_DIR/backup-daily.log 2>&1

# Weekly full backup on Sundays at 1:00 AM
0 1 * * 0 $BACKUP_SCRIPT full >> $LOG_DIR/backup-weekly.log 2>&1

# Monthly cleanup on the 1st at 3:00 AM
0 3 1 * * find /var/backups/faxi -type f -mtime +30 -delete >> $LOG_DIR/backup-cleanup.log 2>&1

# Backup integrity check daily at 6:00 AM
0 6 * * * $SCRIPT_DIR/verify-backups.sh >> $LOG_DIR/backup-verify.log 2>&1
"

# Install cron jobs
if command -v crontab &> /dev/null; then
    # Add to existing crontab
    (crontab -l 2>/dev/null || true; echo "$CRON_JOBS") | crontab -
    echo -e "${GREEN}✓ Cron jobs installed for user: $(whoami)${NC}"
else
    # Create cron file for system cron
    echo "$CRON_JOBS" > /etc/cron.d/faxi-backups
    chmod 644 /etc/cron.d/faxi-backups
    echo -e "${GREEN}✓ Cron jobs installed in /etc/cron.d/faxi-backups${NC}"
fi

# Create backup verification script
cat > "$SCRIPT_DIR/verify-backups.sh" << 'EOF'
#!/bin/bash

# Verify backup integrity and send alerts if needed

BACKUP_DIR="${BACKUP_DIR:-/var/backups/faxi}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="/var/log/faxi/backup-verify.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if backups exist and are recent
check_backup_freshness() {
    local backup_type="$1"
    local max_age_hours="$2"
    local backup_dir="$BACKUP_DIR/$backup_type"
    
    if [ ! -d "$backup_dir" ]; then
        log "ERROR: Backup directory not found: $backup_dir"
        return 1
    fi
    
    local latest_backup=$(find "$backup_dir" -type f -name "*.gz" -mtime -1 | head -1)
    
    if [ -z "$latest_backup" ]; then
        log "ERROR: No recent $backup_type backup found (within $max_age_hours hours)"
        return 1
    fi
    
    # Test backup integrity
    if [[ "$latest_backup" == *.gz ]]; then
        if gzip -t "$latest_backup" 2>/dev/null; then
            log "SUCCESS: $backup_type backup verified: $latest_backup"
            return 0
        else
            log "ERROR: $backup_type backup integrity check failed: $latest_backup"
            return 1
        fi
    fi
    
    log "SUCCESS: $backup_type backup exists: $latest_backup"
    return 0
}

# Send alert email
send_alert() {
    local subject="$1"
    local message="$2"
    
    if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
        log "Alert sent to $ALERT_EMAIL"
    fi
}

# Main verification
main() {
    log "Starting backup verification"
    
    local errors=0
    
    # Check database backups (should be daily)
    if ! check_backup_freshness "database" 25; then
        ((errors++))
    fi
    
    # Check full backups (should be weekly)
    local latest_full=$(find "$BACKUP_DIR/full" -type f -name "*.gz" -mtime -8 2>/dev/null | head -1)
    if [ -z "$latest_full" ]; then
        log "ERROR: No recent full backup found (within 8 days)"
        ((errors++))
    else
        if gzip -t "$latest_full" 2>/dev/null; then
            log "SUCCESS: Full backup verified: $latest_full"
        else
            log "ERROR: Full backup integrity check failed: $latest_full"
            ((errors++))
        fi
    fi
    
    # Check disk space
    local backup_usage=$(df "$BACKUP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$backup_usage" -gt 85 ]; then
        log "WARNING: Backup directory is ${backup_usage}% full"
        send_alert "Faxi Backup Disk Space Warning" "Backup directory is ${backup_usage}% full. Consider cleaning up old backups."
    fi
    
    if [ $errors -eq 0 ]; then
        log "All backup verifications passed"
    else
        log "Backup verification completed with $errors errors"
        send_alert "Faxi Backup Verification Failed" "Backup verification failed with $errors errors. Check logs at $LOG_FILE"
    fi
}

main "$@"
EOF

chmod +x "$SCRIPT_DIR/verify-backups.sh"

# Create log rotation configuration
cat > /etc/logrotate.d/faxi-backups << 'EOF'
/var/log/faxi/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        # Restart rsyslog if needed
        /bin/kill -HUP `cat /var/run/rsyslogd.pid 2> /dev/null` 2> /dev/null || true
    endscript
}
EOF

echo -e "${GREEN}✓ Log rotation configured${NC}"

# Test backup script
if [ -x "$BACKUP_SCRIPT" ]; then
    echo -e "${YELLOW}Testing backup script...${NC}"
    if "$BACKUP_SCRIPT" --help > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backup script is executable and working${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Backup script test failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Warning: Backup script not found or not executable: $BACKUP_SCRIPT${NC}"
fi

# Display cron schedule
echo -e "\n${GREEN}Backup Schedule:${NC}"
echo "  Daily database backup: 2:00 AM"
echo "  Weekly full backup: Sunday 1:00 AM"
echo "  Monthly cleanup: 1st of month 3:00 AM"
echo "  Daily verification: 6:00 AM"

echo -e "\n${GREEN}Log files:${NC}"
echo "  Daily backups: $LOG_DIR/backup-daily.log"
echo "  Weekly backups: $LOG_DIR/backup-weekly.log"
echo "  Cleanup: $LOG_DIR/backup-cleanup.log"
echo "  Verification: $LOG_DIR/backup-verify.log"

echo -e "\n${GREEN}Setup completed successfully!${NC}"
echo -e "${YELLOW}Note: Ensure the following environment variables are set:${NC}"
echo "  - BACKUP_DIR (default: /var/backups/faxi)"
echo "  - S3_BACKUP_BUCKET (for S3 uploads)"
echo "  - ALERT_EMAIL (for notifications)"