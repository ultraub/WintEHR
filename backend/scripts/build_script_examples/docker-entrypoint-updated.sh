#!/bin/bash
# Updated Docker entrypoint with Synthea Master Script integration

set -e

echo "🏥 Starting MedGenEMR with optional Synthea data..."

# Check if we should generate Synthea data
if [[ "$GENERATE_SYNTHEA" == "true" ]]; then
    echo "🧬 Generating Synthea data..."
    
    # Setup Synthea if not already done
    if [[ ! -d "../synthea" ]]; then
        echo "Setting up Synthea..."
        cd /app && python scripts/synthea_master.py setup
    fi
    
    # Generate and import data
    PATIENT_COUNT=${SYNTHEA_PATIENT_COUNT:-10}
    VALIDATION_MODE=${SYNTHEA_VALIDATION_MODE:-transform_only}
    
    echo "Generating $PATIENT_COUNT patients with validation mode: $VALIDATION_MODE"
    cd /app && python scripts/synthea_master.py full \
        --count $PATIENT_COUNT \
        --validation-mode $VALIDATION_MODE \
        ${SYNTHEA_INCLUDE_DICOM:+--include-dicom}
    
    echo "✅ Synthea data generation complete"
fi

# Start the main application
exec "$@"
