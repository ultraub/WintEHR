#!/bin/bash
#
# Development Start Script for MedGenEMR
# Quick startup for development with hot reload
#
# Usage:
#   ./dev-start.sh              # Start development environment
#   ./dev-start.sh --logs       # Start and tail logs
#   ./dev-start.sh --rebuild    # Force rebuild containers
#   ./dev-start.sh --stop       # Stop all services
#

set -e

# Configuration
SHOW_LOGS=${SHOW_LOGS:-false}
REBUILD=${REBUILD:-false}
STOP_ONLY=${STOP_ONLY:-false}

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --logs)
            SHOW_LOGS=true
            shift
            ;;
        --rebuild)
            REBUILD=true
            shift
            ;;
        --stop)
            STOP_ONLY=true
            shift
            ;;
        --help|-h)
            echo "Development Start Script for MedGenEMR"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --logs       Start services and tail logs"
            echo "  --rebuild    Force rebuild containers"
            echo "  --stop       Stop all services"
            echo "  --help, -h   Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Quick start development"
            echo "  $0 --logs       # Start and watch logs"
            echo "  $0 --rebuild    # Rebuild and start"
            echo "  $0 --stop       # Stop services"
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
    echo -e "${BLUE}[DEV]${NC} $1"
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

# Function to check Docker
check_docker() {
    if ! docker info &>/dev/null; then
        error "Docker is not running. Please start Docker first."
    fi
    success "Docker is running"
}

# Function to stop services
stop_services() {
    log "Stopping development services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    success "Services stopped"
}

# Function to check if services are already running
check_running_services() {
    local running_services=$(docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps --services --filter "status=running" 2>/dev/null | wc -l)
    if [ "$running_services" -gt 0 ]; then
        warning "Some services are already running"
        echo "Running services:"
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
        echo ""
        echo "Do you want to restart them? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            stop_services
        else
            exit 0
        fi
    fi
}

# Function to ensure required files exist
check_required_files() {
    local required_files=(
        "docker-compose.yml"
        "docker-compose.dev.yml"
        "backend/Dockerfile.dev"
        "frontend/Dockerfile.dev"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Required file missing: $file"
        fi
    done
    
    success "All required files present"
}

# Function to start services
start_services() {
    log "Starting development services with hot reload..."
    
    # Set development environment
    export JWT_ENABLED=false
    export NODE_ENV=development
    
    # Build if requested
    if [ "$REBUILD" = "true" ]; then
        log "Building containers..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --parallel
    fi
    
    # Start PostgreSQL first
    log "Starting PostgreSQL..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
    
    # Wait for PostgreSQL
    log "Waiting for database..."
    timeout=30
    while ! docker exec emr-postgres pg_isready -U emr_user -d emr_db &>/dev/null; do
        if [ $timeout -eq 0 ]; then
            error "Database failed to start"
        fi
        sleep 1
        ((timeout--))
    done
    success "Database is ready"
    
    # Start backend
    log "Starting backend with hot reload..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend
    
    # Wait for backend
    log "Waiting for backend API..."
    timeout=60
    while ! curl -sf http://localhost:8000/api/health &>/dev/null; do
        if [ $timeout -eq 0 ]; then
            warning "Backend is taking longer than expected"
            break
        fi
        sleep 2
        ((timeout--))
    done
    
    if curl -sf http://localhost:8000/api/health &>/dev/null; then
        success "Backend API is ready"
    fi
    
    # Start frontend
    log "Starting frontend with hot reload..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend
    
    # Brief wait for frontend to start initializing
    sleep 5
    
    success "All services started"
}

# Function to show status
show_status() {
    echo ""
    echo "======================================"
    echo "  MedGenEMR Development Environment"
    echo "======================================"
    echo ""
    echo "Service URLs:"
    echo "  Frontend:    http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs:    http://localhost:8000/docs"
    echo "  Proxy Health: http://localhost:3000/proxy-health"
    echo ""
    echo "Hot Reload:"
    echo "  ✓ Backend code changes auto-reload"
    echo "  ✓ Frontend code changes auto-reload"
    echo ""
    echo "Demo Users:"
    echo "  Username: demo     Password: password"
    echo "  Username: nurse    Password: password"
    echo "  Username: admin    Password: password"
    echo ""
    echo "Service Status:"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
    echo ""
    echo "Useful Commands:"
    echo "  View logs:      docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f [service]"
    echo "  Restart service: docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart [service]"
    echo "  Stop all:       ./dev-start.sh --stop"
    echo "  Load data:      docker exec emr-backend python scripts/active/synthea_master.py full --count 20"
    echo ""
    
    if [ "$SHOW_LOGS" = "true" ]; then
        echo "Tailing logs (Ctrl+C to stop)..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
    fi
}

# Function to check data
check_data() {
    log "Checking for patient data..."
    
    # Check if we have patients
    local patient_count=$(docker exec emr-backend python -c "
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def count_patients():
    engine = create_async_engine('postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\''))
        count = result.scalar()
    await engine.dispose()
    return count

print(asyncio.run(count_patients()))
" 2>/dev/null || echo "0")
    
    if [ "$patient_count" = "0" ]; then
        warning "No patient data found"
        echo ""
        echo "To load sample patients, run:"
        echo "  docker exec emr-backend python scripts/active/synthea_master.py full --count 20"
        echo ""
        echo "Or for a fresh deployment with data:"
        echo "  ./fresh-deploy.sh"
    else
        success "Found $patient_count patients in database"
    fi
}

# Main execution
main() {
    echo "🏥 MedGenEMR Development Startup"
    echo "================================"
    echo ""
    
    # Check Docker
    check_docker
    
    # Handle stop command
    if [ "$STOP_ONLY" = "true" ]; then
        stop_services
        exit 0
    fi
    
    # Check required files
    check_required_files
    
    # Check for running services
    check_running_services
    
    # Start services
    start_services
    
    # Check data
    check_data
    
    # Show status
    show_status
}

# Handle errors
trap 'echo ""; error "Development startup failed. Check logs for details."' ERR

# Handle Ctrl+C
trap 'echo ""; log "Interrupted. Services are still running. Use --stop to stop them."; exit 0' INT

# Run main function
main "$@"