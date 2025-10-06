#!/bin/bash

# WintEHR Azure Production Deployment Script
# Automated deployment for Azure cloud with HAPI FHIR

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   WintEHR Azure Deployment Script     ║${NC}"
echo -e "${GREEN}║   HAPI FHIR Production Setup           ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo ""

# Handle special commands
case "$1" in
    stop)
        echo -e "${YELLOW}Stopping WintEHR services...${NC}"
        docker-compose -f docker-compose.yml down
        echo -e "${GREEN}✓ Services stopped${NC}"
        exit 0
        ;;
    restart)
        echo -e "${YELLOW}Restarting WintEHR services...${NC}"
        docker-compose -f docker-compose.yml restart
        echo -e "${GREEN}✓ Services restarted${NC}"
        exit 0
        ;;
    clean)
        echo -e "${RED}⚠  WARNING: This will delete ALL data including patient records!${NC}"
        read -p "Type 'DELETE ALL DATA' to confirm: " confirm
        if [ "$confirm" == "DELETE ALL DATA" ]; then
            echo -e "${YELLOW}Cleaning WintEHR deployment...${NC}"
            docker-compose -f docker-compose.yml down -v
            docker system prune -af
            echo -e "${GREEN}✓ Clean complete${NC}"
        else
            echo -e "${YELLOW}Clean cancelled${NC}"
        fi
        exit 0
        ;;
    status)
        echo -e "${BLUE}WintEHR Service Status:${NC}"
        docker-compose -f docker-compose.yml ps
        echo ""
        echo -e "${BLUE}HAPI FHIR Server:${NC}"
        curl -s http://localhost:8888/fhir/metadata | grep -q "fhirVersion" && echo "✓ HAPI FHIR is healthy" || echo "✗ HAPI FHIR is not responding"
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
            docker-compose -f docker-compose.yml logs -f --tail=100
        else
            docker-compose -f docker-compose.yml logs -f --tail=100 "$SERVICE"
        fi
        exit 0
        ;;
esac

# Configuration
PATIENT_COUNT=${1:-50}  # Default 50 patients for production

echo "Configuration:"
echo "  Environment: PRODUCTION (Azure)"
echo "  Patient Count: $PATIENT_COUNT"
echo "  HAPI FHIR: Enabled"
echo ""

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

# Function to wait for HAPI FHIR
wait_for_hapi() {
    local max_attempts=120
    local attempt=0

    echo -e "${YELLOW}Waiting for HAPI FHIR server (this may take a few minutes)...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:8888/fhir/metadata &>/dev/null; then
            echo -e "${GREEN}✓ HAPI FHIR server is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 3
    done
    echo -e "${RED}✗ HAPI FHIR server failed to start${NC}"
    return 1
}

# Function to wait for backend
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
    local max_attempts=60
    local attempt=0

    echo -e "${YELLOW}Waiting for Frontend...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:3000 &>/dev/null; then
            echo -e "${GREEN}✓ Frontend is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "${YELLOW}⚠ Frontend may still be starting${NC}"
    return 0
}

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}✓ Docker installed${NC}"
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

# Create necessary directories
echo -e "${YELLOW}Creating required directories...${NC}"
mkdir -p logs data/generated_dicoms
echo -e "${GREEN}✓ Directories created${NC}"

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.yml down || true

# Build for production
echo -e "${GREEN}Building production images...${NC}"
docker-compose -f docker-compose.yml build --no-cache

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose -f docker-compose.yml up -d

# Wait for services to be ready
echo -e "${BLUE}Waiting for services to initialize...${NC}"
sleep 10

# Wait for database
if ! wait_for_postgres; then
    echo -e "${RED}PostgreSQL failed to start. Checking logs...${NC}"
    docker-compose -f docker-compose.yml logs --tail=30 postgres
    echo -e "${YELLOW}Attempting restart...${NC}"
    docker-compose -f docker-compose.yml restart postgres
    sleep 10
    wait_for_postgres || {
        echo -e "${RED}PostgreSQL still not responding. Deployment failed.${NC}"
        exit 1
    }
fi

# Wait for HAPI FHIR
if ! wait_for_hapi; then
    echo -e "${RED}HAPI FHIR failed to start. Checking logs...${NC}"
    docker-compose -f docker-compose.yml logs --tail=30 hapi-fhir
    echo -e "${YELLOW}Attempting restart...${NC}"
    docker-compose -f docker-compose.yml restart hapi-fhir
    sleep 15
    wait_for_hapi || {
        echo -e "${RED}HAPI FHIR still not responding. Deployment failed.${NC}"
        exit 1
    }
fi

# Wait for backend
if ! wait_for_backend; then
    echo -e "${RED}Backend failed to start. Checking logs...${NC}"
    docker-compose -f docker-compose.yml logs --tail=30 backend
    echo -e "${YELLOW}Attempting restart...${NC}"
    docker-compose -f docker-compose.yml restart backend
    sleep 10
    wait_for_backend || {
        echo -e "${RED}Backend still not responding. Deployment failed.${NC}"
        exit 1
    }
fi

# Wait for frontend
wait_for_frontend

# Load patient data
if [ "$PATIENT_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}  Loading Patient Data via HAPI FHIR  ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"

    echo -e "${YELLOW}Starting patient data import (this may take several minutes)...${NC}"
    echo -e "${YELLOW}  → Generating ${PATIENT_COUNT} synthetic patients${NC}"
    echo -e "${YELLOW}  → Uploading to HAPI FHIR server${NC}"
    echo -e "${YELLOW}  → Verifying data integrity${NC}"

    if docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py "$PATIENT_COUNT" Massachusetts; then
        echo -e "${GREEN}✓ Patient data loaded to HAPI FHIR${NC}"
    else
        echo -e "${RED}✗ Data load failed${NC}"
        echo -e "${YELLOW}You can retry later with: docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py $PATIENT_COUNT Massachusetts${NC}"
    fi

    # Populate clinical catalogs
    echo ""
    echo -e "${YELLOW}Extracting clinical catalogs...${NC}"
    if docker exec emr-backend python scripts/active/consolidated_catalog_setup.py --extract-from-fhir; then
        echo -e "${GREEN}✓ Clinical catalogs populated${NC}"
    else
        echo -e "${YELLOW}⚠ Catalog extraction completed with warnings${NC}"
    fi

    # Verify data
    echo ""
    echo -e "${YELLOW}Verifying data import...${NC}"
    VERIFY_RESULT=$(docker exec emr-backend python -c "
import asyncio
import asyncpg
import json

async def check():
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')

        patient_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\'')
        total_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources')
        med_count = await conn.fetchval('SELECT COUNT(*) FROM clinical_catalogs WHERE catalog_type = \\'medication\\'')
        cond_count = await conn.fetchval('SELECT COUNT(*) FROM clinical_catalogs WHERE catalog_type = \\'condition\\'')

        await conn.close()

        result = {
            'patients': patient_count,
            'total_resources': total_count,
            'medications': med_count,
            'conditions': cond_count
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

asyncio.run(check())
" 2>/dev/null)

    if [ -n "$VERIFY_RESULT" ] && echo "$VERIFY_RESULT" | grep -q '"patients"'; then
        PATIENTS=$(echo "$VERIFY_RESULT" | grep -o '"patients":[0-9]*' | cut -d: -f2)
        TOTAL=$(echo "$VERIFY_RESULT" | grep -o '"total_resources":[0-9]*' | cut -d: -f2)
        MEDS=$(echo "$VERIFY_RESULT" | grep -o '"medications":[0-9]*' | cut -d: -f2)
        CONDS=$(echo "$VERIFY_RESULT" | grep -o '"conditions":[0-9]*' | cut -d: -f2)

        echo -e "${GREEN}✓ Data Import Summary:${NC}"
        echo -e "  • Patients: ${PATIENTS}"
        echo -e "  • Total Resources: ${TOTAL}"
        echo -e "  • Medication Catalog: ${MEDS} items"
        echo -e "  • Condition Catalog: ${CONDS} items"
    else
        echo -e "${YELLOW}⚠ Could not verify counts${NC}"
    fi
fi

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')

# Display access information
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Deployment Complete!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo -e "  Frontend:    http://${PUBLIC_IP}:3000"
echo -e "  Backend API: http://${PUBLIC_IP}:8000"
echo -e "  API Docs:    http://${PUBLIC_IP}:8000/docs"
echo -e "  HAPI FHIR:   http://${PUBLIC_IP}:8888/fhir"
echo ""
echo -e "${BLUE}Default credentials:${NC}"
echo "  Username: demo"
echo "  Password: password"
echo ""
echo -e "${YELLOW}Management Commands:${NC}"
echo "  View logs:     ./azure-deploy.sh logs [service]"
echo "  Check status:  ./azure-deploy.sh status"
echo "  Stop services: ./azure-deploy.sh stop"
echo "  Restart:       ./azure-deploy.sh restart"
echo "  Clean all:     ./azure-deploy.sh clean"
echo ""
echo -e "${GREEN}✓ WintEHR is now running on Azure!${NC}"
