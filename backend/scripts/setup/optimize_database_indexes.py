#!/usr/bin/env python3
"""
Database Index Optimization Script

Creates optimal indexes for FHIR resource queries to improve performance.
Analyzes query patterns and creates appropriate indexes.
"""

import asyncio
import logging
from typing import List, Dict, Any
import asyncpg
from datetime import datetime
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_database_url():
    """Get database URL from environment or use default"""
    url = os.environ.get(
        'DATABASE_URL',
        'postgresql://emr_user:emr_password@postgres:5432/emr_db'
    )
    # Convert SQLAlchemy URL format to asyncpg format
    if url.startswith('postgresql+asyncpg://'):
        url = url.replace('postgresql+asyncpg://', 'postgresql://')
    return url

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class IndexOptimizer:
    """Optimizes database indexes for FHIR queries"""
    
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        
    async def analyze_existing_indexes(self) -> List[Dict[str, Any]]:
        """Get information about existing indexes"""
        query = """
            SELECT 
                i.schemaname,
                i.tablename,
                i.indexname,
                i.indexdef,
                pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
            FROM pg_indexes i
            JOIN pg_stat_user_indexes s ON s.indexrelname = i.indexname 
                AND s.schemaname = i.schemaname
            WHERE i.schemaname = 'fhir'
            ORDER BY i.schemaname, i.tablename, i.indexname;
        """
        
        rows = await self.conn.fetch(query)
        return [dict(row) for row in rows]
    
    async def analyze_slow_queries(self) -> List[Dict[str, Any]]:
        """Analyze slow queries to identify missing indexes"""
        # Check if pg_stat_statements is available
        check_extension = """
            SELECT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
            );
        """
        has_extension = await self.conn.fetchval(check_extension)
        
        if not has_extension:
            logger.warning("pg_stat_statements extension not available. Skipping slow query analysis.")
            return []
        
        query = """
            SELECT 
                query,
                calls,
                total_time,
                mean_time,
                min_time,
                max_time
            FROM pg_stat_statements
            WHERE query LIKE '%fhir.%'
            AND mean_time > 10  -- Queries averaging over 10ms
            ORDER BY mean_time DESC
            LIMIT 20;
        """
        
        try:
            rows = await self.conn.fetch(query)
            return [dict(row) for row in rows]
        except Exception as e:
            logger.warning(f"Could not analyze slow queries: {e}")
            return []
    
    async def create_optimized_indexes(self):
        """Create optimized indexes for FHIR queries"""
        
        indexes = [
            # Primary table indexes
            {
                "name": "idx_resources_type_status",
                "table": "fhir.resources",
                "columns": ["resource_type", "(resource->>'status')"],
                "where": None,
                "method": "btree",
                "concurrent": True,
                "description": "Optimize filtering by resource type and status"
            },
            {
                "name": "idx_resources_lastupdated",
                "table": "fhir.resources", 
                "columns": ["(resource->'meta'->>'lastUpdated')"],
                "where": None,
                "method": "btree",
                "concurrent": True,
                "description": "Optimize temporal queries"
            },
            {
                "name": "idx_resources_patient_ref",
                "table": "fhir.resources",
                "columns": ["resource_type", "(resource->'subject'->>'reference')", "(resource->'patient'->>'reference')"],
                "where": "resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'Procedure', 'Encounter')",
                "method": "btree",
                "concurrent": True,
                "description": "Optimize patient-centric queries"
            },
            
            # Search parameters table indexes
            {
                "name": "idx_search_params_composite",
                "table": "fhir.search_params",
                "columns": ["resource_type", "param_name", "value_string"],
                "where": None,
                "method": "btree",
                "concurrent": True,
                "description": "Optimize search parameter lookups"
            },
            {
                "name": "idx_search_params_patient",
                "table": "fhir.search_params",
                "columns": ["value_string"],
                "where": "param_name IN ('patient', 'subject')",
                "method": "btree",
                "concurrent": True,
                "description": "Optimize patient reference searches"
            },
            {
                "name": "idx_search_params_date",
                "table": "fhir.search_params",
                "columns": ["resource_type", "param_name", "value_date"],
                "where": "value_date IS NOT NULL",
                "method": "btree",
                "concurrent": True,
                "description": "Optimize date-based searches"
            },
            {
                "name": "idx_search_params_token",
                "table": "fhir.search_params",
                "columns": ["resource_type", "param_name", "value_token"],
                "where": "value_token IS NOT NULL",
                "method": "btree",
                "concurrent": True,
                "description": "Optimize token searches (codes, identifiers)"
            },
            
            # Compartments table indexes
            {
                "name": "idx_compartments_lookup",
                "table": "fhir.compartments",
                "columns": ["compartment_type", "compartment_id"],
                "where": None,
                "method": "btree",
                "concurrent": True,
                "description": "Optimize compartment searches"
            },
            
            # References table indexes
            {
                "name": "idx_references_source",
                "table": "fhir.references",
                "columns": ["source_resource_type", "source_resource_id"],
                "where": None,
                "method": "btree",
                "concurrent": True,
                "description": "Optimize reference source lookups"
            },
            {
                "name": "idx_references_target",
                "table": "fhir.references",
                "columns": ["target_resource_type", "target_resource_id"],
                "where": None,
                "method": "btree",
                "concurrent": True,
                "description": "Optimize reference target lookups"
            },
            
            # JSONB indexes for common queries
            {
                "name": "idx_resources_identifier_gin",
                "table": "fhir.resources",
                "columns": ["(resource->'identifier')"],
                "where": "resource_type IN ('Patient', 'Practitioner', 'Organization')",
                "method": "gin",
                "concurrent": True,
                "description": "Optimize identifier searches"
            },
            {
                "name": "idx_resources_code_gin",
                "table": "fhir.resources",
                "columns": ["(resource->'code')"],
                "where": "resource_type IN ('Observation', 'Condition', 'Procedure', 'MedicationRequest')",
                "method": "gin",
                "concurrent": True,
                "description": "Optimize code searches"
            },
            {
                "name": "idx_resources_category_gin",
                "table": "fhir.resources",
                "columns": ["(resource->'category')"],
                "where": "resource_type IN ('Observation', 'Condition', 'ServiceRequest')",
                "method": "gin",
                "concurrent": True,
                "description": "Optimize category searches"
            },
            
            # Specialized indexes for common access patterns
            {
                "name": "idx_observation_patient_code",
                "table": "fhir.resources",
                "columns": ["(resource->'subject'->>'reference')", "(resource->'code'->'coding'->0->>'code')"],
                "where": "resource_type = 'Observation'",
                "method": "btree",
                "concurrent": True,
                "description": "Optimize Observation queries by patient and code"
            },
            {
                "name": "idx_encounter_patient_period",
                "table": "fhir.resources",
                "columns": ["(resource->'subject'->>'reference')", "(resource->'period'->>'start')"],
                "where": "resource_type = 'Encounter'",
                "method": "btree",
                "concurrent": True,
                "description": "Optimize Encounter queries by patient and period"
            }
        ]
        
        created_indexes = []
        failed_indexes = []
        
        for index in indexes:
            try:
                # Check if index already exists
                check_query = """
                    SELECT EXISTS (
                        SELECT 1 FROM pg_indexes 
                        WHERE schemaname = 'fhir' 
                        AND indexname = $1
                    );
                """
                exists = await self.conn.fetchval(check_query, index['name'])
                
                if exists:
                    logger.info(f"Index {index['name']} already exists, skipping")
                    continue
                
                # Build CREATE INDEX statement
                columns_str = ", ".join(index['columns'])
                where_clause = f" WHERE {index['where']}" if index['where'] else ""
                concurrent = "CONCURRENTLY" if index['concurrent'] else ""
                
                create_query = f"""
                    CREATE INDEX {concurrent} {index['name']}
                    ON {index['table']} USING {index['method']} ({columns_str})
                    {where_clause};
                """
                
                logger.info(f"Creating index: {index['name']} - {index['description']}")
                await self.conn.execute(create_query)
                created_indexes.append(index['name'])
                
            except Exception as e:
                logger.error(f"Failed to create index {index['name']}: {e}")
                failed_indexes.append((index['name'], str(e)))
        
        return created_indexes, failed_indexes
    
    async def analyze_table_statistics(self):
        """Update table statistics for query planner"""
        tables = [
            'fhir.resources',
            'fhir.resource_history', 
            'fhir.search_params',
            'fhir.references',
            'fhir.compartments',
            'fhir.audit_logs'
        ]
        
        for table in tables:
            try:
                logger.info(f"Analyzing table {table}")
                await self.conn.execute(f"ANALYZE {table};")
            except Exception as e:
                logger.error(f"Failed to analyze {table}: {e}")
    
    async def get_index_usage_stats(self) -> List[Dict[str, Any]]:
        """Get index usage statistics"""
        query = """
            SELECT 
                s.schemaname,
                s.relname as tablename,
                s.indexrelname,
                s.idx_scan,
                s.idx_tup_read,
                s.idx_tup_fetch,
                pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
            FROM pg_stat_user_indexes s
            WHERE s.schemaname = 'fhir'
            ORDER BY s.idx_scan DESC;
        """
        
        rows = await self.conn.fetch(query)
        return [dict(row) for row in rows]
    
    async def identify_unused_indexes(self) -> List[Dict[str, Any]]:
        """Identify indexes that are rarely or never used"""
        query = """
            SELECT 
                s.schemaname,
                s.relname as tablename,
                s.indexrelname,
                s.idx_scan,
                pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
            FROM pg_stat_user_indexes s
            WHERE s.schemaname = 'fhir'
            AND s.idx_scan < 10  -- Less than 10 scans
            AND s.indexrelname NOT LIKE '%_pkey'  -- Keep primary keys
            ORDER BY pg_relation_size(s.indexrelid) DESC;
        """
        
        rows = await self.conn.fetch(query)
        return [dict(row) for row in rows]


async def main():
    """Main function to run index optimization"""
    
    # Get database URL
    database_url = get_database_url()
    
    # Connect to database
    conn = await asyncpg.connect(database_url)
    
    try:
        optimizer = IndexOptimizer(conn)
        
        # 1. Analyze existing indexes
        logger.info("=== Analyzing Existing Indexes ===")
        existing_indexes = await optimizer.analyze_existing_indexes()
        logger.info(f"Found {len(existing_indexes)} existing indexes")
        
        # 2. Analyze slow queries (if available)
        logger.info("\n=== Analyzing Slow Queries ===")
        slow_queries = await optimizer.analyze_slow_queries()
        if slow_queries:
            logger.info(f"Found {len(slow_queries)} slow queries")
            for query in slow_queries[:5]:  # Show top 5
                logger.info(f"Query (mean time: {query['mean_time']:.2f}ms): {query['query'][:100]}...")
        
        # 3. Create optimized indexes
        logger.info("\n=== Creating Optimized Indexes ===")
        created, failed = await optimizer.create_optimized_indexes()
        logger.info(f"Successfully created {len(created)} indexes")
        if failed:
            logger.error(f"Failed to create {len(failed)} indexes:")
            for name, error in failed:
                logger.error(f"  - {name}: {error}")
        
        # 4. Update table statistics
        logger.info("\n=== Updating Table Statistics ===")
        await optimizer.analyze_table_statistics()
        
        # 5. Get index usage stats
        logger.info("\n=== Index Usage Statistics ===")
        usage_stats = await optimizer.get_index_usage_stats()
        logger.info("Top 10 most used indexes:")
        for stat in usage_stats[:10]:
            logger.info(f"  - {stat['indexrelname']}: {stat['idx_scan']} scans, size: {stat['index_size']}")
        
        # 6. Identify unused indexes
        logger.info("\n=== Identifying Unused Indexes ===")
        unused_indexes = await optimizer.identify_unused_indexes()
        if unused_indexes:
            logger.warning(f"Found {len(unused_indexes)} potentially unused indexes:")
            for idx in unused_indexes:
                logger.warning(f"  - {idx['indexrelname']} (size: {idx['index_size']}, scans: {idx['idx_scan']})")
        else:
            logger.info("No unused indexes found")
        
        logger.info("\n=== Index Optimization Complete ===")
        
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())