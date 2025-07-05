#!/bin/bash
# Run Synthea to generate 5 patients - LOCAL DEVELOPMENT VERSION

set -e

echo "🧬 Generating 5 Synthea patients..."

SYNTHEA_DIR="../synthea"

if [ ! -d "$SYNTHEA_DIR" ]; then
    echo "Synthea not found. Please run ./setup_synthea_local.sh first"
    exit 1
fi

cd "$SYNTHEA_DIR"

# Clear previous output
rm -rf output/fhir/*

# Generate 5 patients
echo "Generating patients..."
java -jar build/libs/synthea-with-dependencies.jar -p 5

echo "✅ Generated 5 patients successfully!"
echo "📁 FHIR files location: $(pwd)/output/fhir/"

# List generated files
echo "📋 Generated files:"
ls -la output/fhir/*.json | head -10

echo ""
echo "🔄 Next step: Run the import script to load data into database"