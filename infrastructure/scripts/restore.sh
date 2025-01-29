#!/bin/bash

# Collaborative ERD Visualization Tool - Data Restore Script
# Version: 1.0.0
# Dependencies:
# - docker (20.x+)
# - tar (1.x+)
# - gzip (1.x+)

set -euo pipefail

# Global variables
BACKUP_DIR="/var/backups/erd-tool"
RESTORE_TEMP="/tmp/erd-restore"
BACKUP_FILE="${1:-latest}"
LOG_FILE="/var/log/erd-tool/restore.log"
LOCK_FILE="/var/run/erd-restore.lock"

# Initialize logging
exec 1> >(logger -s -t $(basename $0)) 2>&1

# Trap handling for cleanup
trap cleanup ERR SIGINT SIGTERM SIGHUP

# Logging function
log() {
    local level=$1
    shift
    echo "{\"timestamp\":\"$(date -Iseconds)\",\"level\":\"${level}\",\"message\":\"$*\"}" | tee -a "$LOG_FILE"
}

# Root privilege check decorator
requires_root() {
    if [[ $EUID -ne 0 ]]; then
        log error "This script must be run as root"
        exit 1
    fi
}

# Check all prerequisites for restore operation
check_prerequisites() {
    log info "Checking prerequisites..."
    
    # Check for required tools
    for cmd in docker tar gzip; do
        if ! command -v $cmd &> /dev/null; then
            log error "Required command $cmd not found"
            return 1
        fi
    done

    # Verify Docker version
    local docker_version=$(docker version --format '{{.Server.Version}}')
    if [[ "${docker_version%%.*}" -lt 20 ]]; then
        log error "Docker version must be 20.x or higher. Found: $docker_version"
        return 1
    fi

    # Check backup file
    local backup_path="${BACKUP_DIR}/${BACKUP_FILE}"
    if [[ ! -f "$backup_path" ]]; then
        log error "Backup file not found: $backup_path"
        return 1
    fi

    # Check disk space
    local required_space=$(stat -f %z "$backup_path")
    local available_space=$(df -k /tmp | awk 'NR==2 {print $4}')
    if (( available_space < required_space )); then
        log error "Insufficient disk space for restore"
        return 1
    }

    # Check lock file
    if [[ -f "$LOCK_FILE" ]]; then
        log error "Another restore process is running"
        return 1
    }

    return 0
}

# Verify backup integrity and compatibility
verify_backup() {
    local backup_path=$1
    log info "Verifying backup integrity: $backup_path"

    # Create temporary workspace
    mkdir -p "$RESTORE_TEMP"
    cd "$RESTORE_TEMP"

    # Extract and verify metadata
    if ! tar tzf "$backup_path" &> /dev/null; then
        log error "Invalid backup archive"
        return 1
    }

    # Verify backup structure
    local required_files=("metadata.json" "sqlite/database.db" "redis/dump.rdb")
    for file in "${required_files[@]}"; do
        if ! tar tzf "$backup_path" | grep -q "$file"; then
            log error "Missing required file in backup: $file"
            return 1
        fi
    done

    # Verify checksums
    tar xzf "$backup_path" metadata.json
    if [[ ! -f metadata.json ]]; then
        log error "Failed to extract backup metadata"
        return 1
    fi

    return 0
}

# Stop all application services
stop_services() {
    log info "Stopping application services..."

    # Create service state snapshot
    docker-compose ps > "$RESTORE_TEMP/services_state.txt"

    # Stop services in correct order
    local services=("frontend" "api" "websocket" "redis" "sqlite")
    for service in "${services[@]}"; do
        log info "Stopping $service..."
        if ! docker-compose stop -t 30 "$service"; then
            log error "Failed to stop $service"
            return 1
        fi
    done

    # Verify all services are stopped
    if docker-compose ps --services --filter "status=running" | grep .; then
        log error "Some services are still running"
        return 1
    fi

    return 0
}

# Restore SQLite database
restore_sqlite() {
    local backup_path=$1
    log info "Restoring SQLite database..."

    # Create database backup
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local db_backup="$RESTORE_TEMP/database_${timestamp}.db"
    
    if [[ -f /var/lib/sqlite/database.db ]]; then
        cp /var/lib/sqlite/database.db "$db_backup"
    fi

    # Extract and restore database
    if ! tar xzf "$backup_path" -C "$RESTORE_TEMP" sqlite/database.db; then
        log error "Failed to extract SQLite database"
        return 1
    fi

    # Verify database integrity
    if ! sqlite3 "$RESTORE_TEMP/sqlite/database.db" "PRAGMA integrity_check;"; then
        log error "SQLite database integrity check failed"
        return 1
    }

    # Perform atomic replace
    if ! mv "$RESTORE_TEMP/sqlite/database.db" /var/lib/sqlite/database.db; then
        log error "Failed to restore SQLite database"
        return 1
    }

    return 0
}

# Restore Redis data
restore_redis() {
    local backup_path=$1
    log info "Restoring Redis data..."

    # Create Redis backup
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local redis_backup="$RESTORE_TEMP/dump_${timestamp}.rdb"
    
    if [[ -f /var/lib/redis/dump.rdb ]]; then
        cp /var/lib/redis/dump.rdb "$redis_backup"
    fi

    # Extract and restore Redis dump
    if ! tar xzf "$backup_path" -C "$RESTORE_TEMP" redis/dump.rdb; then
        log error "Failed to extract Redis dump"
        return 1
    }

    # Perform atomic replace
    if ! mv "$RESTORE_TEMP/redis/dump.rdb" /var/lib/redis/dump.rdb; then
        log error "Failed to restore Redis dump"
        return 1
    }

    return 0
}

# Start all application services
start_services() {
    log info "Starting application services..."

    # Start services in correct order
    local services=("sqlite" "redis" "api" "websocket" "frontend")
    for service in "${services[@]}"; do
        log info "Starting $service..."
        if ! docker-compose start "$service"; then
            log error "Failed to start $service"
            return 1
        fi

        # Wait for service health
        local retries=0
        while ! docker-compose ps "$service" | grep -q "Up"; do
            if (( retries++ > 30 )); then
                log error "$service failed to start"
                return 1
            fi
            sleep 1
        done
    done

    return 0
}

# Cleanup temporary files and lock
cleanup() {
    log info "Performing cleanup..."

    # Remove temporary files
    if [[ -d "$RESTORE_TEMP" ]]; then
        rm -rf "$RESTORE_TEMP"
    fi

    # Remove lock file
    if [[ -f "$LOCK_FILE" ]]; then
        rm -f "$LOCK_FILE"
    fi

    # Compress logs older than a day
    find /var/log/erd-tool -type f -name "restore-*.log" -mtime +1 -exec gzip {} \;
}

# Main restore function
main() {
    requires_root

    log info "Starting restore process..."
    
    # Create lock file
    touch "$LOCK_FILE"

    # Run restore process
    if ! check_prerequisites; then
        log error "Prerequisites check failed"
        cleanup
        exit 1
    fi

    local backup_path="${BACKUP_DIR}/${BACKUP_FILE}"
    
    if ! verify_backup "$backup_path"; then
        log error "Backup verification failed"
        cleanup
        exit 1
    fi

    if ! stop_services; then
        log error "Failed to stop services"
        cleanup
        exit 1
    fi

    if ! restore_sqlite "$backup_path"; then
        log error "Failed to restore SQLite database"
        cleanup
        exit 1
    fi

    if ! restore_redis "$backup_path"; then
        log error "Failed to restore Redis data"
        cleanup
        exit 1
    fi

    if ! start_services; then
        log error "Failed to start services"
        cleanup
        exit 1
    }

    log info "Restore completed successfully"
    cleanup
    exit 0
}

# Execute main function
main