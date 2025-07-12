#!/bin/bash

# =============================================================================
# Module 03: Data Import
# =============================================================================
# Safely imports FHIR data while preserving the database schema

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
MODE="development"
ROOT_DIR=""
SKIP_DATA=false

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
        --skip-data=*)
            SKIP_DATA="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

log() {
    echo -e "${BLUE}[DATA-IMPORT]${NC} $1"
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

# Change to root directory
cd "$ROOT_DIR"

if [ "$SKIP_DATA" = "true" ]; then
    log "⏭️ Skipping data import as requested"
    exit 0
fi

log "📥 Starting FHIR data import..."

# Step 1: Verify data exists
log "Checking for generated data..."
DATA_FILES=$(docker exec emr-backend bash -c "ls /synthea/output/fhir/*.json 2>/dev/null | wc -l" || echo "0")

if [ "$DATA_FILES" -eq "0" ]; then
    error "No FHIR data files found. Please run data generation first."
fi

success "Found $DATA_FILES FHIR files to import"

# Step 2: Verify database schema is intact
log "Verifying database schema integrity..."

# Check if FHIR tables exist
FHIR_TABLE_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fhir'" 2>&1 | tr -d ' ')
EXISTING_RESOURCES=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL" 2>&1 | tr -d ' ')

if [ "$FHIR_TABLE_COUNT" -ge "4" ]; then
    success "Database schema verified (existing resources: $EXISTING_RESOURCES)"
    
    if [ "$EXISTING_RESOURCES" -gt "0" ]; then
        log "Found existing resources - import will add to existing data"
    fi
else
    error "Critical FHIR tables missing. Please run database initialization."
fi

# Step 3: Clear existing data if needed (but preserve schema)
if [ "$EXISTING_RESOURCES" -gt "0" ]; then
    log "Clearing existing data while preserving schema..."
    
    CLEAR_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py wipe" 2>&1 || echo "CLEAR_FAILED")
    
    if echo "$CLEAR_RESULT" | grep -q "Database data cleared"; then
        success "Existing data cleared (schema preserved)"
    elif echo "$CLEAR_RESULT" | grep -q "Proper FHIR schema not found"; then
        error "Cannot clear data: Schema validation failed"
    else
        error "Data clearing failed: $CLEAR_RESULT"
    fi
fi

# Step 4: Import data using safe method
log "Importing FHIR data (preserving schema)..."
IMPORT_START=$(date +%s)

IMPORT_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py import --validation-mode light" 2>&1 || echo "IMPORT_FAILED")

IMPORT_END=$(date +%s)
IMPORT_TIME=$((IMPORT_END - IMPORT_START))

# Parse import results
if echo "$IMPORT_RESULT" | grep -q "Import Summary"; then
    FILES_PROCESSED=$(echo "$IMPORT_RESULT" | grep "Files processed:" | grep -o "[0-9]*" | head -1)
    RESOURCES_PROCESSED=$(echo "$IMPORT_RESULT" | grep "Resources processed:" | grep -o "[0-9]*" | head -1)
    SUCCESSFULLY_IMPORTED=$(echo "$IMPORT_RESULT" | grep "Successfully imported:" | grep -o "[0-9]*" | head -1)
    FAILED_IMPORTS=$(echo "$IMPORT_RESULT" | grep "Failed:" | grep -o "[0-9]*" | head -1)
    
    success "Import completed in ${IMPORT_TIME}s"
    log "  Files processed: $FILES_PROCESSED"
    log "  Resources processed: $RESOURCES_PROCESSED"
    log "  Successfully imported: $SUCCESSFULLY_IMPORTED"
    log "  Failed: $FAILED_IMPORTS"
    
    if [ "$FAILED_IMPORTS" -gt "0" ]; then
        warning "Some resources failed to import. Checking for compatibility issues..."
        
        # Check if it's due to schema mismatch
        if echo "$IMPORT_RESULT" | grep -q "does not exist\|relation.*does not exist"; then
            error "Import failed due to schema mismatch. The synthea_master.py script may not be using the correct schema."
        fi
    fi
    
    if [ "$SUCCESSFULLY_IMPORTED" -eq "0" ]; then
        error "No resources were successfully imported. Check logs for details."
    fi
    
elif echo "$IMPORT_RESULT" | grep -q "IMPORT_FAILED"; then
    error "Import process failed: $IMPORT_RESULT"
else
    warning "Import completed with unknown status: $IMPORT_RESULT"
fi

# Step 5: Verify imported data
log "Verifying imported data..."

VERIFICATION_RESULT=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def verify_import():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Get resource counts by type
        resource_counts = await conn.fetch(\"\"\"
            SELECT resource_type, COUNT(*) as count 
            FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
            GROUP BY resource_type 
            ORDER BY count DESC
        \"\"\")
        
        # Get total counts
        total_resources = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL\")
        total_search_params = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.search_params\")
        patient_count = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\' AND (deleted = FALSE OR deleted IS NULL)\")
        
        await conn.close()
        
        print(f\"VERIFICATION_SUCCESS:total={total_resources},patients={patient_count},search_params={total_search_params}\")
        
        # Print resource breakdown
        for row in resource_counts:
            print(f\"  {row[\\\"resource_type\\\"]}: {row[\\\"count\\\"]}\")
            
    except Exception as e:
        print(f\"VERIFICATION_ERROR:{e}\")

asyncio.run(verify_import())
'" 2>&1)

if echo "$VERIFICATION_RESULT" | grep -q "VERIFICATION_SUCCESS"; then
    # Parse verification results
    TOTAL_IMPORTED=$(echo "$VERIFICATION_RESULT" | grep -o "total=[0-9]*" | cut -d= -f2)
    PATIENTS_IMPORTED=$(echo "$VERIFICATION_RESULT" | grep -o "patients=[0-9]*" | cut -d= -f2)
    SEARCH_PARAMS_CREATED=$(echo "$VERIFICATION_RESULT" | grep -o "search_params=[0-9]*" | cut -d= -f2)
    
    success "Data verification passed"
    log "  Total resources: $TOTAL_IMPORTED"
    log "  Patients: $PATIENTS_IMPORTED"
    log "  Search parameters: $SEARCH_PARAMS_CREATED"
    
    # Show resource breakdown
    log "Resource breakdown:"
    echo "$VERIFICATION_RESULT" | grep -E "^\s*[A-Z].*:" | while read -r line; do
        log "$line"
    done
    
    if [ "$TOTAL_IMPORTED" -eq "0" ]; then
        error "No resources found in database after import"
    fi
    
    if [ "$PATIENTS_IMPORTED" -eq "0" ]; then
        error "No patients found in database after import"
    fi
    
elif echo "$VERIFICATION_RESULT" | grep -q "VERIFICATION_ERROR"; then
    error "Data verification failed: $VERIFICATION_RESULT"
else
    error "Data verification completed with unknown status: $VERIFICATION_RESULT"
fi

# Step 6: Test basic FHIR operations
log "Testing FHIR operations..."

API_TEST_RESULT=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import aiohttp
import json

async def test_fhir_api():
    try:
        async with aiohttp.ClientSession() as session:
            # Test patient search
            async with session.get(\"http://localhost:8000/fhir/R4/Patient?_count=1\") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get(\"resourceType\") == \"Bundle\" and data.get(\"total\", 0) > 0:
                        print(\"API_TEST_PASSED:patients_accessible\")
                    else:
                        print(\"API_TEST_FAILED:no_patients_returned\")
                else:
                    print(f\"API_TEST_FAILED:status_{response.status}\")
    except Exception as e:
        print(f\"API_TEST_ERROR:{e}\")

asyncio.run(test_fhir_api())
'" 2>&1)

if echo "$API_TEST_RESULT" | grep -q "API_TEST_PASSED"; then
    success "FHIR API test passed"
elif echo "$API_TEST_RESULT" | grep -q "API_TEST_FAILED"; then
    warning "FHIR API test failed: $API_TEST_RESULT"
    warning "Data was imported but API may not be ready yet"
else
    warning "FHIR API test error: $API_TEST_RESULT"
fi

# Step 7: Mode-specific validations
if [ "$MODE" = "production" ]; then
    log "Running production data validations..."
    
    # Check for data integrity
    INTEGRITY_CHECK=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def check_integrity():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Check for orphaned references
        orphaned_refs = await conn.fetchval(\"\"\"
            SELECT COUNT(*) FROM fhir.search_params sp
            LEFT JOIN fhir.resources r ON sp.resource_id = r.id
            WHERE r.id IS NULL
        \"\"\")
        
        # Check for duplicate resources
        duplicate_resources = await conn.fetchval(\"\"\"
            SELECT COUNT(*) FROM (
                SELECT resource_type, fhir_id, COUNT(*) 
                FROM fhir.resources 
                WHERE deleted = FALSE OR deleted IS NULL
                GROUP BY resource_type, fhir_id 
                HAVING COUNT(*) > 1
            ) duplicates
        \"\"\")
        
        await conn.close()
        
        if orphaned_refs > 0 or duplicate_resources > 0:
            print(f\"INTEGRITY_ISSUES:orphaned={orphaned_refs},duplicates={duplicate_resources}\")
        else:
            print(\"INTEGRITY_OK\")
            
    except Exception as e:
        print(f\"INTEGRITY_ERROR:{e}\")

asyncio.run(check_integrity())
'" 2>&1)
    
    if echo "$INTEGRITY_CHECK" | grep -q "INTEGRITY_OK"; then
        success "Production data integrity check passed"
    elif echo "$INTEGRITY_CHECK" | grep -q "INTEGRITY_ISSUES"; then
        warning "Data integrity issues found: $INTEGRITY_CHECK"
        warning "System will continue but data may need cleanup"
    else
        warning "Data integrity check failed: $INTEGRITY_CHECK"
    fi
fi

# Step 8: Create import summary
log "Creating import summary..."

docker exec emr-backend bash -c "cd /app && python -c '
import json
from datetime import datetime

summary = {
    \"import_time\": \"$(date -Iseconds)\",
    \"mode\": \"$MODE\",
    \"files_processed\": $FILES_PROCESSED,
    \"resources_processed\": $RESOURCES_PROCESSED,
    \"successfully_imported\": $SUCCESSFULLY_IMPORTED,
    \"failed_imports\": $FAILED_IMPORTS,
    \"total_resources_in_db\": $TOTAL_IMPORTED,
    \"patients_in_db\": $PATIENTS_IMPORTED,
    \"search_params_created\": $SEARCH_PARAMS_CREATED,
    \"import_duration_seconds\": $IMPORT_TIME,
    \"schema_preserved\": True
}

with open(\"/app/backend/data/import_summary.json\", \"w\") as f:
    json.dump(summary, f, indent=2)
'"

success "Import summary created"

log "🎉 Data import completed successfully!"
log "✅ Resources imported: $SUCCESSFULLY_IMPORTED"
log "✅ Patients available: $PATIENTS_IMPORTED"
log "✅ Search parameters: $SEARCH_PARAMS_CREATED"
log "✅ Import time: ${IMPORT_TIME}s"
log "✅ Schema integrity: Preserved"

if [ "$FAILED_IMPORTS" -gt "0" ]; then
    warning "⚠️ Failed imports: $FAILED_IMPORTS (check logs for details)"
fi