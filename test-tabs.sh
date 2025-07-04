#!/bin/bash

# Test Clinical Workspace Tab Endpoints

API_BASE="http://localhost:8000/fhir/R4"
TOKEN="test-token"

echo "=== Testing Clinical Workspace Tab Data ==="
echo

# Get a patient ID first
echo "Getting patients..."
PATIENTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/Patient")
PATIENT_ID=$(echo $PATIENTS | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PATIENT_ID" ]; then
    echo "❌ No patients found. Please create test data first."
    exit 1
fi

echo "✅ Using patient ID: $PATIENT_ID"
echo

# Function to test endpoint
test_endpoint() {
    local name=$1
    local endpoint=$2
    echo -n "Testing $name... "
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE$endpoint")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        COUNT=$(echo "$BODY" | grep -o '"resources":\[' | wc -l)
        if [ $COUNT -gt 0 ]; then
            RESOURCE_COUNT=$(echo "$BODY" | grep -o '"id":' | wc -l)
            echo "✅ Success ($HTTP_CODE) - $RESOURCE_COUNT resources"
        else
            echo "✅ Success ($HTTP_CODE)"
        fi
    else
        echo "⚠️  $HTTP_CODE"
    fi
}

echo "--- Overview Tab ---"
test_endpoint "Vital Signs" "/Observation?patient=$PATIENT_ID&category=vital-signs"
test_endpoint "Allergies" "/AllergyIntolerance?patient=$PATIENT_ID"
test_endpoint "Conditions" "/Condition?patient=$PATIENT_ID"
test_endpoint "Medications" "/MedicationRequest?patient=$PATIENT_ID"

echo
echo "--- Documentation Tab ---"
test_endpoint "Clinical Notes" "/DocumentReference?patient=$PATIENT_ID"

echo
echo "--- Orders Tab ---"
test_endpoint "Service Requests" "/ServiceRequest?patient=$PATIENT_ID"

echo
echo "--- Results Tab ---"
test_endpoint "Lab Results" "/Observation?patient=$PATIENT_ID&category=laboratory"

echo
echo "--- Appointments Tab ---"
test_endpoint "Appointments" "/Appointment?patient=$PATIENT_ID"

echo
echo "--- Inbox Tab ---"
test_endpoint "Communications" "/Communication?recipient=Practitioner/demo-provider"

echo
echo "--- Tasks Tab ---"
test_endpoint "Tasks" "/Task?patient=$PATIENT_ID"

echo
echo "=== Summary ==="
echo "All API endpoints tested. Check the frontend at http://localhost:3000"
echo "Navigate through each tab in the Clinical Workspace to verify:"
echo "1. No console errors appear"
echo "2. Data loads properly (or shows appropriate empty states)"
echo "3. All buttons and interactions work as expected"