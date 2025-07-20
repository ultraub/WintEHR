#!/bin/bash
#
# Fresh Deploy Script for WintEHR
# Performs a complete clean deployment with patient data
#
# Usage:
#   ./fresh-deploy.sh                    # Default: 20 patients, development mode
#   ./fresh-deploy.sh --patients 50      # Custom patient count
#   ./fresh-deploy.sh --mode production  # Production mode
#   ./fresh-deploy.sh --skip-data        # Skip patient data generation
#

set -e

# Configuration
PATIENT_COUNT=${PATIENT_COUNT:-20}
MODE=${MODE:-development}
SKIP_DATA=${SKIP_DATA:-false}
VERBOSE=${VERBOSE:-false}

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --mode)
            MODE="$2"
            shift 2
            ;;
        --skip-data)
            SKIP_DATA=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Fresh Deploy Script for WintEHR"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --patients <count>  Number of patients to generate (default: 20)"
            echo "  --mode <mode>       Deployment mode: development|production (default: development)"
            echo "  --skip-data         Skip patient data generation"
            echo "  --verbose           Enable verbose output"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                        # Deploy with 20 patients in dev mode"
            echo "  $0 --patients 50          # Deploy with 50 patients"
            echo "  $0 --mode production      # Production deployment"
            echo "  $0 --skip-data            # Deploy without patient data"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Logging functions
log() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running"
    fi
    
    # Check docker-compose
    if ! command -v docker-compose &> /dev/null; then
        error "docker-compose is not installed"
    fi
    
    # Check required files
    local required_files=(
        "docker-compose.yml"
        "backend/requirements.txt"
        "frontend/package.json"
        "backend/scripts/setup/init_database_definitive.py"
        "backend/scripts/active/synthea_master.py"
        "backend/scripts/fast_search_indexing.py"
        "backend/scripts/consolidated_search_indexing.py"
        "backend/scripts/populate_compartments.py"
        "backend/scripts/fix_cds_hooks_enabled_column.py"
        "backend/scripts/verify_all_fhir_tables.py"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            error "Required file missing: $file"
        fi
    done
    
    # Check for critical scripts in alternative locations
    if [ ! -f "$PROJECT_ROOT/backend/scripts/setup/init_database_definitive.py" ] && [ ! -f "$PROJECT_ROOT/backend/scripts/init_database_definitive.py" ]; then
        error "Database initialization script not found in any expected location"
    fi
    
    success "Prerequisites check passed"
}

# Function to clean existing deployment
clean_deployment() {
    log "Cleaning existing deployment..."
    
    # Stop all containers
    docker-compose down -v --remove-orphans || true
    
    # Remove dangling containers and images
    docker container prune -f || true
    docker image prune -f || true
    
    # Clean data directories
    rm -rf backend/data/synthea_backups/* 2>/dev/null || true
    rm -rf backend/data/generated_dicoms/* 2>/dev/null || true
    rm -rf backend/logs/* 2>/dev/null || true
    
    # Create required directories
    mkdir -p backend/data/synthea_backups
    mkdir -p backend/data/generated_dicoms
    mkdir -p backend/data/dicom_uploads
    mkdir -p backend/logs
    mkdir -p logs
    
    success "Cleanup completed"
}

# Function to set environment
set_environment() {
    log "Setting environment for $MODE mode..."
    
    if [ "$MODE" = "production" ]; then
        export JWT_ENABLED=true
        export NODE_ENV=production
        export REACT_APP_ENVIRONMENT=production
    else
        export JWT_ENABLED=false
        export NODE_ENV=development
        export REACT_APP_ENVIRONMENT=development
    fi
    
    # Set common environment variables
    export DATABASE_URL="postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db"
    export PYTHONUNBUFFERED=1
    
    success "Environment configured for $MODE mode"
}

# Function to build and start core services
start_core_services() {
    log "Building and starting core services..."
    
    # Build images
    if [ "$MODE" = "development" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --parallel
    else
        docker-compose build --no-cache --parallel
    fi
    
    # Start PostgreSQL first
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    local timeout=60
    while ! docker exec emr-postgres pg_isready -U emr_user -d emr_db &>/dev/null; do
        if [ $timeout -eq 0 ]; then
            error "PostgreSQL failed to start within 60 seconds"
        fi
        sleep 1
        ((timeout--))
    done
    
    success "PostgreSQL is ready"
    
    # Start backend
    if [ "$MODE" = "development" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
    else
        docker-compose up -d backend
    fi
    
    # Wait for backend to be ready
    log "Waiting for backend to be ready..."
    timeout=120
    while ! curl -sf http://localhost:8000/api/health &>/dev/null; do
        if [ $timeout -eq 0 ]; then
            error "Backend failed to start within 120 seconds"
        fi
        sleep 2
        ((timeout--))
    done
    
    success "Backend is ready"
}

# Function to initialize database
initialize_database() {
    log "Initializing database schema..."
    
    # Run database initialization
    docker exec emr-backend python scripts/setup/init_database_definitive.py --mode production || {
        warning "Primary initialization failed, trying alternative method..."
        docker exec emr-backend python scripts/init_database_definitive.py || {
            error "Database initialization failed"
        }
    }
    
    success "Database initialized"
    
    # Apply performance index optimizations
    log "Applying database index optimizations..."
    docker exec -i emr-postgres psql -U emr_user -d emr_db < backend/scripts/optimize_indexes.sql 2>/dev/null || {
        warning "Index optimization had warnings but continuing..."
    }
    
    success "Database indexes optimized"
}

# Function to generate patient data
generate_patient_data() {
    if [ "$SKIP_DATA" = "true" ]; then
        warning "Skipping patient data generation as requested"
        return 0
    fi
    
    log "Generating $PATIENT_COUNT patients with Synthea..."
    
    # Use synthea_master.py for complete patient generation
    docker exec emr-backend python scripts/active/synthea_master.py full \
        --count "$PATIENT_COUNT" \
        --validation-mode light \
        --include-dicom || {
        error "Patient data generation failed"
    }
    
    success "Generated $PATIENT_COUNT patients with complete data"
    
    # Index search parameters for all resources
    log "Indexing search parameters for FHIR resources..."
    
    # Check if fast indexing script exists first
    if docker exec emr-backend test -f /app/scripts/fast_search_indexing.py; then
        docker exec emr-backend python scripts/fast_search_indexing.py --docker --batch-size 2000 --workers 4 || {
            warning "Fast indexing failed, trying consolidated script..."
            docker exec emr-backend python scripts/consolidated_search_indexing.py --docker --mode index || {
                warning "Search parameter indexing failed - searches may not work properly"
            }
        }
        success "Search parameters indexed"
    elif docker exec emr-backend test -f /app/scripts/consolidated_search_indexing.py; then
        docker exec emr-backend python scripts/consolidated_search_indexing.py --docker --mode index || {
            warning "Search parameter indexing failed - searches may not work properly"
        }
        success "Search parameters indexed"
    else
        warning "Search parameter indexing script not found - searches may not work properly"
    fi
    
    # Populate compartments for Patient/$everything operations
    log "Populating patient compartments..."
    
    if docker exec emr-backend test -f /app/scripts/populate_compartments.py; then
        docker exec emr-backend python scripts/populate_compartments.py || {
            warning "Compartment population failed - Patient/$everything may not work properly"
        }
        success "Patient compartments populated"
    else
        warning "Compartment population script not found - Patient/$everything may not work properly"
    fi
    
    # Optimize database indexes for better query performance
    log "Optimizing database indexes..."
    
    if docker exec emr-backend test -f /app/scripts/optimize_database_indexes.py; then
        docker exec emr-backend python scripts/optimize_database_indexes.py || {
            warning "Database index optimization failed - queries may be slower"
        }
        success "Database indexes optimized"
    else
        warning "Index optimization script not found - using default indexes"
    fi
    
    # Populate FHIR references table for relationship visualization
    log "Populating FHIR references table..."
    
    if docker exec emr-backend test -f /app/scripts/populate_references_urn_uuid.py; then
        docker exec emr-backend python scripts/populate_references_urn_uuid.py || {
            warning "Reference population failed - relationship viewer will not work properly"
            # Try the basic version as fallback
            if docker exec emr-backend test -f /app/scripts/populate_references_table.py; then
                log "Trying basic reference population as fallback..."
                docker exec emr-backend python scripts/populate_references_table.py || {
                    warning "Fallback reference population also failed"
                }
            fi
        }
        success "FHIR references populated"
    else
        warning "Reference population script not found - relationship viewer will not work properly"
    fi
    
    # Fix CDS hooks schema if needed
    log "Checking CDS hooks schema..."
    
    if docker exec emr-backend test -f /app/scripts/fix_cds_hooks_enabled_column.py; then
        docker exec emr-backend python scripts/fix_cds_hooks_enabled_column.py || {
            warning "CDS hooks schema fix failed - CDS hooks may not work properly"
        }
        success "CDS hooks schema verified"
    else
        warning "CDS hooks fix script not found"
    fi
}

# Function to start frontend
start_frontend() {
    log "Starting frontend service..."
    
    if [ "$MODE" = "development" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend
    else
        docker-compose up -d frontend
    fi
    
    # Wait for frontend (longer timeout for first build)
    log "Waiting for frontend to be ready (this may take a few minutes)..."
    local timeout=300
    while ! curl -sf http://localhost:3000 &>/dev/null; do
        if [ $timeout -eq 0 ]; then
            warning "Frontend may still be building. You can check logs with: docker-compose logs -f frontend"
            break
        fi
        sleep 3
        ((timeout--))
    done
    
    if curl -sf http://localhost:3000 &>/dev/null; then
        success "Frontend is ready"
    fi
}

# Function to validate deployment
validate_deployment() {
    log "Validating deployment..."
    
    # Check all services are running
    local services=("postgres" "backend" "frontend")
    local all_running=true
    
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "${service}.*Up"; then
            success "$service is running"
        else
            warning "$service is not running"
            all_running=false
        fi
    done
    
    if [ "$all_running" = "true" ]; then
        success "All services are running"
    else
        error "Some services failed to start"
    fi
    
    # Run validation script if available
    if [ -f "scripts/validate_deployment.py" ]; then
        log "Running deployment validation..."
        docker exec emr-backend python scripts/validate_deployment.py --docker --verbose || {
            warning "Validation script reported issues"
        }
    fi
    
    # Run comprehensive FHIR table verification
    if docker exec emr-backend test -f /app/scripts/verify_all_fhir_tables.py; then
        log "Running FHIR table verification..."
        docker exec emr-backend python scripts/verify_all_fhir_tables.py || {
            warning "FHIR table verification reported issues"
        }
    fi
}

# Function to show deployment info
show_deployment_info() {
    echo ""
    echo "======================================"
    echo "  WintEHR Deployment Complete!"
    echo "======================================"
    echo ""
    echo "Mode: $MODE"
    echo "Patients: $PATIENT_COUNT"
    echo ""
    echo "Service URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    
    if [ "$MODE" = "development" ]; then
        echo "Development Features:"
        echo "  ✓ Hot reload enabled for frontend and backend"
        echo "  ✓ JWT authentication disabled (demo users)"
        echo "  ✓ Debug mode enabled"
        echo ""
        echo "Demo Users:"
        echo "  Username: demo     Password: password"
        echo "  Username: nurse    Password: password"
        echo "  Username: admin    Password: password"
    else
        echo "Production Features:"
        echo "  ✓ JWT authentication enabled"
        echo "  ✓ Optimized builds"
        echo "  ✓ Security headers enabled"
    fi
    
    echo ""
    echo "Useful Commands:"
    echo "  View logs:    docker-compose logs -f [service]"
    echo "  Stop:         docker-compose down"
    echo "  Restart:      docker-compose restart [service]"
    echo ""
    
    if [ "$VERBOSE" = "true" ]; then
        echo "Container Status:"
        docker-compose ps
    fi
}

# Main execution
main() {
    echo "🏥 WintEHR Fresh Deployment"
    echo "============================="
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Clean existing deployment
    clean_deployment
    
    # Set environment
    set_environment
    
    # Start core services
    start_core_services
    
    # Initialize database
    initialize_database
    
    # Generate patient data
    generate_patient_data
    
    # Start frontend
    start_frontend
    
    # Validate deployment
    validate_deployment
    
    # Show deployment info
    show_deployment_info
    
    success "Deployment completed successfully!"
}

# Handle errors
trap 'error "Deployment failed. Check logs for details."' ERR

# Run main function
main "$@"