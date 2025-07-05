# Environment Variables for Synthea Master Script

## Docker/Container Environment

```bash
# Enable Synthea data generation in containers
GENERATE_SYNTHEA=true

# Number of patients to generate (default: 10)
SYNTHEA_PATIENT_COUNT=20

# Validation mode (none, transform_only, light, strict)
SYNTHEA_VALIDATION_MODE=light

# Include DICOM file generation
SYNTHEA_INCLUDE_DICOM=true

# State for patient generation
SYNTHEA_STATE=California

# City for patient generation  
SYNTHEA_CITY=Los Angeles
```

## Development Environment

```bash
# Generate fresh data on startup
FRESH_SYNTHEA_DATA=true

# Include DICOM generation
INCLUDE_DICOM=true

# Patient count for development
SYNTHEA_PATIENT_COUNT=5
```

## Usage in Scripts

```bash
# Use environment variables with defaults
PATIENT_COUNT=${SYNTHEA_PATIENT_COUNT:-10}
VALIDATION_MODE=${SYNTHEA_VALIDATION_MODE:-transform_only}
STATE=${SYNTHEA_STATE:-Massachusetts}

python scripts/synthea_master.py full \
    --count $PATIENT_COUNT \
    --validation-mode $VALIDATION_MODE \
    --state "$STATE" \
    ${SYNTHEA_CITY:+--city "$SYNTHEA_CITY"} \
    ${SYNTHEA_INCLUDE_DICOM:+--include-dicom}
```
