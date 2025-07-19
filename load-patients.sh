#!/bin/bash
#
# Load Patients Script for WintEHR
# Simple script to generate and load patient data
#
# Usage:
#   ./load-patients.sh              # Load 20 patients (default)
#   ./load-patients.sh 50           # Load 50 patients
#   ./load-patients.sh --wipe 10    # Wipe existing data and load 10 patients
#

set -e

# Configuration
PATIENT_COUNT=${1:-20}
WIPE_EXISTING=false

# Colors for output
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Parse arguments
if [ "$1" = "--wipe" ]; then
    WIPE_EXISTING=true
    PATIENT_COUNT=${2:-20}
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Load Patients Script"
    echo ""
    echo "Usage: $0 [count|--wipe count]"
    echo ""
    echo "Examples:"
    echo "  $0              # Load 20 patients (default)"
    echo "  $0 50           # Load 50 patients"
    echo "  $0 --wipe 10    # Wipe existing data and load 10 patients"
    exit 0
fi

echo -e "${BLUE}🏥 WintEHR Patient Data Loader${NC}"
echo "=================================="

# Check if backend is running
if ! docker ps | grep -q emr-backend; then
    echo -e "${YELLOW}Backend container is not running. Starting services...${NC}"
    ./dev-start.sh
    sleep 5
fi

# Execute synthea_master.py
if [ "$WIPE_EXISTING" = "true" ]; then
    echo -e "${YELLOW}⚠️  Wiping existing data...${NC}"
    docker exec emr-backend python scripts/active/synthea_master.py wipe
fi

echo -e "${BLUE}Generating $PATIENT_COUNT patients...${NC}"
docker exec emr-backend python scripts/active/synthea_master.py full \
    --count "$PATIENT_COUNT" \
    --validation-mode light \
    --include-dicom

echo -e "${GREEN}✅ Successfully loaded $PATIENT_COUNT patients!${NC}"

# Apply database index optimizations if not already done
echo -e "${BLUE}Ensuring database indexes are optimized...${NC}"
if docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT 1 FROM pg_indexes WHERE indexname = 'idx_search_params_patient_composite'" | grep -q "1 row"; then
    echo -e "${GREEN}✅ Performance indexes already applied${NC}"
else
    echo -e "${BLUE}Applying performance index optimizations...${NC}"
    docker exec -i emr-postgres psql -U emr_user -d emr_db < backend/scripts/optimize_indexes.sql 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Some indexes already exist or had warnings, but continuing...${NC}"
    }
    echo -e "${GREEN}✅ Database indexes optimized${NC}"
fi

# Populate FHIR references
echo -e "${BLUE}Populating FHIR references for relationship visualization...${NC}"
if docker exec emr-backend test -f /app/scripts/populate_references_urn_uuid.py; then
    docker exec emr-backend python scripts/populate_references_urn_uuid.py || {
        echo -e "${YELLOW}⚠️  Reference population failed - relationship viewer may not work${NC}"
    }
else
    echo -e "${YELLOW}⚠️  Reference population script not found${NC}"
fi

# Show patient count
echo -e "${BLUE}Verifying data...${NC}"
docker exec emr-backend python -c "
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def show_counts():
    engine = create_async_engine('postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    async with engine.connect() as conn:
        # Count various resource types
        counts = {}
        for resource_type in ['Patient', 'Encounter', 'Condition', 'MedicationRequest', 'Observation', 'Procedure']:
            result = await conn.execute(text(f'SELECT COUNT(*) FROM fhir.resources WHERE resource_type = :type'), {'type': resource_type})
            counts[resource_type] = result.scalar()
        
        # Count references
        result = await conn.execute(text('SELECT COUNT(*) FROM fhir.references'))
        ref_count = result.scalar()
        
        # Count search params
        result = await conn.execute(text('SELECT COUNT(*) FROM fhir.search_params'))
        search_count = result.scalar()
    await engine.dispose()
    
    print('\\nResource Counts:')
    print('-' * 30)
    for rtype, count in counts.items():
        print(f'{rtype:<20} {count:>8}')
    print('-' * 30)
    print(f'Total References:    {ref_count:>8}')
    print(f'Search Parameters:   {search_count:>8}')
    print('-' * 30)

asyncio.run(show_counts())
"

echo -e "${GREEN}✅ Data load complete!${NC}"