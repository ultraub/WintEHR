#!/usr/bin/env python3
"""Check import progress by counting resources in the database."""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
from database import DATABASE_URL

async def check_progress():
    """Check current resource count in database."""
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with AsyncSession(engine) as session:
            # Count total resources
            result = await session.execute(text("""
                SELECT COUNT(*) as total,
                       COUNT(DISTINCT CASE WHEN resource_type = 'Patient' THEN fhir_id END) as patients
                FROM fhir.resources
                WHERE NOT deleted
            """))
            row = result.fetchone()
            
            print(f"Total resources in database: {row.total:,}")
            print(f"Total patients in database: {row.patients:,}")
            
            # Count by type
            result = await session.execute(text("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                WHERE NOT deleted
                GROUP BY resource_type
                ORDER BY count DESC
                LIMIT 10
            """))
            
            print("\nTop resource types:")
            for res_type, count in result:
                print(f"  {res_type}: {count:,}")
                
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_progress())