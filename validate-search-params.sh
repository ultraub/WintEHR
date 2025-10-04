#!/bin/bash
###############################################################################
# Search Parameter Validation Script
#
# Purpose: Quick validation of search parameter indexing health
# Usage: ./validate-search-params.sh
#
# Checks:
# - Resource counts
# - Search parameter counts
# - Patient/subject parameter coverage
# - Resource searchability
# - Compartment population
#
# Date: 2025-10-04
###############################################################################

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database connection (adjust if needed)
DB_CONTAINER="emr-postgres"
DB_USER="emr_user"
DB_NAME="emr_db"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Search Parameter Validation Report                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if database is accessible
if ! docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
    echo -e "${RED}✗ Cannot connect to database${NC}"
    echo "Make sure the database container is running: docker-compose ps"
    exit 1
fi

echo -e "${BLUE}=== Resource Counts ===${NC}"

# Count resources
RESOURCE_COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT COUNT(*) FROM fhir.resources" | xargs)
echo "Total resources: ${RESOURCE_COUNT}"

# Count by type
echo ""
echo "Top resource types:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
    "SELECT resource_type, COUNT(*) as count
     FROM fhir.resources
     GROUP BY resource_type
     ORDER BY count DESC
     LIMIT 10"

echo ""
echo -e "${BLUE}=== Search Parameter Health ===${NC}"

# Count search params
SEARCH_PARAM_COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT COUNT(*) FROM fhir.search_params" | xargs)
echo "Total search parameters: ${SEARCH_PARAM_COUNT}"

# Calculate ratio
if [ "$RESOURCE_COUNT" -gt 0 ]; then
    RATIO=$(echo "scale=2; $SEARCH_PARAM_COUNT / $RESOURCE_COUNT" | bc)
    echo "Search params per resource: ${RATIO}"

    # Expected: at least 0.5 params per resource (conservative estimate)
    EXPECTED_MIN=$(echo "$RESOURCE_COUNT * 0.5" | bc | cut -d'.' -f1)

    if [ "$SEARCH_PARAM_COUNT" -lt "$EXPECTED_MIN" ]; then
        echo -e "${RED}✗ CRITICAL: Search parameter count too low!${NC}"
        echo -e "${RED}  Expected minimum: ${EXPECTED_MIN}, Found: ${SEARCH_PARAM_COUNT}${NC}"
        STATUS="FAILED"
    else
        echo -e "${GREEN}✓ Search parameter count looks healthy${NC}"
        STATUS="PASSED"
    fi
fi

# Patient/subject parameters
echo ""
PATIENT_PARAM_COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT COUNT(*) FROM fhir.search_params
     WHERE param_name IN ('patient', 'subject')" | xargs)
echo "Patient/subject parameters: ${PATIENT_PARAM_COUNT}"

if [ "$PATIENT_PARAM_COUNT" -eq 0 ]; then
    echo -e "${RED}✗ CRITICAL: No patient/subject parameters found!${NC}"
    echo -e "${RED}  Clinical resources will not be searchable by patient${NC}"
    STATUS="FAILED"
fi

# Show distribution by parameter name
echo ""
echo "Top parameters:"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
    "SELECT param_name, COUNT(*) as count
     FROM fhir.search_params
     GROUP BY param_name
     ORDER BY count DESC
     LIMIT 10"

echo ""
echo -e "${BLUE}=== Patient Compartments ===${NC}"

COMPARTMENT_COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT COUNT(*) FROM fhir.compartments WHERE compartment_type = 'Patient'" | xargs)
echo "Patient compartment entries: ${COMPARTMENT_COUNT}"

if [ "$COMPARTMENT_COUNT" -lt 100 ] && [ "$RESOURCE_COUNT" -gt 100 ]; then
    echo -e "${YELLOW}⚠ WARNING: Low compartment count relative to resources${NC}"
fi

echo ""
echo -e "${BLUE}=== Searchability Test ===${NC}"

# Get a test patient
TEST_PATIENT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT fhir_id FROM fhir.resources WHERE resource_type = 'Patient' LIMIT 1" | xargs)

if [ -n "$TEST_PATIENT" ]; then
    echo "Testing with patient: ${TEST_PATIENT}"

    # Test basic patient search
    PATIENT_SEARCH=$(curl -s "http://localhost:8000/fhir/R4/Patient/${TEST_PATIENT}" 2>/dev/null | jq -r '.id // "ERROR"')
    if [ "$PATIENT_SEARCH" = "$TEST_PATIENT" ]; then
        echo -e "${GREEN}✓ Patient direct read: SUCCESS${NC}"
    else
        echo -e "${RED}✗ Patient direct read: FAILED${NC}"
        STATUS="FAILED"
    fi

    # Test condition search by patient
    CONDITION_COUNT=$(curl -s "http://localhost:8000/fhir/R4/Condition?patient=Patient/${TEST_PATIENT}" 2>/dev/null | \
        jq -r '.total // 0')
    echo "Conditions for patient: ${CONDITION_COUNT}"

    # Test observation search by patient
    OBS_COUNT=$(curl -s "http://localhost:8000/fhir/R4/Observation?patient=Patient/${TEST_PATIENT}" 2>/dev/null | \
        jq -r '.total // 0')
    echo "Observations for patient: ${OBS_COUNT}"

    # Test medication request search
    MED_COUNT=$(curl -s "http://localhost:8000/fhir/R4/MedicationRequest?patient=Patient/${TEST_PATIENT}" 2>/dev/null | \
        jq -r '.total // 0')
    echo "MedicationRequests for patient: ${MED_COUNT}"

    # If all searches return 0, there's a problem
    TOTAL_CLINICAL=$(echo "$CONDITION_COUNT + $OBS_COUNT + $MED_COUNT" | bc)
    if [ "$TOTAL_CLINICAL" -eq 0 ] && [ "$RESOURCE_COUNT" -gt 50 ]; then
        echo -e "${RED}✗ CRITICAL: All patient searches returning 0 results${NC}"
        echo -e "${RED}  This indicates search parameter indexing failure${NC}"
        STATUS="FAILED"
    fi
else
    echo -e "${YELLOW}⚠ No patients found for searchability testing${NC}"
fi

echo ""
echo -e "${BLUE}=== Diagnostic Queries ===${NC}"

# Check for resources without search params
RESOURCES_NO_PARAMS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT COUNT(*) FROM fhir.resources r
     WHERE NOT EXISTS (
         SELECT 1 FROM fhir.search_params sp WHERE sp.resource_id = r.id
     )" | xargs)
echo "Resources without ANY search parameters: ${RESOURCES_NO_PARAMS}"

if [ "$RESOURCES_NO_PARAMS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some resources are missing search parameters${NC}"
    echo "Sample resources missing params:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
        "SELECT resource_type, fhir_id
         FROM fhir.resources r
         WHERE NOT EXISTS (
             SELECT 1 FROM fhir.search_params sp WHERE sp.resource_id = r.id
         )
         LIMIT 5"
fi

# Check for URN references that might not be resolved
URN_REFS=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \
    "SELECT COUNT(*) FROM fhir.search_params
     WHERE value_string LIKE 'urn:uuid:%'" | xargs)

if [ "$URN_REFS" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠ Found ${URN_REFS} URN-format references in search params${NC}"
    echo "  These may not be searchable in standard FHIR format"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"

if [ "$STATUS" = "FAILED" ]; then
    echo -e "${RED}║  Status: FAILED - Critical issues found               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Recommended actions:${NC}"
    echo "1. Check import logs for errors: docker logs emr-backend | grep -i error"
    echo "2. Try re-indexing: docker exec emr-backend python scripts/active/consolidated_search_indexing.py --mode fix"
    echo "3. If issues persist, check BUILD_SCRIPT_IMPROVEMENTS_NEEDED.md for root cause"
    exit 1
elif [ "$STATUS" = "PASSED" ]; then
    echo -e "${GREEN}║  Status: PASSED - Search parameters healthy           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${YELLOW}║  Status: WARNING - Check findings above               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    exit 0
fi
