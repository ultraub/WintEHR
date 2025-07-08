#!/usr/bin/env python3
"""
Database Schema Validation Script

This script validates that all database tables have consistent column types
and proper foreign key relationships, particularly checking for UUID vs INTEGER
inconsistencies.

Usage:
    python scripts/validate_database_schema.py
"""

import asyncio
import asyncpg
import sys
import logging


async def validate_schema():
    """Validate database schema consistency."""
    
    logging.info("🔍 Validating MedGenEMR Database Schema")
    logging.info("=" * 50)
    try:
        # Connect to database
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
        
        validation_errors = []
        
        # Check 1: Validate fhir.resources table structure
        logging.info("📋 Checking fhir.resources table...")
        resources_schema = await conn.fetch("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' AND table_name = 'resources'
            ORDER BY ordinal_position
        """)
        
        resources_columns = {row['column_name']: row['data_type'] for row in resources_schema}
        
        if 'id' not in resources_columns:
            validation_errors.append("❌ fhir.resources missing 'id' column")
        elif resources_columns['id'] not in ('integer', 'bigint'):
            validation_errors.append(f"❌ fhir.resources.id has wrong type: {resources_columns['id']} (should be integer/bigint)")
        else:
            logging.info(f"   ✅ resources.id: {resources_columns['id']}")
        # Check 2: Validate fhir.search_params table structure
        logging.info("📋 Checking fhir.search_params table...")
        search_params_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'search_params'
            )
        """)
        
        if not search_params_exists:
            validation_errors.append("❌ fhir.search_params table does not exist")
        else:
            search_params_schema = await conn.fetch("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'fhir' AND table_name = 'search_params'
                ORDER BY ordinal_position
            """)
            
            search_params_columns = {row['column_name']: row['data_type'] for row in search_params_schema}
            
            # Check resource_id type consistency
            if 'resource_id' not in search_params_columns:
                validation_errors.append("❌ fhir.search_params missing 'resource_id' column")
            elif search_params_columns['resource_id'] == 'uuid':
                validation_errors.append(f"❌ CRITICAL: fhir.search_params.resource_id is UUID but should be INTEGER/BIGINT to match fhir.resources.id")
            elif search_params_columns['resource_id'] in ('integer', 'bigint'):
                logging.info(f"   ✅ search_params.resource_id: {search_params_columns['resource_id']}")
            else:
                validation_errors.append(f"❌ fhir.search_params.resource_id has unexpected type: {search_params_columns['resource_id']}")
            
            # Check other required columns
            required_columns = ['resource_type', 'param_name', 'param_type']
            for col in required_columns:
                if col not in search_params_columns:
                    validation_errors.append(f"❌ fhir.search_params missing '{col}' column")
                else:
                    logging.info(f"   ✅ search_params.{col}: {search_params_columns[col]}")
        # Check 3: Validate fhir.resource_history table structure
        logging.info("📋 Checking fhir.resource_history table...")
        history_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' AND table_name = 'resource_history'
            )
        """)
        
        if not history_exists:
            validation_errors.append("❌ fhir.resource_history table does not exist")
        else:
            history_schema = await conn.fetch("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'fhir' AND table_name = 'resource_history'
                ORDER BY ordinal_position
            """)
            
            history_columns = {row['column_name']: row['data_type'] for row in history_schema}
            
            # Check resource_id type consistency
            if 'resource_id' not in history_columns:
                validation_errors.append("❌ fhir.resource_history missing 'resource_id' column")
            elif history_columns['resource_id'] in ('integer', 'bigint'):
                logging.info(f"   ✅ resource_history.resource_id: {history_columns['resource_id']}")
            else:
                validation_errors.append(f"❌ fhir.resource_history.resource_id has wrong type: {history_columns['resource_id']}")
        
        # Check 4: Validate foreign key constraints
        logging.info("📋 Checking foreign key constraints...")
        foreign_keys = await conn.fetch("""
            SELECT 
                tc.table_name, 
                kcu.column_name, 
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
            AND tc.table_schema = 'fhir'
            AND tc.table_name IN ('search_params', 'resource_history')
        """)
        
        expected_fks = {
            'search_params': ('resource_id', 'resources', 'id'),
            'resource_history': ('resource_id', 'resources', 'id')
        }
        
        found_fks = {}
        for fk in foreign_keys:
            table = fk['table_name']
            if table not in found_fks:
                found_fks[table] = []
            found_fks[table].append((fk['column_name'], fk['foreign_table_name'], fk['foreign_column_name']))
        
        for table, (col, ref_table, ref_col) in expected_fks.items():
            if table not in found_fks or (col, ref_table, ref_col) not in found_fks[table]:
                validation_errors.append(f"❌ Missing foreign key: {table}.{col} -> {ref_table}.{ref_col}")
            else:
                logging.info(f"   ✅ Foreign key: {table}.{col} -> {ref_table}.{ref_col}")
        # Check 5: Validate indexes exist
        logging.info("📋 Checking important indexes...")
        indexes = await conn.fetch("""
            SELECT indexname, tablename 
            FROM pg_indexes 
            WHERE schemaname = 'fhir'
            AND indexname LIKE 'idx_%'
        """)
        
        important_indexes = [
            'idx_resources_type',
            'idx_search_params_resource',
            'idx_resource_history_resource_id'
        ]
        
        found_indexes = [idx['indexname'] for idx in indexes]
        for idx in important_indexes:
            if idx in found_indexes:
                logging.info(f"   ✅ Index exists: {idx}")
            else:
                validation_errors.append(f"⚠️  Missing recommended index: {idx}")
        
        # Summary
        logging.info(f"\n📊 Schema Validation Summary")
        logging.info("=" * 30)
        if validation_errors:
            logging.error(f"❌ Found {len(validation_errors)} issues:")
            for error in validation_errors:
                logging.error(f"   {error}")
            logging.info(f"\n🔧 Run 'python scripts/init_database_complete.py' to fix schema issues")
            return False
        else:
            logging.info("✅ All schema validations passed!")
            logging.info("✅ Database schema is consistent and properly configured")
            return True
        
        await conn.close()
        
    except Exception as e:
        logging.info(f"❌ Validation failed: {e}")
        return False

if __name__ == '__main__':
    success = asyncio.run(validate_schema())
    sys.exit(0 if success else 1)