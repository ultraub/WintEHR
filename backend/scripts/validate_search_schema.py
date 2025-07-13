#!/usr/bin/env python3
"""
Schema Validation Tool for FHIR Search Parameters

This tool validates that the database schema matches the expectations of the codebase.
It checks for required tables, columns, indexes, and data consistency.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://robertbarrett@127.0.0.1:5432/medgenemr')


class SchemaValidator:
    """Validates FHIR database schema."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.errors = []
        self.warnings = []
        
    async def validate_all(self) -> bool:
        """Run all validation checks."""
        logger.info("🔍 Starting comprehensive schema validation...")
        
        # Core schema validation
        await self.validate_tables()
        await self.validate_columns()
        await self.validate_indexes()
        await self.validate_foreign_keys()
        
        # Data consistency validation
        await self.validate_data_consistency()
        await self.validate_search_parameters()
        
        # Performance validation
        await self.validate_performance_indexes()
        
        # Report results
        self._report_results()
        
        return len(self.errors) == 0
    
    async def validate_tables(self):
        """Validate required tables exist."""
        logger.info("📋 Validating tables...")
        
        required_tables = [
            ('fhir', 'resources'),
            ('fhir', 'search_params'),
            ('fhir', 'resource_history'),
            ('fhir', 'references')
        ]
        
        for schema, table in required_tables:
            exists = await self._table_exists(schema, table)
            if not exists:
                self.errors.append(f"Missing required table: {schema}.{table}")
            else:
                logger.info(f"   ✅ {schema}.{table}")
    
    async def validate_columns(self):
        """Validate required columns exist with correct types."""
        logger.info("🏗️  Validating columns...")
        
        expected_columns = {
            'search_params': [
                ('id', 'integer'),
                ('resource_id', 'integer'),
                ('resource_type', 'character varying'),  # This was missing!
                ('param_name', 'character varying'),
                ('param_type', 'character varying'),
                ('value_string', 'text'),
                ('value_number', 'numeric'),
                ('value_date', 'timestamp with time zone'),
                ('value_token_system', 'character varying'),
                ('value_token_code', 'character varying'),
                ('value_reference', 'character varying')
            ],
            'resources': [
                ('id', 'integer'),
                ('resource_type', 'character varying'),
                ('fhir_id', 'character varying'),
                ('version_id', 'integer'),
                ('last_updated', 'timestamp with time zone'),
                ('resource', 'jsonb'),
                ('deleted', 'boolean')
            ],
            'resource_history': [
                ('id', 'integer'),
                ('resource_id', 'integer'),
                ('version_id', 'integer'),
                ('operation', 'character varying'),
                ('resource', 'jsonb'),
                ('created_at', 'timestamp with time zone')
            ],
            'references': [
                ('id', 'integer'),
                ('source_id', 'integer'),
                ('source_type', 'character varying'),
                ('target_id', 'integer'),
                ('target_type', 'character varying'),
                ('target_reference', 'character varying'),
                ('path', 'character varying'),
                ('created_at', 'timestamp with time zone')
            ]
        }
        
        for table, columns in expected_columns.items():
            for column_name, expected_type in columns:
                actual_type = await self._get_column_type('fhir', table, column_name)
                if actual_type is None:
                    self.errors.append(f"Missing column: fhir.{table}.{column_name}")
                elif not self._types_compatible(actual_type, expected_type):
                    self.errors.append(f"Wrong type for fhir.{table}.{column_name}: expected {expected_type}, got {actual_type}")
                else:
                    logger.info(f"   ✅ fhir.{table}.{column_name} ({actual_type})")
    
    async def validate_indexes(self):
        """Validate required indexes exist."""
        logger.info("🚀 Validating indexes...")
        
        required_indexes = [
            ('search_params', 'idx_search_params_resource_type'),
            ('search_params', 'idx_search_params_type_name'),
            ('resources', 'idx_resources_type_fhir_id'),
            ('resource_history', 'idx_resource_history_resource_id'),
            ('references', 'idx_references_source_id')
        ]
        
        for table, index_name in required_indexes:
            exists = await self._index_exists('fhir', table, index_name)
            if not exists:
                self.warnings.append(f"Missing recommended index: {index_name} on fhir.{table}")
            else:
                logger.info(f"   ✅ {index_name}")
    
    async def validate_foreign_keys(self):
        """Validate foreign key constraints."""
        logger.info("🔗 Validating foreign keys...")
        
        expected_fks = [
            ('search_params', 'resource_id', 'resources', 'id'),
            ('resource_history', 'resource_id', 'resources', 'id'),
            ('references', 'source_id', 'resources', 'id')
        ]
        
        for table, column, ref_table, ref_column in expected_fks:
            exists = await self._foreign_key_exists('fhir', table, column, ref_table, ref_column)
            if not exists:
                self.warnings.append(f"Missing foreign key: fhir.{table}.{column} -> fhir.{ref_table}.{ref_column}")
            else:
                logger.info(f"   ✅ {table}.{column} -> {ref_table}.{ref_column}")
    
    async def validate_data_consistency(self):
        """Validate data consistency."""
        logger.info("📊 Validating data consistency...")
        
        # Check for orphaned search parameters
        orphaned_query = text("""
            SELECT COUNT(*) 
            FROM fhir.search_params sp 
            LEFT JOIN fhir.resources r ON sp.resource_id = r.id 
            WHERE r.id IS NULL
        """)
        
        result = await self.session.execute(orphaned_query)
        orphaned_count = result.scalar()
        
        if orphaned_count > 0:
            self.warnings.append(f"Found {orphaned_count} orphaned search parameters")
        else:
            logger.info("   ✅ No orphaned search parameters")
        
        # Check for missing resource_type values
        missing_type_query = text("""
            SELECT COUNT(*) 
            FROM fhir.search_params 
            WHERE resource_type IS NULL
        """)
        
        result = await self.session.execute(missing_type_query)
        missing_count = result.scalar()
        
        if missing_count > 0:
            self.errors.append(f"Found {missing_count} search parameters with NULL resource_type")
        else:
            logger.info("   ✅ All search parameters have resource_type")
    
    async def validate_search_parameters(self):
        """Validate search parameter statistics."""
        logger.info("🔍 Validating search parameter coverage...")
        
        # Get statistics
        stats_query = text("""
            SELECT 
                r.resource_type,
                COUNT(r.id) as total_resources,
                COUNT(DISTINCT sp.resource_id) as resources_with_params,
                COUNT(sp.id) as total_params
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.deleted = false
            GROUP BY r.resource_type
            ORDER BY total_resources DESC
        """)
        
        result = await self.session.execute(stats_query)
        stats = result.fetchall()
        
        for row in stats:
            coverage = (row.resources_with_params / row.total_resources) * 100 if row.total_resources > 0 else 0
            if coverage < 50:
                self.warnings.append(f"Low search parameter coverage for {row.resource_type}: {coverage:.1f}%")
            else:
                logger.info(f"   ✅ {row.resource_type}: {coverage:.1f}% coverage ({row.total_params} params)")
    
    async def validate_performance_indexes(self):
        """Validate performance-critical indexes."""
        logger.info("⚡ Validating performance indexes...")
        
        # Check for missing composite indexes
        composite_indexes = [
            ('search_params', 'resource_type', 'param_name'),
            ('search_params', 'param_name', 'value_string'),
            ('resources', 'resource_type', 'deleted')
        ]
        
        for table, col1, col2 in composite_indexes:
            exists = await self._composite_index_exists('fhir', table, [col1, col2])
            if not exists:
                self.warnings.append(f"Missing composite index on fhir.{table}({col1}, {col2})")
            else:
                logger.info(f"   ✅ Composite index on {table}({col1}, {col2})")
    
    def _report_results(self):
        """Report validation results."""
        logger.info("\n📋 Schema Validation Results:")
        
        if not self.errors and not self.warnings:
            logger.info("🎉 Schema validation passed with no issues!")
        else:
            if self.errors:
                logger.error(f"❌ Found {len(self.errors)} errors:")
                for error in self.errors:
                    logger.error(f"   - {error}")
            
            if self.warnings:
                logger.warning(f"⚠️  Found {len(self.warnings)} warnings:")
                for warning in self.warnings:
                    logger.warning(f"   - {warning}")
    
    # Helper methods
    async def _table_exists(self, schema: str, table: str) -> bool:
        query = text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = :schema AND table_name = :table
            )
        """)
        result = await self.session.execute(query, {"schema": schema, "table": table})
        return result.scalar()
    
    async def _get_column_type(self, schema: str, table: str, column: str) -> Optional[str]:
        query = text("""
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_schema = :schema AND table_name = :table AND column_name = :column
        """)
        result = await self.session.execute(query, {"schema": schema, "table": table, "column": column})
        row = result.fetchone()
        return row[0] if row else None
    
    async def _index_exists(self, schema: str, table: str, index_name: str) -> bool:
        query = text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = :schema AND tablename = :table AND indexname = :index
            )
        """)
        result = await self.session.execute(query, {"schema": schema, "table": table, "index": index_name})
        return result.scalar()
    
    async def _foreign_key_exists(self, schema: str, table: str, column: str, ref_table: str, ref_column: str) -> bool:
        query = text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = :schema AND tc.table_name = :table
                AND kcu.column_name = :column
            )
        """)
        result = await self.session.execute(query, {"schema": schema, "table": table, "column": column})
        return result.scalar()
    
    async def _composite_index_exists(self, schema: str, table: str, columns: List[str]) -> bool:
        # This is a simplified check - in practice you'd want to check if an index covers these columns
        query = text("""
            SELECT COUNT(*) > 0
            FROM pg_indexes 
            WHERE schemaname = :schema AND tablename = :table
            AND indexdef LIKE :pattern
        """)
        pattern = f"%{columns[0]}%" + f"%{columns[1]}%"
        result = await self.session.execute(query, {"schema": schema, "table": table, "pattern": pattern})
        return result.scalar()
    
    def _types_compatible(self, actual: str, expected: str) -> bool:
        """Check if database types are compatible."""
        # Handle common type variations
        type_mappings = {
            'character varying': ['varchar', 'character varying'],
            'timestamp with time zone': ['timestamptz', 'timestamp with time zone'],
            'boolean': ['bool', 'boolean']
        }
        
        if expected in type_mappings:
            return actual in type_mappings[expected]
        
        return actual == expected


async def run_validation():
    """Run the schema validation."""
    logger.info("🚀 Starting FHIR schema validation...")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with engine.begin() as conn:
            session = AsyncSession(bind=conn)
            validator = SchemaValidator(session)
            
            success = await validator.validate_all()
            
            if success:
                logger.info("✅ Schema validation completed successfully!")
                return True
            else:
                logger.error("❌ Schema validation failed!")
                return False
                
    except Exception as e:
        logger.error(f"❌ Validation failed with error: {e}")
        return False
    finally:
        await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(run_validation())
    sys.exit(0 if success else 1)