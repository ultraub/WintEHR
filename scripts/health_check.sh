#!/bin/bash

# Health check script for MedGenEMR FHIR-native implementation

echo "🏥 MedGenEMR Health Check"
echo "========================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URLs
BACKEND_URL="http://localhost:8000"
FHIR_URL="$BACKEND_URL/fhir/R4"
EMR_URL="$BACKEND_URL/api/emr"
CANVAS_URL="$BACKEND_URL/api/clinical-canvas"
FRONTEND_URL="http://localhost:3000"

# Function to check endpoint
check_endpoint() {
    local url=$1
    local name=$2
    
    if curl -f -s -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not responding"
        return 1
    fi
}

# Function to check FHIR capabilities
check_fhir_capabilities() {
    echo -e "\n${YELLOW}Checking FHIR Capabilities...${NC}"
    
    # Get capability statement
    response=$(curl -s "$FHIR_URL/metadata")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} FHIR CapabilityStatement retrieved"
        
        # Check for key resources
        for resource in Patient Observation Condition MedicationRequest Encounter; do
            if echo "$response" | grep -q "\"type\":\"$resource\""; then
                echo -e "  ${GREEN}✓${NC} $resource resource supported"
            else
                echo -e "  ${RED}✗${NC} $resource resource not found"
            fi
        done
    else
        echo -e "${RED}✗${NC} Failed to retrieve FHIR capabilities"
    fi
}

# Function to test FHIR operations
test_fhir_operations() {
    echo -e "\n${YELLOW}Testing FHIR Operations...${NC}"
    
    # Test creating a patient
    patient_data='{
        "resourceType": "Patient",
        "identifier": [{
            "system": "http://example.org/patient-ids",
            "value": "health-check-'$(date +%s)'"
        }],
        "name": [{
            "use": "official",
            "family": "Test",
            "given": ["Health", "Check"]
        }],
        "gender": "other",
        "birthDate": "2000-01-01"
    }'
    
    response=$(curl -s -X POST "$FHIR_URL/Patient" \
        -H "Content-Type: application/fhir+json" \
        -d "$patient_data" \
        -w "\n%{http_code}")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓${NC} FHIR Create operation successful"
        
        # Extract patient ID from Location header
        location=$(curl -s -X POST "$FHIR_URL/Patient" \
            -H "Content-Type: application/fhir+json" \
            -d "$patient_data" \
            -D - | grep -i location | cut -d' ' -f2 | tr -d '\r')
        
        if [ ! -z "$location" ]; then
            patient_id=$(echo "$location" | rev | cut -d'/' -f1 | rev)
            echo -e "  Created Patient ID: $patient_id"
            
            # Test read operation
            if curl -f -s "$FHIR_URL/Patient/$patient_id" > /dev/null; then
                echo -e "${GREEN}✓${NC} FHIR Read operation successful"
            fi
            
            # Test search operation
            if curl -f -s "$FHIR_URL/Patient?_id=$patient_id" > /dev/null; then
                echo -e "${GREEN}✓${NC} FHIR Search operation successful"
            fi
        fi
    else
        echo -e "${RED}✗${NC} FHIR Create operation failed (HTTP $http_code)"
    fi
}

# Function to check database
check_database() {
    echo -e "\n${YELLOW}Checking Database...${NC}"
    
    if docker exec emr-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PostgreSQL is ready"
        
        # Check if schemas exist
        schemas=$(docker exec emr-postgres psql -U postgres -d medgenemr -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('fhir', 'emr');")
        
        if echo "$schemas" | grep -q "fhir"; then
            echo -e "  ${GREEN}✓${NC} FHIR schema exists"
        else
            echo -e "  ${RED}✗${NC} FHIR schema missing"
        fi
        
        if echo "$schemas" | grep -q "emr"; then
            echo -e "  ${GREEN}✓${NC} EMR schema exists"
        else
            echo -e "  ${RED}✗${NC} EMR schema missing"
        fi
    else
        echo -e "${RED}✗${NC} PostgreSQL is not ready"
    fi
}

# Main health checks
echo -e "\n${YELLOW}Checking Services...${NC}"
check_endpoint "$BACKEND_URL/health" "Backend API"
check_endpoint "$FHIR_URL/metadata" "FHIR API"
check_endpoint "$EMR_URL/" "EMR Extensions API"
check_endpoint "$FRONTEND_URL" "Frontend"

# Database check
check_database

# FHIR capabilities check
check_fhir_capabilities

# FHIR operations test
test_fhir_operations

echo -e "\n${YELLOW}Health Check Complete!${NC}"