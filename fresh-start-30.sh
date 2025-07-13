#!/bin/bash

# Fresh start script for MedGenEMR with 30 patients
# This script clears everything and starts fresh with 30 Synthea patients

set -e  # Exit on error

echo "🧹 MedGenEMR Fresh Start Script - 30 Patients"
echo "============================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Clean up any existing containers and volumes
echo -e "\n${YELLOW}Step 1: Cleaning up existing Docker resources...${NC}"
docker-compose down -v || true
docker system prune -f || true

# Step 2: Start the services
echo -e "\n${YELLOW}Step 2: Starting Docker services...${NC}"
docker-compose up -d

# Step 3: Wait for services to be healthy
echo -e "\n${YELLOW}Step 3: Waiting for services to be ready...${NC}"
echo "Waiting for PostgreSQL..."
until docker exec emr-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

echo "Waiting for backend..."
until curl -s http://localhost:8000/health > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Step 4: Initialize the database
echo -e "\n${YELLOW}Step 4: Initializing database...${NC}"
docker exec emr-backend python scripts/init_database_definitive.py

# Step 5: Generate and import 30 Synthea patients
echo -e "\n${YELLOW}Step 5: Generating and importing 30 Synthea patients...${NC}"
docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py full --count 30"

# Step 6: Run data processing scripts
echo -e "\n${YELLOW}Step 6: Running data processing scripts...${NC}"

# Clean patient names
echo "Cleaning patient names..."
docker exec emr-backend python scripts/clean_patient_names.py

# Enhance lab results with reference ranges
echo "Adding reference ranges to lab results..."
docker exec emr-backend python scripts/enhance_lab_results.py

# Step 7: Populate references table
echo -e "\n${YELLOW}Step 7: Populating references table...${NC}"
docker exec emr-backend python scripts/populate_references_table.py

# Step 8: Generate DICOM studies
echo -e "\n${YELLOW}Step 8: Generating DICOM studies...${NC}"
docker exec emr-backend python scripts/generate_dicom_for_studies.py

# Step 9: Verify the deployment
echo -e "\n${YELLOW}Step 9: Verifying deployment...${NC}"
docker exec emr-backend python scripts/validate_deployment.py --verbose

# Step 10: Show summary
echo -e "\n${GREEN}✨ Fresh start complete!${NC}"
echo -e "\n${YELLOW}Summary:${NC}"
echo "- Database initialized with FHIR schema"
echo "- 30 Synthea patients generated and imported"
echo "- Patient/provider names cleaned"
echo "- Lab results enhanced with reference ranges"
echo "- References table populated"
echo "- DICOM studies generated"
echo ""
echo -e "${GREEN}Access the application at:${NC}"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:8000"
echo "- API Documentation: http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}Default login credentials:${NC}"
echo "- Username: demo"
echo "- Password: password"