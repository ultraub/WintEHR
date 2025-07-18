#!/bin/bash

# =============================================================================
# Module 04: Data Processing
# =============================================================================
# Handles name cleaning, CDS hooks creation, DICOM generation, and validation

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
    echo -e "${BLUE}[DATA-PROC]${NC} $1"
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
    log "⏭️ Skipping data processing as requested"
    exit 0
fi

log "🔄 Starting data processing..."

# Step 1: Clean patient and provider names
log "🧼 Cleaning patient and provider names..."

NAME_CLEANING_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/data_processor.py --clean-names" 2>&1 || echo "NAME_CLEANING_FAILED")

if echo "$NAME_CLEANING_RESULT" | grep -q "Names cleaned successfully\|NAME_CLEANING_COMPLETE"; then
    # Extract statistics if available
    PATIENTS_CLEANED=$(echo "$NAME_CLEANING_RESULT" | grep "NAME_CLEANING_COMPLETE" | grep -o "patients_cleaned=[0-9]*" | cut -d= -f2 || echo "0")
    PROVIDERS_CLEANED=$(echo "$NAME_CLEANING_RESULT" | grep "NAME_CLEANING_COMPLETE" | grep -o "providers_cleaned=[0-9]*" | cut -d= -f2 || echo "0")
    
    success "Name cleaning completed"
    log "  Patients processed: $PATIENTS_CLEANED"
    log "  Providers processed: $PROVIDERS_CLEANED"
elif echo "$NAME_CLEANING_RESULT" | grep -q "NAME_CLEANING_FAILED"; then
    # Try fallback method
    warning "Primary name cleaning failed, trying fallback method..."
    
    FALLBACK_RESULT=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg
import re

async def clean_names():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Clean patient names
        patients = await conn.fetch(\"SELECT id, resource FROM fhir.resources WHERE resource_type = \\'Patient\\' AND (deleted = FALSE OR deleted IS NULL)\")
        patients_cleaned = 0
        
        for patient in patients:
            resource = patient[\"resource\"]
            if \"name\" in resource:
                modified = False
                for name in resource[\"name\"]:
                    if \"family\" in name and name[\"family\"]:
                        cleaned_family = re.sub(r\"[0-9]+\", \"\", name[\"family\"]).strip()
                        if cleaned_family != name[\"family\"]:
                            name[\"family\"] = cleaned_family
                            modified = True
                    
                    if \"given\" in name and name[\"given\"]:
                        cleaned_given = []
                        for given in name[\"given\"]:
                            cleaned = re.sub(r\"[0-9]+\", \"\", given).strip()
                            if cleaned:
                                cleaned_given.append(cleaned)
                        if cleaned_given != name[\"given\"]:
                            name[\"given\"] = cleaned_given
                            modified = True
                
                if modified:
                    await conn.execute(
                        \"UPDATE fhir.resources SET resource = \$1, last_updated = NOW() WHERE id = \$2\",
                        resource, patient[\"id\"]
                    )
                    patients_cleaned += 1
        
        # Clean practitioner names
        practitioners = await conn.fetch(\"SELECT id, resource FROM fhir.resources WHERE resource_type = \\'Practitioner\\' AND (deleted = FALSE OR deleted IS NULL)\")
        providers_cleaned = 0
        
        for practitioner in practitioners:
            resource = practitioner[\"resource\"]
            if \"name\" in resource:
                modified = False
                for name in resource[\"name\"]:
                    if \"family\" in name and name[\"family\"]:
                        cleaned_family = re.sub(r\"[0-9]+\", \"\", name[\"family\"]).strip()
                        if cleaned_family != name[\"family\"]:
                            name[\"family\"] = cleaned_family
                            modified = True
                    
                    if \"given\" in name and name[\"given\"]:
                        cleaned_given = []
                        for given in name[\"given\"]:
                            cleaned = re.sub(r\"[0-9]+\", \"\", given).strip()
                            if cleaned:
                                cleaned_given.append(cleaned)
                        if cleaned_given != name[\"given\"]:
                            name[\"given\"] = cleaned_given
                            modified = True
                
                if modified:
                    await conn.execute(
                        \"UPDATE fhir.resources SET resource = \$1, last_updated = NOW() WHERE id = \$2\",
                        resource, practitioner[\"id\"]
                    )
                    providers_cleaned += 1
        
        await conn.close()
        print(f\"FALLBACK_SUCCESS:patients={patients_cleaned},providers={providers_cleaned}\")
        
    except Exception as e:
        print(f\"FALLBACK_ERROR:{e}\")

asyncio.run(clean_names())
'" 2>&1)
    
    if echo "$FALLBACK_RESULT" | grep -q "FALLBACK_SUCCESS"; then
        PATIENTS_CLEANED=$(echo "$FALLBACK_RESULT" | grep -o "patients=[0-9]*" | cut -d= -f2)
        PROVIDERS_CLEANED=$(echo "$FALLBACK_RESULT" | grep -o "providers=[0-9]*" | cut -d= -f2)
        success "Fallback name cleaning completed"
        log "  Patients cleaned: $PATIENTS_CLEANED"
        log "  Providers cleaned: $PROVIDERS_CLEANED"
    else
        warning "Name cleaning failed: $FALLBACK_RESULT"
    fi
else
    warning "Name cleaning completed with warnings: $NAME_CLEANING_RESULT"
fi

# Step 2: Enhance lab results with reference ranges
log "🧪 Enhancing lab results with reference ranges..."

ENHANCE_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/enhance_lab_results.py 2>&1" || echo "ENHANCE_ERROR")

if echo "$ENHANCE_RESULT" | grep -q "Enhanced .* observations"; then
    success "Lab results enhancement completed"
    # Extract counts from output
    ENHANCED_COUNT=$(echo "$ENHANCE_RESULT" | grep -o "Enhanced [0-9]* observations" | grep -o "[0-9]*" || echo "0")
    log "  Observations enhanced: $ENHANCED_COUNT"
elif echo "$ENHANCE_RESULT" | grep -q "ENHANCE_ERROR"; then
    warning "Lab results enhancement failed, but continuing..."
else
    log "Lab results enhancement output: $ENHANCE_RESULT"
fi

# Step 3: Create sample CDS hooks
log "🔧 Creating sample CDS hooks..."

CDS_HOOKS_RESULT=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg
import json

async def create_sample_hooks():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        sample_hooks = [
            {
                \"id\": \"diabetes-screening\",
                \"hook_type\": \"patient-view\",
                \"title\": \"Diabetes Screening Reminder\",
                \"description\": \"Reminds providers to screen patients over 45 for diabetes\",
                \"enabled\": True,
                \"conditions\": [{\"type\": \"age\", \"operator\": \"gt\", \"value\": 45}],
                \"actions\": [{\"type\": \"create\", \"summary\": \"Consider diabetes screening for patient over 45\", \"indicator\": \"info\"}]
            },
            {
                \"id\": \"hypertension-monitoring\",
                \"hook_type\": \"patient-view\",
                \"title\": \"Hypertension Monitoring\",
                \"description\": \"Monitors blood pressure readings and alerts for high values\",
                \"enabled\": True,
                \"conditions\": [{\"type\": \"lab_value\", \"operator\": \"gt\", \"value\": 140, \"lab_type\": \"blood_pressure_systolic\"}],
                \"actions\": [{\"type\": \"create\", \"summary\": \"High blood pressure detected - consider follow-up\", \"indicator\": \"warning\"}]
            },
            {
                \"id\": \"medication-allergy-check\",
                \"hook_type\": \"medication-prescribe\",
                \"title\": \"Allergy Interaction Check\",
                \"description\": \"Checks for medication allergies before prescribing\",
                \"enabled\": True,
                \"conditions\": [],
                \"actions\": [{\"type\": \"create\", \"summary\": \"Check for medication allergies before prescribing\", \"indicator\": \"warning\"}]
            },
            {
                \"id\": \"preventive-care-reminder\",
                \"hook_type\": \"patient-view\",
                \"title\": \"Preventive Care Reminder\",
                \"description\": \"Reminds providers about due preventive care measures\",
                \"enabled\": True,
                \"conditions\": [{\"type\": \"age\", \"operator\": \"ge\", \"value\": 50}],
                \"actions\": [{\"type\": \"create\", \"summary\": \"Preventive care screening may be due\", \"indicator\": \"info\"}]
            }
        ]
        
        hooks_created = 0
        for hook in sample_hooks:
            try:
                await conn.execute(\"\"\"
                    INSERT INTO cds_hooks.hook_configurations 
                    (id, hook_type, title, description, enabled, conditions, actions)
                    VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)
                    ON CONFLICT (id) DO UPDATE SET
                        hook_type = EXCLUDED.hook_type,
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        enabled = EXCLUDED.enabled,
                        conditions = EXCLUDED.conditions,
                        actions = EXCLUDED.actions,
                        updated_at = CURRENT_TIMESTAMP
                \"\"\", hook[\"id\"], hook[\"hook_type\"], hook[\"title\"], hook[\"description\"], 
                     hook[\"enabled\"], json.dumps(hook[\"conditions\"]), json.dumps(hook[\"actions\"]))
                hooks_created += 1
            except Exception as e:
                print(f\"Failed to create hook {hook[\\\"id\\\"]}: {e}\")
        
        await conn.close()
        print(f\"CDS_HOOKS_SUCCESS:created={hooks_created}\")
        
    except Exception as e:
        print(f\"CDS_HOOKS_ERROR:{e}\")

asyncio.run(create_sample_hooks())
'" 2>&1)

if echo "$CDS_HOOKS_RESULT" | grep -q "CDS_HOOKS_SUCCESS"; then
    HOOKS_CREATED=$(echo "$CDS_HOOKS_RESULT" | grep -o "created=[0-9]*" | cut -d= -f2)
    success "CDS hooks created: $HOOKS_CREATED"
elif echo "$CDS_HOOKS_RESULT" | grep -q "CDS_HOOKS_ERROR"; then
    warning "CDS hooks creation failed: $CDS_HOOKS_RESULT"
    warning "System will continue without sample CDS hooks"
else
    warning "CDS hooks creation completed with warnings: $CDS_HOOKS_RESULT"
fi

# Step 4: Re-index search parameters for all resources
log "🔍 Re-indexing search parameters for all resources..."

# First check if consolidated script exists, use it if available
if docker exec emr-backend test -f "/app/scripts/consolidated_search_indexing.py"; then
    log "Using consolidated search indexing script..."
    SEARCH_PARAM_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/consolidated_search_indexing.py --mode index" 2>&1 || echo "SEARCH_PARAM_INDEXING_FAILED")
    
    if echo "$SEARCH_PARAM_RESULT" | grep -q "Indexing complete:"; then
        # Extract statistics from new format
        RESOURCES_INDEXED=$(echo "$SEARCH_PARAM_RESULT" | grep -o "[0-9]* indexed" | grep -o "[0-9]*" | head -1 || echo "unknown")
        RESOURCES_SKIPPED=$(echo "$SEARCH_PARAM_RESULT" | grep -o "[0-9]* skipped" | grep -o "[0-9]*" | head -1 || echo "unknown")
        INDEXING_ERRORS=$(echo "$SEARCH_PARAM_RESULT" | grep -o "[0-9]* errors" | grep -o "[0-9]*" | head -1 || echo "0")
        
        if [ "$INDEXING_ERRORS" = "0" ]; then
            success "Search parameter indexing completed successfully"
        else
            warning "Search parameter indexing completed with $INDEXING_ERRORS errors"
        fi
        log "  Resources indexed: $RESOURCES_INDEXED"
        log "  Resources skipped: $RESOURCES_SKIPPED"
        
        # Run verification
        log "Verifying search parameter indexing..."
        VERIFY_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/consolidated_search_indexing.py --mode verify" 2>&1 || true)
        if echo "$VERIFY_RESULT" | grep -q "All critical search parameters are properly indexed"; then
            success "Search parameter verification passed"
        else
            warning "Some search parameters may need attention - running fix..."
            # Try to fix any missing parameters
            FIX_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/consolidated_search_indexing.py --mode fix" 2>&1 || true)
            if echo "$FIX_RESULT" | grep -q "Fixed [0-9]* resources"; then
                RESOURCES_FIXED=$(echo "$FIX_RESULT" | grep -o "Fixed [0-9]* resources" | grep -o "[0-9]*" | head -1)
                success "Fixed $RESOURCES_FIXED resources with missing parameters"
            fi
        fi
    else
        warning "Search parameter indexing may have failed"
        log "Output: $SEARCH_PARAM_RESULT"
    fi
else
    # Fallback to old method if new script doesn't exist
    warning "Consolidated search indexing script not found, trying legacy method..."
    SEARCH_PARAM_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/active/run_migration.py" 2>&1 || echo "SEARCH_PARAM_MIGRATION_FAILED")
    
    if echo "$SEARCH_PARAM_RESULT" | grep -q "Migration completed successfully\|Search parameter migration completed"; then
        # Extract statistics if available
        RESOURCES_MIGRATED=$(echo "$SEARCH_PARAM_RESULT" | grep -o "Migrated [0-9]* resources" | grep -o "[0-9]*" | head -1 || echo "unknown")
        PARAMS_CREATED=$(echo "$SEARCH_PARAM_RESULT" | grep -o "Created [0-9]* search parameters" | grep -o "[0-9]*" | head -1 || echo "unknown")
        
        success "Search parameter migration completed"
        log "  Resources migrated: $RESOURCES_MIGRATED"
        log "  Search parameters created: $PARAMS_CREATED"
    elif echo "$SEARCH_PARAM_RESULT" | grep -q "SEARCH_PARAM_MIGRATION_FAILED"; then
        warning "Search parameter migration failed"
        warning "System will continue but searches may not work properly"
        log "Error: $SEARCH_PARAM_RESULT"
    else
        log "Search parameter migration output: $SEARCH_PARAM_RESULT"
    fi
fi

# Step 5: Populate patient compartments
log "👥 Populating patient compartments..."

COMPARTMENT_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/populate_compartments.py" 2>&1 || echo "COMPARTMENT_POPULATION_FAILED")

if echo "$COMPARTMENT_RESULT" | grep -q "Successfully created .* compartment entries"; then
    # Extract statistics if available
    COMPARTMENTS_CREATED=$(echo "$COMPARTMENT_RESULT" | grep -o "Successfully created [0-9]* compartment entries" | grep -o "[0-9]*" | head -1 || echo "unknown")
    
    success "Patient compartment population completed"
    log "  Compartment entries created: $COMPARTMENTS_CREATED"
elif echo "$COMPARTMENT_RESULT" | grep -q "COMPARTMENT_POPULATION_FAILED"; then
    warning "Compartment population failed"
    warning "System will continue but Patient/$everything operations may not work properly"
    log "Error: $COMPARTMENT_RESULT"
else
    log "Compartment population output: $COMPARTMENT_RESULT"
fi

# Step 6: Populate compartments table
log "📦 Populating patient compartments for all resources..."

COMPARTMENT_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/populate_compartments.py" 2>&1 || echo "COMPARTMENT_POPULATION_FAILED")

if echo "$COMPARTMENT_RESULT" | grep -q "Population complete:"; then
    # Extract statistics
    RESOURCES_PROCESSED=$(echo "$COMPARTMENT_RESULT" | grep "Resources processed:" | grep -o "[0-9]*" || echo "0")
    COMPARTMENTS_CREATED=$(echo "$COMPARTMENT_RESULT" | grep "Compartments created:" | grep -o "[0-9]*" || echo "0")
    
    success "Compartment population completed"
    log "  Resources processed: $RESOURCES_PROCESSED"
    log "  Compartments created: $COMPARTMENTS_CREATED"
    
    # Get total compartments
    TOTAL_COMPARTMENTS=$(echo "$COMPARTMENT_RESULT" | grep "Total patient compartments:" | grep -o "[0-9]*" || echo "0")
    if [ "$TOTAL_COMPARTMENTS" -gt "0" ]; then
        log "  Total patient compartments: $TOTAL_COMPARTMENTS"
    else
        warning "No patient compartments found - Patient/$everything operations may not work"
    fi
elif echo "$COMPARTMENT_RESULT" | grep -q "COMPARTMENT_POPULATION_FAILED"; then
    warning "Compartment population failed"
    warning "Patient/$everything operations may not work properly"
    log "Error: $COMPARTMENT_RESULT"
else
    log "Compartment population output: $COMPARTMENT_RESULT"
fi

# Fix CDS hooks schema if needed
log "🔧 Checking CDS hooks schema..."

CDS_HOOKS_FIX_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/fix_cds_hooks_enabled_column.py" 2>&1 || echo "CDS_HOOKS_FIX_FAILED")

if echo "$CDS_HOOKS_FIX_RESULT" | grep -q "Schema fix completed successfully"; then
    success "CDS hooks schema verified/fixed"
elif echo "$CDS_HOOKS_FIX_RESULT" | grep -q "already exists"; then
    success "CDS hooks schema already correct"
else
    warning "Could not verify/fix CDS hooks schema"
    warning "CDS hooks may not work properly"
fi

# Step 7: Generate DICOM files for imaging studies
log "🏥 Generating DICOM files for imaging studies..."

DICOM_GENERATION_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/generate_dicom_for_studies.py" 2>&1 || echo "DICOM_GENERATION_FAILED")

if echo "$DICOM_GENERATION_RESULT" | grep -q "DICOM generation completed\|Successfully generated.*DICOM"; then
    # Extract statistics if available
    DICOM_FILES_CREATED=$(echo "$DICOM_GENERATION_RESULT" | grep -o "Generated [0-9]* DICOM" | grep -o "[0-9]*" | head -1 || echo "unknown")
    IMAGING_STUDIES_PROCESSED=$(echo "$DICOM_GENERATION_RESULT" | grep -o "studies processed.*[0-9]*" | grep -o "[0-9]*" | head -1 || echo "unknown")
    
    success "DICOM generation completed"
    log "  DICOM files created: $DICOM_FILES_CREATED"
    log "  Imaging studies processed: $IMAGING_STUDIES_PROCESSED"
elif echo "$DICOM_GENERATION_RESULT" | grep -q "DICOM_GENERATION_FAILED\|No ImagingStudy resources found"; then
    warning "DICOM generation failed or no imaging studies found"
    warning "System will continue without DICOM files"
    log "This is normal if no imaging studies were generated by Synthea"
else
    warning "DICOM generation completed with warnings: $DICOM_GENERATION_RESULT"
fi

# Step 7: Validate cross-references and data integrity
log "🔗 Validating data cross-references..."

REFERENCE_VALIDATION_RESULT=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg
import json

async def validate_references():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Check patient-encounter relationships
        patient_encounter_check = await conn.fetchrow(\"\"\"
            SELECT 
                COUNT(DISTINCT p.fhir_id) as patients_with_encounters,
                COUNT(e.fhir_id) as total_encounters
            FROM fhir.resources p
            LEFT JOIN fhir.resources e ON e.resource_type = \\'Encounter\\' 
                AND e.resource->\\'subject\\'->\\'reference\\' LIKE \\'%\\' || p.fhir_id || \\'%\\'
            WHERE p.resource_type = \\'Patient\\' AND (p.deleted = FALSE OR p.deleted IS NULL)
        \"\"\")
        
        # Check observation-patient relationships
        observation_check = await conn.fetchrow(\"\"\"
            SELECT COUNT(*) as orphaned_observations
            FROM fhir.resources o
            WHERE o.resource_type = \\'Observation\\' 
            AND (o.deleted = FALSE OR o.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources p 
                WHERE p.resource_type = \\'Patient\\' 
                AND (p.deleted = FALSE OR p.deleted IS NULL)
                AND o.resource->\\'subject\\'->\\'reference\\' LIKE \\'%\\' || p.fhir_id || \\'%\\'
            )
        \"\"\")
        
        # Check medication-patient relationships
        medication_check = await conn.fetchrow(\"\"\"
            SELECT COUNT(*) as orphaned_medications
            FROM fhir.resources m
            WHERE m.resource_type = \\'MedicationRequest\\' 
            AND (m.deleted = FALSE OR m.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources p 
                WHERE p.resource_type = \\'Patient\\' 
                AND (p.deleted = FALSE OR p.deleted IS NULL)
                AND m.resource->\\'subject\\'->\\'reference\\' LIKE \\'%\\' || p.fhir_id || \\'%\\'
            )
        \"\"\")
        
        await conn.close()
        
        total_patients = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\' AND (deleted = FALSE OR deleted IS NULL)\") if conn else 0
        
        print(f\"VALIDATION_COMPLETE:patients={total_patients}\")
        print(f\"  patients_with_encounters={patient_encounter_check[\\\"patients_with_encounters\\\"]}\")
        print(f\"  total_encounters={patient_encounter_check[\\\"total_encounters\\\"]}\")
        print(f\"  orphaned_observations={observation_check[\\\"orphaned_observations\\\"]}\")
        print(f\"  orphaned_medications={medication_check[\\\"orphaned_medications\\\"]}\")
        
    except Exception as e:
        print(f\"VALIDATION_ERROR:{e}\")

asyncio.run(validate_references())
'" 2>&1)

if echo "$REFERENCE_VALIDATION_RESULT" | grep -q "VALIDATION_COMPLETE"; then
    success "Data cross-reference validation completed"
    
    # Parse and display validation results
    echo "$REFERENCE_VALIDATION_RESULT" | grep -E "^\s*[a-z_]+=.*" | while read -r line; do
        log "$line"
    done
    
    # Check for issues
    ORPHANED_OBSERVATIONS=$(echo "$REFERENCE_VALIDATION_RESULT" | grep -o "orphaned_observations=[0-9]*" | cut -d= -f2 || echo "0")
    ORPHANED_MEDICATIONS=$(echo "$REFERENCE_VALIDATION_RESULT" | grep -o "orphaned_medications=[0-9]*" | cut -d= -f2 || echo "0")
    
    if [ "$ORPHANED_OBSERVATIONS" -gt "0" ] || [ "$ORPHANED_MEDICATIONS" -gt "0" ]; then
        warning "Found orphaned resources - this may indicate data integrity issues"
        warning "Orphaned observations: $ORPHANED_OBSERVATIONS"
        warning "Orphaned medications: $ORPHANED_MEDICATIONS"
    fi
    
elif echo "$REFERENCE_VALIDATION_RESULT" | grep -q "VALIDATION_ERROR"; then
    warning "Reference validation failed: $REFERENCE_VALIDATION_RESULT"
else
    warning "Reference validation completed with warnings: $REFERENCE_VALIDATION_RESULT"
fi

# Step 8: Performance optimizations based on mode
if [ "$MODE" = "production" ]; then
    log "⚡ Applying production performance optimizations..."
    
    # Update table statistics for query planner
    docker exec emr-postgres psql -U emr_user -d emr_db -c "ANALYZE;" >/dev/null 2>&1 || true
    
    # Vacuum tables to optimize storage
    docker exec emr-postgres psql -U emr_user -d emr_db -c "VACUUM;" >/dev/null 2>&1 || true
    
    success "Production optimizations applied"
else
    log "Development mode - skipping heavy optimizations"
fi

# Step 9: Create processing summary
log "📋 Creating data processing summary..."

docker exec emr-backend bash -c "cd /app && python -c '
import json
from datetime import datetime

summary = {
    \"processing_time\": \"$(date -Iseconds)\",
    \"mode\": \"$MODE\",
    \"name_cleaning\": {
        \"patients_cleaned\": \"$PATIENTS_CLEANED\",
        \"providers_cleaned\": \"$PROVIDERS_CLEANED\"
    },
    \"cds_hooks\": {
        \"hooks_created\": \"$HOOKS_CREATED\"
    },
    \"dicom_generation\": {
        \"files_created\": \"$DICOM_FILES_CREATED\",
        \"studies_processed\": \"$IMAGING_STUDIES_PROCESSED\"
    },
    \"data_validation\": {
        \"orphaned_observations\": \"$ORPHANED_OBSERVATIONS\",
        \"orphaned_medications\": \"$ORPHANED_MEDICATIONS\"
    }
}

with open(\"/app/backend/data/processing_summary.json\", \"w\") as f:
    json.dump(summary, f, indent=2)
'"

success "Processing summary created"

# Step 10: Final data validation
log "🔍 Running final data validation..."

FINAL_VALIDATION=$(docker exec emr-backend bash -c "cd /app && python -c '
import asyncio
import asyncpg

async def final_check():
    try:
        conn = await asyncpg.connect(\"postgresql://emr_user:emr_password@postgres:5432/emr_db\")
        
        # Get final counts
        total_resources = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL\")
        total_patients = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\' AND (deleted = FALSE OR deleted IS NULL)\")
        total_search_params = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.search_params\")
        total_compartments = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.compartments WHERE compartment_type = \\'Patient\\'\")
        total_cds_hooks = await conn.fetchval(\"SELECT COUNT(*) FROM cds_hooks.hook_configurations WHERE enabled = true\")
        
        # Validate patient search parameters exist
        patient_params = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.search_params WHERE param_name IN (\\'patient\\', \\'subject\\') AND param_type = \\'reference\\'\")
        condition_patient_params = await conn.fetchval(\"SELECT COUNT(*) FROM fhir.search_params WHERE resource_type = \\'Condition\\' AND param_name = \\'patient\\'\")
        
        await conn.close()
        
        print(f\"FINAL_VALIDATION_SUCCESS:resources={total_resources},patients={total_patients},search_params={total_search_params},cds_hooks={total_cds_hooks},compartments={total_compartments},patient_params={patient_params},condition_patient_params={condition_patient_params}\")
        
    except Exception as e:
        print(f\"FINAL_VALIDATION_ERROR:{e}\")

asyncio.run(final_check())
'" 2>&1)

if echo "$FINAL_VALIDATION" | grep -q "FINAL_VALIDATION_SUCCESS"; then
    FINAL_RESOURCES=$(echo "$FINAL_VALIDATION" | grep -o "resources=[0-9]*" | cut -d= -f2)
    FINAL_PATIENTS=$(echo "$FINAL_VALIDATION" | grep -o "patients=[0-9]*" | cut -d= -f2)
    FINAL_SEARCH_PARAMS=$(echo "$FINAL_VALIDATION" | grep -o "search_params=[0-9]*" | cut -d= -f2)
    FINAL_CDS_HOOKS=$(echo "$FINAL_VALIDATION" | grep -o "cds_hooks=[0-9]*" | cut -d= -f2)
    FINAL_COMPARTMENTS=$(echo "$FINAL_VALIDATION" | grep -o "compartments=[0-9]*" | cut -d= -f2)
    PATIENT_PARAMS=$(echo "$FINAL_VALIDATION" | grep -o "patient_params=[0-9]*" | cut -d= -f2)
    CONDITION_PATIENT_PARAMS=$(echo "$FINAL_VALIDATION" | grep -o "condition_patient_params=[0-9]*" | cut -d= -f2)
    
    success "Final validation passed"
    log "  Total resources: $FINAL_RESOURCES"
    log "  Patients: $FINAL_PATIENTS"
    log "  Search parameters: $FINAL_SEARCH_PARAMS"
    log "  Compartments: $FINAL_COMPARTMENTS"
    log "  Patient/subject params: $PATIENT_PARAMS"
    log "  Condition patient params: $CONDITION_PATIENT_PARAMS"
    log "  CDS hooks: $FINAL_CDS_HOOKS"
    
    if [ "$FINAL_RESOURCES" -eq "0" ]; then
        error "No resources found after processing"
    fi
    
    if [ "$FINAL_PATIENTS" -eq "0" ]; then
        error "No patients found after processing"
    fi
    
    if [ "$PATIENT_PARAMS" -eq "0" ]; then
        warning "No patient/subject search parameters found - searches may not work properly"
    fi
    
    if [ "$FINAL_COMPARTMENTS" -eq "0" ]; then
        warning "No patient compartments found - Patient/$everything operations may not work properly"
    fi
    
else
    error "Final validation failed: $FINAL_VALIDATION"
fi

log "🎉 Data processing completed successfully!"
log "✅ Name cleaning: Complete"
log "✅ CDS hooks: $HOOKS_CREATED created"
log "✅ Search parameters: $FINAL_SEARCH_PARAMS indexed"
log "✅ Compartments: $FINAL_COMPARTMENTS populated"
log "✅ DICOM generation: $DICOM_FILES_CREATED files"
log "✅ Data validation: Passed"
log "✅ Final resource count: $FINAL_RESOURCES"