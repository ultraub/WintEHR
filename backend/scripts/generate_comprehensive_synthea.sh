#!/bin/bash
# Generate comprehensive Synthea data with rich clinical content

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
SYNTHEA_DIR="$BACKEND_DIR/synthea"
OUTPUT_DIR="$SYNTHEA_DIR/output/fhir"

echo "🏥 Generating Comprehensive Synthea Data for MedGenEMR"
echo "=================================================="

# Check if Synthea is built
if [ ! -f "$SYNTHEA_DIR/build/libs/synthea-with-dependencies.jar" ]; then
    echo "❌ Synthea not built. Building now..."
    cd "$SYNTHEA_DIR"
    ./gradlew build -x test
fi

# Clean output directory
echo "🧹 Cleaning output directory..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

cd "$SYNTHEA_DIR"

# Generate patients with various chronic conditions and comprehensive data
echo ""
echo "📊 Generating patients with comprehensive clinical data..."
echo ""

# Configuration options for comprehensive data
COMMON_OPTS=(
    # Export only FHIR R4
    "--exporter.fhir.export=true"
    "--exporter.fhir_stu3.export=false"
    "--exporter.fhir_dstu2.export=false"
    "--exporter.ccda.export=false"
    "--exporter.csv.export=false"
    "--exporter.json.export=false"
    
    # Use US Core IG for better data
    "--exporter.fhir.use_us_core_ig=true"
    "--exporter.fhir.us_core_version=5.0.1"
    
    # More years of history
    "--exporter.years_of_history=20"
    
    # Hospital and practitioner data
    "--exporter.hospital.fhir.export=true"
    "--exporter.practitioner.fhir.export=true"
    
    # Generate more detailed data
    "--generate.append_numbers_to_person_names=false"
    "--generate.middle_names=0.8"
    
    # More wellness encounters for vitals
    "--generate.wellness_encounters.min_time_between_wellness_encounters=180"
    "--generate.wellness_encounters.max_time_between_wellness_encounters=365"
    
    # Enable detailed transition tracking for debugging
    "--generate.track_detailed_transition_metrics=false"
)

# Function to generate patients with specific seeds for reproducibility
generate_batch() {
    local seed=$1
    local count=$2
    local age_range=$3
    local description=$4
    
    echo "🔄 Generating $count patients: $description (seed: $seed)"
    
    java -jar build/libs/synthea-with-dependencies.jar \
        -s "$seed" \
        -p "$count" \
        -a "$age_range" \
        "${COMMON_OPTS[@]}" \
        Massachusetts Boston
}

# Generate diverse patient populations
# Young adults (more likely to have asthma, allergies, mental health)
generate_batch 1001 3 "18-35" "Young adults"

# Middle-aged (diabetes, hypertension risk)
generate_batch 2001 4 "35-55" "Middle-aged adults"

# Older adults (multiple chronic conditions)
generate_batch 3001 3 "55-80" "Older adults with chronic conditions"

# Generate some patients with specific modules
echo ""
echo "🎯 Generating patients with specific conditions..."

# Diabetes patients
echo "  - Diabetes patients..."
java -jar build/libs/synthea-with-dependencies.jar \
    -s 4001 \
    -p 2 \
    -a "40-70" \
    -m diabetes \
    "${COMMON_OPTS[@]}" \
    Massachusetts Boston

# Hypertension patients
echo "  - Hypertension patients..."
java -jar build/libs/synthea-with-dependencies.jar \
    -s 5001 \
    -p 2 \
    -a "45-75" \
    -m hypertension \
    "${COMMON_OPTS[@]}" \
    Massachusetts Boston

# Asthma patients
echo "  - Asthma patients..."
java -jar build/libs/synthea-with-dependencies.jar \
    -s 6001 \
    -p 2 \
    -a "20-50" \
    -m asthma \
    "${COMMON_OPTS[@]}" \
    Massachusetts Boston

# Heart disease patients
echo "  - Heart disease patients..."
java -jar build/libs/synthea-with-dependencies.jar \
    -s 7001 \
    -p 2 \
    -a "50-80" \
    -m heart \
    "${COMMON_OPTS[@]}" \
    Massachusetts Boston

# Mental health patients
echo "  - Mental health patients..."
java -jar build/libs/synthea-with-dependencies.jar \
    -s 8001 \
    -p 2 \
    -a "25-55" \
    -m anxiety \
    "${COMMON_OPTS[@]}" \
    Massachusetts Boston

echo ""
echo "✅ Data generation complete!"
echo ""
echo "📊 Summary:"
echo "  - Output directory: $OUTPUT_DIR"
echo "  - Total patients generated: ~20"
echo "  - Conditions covered: Diabetes, Hypertension, Asthma, Heart Disease, Mental Health"
echo ""
echo "Next steps:"
echo "1. Import data: python scripts/synthea_master.py import"
echo "2. Initialize database: python scripts/init_database.py"
echo ""