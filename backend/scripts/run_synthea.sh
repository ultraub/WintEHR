#!/bin/bash
# Complete Synthea workflow: setup, generate, and import

set -e

echo "=== MedGenEMR Synthea Data Generation ==="
echo

# Change to script directory
cd "$(dirname "$0")"

# 1. Setup Synthea
echo "Step 1: Setting up Synthea..."
bash setup_synthea.sh

# 2. Generate patients
echo
echo "Step 2: Generating 5 Synthea patients..."
cd /app/synthea

# Clear previous output
rm -rf output/fhir/*

# Generate patients
java -jar build/libs/synthea-with-dependencies.jar \
    -p 5 \
    -s 12345 \
    --exporter.fhir.export=true \
    --exporter.fhir_stu3.export=false \
    --exporter.fhir_dstu2.export=false \
    --exporter.ccda.export=false \
    --exporter.csv.export=false \
    Massachusetts

# 3. Import into MedGenEMR
echo
echo "Step 3: Importing FHIR bundles into MedGenEMR..."
cd /app/scripts
python import_synthea.py

echo
echo "=== Complete! ==="
echo "5 Synthea patients have been generated and imported into MedGenEMR"