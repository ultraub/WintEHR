#!/bin/bash
#
# WintEHR Deployment Validation Script
# Comprehensive validation of deployment health and completeness
#
# Usage: ./validate-deployment.sh [dev|prod]

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Configuration
MODE="${1:-dev}"
CONTAINER_NAME="emr-backend"
if [[ "$MODE" == "dev" ]]; then
    CONTAINER_NAME="emr-backend-dev"
fi

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
    ((TOTAL_CHECKS++))
}

section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Start validation
echo -e "${BLUE}🔍 WintEHR Deployment Validation (${MODE} mode)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Container Health
section "1. Container Health"

# Check PostgreSQL
if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "emr-postgres.*healthy"; then
    check_pass "PostgreSQL container is healthy"
else
    check_fail "PostgreSQL container is not healthy"
fi

# Check Backend
if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "${CONTAINER_NAME}.*healthy"; then
    check_pass "Backend container is healthy"
else
    check_fail "Backend container is not healthy"
fi

# Check Frontend
FRONTEND_NAME="emr-frontend"
if [[ "$MODE" == "dev" ]]; then
    FRONTEND_NAME="emr-frontend-dev"
fi
if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "${FRONTEND_NAME}"; then
    check_pass "Frontend container is running"
else
    check_fail "Frontend container is not running"
fi

# 2. Database Schema
section "2. Database Schema"

# Check all required tables
TABLES=(resources search_params resource_history references compartments audit_logs)
for table in "${TABLES[@]}"; do
    if docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT 1 FROM fhir.$table LIMIT 1;" &>/dev/null; then
        check_pass "Table fhir.$table exists"
    else
        check_fail "Table fhir.$table is missing"
    fi
done

# Check clinical catalogs schema
if docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'clinical_catalogs';" | grep -q 1; then
    check_pass "Clinical catalogs schema exists"
    
    # Check catalog tables
    CATALOG_TABLES=(medication_catalog lab_test_catalog imaging_study_catalog condition_catalog)
    for table in "${CATALOG_TABLES[@]}"; do
        if docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT 1 FROM clinical_catalogs.$table LIMIT 1;" &>/dev/null; then
            check_pass "Catalog table clinical_catalogs.$table exists"
        else
            check_warn "Catalog table clinical_catalogs.$table is empty or missing"
        fi
    done
else
    check_warn "Clinical catalogs schema not created (run with --full-enhancement)"
fi

# 3. Data Integrity
section "3. Data Integrity"

# Check patient count
PATIENT_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient' AND deleted = false;" | xargs)
if [[ $PATIENT_COUNT -gt 0 ]]; then
    check_pass "Found $PATIENT_COUNT patients"
else
    check_fail "No patients found in database"
fi

# Check resource types
RESOURCE_TYPES=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(DISTINCT resource_type) FROM fhir.resources WHERE deleted = false;" | xargs)
if [[ $RESOURCE_TYPES -gt 10 ]]; then
    check_pass "Found $RESOURCE_TYPES different resource types"
else
    check_warn "Only $RESOURCE_TYPES resource types (expected more)"
fi

# Check search parameters
SEARCH_PARAMS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.search_params;" | xargs)
if [[ $SEARCH_PARAMS -gt 100 ]]; then
    check_pass "Found $SEARCH_PARAMS search parameters indexed"
else
    check_warn "Only $SEARCH_PARAMS search parameters (may need indexing)"
fi

# Check compartments
COMPARTMENTS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(DISTINCT compartment_id) FROM fhir.compartments WHERE compartment_type = 'Patient';" | xargs)
if [[ $COMPARTMENTS -eq $PATIENT_COUNT ]]; then
    check_pass "All $COMPARTMENTS patients have compartments"
elif [[ $COMPARTMENTS -gt 0 ]]; then
    check_warn "Only $COMPARTMENTS of $PATIENT_COUNT patients have compartments"
else
    check_fail "No patient compartments found"
fi

# 4. Enhancement Status
section "4. Enhancement Status"

# Check Organizations
ORG_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Organization' AND deleted = false;" | xargs)
if [[ $ORG_COUNT -gt 0 ]]; then
    check_pass "Found $ORG_COUNT organizations"
else
    check_warn "No organizations (run with --full-enhancement)"
fi

# Check Practitioners
PRACT_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Practitioner' AND deleted = false;" | xargs)
if [[ $PRACT_COUNT -gt 0 ]]; then
    check_pass "Found $PRACT_COUNT practitioners"
else
    check_warn "No practitioners (run with --full-enhancement)"
fi

# Check Order Sets
ORDER_SETS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Questionnaire' AND deleted = false;" | xargs)
if [[ $ORDER_SETS -gt 0 ]]; then
    check_pass "Found $ORDER_SETS order sets"
else
    check_warn "No order sets (run with --full-enhancement)"
fi

# 5. API Health
section "5. API Health"

# Check backend health endpoint
if curl -sf http://localhost:8000/api/health &>/dev/null; then
    check_pass "Backend health endpoint responding"
else
    check_fail "Backend health endpoint not responding"
fi

# Check FHIR endpoint
if curl -sf http://localhost:8000/fhir/R4/metadata &>/dev/null; then
    check_pass "FHIR endpoint responding"
else
    check_fail "FHIR endpoint not responding"
fi

# Check frontend
FRONTEND_PORT=80
if [[ "$MODE" == "dev" ]]; then
    FRONTEND_PORT=3000
fi
if curl -sf http://localhost:$FRONTEND_PORT &>/dev/null; then
    check_pass "Frontend responding on port $FRONTEND_PORT"
else
    check_fail "Frontend not responding on port $FRONTEND_PORT"
fi

# 6. File System
section "6. File System"

# Check DICOM directory
if docker exec $CONTAINER_NAME test -d /app/data/generated_dicoms; then
    DICOM_COUNT=$(docker exec $CONTAINER_NAME find /app/data/generated_dicoms -name "*.dcm" 2>/dev/null | wc -l)
    if [[ $DICOM_COUNT -gt 0 ]]; then
        check_pass "Found $DICOM_COUNT DICOM files"
    else
        check_warn "DICOM directory exists but empty"
    fi
else
    check_warn "DICOM directory not found"
fi

# Check logs directory
if docker exec $CONTAINER_NAME test -d /app/logs; then
    check_pass "Logs directory exists"
else
    check_warn "Logs directory not found"
fi

# 7. Scripts Availability
section "7. Build Scripts"

# Check core scripts
CORE_SCRIPTS=(
    "scripts/setup/init_database_definitive.py"
    "scripts/active/synthea_master.py"
    "scripts/active/generate_dicom_for_studies.py"
    "scripts/active/consolidated_enhancement.py"
    "scripts/active/consolidated_catalog_setup.py"
    "scripts/active/consolidated_workflow_setup.py"
)

for script in "${CORE_SCRIPTS[@]}"; do
    if docker exec $CONTAINER_NAME test -f "/app/$script"; then
        check_pass "$(basename $script) available"
    else
        check_fail "$(basename $script) missing"
    fi
done

# Summary
section "Validation Summary"

echo -e "\n${BLUE}Results:${NC}"
echo -e "  Total Checks: $TOTAL_CHECKS"
echo -e "  ${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "  ${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "  ${RED}Failed: $FAILED_CHECKS${NC}"

if [[ $FAILED_CHECKS -eq 0 ]]; then
    echo -e "\n${GREEN}✅ Deployment validation PASSED${NC}"
    if [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}   Note: $WARNINGS warnings detected (optional enhancements not run)${NC}"
    fi
    exit 0
else
    echo -e "\n${RED}❌ Deployment validation FAILED${NC}"
    echo -e "${RED}   $FAILED_CHECKS critical issues detected${NC}"
    exit 1
fi