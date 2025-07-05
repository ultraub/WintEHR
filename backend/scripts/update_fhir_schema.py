#!/usr/bin/env python3
"""
Update FHIR database schema to match current code.
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

async def update_schema():
    """Update FHIR database schema."""
    print("🏥 Updating FHIR Database Schema")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db')
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # Drop old resource_history table and create new one with resource_id
        print("Updating resource_history table...")
        await conn.execute(text("DROP TABLE IF EXISTS fhir.resource_history CASCADE"))
        await conn.execute(text("""
            CREATE TABLE fhir.resource_history (
                id BIGSERIAL PRIMARY KEY,
                resource_id UUID NOT NULL,
                version_id INTEGER NOT NULL,
                operation VARCHAR(10) NOT NULL,
                resource JSONB NOT NULL,
                transaction_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("✅ Updated table: fhir.resource_history")
        
        # Create search_params table (rename from search_parameters)
        print("Creating search_params table...")
        await conn.execute(text("DROP TABLE IF EXISTS fhir.search_parameters CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS fhir.search_params CASCADE"))
        await conn.execute(text("""
            CREATE TABLE fhir.search_params (
                id BIGSERIAL PRIMARY KEY,
                resource_id UUID NOT NULL,
                param_name VARCHAR(100) NOT NULL,
                param_type VARCHAR(20) NOT NULL,
                value_string TEXT,
                value_number NUMERIC,
                value_date TIMESTAMP WITH TIME ZONE,
                value_token_system TEXT,
                value_token_code TEXT
            )
        """))
        print("✅ Created table: fhir.search_params")
        
        # Create references table
        print("Creating references table...")
        await conn.execute(text("DROP TABLE IF EXISTS fhir.references CASCADE"))
        await conn.execute(text("""
            CREATE TABLE fhir.references (
                id BIGSERIAL PRIMARY KEY,
                source_id UUID NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(64) NOT NULL,
                reference_path TEXT NOT NULL
            )
        """))
        print("✅ Created table: fhir.references")
        
        # Create indexes
        print("Creating indexes...")
        await conn.execute(text("""
            CREATE INDEX idx_search_params_resource 
            ON fhir.search_params(resource_id)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_search_params_name 
            ON fhir.search_params(param_name)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_search_params_composite 
            ON fhir.search_params(resource_id, param_name)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_references_source 
            ON fhir.references(source_id)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_references_target 
            ON fhir.references(target_type, target_id)
        """))
        await conn.execute(text("""
            CREATE INDEX idx_resource_history_resource 
            ON fhir.resource_history(resource_id)
        """))
        print("✅ Created indexes")
        
        print("\n✅ Schema update complete!")

if __name__ == "__main__":
    asyncio.run(update_schema())