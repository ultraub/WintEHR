#!/bin/bash

# Check Frontend for Errors
# This script checks the frontend for compilation errors and runtime issues

set -e

echo "🔍 Checking Frontend for Errors"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the project root
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Function to check if container is running
check_container() {
    if docker ps --format '{{.Names}}' | grep -q "^$1$"; then
        return 0
    else
        return 1
    fi
}

echo "1️⃣  Checking Docker containers..."
if ! check_container "emr-frontend"; then
    echo -e "${YELLOW}Frontend container not running. Starting containers...${NC}"
    docker-compose up -d frontend
    echo "Waiting for frontend to start..."
    sleep 10
fi

echo -e "${GREEN}✓ Containers running${NC}"

echo -e "\n2️⃣  Checking for TypeScript/JavaScript errors..."
# Run lint check
docker exec emr-frontend npm run lint 2>&1 | tee lint-results.log || true

# Check if there were any errors
if grep -q "error" lint-results.log; then
    echo -e "${RED}❌ Linting errors found!${NC}"
    ERROR_COUNT=$(grep -c "error" lint-results.log)
    echo -e "${RED}Total errors: $ERROR_COUNT${NC}"
else
    echo -e "${GREEN}✓ No linting errors${NC}"
fi

echo -e "\n3️⃣  Checking for compilation errors..."
# Try to build the frontend
docker exec emr-frontend npm run build 2>&1 | tee build-results.log || true

# Check build results
if grep -q "ERROR" build-results.log || grep -q "Failed to compile" build-results.log; then
    echo -e "${RED}❌ Compilation errors found!${NC}"
    grep -A 5 -B 5 "ERROR\|Failed to compile" build-results.log
else
    echo -e "${GREEN}✓ Build successful${NC}"
fi

echo -e "\n4️⃣  Checking for missing dependencies..."
# Check for missing imports in enhanced dialogs
DIALOG_FILES=(
    "AllergyDialogEnhanced.js"
    "ImmunizationDialogEnhanced.js"
    "ProcedureDialogEnhanced.js"
    "ObservationDialogEnhanced.js"
    "DiagnosticReportDialogEnhanced.js"
    "ServiceRequestDialogEnhanced.js"
    "MedicationDialogEnhanced.js"
    "ConditionDialogEnhanced.js"
)

for dialog in "${DIALOG_FILES[@]}"; do
    echo -n "Checking $dialog... "
    if docker exec emr-frontend test -f "src/components/clinical/workspace/dialogs/$dialog"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ File not found${NC}"
    fi
done

echo -e "\n5️⃣  Checking for console errors in running app..."
# Get recent frontend logs
docker logs emr-frontend --tail 100 2>&1 | grep -i "error\|warning\|failed" | tail -20 || true

echo -e "\n6️⃣  Quick API connectivity test..."
# Test if frontend can reach backend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|304"; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    echo -e "${RED}✗ Frontend not accessible${NC}"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs | grep -q "200"; then
    echo -e "${GREEN}✓ Backend API is accessible${NC}"
else
    echo -e "${RED}✗ Backend API not accessible${NC}"
fi

echo -e "\n7️⃣  Checking for import errors in enhanced dialogs..."
# Check specific import issues we fixed
for dialog in "${DIALOG_FILES[@]}"; do
    echo -n "Checking imports in $dialog... "
    IMPORT_ERRORS=$(docker exec emr-frontend grep -n "../../../../" "src/components/clinical/workspace/dialogs/$dialog" 2>/dev/null | wc -l || echo "0")
    if [ "$IMPORT_ERRORS" -gt 0 ]; then
        echo -e "${RED}✗ Found incorrect import paths${NC}"
    else
        echo -e "${GREEN}✓${NC}"
    fi
done

echo -e "\n8️⃣  Summary Report"
echo "==================="

# Clean up log files
rm -f lint-results.log build-results.log

# Generate summary
if [ -f "error-report.json" ]; then
    echo "Error report available at: error-report.json"
fi

echo -e "\n${GREEN}✅ Frontend error check complete!${NC}"
echo "To run a full E2E test with Playwright, use:"
echo "  cd frontend && npm install playwright"
echo "  node tests/e2e/check-all-pages.js"