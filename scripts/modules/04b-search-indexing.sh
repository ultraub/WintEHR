#!/bin/bash

# =============================================================================
# Module 04b: Search Parameter Indexing
# =============================================================================
# Ensures all FHIR search parameters are properly indexed for efficient querying
# This is critical for clinical searches and patient lookups

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
    echo -e "${BLUE}[SEARCH-INDEX]${NC} $1"
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
    log "⏭️ Skipping search parameter indexing as requested"
    exit 0
fi

log "🔍 Starting FHIR search parameter indexing..."

# Check current state
log "Checking current search parameter state..."
CURRENT_PARAM_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.search_params" 2>/dev/null || echo "0")
CURRENT_PARAM_COUNT=$(echo $CURRENT_PARAM_COUNT | tr -d ' ')
log "  Current search parameters in database: $CURRENT_PARAM_COUNT"

# Get resource count for comparison
RESOURCE_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL" 2>/dev/null || echo "0")
RESOURCE_COUNT=$(echo $RESOURCE_COUNT | tr -d ' ')
log "  Total resources in database: $RESOURCE_COUNT"

# Check specific critical search parameters
log "Checking critical search parameters..."
PATIENT_PARAMS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.search_params WHERE param_name IN ('patient', 'subject')" 2>/dev/null || echo "0")
PATIENT_PARAMS=$(echo $PATIENT_PARAMS | tr -d ' ')
log "  Patient/subject parameters indexed: $PATIENT_PARAMS"

# Calculate expected parameters (at least 1 per clinical resource)
CLINICAL_RESOURCES=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type IN ('Condition', 'Observation', 'MedicationRequest', 'Procedure', 'Encounter', 'AllergyIntolerance', 'Immunization', 'DiagnosticReport') AND (deleted = FALSE OR deleted IS NULL)" 2>/dev/null || echo "0")
CLINICAL_RESOURCES=$(echo $CLINICAL_RESOURCES | tr -d ' ')

if [ "$PATIENT_PARAMS" -lt "$CLINICAL_RESOURCES" ]; then
    log "Search parameters seem incomplete ($PATIENT_PARAMS < $CLINICAL_RESOURCES clinical resources)"
    log "Running comprehensive search parameter indexing..."
    
    # Try consolidated search indexing script first
    if docker exec emr-backend test -f /app/scripts/consolidated_search_indexing.py; then
        log "Using consolidated search indexing script..."
        
        # Run with mode index
        INDEX_RESULT=$(docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index 2>&1 || echo "INDEX_FAILED")
        
        if echo "$INDEX_RESULT" | grep -q "successfully" || [ $? -eq 0 ]; then
            success "Search parameter indexing completed successfully"
        else
            warning "Initial indexing encountered issues, trying fix mode..."
            
            # Try fix mode
            FIX_RESULT=$(docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix 2>&1 || echo "FIX_FAILED")
            
            if echo "$FIX_RESULT" | grep -q "successfully" || [ $? -eq 0 ]; then
                success "Search parameter fixing completed"
            else
                warning "Consolidated indexing failed, using fallback method..."
                
                # Fallback: Direct indexing of critical parameters
                log "Running direct parameter indexing..."
                docker exec emr-backend python -c "
import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def index_critical_params():
    engine = create_async_engine('postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    
    async with engine.connect() as conn:
        # Index patient/subject references for clinical resources
        resource_types = ['Condition', 'Observation', 'MedicationRequest', 'Procedure', 
                         'Encounter', 'AllergyIntolerance', 'Immunization', 'DiagnosticReport']
        
        total_indexed = 0
        for rtype in resource_types:
            result = await conn.execute(text('''
                SELECT r.id, r.resource 
                FROM fhir.resources r
                WHERE r.resource_type = :rtype
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp
                    WHERE sp.resource_id = r.id
                    AND sp.param_name IN ('patient', 'subject')
                )
            '''), {'rtype': rtype})
            
            resources = result.fetchall()
            indexed = 0
            
            for res_id, res_json in resources:
                try:
                    resource = json.loads(res_json) if isinstance(res_json, str) else res_json
                    patient_ref = None
                    param_name = 'patient'
                    
                    # Extract patient reference
                    if 'subject' in resource and isinstance(resource['subject'], dict):
                        patient_ref = resource['subject'].get('reference')
                        param_name = 'subject'
                    elif 'patient' in resource and isinstance(resource['patient'], dict):
                        patient_ref = resource['patient'].get('reference')
                    
                    if patient_ref:
                        patient_id = patient_ref.replace('urn:uuid:', '').replace('Patient/', '')
                        
                        # Delete existing to avoid duplicates
                        await conn.execute(text('''
                            DELETE FROM fhir.search_params 
                            WHERE resource_id = :rid AND param_name = :pname
                        '''), {'rid': res_id, 'pname': param_name})
                        
                        # Insert new parameter
                        await conn.execute(text('''
                            INSERT INTO fhir.search_params 
                            (resource_id, resource_type, param_name, param_type, value_reference)
                            VALUES (:rid, :rtype, :pname, 'reference', :pid)
                        '''), {'rid': res_id, 'rtype': rtype, 'pname': param_name, 'pid': patient_id})
                        
                        indexed += 1
                        
                    # Also index status if present
                    if 'status' in resource and resource['status']:
                        await conn.execute(text('''
                            DELETE FROM fhir.search_params 
                            WHERE resource_id = :rid AND param_name = 'status'
                        '''), {'rid': res_id})
                        
                        await conn.execute(text('''
                            INSERT INTO fhir.search_params 
                            (resource_id, resource_type, param_name, param_type, value_string)
                            VALUES (:rid, :rtype, 'status', 'token', :status)
                        '''), {'rid': res_id, 'rtype': rtype, 'status': resource['status']})
                        
                except Exception as e:
                    pass
            
            await conn.commit()
            total_indexed += indexed
            print(f'Indexed {indexed} parameters for {rtype}')
        
        print(f'Total parameters indexed: {total_indexed}')
    
    await engine.dispose()

asyncio.run(index_critical_params())
" || warning "Fallback indexing also failed"
            fi
        fi
    else
        error "Search parameter indexing script not found"
    fi
else
    log "Search parameters look adequate ($PATIENT_PARAMS parameters for $CLINICAL_RESOURCES clinical resources)"
fi

# Verify results
log "Verifying search parameter indexing..."

# Get new parameter count
NEW_PARAM_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.search_params" 2>/dev/null || echo "0")
NEW_PARAM_COUNT=$(echo $NEW_PARAM_COUNT | tr -d ' ')

# Get parameter statistics
log "Search parameter statistics:"
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
    param_name, 
    param_type,
    COUNT(*) as count 
FROM fhir.search_params 
GROUP BY param_name, param_type
ORDER BY count DESC 
LIMIT 15" 2>/dev/null || warning "Could not get parameter statistics"

# Test a clinical search
log "Testing clinical search functionality..."
SEARCH_TEST=$(docker exec emr-backend bash -c "
curl -s 'http://localhost:8000/fhir/R4/Condition?patient=*&_count=1' | python -c '
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get(\"resourceType\") == \"Bundle\":
        print(f\"SEARCH_SUCCESS:total={data.get('total', 0)}\")
    else:
        print(\"SEARCH_FAILED:invalid_response\")
except:
    print(\"SEARCH_FAILED:parse_error\")
'" 2>&1 || echo "SEARCH_FAILED:request_error")

if echo "$SEARCH_TEST" | grep -q "SEARCH_SUCCESS"; then
    success "Clinical search test passed"
else
    warning "Clinical search test failed: $SEARCH_TEST"
fi

# Final summary
if [ "$NEW_PARAM_COUNT" -gt "$CURRENT_PARAM_COUNT" ]; then
    PARAMS_ADDED=$((NEW_PARAM_COUNT - CURRENT_PARAM_COUNT))
    success "Search parameter indexing completed"
    log "  Parameters added: $PARAMS_ADDED"
    log "  Total parameters: $NEW_PARAM_COUNT"
elif [ "$NEW_PARAM_COUNT" -eq "0" ]; then
    error "No search parameters found after indexing - searches will not work"
else
    success "Search parameter verification completed"
    log "  Total parameters: $NEW_PARAM_COUNT"
fi

# Create summary file
cat > "$ROOT_DIR/logs/search-indexing-summary.json" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "initial_parameters": $CURRENT_PARAM_COUNT,
    "final_parameters": $NEW_PARAM_COUNT,
    "parameters_added": $((NEW_PARAM_COUNT - CURRENT_PARAM_COUNT)),
    "total_resources": $RESOURCE_COUNT,
    "clinical_resources": $CLINICAL_RESOURCES
}
EOF

log "✨ Search parameter indexing module completed"