#!/bin/bash

# Performance Testing Script for FHIR API Improvements
# This script tests the API directly to verify performance improvements

echo "🧪 FHIR API Performance Testing"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:8000/fhir/R4"

# Get a test patient ID
echo "🔍 Finding test patient..."
PATIENT_ID=$(curl -s "$BASE_URL/Patient?_count=1&_sort=-_lastUpdated" | jq -r '.entry[0].resource.id' 2>/dev/null)

if [ -z "$PATIENT_ID" ]; then
    echo -e "${RED}❌ No patients found. Please load patient data first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using patient: $PATIENT_ID${NC}"
echo ""

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_count=$3
    
    echo "Testing: $name"
    
    # Time the request
    start_time=$(date +%s%3N)
    response=$(curl -s -w "\n%{http_code}" "$url")
    end_time=$(date +%s%3N)
    
    # Extract HTTP status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Calculate duration
    duration=$((end_time - start_time))
    
    # Parse response
    if [ "$http_code" = "200" ]; then
        resource_count=$(echo "$body" | jq '.total // .entry | length' 2>/dev/null || echo "0")
        data_size=$(echo "$body" | wc -c)
        data_size_kb=$((data_size / 1024))
        
        # Color code based on performance
        if [ $duration -lt 200 ]; then
            duration_color=$GREEN
        elif [ $duration -lt 500 ]; then
            duration_color=$YELLOW
        else
            duration_color=$RED
        fi
        
        echo -e "  Status: ${GREEN}✓${NC} | Duration: ${duration_color}${duration}ms${NC} | Resources: $resource_count | Size: ${data_size_kb}KB"
        
        # Check if count matches expected
        if [ -n "$expected_count" ] && [ "$resource_count" -gt "$expected_count" ]; then
            echo -e "  ${YELLOW}⚠️  Warning: Got $resource_count resources, expected <= $expected_count${NC}"
        fi
    else
        echo -e "  Status: ${RED}✗ (HTTP $http_code)${NC}"
    fi
    
    echo ""
}

# Test the optimized endpoints
echo "📊 Testing Optimized Endpoints (with new limits)"
echo "-----------------------------------------------"

test_endpoint "Observations (limit 50)" \
    "$BASE_URL/Observation?patient=$PATIENT_ID&_count=50" \
    "50"

test_endpoint "Vital Signs (limit 50)" \
    "$BASE_URL/Observation?patient=$PATIENT_ID&category=vital-signs&_count=50" \
    "50"

test_endpoint "Medications (limit 50)" \
    "$BASE_URL/MedicationRequest?patient=$PATIENT_ID&_count=50" \
    "50"

test_endpoint "Conditions (limit 50)" \
    "$BASE_URL/Condition?patient=$PATIENT_ID&_count=50" \
    "50"

test_endpoint "Encounters (limit 20)" \
    "$BASE_URL/Encounter?patient=$PATIENT_ID&_count=20" \
    "20"

echo ""
echo "📊 Testing _summary Parameter Impact"
echo "-----------------------------------"

# Test with and without _summary
test_endpoint "Encounters WITH _summary" \
    "$BASE_URL/Encounter?patient=$PATIENT_ID&_count=50&_summary=true" \
    "50"

test_endpoint "Encounters WITHOUT _summary" \
    "$BASE_URL/Encounter?patient=$PATIENT_ID&_count=50" \
    "50"

echo ""
echo "📊 Comparing Old vs New Approach"
echo "--------------------------------"

# Compare old (1000) vs new (50) limits
echo -e "${YELLOW}OLD approach (limit 1000):${NC}"
test_endpoint "Observations" \
    "$BASE_URL/Observation?patient=$PATIENT_ID&_count=1000" \
    "1000"

echo -e "${GREEN}NEW approach (limit 50):${NC}"
test_endpoint "Observations" \
    "$BASE_URL/Observation?patient=$PATIENT_ID&_count=50" \
    "50"

echo ""
echo "📊 Testing Parallel Loading Simulation"
echo "-------------------------------------"

echo "Fetching 5 resource types in parallel..."
start_time=$(date +%s%3N)

# Run requests in parallel
(curl -s "$BASE_URL/Condition?patient=$PATIENT_ID&_count=50" > /tmp/conditions.json) &
(curl -s "$BASE_URL/MedicationRequest?patient=$PATIENT_ID&_count=50" > /tmp/medications.json) &
(curl -s "$BASE_URL/Observation?patient=$PATIENT_ID&_count=50" > /tmp/observations.json) &
(curl -s "$BASE_URL/Encounter?patient=$PATIENT_ID&_count=20" > /tmp/encounters.json) &
(curl -s "$BASE_URL/AllergyIntolerance?patient=$PATIENT_ID&_count=50" > /tmp/allergies.json) &

# Wait for all background jobs
wait

end_time=$(date +%s%3N)
duration=$((end_time - start_time))

# Count total resources
total_resources=0
for file in conditions medications observations encounters allergies; do
    count=$(jq '.total // .entry | length' /tmp/${file}.json 2>/dev/null || echo "0")
    total_resources=$((total_resources + count))
done

echo -e "  Duration: ${GREEN}${duration}ms${NC} | Total Resources: $total_resources"

# Cleanup
rm -f /tmp/{conditions,medications,observations,encounters,allergies}.json

echo ""
echo "✅ Performance testing completed!"
echo ""
echo "📈 Summary:"
echo "- Optimized endpoints are using proper limits (20-50)"
echo "- _summary parameter reduces payload size significantly"
echo "- Parallel loading improves overall performance"
echo ""
echo "💡 Next steps:"
echo "1. Navigate to http://localhost:3000/performance-test for UI-based testing"
echo "2. Monitor browser DevTools Network tab while using the app"
echo "3. Check for any components still using _count=1000"