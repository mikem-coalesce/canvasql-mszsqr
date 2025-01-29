#!/bin/bash

# Backup script for ERD Tool application data
# Version: 1.0.0
# Requires: docker 20.x+, tar 1.x+, gzip 1.x+

# Global variables
BACKUP_DIR="/var/backups/erd-tool"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz"
LOG_FILE="/var/log/erd-tool/backup.log"
RETENTION_DAYS=30
CHECKSUM_FILE="${BACKUP_DIR}/checksums.txt"
TEMP_DIR="${BACKUP_DIR}/temp-${TIMESTAMP}"

# Error handling and cleanup
set -euo pipefail
trap cleanup ERR SIGINT SIGTERM

# Logging setup
exec 1> >(logger -s -t $(basename $0) -p local0.info) 2>&1

cleanup() {
    local exit_code=$?
    echo "Performing cleanup..."
    
    # Remove temporary files and directories
    [ -d "${TEMP_DIR}" ] && rm -rf "${TEMP_DIR}"
    
    # Release any held locks
    [ -f "/tmp/erd-backup.lock" ] && rm -f "/tmp/erd-backup.lock"
    
    # Log exit status
    if [ $exit_code -ne 0 ]; then
        echo "Backup failed with exit code: $exit_code"
        logger -p local0.err -t erd-backup "Backup failed with exit code: $exit_code"
    fi
    
    exit $exit_code
}

check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if running as root
    if [ "$(id -u)" != "0" ]; then
        echo "Error: This script must be run as root"
        return 1
    }
    
    # Check required tools
    for cmd in docker tar gzip sqlite3; do
        if ! command -v $cmd >/dev/null 2>&1; then
            echo "Error: Required command '$cmd' not found"
            return 1
        fi
    done
    
    # Check docker daemon
    if ! docker info >/dev/null 2>&1; then
        echo "Error: Docker daemon is not running or accessible"
        return 1
    }
    
    # Check directories
    for dir in "${BACKUP_DIR}" "$(dirname ${LOG_FILE})"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
        fi
        if [ ! -w "$dir" ]; then
            echo "Error: Directory '$dir' is not writable"
            return 1
        fi
    done
    
    # Check disk space (require at least 5GB free)
    local free_space=$(df -BG "${BACKUP_DIR}" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "${free_space}" -lt 5 ]; then
        echo "Error: Insufficient disk space (${free_space}GB free, 5GB required)"
        return 1
    }
    
    return 0
}

backup_sqlite() {
    local backup_path="$1"
    echo "Backing up SQLite database..."
    
    # Get SQLite container ID
    local container_id=$(docker ps -qf "name=erd-sqlite")
    if [ -z "$container_id" ]; then
        echo "Error: SQLite container not found"
        return 1
    }
    
    # Create database backup
    docker exec $container_id sqlite3 /data/erd.db ".backup '/tmp/backup.db'"
    docker cp $container_id:/tmp/backup.db "${backup_path}/erd.db"
    
    # Verify backup integrity
    if ! sqlite3 "${backup_path}/erd.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo "Error: SQLite backup integrity check failed"
        return 1
    }
    
    # Calculate and store checksum
    sha256sum "${backup_path}/erd.db" >> "${CHECKSUM_FILE}"
    
    # Compress backup
    gzip -9 "${backup_path}/erd.db"
    
    echo "SQLite backup completed successfully"
    return 0
}

backup_redis() {
    local backup_path="$1"
    echo "Backing up Redis data..."
    
    # Get Redis container ID
    local container_id=$(docker ps -qf "name=erd-redis")
    if [ -z "$container_id" ]; then
        echo "Error: Redis container not found"
        return 1
    }
    
    # Trigger Redis backup
    docker exec $container_id redis-cli SAVE
    
    # Copy dump file
    docker cp $container_id:/data/dump.rdb "${backup_path}/redis-dump.rdb"
    
    # Verify file exists and has size
    if [ ! -s "${backup_path}/redis-dump.rdb" ]; then
        echo "Error: Redis backup file is empty or missing"
        return 1
    }
    
    # Calculate and store checksum
    sha256sum "${backup_path}/redis-dump.rdb" >> "${CHECKSUM_FILE}"
    
    # Compress backup
    gzip -9 "${backup_path}/redis-dump.rdb"
    
    echo "Redis backup completed successfully"
    return 0
}

create_backup_archive() {
    local backup_path="$1"
    echo "Creating backup archive..."
    
    # Create metadata file
    cat > "${backup_path}/metadata.json" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "version": "1.0.0",
    "containers": {
        "redis": "$(docker ps -qf "name=erd-redis")",
        "sqlite": "$(docker ps -qf "name=erd-sqlite")"
    }
}
EOF
    
    # Create archive
    tar -czf "${BACKUP_FILE}" \
        --owner=root --group=root \
        -C "${backup_path}" .
    
    # Calculate and store archive checksum
    sha256sum "${BACKUP_FILE}" >> "${CHECKSUM_FILE}"
    
    # Create backup report
    local backup_size=$(du -h "${BACKUP_FILE}" | cut -f1)
    cat > "${BACKUP_DIR}/latest-backup.log" <<EOF
Backup completed at: $(date -Iseconds)
Backup file: ${BACKUP_FILE}
Size: ${backup_size}
Checksums: $(sha256sum "${BACKUP_FILE}")
EOF
    
    echo "Backup archive created successfully: ${BACKUP_FILE}"
    return 0
}

cleanup_old_backups() {
    echo "Cleaning up old backups..."
    
    # Find and remove old backup files
    find "${BACKUP_DIR}" -name "backup-*.tar.gz" -mtime +${RETENTION_DAYS} -type f | while read backup; do
        echo "Removing old backup: ${backup}"
        rm -f "${backup}"
        # Remove corresponding checksum entry
        sed -i "\|${backup}|d" "${CHECKSUM_FILE}"
    done
    
    # Clean up temporary files older than 1 day
    find "${BACKUP_DIR}" -name "temp-*" -mtime +1 -type d -exec rm -rf {} \;
    
    echo "Cleanup completed"
}

main() {
    echo "Starting backup process at $(date -Iseconds)"
    
    # Check prerequisites
    check_prerequisites || exit 1
    
    # Create temporary directory
    mkdir -p "${TEMP_DIR}"
    
    # Perform backups
    backup_sqlite "${TEMP_DIR}" || exit 1
    backup_redis "${TEMP_DIR}" || exit 1
    
    # Create final archive
    create_backup_archive "${TEMP_DIR}" || exit 1
    
    # Cleanup
    cleanup_old_backups
    
    echo "Backup process completed successfully at $(date -Iseconds)"
    return 0
}

# Execute main function
main