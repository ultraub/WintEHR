#!/usr/bin/env python3
"""
Fix CDS Hooks execution_log table schema.

Adds missing columns that the application expects:
- service_id (maps to hook_id)
- hook_type 
- request_data
- response_data
- cards_returned
- success
"""

import asyncio
import asyncpg
import os
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://emr_user:emr_password@localhost:5432/emr_db"
)

# Convert SQLAlchemy URL to asyncpg format
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

async def fix_execution_log_schema():
    """Add missing columns to execution_log table."""
    
    logger.info("CDS Hooks Execution Log Schema Fix")
    logger.info("=" * 50)
    
    # Connect to database
    conn = await asyncpg.connect(DATABASE_URL)
    logger.info("Connected to database")
    
    try:
        # Check current columns
        current_columns = await conn.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'cds_hooks' 
            AND table_name = 'execution_log'
        """)
        
        column_names = {col['column_name'] for col in current_columns}
        logger.info(f"Current columns: {column_names}")
        
        # Add missing columns
        columns_to_add = [
            ("service_id", "VARCHAR(255)"),
            ("hook_type", "VARCHAR(100)"),
            ("request_data", "JSONB"),
            ("response_data", "JSONB"),
            ("cards_returned", "INTEGER DEFAULT 0"),
            ("success", "BOOLEAN DEFAULT TRUE")
        ]
        
        for column_name, column_type in columns_to_add:
            if column_name not in column_names:
                logger.info(f"Adding '{column_name}' column...")
                await conn.execute(f"""
                    ALTER TABLE cds_hooks.execution_log 
                    ADD COLUMN IF NOT EXISTS {column_name} {column_type}
                """)
                logger.info(f"Successfully added '{column_name}' column")
            else:
                logger.info(f"Column '{column_name}' already exists")
        
        # If service_id was added, copy data from hook_id
        if 'service_id' not in column_names and 'hook_id' in column_names:
            logger.info("Copying hook_id values to service_id...")
            await conn.execute("""
                UPDATE cds_hooks.execution_log 
                SET service_id = hook_id 
                WHERE service_id IS NULL
            """)
            logger.info("Copied hook_id values to service_id")
        
        # Create index on service_id if it doesn't exist
        logger.info("Creating index on service_id...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_cds_hooks_log_service 
            ON cds_hooks.execution_log(service_id)
        """)
        logger.info("Index created successfully")
        
        # Show final table structure
        final_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'cds_hooks' 
            AND table_name = 'execution_log'
            ORDER BY ordinal_position
        """)
        
        logger.info("\nFinal execution_log table structure:")
        for col in final_columns:
            logger.info(f"  {col['column_name']}: {col['data_type']} "
                       f"(nullable: {col['is_nullable']}, default: {col['column_default']})")
        
        logger.info("\n✅ Schema fix completed successfully")
        
    except Exception as e:
        logger.error(f"Error fixing schema: {e}")
        raise
    finally:
        await conn.close()
        logger.info("Disconnected from database")

if __name__ == "__main__":
    asyncio.run(fix_execution_log_schema())