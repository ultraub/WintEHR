#!/usr/bin/env python3
"""
Initialize only FHIR schema tables (including search_params)
This is a subset of reset_and_init_database.py that only creates FHIR tables
"""

import asyncio
import sys
import os
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

async def init_fhir_schema():
    """Initialize FHIR schema and tables."""
    print("🏥 Initializing FHIR Schema Tables")
    print("=" * 60)
    
    # Use existing database connection parameters
    DATABASE_URL = "postgresql+asyncpg://medgenemr:medgenemr@localhost:5432/medgenemr"
    
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Creating FHIR schema...")
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS fhir;"))
        
        print("Creating FHIR resources table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resources (
                id BIGSERIAL PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                fhir_id VARCHAR(64) NOT NULL,
                version_id INTEGER NOT NULL DEFAULT 1,
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                deleted BOOLEAN DEFAULT FALSE,
                resource JSONB NOT NULL,
                UNIQUE(resource_type, fhir_id, version_id)
            );
        """))
        
        print("Creating FHIR search_params table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.search_params (
                id BIGSERIAL PRIMARY KEY,
                resource_id BIGINT NOT NULL,
                param_name VARCHAR(100) NOT NULL,
                param_type VARCHAR(20) NOT NULL,
                value_string TEXT,
                value_number NUMERIC,
                value_date TIMESTAMP WITH TIME ZONE,
                value_token_system VARCHAR(500),
                value_token_code VARCHAR(500),
                value_reference VARCHAR(500),
                FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
            );
        """))
        
        print("Creating search_params indexes...")
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_name ON fhir.search_params(param_name);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_string ON fhir.search_params(value_string);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(value_token_system, value_token_code);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_params_patient ON fhir.search_params(param_name, value_string) WHERE param_name IN ('patient', 'subject');"))
        
        print("Creating FHIR references table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.references (
                id BIGSERIAL PRIMARY KEY,
                source_id BIGINT NOT NULL,
                source_type VARCHAR(50) NOT NULL,
                target_type VARCHAR(50),
                target_id VARCHAR(64),
                reference_path VARCHAR(255) NOT NULL,
                reference_value TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
            );
        """))
        
        print("Creating references indexes...")
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_references_source ON fhir.references(source_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_references_target ON fhir.references(target_type, target_id);"))
        
        print("Creating resource history table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fhir.resource_history (
                id BIGSERIAL PRIMARY KEY,
                resource_id BIGINT NOT NULL,
                version_id INTEGER NOT NULL,
                operation VARCHAR(20) NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                resource JSONB NOT NULL,
                FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
            );
        """))
        
        print("  ✅ All FHIR tables created successfully")
        
        # Check table status
        print("\nChecking table status...")
        
        # Check resources table
        result = await conn.execute(text("SELECT COUNT(*) FROM fhir.resources"))
        resources_count = result.scalar()
        print(f"  fhir.resources: {resources_count} records")
        
        # Check search_params table
        result = await conn.execute(text("SELECT COUNT(*) FROM fhir.search_params"))
        search_params_count = result.scalar()
        print(f"  fhir.search_params: {search_params_count} records")
        
        # Check references table
        result = await conn.execute(text("SELECT COUNT(*) FROM fhir.references"))
        references_count = result.scalar()
        print(f"  fhir.references: {references_count} records")
        
        print(f"\n✅ FHIR schema initialization complete!")
        
        if search_params_count == 0 and resources_count > 0:
            print(f"\n⚠️  WARNING: {resources_count} resources exist but 0 search parameters!")
            print("This explains why new resource searches are failing.")
            print("\nRecommendation: Rebuild search parameters for existing resources")
    
    await engine.dispose()

async def main():
    """Main entry point."""
    try:
        await init_fhir_schema()
        print("\n🎉 Success! FHIR tables are ready.")
        print("\nNext steps:")
        print("1. Restart the backend server")
        print("2. Test creating a new condition")
        print("3. Verify search functionality with: python test_search_params_table.py")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Please check database connection and permissions.")

if __name__ == '__main__':
    asyncio.run(main())