#!/bin/bash
# Setup Synthea for generating FHIR patient data

set -e

echo "Setting up Synthea patient generator..."

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "Installing Java..."
    apt-get update && apt-get install -y openjdk-17-jdk
fi

# Clone Synthea if not exists
if [ ! -d "/app/synthea" ]; then
    echo "Cloning Synthea repository..."
    cd /app
    git clone --depth 1 https://github.com/synthetichealth/synthea.git
    cd synthea
else
    echo "Synthea already exists, updating..."
    cd /app/synthea
    git pull
fi

# Build Synthea
echo "Building Synthea..."
./gradlew build -x test

# Configure Synthea for FHIR R4 output
cat > src/main/resources/synthea.properties << EOF
# FHIR Configuration
exporter.fhir.export = true
exporter.fhir_stu3.export = false
exporter.fhir_dstu2.export = false
exporter.ccda.export = false
exporter.csv.export = false

# Output directory
exporter.baseDirectory = ./output/

# Generate only 5 patients
generate.default_population = 5

# Set location to Massachusetts
generate.demographics.default_city = Boston
generate.demographics.default_state = MA
EOF

echo "Synthea setup complete!"