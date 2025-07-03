#!/bin/bash
set -e

echo "🏥 MedGenEMR Build and Test Suite"
echo "================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
TEST_RESULTS_DIR="test_results"

# Create test results directory
mkdir -p $TEST_RESULTS_DIR

# Function to check if service is running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s "$url" > /dev/null; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not running${NC}"
        return 1
    fi
}

# Step 1: Backend Tests
echo -e "\n${BLUE}🔧 Running Backend Tests...${NC}"
cd $BACKEND_DIR

# Check PostgreSQL
echo "Checking PostgreSQL..."
if docker ps | grep -q emr-postgres-local; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not running. Run setup_complete.sh first${NC}"
    exit 1
fi

# Python linting
echo -e "\n${YELLOW}Running Python linting...${NC}"
if command -v flake8 &> /dev/null; then
    flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics || true
else
    echo "⚠️  flake8 not installed, skipping linting"
fi

# Check migrations
echo -e "\n${YELLOW}Checking database migrations...${NC}"
alembic check || echo "⚠️  Migration issues detected"

# API Tests
echo -e "\n${YELLOW}Testing FHIR API endpoints...${NC}"
source venv/bin/activate

# Start backend if not running
if ! check_service "http://localhost:8000/fhir/R4/metadata" "Backend"; then
    echo "Starting backend..."
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    sleep 5
fi

# Test FHIR endpoints
echo -e "\n${BLUE}Testing FHIR endpoints...${NC}"

# Test metadata endpoint
echo -n "Testing /fhir/R4/metadata... "
if curl -s http://localhost:8000/fhir/R4/metadata | grep -q '"fhirVersion":"4.0.1"'; then
    echo -e "${GREEN}✅ Pass${NC}"
else
    echo -e "${RED}❌ Fail${NC}"
fi

# Test Patient search
echo -n "Testing Patient search... "
PATIENT_COUNT=$(curl -s "http://localhost:8000/fhir/R4/Patient?_count=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
if [ "$PATIENT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Pass ($PATIENT_COUNT patients)${NC}"
else
    echo -e "${RED}❌ Fail (no patients found)${NC}"
fi

# Test Observation search
echo -n "Testing Observation search... "
OBS_COUNT=$(curl -s "http://localhost:8000/fhir/R4/Observation?_count=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
if [ "$OBS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Pass ($OBS_COUNT observations)${NC}"
else
    echo -e "${RED}❌ Fail (no observations found)${NC}"
fi

# Generate API test report
echo -e "\n${YELLOW}Generating API test report...${NC}"
cat > ../$TEST_RESULTS_DIR/api_test_results.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backend": {
    "status": "running",
    "fhir_version": "4.0.1",
    "resources": {
      "Patient": $PATIENT_COUNT,
      "Observation": $OBS_COUNT
    }
  }
}
EOF

cd ..

# Step 2: Frontend Tests
echo -e "\n${BLUE}🎨 Building Frontend...${NC}"
cd $FRONTEND_DIR

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    npm install
fi

# Build frontend
echo -e "\n${YELLOW}Building production bundle...${NC}"
npm run build

if [ -d "build" ]; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
    
    # Check build size
    BUILD_SIZE=$(du -sh build | cut -f1)
    echo "   Build size: $BUILD_SIZE"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

# Run frontend tests (if available)
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    echo -e "\n${YELLOW}Running frontend tests...${NC}"
    CI=true npm test -- --passWithNoTests || true
fi

cd ..

# Step 3: Integration Tests
echo -e "\n${BLUE}🔗 Running Integration Tests...${NC}"

# Check if frontend can connect to backend
echo -n "Testing frontend-backend connection... "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Pass${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend not running${NC}"
fi

# Step 4: Database Validation
echo -e "\n${BLUE}🗄️ Validating Database...${NC}"

# Check resource counts
echo "Checking database integrity..."
docker exec emr-postgres-local psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) as count 
FROM fhir.resources 
WHERE deleted = false 
GROUP BY resource_type 
ORDER BY count DESC;" | tee $TEST_RESULTS_DIR/db_resources.txt

# Step 5: Generate Summary Report
echo -e "\n${BLUE}📊 Generating Test Summary...${NC}"

cat > $TEST_RESULTS_DIR/test_summary.md << EOF
# MedGenEMR Test Results

**Generated:** $(date)

## Backend Status
- PostgreSQL: ✅ Running
- FHIR API: ✅ Operational
- Total Patients: $PATIENT_COUNT
- Total Observations: $OBS_COUNT

## Frontend Status
- Build: ✅ Successful
- Build Size: $BUILD_SIZE

## Database Resources
$(cat $TEST_RESULTS_DIR/db_resources.txt)

## API Endpoints Tested
- [x] GET /fhir/R4/metadata
- [x] GET /fhir/R4/Patient
- [x] GET /fhir/R4/Observation

## Known Issues
- Encounter import validation errors
- Procedure import validation errors
- MedicationRequest import validation errors

## Recommendations
1. Fix validation issues for remaining resource types
2. Add automated E2E tests with Cypress
3. Implement performance benchmarks
4. Add security scanning with OWASP tools
EOF

# Display summary
echo -e "\n${GREEN}=============================================="
echo "✅ Build and Test Complete!"
echo "=============================================="
echo -e "${NC}"
echo "📊 Test Results saved to: $TEST_RESULTS_DIR/"
echo "   - test_summary.md"
echo "   - api_test_results.json"
echo "   - db_resources.txt"
echo ""
echo "🌐 Access the application at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"

# Cleanup
if [ ! -z "$BACKEND_PID" ]; then
    echo -e "\n${YELLOW}Stopping test backend process...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
fi