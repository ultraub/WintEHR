#!/usr/bin/env python3
"""
Initialize FHIR database schema for PostgreSQL.
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

async def init_schema():
    """Initialize FHIR database schema."""
    print("🏥 Initializing FHIR Database Schema")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db')
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # Create schema
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS fhir"))
        print("✅ Created schema: fhir")
        
        # Create resources table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resources (
                id BIGSERIAL PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                fhir_id VARCHAR(64) NOT NULL,
                version_id INTEGER NOT NULL DEFAULT 1,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
                resource JSONB NOT NULL,
                deleted BOOLEAN DEFAULT FALSE,
                UNIQUE(resource_type, fhir_id)
            )
        """))
        print("✅ Created table: fhir.resources")
        
        # Create indexes
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_type 
            ON fhir.resources(resource_type)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fhir_id 
            ON fhir.resources(fhir_id)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_last_updated 
            ON fhir.resources(last_updated)
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_gin 
            ON fhir.resources USING GIN (resource)
        """))
        
        print("✅ Created indexes")
        
        # Create history table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resource_history (
                id BIGSERIAL PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                fhir_id VARCHAR(64) NOT NULL,
                version_id INTEGER NOT NULL,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
                resource JSONB NOT NULL,
                operation VARCHAR(10) NOT NULL,
                transaction_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(resource_type, fhir_id, version_id)
            )
        """))
        print("✅ Created table: fhir.resource_history")
        
        # Create search parameters table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.search_parameters (
                id BIGSERIAL PRIMARY KEY,
                resource_id BIGINT REFERENCES fhir.resources(id) ON DELETE CASCADE,
                resource_type VARCHAR(50) NOT NULL,
                parameter_name VARCHAR(100) NOT NULL,
                parameter_value TEXT NOT NULL,
                parameter_type VARCHAR(20) NOT NULL
            )
        """))
        print("✅ Created table: fhir.search_parameters")
        
        # Create index on search parameters
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_search_params 
            ON fhir.search_parameters(resource_type, parameter_name, parameter_value)
        """))
        
        print("✅ Created search parameter indexes")
        
        # Grant permissions
        await conn.execute(text("GRANT ALL ON SCHEMA fhir TO emr_user"))
        await conn.execute(text("GRANT ALL ON ALL TABLES IN SCHEMA fhir TO emr_user"))
        await conn.execute(text("GRANT ALL ON ALL SEQUENCES IN SCHEMA fhir TO emr_user"))
        await conn.execute(text("ALTER DEFAULT PRIVILEGES IN SCHEMA fhir GRANT ALL ON TABLES TO emr_user"))
        await conn.execute(text("ALTER DEFAULT PRIVILEGES IN SCHEMA fhir GRANT ALL ON SEQUENCES TO emr_user"))
        
        print("✅ Granted permissions to emr_user")
    
    await engine.dispose()
    print("\n✅ Database schema initialized successfully!")

if __name__ == "__main__":
    asyncio.run(init_schema())