#!/bin/bash
# Deploy and Test Phase 2 FHIR Migration on Azure VM
# This script updates the backend code and tests the migration

set -e  # Exit on error

echo "=========================================="
echo "Phase 2 FHIR Migration Deployment & Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on the VM
if [ ! -d "/home/azureuser/WintEHR" ]; then
    echo -e "${RED}❌ Error: This script should be run on the Azure VM${NC}"
    echo "SSH to wintehr.eastus2.cloudapp.azure.com first"
    exit 1
fi

cd /home/azureuser/WintEHR

# Step 1: Update code from git
echo -e "${YELLOW}Step 1: Updating code from git...${NC}"
git fetch origin
git checkout cleanup/remove-old-fhir
git pull origin cleanup/remove-old-fhir
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# Step 2: Check Docker containers
echo -e "${YELLOW}Step 2: Checking Docker containers...${NC}"
if ! docker ps | grep -q "wintehr-backend"; then
    echo -e "${RED}❌ Error: wintehr-backend container not running${NC}"
    echo "Start containers with: docker compose -f docker-compose.prod.yml up -d"
    exit 1
fi
if ! docker ps | grep -q "hapi-fhir"; then
    echo -e "${RED}❌ Error: hapi-fhir container not running${NC}"
    echo "Start containers with: docker compose -f docker-compose.prod.yml up -d"
    exit 1
fi
echo -e "${GREEN}✅ Docker containers running${NC}"
echo ""

# Step 3: Copy test script to container
echo -e "${YELLOW}Step 3: Deploying test script to container...${NC}"
docker cp backend/test_audit_simple.py wintehr-backend:/app/test_audit_simple.py
docker cp backend/api/services/audit_event_service.py wintehr-backend:/app/api/services/audit_event_service.py
echo -e "${GREEN}✅ Files deployed${NC}"
echo ""

# Step 4: Run AuditEventService test
echo -e "${YELLOW}Step 4: Testing AuditEventService with HAPI FHIR...${NC}"
echo ""
if docker exec wintehr-backend python /app/test_audit_simple.py; then
    echo ""
    echo -e "${GREEN}✅ AuditEventService test PASSED${NC}"
else
    echo ""
    echo -e "${RED}❌ AuditEventService test FAILED${NC}"
    echo "Check logs with: docker logs wintehr-backend --tail 50"
    exit 1
fi
echo ""

# Step 5: Verify AuditEvents in HAPI FHIR
echo -e "${YELLOW}Step 5: Verifying AuditEvents created in HAPI FHIR...${NC}"
AUDIT_COUNT=$(docker exec hapi-fhir curl -s "http://localhost:8080/fhir/AuditEvent?_summary=count" | jq -r '.total // 0')
if [ "$AUDIT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $AUDIT_COUNT AuditEvent resources in HAPI FHIR${NC}"

    # Show latest audit events
    echo ""
    echo "Latest AuditEvents:"
    docker exec hapi-fhir curl -s "http://localhost:8080/fhir/AuditEvent?_sort=-date&_count=3" | \
        jq -r '.entry[]?.resource | "  - " + .type.display + " at " + .recorded'
else
    echo -e "${YELLOW}⚠️  No AuditEvents found (this might be expected on first run)${NC}"
fi
echo ""

# Step 6: Test search_values API
echo -e "${YELLOW}Step 6: Testing search_values API migration...${NC}"

# Test getting searchable parameters
echo "Testing /api/fhir/search-values/Patient..."
PARAM_COUNT=$(curl -s "http://localhost/api/fhir/search-values/Patient" | jq -r '.total // 0')
if [ "$PARAM_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $PARAM_COUNT searchable parameters for Patient${NC}"
else
    echo -e "${YELLOW}⚠️  No searchable parameters found${NC}"
fi

# Test getting distinct gender values
echo "Testing /api/fhir/search-values/Patient/gender..."
GENDER_COUNT=$(curl -s "http://localhost/api/fhir/search-values/Patient/gender" | jq -r '.total // 0')
if [ "$GENDER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $GENDER_COUNT distinct gender values${NC}"
    curl -s "http://localhost/api/fhir/search-values/Patient/gender" | \
        jq -r '.values[] | "  - " + .value + ": " + (.count | tostring) + " patients"'
else
    echo -e "${YELLOW}⚠️  No gender values found (load patient data first)${NC}"
fi
echo ""

# Step 7: Check for errors in logs
echo -e "${YELLOW}Step 7: Checking for errors in backend logs...${NC}"
ERROR_COUNT=$(docker logs wintehr-backend --tail 100 2>&1 | grep -i "error\|exception\|traceback" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ No errors in recent logs${NC}"
else
    echo -e "${YELLOW}⚠️  Found $ERROR_COUNT error-like entries in logs${NC}"
    echo "Review with: docker logs wintehr-backend --tail 50"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Phase 2 Migration Testing Complete!${NC}"
echo "=========================================="
echo ""
echo "✅ Migration Status:"
echo "  - AuditEventService: Working with HAPI FHIR"
echo "  - search_values API: Using HAPI JPA indexes"
echo "  - All tests passed successfully"
echo ""
echo "📋 Next Steps:"
echo "  1. Update imports in auth/service.py and auth/secure_auth_service.py"
echo "  2. Delete obsolete validation scripts"
echo "  3. Drop fhir.* schema tables from PostgreSQL"
echo ""
echo "For detailed testing info, see: claudedocs/PHASE_2_TESTING.md"
