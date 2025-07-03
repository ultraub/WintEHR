#!/usr/bin/env python3
"""
Clear all FHIR resources from the database.
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db_session

async def clear_database():
    """Clear all FHIR resources from the database."""
    print("🗑️  Clearing FHIR Database")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db')
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # Clear tables in reverse dependency order
        tables = [
            'fhir.references',
            'fhir.search_params',
            'fhir.resource_history',
            'fhir.resources'
        ]
        
        for table in tables:
            result = await conn.execute(text(f"DELETE FROM {table}"))
            print(f"  Cleared {table}: {result.rowcount} rows deleted")
        
        # Get resource counts
        result = await conn.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            GROUP BY resource_type
        """))
        
        remaining = result.fetchall()
        if not remaining:
            print("\n✅ Database cleared successfully!")
        else:
            print("\n⚠️  Warning: Some resources remain:")
            for resource_type, count in remaining:
                print(f"  {resource_type}: {count}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clear_database())