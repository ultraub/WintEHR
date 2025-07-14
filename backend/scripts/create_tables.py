#!/usr/bin/env python3
"""
Simple script to create the necessary database tables for WintEHR
"""

import asyncio
import os
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def create_tables():
    """Create the necessary database tables."""
    
    # Get database URL and convert to asyncpg format
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/emr_db")
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    
    print(f"Connecting to database: {db_url}")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(db_url)
        
        # Create schemas
        await conn.execute("CREATE SCHEMA IF NOT EXISTS fhir")
        await conn.execute("CREATE SCHEMA IF NOT EXISTS cds_hooks")
        print("✅ Created schemas")
        
        # Create main FHIR resources table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fhir.resources (
                id SERIAL PRIMARY KEY,
                resource_type VARCHAR(255) NOT NULL,
                fhir_id VARCHAR(255) NOT NULL,
                version_id INTEGER NOT NULL DEFAULT 1,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                resource JSONB NOT NULL,
                deleted BOOLEAN DEFAULT FALSE,
                UNIQUE(resource_type, fhir_id)
            )
        """)
        print("✅ Created fhir.resources table")
        
        # Create indices
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_resources_fhir_id ON fhir.resources(fhir_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_resources_last_updated ON fhir.resources(last_updated)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_resources_deleted ON fhir.resources(deleted)")
        print("✅ Created indices")
        
        # Create search parameters table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fhir.search_parameters (
                id SERIAL PRIMARY KEY,
                resource_id INTEGER REFERENCES fhir.resources(id) ON DELETE CASCADE,
                resource_type VARCHAR(255) NOT NULL,
                param_name VARCHAR(255) NOT NULL,
                param_value TEXT,
                param_type VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        print("✅ Created search_parameters table")
        
        # Create search indices
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_search_resource_type ON fhir.search_parameters(resource_type)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_search_param_name ON fhir.search_parameters(param_name)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_search_param_value ON fhir.search_parameters(param_value)")
        print("✅ Created search indices")
        
        # Create public view for backward compatibility
        await conn.execute("""
            CREATE OR REPLACE VIEW public.fhir_resources AS
            SELECT * FROM fhir.resources
        """)
        print("✅ Created public view")
        
        # Close connection
        await conn.close()
        print("\n✅ Database initialization complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(create_tables())
