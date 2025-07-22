#!/usr/bin/env python3
"""
Clean up invalid observation test data.

This script removes observations that have no clinical value:
- Observations with code.text = "Invalid observation" 
- Observations without subject references

Usage:
    python scripts/cleanup_invalid_observations.py [--dry-run]
"""

import asyncio
import asyncpg
import logging
import argparse
from typing import List, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def find_invalid_observations(conn) -> List[Dict]:
    """Find observations that should be cleaned up."""
    logger.info("🔍 Searching for invalid observations...")
    
    # Query for observations with "Invalid observation" text or missing subject
    query = """
        SELECT 
            r.id,
            r.fhir_id,
            r.resource->'code'->>'text' as code_text,
            r.resource->'subject' as subject,
            r.last_updated
        FROM fhir.resources r
        WHERE r.resource_type = 'Observation'
        AND r.deleted = false
        AND (
            -- Invalid observation text
            r.resource->'code'->>'text' = 'Invalid observation'
            OR 
            -- No subject reference
            r.resource->'subject' IS NULL
            OR
            -- Empty subject object
            jsonb_typeof(r.resource->'subject') = 'object' 
            AND NOT (r.resource->'subject' ? 'reference')
        )
        ORDER BY r.last_updated
    """
    
    rows = await conn.fetch(query)
    
    invalid_observations = []
    for row in rows:
        invalid_observations.append({
            'id': row['id'],
            'fhir_id': row['fhir_id'],
            'code_text': row['code_text'],
            'has_subject': row['subject'] is not None and 'reference' in (row['subject'] or {}),
            'last_updated': row['last_updated']
        })
    
    return invalid_observations


async def delete_observations(conn, observations: List[Dict], dry_run: bool = False):
    """Delete the invalid observations."""
    if dry_run:
        logger.info(f"[DRY RUN] Would delete {len(observations)} observations")
        return
    
    deleted_count = 0
    
    async with conn.transaction():
        for obs in observations:
            try:
                # Mark as deleted (soft delete)
                await conn.execute("""
                    UPDATE fhir.resources 
                    SET deleted = true, last_updated = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, obs['id'])
                
                # Remove search parameters
                await conn.execute("""
                    DELETE FROM fhir.search_params
                    WHERE resource_id = $1
                """, obs['id'])
                
                # Remove from compartments
                await conn.execute("""
                    DELETE FROM fhir.compartments
                    WHERE resource_id = $1
                """, obs['id'])
                
                # Remove references
                await conn.execute("""
                    DELETE FROM fhir.references
                    WHERE source_id = $1 OR target_id = $1
                """, obs['id'])
                
                deleted_count += 1
                logger.info(f"✅ Deleted observation {obs['fhir_id']}")
                
            except Exception as e:
                logger.error(f"❌ Error deleting observation {obs['fhir_id']}: {e}")
    
    return deleted_count


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Clean up invalid observation test data')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Preview what would be deleted without actually deleting')
    
    args = parser.parse_args()
    
    # Connect to database
    import os
    host = 'postgres' if os.path.exists('/.dockerenv') else 'localhost'
    
    try:
        conn = await asyncpg.connect(
            f"postgresql://emr_user:emr_password@{host}:5432/emr_db"
        )
        
        logger.info("🧹 Invalid Observation Cleanup")
        logger.info("=" * 60)
        
        # Find invalid observations
        invalid_observations = await find_invalid_observations(conn)
        
        if not invalid_observations:
            logger.info("✅ No invalid observations found!")
            return
        
        logger.info(f"\nFound {len(invalid_observations)} invalid observations:")
        
        # Show details
        for obs in invalid_observations:
            logger.info(f"  - {obs['fhir_id']}")
            logger.info(f"    Code text: {obs['code_text']}")
            logger.info(f"    Has subject: {obs['has_subject']}")
            logger.info(f"    Last updated: {obs['last_updated']}")
        
        if args.dry_run:
            logger.info("\n[DRY RUN] No changes made")
        else:
            # Confirm deletion
            logger.info(f"\n⚠️  About to delete {len(invalid_observations)} observations")
            
            # Delete observations
            deleted_count = await delete_observations(conn, invalid_observations, args.dry_run)
            
            if deleted_count > 0:
                logger.info(f"\n✅ Successfully deleted {deleted_count} invalid observations")
            else:
                logger.info("\n❌ No observations were deleted")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise
    finally:
        if 'conn' in locals():
            await conn.close()


if __name__ == "__main__":
    asyncio.run(main())