# WintEHR Patient Loading Guide

This guide documents the complete, verified process for loading synthetic patients into the WintEHR system. This process ensures all data is properly indexed and relationships are established for the Patient Summary and clinical workspace features to function correctly.

## Overview

The patient loading process involves:
1. Database table creation
2. Synthetic patient generation using Synthea
3. Data import into PostgreSQL
4. Search parameter indexing
5. Compartment population (critical for Patient summaries)
6. Reference population (critical for resource relationships)
7. Data validation via API

## Prerequisites

- Docker and Docker Compose installed
- WintEHR repository cloned
- Docker containers running (postgres, backend, frontend)

## Verified Step-by-Step Process

### 1. Start Docker Containers

```bash
# From the WintEHR directory
docker-compose -f docker-compose.dev.yml up -d
```

Wait for all containers to be healthy (postgres and backend should show as healthy).

### 2. Initialize Database Tables

The PostgreSQL init script should run automatically on first container startup. If the tables don't exist, run manually:

```bash
# Initialize the FHIR schema and tables
docker exec emr-postgres psql -U emr_user -d emr_db -f /docker-entrypoint-initdb.d/01-init-wintehr.sql
```

This creates:
- `fhir.resources` - Main FHIR resource storage
- `fhir.resource_history` - Version history
- `fhir.search_params` - Search parameter indexes
- `fhir.references` - Resource relationships
- `fhir.compartments` - Patient groupings
- `fhir.audit_logs` - Audit trail

### 3. Generate and Import Patients

Use the `synthea_master.py` script to handle the complete workflow:

```bash
# Generate and import 30 patients (adjust count as needed)
docker exec emr-backend-dev python /app/scripts/active/synthea_master.py full --count 30 --validation-mode light
```

This command:
- Sets up Synthea if not already configured
- Generates synthetic patient data
- Imports all resources into the database
- Wiped existing data before importing

**Note**: The first run takes 5-10 minutes as it downloads and builds Synthea. Subsequent runs are faster (~1-2 minutes).

### 4. Verify Import

Check that patients were loaded:

```bash
# Count patients
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient';"

# View resource counts by type
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT resource_type, COUNT(*) as count FROM fhir.resources GROUP BY resource_type ORDER BY count DESC LIMIT 10;"
```

Expected output for 30 patients:
- 31 Patient resources (Synthea generated 31 instead of exactly 30)
- ~14,519 Observation resources
- ~4,422 Procedure resources
- ~3,098 DiagnosticReport resources
- ~35,194 total resources

### 5. Index Search Parameters

Run the search parameter indexing using the Python script:

```bash
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
            if count % 100 == 0:
                await session.commit()
                print(f'Indexed {count} resources...')
        
        await session.commit()
        print(f'Successfully indexed {count} resources')
    
    await engine.dispose()

asyncio.run(index_all())
"
```

This will take 3-5 minutes and create search parameters for all resources.

### 6. Verify Search Parameters

Check that search parameters were created:

```bash
# Count search parameters by type
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT param_name, COUNT(*) FROM fhir.search_params GROUP BY param_name ORDER BY COUNT(*) DESC LIMIT 10;"
```

Expected output:
- _id: ~57,998 entries
- status: ~54,374 entries  
- category: ~34,388 entries
- subject: ~22,773 entries

### 7. Populate Compartments (Critical for Patient Summary)

The compartments table groups resources by patient, which is essential for the Patient Summary and clinical workspace to function:

```bash
# Add unique constraint if not exists
docker exec emr-postgres psql -U emr_user -d emr_db -c "ALTER TABLE fhir.compartments ADD CONSTRAINT unique_compartment_resource UNIQUE (compartment_type, compartment_id, resource_id);"

# Populate compartments
docker exec emr-backend-dev bash -c "cd /app && PYTHONPATH=/app python scripts/setup/populate_compartments.py"
```

This will:
- Process all 35,194 resources
- Create 34,462 compartment entries
- Link resources like Observations, Procedures, etc. to their respective patients

### 8. Populate References (Critical for Resource Relationships)

The references table tracks relationships between resources:

```bash
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
```

This will create ~59,498 references linking resources together.

### 9. Test the API

Verify the FHIR API can search for patients:

```bash
# Search for all patients
curl -s "http://localhost:8000/fhir/R4/Patient" | jq '.total'

# Get first patient name
curl -s "http://localhost:8000/fhir/R4/Patient" | jq '.entry[0].resource.name[0]'
```

You should see:
- Total: 31 patients
- A patient name with given and family names

### 10. Verify Patient/$everything Works

Test that the Patient summary data can be retrieved:

```bash
# Get a patient ID
PATIENT_ID=$(curl -s "http://localhost:8000/fhir/R4/Patient" | jq -r '.entry[0].resource.id')

# Test Patient/$everything
curl -s "http://localhost:8000/fhir/R4/Patient/$PATIENT_ID/\$everything" | jq '.total'
```

You should see a large number (e.g., 6422) indicating all resources for that patient are accessible.

## Complete Setup Script

A complete setup script `setup-patients.sh` is provided that automates the entire process:

```bash
# Basic usage - load 30 patients
./setup-patients.sh

# Specify number of patients
./setup-patients.sh --count 50

# Wipe existing data first
./setup-patients.sh --wipe --count 30

# Show help
./setup-patients.sh --help
```

The script performs all steps automatically:
1. Checks Docker containers are running
2. Waits for services to be ready
3. Generates and imports patient data
4. Indexes all search parameters
5. Populates compartments table
6. Populates references table
7. Verifies the setup and tests Patient/$everything

The script provides colored output and clear progress indicators for each step.

## Troubleshooting

### Database Connection Issues
If scripts fail to connect to the database, ensure:
- The postgres container is running and healthy
- The backend container has the correct DATABASE_URL environment variable
- You're using the container names (postgres) not localhost

### Search Indexing Issues
The older search indexing scripts (fast_search_indexing.py) expect different table schemas. Use the Python script provided above which works with the current schema.

### API Not Responding
- Check backend logs: `docker logs emr-backend-dev --tail 50`
- Ensure the backend container is healthy
- Wait a few seconds after indexing for the API to be ready

## Notes

- The system generates realistic synthetic patient data including medical history
- All data follows the FHIR R4 standard
- The search indexing enables fast queries on patient data
- Frontend UI is available at http://localhost:3000
- API documentation is at http://localhost:8000/docs