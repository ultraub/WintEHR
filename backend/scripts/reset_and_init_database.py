#!/usr/bin/env python3
"""
Reset and Initialize Database for FHIR Storage

This script:
1. Drops and recreates the database
2. Creates FHIR schema and tables
3. Sets up search parameters and indexes
4. Grants appropriate permissions
"""

import asyncio
import sys
import os
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))


def reset_database():
    """Drop and recreate the database."""
    print("🗄️  Resetting Database")
    print("=" * 60)
    
    # Connection parameters
    DB_USER = os.getenv('DB_USER', 'emr_user')
    DB_PASS = os.getenv('DB_PASS', 'emr_password')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'emr_db')
    
    # Connect to postgres database to drop/create
    try:
        # First try with the owner user (robertbarrett)
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database='postgres',
            user='robertbarrett'  # Database owner
        )
    except:
        # Fallback to emr_user
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database='postgres',
            user=DB_USER,
            password=DB_PASS
        )
    
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    try:
        # Drop existing database
        print("  🗑️  Dropping existing database...")
        cur.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
        print("  ✅ Database dropped")
        
        # Create new database
        print("  🆕 Creating new database...")
        cur.execute(f"CREATE DATABASE {DB_NAME};")
        print("  ✅ Database created")
        
        # Grant privileges
        print("  🔐 Granting privileges...")
        cur.execute(f"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};")
        print("  ✅ Privileges granted")
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False
    finally:
        cur.close()
        conn.close()
    
    return True


async def init_fhir_schema():
    """Initialize FHIR schema and tables."""
    print("\n🏥 Initializing FHIR Schema")
    print("=" * 60)
    
    DATABASE_URL = os.getenv(
        'DATABASE_URL',
        'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db'
    )
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        # Create FHIR schema
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS fhir;"))
        print("  ✅ Created schema: fhir")
        
        # Create resources table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resources (
                id SERIAL PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                fhir_id VARCHAR(255) NOT NULL,
                version_id INTEGER NOT NULL DEFAULT 1,
                last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resource JSONB NOT NULL,
                deleted BOOLEAN DEFAULT FALSE,
                UNIQUE(resource_type, fhir_id)
            )
        """))
        
        # Create indexes for resources table
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_resources_fhir_id ON fhir.resources(fhir_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_resources_updated ON fhir.resources(last_updated);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_resources_jsonb ON fhir.resources USING gin(resource);"))
        
        print("  ✅ Created table: fhir.resources")
        
        # Create resource history table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resource_history (
                id SERIAL PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                fhir_id VARCHAR(255) NOT NULL,
                version_id INTEGER NOT NULL,
                operation VARCHAR(20) NOT NULL,
                resource JSONB NOT NULL,
                modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                modified_by VARCHAR(255)
            )
        """))
        
        # Create indexes for history table
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_history_resource ON fhir.resource_history(resource_type, fhir_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_history_version ON fhir.resource_history(version_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_history_modified ON fhir.resource_history(modified_at);"))
        
        print("  ✅ Created table: fhir.resource_history")
        
        # Create search parameters table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.search_params (
                id SERIAL PRIMARY KEY,
                resource_id INTEGER NOT NULL,
                param_name VARCHAR(100) NOT NULL,
                param_type VARCHAR(20) NOT NULL,
                value_string TEXT,
                value_number NUMERIC,
                value_date DATE,
                value_token_system VARCHAR(500),
                value_token_code VARCHAR(500),
                value_reference VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Create indexes for search parameters
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_name ON fhir.search_params(param_name);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_string ON fhir.search_params(value_string);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_number ON fhir.search_params(value_number);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_date ON fhir.search_params(value_date);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(value_token_system, value_token_code);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(value_reference);"))
        
        print("  ✅ Created table: fhir.search_params")
        
        # Create search parameters definition table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.search_parameters (
                id SERIAL PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(20) NOT NULL,
                expression TEXT,
                description TEXT,
                UNIQUE(resource_type, name)
            )
        """))
        
        # Create index for search parameter lookups
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_parameters_lookup ON fhir.search_parameters(resource_type, name);"))
        
        print("  ✅ Created table: fhir.search_parameters")
        
        # Grant permissions
        await conn.execute(text("GRANT ALL ON SCHEMA fhir TO emr_user;"))
        await conn.execute(text("GRANT ALL ON ALL TABLES IN SCHEMA fhir TO emr_user;"))
        await conn.execute(text("GRANT ALL ON ALL SEQUENCES IN SCHEMA fhir TO emr_user;"))
        
        print("  ✅ Granted permissions to emr_user")
    
    await engine.dispose()
    print("\n✅ FHIR schema initialized successfully!")


async def main():
    """Main entry point."""
    print("🚀 Database Reset and Initialization")
    print("=" * 60)
    
    # Step 1: Reset database
    if not reset_database():
        print("\n❌ Failed to reset database")
        return
    
    # Step 2: Initialize FHIR schema
    await init_fhir_schema()
    
    print("\n🎉 Database setup completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())