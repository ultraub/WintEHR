#!/bin/bash

# =============================================================================
# Module 06: System Validation
# =============================================================================
# Comprehensive validation of the entire WintEHR system after deployment

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly NC='\033[0m'

# Default values
MODE="development"
ROOT_DIR=""
PATIENT_COUNT=5

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --root-dir=*)
            ROOT_DIR="${1#*=}"
            shift
            ;;
        --patients=*)
            PATIENT_COUNT="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

log() {
    echo -e "${BLUE}[VALIDATION]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

info() {
    echo -e "${PURPLE}ℹ️  $1${NC}"
}

section() {
    echo ""
    echo -e "${PURPLE}================================================${NC}"
    echo -e "${PURPLE} $1${NC}"
    echo -e "${PURPLE}================================================${NC}"
}

# Change to root directory
cd "$ROOT_DIR"

section "🔍 System Validation"
log "Starting comprehensive system validation..."
log "Mode: $MODE"
log "Expected patients: $PATIENT_COUNT"

# Initialize validation tracking
VALIDATION_PASSED=0
VALIDATION_FAILED=0
VALIDATION_WARNINGS=0
VALIDATION_LOG="logs/validation-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p logs

# Create validation log file
echo "==============================================================================" > "$VALIDATION_LOG"
echo "WintEHR System Validation Report - $(date)" >> "$VALIDATION_LOG"
echo "Mode: $MODE" >> "$VALIDATION_LOG"
echo "Expected Patients: $PATIENT_COUNT" >> "$VALIDATION_LOG"
echo "==============================================================================" >> "$VALIDATION_LOG"
echo "" >> "$VALIDATION_LOG"

validate_test() {
    local test_name="$1"
    local test_result="$2"
    local details="$3"
    
    if [ "$test_result" = "PASS" ]; then
        success "$test_name"
        echo "✅ PASS: $test_name" >> "$VALIDATION_LOG"
        if [ -n "$details" ]; then
            echo "   Details: $details" >> "$VALIDATION_LOG"
        fi
        ((VALIDATION_PASSED++))
    elif [ "$test_result" = "WARN" ]; then
        warning "$test_name"
        echo "⚠️  WARN: $test_name" >> "$VALIDATION_LOG"
        if [ -n "$details" ]; then
            echo "   Details: $details" >> "$VALIDATION_LOG"
        fi
        ((VALIDATION_WARNINGS++))
    else
        warning "$test_name - FAILED"
        echo "❌ FAIL: $test_name" >> "$VALIDATION_LOG"
        if [ -n "$details" ]; then
            echo "   Details: $details" >> "$VALIDATION_LOG"
        fi
        ((VALIDATION_FAILED++))
    fi
    echo "" >> "$VALIDATION_LOG"
}

# =============================================================================
# Phase 1: Container Health Checks
# =============================================================================

section "🐳 Container Health Validation"

log "Checking container status..."

# Check if all containers are running
CONTAINER_STATUS=$(docker-compose ps --format "table {{.Name}}\t{{.State}}")
log "Container status:"
echo "$CONTAINER_STATUS"

# Validate individual containers
POSTGRES_STATUS=$(docker-compose ps postgres | grep -c "Up" || echo "0")
validate_test "PostgreSQL Container" $([ "$POSTGRES_STATUS" -eq "1" ] && echo "PASS" || echo "FAIL") "Container running: $POSTGRES_STATUS"

BACKEND_STATUS=$(docker-compose ps backend | grep -c "Up" || echo "0")
validate_test "Backend Container" $([ "$BACKEND_STATUS" -eq "1" ] && echo "PASS" || echo "FAIL") "Container running: $BACKEND_STATUS"

FRONTEND_STATUS=$(docker-compose ps frontend | grep -c "Up" || echo "0")
validate_test "Frontend Container" $([ "$FRONTEND_STATUS" -eq "1" ] && echo "PASS" || echo "FAIL") "Container running: $FRONTEND_STATUS"

# =============================================================================
# Phase 2: Database Validation
# =============================================================================

section "🗄️ Database Validation"

log "Validating database schema and data..."

# Check database connectivity
DB_CONNECTIVITY=$(docker exec emr-postgres pg_isready -U emr_user -d emr_db >/dev/null 2>&1 && echo "PASS" || echo "FAIL")
validate_test "Database Connectivity" "$DB_CONNECTIVITY"

# Validate FHIR schema
FHIR_SCHEMA_CHECK=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def check_fhir_schema():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Check critical FHIR tables
        tables = [\"resources\", \"resource_history\", \"search_params\", \"references\"]
        missing_tables = []
        
        for table in tables:
            exists = await conn.fetchval(
                \"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = \$1 AND table_name = \$2)\",
                \"fhir\", table
            )
            if not exists:
                missing_tables.append(table)
        
        await conn.close()
        
        if missing_tables:
            print(f\"MISSING_TABLES:{missing_tables}\")
        else:
            print(\"SCHEMA_VALID\")
            
    except Exception as e:
        print(f\"SCHEMA_ERROR:{e}\")

asyncio.run(check_fhir_schema())
'" 2>&1)

if echo "$FHIR_SCHEMA_CHECK" | grep -q "SCHEMA_VALID"; then
    validate_test "FHIR Schema" "PASS" "All critical tables present"
elif echo "$FHIR_SCHEMA_CHECK" | grep -q "MISSING_TABLES"; then
    MISSING=$(echo "$FHIR_SCHEMA_CHECK" | cut -d: -f2)
    validate_test "FHIR Schema" "FAIL" "Missing tables: $MISSING"
else
    validate_test "FHIR Schema" "FAIL" "Schema check error: $FHIR_SCHEMA_CHECK"
fi

# Check CDS Hooks schema
CDS_SCHEMA_CHECK=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def check_cds_schema():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        exists = await conn.fetchval(
            \"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = \$1 AND table_name = \$2)\",
            \"cds_hooks\", \"hook_configurations\"
        )
        
        await conn.close()
        
        if exists:
            print(\"CDS_SCHEMA_VALID\")
        else:
            print(\"CDS_SCHEMA_MISSING\")
            
    except Exception as e:
        print(f\"CDS_SCHEMA_ERROR:{e}\")

asyncio.run(check_cds_schema())
'" 2>&1)

if echo "$CDS_SCHEMA_CHECK" | grep -q "CDS_SCHEMA_VALID"; then
    validate_test "CDS Hooks Schema" "PASS"
else
    validate_test "CDS Hooks Schema" "FAIL" "$CDS_SCHEMA_CHECK"
fi

# Validate data presence
DATA_CHECK=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def check_data():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Get resource counts
        total_resources = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL\")
        patient_count = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\' AND (deleted = FALSE OR deleted IS NULL)\")
        observation_count = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Observation\\' AND (deleted = FALSE OR deleted IS NULL)\")
        condition_count = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Condition\\' AND (deleted = FALSE OR deleted IS NULL)\")
        
        await conn.close()
        
        print(f\"DATA_COUNTS:total={total_resources},patients={patient_count},observations={observation_count},conditions={condition_count}\")
        
    except Exception as e:
        print(f\"DATA_ERROR:{e}\")

asyncio.run(check_data())
'" 2>&1)

if echo "$DATA_CHECK" | grep -q "DATA_COUNTS"; then
    TOTAL_RESOURCES=$(echo "$DATA_CHECK" | grep -o "total=[0-9]*" | cut -d= -f2)
    PATIENTS=$(echo "$DATA_CHECK" | grep -o "patients=[0-9]*" | cut -d= -f2)
    OBSERVATIONS=$(echo "$DATA_CHECK" | grep -o "observations=[0-9]*" | cut -d= -f2)
    CONDITIONS=$(echo "$DATA_CHECK" | grep -o "conditions=[0-9]*" | cut -d= -f2)
    
    validate_test "Data Presence" "PASS" "Resources: $TOTAL_RESOURCES, Patients: $PATIENTS, Observations: $OBSERVATIONS, Conditions: $CONDITIONS"
    
    # Validate expected patient count
    if [ "$PATIENTS" -ge "$PATIENT_COUNT" ]; then
        validate_test "Patient Count" "PASS" "Found $PATIENTS patients (expected: $PATIENT_COUNT)"
    else
        validate_test "Patient Count" "WARN" "Found $PATIENTS patients (expected: $PATIENT_COUNT)"
    fi
else
    validate_test "Data Presence" "FAIL" "$DATA_CHECK"
fi

# =============================================================================
# Phase 3: API Endpoint Validation
# =============================================================================

section "🌐 API Endpoint Validation"

log "Testing API endpoints..."

# Health check endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health || echo "000")
validate_test "Health Endpoint" $([ "$HEALTH_STATUS" = "200" ] && echo "PASS" || echo "FAIL") "Status: $HEALTH_STATUS"

# FHIR Capability Statement
FHIR_CAPABILITY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/fhir/R4/metadata || echo "000")
validate_test "FHIR Capability Statement" $([ "$FHIR_CAPABILITY" = "200" ] && echo "PASS" || echo "FAIL") "Status: $FHIR_CAPABILITY"

# FHIR Patient search
FHIR_PATIENTS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/fhir/R4/Patient?_count=1" || echo "000")
validate_test "FHIR Patient Search" $([ "$FHIR_PATIENTS" = "200" ] && echo "PASS" || echo "FAIL") "Status: $FHIR_PATIENTS"

# CDS Hooks discovery
CDS_DISCOVERY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/cds-hooks/services || echo "000")
validate_test "CDS Hooks Discovery" $([ "$CDS_DISCOVERY" = "200" ] && echo "PASS" || echo "FAIL") "Status: $CDS_DISCOVERY"

# Authentication endpoint
AUTH_CONFIG=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/auth/config || echo "000")
validate_test "Authentication Config" $([ "$AUTH_CONFIG" = "200" ] && echo "PASS" || echo "FAIL") "Status: $AUTH_CONFIG"

# =============================================================================
# Phase 4: Frontend Validation
# =============================================================================

section "🖥️ Frontend Validation"

log "Testing frontend accessibility..."

# Frontend main page
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ || echo "000")
validate_test "Frontend Main Page" $([ "$FRONTEND_STATUS" = "200" ] && echo "PASS" || echo "FAIL") "Status: $FRONTEND_STATUS"

# Manifest.json
MANIFEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/manifest.json || echo "000")
validate_test "PWA Manifest" $([ "$MANIFEST_STATUS" = "200" ] && echo "PASS" || echo "FAIL") "Status: $MANIFEST_STATUS"

# Static assets
STATIC_ASSETS=$(curl -s -I http://localhost/ | grep -c "Content-Encoding\|Cache-Control" || echo "0")
validate_test "Static Asset Optimization" $([ "$STATIC_ASSETS" -gt "0" ] && echo "PASS" || echo "WARN") "Headers found: $STATIC_ASSETS"

# =============================================================================
# Phase 5: Integration Testing
# =============================================================================

section "🔗 Integration Testing"

log "Testing system integration..."

# Test full patient data flow
PATIENT_FLOW_TEST=$(curl -s "http://localhost:8000/fhir/R4/Patient?_count=1" | python3 -c '
import json
import sys

try:
    data = json.load(sys.stdin)
    if data.get("resourceType") == "Bundle" and data.get("total", 0) > 0:
        patient = data["entry"][0]["resource"]
        patient_id = patient.get("id")
        if patient_id:
            print(f"PATIENT_FLOW_SUCCESS:{patient_id}")
        else:
            print("PATIENT_FLOW_ERROR:No patient ID")
    else:
        print("PATIENT_FLOW_ERROR:No patients in bundle")
except Exception as e:
    print(f"PATIENT_FLOW_ERROR:{e}")
' 2>/dev/null || echo "PATIENT_FLOW_ERROR:Connection failed")

if echo "$PATIENT_FLOW_TEST" | grep -q "PATIENT_FLOW_SUCCESS"; then
    PATIENT_ID=$(echo "$PATIENT_FLOW_TEST" | cut -d: -f2)
    validate_test "Patient Data Flow" "PASS" "Retrieved patient: $PATIENT_ID"
    
    # Test patient-related resources
    PATIENT_OBSERVATIONS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/fhir/R4/Observation?patient=$PATIENT_ID&_count=1" || echo "000")
    validate_test "Patient Observations" $([ "$PATIENT_OBSERVATIONS" = "200" ] && echo "PASS" || echo "WARN") "Status: $PATIENT_OBSERVATIONS"
    
    PATIENT_CONDITIONS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/fhir/R4/Condition?patient=$PATIENT_ID&_count=1" || echo "000")
    validate_test "Patient Conditions" $([ "$PATIENT_CONDITIONS" = "200" ] && echo "PASS" || echo "WARN") "Status: $PATIENT_CONDITIONS"
    
else
    validate_test "Patient Data Flow" "FAIL" "$PATIENT_FLOW_TEST"
fi

# =============================================================================
# Phase 6: Performance Testing
# =============================================================================

section "⚡ Performance Testing"

log "Testing system performance..."

# Response time test
RESPONSE_TIME_TEST=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:8000/api/health || echo "999")
RESPONSE_TIME_FLOAT=$(echo "$RESPONSE_TIME_TEST" | bc -l 2>/dev/null || echo "999")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME_FLOAT * 1000 / 1" | bc 2>/dev/null || echo "999")

if [ "${RESPONSE_TIME_MS%.*}" -lt "1000" ]; then
    validate_test "API Response Time" "PASS" "Health endpoint: ${RESPONSE_TIME_MS}ms"
elif [ "${RESPONSE_TIME_MS%.*}" -lt "3000" ]; then
    validate_test "API Response Time" "WARN" "Health endpoint: ${RESPONSE_TIME_MS}ms (slow)"
else
    validate_test "API Response Time" "FAIL" "Health endpoint: ${RESPONSE_TIME_MS}ms (too slow)"
fi

# Database query performance
DB_PERFORMANCE=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg
import time

async def test_db_performance():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        start_time = time.time()
        result = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources\")
        end_time = time.time()
        
        query_time = (end_time - start_time) * 1000
        
        await conn.close()
        
        print(f\"DB_PERFORMANCE_SUCCESS:{query_time:.0f}ms\")
        
    except Exception as e:
        print(f\"DB_PERFORMANCE_ERROR:{e}\")

asyncio.run(test_db_performance())
'" 2>&1)

if echo "$DB_PERFORMANCE" | grep -q "DB_PERFORMANCE_SUCCESS"; then
    DB_TIME=$(echo "$DB_PERFORMANCE" | cut -d: -f2 | cut -d'm' -f1)
    if [ "${DB_TIME%.*}" -lt "500" ]; then
        validate_test "Database Performance" "PASS" "Count query: ${DB_TIME}ms"
    elif [ "${DB_TIME%.*}" -lt "2000" ]; then
        validate_test "Database Performance" "WARN" "Count query: ${DB_TIME}ms (slow)"
    else
        validate_test "Database Performance" "FAIL" "Count query: ${DB_TIME}ms (too slow)"
    fi
else
    validate_test "Database Performance" "FAIL" "$DB_PERFORMANCE"
fi

# =============================================================================
# Phase 7: Security Validation
# =============================================================================

section "🔒 Security Validation"

log "Testing security configurations..."

# Security headers
SECURITY_HEADERS=$(curl -s -I http://localhost/ | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)" | wc -l || echo "0")
validate_test "Security Headers" $([ "$SECURITY_HEADERS" -ge "3" ] && echo "PASS" || echo "WARN") "Headers found: $SECURITY_HEADERS/3"

# CORS configuration
CORS_TEST=$(curl -s -I -H "Origin: http://localhost:3000" http://localhost:8000/api/health | grep -c "Access-Control" || echo "0")
validate_test "CORS Configuration" $([ "$CORS_TEST" -gt "0" ] && echo "PASS" || echo "WARN") "CORS headers: $CORS_TEST"

# Authentication mode validation
AUTH_MODE_CHECK=$(curl -s http://localhost:8000/api/auth/config | python3 -c '
import json
import sys

try:
    data = json.load(sys.stdin)
    jwt_enabled = data.get("jwt_enabled", False)
    if jwt_enabled:
        print("AUTH_MODE:production")
    else:
        print("AUTH_MODE:development")
except:
    print("AUTH_MODE:unknown")
' 2>/dev/null || echo "AUTH_MODE:error")

EXPECTED_AUTH_MODE="$MODE"
ACTUAL_AUTH_MODE=$(echo "$AUTH_MODE_CHECK" | cut -d: -f2)

if [ "$ACTUAL_AUTH_MODE" = "$EXPECTED_AUTH_MODE" ]; then
    validate_test "Authentication Mode" "PASS" "Mode: $ACTUAL_AUTH_MODE"
elif [ "$ACTUAL_AUTH_MODE" = "development" ] && [ "$EXPECTED_AUTH_MODE" = "production" ]; then
    validate_test "Authentication Mode" "WARN" "Expected: $EXPECTED_AUTH_MODE, Actual: $ACTUAL_AUTH_MODE"
else
    validate_test "Authentication Mode" "FAIL" "Expected: $EXPECTED_AUTH_MODE, Actual: $ACTUAL_AUTH_MODE"
fi

# =============================================================================
# Phase 8: Data Integrity Validation
# =============================================================================

section "🔍 Data Integrity Validation"

log "Validating data integrity..."

# Reference integrity check
REFERENCE_INTEGRITY=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def check_reference_integrity():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Check for orphaned observations
        orphaned_obs = await conn.fetchval(\"\"\"
            SELECT COUNT(*) FROM fhir.resources o
            WHERE o.resource_type = \\'Observation\\'
            AND (o.deleted = FALSE OR o.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources p 
                WHERE p.resource_type = \\'Patient\\'
                AND (p.deleted = FALSE OR p.deleted IS NULL)
                AND o.resource->\\'subject\\'->\\'reference\\' LIKE \\'%\\' || p.fhir_id || \\'%\\'
            )
        \"\"\")
        
        # Check for orphaned conditions
        orphaned_cond = await conn.fetchval(\"\"\"
            SELECT COUNT(*) FROM fhir.resources c
            WHERE c.resource_type = \\'Condition\\'
            AND (c.deleted = FALSE OR c.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources p 
                WHERE p.resource_type = \\'Patient\\'
                AND (p.deleted = FALSE OR p.deleted IS NULL)
                AND c.resource->\\'subject\\'->\\'reference\\' LIKE \\'%\\' || p.fhir_id || \\'%\\'
            )
        \"\"\")
        
        await conn.close()
        
        print(f\"REFERENCE_INTEGRITY:orphaned_obs={orphaned_obs},orphaned_cond={orphaned_cond}\")
        
    except Exception as e:
        print(f\"REFERENCE_ERROR:{e}\")

asyncio.run(check_reference_integrity())
'" 2>&1)

if echo "$REFERENCE_INTEGRITY" | grep -q "REFERENCE_INTEGRITY"; then
    ORPHANED_OBS=$(echo "$REFERENCE_INTEGRITY" | grep -o "orphaned_obs=[0-9]*" | cut -d= -f2)
    ORPHANED_COND=$(echo "$REFERENCE_INTEGRITY" | grep -o "orphaned_cond=[0-9]*" | cut -d= -f2)
    
    if [ "$ORPHANED_OBS" -eq "0" ] && [ "$ORPHANED_COND" -eq "0" ]; then
        validate_test "Reference Integrity" "PASS" "No orphaned resources"
    elif [ "$ORPHANED_OBS" -lt "10" ] && [ "$ORPHANED_COND" -lt "10" ]; then
        validate_test "Reference Integrity" "WARN" "Orphaned observations: $ORPHANED_OBS, conditions: $ORPHANED_COND"
    else
        validate_test "Reference Integrity" "FAIL" "Orphaned observations: $ORPHANED_OBS, conditions: $ORPHANED_COND"
    fi
else
    validate_test "Reference Integrity" "FAIL" "$REFERENCE_INTEGRITY"
fi

# =============================================================================
# Phase 9: Final Summary
# =============================================================================

section "📋 Validation Summary"

TOTAL_TESTS=$((VALIDATION_PASSED + VALIDATION_FAILED + VALIDATION_WARNINGS))

echo "" >> "$VALIDATION_LOG"
echo "==============================================================================" >> "$VALIDATION_LOG"
echo "VALIDATION SUMMARY" >> "$VALIDATION_LOG"
echo "==============================================================================" >> "$VALIDATION_LOG"
echo "Total Tests: $TOTAL_TESTS" >> "$VALIDATION_LOG"
echo "Passed: $VALIDATION_PASSED" >> "$VALIDATION_LOG"
echo "Failed: $VALIDATION_FAILED" >> "$VALIDATION_LOG"
echo "Warnings: $VALIDATION_WARNINGS" >> "$VALIDATION_LOG"
echo "" >> "$VALIDATION_LOG"

if [ "$VALIDATION_FAILED" -eq "0" ]; then
    if [ "$VALIDATION_WARNINGS" -eq "0" ]; then
        echo "OVERALL RESULT: ✅ ALL TESTS PASSED" >> "$VALIDATION_LOG"
        success "🎉 ALL VALIDATION TESTS PASSED!"
        success "Total: $TOTAL_TESTS | Passed: $VALIDATION_PASSED | Warnings: $VALIDATION_WARNINGS | Failed: $VALIDATION_FAILED"
    else
        echo "OVERALL RESULT: ⚠️  PASSED WITH WARNINGS" >> "$VALIDATION_LOG"
        warning "⚠️ VALIDATION COMPLETED WITH WARNINGS"
        info "Total: $TOTAL_TESTS | Passed: $VALIDATION_PASSED | Warnings: $VALIDATION_WARNINGS | Failed: $VALIDATION_FAILED"
    fi
else
    echo "OVERALL RESULT: ❌ VALIDATION FAILED" >> "$VALIDATION_LOG"
    warning "❌ VALIDATION FAILED - SYSTEM ISSUES DETECTED"
    warning "Total: $TOTAL_TESTS | Passed: $VALIDATION_PASSED | Warnings: $VALIDATION_WARNINGS | Failed: $VALIDATION_FAILED"
fi

echo "" >> "$VALIDATION_LOG"
echo "Validation completed at: $(date)" >> "$VALIDATION_LOG"

info "📄 Detailed validation report saved to: $VALIDATION_LOG"

# Create quick status file for automated systems
echo "{" > logs/validation-status.json
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> logs/validation-status.json
echo "  \"mode\": \"$MODE\"," >> logs/validation-status.json
echo "  \"total_tests\": $TOTAL_TESTS," >> logs/validation-status.json
echo "  \"passed\": $VALIDATION_PASSED," >> logs/validation-status.json
echo "  \"failed\": $VALIDATION_FAILED," >> logs/validation-status.json
echo "  \"warnings\": $VALIDATION_WARNINGS," >> logs/validation-status.json
echo "  \"success\": $([ "$VALIDATION_FAILED" -eq "0" ] && echo "true" || echo "false")" >> logs/validation-status.json
echo "}" >> logs/validation-status.json

log "✅ System validation completed"
log "📊 Results: Passed: $VALIDATION_PASSED | Warnings: $VALIDATION_WARNINGS | Failed: $VALIDATION_FAILED"

# Exit with appropriate code
if [ "$VALIDATION_FAILED" -gt "0" ]; then
    exit 1
else
    exit 0
fi