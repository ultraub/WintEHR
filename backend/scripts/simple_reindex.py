#!/usr/bin/env python3
"""
Simple Re-index Script

This script re-indexes resources by updating them through the FHIR API,
which triggers the search parameter extraction.
"""

import asyncio
import logging
import asyncpg
import aiohttp
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Database connection settings
DB_CONFIG = {
    'host': 'postgres',
    'port': 5432,
    'database': 'emr_db',
    'user': 'emr_user',
    'password': 'emr_password'
}

# API endpoint
API_BASE = 'http://localhost:8000/fhir/R4'

async def get_resources_to_reindex(conn: asyncpg.Connection, resource_type: str):
    """Get all resources of a specific type."""
    
    query = """
    SELECT fhir_id, resource
    FROM fhir.resources
    WHERE resource_type = $1
    AND deleted = false
    ORDER BY id
    LIMIT 10  -- Start with just 10 for testing
    """
    
    results = await conn.fetch(query, resource_type)
    return results

async def reindex_resource(session: aiohttp.ClientSession, resource_type: str, resource_id: str, resource_data: dict):
    """Re-index a resource by updating it."""
    
    # Add a small modification to trigger update
    if 'meta' not in resource_data:
        resource_data['meta'] = {}
    
    # Update lastUpdated to trigger re-indexing
    resource_data['meta']['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
    
    url = f"{API_BASE}/{resource_type}/{resource_id}"
    
    try:
        async with session.put(url, json=resource_data) as response:
            if response.status in [200, 201]:
                return True
            else:
                text = await response.text()
                logging.error(f"Failed to update {resource_type}/{resource_id}: {response.status} - {text}")
                return False
    except Exception as e:
        logging.error(f"Error updating {resource_type}/{resource_id}: {e}")
        return False

async def verify_search_params(conn: asyncpg.Connection):
    """Verify search parameters were indexed."""
    
    logging.info("\n=== Verifying Search Parameters ===")
    
    # Check medication references
    query = """
    SELECT 
        r.resource_type,
        sp.param_name,
        sp.param_type,
        COUNT(*) as count
    FROM fhir.search_params sp
    JOIN fhir.resources r ON r.id = sp.resource_id
    WHERE r.resource_type IN ('MedicationRequest', 'Observation', 'Procedure')
    AND sp.param_name IN ('medication', 'intent', 'category', 'based-on', 'specimen', 'part-of')
    GROUP BY r.resource_type, sp.param_name, sp.param_type
    ORDER BY r.resource_type, sp.param_name
    """
    
    results = await conn.fetch(query)
    
    for row in results:
        logging.info(f"{row['resource_type']}.{row['param_name']} ({row['param_type']}): {row['count']} indexed")
    
    # Check medication references specifically
    ref_query = """
    SELECT COUNT(*) as count
    FROM fhir.search_params sp
    JOIN fhir.resources r ON r.id = sp.resource_id
    WHERE r.resource_type = 'MedicationRequest'
    AND sp.param_name = 'medication'
    AND sp.param_type = 'reference'
    AND sp.value_reference IS NOT NULL
    """
    
    ref_count = await conn.fetchval(ref_query)
    logging.info(f"\nMedicationRequest medication references: {ref_count}")

async def main():
    """Main function."""
    
    logging.info("Starting Simple Re-indexing")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(**DB_CONFIG)
        
        # Create HTTP session
        async with aiohttp.ClientSession() as session:
            
            # Re-index MedicationRequests
            logging.info("\n=== Re-indexing MedicationRequests ===")
            resources = await get_resources_to_reindex(conn, 'MedicationRequest')
            
            success = 0
            for row in resources:
                resource_id = row['fhir_id']
                resource_data = row['resource']
                
                if await reindex_resource(session, 'MedicationRequest', resource_id, resource_data):
                    success += 1
                    logging.info(f"✓ Updated MedicationRequest/{resource_id}")
                else:
                    logging.error(f"✗ Failed MedicationRequest/{resource_id}")
            
            logging.info(f"Successfully re-indexed {success}/{len(resources)} MedicationRequests")
        
        # Wait a moment for indexing to complete
        await asyncio.sleep(2)
        
        # Verify results
        await verify_search_params(conn)
        
        # Close connection
        await conn.close()
        
        logging.info("\n=== Re-indexing Complete ===")
        
    except Exception as e:
        logging.error(f"Error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())