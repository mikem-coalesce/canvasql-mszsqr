#!/bin/bash

# ERD Visualization Tool Rollback Script
# Version: 1.0.0
# Supports both Docker Compose and Kubernetes deployment strategies

set -euo pipefail

# Import shared functions from deploy.sh
source "$(dirname "$0")/deploy.sh"

# Global configuration
DOCKER_REGISTRY=${DOCKER_REGISTRY:-localhost:5000}
ENVIRONMENT=${ENVIRONMENT:-production}
DEPLOYMENT_TYPE=${DEPLOYMENT_TYPE:-docker-compose}
PREVIOUS_VERSION=${PREVIOUS_VERSION:-}
BACKUP_PATH=${BACKUP_PATH:-/backup}
LOG_PATH=${LOG_PATH:-/var/log/erd-tool}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}

# Create log directory if it doesn't exist
mkdir -p "$LOG_PATH"
LOG_FILE="$LOG_PATH/rollback-$(date +%Y%m%d-%H%M%S).log"

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling function
error() {
    log "ERROR" "$@"
    exit 1
}

# Check rollback prerequisites
check_rollback_prerequisites() {
    log "INFO" "Checking rollback prerequisites..."

    # Verify Docker installation
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed"
    fi

    # Check deployment type specific requirements
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            if ! command -v docker-compose >/dev/null 2>&1; then
                error "Docker Compose is not installed"
            fi
            ;;
        "kubernetes")
            if ! command -v kubectl >/dev/null 2>&1; then
                error "kubectl is not installed"
            fi
            ;;
        *)
            error "Unsupported deployment type: $DEPLOYMENT_TYPE"
            ;;
    esac

    # Verify previous version is specified
    if [ -z "$PREVIOUS_VERSION" ]; then
        error "PREVIOUS_VERSION must be specified for rollback"
    fi

    # Check backup directory exists
    if [ ! -d "$BACKUP_PATH" ]; then
        error "Backup directory does not exist: $BACKUP_PATH"
    fi

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Rollback Docker Compose deployment
rollback_docker_compose() {
    local previous_version=$1
    log "INFO" "Rolling back Docker Compose deployment to version: $previous_version"

    # Create backup of current state
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_dir="$BACKUP_PATH/$timestamp"
    mkdir -p "$backup_dir"

    # Backup current configuration and data
    log "INFO" "Creating backup of current state"
    docker-compose -f infrastructure/docker/docker-compose.prod.yml config > "$backup_dir/docker-compose.yml"
    
    # Stop current services
    log "INFO" "Stopping current services"
    docker-compose -f infrastructure/docker/docker-compose.prod.yml down --remove-orphans || {
        log "ERROR" "Failed to stop current services"
        return 1
    }

    # Pull previous version images
    log "INFO" "Pulling images for version: $previous_version"
    DOCKER_TAG="$previous_version" docker-compose -f infrastructure/docker/docker-compose.prod.yml pull || {
        log "ERROR" "Failed to pull previous version images"
        return 1
    }

    # Start services with previous version
    log "INFO" "Starting services with version: $previous_version"
    DOCKER_TAG="$previous_version" docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d || {
        log "ERROR" "Failed to start services with previous version"
        return 1
    }

    # Health checks
    log "INFO" "Performing health checks"
    local end_time=$((SECONDS + HEALTH_CHECK_TIMEOUT))
    while [ $SECONDS -lt $end_time ]; do
        if ! docker-compose -f infrastructure/docker/docker-compose.prod.yml ps | grep -q "unhealthy"; then
            log "INFO" "All services are healthy"
            return 0
        fi
        sleep 10
    done

    log "ERROR" "Health checks failed after timeout"
    return 1
}

# Rollback Kubernetes deployment
rollback_kubernetes() {
    local namespace=$1
    local previous_version=$2
    log "INFO" "Rolling back Kubernetes deployment in namespace: $namespace to version: $previous_version"

    # Verify cluster access
    if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
        error "Cannot access namespace: $namespace"
    }

    # Create backup of current state
    log "INFO" "Creating backup of current deployments"
    kubectl get deployments -n "$namespace" -o yaml > "$BACKUP_PATH/deployments-$(date +%Y%m%d-%H%M%S).yaml"

    # Rollback backend deployment
    log "INFO" "Rolling back backend deployment"
    if ! kubectl rollout undo deployment/backend-deployment -n "$namespace" --to-revision="$previous_version"; then
        log "ERROR" "Failed to rollback backend deployment"
        return 1
    fi

    # Rollback frontend deployment
    log "INFO" "Rolling back frontend deployment"
    if ! kubectl rollout undo deployment/frontend-deployment -n "$namespace" --to-revision="$previous_version"; then
        log "ERROR" "Failed to rollback frontend deployment"
        return 1
    }

    # Wait for rollback to complete
    log "INFO" "Waiting for rollback to complete"
    if ! kubectl rollout status deployment/backend-deployment -n "$namespace" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
        log "ERROR" "Backend rollback failed"
        return 1
    fi

    if ! kubectl rollout status deployment/frontend-deployment -n "$namespace" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
        log "ERROR" "Frontend rollback failed"
        return 1
    }

    log "INFO" "Kubernetes rollback completed successfully"
    return 0
}

# Restore data from backup
restore_data() {
    local backup_path=$1
    log "INFO" "Restoring data from backup: $backup_path"

    # Verify backup integrity
    if [ ! -f "$backup_path/sqlite.db" ] || [ ! -f "$backup_path/redis.rdb" ]; then
        error "Invalid or incomplete backup at: $backup_path"
    }

    # Stop dependent services
    log "INFO" "Stopping dependent services"
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            docker-compose -f infrastructure/docker/docker-compose.prod.yml stop backend websocket
            ;;
        "kubernetes")
            kubectl scale deployment backend-deployment websocket-deployment -n erd-visualization --replicas=0
            ;;
    esac

    # Restore SQLite database
    log "INFO" "Restoring SQLite database"
    cp "$backup_path/sqlite.db" /data/sqlite/sqlite.db || {
        log "ERROR" "Failed to restore SQLite database"
        return 1
    }

    # Restore Redis state
    log "INFO" "Restoring Redis state"
    cp "$backup_path/redis.rdb" /data/redis/dump.rdb || {
        log "ERROR" "Failed to restore Redis state"
        return 1
    }

    # Restart services
    log "INFO" "Restarting services"
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            docker-compose -f infrastructure/docker/docker-compose.prod.yml start backend websocket
            ;;
        "kubernetes")
            kubectl scale deployment backend-deployment websocket-deployment -n erd-visualization --replicas=2
            ;;
    esac

    log "INFO" "Data restoration completed successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting rollback process"

    # Check prerequisites
    check_rollback_prerequisites || exit 1

    # Execute rollback based on deployment type
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            rollback_docker_compose "$PREVIOUS_VERSION" || {
                log "ERROR" "Docker Compose rollback failed"
                exit 1
            }
            ;;
        "kubernetes")
            rollback_kubernetes "erd-visualization" "$PREVIOUS_VERSION" || {
                log "ERROR" "Kubernetes rollback failed"
                exit 1
            }
            ;;
        *)
            error "Unsupported deployment type: $DEPLOYMENT_TYPE"
            ;;
    esac

    log "INFO" "Rollback completed successfully"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi