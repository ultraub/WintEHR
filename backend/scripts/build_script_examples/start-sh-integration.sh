#!/bin/bash
# Example integration for start.sh

# Add this section before starting the backend

# Optional: Generate fresh Synthea data if requested
if [[ "$FRESH_SYNTHEA_DATA" == "true" ]]; then
    echo -e "${BLUE}🧬 Generating fresh Synthea data...${NC}"
    cd backend
    
    # Generate with environment variables or defaults
    PATIENT_COUNT=${SYNTHEA_PATIENT_COUNT:-10}
    VALIDATION_MODE=${SYNTHEA_VALIDATION_MODE:-transform_only}
    
    python scripts/synthea_master.py full \
        --count $PATIENT_COUNT \
        --validation-mode $VALIDATION_MODE \
        ${INCLUDE_DICOM:+--include-dicom}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Synthea data generated successfully${NC}"
    else
        echo -e "${RED}❌ Synthea data generation failed${NC}"
        exit 1
    fi
    
    cd ..
fi
