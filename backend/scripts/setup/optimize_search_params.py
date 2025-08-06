#!/usr/bin/env python3
"""
Optimize search parameters by removing duplicates and excessive indexing.

This script addresses performance issues by:
1. Removing duplicate search parameters
2. Cleaning up excessive Provenance target parameters
3. Creating optimized indexes for common queries
"""

import asyncio
import asyncpg
import logging
from datetime import datetime
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SearchParamOptimizer:
    def __init__(self):
        self.connection = None
        self.db_config = {
            'host': os.environ.get('DB_HOST', 'localhost'),
            'port': int(os.environ.get('DB_PORT', 5432)),
            'database': os.environ.get('DB_NAME', 'emr_db'),
            'user': os.environ.get('DB_USER', 'emr_user'),
            'password': os.environ.get('DB_PASSWORD', 'emr_password')
        }
    
    async def connect(self):
        """Connect to database."""
        try:
            self.connection = await asyncpg.connect(**self.db_config)
            logger.info("✅ Connected to database")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to database: {e}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.connection:
            await self.connection.close()
    
    async def get_statistics(self):
        """Get current search parameter statistics."""
        stats = {}
        
        # Total parameters
        stats['total_params'] = await self.connection.fetchval(
            "SELECT COUNT(*) FROM fhir.search_params"
        )
        
        # Total resources
        stats['total_resources'] = await self.connection.fetchval(
            "SELECT COUNT(*) FROM fhir.resources WHERE deleted = false"
        )
        
        # Parameters per resource
        if stats['total_resources'] > 0:
            stats['params_per_resource'] = stats['total_params'] / stats['total_resources']
        else:
            stats['params_per_resource'] = 0
        
        # Check for duplicates
        stats['duplicate_count'] = await self.connection.fetchval("""
            SELECT SUM(duplicate_count - 1) FROM (
                SELECT COUNT(*) as duplicate_count
                FROM fhir.search_params
                GROUP BY resource_id, resource_type, param_name, 
                         COALESCE(value_string, ''), 
                         COALESCE(value_reference, ''),
                         COALESCE(value_token, '')
                HAVING COUNT(*) > 1
            ) duplicates
        """)
        
        # Excessive Provenance targets
        stats['provenance_targets'] = await self.connection.fetchval("""
            SELECT COUNT(*) 
            FROM fhir.search_params 
            WHERE resource_type = 'Provenance' 
            AND param_name = 'target'
        """)
        
        return stats
    
    async def remove_duplicates(self):
        """Remove duplicate search parameters."""
        logger.info("🔍 Removing duplicate search parameters...")
        
        # Count duplicates before removal
        before_count = await self.connection.fetchval(
            "SELECT COUNT(*) FROM fhir.search_params"
        )
        
        # Remove duplicates, keeping only the first occurrence
        await self.connection.execute("""
            DELETE FROM fhir.search_params a
            USING fhir.search_params b
            WHERE a.id > b.id
              AND a.resource_id = b.resource_id
              AND a.resource_type = b.resource_type
              AND a.param_name = b.param_name
              AND COALESCE(a.value_string, '') = COALESCE(b.value_string, '')
              AND COALESCE(a.value_reference, '') = COALESCE(b.value_reference, '')
              AND COALESCE(a.value_token, '') = COALESCE(b.value_token, '')
        """)
        
        # Count after removal
        after_count = await self.connection.fetchval(
            "SELECT COUNT(*) FROM fhir.search_params"
        )
        
        removed = before_count - after_count
        logger.info(f"✅ Removed {removed:,} duplicate parameters")
        return removed
    
    async def clean_excessive_params(self):
        """Remove excessive parameters that cause bloat."""
        logger.info("🔍 Cleaning excessive parameters...")
        
        # Remove Provenance target parameters (they cause massive bloat)
        provenance_removed = await self.connection.fetchval("""
            DELETE FROM fhir.search_params 
            WHERE resource_type = 'Provenance' 
            AND param_name = 'target'
            RETURNING COUNT(*)
        """)
        
        # Remove unnecessary _lastUpdated and _profile for non-essential resources
        meta_removed = await self.connection.fetchval("""
            DELETE FROM fhir.search_params 
            WHERE param_name IN ('_lastUpdated', '_profile')
            AND resource_type NOT IN ('Patient', 'Encounter', 'Observation', 'Condition', 'MedicationRequest')
            RETURNING COUNT(*)
        """)
        
        total_removed = (provenance_removed or 0) + (meta_removed or 0)
        logger.info(f"✅ Removed {total_removed:,} excessive parameters")
        return total_removed
    
    async def create_optimized_indexes(self):
        """Create optimized indexes for common query patterns."""
        logger.info("🔍 Creating optimized indexes...")
        
        indexes = [
            # Fast patient lookup
            ("idx_search_patient_lookup", 
             """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_patient_lookup 
                ON fhir.search_params(resource_type, param_name, value_reference) 
                WHERE param_name IN ('patient', 'subject')"""),
            
            # Fast resource type lookup
            ("idx_search_resource_type", 
             """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_resource_type 
                ON fhir.search_params(resource_type, resource_id)"""),
            
            # Fast code lookup
            ("idx_search_code_lookup", 
             """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_code_lookup 
                ON fhir.search_params(resource_type, param_name, value_token) 
                WHERE param_name = 'code'"""),
            
            # Fast status lookup
            ("idx_search_status_lookup", 
             """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_status_lookup 
                ON fhir.search_params(resource_type, param_name, value_token) 
                WHERE param_name = 'status'"""),
        ]
        
        created = 0
        for index_name, create_sql in indexes:
            try:
                # Check if index exists
                exists = await self.connection.fetchval("""
                    SELECT EXISTS(
                        SELECT 1 FROM pg_indexes 
                        WHERE indexname = $1 
                        AND schemaname = 'fhir'
                    )
                """, index_name)
                
                if not exists:
                    logger.info(f"Creating index {index_name}...")
                    await self.connection.execute(create_sql)
                    created += 1
                    logger.info(f"✅ Created index {index_name}")
                else:
                    logger.info(f"⏭️ Index {index_name} already exists")
                    
            except Exception as e:
                logger.warning(f"⚠️ Could not create index {index_name}: {e}")
        
        logger.info(f"✅ Created {created} new indexes")
        return created
    
    async def analyze_tables(self):
        """Update table statistics for query optimizer."""
        logger.info("🔍 Updating table statistics...")
        
        await self.connection.execute("ANALYZE fhir.search_params")
        await self.connection.execute("ANALYZE fhir.resources")
        
        logger.info("✅ Table statistics updated")
    
    async def optimize(self):
        """Run full optimization."""
        logger.info("🚀 Starting search parameter optimization")
        logger.info("=" * 60)
        
        # Get initial statistics
        stats_before = await self.get_statistics()
        logger.info(f"""
Initial Statistics:
- Total parameters: {stats_before['total_params']:,}
- Total resources: {stats_before['total_resources']:,}
- Parameters per resource: {stats_before['params_per_resource']:.1f}
- Duplicate parameters: {stats_before['duplicate_count'] or 0:,}
- Provenance targets: {stats_before['provenance_targets']:,}
        """)
        
        # Run optimizations
        duplicates_removed = await self.remove_duplicates()
        excessive_removed = await self.clean_excessive_params()
        indexes_created = await self.create_optimized_indexes()
        await self.analyze_tables()
        
        # Get final statistics
        stats_after = await self.get_statistics()
        logger.info(f"""
Final Statistics:
- Total parameters: {stats_after['total_params']:,} (reduced by {stats_before['total_params'] - stats_after['total_params']:,})
- Parameters per resource: {stats_after['params_per_resource']:.1f}
- Duplicate parameters: {stats_after['duplicate_count'] or 0:,}
- Provenance targets: {stats_after['provenance_targets']:,}
        """)
        
        logger.info("=" * 60)
        logger.info("✅ Optimization complete!")
        
        return {
            'duplicates_removed': duplicates_removed,
            'excessive_removed': excessive_removed,
            'indexes_created': indexes_created,
            'total_removed': duplicates_removed + excessive_removed
        }


async def main():
    """Main execution."""
    optimizer = SearchParamOptimizer()
    
    try:
        if not await optimizer.connect():
            return 1
        
        results = await optimizer.optimize()
        
        if results['total_removed'] > 0:
            logger.info(f"🎉 Successfully optimized search parameters!")
            logger.info(f"   Removed {results['total_removed']:,} unnecessary parameters")
        else:
            logger.info("✅ Search parameters are already optimized")
        
        return 0
        
    except Exception as e:
        logger.error(f"❌ Optimization failed: {e}")
        return 1
    finally:
        await optimizer.close()


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))