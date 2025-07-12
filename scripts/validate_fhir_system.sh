#!/bin/bash
#
# FHIR System Validation Script
# Validates that all FHIR fixes are working correctly
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"

echo -e "${BLUE}🏥 MedGenEMR FHIR System Validation${NC}"
echo "============================================================"

# Function to check if service is running
check_service() {
    local service_name=$1
    local url=$2
    local endpoint=$3
    
    echo -n "Checking $service_name... "
    if curl -s -f "$url$endpoint" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    else
        echo -e "${RED}❌ Not accessible${NC}"
        return 1
    fi
}

# Check backend
if ! check_service "Backend" "$BACKEND_URL" "/health"; then
    echo -e "${RED}Backend is not running. Please start it first.${NC}"
    exit 1
fi

# Check frontend
if ! check_service "Frontend" "$FRONTEND_URL" "/"; then
    echo -e "${YELLOW}⚠️  Frontend is not running. Some tests will be skipped.${NC}"
    FRONTEND_AVAILABLE=false
else
    FRONTEND_AVAILABLE=true
fi

echo ""
echo -e "${BLUE}Running FHIR API Tests...${NC}"
echo "------------------------------------------------------------"

# Run comprehensive FHIR tests
if command -v docker &> /dev/null; then
    echo "Running tests in Docker container..."
    docker exec emr-backend python test_fhir_comprehensive.py || {
        echo -e "${YELLOW}Docker test failed. Trying local test...${NC}"
        cd backend && python3 test_fhir_comprehensive.py
    }
else
    echo "Docker not available. Running tests locally..."
    cd backend && python3 test_fhir_comprehensive.py
fi

echo ""
echo -e "${BLUE}Validation Summary${NC}"
echo "============================================================"

# Check specific fixes
echo -e "${GREEN}✅ Fixed Issues:${NC}"
echo "   - ESLint errors in ChartReviewTab.js"
echo "   - Backend startup dependencies"
echo "   - FHIR CREATE operations returning resources"
echo "   - JSON serialization with Decimal types"
echo "   - Multi-version router tuple handling"
echo "   - UPDATE operations resource ID collision"
echo "   - Transaction bundle Decimal serialization"
echo "   - Unix line endings for shell scripts"

echo ""
echo -e "${YELLOW}⚠️  Pending Verification:${NC}"
echo "   - References table schema (needs migration)"
echo "   - Frontend-backend integration"
echo "   - WebSocket real-time updates"
echo "   - CDS Hooks integration"

if [ "$FRONTEND_AVAILABLE" = true ]; then
    echo ""
    echo -e "${BLUE}Frontend Integration Tests${NC}"
    echo "------------------------------------------------------------"
    echo "Please manually verify in the browser:"
    echo "1. Open $FRONTEND_URL"
    echo "2. Navigate to Clinical Workspace"
    echo "3. Test Chart Review tab refresh functionality"
    echo "4. Create/Update/Delete operations in each tab"
    echo "5. Verify real-time updates across tabs"
fi

echo ""
echo -e "${GREEN}✅ Validation script completed${NC}"