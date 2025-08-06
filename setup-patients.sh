#!/bin/bash

# WintEHR Patient Setup Script
# Automates the complete patient loading process including data generation,
# import, indexing, and relationship population.

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
PATIENT_COUNT=30
WIPE_FIRST=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --count|-c)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --wipe|-w)
            WIPE_FIRST=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --count, -c <number>  Number of patients to generate (default: 30)"
            echo "  --wipe, -w           Wipe existing data before loading"
            echo "  --help, -h           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🏥 WintEHR Patient Setup Script${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Patient count: ${GREEN}$PATIENT_COUNT${NC}"
echo -e "Wipe existing data: ${GREEN}$WIPE_FIRST${NC}"
echo ""

# Function to check if Docker containers are running
check_containers() {
    echo -e "${YELLOW}🔍 Checking Docker containers...${NC}"
    
    if ! docker ps | grep -q "emr-postgres"; then
        echo -e "${RED}❌ PostgreSQL container not running${NC}"
        echo "Please run: docker-compose -f docker-compose.dev.yml up -d"
        exit 1
    fi
    
    if ! docker ps | grep -q "emr-backend-dev"; then
        echo -e "${RED}❌ Backend container not running${NC}"
        echo "Please run: docker-compose -f docker-compose.dev.yml up -d"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All containers are running${NC}"
}

# Function to wait for services to be ready
wait_for_services() {
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    
    # Wait for PostgreSQL
    until docker exec emr-postgres pg_isready -U emr_user -d emr_db > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo ""
    
    # Wait for API
    until curl -s http://localhost:8000/fhir/R4/metadata > /dev/null 2>&1; do
        echo -n "."
        sleep 1
    done
    echo ""
    
    echo -e "${GREEN}✅ All services are ready${NC}"
}

# Function to generate and import patients
generate_and_import_patients() {
    echo -e "${YELLOW}🧬 Generating and importing $PATIENT_COUNT patients...${NC}"
    
    if [ "$WIPE_FIRST" = true ]; then
        echo -e "${YELLOW}🗑️  Wiping existing data first...${NC}"
        docker exec emr-backend-dev python /app/scripts/active/synthea_master.py wipe
    fi
    
    # Run the full synthea workflow
    docker exec emr-backend-dev python /app/scripts/active/synthea_master.py full \
        --count $PATIENT_COUNT \
        --validation-mode light
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Patient data generated and imported successfully${NC}"
    else
        echo -e "${RED}❌ Failed to generate/import patient data${NC}"
        exit 1
    fi
}

# Function to index search parameters
index_search_parameters() {
    echo -e "${YELLOW}🔍 Indexing search parameters...${NC}"
    
    docker exec emr-backend-dev python -c "
import asyncio
import sys
sys.path.append('/app')
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os

async def index_all():
    db_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        from api.services.fhir.search_indexer import SearchParameterIndexer
        indexer = SearchParameterIndexer(session)
        
        result = await session.execute(text('SELECT id, resource_type, resource FROM fhir.resources ORDER BY id'))
        resources = result.fetchall()
        
        print(f'Found {len(resources)} resources to index')
        
        count = 0
        for row in resources:
            resource_id, resource_type, resource_data = row
            await indexer.index_resource(resource_id, resource_type, resource_data)
            count += 1
            if count % 1000 == 0:
                await session.commit()
                print(f'Indexed {count} resources...')
        
        await session.commit()
        print(f'Successfully indexed {count} resources')
    
    await engine.dispose()

asyncio.run(index_all())
"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Search parameters indexed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to index search parameters${NC}"
        exit 1
    fi
}

# Function to populate compartments
populate_compartments() {
    echo -e "${YELLOW}🗂️  Populating compartments...${NC}"
    
    # Add unique constraint if not exists (ignore error if already exists)
    docker exec emr-postgres psql -U emr_user -d emr_db -c \
        "ALTER TABLE fhir.compartments ADD CONSTRAINT unique_compartment_resource UNIQUE (compartment_type, compartment_id, resource_id);" 2>/dev/null || true
    
    # Populate compartments
    docker exec emr-backend-dev bash -c "cd /app && PYTHONPATH=/app python scripts/setup/populate_compartments.py"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Compartments populated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to populate compartments${NC}"
        exit 1
    fi
}

# Function to populate references
populate_references() {
    echo -e "${YELLOW}🔗 Populating references...${NC}"
    
    docker exec emr-backend-dev python -c "
import asyncio
import sys
sys.path.append('/app')
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
import json

async def populate_references():
    db_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    engine = create_async_engine(db_url, echo=False)
    
    async with engine.connect() as conn:
        # Clear existing references
        await conn.execute(text('TRUNCATE TABLE fhir.references'))
        
        # Build UUID to resource mapping
        result = await conn.execute(text('SELECT id, resource_type, resource FROM fhir.resources'))
        resources = result.fetchall()
        
        uuid_map = {}
        for rid, rtype, rdata in resources:
            if isinstance(rdata, str):
                resource = json.loads(rdata)
            else:
                resource = rdata
            if 'id' in resource:
                uuid_map[f'urn:uuid:{resource[\"id\"]}'] = (rid, rtype, resource['id'])
        
        print(f'Built UUID map with {len(uuid_map)} entries')
        
        # Process references
        ref_count = 0
        for resource_id, resource_type, resource_data in resources:
            if isinstance(resource_data, str):
                resource = json.loads(resource_data)
            else:
                resource = resource_data
            
            # Extract references based on resource type
            references = []
            
            # Common reference fields
            for field in ['subject', 'patient', 'encounter']:
                if field in resource and isinstance(resource[field], dict) and 'reference' in resource[field]:
                    ref = resource[field]['reference']
                    if ref in uuid_map:
                        target_id, target_type, uuid = uuid_map[ref]
                        references.append((field, target_type, uuid, ref))
            
            # Insert references
            for path, target_type, target_id, target_url in references:
                await conn.execute(text(
                    'INSERT INTO fhir.references (source_resource_id, source_path, target_resource_type, target_resource_id, target_url) '
                    'VALUES (:source_id, :path, :target_type, :target_id, :url)'
                ), {
                    'source_id': resource_id,
                    'path': path,
                    'target_type': target_type,
                    'target_id': target_id,
                    'url': target_url
                })
                ref_count += 1
                
            if ref_count % 1000 == 0:
                print(f'Created {ref_count} references...')
        
        await conn.commit()
        print(f'Total references created: {ref_count}')
    
    await engine.dispose()

asyncio.run(populate_references())
"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ References populated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to populate references${NC}"
        exit 1
    fi
}

# Function to verify setup
verify_setup() {
    echo -e "${YELLOW}🔍 Verifying setup...${NC}"
    
    # Get patient count
    ACTUAL_PATIENTS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient';")
    
    # Get total resource count
    TOTAL_RESOURCES=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.resources;")
    
    # Get search parameter count
    SEARCH_PARAMS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.search_params;")
    
    # Get compartment count
    COMPARTMENTS=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.compartments;")
    
    # Get reference count
    REFERENCES=$(docker exec emr-postgres psql -U emr_user -d emr_db -t -c \
        "SELECT COUNT(*) FROM fhir.references;")
    
    # Test API
    API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/fhir/R4/Patient)
    
    echo -e "${BLUE}📊 Setup Summary:${NC}"
    echo -e "  Patients loaded: ${GREEN}$ACTUAL_PATIENTS${NC}"
    echo -e "  Total resources: ${GREEN}$TOTAL_RESOURCES${NC}"
    echo -e "  Search parameters: ${GREEN}$SEARCH_PARAMS${NC}"
    echo -e "  Compartments: ${GREEN}$COMPARTMENTS${NC}"
    echo -e "  References: ${GREEN}$REFERENCES${NC}"
    echo -e "  API status: ${GREEN}$API_RESPONSE${NC}"
    
    # Test Patient/$everything
    echo -e "${YELLOW}🧪 Testing Patient/\$everything...${NC}"
    PATIENT_ID=$(curl -s "http://localhost:8000/fhir/R4/Patient" | jq -r '.entry[0].resource.id' 2>/dev/null || echo "")
    
    if [ -n "$PATIENT_ID" ]; then
        EVERYTHING_COUNT=$(curl -s "http://localhost:8000/fhir/R4/Patient/$PATIENT_ID/\$everything" | jq -r '.total' 2>/dev/null || echo "0")
        echo -e "  Patient \$everything resources: ${GREEN}$EVERYTHING_COUNT${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Could not test Patient/\$everything (no patient ID found)${NC}"
    fi
}

# Main execution
main() {
    echo -e "${YELLOW}🚀 Starting patient setup process...${NC}"
    echo ""
    
    # Step 1: Check containers
    check_containers
    
    # Step 2: Wait for services
    wait_for_services
    
    # Step 3: Generate and import patients
    generate_and_import_patients
    
    # Step 4: Index search parameters
    index_search_parameters
    
    # Step 5: Populate compartments
    populate_compartments
    
    # Step 6: Populate references
    populate_references
    
    # Step 7: Verify setup
    verify_setup
    
    echo ""
    echo -e "${GREEN}✨ Patient setup completed successfully!${NC}"
    echo -e "${BLUE}🌐 Frontend available at: http://localhost:3000${NC}"
    echo -e "${BLUE}📚 API documentation at: http://localhost:8000/docs${NC}"
}

# Run main function
main