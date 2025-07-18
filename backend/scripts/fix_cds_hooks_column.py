#!/usr/bin/env python3
"""
Fix CDS Hooks Column Name Mismatch
Renames 'enabled' column to 'is_active' to match code expectations
"""

import asyncio
import asyncpg
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_cds_hooks_column():
    """Fix the column name mismatch in cds_hooks.hook_configurations table"""
    
    # Database connection
    conn = await asyncpg.connect(
        host='postgres',
        port=5432,
        user='emr_user',
        password='emr_password',
        database='emr_db'
    )
    
    try:
        # Check if the table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'cds_hooks' 
                AND table_name = 'hook_configurations'
            )
        """)
        
        if not table_exists:
            logger.info("Table cds_hooks.hook_configurations does not exist. It will be created when needed.")
            return
        
        # Check current columns
        columns = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'cds_hooks' 
            AND table_name = 'hook_configurations'
            ORDER BY ordinal_position
        """)
        
        column_names = [col['column_name'] for col in columns]
        logger.info(f"Current columns: {column_names}")
        
        # Check if we need to rename the column
        if 'enabled' in column_names and 'is_active' not in column_names:
            logger.info("Renaming 'enabled' column to 'is_active'...")
            await conn.execute("""
                ALTER TABLE cds_hooks.hook_configurations 
                RENAME COLUMN enabled TO is_active
            """)
            logger.info("Column renamed successfully")
            
        elif 'is_active' in column_names:
            logger.info("Column 'is_active' already exists. No changes needed.")
            
        else:
            # Neither column exists, add is_active
            logger.info("Adding 'is_active' column...")
            await conn.execute("""
                ALTER TABLE cds_hooks.hook_configurations 
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
            """)
            logger.info("Column added successfully")
        
        # Verify the change
        columns_after = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'cds_hooks' 
            AND table_name = 'hook_configurations'
            AND column_name IN ('enabled', 'is_active')
        """)
        
        logger.info(f"Columns after migration: {[col['column_name'] for col in columns_after]}")
        
        # Update any existing records to ensure they have is_active set
        await conn.execute("""
            UPDATE cds_hooks.hook_configurations 
            SET is_active = true 
            WHERE is_active IS NULL
        """)
        
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_cds_hooks_column())