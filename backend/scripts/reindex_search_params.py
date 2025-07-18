#!/usr/bin/env python3
"""
Re-index Search Parameters

This script re-indexes existing resources to extract newly added search parameters.
It's necessary after adding new parameter extractions to storage.py.
"""

import asyncio
import logging
from datetime import datetime
import asyncpg
from typing import Dict, List, Set

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'reindex_search_params_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)

# Database connection settings
DB_CONFIG = {
    'host': 'postgres',
    'port': 5432,
    'database': 'emr_db',
    'user': 'emr_user',
    'password': 'emr_password'
}

# Resources to re-index and their new parameters
RESOURCES_TO_REINDEX = {
    'MedicationRequest': [
        'medication (reference)',
        'intent',
        'category',
        'priority',
        'encounter',
        'intended-dispenser',
        'intended-performer',
        'intended-performertype'
    ],
    'Observation': [
        'based-on',
        'derived-from',
        'has-member',
        'part-of',
        'specimen',
        'device',
        'focus',
        'method',
        'data-absent-reason'
    ],
    'Procedure': [
        'based-on',
        'part-of',
        'reason-code',
        'reason-reference',
        'date'
    ]
}

async def analyze_current_params(conn: asyncpg.Connection) -> Dict[str, Set[str]]:
    """Analyze currently indexed parameters for each resource type."""
    
    query = """
    SELECT DISTINCT 
        r.resource_type,
        sp.param_name
    FROM fhir.resources r
    LEFT JOIN fhir.search_params sp ON sp.resource_id = r.id
    WHERE r.resource_type IN ('MedicationRequest', 'Observation', 'Procedure')
    AND r.deleted = false
    AND sp.param_name IS NOT NULL
    ORDER BY r.resource_type, sp.param_name
    """
    
    results = await conn.fetch(query)
    
    current_params = {}
    for row in results:
        resource_type = row['resource_type']
        param_name = row['param_name']
        
        if resource_type not in current_params:
            current_params[resource_type] = set()
        current_params[resource_type].add(param_name)
    
    logging.info("\n=== Current Search Parameters ===")
    for resource_type, params in current_params.items():
        logging.info(f"\n{resource_type}:")
        for param in sorted(params):
            logging.info(f"  - {param}")
    
    return current_params

async def get_resources_to_reindex(conn: asyncpg.Connection, resource_type: str) -> List[Dict]:
    """Get all resources of a specific type that need re-indexing."""
    
    query = """
    SELECT id, fhir_id, resource
    FROM fhir.resources
    WHERE resource_type = $1
    AND deleted = false
    ORDER BY id
    """
    
    results = await conn.fetch(query, resource_type)
    return [dict(row) for row in results]

async def reindex_resource(resource_id: int, resource_data: dict) -> int:
    """Re-index a single resource by calling the backend API."""
    
    import aiohttp
    
    url = f"http://localhost:8000/internal/reindex/{resource_id}"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, json=resource_data) as response:
                if response.status == 200:
                    return 1
                else:
                    logging.error(f"Failed to reindex resource {resource_id}: {response.status}")
                    return 0
        except Exception as e:
            logging.error(f"Error reindexing resource {resource_id}: {e}")
            return 0

async def reindex_via_storage_engine(conn: asyncpg.Connection, resource_type: str):
    """Re-index resources by directly calling the storage engine."""
    
    logging.info(f"\n=== Re-indexing {resource_type} Resources ===")
    
    # Import the storage engine
    import sys
    sys.path.append('/app')
    
    from fhir.core.storage import FHIRStorageEngine
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker
    
    # Create async engine
    DATABASE_URL = f"postgresql+asyncpg://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    # Create session factory
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    # Get resources to reindex
    resources = await get_resources_to_reindex(conn, resource_type)
    logging.info(f"Found {len(resources)} {resource_type} resources to re-index")
    
    success_count = 0
    error_count = 0
    
    # Process in batches
    batch_size = 100
    for i in range(0, len(resources), batch_size):
        batch = resources[i:i + batch_size]
        logging.info(f"Processing batch {i//batch_size + 1}/{(len(resources) + batch_size - 1)//batch_size}")
        
        async with async_session() as session:
            storage = FHIRStorageEngine(session)
            
            for resource in batch:
                try:
                    # Delete existing search params
                    await conn.execute(
                        "DELETE FROM fhir.search_params WHERE resource_id = $1",
                        resource['id']
                    )
                    
                    # Re-extract search parameters
                    await storage._extract_and_store_search_params(
                        resource['id'],
                        resource_type,
                        resource['resource']
                    )
                    
                    success_count += 1
                    
                except Exception as e:
                    logging.error(f"Error re-indexing {resource_type}/{resource['fhir_id']}: {e}")
                    error_count += 1
            
            await session.commit()
    
    logging.info(f"Re-indexed {success_count} resources successfully, {error_count} errors")
    
    # Verify new parameters were extracted
    await verify_new_params(conn, resource_type)

async def verify_new_params(conn: asyncpg.Connection, resource_type: str):
    """Verify that new parameters were extracted."""
    
    logging.info(f"\n=== Verifying New Parameters for {resource_type} ===")
    
    # Check for specific new parameters
    new_params_to_check = {
        'MedicationRequest': ['medication', 'intent', 'category', 'intended-dispenser'],
        'Observation': ['based-on', 'specimen', 'device', 'method'],
        'Procedure': ['based-on', 'part-of', 'reason-code']
    }
    
    params_to_check = new_params_to_check.get(resource_type, [])
    
    for param_name in params_to_check:
        query = """
        SELECT COUNT(DISTINCT sp.resource_id) as count
        FROM fhir.search_params sp
        JOIN fhir.resources r ON r.id = sp.resource_id
        WHERE r.resource_type = $1
        AND sp.param_name = $2
        AND r.deleted = false
        """
        
        count = await conn.fetchval(query, resource_type, param_name)
        
        if count > 0:
            logging.info(f"✓ {param_name}: {count} resources indexed")
        else:
            logging.warning(f"✗ {param_name}: No resources indexed")
    
    # Check medication reference specifically
    if resource_type == 'MedicationRequest':
        query = """
        SELECT COUNT(*) as ref_count
        FROM fhir.search_params sp
        JOIN fhir.resources r ON r.id = sp.resource_id
        WHERE r.resource_type = 'MedicationRequest'
        AND sp.param_name = 'medication'
        AND sp.param_type = 'reference'
        AND sp.value_reference IS NOT NULL
        """
        
        ref_count = await conn.fetchval(query)
        logging.info(f"\nMedication references indexed: {ref_count}")

async def main():
    """Main function to coordinate re-indexing."""
    
    logging.info("Starting Search Parameter Re-indexing")
    logging.info(f"Database: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(**DB_CONFIG)
        
        # Analyze current state
        current_params = await analyze_current_params(conn)
        
        # Re-index each resource type
        for resource_type in RESOURCES_TO_REINDEX.keys():
            await reindex_via_storage_engine(conn, resource_type)
        
        # Final analysis
        logging.info("\n=== Final Parameter Analysis ===")
        final_params = await analyze_current_params(conn)
        
        # Show newly added parameters
        logging.info("\n=== Newly Added Parameters ===")
        for resource_type in RESOURCES_TO_REINDEX.keys():
            old_params = current_params.get(resource_type, set())
            new_params = final_params.get(resource_type, set())
            added_params = new_params - old_params
            
            if added_params:
                logging.info(f"\n{resource_type} - Added {len(added_params)} new parameters:")
                for param in sorted(added_params):
                    logging.info(f"  + {param}")
            else:
                logging.info(f"\n{resource_type} - No new parameters added")
        
        # Close connection
        await conn.close()
        
        logging.info("\n=== Re-indexing Completed Successfully ===")
        
    except Exception as e:
        logging.error(f"Error during re-indexing: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())