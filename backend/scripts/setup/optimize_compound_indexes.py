#!/usr/bin/env python3
"""
Optimize Database Compound Indexes for Performance

This script adds critical compound indexes that are missing from the database,
which are causing severe performance issues with multi-parameter searches.

Author: WintEHR Team
Date: 2025-01-24
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import List, Dict, Any

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IndexOptimizer:
    """Manages compound index optimization for FHIR database."""
    
    def __init__(self, database_url: str = None):
        """Initialize with database connection."""
        if not database_url:
            database_url = os.getenv(
                'DATABASE_URL',
                'postgresql+asyncpg://emr_user:emr_password@localhost/emr_db'
            )
        
        self.engine = create_async_engine(database_url, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
    
    async def get_existing_indexes(self) -> List[str]:
        """Get list of existing indexes."""
        async with self.async_session() as session:
            result = await session.execute(text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE schemaname = 'fhir'
                ORDER BY indexname
            """))
            return [row[0] for row in result]
    
    async def create_compound_indexes(self) -> Dict[str, Any]:
        """Create optimized compound indexes for search performance."""
        results = {
            'created': [],
            'skipped': [],
            'failed': [],
            'timing': {}
        }
        
        # Define compound indexes to create
        compound_indexes = [
            # Critical compound indexes for search_params table
            {
                'name': 'idx_search_params_compound_string',
                'table': 'fhir.search_params',
                'columns': '(resource_type, param_name, value_string)',
                'where': 'WHERE value_string IS NOT NULL',
                'comment': 'Compound index for string searches'
            },
            {
                'name': 'idx_search_params_compound_token',
                'table': 'fhir.search_params',
                'columns': '(resource_type, param_name, value_token)',
                'where': 'WHERE value_token IS NOT NULL',
                'comment': 'Compound index for token searches'
            },
            {
                'name': 'idx_search_params_compound_reference',
                'table': 'fhir.search_params',
                'columns': '(resource_type, param_name, value_reference)',
                'where': 'WHERE value_reference IS NOT NULL',
                'comment': 'Compound index for reference searches'
            },
            {
                'name': 'idx_search_params_compound_date',
                'table': 'fhir.search_params',
                'columns': '(resource_type, param_name, value_date)',
                'where': 'WHERE value_date IS NOT NULL',
                'comment': 'Compound index for date searches'
            },
            {
                'name': 'idx_search_params_compound_number',
                'table': 'fhir.search_params',
                'columns': '(resource_type, param_name, value_number)',
                'where': 'WHERE value_number IS NOT NULL',
                'comment': 'Compound index for number searches'
            },
            # Specialized indexes for common query patterns
            {
                'name': 'idx_search_params_patient_reference',
                'table': 'fhir.search_params',
                'columns': '(param_name, value_reference, resource_type)',
                'where': "WHERE param_name IN ('patient', 'subject', 'beneficiary')",
                'comment': 'Optimized for patient reference searches'
            },
            {
                'name': 'idx_search_params_status_token',
                'table': 'fhir.search_params',
                'columns': '(param_name, value_token, resource_type)',
                'where': "WHERE param_name = 'status'",
                'comment': 'Optimized for status searches'
            },
            # Covering index for resources table
            {
                'name': 'idx_resources_covering',
                'table': 'fhir.resources',
                'columns': '(resource_type, fhir_id, deleted, last_updated)',
                'where': 'WHERE deleted = false',
                'comment': 'Covering index for resource lookups'
            },
            # Index for search params resource lookup
            {
                'name': 'idx_search_params_resource_lookup',
                'table': 'fhir.search_params',
                'columns': '(resource_id, resource_type, param_name)',
                'where': None,
                'comment': 'Optimize JOIN operations'
            }
        ]
        
        # Get existing indexes
        existing_indexes = await self.get_existing_indexes()
        logger.info(f"Found {len(existing_indexes)} existing indexes")
        
        # Use raw connection for CONCURRENTLY indexes (cannot run in transaction)
        async with self.engine.connect() as conn:
            # Set autocommit mode for CONCURRENTLY
            await conn.execute(text("SET autocommit TO ON"))
            await conn.commit()
            
            for index in compound_indexes:
                if index['name'] in existing_indexes:
                    logger.info(f"⏭️  Skipping existing index: {index['name']}")
                    results['skipped'].append(index['name'])
                    continue
                
                try:
                    start_time = datetime.now()
                    
                    # Build CREATE INDEX statement
                    sql = f"CREATE INDEX CONCURRENTLY {index['name']} ON {index['table']} {index['columns']}"
                    if index['where']:
                        sql += f" {index['where']}"
                    
                    logger.info(f"🔨 Creating index: {index['name']}")
                    logger.info(f"   Comment: {index['comment']}")
                    
                    # Create index using raw execution
                    await conn.execute(text(sql))
                    
                    # Add comment
                    comment_sql = f"COMMENT ON INDEX {index['name']} IS :comment"
                    await conn.execute(text(comment_sql), {'comment': index['comment']})
                    
                    duration = (datetime.now() - start_time).total_seconds()
                    results['created'].append(index['name'])
                    results['timing'][index['name']] = duration
                    
                    logger.info(f"✅ Created index: {index['name']} ({duration:.2f}s)")
                    
                except Exception as e:
                    logger.error(f"❌ Failed to create index {index['name']}: {e}")
                    results['failed'].append({
                        'index': index['name'],
                        'error': str(e)
                    })
        
        return results
    
    async def analyze_tables(self) -> None:
        """Run ANALYZE on key tables to update statistics."""
        logger.info("📊 Analyzing tables to update statistics...")
        
        tables = [
            'fhir.resources',
            'fhir.search_params',
            'fhir.references',
            'fhir.compartments'
        ]
        
        async with self.async_session() as session:
            for table in tables:
                try:
                    logger.info(f"   Analyzing {table}...")
                    await session.execute(text(f"ANALYZE {table}"))
                    await session.commit()
                except Exception as e:
                    logger.error(f"   Failed to analyze {table}: {e}")
    
    async def check_index_usage(self) -> None:
        """Check index usage statistics."""
        logger.info("\n📈 Index Usage Statistics:")
        
        async with self.async_session() as session:
            # Check index sizes
            result = await session.execute(text("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname::text)) as index_size
                FROM pg_indexes
                WHERE schemaname = 'fhir'
                AND indexname LIKE '%compound%' OR indexname LIKE '%covering%'
                ORDER BY pg_relation_size(schemaname||'.'||indexname::text) DESC
            """))
            
            for row in result:
                logger.info(f"   {row[2]}: {row[3]}")
    
    async def close(self):
        """Close database connection."""
        await self.engine.dispose()


async def main():
    """Main execution function."""
    logger.info("🚀 Starting Database Index Optimization")
    logger.info("=" * 60)
    
    # Check if running in Docker
    in_docker = os.path.exists('/.dockerenv') or os.getenv('DOCKER_CONTAINER') == 'true'
    
    # Set database URL based on environment
    if in_docker or '--docker' in sys.argv:
        database_url = 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db'
    else:
        database_url = os.getenv(
            'DATABASE_URL',
            'postgresql+asyncpg://emr_user:emr_password@localhost/emr_db'
        )
    
    optimizer = IndexOptimizer(database_url)
    
    try:
        # Create compound indexes
        logger.info("\n📋 Creating Compound Indexes...")
        results = await optimizer.create_compound_indexes()
        
        # Analyze tables
        await optimizer.analyze_tables()
        
        # Check index usage
        await optimizer.check_index_usage()
        
        # Summary
        logger.info("\n📊 Optimization Summary:")
        logger.info(f"   Created: {len(results['created'])} indexes")
        logger.info(f"   Skipped: {len(results['skipped'])} indexes")
        logger.info(f"   Failed: {len(results['failed'])} indexes")
        
        if results['created']:
            logger.info("\n⏱️  Timing:")
            total_time = sum(results['timing'].values())
            for index, duration in results['timing'].items():
                logger.info(f"   {index}: {duration:.2f}s")
            logger.info(f"   Total: {total_time:.2f}s")
        
        if results['failed']:
            logger.error("\n❌ Failed indexes:")
            for failure in results['failed']:
                logger.error(f"   {failure['index']}: {failure['error']}")
            sys.exit(1)
        
        logger.info("\n✅ Index optimization completed successfully!")
        logger.info("\n💡 Next steps:")
        logger.info("   1. Monitor query performance with EXPLAIN ANALYZE")
        logger.info("   2. Run performance tests to verify improvements")
        logger.info("   3. Consider adding more specialized indexes based on usage patterns")
        
    except Exception as e:
        logger.error(f"❌ Optimization failed: {e}")
        sys.exit(1)
    finally:
        await optimizer.close()


if __name__ == "__main__":
    asyncio.run(main())