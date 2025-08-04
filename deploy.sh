#!/bin/bash
#
# WintEHR Unified Deployment Script
# Single script for all deployment scenarios
#
# Usage:
#   ./deploy.sh                    # Default: dev mode with 20 patients
#   ./deploy.sh prod              # Production deployment
#   ./deploy.sh dev --patients 50  # Dev with custom patient count
#   ./deploy.sh clean             # Clean and redeploy
#   ./deploy.sh stop              # Stop all services
#   ./deploy.sh status            # Check deployment status
#
# Replaces: fresh-deploy.sh, production-deploy-complete.sh, dev-start.sh,
#           master-deploy.sh, and various other deployment scripts

set -e

# ============================================================================
# Configuration & Setup
# ============================================================================

# Script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Default configuration
MODE="dev"                    # dev, prod, clean, stop, status
PATIENT_COUNT=20             # Number of patients to generate
SKIP_DATA=false             # Skip patient data generation
SKIP_BUILD=false            # Skip Docker build
VERBOSE=false               # Verbose output
DEPLOYMENT_LOG="deployment_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

log() {
    local message="$1"
    local color="${2:-$BLUE}"
    echo -e "${color}[$(date +'%H:%M:%S')]${NC} $message" | tee -a "$DEPLOYMENT_LOG"
}

success() { log "✅ $1" "$GREEN"; }
warning() { log "⚠️  $1" "$YELLOW"; }
error() { log "❌ $1" "$RED"; exit 1; }
info() { log "ℹ️  $1" "$CYAN"; }
section() {
    echo "" | tee -a "$DEPLOYMENT_LOG"
    log "===== $1 =====" "$PURPLE"
}

show_help() {
    cat << EOF
WintEHR Unified Deployment Script

USAGE:
    ./deploy.sh [MODE] [OPTIONS]

MODES:
    dev         Development deployment (default)
    prod        Production deployment
    clean       Clean deployment (removes all data)
    stop        Stop all services
    status      Check deployment status

OPTIONS:
    --patients N     Number of patients to generate (default: 20)
    --skip-data      Skip patient data generation
    --skip-build     Skip Docker build
    --verbose        Enable verbose output
    --help          Show this help message

EXAMPLES:
    ./deploy.sh                      # Quick dev deployment
    ./deploy.sh prod --patients 50   # Production with 50 patients
    ./deploy.sh clean                # Clean everything and redeploy
    ./deploy.sh status               # Check system status

FEATURES:
    • Single script for all deployment scenarios
    • Automatic environment detection and configuration
    • Built-in health checks and validation
    • Comprehensive error handling and recovery
    • Deployment logging and troubleshooting

EOF
}

# ============================================================================
# Argument Parsing
# ============================================================================

# Parse primary mode
if [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; then
    MODE="$1"
    shift
fi

# Parse options
while [[ $# -gt 0 ]]; do
    case $1 in
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --skip-data)
            SKIP_DATA=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# ============================================================================
# Prerequisites Check
# ============================================================================

check_prerequisites() {
    section "Checking Prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check required files
    local required_files=(
        "docker-compose.yml"
        "backend/requirements.txt"
        "frontend/package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            error "Required file missing: $file"
        fi
    done
    
    # Check ports
    for port in 3000 8000 5432; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            warning "Port $port is already in use"
        fi
    done
    
    success "Prerequisites check passed"
}

# ============================================================================
# Environment Setup
# ============================================================================

setup_environment() {
    section "Setting Up Environment"
    
    # Set mode-specific environment variables
    case "$MODE" in
        prod)
            export JWT_ENABLED=true
            export NODE_ENV=production
            export REACT_APP_ENVIRONMENT=production
            info "Production mode enabled"
            ;;
        *)
            export JWT_ENABLED=false
            export NODE_ENV=development
            export REACT_APP_ENVIRONMENT=development
            info "Development mode enabled"
            ;;
    esac
    
    # Common environment variables
    export DATABASE_URL="postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db"
    export REDIS_HOST=emr-redis
    export PYTHONUNBUFFERED=1
    export CDS_HOOKS_ENABLED=true
    
    success "Environment configured"
}

# ============================================================================
# Docker Operations
# ============================================================================

clean_deployment() {
    section "Cleaning Existing Deployment"
    
    log "Stopping all containers..."
    docker-compose down -v --remove-orphans || true
    
    log "Removing orphaned containers..."
    docker container prune -f || true
    
    log "Cleaning data directories..."
    rm -rf backend/data/synthea_backups/* 2>/dev/null || true
    rm -rf backend/data/generated_dicoms/* 2>/dev/null || true
    rm -rf backend/logs/* 2>/dev/null || true
    
    # Create required directories
    mkdir -p backend/data/{synthea_backups,generated_dicoms,dicom_uploads}
    mkdir -p backend/logs
    mkdir -p logs
    
    success "Cleanup completed"
}

build_containers() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        info "Skipping container build"
        return
    fi
    
    section "Building Containers"
    
    if [[ "$MODE" == "dev" ]] && [[ -f "docker-compose.dev.yml" ]]; then
        log "Building development containers..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --parallel
    else
        log "Building production containers..."
        docker-compose build --parallel
    fi
    
    success "Containers built"
}

start_core_services() {
    section "Starting Core Services"
    
    # Start PostgreSQL
    log "Starting PostgreSQL..."
    docker-compose up -d postgres
    
    # Wait for PostgreSQL
    local timeout=60
    while ! docker exec emr-postgres pg_isready -U emr_user -d emr_db &>/dev/null; do
        if [[ $timeout -eq 0 ]]; then
            error "PostgreSQL failed to start"
        fi
        sleep 1
        ((timeout--))
    done
    success "PostgreSQL is ready"
    
    # Start Redis
    log "Starting Redis..."
    docker-compose up -d redis
    success "Redis started"
    
    # Start backend
    log "Starting backend..."
    if [[ "$MODE" == "dev" ]] && [[ -f "docker-compose.dev.yml" ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
    else
        docker-compose up -d backend
    fi
    
    # Wait for backend
    timeout=120
    while ! curl -sf http://localhost:8000/api/health &>/dev/null; do
        if [[ $timeout -eq 0 ]]; then
            error "Backend failed to start"
        fi
        sleep 2
        ((timeout--))
    done
    success "Backend is ready"
}

# ============================================================================
# Database Initialization
# ============================================================================

initialize_database() {
    section "Initializing Database"
    
    # Run init script
    log "Creating database schema..."
    docker exec emr-backend python scripts/setup/init_database_definitive.py || {
        # Try alternative location
        docker exec emr-backend python scripts/init_database_definitive.py || \
        error "Database initialization failed"
    }
    
    # Apply schema fixes (from AWS deployment experience)
    log "Applying schema optimizations..."
    docker exec emr-postgres psql -U emr_user -d emr_db << 'EOF'
-- Add missing columns to references table
ALTER TABLE fhir.references 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS target_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS target_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS reference_path VARCHAR(255),
ADD COLUMN IF NOT EXISTS reference_value TEXT;

-- Add missing columns to search_params
ALTER TABLE fhir.search_params 
ADD COLUMN IF NOT EXISTS value_quantity_value NUMERIC,
ADD COLUMN IF NOT EXISTS value_quantity_unit VARCHAR(100),
ADD COLUMN IF NOT EXISTS value_quantity_system VARCHAR(500),
ADD COLUMN IF NOT EXISTS value_quantity_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS value_reference_normalized TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_search_params_reference 
ON fhir.search_params(param_name, value_reference);

CREATE INDEX IF NOT EXISTS idx_references_source 
ON fhir.references(source_resource_id);
EOF
    
    success "Database initialized"
}

# ============================================================================
# Data Import
# ============================================================================

import_patient_data() {
    if [[ "$SKIP_DATA" == "true" ]]; then
        warning "Skipping patient data import"
        return
    fi
    
    section "Importing Patient Data"
    
    log "Generating $PATIENT_COUNT patients..."
    docker exec emr-backend python scripts/active/synthea_master.py full \
        --count "$PATIENT_COUNT" \
        --validation-mode light || \
    error "Patient data generation failed"
    
    # Index search parameters
    log "Indexing search parameters..."
    if docker exec emr-backend test -f /app/scripts/consolidated_search_indexing.py; then
        docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index || \
        warning "Search indexing had issues"
    fi
    
    # Populate compartments
    log "Populating compartments..."
    if docker exec emr-backend test -f /app/scripts/populate_compartments.py; then
        docker exec emr-backend python scripts/populate_compartments.py || \
        warning "Compartment population had issues"
    fi
    
    # Fix CDS hooks
    log "Configuring CDS hooks..."
    if docker exec emr-backend test -f /app/scripts/fix_cds_hooks_enabled_column.py; then
        docker exec emr-backend python scripts/fix_cds_hooks_enabled_column.py || \
        warning "CDS hooks configuration had issues"
    fi
    
    success "Patient data imported"
}

# ============================================================================
# Frontend Setup
# ============================================================================

start_frontend() {
    section "Starting Frontend"
    
    log "Starting frontend service..."
    if [[ "$MODE" == "dev" ]] && [[ -f "docker-compose.dev.yml" ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend
    else
        docker-compose up -d frontend
    fi
    
    # For production, set up nginx
    if [[ "$MODE" == "prod" ]]; then
        setup_nginx
    fi
    
    success "Frontend started"
}

setup_nginx() {
    log "Setting up Nginx..."
    
    # Create nginx config
    cat > /tmp/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server emr-backend:8000;
    }

    upstream frontend {
        server emr-frontend:80;
    }

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        location ~ ^/(api|fhir|cds-services|ws) {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF

    # Start nginx container
    docker run -d \
        --name emr-nginx \
        --network emr-network \
        -p 80:80 \
        -v /tmp/nginx.conf:/etc/nginx/nginx.conf:ro \
        nginx:alpine || warning "Nginx already running"
    
    success "Nginx configured"
}

# ============================================================================
# Validation
# ============================================================================

validate_deployment() {
    section "Validating Deployment"
    
    local errors=0
    
    # Check health endpoints
    if curl -s http://localhost:8000/api/health | grep -q "healthy"; then
        success "Backend API: healthy"
    else
        warning "Backend API: not responding"
        ((errors++))
    fi
    
    # Check FHIR endpoint
    if curl -s http://localhost:8000/fhir/R4/metadata | grep -q "CapabilityStatement"; then
        success "FHIR API: working"
    else
        warning "FHIR API: not working"
        ((errors++))
    fi
    
    # Check patient count
    local patient_count=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient';" 2>/dev/null || echo "0")
    
    if [[ $patient_count -gt 0 ]]; then
        success "Database: $patient_count patients found"
    else
        warning "Database: no patients found"
        ((errors++))
    fi
    
    # Check frontend
    if [[ "$MODE" == "prod" ]]; then
        local frontend_port=80
    else
        local frontend_port=3000
    fi
    
    if curl -sf http://localhost:$frontend_port >/dev/null; then
        success "Frontend: accessible"
    else
        warning "Frontend: not accessible"
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        success "All validation checks passed"
        return 0
    else
        warning "$errors validation checks failed"
        return 1
    fi
}

# ============================================================================
# Status Check
# ============================================================================

check_status() {
    section "WintEHR Deployment Status"
    
    # Container status
    info "Container Status:"
    docker-compose ps
    
    echo ""
    
    # Service checks
    info "Service Health:"
    
    # Backend
    if curl -sf http://localhost:8000/api/health >/dev/null; then
        success "Backend API: ✅ Running"
    else
        warning "Backend API: ❌ Not responding"
    fi
    
    # FHIR
    if curl -sf http://localhost:8000/fhir/R4/metadata >/dev/null; then
        success "FHIR API: ✅ Working"
    else
        warning "FHIR API: ❌ Not working"
    fi
    
    # Frontend
    local frontend_port=$([[ "$MODE" == "prod" ]] && echo "80" || echo "3000")
    if curl -sf http://localhost:$frontend_port >/dev/null; then
        success "Frontend: ✅ Accessible on port $frontend_port"
    else
        warning "Frontend: ❌ Not accessible"
    fi
    
    # Database
    local patient_count=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient';" 2>/dev/null || echo "0")
    info "Database: $patient_count patients loaded"
    
    echo ""
    info "Access URLs:"
    info "  Frontend: http://localhost:$frontend_port"
    info "  Backend API: http://localhost:8000"
    info "  API Docs: http://localhost:8000/docs"
}

# ============================================================================
# Stop Services
# ============================================================================

stop_services() {
    section "Stopping Services"
    
    log "Stopping all containers..."
    docker-compose down
    
    # Stop nginx if running
    docker stop emr-nginx 2>/dev/null || true
    docker rm emr-nginx 2>/dev/null || true
    
    success "All services stopped"
}

# ============================================================================
# Display Summary
# ============================================================================

display_summary() {
    section "Deployment Complete!"
    
    local frontend_port=$([[ "$MODE" == "prod" ]] && echo "80" || echo "3000")
    
    echo ""
    info "Access URLs:"
    info "  Frontend: http://localhost:$frontend_port"
    info "  Backend API: http://localhost:8000"
    info "  API Docs: http://localhost:8000/docs"
    info "  FHIR API: http://localhost:8000/fhir/R4/"
    info "  CDS Hooks: http://localhost:8000/cds-services"
    
    echo ""
    info "Credentials:"
    info "  Username: demo    Password: password"
    info "  Username: nurse   Password: password"
    info "  Username: admin   Password: password"
    
    echo ""
    info "Useful Commands:"
    info "  View logs: docker-compose logs -f [service]"
    info "  Check status: ./deploy.sh status"
    info "  Stop services: ./deploy.sh stop"
    
    if [[ "$MODE" == "dev" ]]; then
        echo ""
        info "Development Features:"
        info "  ✓ Hot reload enabled"
        info "  ✓ JWT authentication disabled"
        info "  ✓ Debug mode enabled"
    fi
    
    echo ""
    success "Deployment log saved to: $DEPLOYMENT_LOG"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    case "$MODE" in
        stop)
            stop_services
            ;;
        status)
            check_status
            ;;
        clean)
            check_prerequisites
            clean_deployment
            setup_environment
            build_containers
            start_core_services
            initialize_database
            import_patient_data
            start_frontend
            validate_deployment
            display_summary
            ;;
        dev|prod)
            log "🏥 WintEHR Deployment - $MODE mode"
            check_prerequisites
            setup_environment
            build_containers
            start_core_services
            initialize_database
            import_patient_data
            start_frontend
            validate_deployment
            display_summary
            ;;
        *)
            error "Unknown mode: $MODE. Use --help for usage information."
            ;;
    esac
}

# Error handling
trap 'error "Deployment failed. Check $DEPLOYMENT_LOG for details."' ERR

# Run main
main "$@"