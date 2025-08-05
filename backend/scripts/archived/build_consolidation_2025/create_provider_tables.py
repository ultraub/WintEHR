#!/usr/bin/env python3
"""
Create the Provider and related tables needed for authentication
"""

import asyncio
import os
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def create_provider_tables():
    """Create the Provider and related tables."""
    
    # Get database URL and convert to asyncpg format
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/emr_db")
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    
    print(f"Connecting to database: {db_url}")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(db_url)
        
        # Create organizations table first (referenced by providers)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id VARCHAR PRIMARY KEY,
                synthea_id VARCHAR UNIQUE,
                name VARCHAR NOT NULL,
                type VARCHAR,
                address VARCHAR,
                city VARCHAR,
                state VARCHAR,
                zip_code VARCHAR,
                phone VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        print("✅ Created organizations table")
        
        # Create providers table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS providers (
                id VARCHAR PRIMARY KEY,
                synthea_id VARCHAR UNIQUE,
                npi VARCHAR UNIQUE,
                dea VARCHAR,
                state_license VARCHAR,
                prefix VARCHAR,
                first_name VARCHAR NOT NULL,
                middle_name VARCHAR,
                last_name VARCHAR NOT NULL,
                suffix VARCHAR,
                address VARCHAR,
                city VARCHAR,
                state VARCHAR,
                zip_code VARCHAR,
                phone VARCHAR,
                email VARCHAR,
                specialty VARCHAR,
                organization_id VARCHAR REFERENCES organizations(id),
                active BOOLEAN DEFAULT TRUE,
                fhir_json JSONB,
                fhir_meta JSONB,
                extensions JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        print("✅ Created providers table")
        
        # Create indices
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_provider_name ON providers(last_name, first_name);
            CREATE INDEX IF NOT EXISTS idx_provider_specialty ON providers(specialty);
            CREATE INDEX IF NOT EXISTS idx_provider_org ON providers(organization_id);
            CREATE INDEX IF NOT EXISTS idx_provider_active ON providers(active);
        """)
        print("✅ Created provider indices")
        
        # Create user_sessions table for authentication
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                provider_id VARCHAR REFERENCES providers(id),
                session_token VARCHAR UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        print("✅ Created user_sessions table")
        
        # Create patient_provider_assignments table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_provider_assignments (
                id SERIAL PRIMARY KEY,
                patient_id VARCHAR NOT NULL,
                provider_id VARCHAR REFERENCES providers(id),
                assignment_type VARCHAR,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        print("✅ Created patient_provider_assignments table")
        
        # Import existing Practitioner resources as providers
        print("\n📥 Importing Practitioner resources as providers...")
        
        # First, import organizations from FHIR
        result = await conn.fetch("""
            INSERT INTO organizations (id, synthea_id, name, type, address, city, state, zip_code, phone)
            SELECT 
                resource->>'id',
                resource->>'id',
                resource->>'name',
                resource->'type'->0->'coding'->0->>'display',
                resource->'address'->0->'line'->>0,
                resource->'address'->0->>'city',
                resource->'address'->0->>'state',
                resource->'address'->0->>'postalCode',
                resource->'telecom'->0->>'value'
            FROM fhir.resources
            WHERE resource_type = 'Organization'
            AND deleted = false
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        """)
        org_count = len(result)
        print(f"✅ Imported {org_count if org_count else 0} organizations")
        
        # Import practitioners as providers
        result = await conn.fetch("""
            INSERT INTO providers (
                id, synthea_id, first_name, last_name, 
                specialty, active, fhir_json
            )
            SELECT 
                resource->>'id',
                resource->>'id',
                COALESCE(resource->'name'->0->'given'->>0, 'Unknown'),
                COALESCE(resource->'name'->0->>'family', 'Provider'),
                resource->'qualification'->0->'code'->'coding'->0->>'display',
                COALESCE((resource->>'active')::boolean, true),
                resource
            FROM fhir.resources
            WHERE resource_type = 'Practitioner'
            AND deleted = false
            ON CONFLICT (id) DO NOTHING
            RETURNING id
        """)
        prac_count = len(result)
        print(f"✅ Imported {prac_count if prac_count else 0} practitioners as providers")
        
        # If no providers were imported, create some test providers
        if not prac_count or prac_count == 0:
            print("\n📝 Creating test providers...")
            await conn.execute("""
                INSERT INTO providers (id, first_name, last_name, specialty, active)
                VALUES 
                    ('demo-provider', 'Demo', 'Provider', 'General Practice', true),
                    ('nurse-provider', 'Nurse', 'Provider', 'Nursing', true),
                    ('pharmacist-provider', 'Pharmacist', 'Provider', 'Pharmacy', true),
                    ('admin-provider', 'Admin', 'Provider', 'Administration', true)
                ON CONFLICT (id) DO NOTHING
            """)
            print("✅ Created test providers")
        
        # Close connection
        await conn.close()
        print("\n✅ Provider tables initialization complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(create_provider_tables())
