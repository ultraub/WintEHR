#!/bin/bash

# MedGenEMR Fresh Deployment Script
# Complete clean deployment with realistic DICOM and imaging reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}     MedGenEMR Fresh Deployment${NC}"
echo -e "${BLUE}================================================${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Clean up existing containers and volumes
echo -e "${YELLOW}🧹 Cleaning up existing deployment...${NC}"
docker-compose down -v 2>/dev/null || true
docker system prune -f > /dev/null 2>&1

# Remove old data
echo -e "${YELLOW}🗑️  Removing old data...${NC}"
rm -rf backend/data/generated_dicoms/* 2>/dev/null || true
rm -rf backend/data/dicom_uploads/* 2>/dev/null || true
rm -rf synthea/output/fhir/*.json 2>/dev/null || true

# Ensure scripts have correct permissions
echo -e "${YELLOW}🔧 Setting script permissions...${NC}"
chmod +x backend/docker-entrypoint.sh
chmod +x backend/scripts/*.py

# Fix line endings for shell scripts
echo -e "${YELLOW}🔧 Fixing line endings...${NC}"
if command -v dos2unix > /dev/null 2>&1; then
    find . -name "*.sh" -exec dos2unix {} \; 2>/dev/null || true
else
    # Manual fix for macOS without dos2unix
    find . -name "*.sh" -exec sed -i '' 's/\r$//' {} \; 2>/dev/null || true
fi

# Build containers
echo -e "${BLUE}🔨 Building Docker containers...${NC}"
docker-compose build --no-cache

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
sleep 15

# Check if backend is healthy
MAX_TRIES=30
COUNTER=0
while [ $COUNTER -lt $MAX_TRIES ]; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
        break
    fi
    COUNTER=$((COUNTER+1))
    if [ $COUNTER -eq $MAX_TRIES ]; then
        echo -e "${RED}❌ Backend failed to start after ${MAX_TRIES} attempts${NC}"
        docker-compose logs backend
        exit 1
    fi
    sleep 2
done

# Run comprehensive validation
echo -e "${YELLOW}🔍 Running comprehensive deployment validation...${NC}"
docker-compose exec -T backend python /app/scripts/validate_deployment.py --docker --verbose || {
    echo -e "${RED}❌ Deployment validation failed${NC}"
    docker-compose logs backend
    exit 1
}

# Generate test data
PATIENT_COUNT=${PATIENT_COUNT:-10}
echo -e "${BLUE}👥 Generating ${PATIENT_COUNT} test patients with complete data...${NC}"
docker-compose exec -T backend python scripts/synthea_master.py full \
    --count ${PATIENT_COUNT} \
    --include-dicom \
    --clean-names \
    --validation-mode transform_only || {
    echo -e "${RED}❌ Failed to generate test data${NC}"
    exit 1
}

# Wait for data to be processed
sleep 5

# Verify data generation
echo -e "${YELLOW}🔍 Verifying data generation...${NC}"
echo -n "Patients: "
docker-compose exec -T backend python -c "
import asyncio
import asyncpg

async def count():
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    count = await conn.fetchval(\"\"\"
        SELECT COUNT(*) FROM fhir.resources 
        WHERE resource_type = 'Patient' AND deleted = false
    \"\"\")
    print(count)
    await conn.close()

asyncio.run(count())
" || echo "0"

echo -n "ImagingStudy: "
docker-compose exec -T backend python -c "
import asyncio
import asyncpg

async def count():
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    count = await conn.fetchval(\"\"\"
        SELECT COUNT(*) FROM fhir.resources 
        WHERE resource_type = 'ImagingStudy' AND deleted = false
    \"\"\")
    print(count)
    await conn.close()

asyncio.run(count())
" || echo "0"

echo -n "DiagnosticReport: "
docker-compose exec -T backend python -c "
import asyncio
import asyncpg

async def count():
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    count = await conn.fetchval(\"\"\"
        SELECT COUNT(*) FROM fhir.resources 
        WHERE resource_type = 'DiagnosticReport' AND deleted = false
    \"\"\")
    print(count)
    await conn.close()

asyncio.run(count())
" || echo "0"

# Check DICOM files
echo -n "DICOM directories: "
docker-compose exec -T backend bash -c "ls -1 /app/data/generated_dicoms 2>/dev/null | wc -l" || echo "0"

# Run frontend build
echo -e "${BLUE}🎨 Building frontend...${NC}"
cd frontend
npm run build || {
    echo -e "${YELLOW}⚠️  Frontend build failed, but continuing...${NC}"
}
cd ..

# Copy built frontend to nginx
echo -e "${BLUE}📦 Deploying frontend...${NC}"
docker-compose exec -T frontend sh -c "cp -r /app/build/* /usr/share/nginx/html/" || true

# Display access information
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 MedGenEMR Fresh Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}📋 Access Points:${NC}"
echo -e "   🌐 Frontend:    http://localhost"
echo -e "   🔧 Backend:     http://localhost:8000"
echo -e "   📚 API Docs:    http://localhost:8000/docs"
echo -e "   🔍 FHIR API:    http://localhost:8000/fhir/R4"
echo ""
echo -e "${BLUE}✨ Features Included:${NC}"
echo -e "   🩻 Realistic DICOM images with multiple slices"
echo -e "   📄 Imaging reports linked to studies"
echo -e "   💊 Pharmacy workflows with dispensing"
echo -e "   📊 Lab results with reference ranges"
echo -e "   🔄 Cross-module clinical integration"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   - Use 'docker-compose logs -f' to view logs"
echo -e "   - Use 'make down' to stop services"
echo -e "   - Use 'make clean' to remove all data"
echo ""

# Optional: Open browser
if command -v open > /dev/null 2>&1; then
    echo -e "${BLUE}🌐 Opening MedGenEMR in browser...${NC}"
    sleep 2
    open http://localhost
elif command -v xdg-open > /dev/null 2>&1; then
    xdg-open http://localhost
fi