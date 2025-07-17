#!/bin/bash
# Development Build Script for WintEHR with Hot Reload Support
# Uses consolidated patient data building system

set -e

echo "🏥 WintEHR Development Build with Hot Reload"
echo "============================================"

# Configuration
PATIENT_COUNT=${PATIENT_COUNT:-10}
BUILD_TYPE=${BUILD_TYPE:-quick}
SKIP_BUILD=${SKIP_BUILD:-false}
CLEAN_START=${CLEAN_START:-false}
SKIP_CONFIRM=${SKIP_CONFIRM:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --clean)
            CLEAN_START=true
            shift
            ;;
        --yes|-y)
            SKIP_CONFIRM=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --patients <count>     Number of patients to generate (default: 10)"
            echo "  --build-type <type>    Build type: quick, full, validate (default: quick)"
            echo "  --skip-build           Skip data build, just start services"
            echo "  --clean                Clean start (remove containers and volumes)"
            echo "  --yes, -y              Skip confirmation prompts"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                              # Quick build with 10 patients"
            echo "  $0 --patients 20 --build-type full"
            echo "  $0 --skip-build                # Just start services"
            echo "  $0 --clean --patients 5        # Clean start with 5 patients"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Display configuration
echo -e "${BLUE}Configuration:${NC}"
echo "  Patient Count: $PATIENT_COUNT"
echo "  Build Type: $BUILD_TYPE"
echo "  Skip Build: $SKIP_BUILD"
echo "  Clean Start: $CLEAN_START"
echo ""

# Confirmation
if [ "$SKIP_CONFIRM" != "true" ]; then
    echo -e "${YELLOW}This will start the development environment with hot reload.${NC}"
    echo -e "${YELLOW}Continue? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to clean up existing containers and volumes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up existing containers and volumes...${NC}"
    
    # Stop and remove containers
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans || true
    
    # Remove any orphaned containers
    docker container prune -f || true
    
    # Remove volumes if clean start
    if [ "$CLEAN_START" = "true" ]; then
        docker volume prune -f || true
        echo -e "${GREEN}✅ Volumes cleaned${NC}"
    fi
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to build and start services
start_services() {
    echo -e "${BLUE}🚀 Starting development services...${NC}"
    
    # Build and start services
    docker-compose -f docker-compose.dev.yml up -d --build postgres
    
    # Wait for database to be ready (up to 60s)
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    start_ts=$(date +%s)
    until docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U emr_user -d emr_db >/dev/null 2>&1; do
        sleep 2
        if (( $(date +%s) - start_ts > 60 )); then
            echo -e "${RED}❌ Database failed to start within 60 seconds${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ Database is ready${NC}"
}

# Function to run consolidated build
run_build() {
    if [ "$SKIP_BUILD" = "true" ]; then
        echo -e "${YELLOW}⏭️ Skipping build process${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🔧 Running consolidated build process...${NC}"
    
    # Run build inside backend container
    docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
        export PYTHONPATH=/app
        cd /app/scripts/active
        python master_build.py --${BUILD_TYPE}-build --patient-count ${PATIENT_COUNT} --environment development
    "
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build completed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Build failed${NC}"
        echo -e "${YELLOW}You can still start services and run the build manually later${NC}"
        
        # Ask if user wants to continue
        if [ "$SKIP_CONFIRM" != "true" ]; then
            echo -e "${YELLOW}Continue with service startup? (y/N)${NC}"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
}

# Function to start all services with hot reload
start_all_services() {
    echo -e "${BLUE}🚀 Starting all services with hot reload...${NC}"
    
    # Start backend with hot reload
    docker-compose -f docker-compose.dev.yml up -d backend
    
    # Wait for backend to be ready (up to 60s)
    echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
    start_ts=$(date +%s)
    until curl -sf http://localhost:8000/api/health >/dev/null; do
        sleep 2
        if (( $(date +%s) - start_ts > 60 )); then
            echo -e "${RED}❌ Backend failed to start within 60 seconds${NC}"
            docker-compose -f docker-compose.dev.yml logs backend
            exit 1
        fi
    done
    echo -e "${GREEN}✅ Backend is ready${NC}"
    
    # Start frontend with hot reload
    docker-compose -f docker-compose.dev.yml up -d frontend
    
    # Wait for frontend to be ready (up to 120s)
    echo -e "${YELLOW}⏳ Waiting for frontend to be ready...${NC}"
    start_ts=$(date +%s)
    while ! curl -sf http://localhost:3000 >/dev/null; do
        sleep 3
        if (( $(date +%s) - start_ts > 120 )); then
            echo -e "${YELLOW}⚠️ Frontend may still be starting (this can take a few minutes)${NC}"
            break
        fi
    done
}

# Function to show service status
show_status() {
    echo -e "${BLUE}📊 Service Status:${NC}"
    docker-compose -f docker-compose.dev.yml ps
    
    echo -e "
${BLUE}🔗 Service URLs:${NC}"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Documentation: http://localhost:8000/docs"
    echo "  Database: localhost:5432 (emr_user/emr_password)"
    
    echo -e "
${BLUE}💡 Development Tips:${NC}"
    echo "  • Backend code changes will auto-reload"
    echo "  • Frontend code changes will auto-reload"
    echo "  • View logs: docker-compose -f docker-compose.dev.yml logs -f [service]"
    echo "  • Stop services: docker-compose -f docker-compose.dev.yml down"
    echo "  • Run manual build: docker-compose -f docker-compose.dev.yml exec backend python scripts/active/master_build.py --quick-build"
}

# Function to wait for user input
wait_for_input() {
    echo -e "
${YELLOW}Press Ctrl+C to stop services, or Enter to view logs...${NC}"
    read -r
    docker-compose -f docker-compose.dev.yml logs -f
}

# Main execution
main() {
    echo -e "${BLUE}Starting WintEHR Development Environment...${NC}"
    
    # Check prerequisites
    check_docker
    
    # Cleanup if requested
    if [ "$CLEAN_START" = "true" ]; then
        cleanup
    else
        docker-compose -f docker-compose.dev.yml down || true
    fi
    
    # Start database
    start_services
    
    # Run build process
    run_build
    
    # Start all services with hot reload
    start_all_services
    
    # Show status
    show_status
    
    # Wait for user input or Ctrl+C
    wait_for_input
}

# Handle signals gracefully
trap 'echo -e "
${YELLOW}🛑 Stopping services...${NC}"; docker-compose -f docker-compose.dev.yml down; exit 0' SIGINT SIGTERM

# Run main function
main "$@"
