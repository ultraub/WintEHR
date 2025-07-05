#!/bin/bash
# Setup Synthea for generating FHIR patient data - LOCAL DEVELOPMENT VERSION

set -e

echo "Setting up Synthea patient generator for local development..."

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "Java not found. Please install Java first."
    exit 1
fi

# Use local synthea directory
SYNTHEA_DIR="../synthea"

# Create synthea directory if not exists
mkdir -p "$SYNTHEA_DIR"

# Clone Synthea if not exists
if [ ! -d "$SYNTHEA_DIR/.git" ]; then
    echo "Cloning Synthea repository..."
    cd ..
    if [ -d "synthea" ]; then
        rm -rf synthea
    fi
    git clone --depth 1 https://github.com/synthetichealth/synthea.git
    cd synthea
else
    echo "Synthea already exists, updating..."
    cd "$SYNTHEA_DIR"
    git pull || echo "Could not update, using existing version"
fi

# Check if already built
if [ ! -f "build/libs/synthea-with-dependencies.jar" ]; then
    echo "Building Synthea..."
    ./gradlew build -x test
else
    echo "Synthea already built, skipping build step"
fi

# Configure Synthea for FHIR R4 output with 5 patients
echo "Configuring Synthea for FHIR R4 with 5 patients..."
mkdir -p src/main/resources
cat > src/main/resources/synthea.properties << 'EOF'
# FHIR Configuration
exporter.fhir.export = true
exporter.fhir_stu3.export = false
exporter.fhir_dstu2.export = false
exporter.ccda.export = false
exporter.csv.export = false
exporter.text.export = false
exporter.hospital.fhir.export = false
exporter.practitioner.fhir.export = false

# Output directory
exporter.baseDirectory = ./output/

# Generate configuration for 5 patients
generate.log_patients.detail = simple
generate.only_alive_patients = true
generate.default_population = 5

# Set location to Massachusetts
generate.demographics.default_city = Boston
generate.demographics.default_state = Massachusetts
EOF

echo "Synthea setup complete!"
echo "Next: Run ./run_synthea_local.sh to generate 5 patients"