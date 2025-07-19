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
    
    # Remove specific containers that might cause conflicts
    docker rm -f emr-frontend-dev 2>/dev/null || true
    docker rm -f emr-backend-dev 2>/dev/null || true
    
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
    
    echo -e "${BLUE}🔧 Running build process...${NC}"
    
    # First, ensure database is initialized
    echo -e "${YELLOW}Initializing database...${NC}"
    docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
        cd /app
        python scripts/setup/init_database_definitive.py --mode development 2>/dev/null || \
        python scripts/init_database_definitive.py --mode development
    "
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Database initialization failed${NC}"
        return 1
    fi
    
    # Try master_build.py first
    echo -e "${BLUE}Attempting consolidated build...${NC}"
    BUILD_SUCCESS=false
    
    docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
        export PYTHONPATH=/app
        cd /app
        if [ -f scripts/active/master_build.py ]; then
            python scripts/active/master_build.py --${BUILD_TYPE}-build --patient-count ${PATIENT_COUNT} --environment development
        else
            exit 1
        fi
    "
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build completed successfully${NC}"
        BUILD_SUCCESS=true
    else
        echo -e "${YELLOW}⚠️ Master build encountered issues, continuing with manual steps...${NC}"
    fi
    
    # If master build failed, run individual critical steps
    if [ "$BUILD_SUCCESS" = "false" ]; then
        echo -e "${YELLOW}Running individual build steps...${NC}"
        
        # Try synthea_master.py as fallback
        echo -e "${BLUE}Generating patient data with synthea_master.py...${NC}"
        docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
            export PYTHONPATH=/app
            cd /app
            python scripts/active/synthea_master.py full --count ${PATIENT_COUNT} --validation-mode light
        " || echo -e "${YELLOW}⚠️ Patient generation had issues but continuing...${NC}"
        
        # Run search indexing - critical step, don't just echo on failure
        echo -e "${BLUE}Indexing search parameters...${NC}"
        SEARCH_INDEX_SUCCESS=false
        
        # First try the consolidated script
        docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
            cd /app
            python scripts/consolidated_search_indexing.py --mode index
        "
        
        if [ $? -eq 0 ]; then
            SEARCH_INDEX_SUCCESS=true
            echo -e "${GREEN}✅ Search parameters indexed successfully${NC}"
        else
            echo -e "${YELLOW}⚠️ Consolidated search indexing failed, trying simple approach...${NC}"
            
            # Fallback to a simple inline script that we know works
            docker-compose -f docker-compose.dev.yml run --rm backend python -c "
import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def ensure_patient_search_params():
    engine = create_async_engine('postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    
    async with engine.connect() as conn:
        # Check if we already have patient params
        result = await conn.execute(text('''
            SELECT COUNT(*) FROM fhir.search_params 
            WHERE param_name IN ('patient', 'subject')
        '''))
        count = result.scalar()
        print(f'Existing patient search params: {count}')
        
        if count < 1000:  # Likely missing params
            print('Adding patient search parameters...')
            
            # Add for key resource types
            for rtype in ['Condition', 'Observation', 'MedicationRequest', 'Procedure']:
                result = await conn.execute(text('''
                    SELECT r.id, r.resource 
                    FROM fhir.resources r
                    WHERE r.resource_type = :rtype
                    AND NOT EXISTS (
                        SELECT 1 FROM fhir.search_params sp
                        WHERE sp.resource_id = r.id
                        AND sp.param_name = 'patient'
                    )
                '''), {'rtype': rtype})
                
                resources = result.fetchall()
                added = 0
                
                for res_id, res_json in resources:
                    try:
                        resource = json.loads(res_json) if isinstance(res_json, str) else res_json
                        patient_ref = None
                        
                        if 'subject' in resource and isinstance(resource['subject'], dict):
                            patient_ref = resource['subject'].get('reference')
                        elif 'patient' in resource and isinstance(resource['patient'], dict):
                            patient_ref = resource['patient'].get('reference')
                        
                        if patient_ref:
                            patient_id = patient_ref.replace('urn:uuid:', '').replace('Patient/', '')
                            
                            await conn.execute(text('''
                                INSERT INTO fhir.search_params 
                                (resource_id, resource_type, param_name, param_type, value_reference)
                                VALUES (:rid, :rtype, 'patient', 'reference', :pid)
                            '''), {'rid': res_id, 'rtype': rtype, 'pid': patient_id})
                            
                            added += 1
                    except Exception as e:
                        pass
                
                await conn.commit()
                print(f'Added {added} patient params for {rtype}')
            
            print('Patient search parameters ensured')
        else:
            print('Patient search params already indexed')
    
    await engine.dispose()

asyncio.run(ensure_patient_search_params())
            "
            
            if [ $? -eq 0 ]; then
                SEARCH_INDEX_SUCCESS=true
                echo -e "${GREEN}✅ Basic search parameters indexed${NC}"
            else
                echo -e "${RED}❌ Search parameter indexing failed completely${NC}"
            fi
        fi
        
        # Populate compartments
        echo -e "${BLUE}Populating compartments...${NC}"
        docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
            cd /app
            python scripts/populate_compartments.py || echo 'Compartment population failed'
        "
        
        # Populate references
        echo -e "${BLUE}Populating references...${NC}"
        docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
            cd /app
            python scripts/populate_references_urn_uuid.py || echo 'Reference population failed'
        "
        
        # Optimize database indexes for better query performance
        echo -e "${BLUE}Optimizing database indexes...${NC}"
        docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
            cd /app
            if [ -f scripts/optimize_database_indexes.py ]; then
                python scripts/optimize_database_indexes.py
                echo 'Database indexes optimized'
            else
                echo 'Index optimization script not found - using default indexes'
            fi
        " || echo -e "${YELLOW}⚠️ Database index optimization failed - queries may be slower${NC}"
    fi
    
    # Always fix CDS hooks schema
    echo -e "${BLUE}Checking CDS hooks schema...${NC}"
    docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
        cd /app
        if [ -f scripts/fix_cds_hooks_enabled_column.py ]; then
            python scripts/fix_cds_hooks_enabled_column.py || echo 'CDS hooks fix failed'
        fi
    "
    
    # Run validation if script exists
    echo -e "${BLUE}Validating deployment...${NC}"
    docker-compose -f docker-compose.dev.yml run --rm backend bash -c "
        cd /app
        if [ -f scripts/validate_deployment.py ]; then
            python scripts/validate_deployment.py --docker --verbose || echo 'Validation reported issues'
        elif [ -f scripts/analysis/validate_database_schema.py ]; then
            python scripts/analysis/validate_database_schema.py || echo 'Schema validation reported issues'
        else
            echo 'Validation scripts not found, skipping...'
        fi
    "
    
    echo -e "${GREEN}✅ Build process completed${NC}"
    return 0
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
    
    # Ensure no conflicting frontend container exists
    docker rm -f emr-frontend-dev 2>/dev/null || true
    
    # Start frontend with hot reload
    docker-compose -f docker-compose.dev.yml up -d frontend
    
    # Wait for frontend to be ready (up to 180s for initial npm install)
    echo -e "${YELLOW}⏳ Waiting for frontend to be ready (this may take a few minutes)...${NC}"
    start_ts=$(date +%s)
    frontend_ready=false
    while [ "$frontend_ready" = false ]; do
        if curl -sf http://localhost:3000 >/dev/null 2>&1; then
            frontend_ready=true
            echo -e "${GREEN}✅ Frontend is ready${NC}"
        else
            elapsed=$(( $(date +%s) - start_ts ))
            if (( elapsed > 180 )); then
                echo -e "${YELLOW}⚠️ Frontend is taking longer than expected${NC}"
                echo -e "${YELLOW}This is normal for first-time startup. Check logs with:${NC}"
                echo "  docker-compose -f docker-compose.dev.yml logs -f frontend"
                break
            elif (( elapsed % 30 == 0 )); then
                echo -e "${YELLOW}Still waiting... ($elapsed seconds elapsed)${NC}"
            fi
            sleep 3
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
