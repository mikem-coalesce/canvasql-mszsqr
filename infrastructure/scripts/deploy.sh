#!/bin/bash

# ERD Visualization Tool Deployment Script
# Version: 1.0.0
# Supports both Docker Compose and Kubernetes deployment strategies

set -euo pipefail

# Global configuration
DOCKER_REGISTRY=${DOCKER_REGISTRY:-localhost:5000}
ENVIRONMENT=${ENVIRONMENT:-production}
DEPLOYMENT_TYPE=${DEPLOYMENT_TYPE:-docker-compose}
IMAGE_TAG=${IMAGE_TAG:-latest}
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=10
DEPLOYMENT_TIMEOUT=300
LOG_LEVEL=info

# Logging configuration
LOG_FILE="/var/log/erd-tool/deployment-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR" "$@"
    exit 1
}

# Check deployment prerequisites
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."

    # Check Docker installation
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed"
    fi

    # Check Docker Compose for compose deployments
    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ] && ! command -v docker-compose >/dev/null 2>&1; then
        error "Docker Compose is not installed"
    fi

    # Check kubectl for Kubernetes deployments
    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ] && ! command -v kubectl >/dev/null 2>&1; then
        error "kubectl is not installed"
    fi

    # Verify environment variables
    if [ -z "${DOCKER_REGISTRY}" ]; then
        error "DOCKER_REGISTRY environment variable is not set"
    fi

    # Check configuration files
    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ] && [ ! -f "infrastructure/docker/docker-compose.prod.yml" ]; then
        error "Docker Compose production configuration file not found"
    fi

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        for file in infrastructure/kubernetes/deployments/{backend,frontend}.yaml; do
            if [ ! -f "$file" ]; then
                error "Kubernetes deployment file not found: $file"
            fi
        done
    fi

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Deploy using Docker Compose
deploy_docker_compose() {
    log "INFO" "Starting Docker Compose deployment for environment: $ENVIRONMENT"

    # Pull latest images
    log "INFO" "Pulling latest container images"
    docker-compose -f infrastructure/docker/docker-compose.prod.yml pull || error "Failed to pull images"

    # Create deployment backup
    local backup_dir="/var/backups/erd-tool/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    docker-compose -f infrastructure/docker/docker-compose.prod.yml config > "$backup_dir/docker-compose.yml"

    # Start services
    log "INFO" "Starting services with Docker Compose"
    if ! docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d --remove-orphans; then
        log "ERROR" "Failed to start services"
        rollback "docker-compose" "$backup_dir"
        return 1
    fi

    # Health checks
    local retry_count=0
    while [ $retry_count -lt $HEALTH_CHECK_RETRIES ]; do
        if docker-compose -f infrastructure/docker/docker-compose.prod.yml ps | grep -q "unhealthy"; then
            log "WARN" "Health check failed, attempt $((retry_count + 1))/$HEALTH_CHECK_RETRIES"
            sleep $HEALTH_CHECK_INTERVAL
            ((retry_count++))
        else
            log "INFO" "All services are healthy"
            return 0
        fi
    done

    log "ERROR" "Health checks failed after $HEALTH_CHECK_RETRIES attempts"
    rollback "docker-compose" "$backup_dir"
    return 1
}

# Deploy using Kubernetes
deploy_kubernetes() {
    local namespace=$1
    log "INFO" "Starting Kubernetes deployment for environment: $ENVIRONMENT in namespace: $namespace"

    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

    # Apply ConfigMaps and Secrets
    log "INFO" "Applying ConfigMaps and Secrets"
    kubectl apply -f infrastructure/kubernetes/config/ -n "$namespace"

    # Deploy backend services
    log "INFO" "Deploying backend services"
    envsubst < infrastructure/kubernetes/deployments/backend.yaml | kubectl apply -f - -n "$namespace"

    # Deploy frontend services
    log "INFO" "Deploying frontend services"
    envsubst < infrastructure/kubernetes/deployments/frontend.yaml | kubectl apply -f - -n "$namespace"

    # Wait for deployments to be ready
    log "INFO" "Waiting for deployments to be ready"
    kubectl rollout status deployment/backend-deployment -n "$namespace" --timeout="${DEPLOYMENT_TIMEOUT}s" || {
        log "ERROR" "Backend deployment failed"
        rollback "kubernetes" "$namespace"
        return 1
    }

    kubectl rollout status deployment/frontend-deployment -n "$namespace" --timeout="${DEPLOYMENT_TIMEOUT}s" || {
        log "ERROR" "Frontend deployment failed"
        rollback "kubernetes" "$namespace"
        return 1
    }

    log "INFO" "Kubernetes deployment completed successfully"
    return 0
}

# Rollback deployment
rollback() {
    local deployment_type=$1
    local backup_reference=$2
    log "WARN" "Initiating rollback for $deployment_type deployment"

    case $deployment_type in
        "docker-compose")
            log "INFO" "Rolling back Docker Compose deployment"
            docker-compose -f "$backup_reference/docker-compose.yml" up -d --remove-orphans || {
                error "Failed to rollback Docker Compose deployment"
            }
            ;;
        "kubernetes")
            log "INFO" "Rolling back Kubernetes deployment"
            kubectl rollout undo deployment/backend-deployment -n "$backup_reference"
            kubectl rollout undo deployment/frontend-deployment -n "$backup_reference"
            ;;
        *)
            error "Unknown deployment type: $deployment_type"
            ;;
    esac

    log "INFO" "Rollback completed"
}

# Main deployment logic
main() {
    log "INFO" "Starting deployment process"
    
    # Check prerequisites
    check_prerequisites || exit 1

    # Execute deployment based on type
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            deploy_docker_compose || exit 1
            ;;
        "kubernetes")
            deploy_kubernetes "erd-visualization" || exit 1
            ;;
        *)
            error "Unknown deployment type: $DEPLOYMENT_TYPE"
            ;;
    esac

    log "INFO" "Deployment completed successfully"
}

# Execute main function
main "$@"