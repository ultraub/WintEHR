#!/usr/bin/env python3
"""
Fix Reference Parameter Storage

This script fixes reference parameters that are incorrectly stored in value_string
instead of value_reference in the search_params table.

The issue affects many reference parameters across multiple resource types.
"""

import asyncio
import logging
from datetime import datetime
import asyncpg
from typing import Dict, List, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'fix_reference_params_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)

# Database connection settings
DB_CONFIG = {
    'host': 'postgres',  # Container name in docker-compose
    'port': 5432,
    'database': 'emr_db',
    'user': 'emr_user',
    'password': 'emr_password'
}

async def analyze_reference_params(conn: asyncpg.Connection) -> Dict[str, int]:
    """Analyze reference parameters stored in value_string."""
    
    query = """
    SELECT 
        resource_type,
        param_name,
        COUNT(*) as count
    FROM fhir.search_params
    WHERE param_type = 'reference'
    AND value_string IS NOT NULL
    AND value_reference IS NULL
    GROUP BY resource_type, param_name
    ORDER BY count DESC
    """
    
    results = await conn.fetch(query)
    
    logging.info("\n=== Reference Parameters Stored in value_string ===")
    total = 0
    param_stats = {}
    
    for row in results:
        resource_type = row['resource_type']
        param_name = row['param_name']
        count = row['count']
        total += count
        
        logging.info(f"{resource_type}.{param_name}: {count} records")
        param_stats[f"{resource_type}.{param_name}"] = count
    
    logging.info(f"\nTotal affected records: {total}")
    return param_stats

async def fix_reference_params(conn: asyncpg.Connection) -> int:
    """Move reference values from value_string to value_reference."""
    
    logging.info("\n=== Fixing Reference Parameters ===")
    
    # First, let's see what we're dealing with
    check_query = """
    SELECT COUNT(*) as count
    FROM fhir.search_params
    WHERE param_type = 'reference'
    AND value_string IS NOT NULL
    AND value_reference IS NULL
    """
    
    result = await conn.fetchval(check_query)
    logging.info(f"Found {result} reference parameters to fix")
    
    if result == 0:
        logging.info("No reference parameters need fixing!")
        return 0
    
    # Perform the update
    update_query = """
    UPDATE fhir.search_params
    SET 
        value_reference = value_string,
        value_string = NULL
    WHERE param_type = 'reference'
    AND value_string IS NOT NULL
    AND value_reference IS NULL
    """
    
    try:
        start_time = datetime.now()
        result = await conn.execute(update_query)
        end_time = datetime.now()
        
        # Extract number of rows updated
        rows_updated = int(result.split()[-1])
        
        logging.info(f"Successfully moved {rows_updated} reference values from value_string to value_reference")
        logging.info(f"Update completed in {(end_time - start_time).total_seconds():.2f} seconds")
        
        return rows_updated
        
    except Exception as e:
        logging.error(f"Error updating reference parameters: {e}")
        raise

async def verify_fix(conn: asyncpg.Connection):
    """Verify the fix was successful."""
    
    logging.info("\n=== Verifying Fix ===")
    
    # Check if any reference params still in value_string
    check_query = """
    SELECT COUNT(*) as count
    FROM fhir.search_params
    WHERE param_type = 'reference'
    AND value_string IS NOT NULL
    """
    
    remaining = await conn.fetchval(check_query)
    
    if remaining > 0:
        logging.warning(f"WARNING: {remaining} reference parameters still have value_string set")
        
        # Get details
        detail_query = """
        SELECT resource_type, param_name, COUNT(*) as count
        FROM fhir.search_params
        WHERE param_type = 'reference'
        AND value_string IS NOT NULL
        GROUP BY resource_type, param_name
        LIMIT 10
        """
        
        details = await conn.fetch(detail_query)
        for row in details:
            logging.warning(f"  - {row['resource_type']}.{row['param_name']}: {row['count']} records")
    else:
        logging.info("✓ All reference parameters successfully moved to value_reference column")
    
    # Check reference params in correct column
    correct_query = """
    SELECT COUNT(*) as count
    FROM fhir.search_params
    WHERE param_type = 'reference'
    AND value_reference IS NOT NULL
    """
    
    correct_count = await conn.fetchval(correct_query)
    logging.info(f"✓ {correct_count} reference parameters correctly stored in value_reference column")

async def test_searches(conn: asyncpg.Connection):
    """Test some common reference searches to ensure they work."""
    
    logging.info("\n=== Testing Reference Searches ===")
    
    test_queries = [
        ("MedicationRequest by patient", """
            SELECT COUNT(DISTINCT r.id) as count
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'MedicationRequest'
            AND sp.param_name = 'patient'
            AND sp.param_type = 'reference'
            AND sp.value_reference IS NOT NULL
        """),
        
        ("Encounter by patient", """
            SELECT COUNT(DISTINCT r.id) as count
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Encounter'
            AND sp.param_name = 'patient'
            AND sp.param_type = 'reference'
            AND sp.value_reference IS NOT NULL
        """),
        
        ("Coverage by beneficiary", """
            SELECT COUNT(DISTINCT r.id) as count
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'Coverage'
            AND sp.param_name = 'beneficiary'
            AND sp.param_type = 'reference'
            AND sp.value_reference IS NOT NULL
        """)
    ]
    
    for test_name, query in test_queries:
        try:
            count = await conn.fetchval(query)
            logging.info(f"✓ {test_name}: {count} resources found")
        except Exception as e:
            logging.error(f"✗ {test_name}: {e}")

async def main():
    """Main function to coordinate the fix."""
    
    logging.info("Starting Reference Parameter Storage Fix")
    logging.info(f"Database: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(**DB_CONFIG)
        
        # Analyze current state
        await analyze_reference_params(conn)
        
        # Fix the issue
        rows_fixed = await fix_reference_params(conn)
        
        if rows_fixed > 0:
            # Verify the fix
            await verify_fix(conn)
            
            # Test searches
            await test_searches(conn)
        
        # Close connection
        await conn.close()
        
        logging.info("\n=== Fix Completed Successfully ===")
        
    except Exception as e:
        logging.error(f"Error during fix process: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())