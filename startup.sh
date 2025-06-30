#!/bin/bash
#
# EMR System Startup Script for Container
# This script initializes the database and starts the services
#

set -e

echo "🏥 EMR System Container Startup"
echo "================================"

cd /app/backend

# Check if database already exists
if [ -f "/app/backend/data/emr.db" ]; then
    echo "✓ Database already exists"
else
    echo "📊 Initializing new database..."
    
    # Start backend temporarily to create tables
    python main.py &
    BACKEND_PID=$!
    sleep 5
    kill $BACKEND_PID 2>/dev/null || true
    
    # Run setup scripts
    echo "Creating sample providers..."
    python scripts/create_sample_providers.py
    
    echo "Populating clinical catalogs..."
    python scripts/populate_clinical_catalogs.py
    
    # Check if we should generate Synthea data
    if [ "$SKIP_SYNTHEA" != "true" ] && [ ! -d "data/synthea_output/fhir" ]; then
        echo "Generating synthetic patient data..."
        PATIENT_COUNT=${PATIENT_COUNT:-25}
        java -Xmx2g -jar synthea-with-dependencies.jar \
            -p $PATIENT_COUNT \
            -s 12345 \
            --exporter.fhir.export true \
            --exporter.baseDirectory data/synthea_output \
            Massachusetts
    fi
    
    # Import Synthea data if available
    if [ -d "data/synthea_output/fhir" ] && [ "$SKIP_IMPORT" != "true" ]; then
        echo "Importing patient data..."
        python scripts/optimized_synthea_import.py \
            --input-dir data/synthea_output/fhir \
            --batch-size 20
        
        echo "Assigning patients to providers..."
        python scripts/assign_patients_to_providers.py
        
        echo "Adding reference ranges..."
        python scripts/add_reference_ranges.py
        
        # Import clinical notes if script exists
        if [ -f "scripts/import_missing_clinical_data.py" ]; then
            echo "Importing clinical notes..."
            python scripts/import_missing_clinical_data.py --add-default-ranges || true
        fi
    fi
    
    echo "✓ Database initialization complete"
fi

echo "================================"
echo "✓ EMR System Ready"
echo "  Access the system at http://localhost"
echo "  API documentation at http://localhost/docs"
echo "================================"

# Hand over to supervisor to manage services
exec "$@"