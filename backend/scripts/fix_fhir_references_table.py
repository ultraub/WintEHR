#!/usr/bin/env python3
"""
Fix missing fhir.references table and update FHIR schema.
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

async def fix_references_table():
    """Create missing fhir.references table and fix schema issues."""
    print("🔧 Fixing FHIR References Table")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db')
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # Check if references table exists
        result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' 
                AND table_name = 'references'
            )
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            print("❌ fhir.references table missing")
            
            # Create references table
            await conn.execute(text("""
                CREATE TABLE fhir.references (
                    id BIGSERIAL PRIMARY KEY,
                    source_id BIGINT REFERENCES fhir.resources(id) ON DELETE CASCADE,
                    source_type VARCHAR(50) NOT NULL,
                    target_type VARCHAR(50),
                    target_id VARCHAR(64),
                    reference_path VARCHAR(255) NOT NULL,
                    reference_value TEXT NOT NULL
                )
            """))
            print("✅ Created table: fhir.references")
            
            # Create indexes for references
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_references_source 
                ON fhir.references(source_id)
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_references_target 
                ON fhir.references(target_type, target_id)
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_references_path 
                ON fhir.references(reference_path)
            """))
            
            print("✅ Created indexes for references table")
            
        else:
            print("✅ fhir.references table already exists")
        
        # Grant permissions
        await conn.execute(text("GRANT ALL ON SCHEMA fhir TO emr_user"))
        await conn.execute(text("GRANT ALL ON ALL TABLES IN SCHEMA fhir TO emr_user"))
        await conn.execute(text("GRANT ALL ON ALL SEQUENCES IN SCHEMA fhir TO emr_user"))
        
        print("✅ Updated permissions")
    
    await engine.dispose()
    print("\n✅ FHIR references table fixed!")

if __name__ == "__main__":
    asyncio.run(fix_references_table())