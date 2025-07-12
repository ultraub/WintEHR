#!/bin/bash

# =============================================================================
# MedGenEMR Master Deployment Script
# =============================================================================
# Single entry point for complete, bulletproof deployment
# Handles everything from scratch with zero manual intervention
#
# Usage:
#   ./scripts/master-deploy.sh [options]
#
# Options:
#   --development    Development mode (faster, less data)
#   --production     Production mode (full data, optimizations)
#   --patients=N     Number of patients to generate (default: 5)
#   --skip-build     Skip Docker build (use existing images)
#   --skip-data      Skip data generation (use existing data)
#   --clean          Force clean deployment (remove all data)
#   --help           Show this help message

set -e  # Exit on any error

# =============================================================================
# Configuration and Setup
# =============================================================================

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Default configuration
DEPLOYMENT_MODE="development"
PATIENT_COUNT=5
SKIP_BUILD=false
SKIP_DATA=false
FORCE_CLEAN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MODULES_DIR="$SCRIPT_DIR/modules"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

section() {
    echo ""
    echo -e "${PURPLE}================================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}================================================${NC}"
}

# =============================================================================
# Argument Parsing
# =============================================================================

show_help() {
    cat << EOF
MedGenEMR Master Deployment Script

USAGE:
    ./scripts/master-deploy.sh [OPTIONS]

OPTIONS:
    --development       Development mode (faster, less data) [default]
    --production        Production mode (full data, optimizations)
    --patients=N        Number of patients to generate (default: 5)
    --skip-build        Skip Docker build (use existing images)
    --skip-data         Skip data generation (use existing data)
    --clean             Force clean deployment (remove all data)
    --help              Show this help message

EXAMPLES:
    # Quick development deployment
    ./scripts/master-deploy.sh

    # Production deployment with 20 patients
    ./scripts/master-deploy.sh --production --patients=20

    # Clean development deployment
    ./scripts/master-deploy.sh --clean --patients=10

PHASES:
    1. Environment Setup    - Docker cleanup, permissions
    2. Database Init       - Schema creation with all tables
    3. Data Generation     - Synthea patient data
    4. Data Import         - Safe FHIR import preserving schema
    5. Data Processing     - Name cleaning, CDS hooks, DICOM
    6. Configuration       - Nginx, static files, endpoints
    7. Validation          - Complete system testing

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --development)
            DEPLOYMENT_MODE="development"
            shift
            ;;
        --production)
            DEPLOYMENT_MODE="production"
            PATIENT_COUNT=20
            shift
            ;;
        --patients=*)
            PATIENT_COUNT="${1#*=}"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-data)
            SKIP_DATA=true
            shift
            ;;
        --clean)
            FORCE_CLEAN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            error "Unknown option: $1. Use --help for usage information."
            ;;
    esac
done

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
    log "🔍 Running pre-flight checks..."
    
    # Check if we're in the right directory
    if [ ! -f "$ROOT_DIR/docker-compose.yml" ] || [ ! -d "$ROOT_DIR/backend" ]; then
        error "Please run this script from the MedGenEMR root directory or ensure the project structure is correct"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker Desktop."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check required modules exist
    local required_modules=(
        "00-environment-setup.sh"
        "01-database-init.sh"
        "02-data-generation.sh"
        "03-data-import.sh"
        "04-data-processing.sh"
        "05-nginx-config.sh"
        "06-validation.sh"
    )
    
    for module in "${required_modules[@]}"; do
        if [ ! -f "$MODULES_DIR/$module" ]; then
            error "Required module missing: $MODULES_DIR/$module"
        fi
    done
    
    success "Pre-flight checks passed"
}

# =============================================================================
# Module Execution Framework
# =============================================================================

execute_module() {
    local module_name="$1"
    local module_path="$MODULES_DIR/$module_name"
    
    if [ ! -f "$module_path" ]; then
        error "Module not found: $module_path"
    fi
    
    log "📦 Executing module: $module_name"
    
    # Make module executable
    chmod +x "$module_path"
    
    # Execute module with current environment
    if ! "$module_path" \
        --mode="$DEPLOYMENT_MODE" \
        --patients="$PATIENT_COUNT" \
        --root-dir="$ROOT_DIR" \
        --skip-build="$SKIP_BUILD" \
        --skip-data="$SKIP_DATA" \
        --force-clean="$FORCE_CLEAN"; then
        error "Module failed: $module_name"
    fi
    
    success "Module completed: $module_name"
}

# =============================================================================
# Deployment Orchestration
# =============================================================================

run_deployment() {
    local start_time=$(date +%s)
    
    section "🚀 MedGenEMR Master Deployment"
    
    info "Configuration:"
    info "  Mode: $DEPLOYMENT_MODE"
    info "  Patients: $PATIENT_COUNT"
    info "  Skip Build: $SKIP_BUILD"
    info "  Skip Data: $SKIP_DATA"
    info "  Force Clean: $FORCE_CLEAN"
    info "  Root Directory: $ROOT_DIR"
    
    # Phase 1: Environment Setup
    section "🧹 Phase 1: Environment Setup"
    execute_module "00-environment-setup.sh"
    
    # Phase 2: Database Initialization
    section "🗄️ Phase 2: Database Initialization"
    execute_module "01-database-init.sh"
    
    # Phase 3: Data Generation
    section "🧬 Phase 3: Data Generation"
    execute_module "02-data-generation.sh"
    
    # Phase 4: Data Import
    section "📥 Phase 4: Data Import"
    execute_module "03-data-import.sh"
    
    # Phase 5: Data Processing
    section "🔄 Phase 5: Data Processing"
    execute_module "04-data-processing.sh"
    
    # Phase 6: Configuration
    section "⚙️ Phase 6: System Configuration"
    execute_module "05-nginx-config.sh"
    
    # Phase 7: Validation
    section "✅ Phase 7: System Validation"
    execute_module "06-validation.sh"
    
    # Deployment Summary
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    section "🎉 Deployment Complete"
    
    success "Total deployment time: ${minutes}m ${seconds}s"
    success "Mode: $DEPLOYMENT_MODE"
    success "Patients generated: $PATIENT_COUNT"
    
    echo ""
    info "🌐 System Access:"
    info "  Frontend:  http://localhost"
    info "  Backend:   http://localhost:8000"
    info "  API Docs:  http://localhost:8000/docs"
    info "  FHIR API:  http://localhost:8000/fhir/R4"
    info "  CDS Hooks: http://localhost:8000/cds-hooks/services"
    
    echo ""
    info "📊 Quick Health Check:"
    
    # Quick health verification
    local frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost || echo "000")
    local backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health || echo "000")
    local manifest_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/manifest.json || echo "000")
    
    if [ "$frontend_status" = "200" ]; then
        success "Frontend: ✅ Running"
    else
        warning "Frontend: ❌ Not responding ($frontend_status)"
    fi
    
    if [ "$backend_status" = "200" ]; then
        success "Backend: ✅ Running"
    else
        warning "Backend: ❌ Not responding ($backend_status)"
    fi
    
    if [ "$manifest_status" = "200" ]; then
        success "Manifest: ✅ Accessible"
    else
        warning "Manifest: ❌ Not accessible ($manifest_status)"
    fi
    
    echo ""
    info "📋 Next Steps:"
    info "  1. Visit http://localhost to access the EMR"
    info "  2. Login with demo credentials (demo/password)"
    info "  3. Explore the Clinical Workspace and FHIR Explorer"
    info "  4. Check logs: docker-compose logs [service]"
    
    if [ "$frontend_status" = "200" ] && [ "$backend_status" = "200" ] && [ "$manifest_status" = "200" ]; then
        section "🎊 Deployment Successful!"
        return 0
    else
        section "⚠️ Deployment Completed with Issues"
        warning "Some services may not be fully operational. Check logs for details."
        return 1
    fi
}

# =============================================================================
# Error Handling and Cleanup
# =============================================================================

cleanup_on_error() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo ""
        error "Deployment failed with exit code: $exit_code"
        
        info "🔍 Troubleshooting Information:"
        info "  1. Check Docker status: docker-compose ps"
        info "  2. View logs: docker-compose logs"
        info "  3. Check disk space: df -h"
        info "  4. Verify Docker memory: docker system df"
        
        echo ""
        info "📋 Common Solutions:"
        info "  • Restart Docker Desktop"
        info "  • Run with --clean flag"
        info "  • Check available disk space (needs 2GB+)"
        info "  • Verify no other services on ports 80, 8000"
        
        # Offer to save logs
        read -p "Save deployment logs for troubleshooting? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            local log_file="deployment-error-$(date +%Y%m%d-%H%M%S).log"
            docker-compose logs > "$log_file" 2>&1 || true
            info "Logs saved to: $log_file"
        fi
    fi
}

# Set up error handling
trap cleanup_on_error EXIT

# =============================================================================
# Main Execution
# =============================================================================

main() {
    # Change to root directory
    cd "$ROOT_DIR"
    
    # Run pre-flight checks
    preflight_checks
    
    # Execute deployment
    run_deployment
}

# Run main function
main "$@"