#!/bin/bash

# WintEHR Quick Start Script
# For rapid local development with minimal setup

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 WintEHR Quick Start${NC}"
echo -e "${BLUE}========================${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo -e "${RED}Error: Please run this script from the WintEHR root directory${NC}"
    exit 1
fi

# Stop existing services
echo -e "${YELLOW}🔄 Stopping existing services...${NC}"
docker-compose down -v --remove-orphans >/dev/null 2>&1 || true
pkill -f "uvicorn\|npm start" >/dev/null 2>&1 || true

# Start containers
echo -e "${BLUE}🚀 Starting containers...${NC}"
docker-compose up -d

# Wait for backend
echo -e "${YELLOW}⏳ Waiting for services...${NC}"
while ! curl -s http://localhost:8000/health >/dev/null 2>&1; do
    sleep 2
done

# Initialize database
echo -e "${BLUE}🗄️  Initializing database...${NC}"
docker exec emr-backend python scripts/init_database_definitive.py

# Create a few test patients via API for immediate testing
echo -e "${BLUE}👥 Creating test patients...${NC}"
curl -s -X POST http://localhost:8000/fhir/R4/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "identifier": [{"value": "test-patient-001"}],
    "name": [{"family": "Smith", "given": ["John"]}],
    "gender": "male",
    "birthDate": "1980-01-15"
  }' >/dev/null

curl -s -X POST http://localhost:8000/fhir/R4/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "identifier": [{"value": "test-patient-002"}],
    "name": [{"family": "Johnson", "given": ["Jane"]}],
    "gender": "female",
    "birthDate": "1975-06-20"
  }' >/dev/null

echo -e "${GREEN}✅ Quick start complete!${NC}"
echo ""
echo -e "${BLUE}📋 Access Points:${NC}"
echo -e "   🌐 Frontend:  http://localhost:3000"
echo -e "   🔧 Backend:   http://localhost:8000"
echo -e "   📚 API Docs:  http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}💡 For full deployment with patient data: ./deploy.sh${NC}"
echo -e "${YELLOW}💡 To stop: docker-compose down${NC}"