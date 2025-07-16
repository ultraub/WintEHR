#!/usr/bin/env python3
"""
Database Schema Validation Script for WintEHR

This script validates that all required database tables, indexes, and schemas
are properly created and configured for WintEHR deployment.

Usage:
    python scripts/validate_database_schema.py [--docker] [--verbose]
    
Options:
    --docker    Use Docker postgres hostname
    --verbose   Show detailed validation output
"""

import asyncio
import os
import asyncpg
import argparse
import sys
import os
from typing import Dict, List, Set, Tuple
import logging


class DatabaseSchemaValidator:
    """Validates WintEHR database schema"""
    
    def __init__(self, database_url: str, verbose: bool = False):
        self.database_url = database_url
        self.verbose = verbose
        self.logger = logging.getLogger(__name__)
        self.setup_logging()
        
    def setup_logging(self):
        """Setup logging configuration"""
        level = logging.DEBUG if self.verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        
    async def validate_schema(self) -> bool:
        """Validate complete database schema"""
        try:
            conn = await asyncpg.connect(self.database_url)
            
            # Run all validation checks
            checks = [
                self.validate_schemas(conn),
                self.validate_tables(conn),
                self.validate_columns(conn),
                self.validate_indexes(conn),
                self.validate_foreign_keys(conn),
                self.validate_permissions(conn),
                self.validate_data_integrity(conn)
            ]
            
            results = await asyncio.gather(*checks, return_exceptions=True)
            
            # Check if any validation failed
            all_passed = True
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    self.logger.error(f"Validation check {i+1} failed: {result}")
                    all_passed = False
                elif not result:
                    self.logger.error(f"Validation check {i+1} failed")
                    all_passed = False
                    
            await conn.close()
            
            if all_passed:
                self.logger.info("✅ All database schema validations passed")
                return True
            else:
                self.logger.error("❌ Database schema validation failed")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Database connection failed: {e}")
            return False
            
    async def validate_schemas(self, conn: asyncpg.Connection) -> bool:
        """Validate required schemas exist"""
        self.logger.info("Validating database schemas...")
        
        required_schemas = {'fhir', 'cds_hooks'}
        
        schemas = await conn.fetch("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name IN ('fhir', 'cds_hooks')
        """)
        
        existing_schemas = {row['schema_name'] for row in schemas}
        missing_schemas = required_schemas - existing_schemas
        
        if missing_schemas:
            self.logger.error(f"Missing schemas: {missing_schemas}")
            return False
            
        self.logger.info(f"✅ All required schemas present: {existing_schemas}")
        return True
        
    async def validate_tables(self, conn: asyncpg.Connection) -> bool:
        """Validate required tables exist"""
        self.logger.info("Validating database tables...")
        
        required_tables = {
            'fhir': {'resources', 'search_params', 'resource_history', 'references'},
            'cds_hooks': {'hook_configurations'}
        }
        
        all_tables_valid = True
        
        for schema, table_names in required_tables.items():
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = $1
            """, schema)
            
            existing_tables = {row['table_name'] for row in tables}
            missing_tables = table_names - existing_tables
            
            if missing_tables:
                self.logger.error(f"Missing tables in schema '{schema}': {missing_tables}")
                all_tables_valid = False
            else:
                self.logger.info(f"✅ All required tables present in schema '{schema}': {existing_tables}")
                
        return all_tables_valid
        
    async def validate_columns(self, conn: asyncpg.Connection) -> bool:
        """Validate critical columns exist in tables"""
        self.logger.info("Validating table columns...")
        
        critical_columns = {
            'fhir.resources': {
                'id', 'resource_type', 'fhir_id', 'version_id', 
                'last_updated', 'deleted', 'resource'
            },
            'fhir.search_params': {
                'id', 'resource_id', 'resource_type', 'param_name', 'param_type',
                'value_string', 'value_number', 'value_date', 'value_token',
                'value_reference', 'created_at'
            },
            'fhir.resource_history': {
                'id', 'resource_id', 'version_id', 'operation', 'resource', 'created_at'
            },
            'fhir.references': {
                'id', 'source_id', 'source_type', 'target_type', 'target_id',
                'reference_path', 'reference_value'
            }
        }
        
        all_columns_valid = True
        
        for table_name, required_cols in critical_columns.items():
            schema, table = table_name.split('.')
            
            columns = await conn.fetch("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = $1 AND table_name = $2
            """, schema, table)
            
            existing_columns = {row['column_name'] for row in columns}
            missing_columns = required_cols - existing_columns
            
            if missing_columns:
                self.logger.error(f"Missing columns in table '{table_name}': {missing_columns}")
                all_columns_valid = False
            else:
                self.logger.info(f"✅ All required columns present in table '{table_name}'")
                
        return all_columns_valid
        
    async def validate_indexes(self, conn: asyncpg.Connection) -> bool:
        """Validate critical indexes exist"""
        self.logger.info("Validating database indexes...")
        
        critical_indexes = {
            'fhir.resources': {
                'idx_resources_type', 'idx_resources_type_id', 
                'idx_resources_updated', 'idx_resources_deleted'
            },
            'fhir.search_params': {
                'idx_search_params_resource', 'idx_search_params_param_name',
                'idx_search_params_string', 'idx_search_params_token'
            }
        }
        
        # Get all indexes
        indexes = await conn.fetch("""
            SELECT schemaname, tablename, indexname
            FROM pg_indexes
            WHERE schemaname IN ('fhir', 'cds_hooks')
        """)
        
        existing_indexes = {}
        for row in indexes:
            table_key = f"{row['schemaname']}.{row['tablename']}"
            if table_key not in existing_indexes:
                existing_indexes[table_key] = set()
            existing_indexes[table_key].add(row['indexname'])
            
        all_indexes_valid = True
        
        for table_name, required_indexes in critical_indexes.items():
            table_indexes = existing_indexes.get(table_name, set())
            missing_indexes = required_indexes - table_indexes
            
            if missing_indexes:
                self.logger.warning(f"Missing indexes in table '{table_name}': {missing_indexes}")
                # Don't fail for missing indexes, just warn
            else:
                self.logger.info(f"✅ All critical indexes present in table '{table_name}'")
                
        return all_indexes_valid
        
    async def validate_foreign_keys(self, conn: asyncpg.Connection) -> bool:
        """Validate foreign key constraints exist"""
        self.logger.info("Validating foreign key constraints...")
        
        foreign_keys = await conn.fetch("""
            SELECT 
                tc.constraint_name, 
                tc.table_schema, 
                tc.table_name, 
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema IN ('fhir', 'cds_hooks')
        """)
        
        fk_count = len(foreign_keys)
        if fk_count > 0:
            self.logger.info(f"✅ Found {fk_count} foreign key constraints")
            if self.verbose:
                for fk in foreign_keys:
                    self.logger.debug(f"  {fk['table_schema']}.{fk['table_name']}.{fk['column_name']} -> {fk['foreign_table_schema']}.{fk['foreign_table_name']}.{fk['foreign_column_name']}")
            return True
        else:
            self.logger.warning("⚠️  No foreign key constraints found")
            return True  # Don't fail deployment for missing FKs
            
    async def validate_permissions(self, conn: asyncpg.Connection) -> bool:
        """Validate database permissions"""
        self.logger.info("Validating database permissions...")
        
        # Check if emr_user has necessary permissions
        try:
            # Test basic operations
            await conn.execute("SELECT 1 FROM fhir.resources LIMIT 1")
            self.logger.info("✅ Database permissions validated")
            return True
        except Exception as e:
            self.logger.error(f"❌ Permission validation failed: {e}")
            return False
            
    async def validate_data_integrity(self, conn: asyncpg.Connection) -> bool:
        """Validate data integrity constraints"""
        self.logger.info("Validating data integrity...")
        
        # Check for basic data integrity
        integrity_checks = [
            ("Resources table accessible", "SELECT COUNT(*) FROM fhir.resources"),
            ("Search params table accessible", "SELECT COUNT(*) FROM fhir.search_params"),
            ("Resource history table accessible", "SELECT COUNT(*) FROM fhir.resource_history"),
            ("References table accessible", "SELECT COUNT(*) FROM fhir.references"),
            ("CDS hooks table accessible", "SELECT COUNT(*) FROM cds_hooks.hook_configurations")
        ]
        
        all_checks_passed = True
        
        for check_name, query in integrity_checks:
            try:
                result = await conn.fetchval(query)
                self.logger.info(f"✅ {check_name}: {result} records")
            except Exception as e:
                self.logger.error(f"❌ {check_name} failed: {e}")
                all_checks_passed = False
                
        return all_checks_passed
        
    async def get_schema_summary(self, conn: asyncpg.Connection) -> Dict:
        """Get summary of database schema"""
        summary = {}
        
        # Get table counts
        tables = await conn.fetch("""
            SELECT table_schema, table_name,
                   (SELECT COUNT(*) FROM information_schema.columns 
                    WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema IN ('fhir', 'cds_hooks')
            ORDER BY table_schema, table_name
        """)
        
        summary['tables'] = [
            {
                'schema': row['table_schema'],
                'name': row['table_name'],
                'columns': row['column_count']
            }
            for row in tables
        ]
        
        # Get index counts
        indexes = await conn.fetch("""
            SELECT schemaname, COUNT(*) as index_count
            FROM pg_indexes
            WHERE schemaname IN ('fhir', 'cds_hooks')
            GROUP BY schemaname
        """)
        
        summary['indexes'] = {row['schemaname']: row['index_count'] for row in indexes}
        
        # Get row counts
        for table in summary['tables']:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table['schema']}.{table['name']}")
                table['rows'] = count
            except:
                table['rows'] = 0
                
        return summary


async def main():
    parser = argparse.ArgumentParser(description='Validate WintEHR database schema')
    parser.add_argument('--docker', action='store_true', help='Use Docker postgres hostname')
    parser.add_argument('--verbose', action='store_true', help='Show detailed validation output')
    
    args = parser.parse_args()
    
    # Determine database URL
    if args.docker:
        database_url = 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
    else:
        database_url = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@localhost:5432/emr_db')
    
    validator = DatabaseSchemaValidator(database_url, args.verbose)
    
    print("🔍 WintEHR Database Schema Validation")
    print("=" * 50)
    
    # Run validation
    success = await validator.validate_schema()
    
    if success:
        print("\n✅ Database schema validation completed successfully!")
        
        # Show summary if verbose
        if args.verbose:
            try:
                conn = await asyncpg.connect(database_url)
                summary = await validator.get_schema_summary(conn)
                await conn.close()
                
                print("\n📊 Database Schema Summary:")
                print(f"Tables: {len(summary['tables'])}")
                for table in summary['tables']:
                    print(f"  - {table['schema']}.{table['name']}: {table['columns']} columns, {table['rows']} rows")
                
                print(f"\nIndexes by schema:")
                for schema, count in summary['indexes'].items():
                    print(f"  - {schema}: {count} indexes")
                    
            except Exception as e:
                print(f"Could not generate summary: {e}")
        
        sys.exit(0)
    else:
        print("\n❌ Database schema validation failed!")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
