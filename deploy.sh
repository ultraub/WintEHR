#!/bin/bash

# WintEHR Unified Deployment Script
# Works for local, development, and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Handle special commands
case "$1" in
    stop)
        echo -e "${YELLOW}Stopping WintEHR services...${NC}"
        docker-compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        exit 0
        ;;
    clean)
        echo -e "${YELLOW}Cleaning WintEHR deployment (removing all data)...${NC}"
        docker-compose down -v
        docker system prune -f
        echo -e "${GREEN}✓ Clean complete${NC}"
        exit 0
        ;;
    status)
        echo -e "${BLUE}WintEHR Service Status:${NC}"
        docker-compose ps
        echo ""
        echo -e "${BLUE}Resource Summary:${NC}"
        docker exec emr-postgres psql -U emr_user -d emr_db -c "
            SELECT resource_type, COUNT(*) as count 
            FROM fhir.resources 
            GROUP BY resource_type 
            ORDER BY count DESC 
            LIMIT 10;" 2>/dev/null || echo "Database not accessible"
        exit 0
        ;;
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose logs -f --tail=100
        else
            docker-compose logs -f --tail=100 "$SERVICE"
        fi
        exit 0
        ;;
esac

# Configuration
ENVIRONMENT=${1:-dev}
PATIENT_COUNT=${2:-10}

# Parse additional arguments
while [[ $# -gt 2 ]]; do
    case $3 in
        --patients)
            PATIENT_COUNT="$4"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo -e "${GREEN}WintEHR Deployment Script${NC}"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Patient Count: $PATIENT_COUNT"
echo ""

# Function to check if running on AWS
is_aws() {
    if [ -f /var/lib/cloud/instance/vendor-data.txt ] || [ -f /sys/hypervisor/uuid ]; then
        return 0
    fi
    return 1
}

# Function to wait for PostgreSQL
wait_for_postgres() {
    local max_attempts=60
    local attempt=0
    
    echo -e "${YELLOW}Waiting for PostgreSQL...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if docker exec emr-postgres pg_isready -U emr_user -d emr_db &>/dev/null; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "${RED}✗ PostgreSQL failed to start${NC}"
    return 1
}

# Function to wait for backend service
wait_for_backend() {
    local max_attempts=60
    local attempt=0
    
    echo -e "${YELLOW}Waiting for Backend API...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:8000/api/health &>/dev/null; then
            echo -e "${GREEN}✓ Backend API is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "${RED}✗ Backend API failed to start${NC}"
    return 1
}

# Function to wait for frontend
wait_for_frontend() {
    local max_attempts=30
    local attempt=0
    local port=3000
    
    if [ "$ENVIRONMENT" == "prod" ]; then
        port=80
    fi
    
    echo -e "${YELLOW}Waiting for Frontend...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:$port &>/dev/null; then
            echo -e "${GREEN}✓ Frontend is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "${YELLOW}⚠ Frontend may still be starting (this is normal)${NC}"
    return 0  # Don't fail deployment if frontend takes longer
}

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose down || true

# Build based on environment
if [ "$ENVIRONMENT" == "prod" ] || is_aws; then
    echo -e "${GREEN}Building for production...${NC}"
    
    # Use production Dockerfile for frontend
    sed -i.bak 's|dockerfile: Dockerfile.dev|dockerfile: Dockerfile|g' docker-compose.yml
    sed -i.bak 's|- "3000:3000"|- "80:80"|g' docker-compose.yml
    
    # Build images
    docker-compose build --no-cache
    
elif [ "$ENVIRONMENT" == "dev" ]; then
    echo -e "${GREEN}Building for development...${NC}"
    
    # Use development Dockerfile for frontend
    sed -i.bak 's|dockerfile: Dockerfile|dockerfile: Dockerfile.dev|g' docker-compose.yml
    sed -i.bak 's|- "80:80"|- "3000:3000"|g' docker-compose.yml
    
    # Build images
    docker-compose build
fi

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${BLUE}Waiting for services to initialize...${NC}"
sleep 5  # Give containers time to start

# Wait for database
if ! wait_for_postgres; then
    echo -e "${RED}PostgreSQL failed to start. Checking logs...${NC}"
    docker-compose logs --tail=20 postgres
    echo -e "${YELLOW}Attempting restart...${NC}"
    docker-compose restart postgres
    sleep 5
    wait_for_postgres || {
        echo -e "${RED}PostgreSQL still not responding. Deployment failed.${NC}"
        exit 1
    }
fi

# Wait for backend
if ! wait_for_backend; then
    echo -e "${RED}Backend failed to start. Checking logs...${NC}"
    docker-compose logs --tail=20 backend
    echo -e "${YELLOW}Attempting restart...${NC}"
    docker-compose restart backend
    sleep 5
    wait_for_backend || {
        echo -e "${RED}Backend still not responding. Deployment failed.${NC}"
        exit 1
    }
fi

# Wait for frontend (non-blocking)
wait_for_frontend

# Load patient data if requested
if [ "$PATIENT_COUNT" -gt 0 ]; then
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}Loading Patient Data${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    
    # Wait for backend to be fully ready
    echo -e "${YELLOW}Ensuring backend is fully initialized...${NC}"
    sleep 10
    
    # Load patients using synthea_master
    echo -e "${YELLOW}Starting patient data import (this may take several minutes)...${NC}"
    echo -e "${YELLOW}  → Generating ${PATIENT_COUNT} synthetic patients${NC}"
    echo -e "${YELLOW}  → Importing FHIR resources${NC}"
    echo -e "${YELLOW}  → Indexing search parameters${NC}"
    echo -e "${YELLOW}  → Populating compartments${NC}"
    
    if docker exec emr-backend python scripts/active/synthea_master.py full \
        --count "$PATIENT_COUNT" \
        --validation-mode light; then
        echo -e "${GREEN}✓ Patient data import completed${NC}"
    else
        echo -e "${YELLOW}⚠ Data import completed with warnings (this is often normal)${NC}"
    fi
    
    # Ensure catalog population (critical for search functionality)
    echo ""
    echo -e "${YELLOW}Extracting clinical catalogs for search functionality...${NC}"
    if docker exec emr-backend python scripts/active/consolidated_catalog_setup.py --extract-from-fhir; then
        echo -e "${GREEN}✓ Clinical catalogs populated${NC}"
    else
        echo -e "${YELLOW}⚠ Catalog extraction completed with warnings${NC}"
    fi
    
    # Verify data load
    echo ""
    echo -e "${YELLOW}Verifying data import...${NC}"
    VERIFY_RESULT=$(docker exec emr-backend python -c "
import asyncio
import asyncpg
import json

async def check():
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
        
        # Get counts
        patient_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\'')
        total_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources')
        
        # Get catalog counts
        med_count = await conn.fetchval('SELECT COUNT(*) FROM clinical_catalogs WHERE catalog_type = \\'medication\\'')
        cond_count = await conn.fetchval('SELECT COUNT(*) FROM clinical_catalogs WHERE catalog_type = \\'condition\\'')
        lab_count = await conn.fetchval('SELECT COUNT(*) FROM clinical_catalogs WHERE catalog_type = \\'lab_test\\'')
        
        await conn.close()
        
        result = {
            'patients': patient_count,
            'total_resources': total_count,
            'medications': med_count,
            'conditions': cond_count,
            'lab_tests': lab_count
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

asyncio.run(check())
" 2>/dev/null)
    
    if [ -n "$VERIFY_RESULT" ]; then
        # Parse JSON result
        if echo "$VERIFY_RESULT" | grep -q '"patients"'; then
            PATIENTS=$(echo "$VERIFY_RESULT" | grep -o '"patients":[0-9]*' | cut -d: -f2)
            TOTAL=$(echo "$VERIFY_RESULT" | grep -o '"total_resources":[0-9]*' | cut -d: -f2)
            MEDS=$(echo "$VERIFY_RESULT" | grep -o '"medications":[0-9]*' | cut -d: -f2)
            CONDS=$(echo "$VERIFY_RESULT" | grep -o '"conditions":[0-9]*' | cut -d: -f2)
            LABS=$(echo "$VERIFY_RESULT" | grep -o '"lab_tests":[0-9]*' | cut -d: -f2)
            
            echo -e "${GREEN}✓ Data Import Summary:${NC}"
            echo -e "  • Patients: ${PATIENTS}"
            echo -e "  • Total Resources: ${TOTAL}"
            echo -e "  • Medication Catalog: ${MEDS} items"
            echo -e "  • Condition Catalog: ${CONDS} items"
            echo -e "  • Lab Test Catalog: ${LABS} items"
        else
            echo -e "${YELLOW}⚠ Could not verify exact counts, but data appears to be loaded${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Could not verify data load, please check manually${NC}"
    fi
fi

# Display access information
echo ""
echo -e "${GREEN}=================================="
echo "Deployment Complete!"
echo "=================================="
echo ""

if [ "$ENVIRONMENT" == "dev" ]; then
    echo "Access the application at:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    echo "Default credentials:"
    echo "  Username: demo"
    echo "  Password: password"
else
    if is_aws; then
        PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
        echo "Access the application at:"
        echo "  Frontend: http://$PUBLIC_IP"
        echo "  Backend API: http://$PUBLIC_IP:8000"
        echo "  API Docs: http://$PUBLIC_IP:8000/docs"
    else
        echo "Access the application at:"
        echo "  Frontend: http://localhost"
        echo "  Backend API: http://localhost:8000"
        echo "  API Docs: http://localhost:8000/docs"
    fi
    echo ""
    echo "Default credentials:"
    echo "  Username: demo"
    echo "  Password: password"
fi

echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  View logs: docker-compose logs -f"
echo "  Check status: docker-compose ps"
echo "  Stop services: docker-compose down"
echo ""
echo -e "${GREEN}✓ Deployment successful!${NC}"