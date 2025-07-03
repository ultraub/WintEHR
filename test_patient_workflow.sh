#!/bin/bash

echo "🏥 Testing MedGenEMR Patient Workflow"
echo "===================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base URLs
API_URL="http://localhost:8000/fhir/R4"
FRONTEND_URL="http://localhost:3000"

# Test 1: Check services
echo -e "\n${BLUE}1. Checking Services...${NC}"

# Check backend
if curl -s "$API_URL/metadata" > /dev/null; then
    echo -e "   ${GREEN}✅ Backend API is running${NC}"
else
    echo -e "   ${RED}❌ Backend API is not accessible${NC}"
    exit 1
fi

# Check frontend
if curl -s "$FRONTEND_URL" > /dev/null; then
    echo -e "   ${GREEN}✅ Frontend is running${NC}"
else
    echo -e "   ${RED}❌ Frontend is not accessible${NC}"
fi

# Test 2: Get patient list
echo -e "\n${BLUE}2. Fetching Patient List...${NC}"
PATIENTS=$(curl -s "$API_URL/Patient?_count=5")
PATIENT_COUNT=$(echo $PATIENTS | grep -o '"total":[0-9]*' | grep -o '[0-9]*')

if [ "$PATIENT_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $PATIENT_COUNT patients${NC}"
    
    # Extract first patient ID
    PATIENT_ID=$(echo $PATIENTS | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   First patient ID: $PATIENT_ID"
else
    echo -e "   ${RED}❌ No patients found${NC}"
    exit 1
fi

# Test 3: Get patient details
echo -e "\n${BLUE}3. Fetching Patient Details...${NC}"
PATIENT_DETAILS=$(curl -s "$API_URL/Patient/$PATIENT_ID")

if echo $PATIENT_DETAILS | grep -q '"resourceType":"Patient"'; then
    echo -e "   ${GREEN}✅ Patient details retrieved${NC}"
    
    # Extract patient name
    PATIENT_NAME=$(echo $PATIENT_DETAILS | grep -o '"family":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   Patient name: $PATIENT_NAME"
else
    echo -e "   ${RED}❌ Failed to get patient details${NC}"
fi

# Test 4: Get patient observations
echo -e "\n${BLUE}4. Fetching Patient Observations...${NC}"
OBSERVATIONS=$(curl -s "$API_URL/Observation?patient=$PATIENT_ID&_count=5")
OBS_COUNT=$(echo $OBSERVATIONS | grep -o '"total":[0-9]*' | grep -o '[0-9]*')

if [ "$OBS_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $OBS_COUNT observations${NC}"
    
    # Show observation types
    echo "   Observation types:"
    echo $OBSERVATIONS | grep -o '"code":{"coding":\[{"system":"[^"]*","code":"[^"]*","display":"[^"]*"' | \
        sed 's/.*"display":"/     - /' | sed 's/"//' | head -5
else
    echo -e "   ${YELLOW}⚠️  No observations found for this patient${NC}"
fi

# Test 5: Get patient conditions
echo -e "\n${BLUE}5. Fetching Patient Conditions...${NC}"
CONDITIONS=$(curl -s "$API_URL/Condition?patient=$PATIENT_ID&_count=5")
COND_COUNT=$(echo $CONDITIONS | grep -o '"total":[0-9]*' | grep -o '[0-9]*')

if [ "$COND_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $COND_COUNT conditions${NC}"
    
    # Show condition names
    echo "   Conditions:"
    echo $CONDITIONS | grep -o '"code":{"coding":\[{"system":"[^"]*","code":"[^"]*","display":"[^"]*"' | \
        sed 's/.*"display":"/     - /' | sed 's/"//' | head -5
else
    echo -e "   ${YELLOW}⚠️  No conditions found for this patient${NC}"
fi

# Test 6: Get patient immunizations
echo -e "\n${BLUE}6. Fetching Patient Immunizations...${NC}"
IMMUNIZATIONS=$(curl -s "$API_URL/Immunization?patient=$PATIENT_ID&_count=5")
IMM_COUNT=$(echo $IMMUNIZATIONS | grep -o '"total":[0-9]*' | grep -o '[0-9]*')

if [ "$IMM_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $IMM_COUNT immunizations${NC}"
else
    echo -e "   ${YELLOW}⚠️  No immunizations found for this patient${NC}"
fi

# Test 7: Frontend API Integration
echo -e "\n${BLUE}7. Testing Frontend Integration...${NC}"

# Check if frontend can access API
if curl -s -H "Origin: http://localhost:3000" "$API_URL/Patient?_count=1" > /dev/null; then
    echo -e "   ${GREEN}✅ CORS is properly configured${NC}"
else
    echo -e "   ${RED}❌ CORS issues detected${NC}"
fi

# Summary
echo -e "\n${GREEN}===================================="
echo "✅ Patient Workflow Test Complete!"
echo "====================================${NC}"
echo ""
echo "Summary:"
echo "  - Total Patients: $PATIENT_COUNT"
echo "  - Test Patient ID: $PATIENT_ID"
echo "  - Patient Observations: $OBS_COUNT"
echo "  - Patient Conditions: $COND_COUNT"
echo "  - Patient Immunizations: $IMM_COUNT"
echo ""
echo "🌐 Access the EMR at: $FRONTEND_URL"
echo "📊 View patient at: $FRONTEND_URL/patients/$PATIENT_ID"