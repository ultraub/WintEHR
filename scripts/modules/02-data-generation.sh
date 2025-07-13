#!/bin/bash

# =============================================================================
# Module 02: Data Generation
# =============================================================================
# Generates Synthea patient data without destroying the database schema

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
PATIENT_COUNT=5
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
        --patients=*)
            PATIENT_COUNT="${1#*=}"
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
    echo -e "${BLUE}[DATA-GEN]${NC} $1"
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
    log "⏭️ Skipping data generation as requested"
    
    # Check if we have existing data
    DATA_COUNT=$(docker exec emr-backend bash -c "ls /synthea/output/fhir/*.json 2>/dev/null | wc -l" || echo "0")
    if [ "$DATA_COUNT" -gt "0" ]; then
        success "Using existing data: $DATA_COUNT FHIR files found"
    else
        warning "No existing data found, but data generation was skipped"
        warning "The system will start with an empty database"
    fi
    exit 0
fi

log "🧬 Starting Synthea data generation..."
log "Mode: $MODE"
log "Patient count: $PATIENT_COUNT"

# Start backend container if not running
if ! docker-compose ps backend | grep -q "Up"; then
    log "Starting backend container..."
    docker-compose up -d backend
    
    # Wait for backend to be ready
    log "Waiting for backend to initialize..."
    timeout=120
    while ! docker exec emr-backend test -f /app/main.py >/dev/null 2>&1; do
        if [ $timeout -eq 0 ]; then
            error "Backend container failed to initialize within 120 seconds"
        fi
        sleep 1
        ((timeout--))
    done
    
    success "Backend container is ready"
fi

# Step 1: Setup Synthea
log "Setting up Synthea environment..."
SYNTHEA_SETUP_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py setup" 2>&1 || echo "SETUP_FAILED")

if echo "$SYNTHEA_SETUP_RESULT" | grep -q "setup complete"; then
    success "Synthea setup completed"
elif echo "$SYNTHEA_SETUP_RESULT" | grep -q "SETUP_FAILED"; then
    error "Synthea setup failed: $SYNTHEA_SETUP_RESULT"
else
    # Check if already setup
    if docker exec emr-backend test -f /synthea/build/libs/synthea-with-dependencies.jar >/dev/null 2>&1; then
        log "Synthea already setup, continuing..."
    else
        error "Synthea setup failed: $SYNTHEA_SETUP_RESULT"
    fi
fi

# Step 2: Configure Synthea for optimal generation
log "Configuring Synthea for $MODE mode..."

# Create mode-specific configuration
if [ "$MODE" = "production" ]; then
    YEARS_OF_HISTORY=10
    EXPORT_OPTIONS="--exporter.years_of_history $YEARS_OF_HISTORY --exporter.fhir.export true --exporter.baseDirectory ./output"
    log "Production mode: $YEARS_OF_HISTORY years of history per patient"
else
    YEARS_OF_HISTORY=5
    EXPORT_OPTIONS="--exporter.years_of_history $YEARS_OF_HISTORY --exporter.fhir.export true --exporter.baseDirectory ./output"
    log "Development mode: $YEARS_OF_HISTORY years of history per patient"
fi

# Step 3: Clear existing data if needed
EXISTING_FILES=$(docker exec emr-backend bash -c "ls /synthea/output/fhir/*.json 2>/dev/null | wc -l" || echo "0")
if [ "$EXISTING_FILES" -gt "0" ]; then
    log "Found $EXISTING_FILES existing FHIR files"
    
    # Backup existing data
    BACKUP_NAME="synthea_backup_$(date +%Y%m%d_%H%M%S)"
    log "Creating backup: $BACKUP_NAME"
    docker exec emr-backend bash -c "
        mkdir -p /app/backend/data/synthea_backups/$BACKUP_NAME
        cp /synthea/output/fhir/*.json /app/backend/data/synthea_backups/$BACKUP_NAME/ 2>/dev/null || true
    "
    
    # Clear for new generation
    docker exec emr-backend bash -c "rm -f /synthea/output/fhir/*.json"
    success "Existing data backed up and cleared"
fi

# Step 4: Generate new patient data
log "Generating $PATIENT_COUNT patients..."
GENERATION_START=$(date +%s)

GENERATION_RESULT=$(docker exec emr-backend bash -c "cd /app && python scripts/synthea_master.py generate --count $PATIENT_COUNT" 2>&1 || echo "GENERATION_FAILED")

GENERATION_END=$(date +%s)
GENERATION_TIME=$((GENERATION_END - GENERATION_START))

if echo "$GENERATION_RESULT" | grep -q "Generated.*FHIR files"; then
    # Extract number of files generated
    FILES_GENERATED=$(echo "$GENERATION_RESULT" | grep -o "Generated [0-9]* FHIR files" | grep -o "[0-9]*" | head -1)
    success "Generated $FILES_GENERATED FHIR files in ${GENERATION_TIME}s"
elif echo "$GENERATION_RESULT" | grep -q "GENERATION_FAILED"; then
    error "Data generation failed: $GENERATION_RESULT"
else
    warning "Generation completed with warnings: $GENERATION_RESULT"
fi

# Step 5: Validate generated data
log "Validating generated data..."

# Count generated files
GENERATED_FILES=$(docker exec emr-backend bash -c "ls /synthea/output/fhir/*.json 2>/dev/null | wc -l" || echo "0")
if [ "$GENERATED_FILES" -eq "0" ]; then
    error "No FHIR files were generated"
fi

# Check file sizes (ensure they're not empty)
EMPTY_FILES=$(docker exec emr-backend bash -c "find /synthea/output/fhir -name '*.json' -size 0 | wc -l" || echo "0")
if [ "$EMPTY_FILES" -gt "0" ]; then
    error "Found $EMPTY_FILES empty FHIR files"
fi

# Get total data size
TOTAL_SIZE=$(docker exec emr-backend bash -c "du -sh /synthea/output/fhir 2>/dev/null | cut -f1" || echo "unknown")
success "Generated data validation passed"
log "  Files: $GENERATED_FILES"
log "  Total size: $TOTAL_SIZE"

# Step 6: Analyze generated data structure
log "Analyzing generated data structure..."

DATA_ANALYSIS=$(docker exec emr-backend bash -c "cd /app && python -c '
import json
import os

fhir_dir = \"/synthea/output/fhir\"
if not os.path.exists(fhir_dir):
    print(\"NO_DATA_DIR\")
    exit(1)

files = [f for f in os.listdir(fhir_dir) if f.endswith(\".json\")]
if not files:
    print(\"NO_JSON_FILES\")
    exit(1)

resource_counts = {}
patient_count = 0
total_resources = 0

for filename in files:
    try:
        with open(os.path.join(fhir_dir, filename), \"r\") as f:
            bundle = json.load(f)
        
        if bundle.get(\"resourceType\") == \"Bundle\" and \"entry\" in bundle:
            for entry in bundle[\"entry\"]:
                if \"resource\" in entry:
                    resource_type = entry[\"resource\"].get(\"resourceType\", \"Unknown\")
                    resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1
                    total_resources += 1
                    
                    if resource_type == \"Patient\":
                        patient_count += 1
    except Exception as e:
        print(f\"ERROR_PARSING_{filename}: {e}\")
        continue

print(f\"ANALYSIS_COMPLETE:Patients={patient_count},Resources={total_resources}\")
for resource_type, count in sorted(resource_counts.items()):
    print(f\"  {resource_type}: {count}\")
'" 2>&1)

if echo "$DATA_ANALYSIS" | grep -q "ANALYSIS_COMPLETE"; then
    success "Data structure analysis completed"
    echo "$DATA_ANALYSIS" | grep -v "ANALYSIS_COMPLETE" | while read -r line; do
        if [ -n "$line" ]; then
            log "$line"
        fi
    done
elif echo "$DATA_ANALYSIS" | grep -q "ERROR_PARSING\|NO_DATA_DIR\|NO_JSON_FILES"; then
    error "Data analysis failed: $DATA_ANALYSIS"
else
    warning "Data analysis completed with issues: $DATA_ANALYSIS"
fi

# Step 7: Mode-specific optimizations
if [ "$MODE" = "production" ]; then
    log "Applying production data optimizations..."
    
    # Validate all patient data has required elements
    VALIDATION_RESULT=$(docker exec emr-backend bash -c "cd /app && python -c '
import json
import os

fhir_dir = \"/synthea/output/fhir\"
files = [f for f in os.listdir(fhir_dir) if f.endswith(\".json\")]

issues = []
for filename in files:
    try:
        with open(os.path.join(fhir_dir, filename), \"r\") as f:
            bundle = json.load(f)
        
        if bundle.get(\"resourceType\") == \"Bundle\" and \"entry\" in bundle:
            for entry in bundle[\"entry\"]:
                resource = entry.get(\"resource\", {})
                resource_type = resource.get(\"resourceType\")
                
                # Validate Patient resources have required fields
                if resource_type == \"Patient\":
                    if not resource.get(\"id\"):
                        issues.append(f\"Patient missing ID in {filename}\")
                    if not resource.get(\"name\"):
                        issues.append(f\"Patient missing name in {filename}\")
                
                # Validate Observation resources have values
                elif resource_type == \"Observation\":
                    if not (resource.get(\"valueQuantity\") or resource.get(\"valueString\") or resource.get(\"valueCodeableConcept\")):
                        # This is acceptable for some observations
                        pass
    except Exception as e:
        issues.append(f\"Error validating {filename}: {e}\")

if issues:
    print(\"VALIDATION_ISSUES:\")
    for issue in issues[:5]:  # Show first 5 issues
        print(f\"  {issue}\")
    if len(issues) > 5:
        print(f\"  ... and {len(issues) - 5} more issues\")
else:
    print(\"VALIDATION_PASSED\")
'" 2>&1)
    
    if echo "$VALIDATION_RESULT" | grep -q "VALIDATION_PASSED"; then
        success "Production data validation passed"
    else
        warning "Production data validation found issues:"
        echo "$VALIDATION_RESULT" | grep -v "VALIDATION_ISSUES" | while read -r line; do
            if [ -n "$line" ]; then
                log "$line"
            fi
        done
    fi
fi

# Step 8: Prepare data for import
log "Preparing data for import..."

# Create import metadata
# Get metadata values first
FILES_COUNT=$(docker exec emr-backend bash -c "ls /synthea/output/fhir/*.json 2>/dev/null | wc -l")
TOTAL_BYTES=$(docker exec emr-backend bash -c "du -sb /synthea/output/fhir 2>/dev/null | cut -f1" || echo "0")

docker exec emr-backend bash -c "cd /app && python -c '
import json
import os
from datetime import datetime

metadata = {
    \"generation_time\": \"$(date -Iseconds)\",
    \"mode\": \"$MODE\",
    \"patient_count\": $PATIENT_COUNT,
    \"files_generated\": $FILES_COUNT,
    \"total_size_bytes\": $TOTAL_BYTES,
    \"generator\": \"synthea_master.py\",
    \"schema_preservation\": True
}

with open(\"/synthea/output/generation_metadata.json\", \"w\") as f:
    json.dump(metadata, f, indent=2)
'"

success "Data generation metadata created"

log "🎉 Data generation completed successfully!"
log "✅ Generated: $GENERATED_FILES FHIR files"
log "✅ Total size: $TOTAL_SIZE"
log "✅ Patient count: $PATIENT_COUNT"
log "✅ Mode: $MODE"
log "✅ Schema preservation: Enabled"