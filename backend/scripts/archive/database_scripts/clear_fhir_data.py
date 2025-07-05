#!/usr/bin/env python3
"""
Clear all FHIR data from the database.
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def clear_fhir_data():
    """Clear all FHIR data from the database."""
    print("🗑️  Clearing FHIR Data")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db')
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # Clear tables in reverse dependency order
        tables = [
            'fhir.search_params',
            'fhir.resource_history',
            'fhir.resources'
        ]
        
        for table in tables:
            try:
                result = await conn.execute(text(f"DELETE FROM {table}"))
                print(f"  ✓ Cleared {table}: {result.rowcount} rows deleted")
            except Exception as e:
                print(f"  ✗ Error clearing {table}: {e}")
        
        # Reset sequences
        try:
            await conn.execute(text("ALTER SEQUENCE fhir.resources_id_seq RESTART WITH 1"))
            print("  ✓ Reset ID sequences")
        except:
            pass
            
        print("\n✅ Database cleared successfully!")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clear_fhir_data())