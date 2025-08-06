#!/bin/bash

# =============================================================================
# Module 04c: Compartment Indexing
# =============================================================================
# Populates the fhir.compartments table for efficient Patient/$everything operations
# This enables fast retrieval of all resources related to a specific patient

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
    echo -e "${BLUE}[COMPARTMENT]${NC} $1"
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
    log "⏭️ Skipping compartment indexing as requested"
    exit 0
fi

log "📁 Starting patient compartment indexing..."

# Check current state
log "Checking current compartment state..."
CURRENT_COMPARTMENTS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.compartments WHERE compartment_type = 'Patient'" 2>/dev/null || echo "0")
CURRENT_COMPARTMENTS=$(echo $CURRENT_COMPARTMENTS | tr -d ' ')
log "  Current patient compartments: $CURRENT_COMPARTMENTS"

# Get patient count
PATIENT_COUNT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient' AND (deleted = FALSE OR deleted IS NULL)" 2>/dev/null || echo "0")
PATIENT_COUNT=$(echo $PATIENT_COUNT | tr -d ' ')
log "  Total patients: $PATIENT_COUNT"

# Get clinical resource count
CLINICAL_RESOURCES=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type IN ('Condition', 'Observation', 'MedicationRequest', 'Procedure', 'Encounter', 'AllergyIntolerance', 'Immunization', 'DiagnosticReport', 'CarePlan', 'ServiceRequest', 'DocumentReference') AND (deleted = FALSE OR deleted IS NULL)" 2>/dev/null || echo "0")
CLINICAL_RESOURCES=$(echo $CLINICAL_RESOURCES | tr -d ' ')
log "  Clinical resources: $CLINICAL_RESOURCES"

# Expected compartments (roughly equal to clinical resources)
if [ "$CURRENT_COMPARTMENTS" -lt "$CLINICAL_RESOURCES" ]; then
    log "Compartments seem incomplete ($CURRENT_COMPARTMENTS < $CLINICAL_RESOURCES clinical resources)"
    log "Running compartment population..."
    
    # Try the populate_compartments.py script
    if docker exec emr-backend test -f /app/scripts/populate_compartments.py; then
        log "Using compartment population script..."
        
        # Run with timeout (5 minutes max)
        timeout 300 docker exec emr-backend python scripts/populate_compartments.py 2>&1 | while IFS= read -r line; do
            if echo "$line" | grep -q "Progress:"; then
                echo -ne "\r${BLUE}[COMPARTMENT]${NC} $line"
            else
                echo ""
                log "$line"
            fi
        done
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            success "Compartment population completed successfully"
        elif [ ${PIPESTATUS[0]} -eq 124 ]; then
            warning "Compartment population timed out after 5 minutes"
        else
            warning "Compartment population failed, trying fallback method..."
            
            # Fallback: Direct compartment population
            log "Running direct compartment population..."
            docker exec emr-backend python -c "
import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def populate_compartments():
    engine = create_async_engine('postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    
    async with engine.connect() as conn:
        # Get all patients
        result = await conn.execute(text('''
            SELECT fhir_id FROM fhir.resources 
            WHERE resource_type = 'Patient' 
            AND (deleted = FALSE OR deleted IS NULL)
        '''))
        patients = [row[0] for row in result]
        
        total_added = 0
        for patient_id in patients:
            # Get all resources related to this patient
            result = await conn.execute(text('''
                SELECT DISTINCT r.id, r.resource_type
                FROM fhir.resources r
                WHERE (r.deleted = FALSE OR r.deleted IS NULL)
                AND (
                    -- Direct patient reference
                    (r.resource->>'patient' LIKE :patient_ref OR r.resource->>'patient' LIKE :patient_uuid)
                    OR
                    -- Subject reference
                    (r.resource->'subject'->>'reference' LIKE :patient_ref OR r.resource->'subject'->>'reference' LIKE :patient_uuid)
                    OR
                    -- Patient is the resource itself
                    (r.resource_type = 'Patient' AND r.fhir_id = :patient_id)
                )
            '''), {
                'patient_ref': f'%Patient/{patient_id}%',
                'patient_uuid': f'%{patient_id}%',
                'patient_id': patient_id
            })
            
            resources = result.fetchall()
            
            for resource_id, resource_type in resources:
                # Check if compartment entry exists
                existing = await conn.execute(text('''
                    SELECT 1 FROM fhir.compartments 
                    WHERE compartment_type = 'Patient'
                    AND compartment_id = :patient_id
                    AND resource_id = :resource_id
                '''), {'patient_id': patient_id, 'resource_id': resource_id})
                
                if not existing.fetchone():
                    await conn.execute(text('''
                        INSERT INTO fhir.compartments 
                        (compartment_type, compartment_id, resource_id, resource_type)
                        VALUES ('Patient', :patient_id, :resource_id, :resource_type)
                    '''), {
                        'patient_id': patient_id,
                        'resource_id': resource_id,
                        'resource_type': resource_type
                    })
                    total_added += 1
            
            await conn.commit()
        
        print(f'Added {total_added} compartment entries')
    
    await engine.dispose()

asyncio.run(populate_compartments())
" || warning "Fallback compartment population also failed"
        fi
    else
        error "Compartment population script not found"
    fi
else
    log "Compartments look adequate ($CURRENT_COMPARTMENTS compartments)"
fi

# Verify results
log "Verifying compartment population..."

# Get new compartment count
NEW_COMPARTMENTS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT COUNT(*) FROM fhir.compartments WHERE compartment_type = 'Patient'" 2>/dev/null || echo "0")
NEW_COMPARTMENTS=$(echo $NEW_COMPARTMENTS | tr -d ' ')

# Get compartment statistics
log "Compartment statistics:"
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
    resource_type,
    COUNT(DISTINCT compartment_id) as patients,
    COUNT(*) as total_entries
FROM fhir.compartments 
WHERE compartment_type = 'Patient'
GROUP BY resource_type
ORDER BY total_entries DESC 
LIMIT 10" 2>/dev/null || warning "Could not get compartment statistics"

# Test Patient/$everything operation
log "Testing Patient/\$everything operation..."

# Get a sample patient ID
SAMPLE_PATIENT=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c "SELECT fhir_id FROM fhir.resources WHERE resource_type = 'Patient' LIMIT 1" 2>/dev/null | tr -d ' ')

if [ -n "$SAMPLE_PATIENT" ]; then
    EVERYTHING_TEST=$(docker exec emr-backend bash -c "
    curl -s 'http://localhost:8000/fhir/R4/Patient/$SAMPLE_PATIENT/\$everything?_count=5' | python -c '
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get(\"resourceType\") == \"Bundle\" and len(data.get(\"entry\", [])) > 0:
        print(f\"EVERYTHING_SUCCESS:entries={len(data.get('entry', []))}\")
    else:
        print(\"EVERYTHING_FAILED:no_entries\")
except Exception as e:
    print(f\"EVERYTHING_FAILED:parse_error:{e}\")
'" 2>&1 || echo "EVERYTHING_FAILED:request_error")
    
    if echo "$EVERYTHING_TEST" | grep -q "EVERYTHING_SUCCESS"; then
        success "Patient/\$everything test passed"
    else
        warning "Patient/\$everything test failed: $EVERYTHING_TEST"
    fi
else
    warning "No patients found to test \$everything operation"
fi

# Final summary
if [ "$NEW_COMPARTMENTS" -gt "$CURRENT_COMPARTMENTS" ]; then
    COMPARTMENTS_ADDED=$((NEW_COMPARTMENTS - CURRENT_COMPARTMENTS))
    success "Compartment indexing completed"
    log "  Compartments added: $COMPARTMENTS_ADDED"
    log "  Total compartments: $NEW_COMPARTMENTS"
    log "  Average resources per patient: $((NEW_COMPARTMENTS / PATIENT_COUNT))"
elif [ "$NEW_COMPARTMENTS" -eq "0" ]; then
    error "No compartments found after indexing - Patient/\$everything will not work"
else
    success "Compartment verification completed"
    log "  Total compartments: $NEW_COMPARTMENTS"
fi

# Create summary file
cat > "$ROOT_DIR/logs/compartment-indexing-summary.json" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "initial_compartments": $CURRENT_COMPARTMENTS,
    "final_compartments": $NEW_COMPARTMENTS,
    "compartments_added": $((NEW_COMPARTMENTS - CURRENT_COMPARTMENTS)),
    "total_patients": $PATIENT_COUNT,
    "clinical_resources": $CLINICAL_RESOURCES,
    "average_per_patient": $((NEW_COMPARTMENTS / PATIENT_COUNT))
}
EOF

log "✨ Compartment indexing module completed"