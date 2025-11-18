#!/bin/bash

# Kubernetes deployment script for Faxi Core System

set -e

COMMAND=${1:-help}
NAMESPACE="faxi"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warn "Namespace $NAMESPACE does not exist, it will be created"
    fi
    
    log_info "Prerequisites check passed"
}

deploy_secrets() {
    log_info "Deploying secrets..."
    
    # Check if secrets file has been customized
    if grep -q "CHANGE_ME" k8s/secrets.yaml; then
        log_error "Please update k8s/secrets.yaml with actual values before deploying"
        log_error "All 'CHANGE_ME' placeholders must be replaced with real secrets"
        exit 1
    fi
    
    kubectl apply -f k8s/secrets.yaml
    log_info "Secrets deployed"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure components..."
    
    # Apply in order
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/postgres.yaml
    kubectl apply -f k8s/redis.yaml
    
    log_info "Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres -n $NAMESPACE --timeout=300s
    
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n $NAMESPACE --timeout=300s
    
    log_info "Infrastructure components deployed"
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Delete existing migration job if it exists
    kubectl delete job faxi-migration -n $NAMESPACE --ignore-not-found=true
    
    # Run migration
    kubectl apply -f k8s/migration-job.yaml
    
    # Wait for migration to complete
    kubectl wait --for=condition=complete job/faxi-migration -n $NAMESPACE --timeout=600s
    
    log_info "Database migrations completed"
}

deploy_application() {
    log_info "Deploying application..."
    
    kubectl apply -f k8s/faxi-app.yaml
    kubectl apply -f k8s/ingress.yaml
    
    log_info "Waiting for application to be ready..."
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=faxi-app -n $NAMESPACE --timeout=300s
    
    log_info "Application deployed"
}

deploy_monitoring() {
    log_info "Deploying monitoring components..."
    
    # Check if Prometheus operator is installed
    if kubectl get crd servicemonitors.monitoring.coreos.com &> /dev/null; then
        kubectl apply -f k8s/monitoring.yaml
        log_info "Monitoring components deployed"
    else
        log_warn "Prometheus operator not found, skipping monitoring deployment"
        log_warn "Install Prometheus operator to enable monitoring"
    fi
}

deploy_network_policies() {
    log_info "Deploying network policies..."
    
    # Check if network policies are supported
    if kubectl api-resources | grep -q networkpolicies; then
        kubectl apply -f k8s/network-policy.yaml
        log_info "Network policies deployed"
    else
        log_warn "Network policies not supported by this cluster, skipping"
    fi
}

case $COMMAND in
    "deploy")
        log_info "Starting full deployment of Faxi Core System..."
        check_prerequisites
        deploy_secrets
        deploy_infrastructure
        run_migrations
        deploy_application
        deploy_monitoring
        deploy_network_policies
        
        log_info "Deployment completed successfully!"
        log_info "Application should be available at the configured ingress URL"
        ;;
    
    "secrets")
        check_prerequisites
        deploy_secrets
        ;;
    
    "infrastructure")
        check_prerequisites
        deploy_infrastructure
        ;;
    
    "migrate")
        check_prerequisites
        run_migrations
        ;;
    
    "app")
        check_prerequisites
        deploy_application
        ;;
    
    "monitoring")
        check_prerequisites
        deploy_monitoring
        ;;
    
    "network")
        check_prerequisites
        deploy_network_policies
        ;;
    
    "status")
        log_info "Checking deployment status..."
        kubectl get all -n $NAMESPACE
        echo ""
        log_info "Pod status:"
        kubectl get pods -n $NAMESPACE -o wide
        echo ""
        log_info "Service status:"
        kubectl get services -n $NAMESPACE
        echo ""
        log_info "Ingress status:"
        kubectl get ingress -n $NAMESPACE
        ;;
    
    "logs")
        SERVICE=${2:-faxi-app}
        log_info "Showing logs for $SERVICE..."
        kubectl logs -f -l app.kubernetes.io/name=$SERVICE -n $NAMESPACE
        ;;
    
    "shell")
        POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=faxi-app -o jsonpath='{.items[0].metadata.name}')
        if [ -z "$POD" ]; then
            log_error "No faxi-app pods found"
            exit 1
        fi
        log_info "Opening shell in pod $POD..."
        kubectl exec -it $POD -n $NAMESPACE -- sh
        ;;
    
    "scale")
        REPLICAS=${2:-3}
        log_info "Scaling faxi-app to $REPLICAS replicas..."
        kubectl scale deployment faxi-app --replicas=$REPLICAS -n $NAMESPACE
        kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=faxi-app -n $NAMESPACE --timeout=300s
        log_info "Scaling completed"
        ;;
    
    "restart")
        SERVICE=${2:-faxi-app}
        log_info "Restarting $SERVICE..."
        kubectl rollout restart deployment/$SERVICE -n $NAMESPACE
        kubectl rollout status deployment/$SERVICE -n $NAMESPACE
        log_info "Restart completed"
        ;;
    
    "update")
        IMAGE=${2}
        if [ -z "$IMAGE" ]; then
            log_error "Please specify image tag: $0 update <image:tag>"
            exit 1
        fi
        log_info "Updating application to image $IMAGE..."
        kubectl set image deployment/faxi-app faxi-app=$IMAGE -n $NAMESPACE
        kubectl rollout status deployment/faxi-app -n $NAMESPACE
        log_info "Update completed"
        ;;
    
    "rollback")
        log_info "Rolling back to previous version..."
        kubectl rollout undo deployment/faxi-app -n $NAMESPACE
        kubectl rollout status deployment/faxi-app -n $NAMESPACE
        log_info "Rollback completed"
        ;;
    
    "cleanup")
        log_warn "This will delete all Faxi resources from the cluster"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cleaning up resources..."
            kubectl delete namespace $NAMESPACE --ignore-not-found=true
            log_info "Cleanup completed"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
    
    "help")
        echo "Faxi Kubernetes Deployment Helper"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  deploy        Full deployment (secrets, infrastructure, app, monitoring)"
        echo "  secrets       Deploy secrets only"
        echo "  infrastructure Deploy database and Redis"
        echo "  migrate       Run database migrations"
        echo "  app           Deploy application only"
        echo "  monitoring    Deploy monitoring components"
        echo "  network       Deploy network policies"
        echo "  status        Show deployment status"
        echo "  logs          Show logs (optionally specify service name)"
        echo "  shell         Open shell in application pod"
        echo "  scale         Scale application (specify number of replicas)"
        echo "  restart       Restart service (optionally specify service name)"
        echo "  update        Update application image (specify image:tag)"
        echo "  rollback      Rollback to previous version"
        echo "  cleanup       Delete all resources (WARNING: destructive)"
        echo "  help          Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 deploy                    # Full deployment"
        echo "  $0 logs faxi-app            # Show app logs"
        echo "  $0 scale 5                  # Scale to 5 replicas"
        echo "  $0 update myregistry/faxi:v2 # Update to new image"
        ;;
    
    *)
        log_error "Unknown command: $COMMAND"
        echo "Run '$0 help' for available commands."
        exit 1
        ;;
esac