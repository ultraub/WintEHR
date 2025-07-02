#!/bin/bash
set -e

echo "🏥 Starting MedGenEMR All-in-One Container"
echo "========================================="

# Start supervisor
supervisord -c /app/supervisord.conf

# Wait for backend to be ready
echo "⏳ Waiting for backend to start..."
while ! curl -f http://localhost:8000/health > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Backend is ready!"

# Initialize database if needed
if [ ! -f /app/data/emr.db ]; then
    echo "📊 Initializing database..."
    cd /app
    
    # Create tables
    python -c 'from database.database import engine, Base; Base.metadata.create_all(bind=engine)'
    
    # Create providers
    python scripts/create_sample_providers.py || true
    
    # Populate catalogs
    python scripts/populate_clinical_catalogs.py || true
    
    # Generate patients with Synthea
    if [ -n "$PATIENT_COUNT" ]; then
        echo "👥 Generating $PATIENT_COUNT patients with Synthea..."
        mkdir -p synthea_output
        java -jar synthea-with-dependencies.jar \
            -p $PATIENT_COUNT \
            --exporter.fhir.export false \
            --exporter.csv.export true \
            --exporter.csv.folder_per_run false \
            -d synthea_output
        
        # Import data
        if [ -f scripts/optimized_synthea_import.py ]; then
            python scripts/optimized_synthea_import.py \
                --input-dir synthea_output \
                --batch-size 100
        fi
        
        # Add reference ranges
        python scripts/add_reference_ranges.py || true
        
        # Assign patients
        python scripts/assign_patients_to_providers_auto.py || true
    fi
    
    echo "✅ Database initialization complete!"
fi

# Keep container running
echo "✅ MedGenEMR is ready at http://localhost"
tail -f /var/log/supervisor/*.log