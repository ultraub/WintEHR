#!/usr/bin/env python3
"""
Fix CDS Hooks table by adding missing 'enabled' column.

This script adds the 'enabled' column to the cds_hooks.hook_configurations table
if it doesn't already exist. This fixes the error:
"column 'enabled' does not exist"

Usage:
    python fix_cds_hooks_enabled_column.py
"""

import asyncio
import asyncpg
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def fix_cds_hooks_schema():
    """Add missing 'enabled' column to CDS hooks table."""
    
    conn = None
    try:
        # Connect to database
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
        logger.info("Connected to database")
        
        # Check if the table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'cds_hooks' 
                AND table_name = 'hook_configurations'
            )
        """)
        
        if not table_exists:
            logger.error("Table cds_hooks.hook_configurations does not exist")
            return False
        
        # Check if 'enabled' column already exists
        column_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'cds_hooks' 
                AND table_name = 'hook_configurations'
                AND column_name = 'enabled'
            )
        """)
        
        if column_exists:
            logger.info("Column 'enabled' already exists in cds_hooks.hook_configurations")
            return True
        
        # Add the 'enabled' column
        logger.info("Adding 'enabled' column to cds_hooks.hook_configurations...")
        
        await conn.execute("""
            ALTER TABLE cds_hooks.hook_configurations 
            ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true
        """)
        
        logger.info("Successfully added 'enabled' column")
        
        # Update existing records to be enabled by default
        updated = await conn.fetchval("""
            UPDATE cds_hooks.hook_configurations 
            SET enabled = true 
            WHERE enabled IS NULL
            RETURNING COUNT(*)
        """)
        
        if updated:
            logger.info(f"Updated {updated} existing records to enabled=true")
        
        # Try to create the index that was failing
        try:
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_cds_hooks_config_active 
                ON cds_hooks.hook_configurations(enabled)
            """)
            logger.info("Successfully created index on 'enabled' column")
        except Exception as e:
            logger.warning(f"Could not create index: {e}")
        
        # Verify the fix
        column_info = await conn.fetchrow("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'cds_hooks'
            AND table_name = 'hook_configurations'
            AND column_name = 'enabled'
        """)
        
        if column_info:
            logger.info(f"Column details: {dict(column_info)}")
            return True
        else:
            logger.error("Failed to verify column creation")
            return False
        
    except Exception as e:
        logger.error(f"Error fixing CDS hooks schema: {e}")
        return False
    
    finally:
        if conn:
            await conn.close()
            logger.info("Disconnected from database")


async def verify_cds_hooks():
    """Verify CDS hooks table structure."""
    
    conn = None
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
        
        # Get all columns
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'cds_hooks'
            AND table_name = 'hook_configurations'
            ORDER BY ordinal_position
        """)
        
        logger.info("\nCDS Hooks table structure:")
        for col in columns:
            logger.info(f"  {col['column_name']}: {col['data_type']} "
                       f"(nullable: {col['is_nullable']}, default: {col['column_default']})")
        
        # Check sample data
        count = await conn.fetchval("""
            SELECT COUNT(*) FROM cds_hooks.hook_configurations
        """)
        
        enabled_count = await conn.fetchval("""
            SELECT COUNT(*) FROM cds_hooks.hook_configurations WHERE enabled = true
        """)
        
        logger.info(f"\nTotal hooks: {count}")
        logger.info(f"Enabled hooks: {enabled_count}")
        
    except Exception as e:
        logger.error(f"Error verifying CDS hooks: {e}")
    
    finally:
        if conn:
            await conn.close()


async def main():
    """Main entry point."""
    logger.info("CDS Hooks Schema Fix")
    logger.info("=" * 50)
    
    # Fix the schema
    success = await fix_cds_hooks_schema()
    
    if success:
        logger.info("\n✅ Schema fix completed successfully")
        
        # Verify the fix
        await verify_cds_hooks()
    else:
        logger.error("\n❌ Schema fix failed")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())