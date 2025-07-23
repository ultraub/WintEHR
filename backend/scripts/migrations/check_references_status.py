#!/usr/bin/env python
"""
Quick script to check references table population status
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL

async def check_status():
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    
    async with engine.connect() as conn:
        # Get current count
        result = await conn.execute(text("SELECT COUNT(*) FROM fhir.references"))
        ref_count = result.scalar()
        
        # Get resource count
        result = await conn.execute(text("""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
        """))
        resource_count = result.scalar()
        
        # Get breakdown by source type
        result = await conn.execute(text("""
            SELECT source_type, COUNT(*) as count 
            FROM fhir.references 
            GROUP BY source_type 
            ORDER BY count DESC
        """))
        
        print(f"References Population Status")
        print(f"{'='*40}")
        print(f"Total references: {ref_count:,}")
        print(f"Total resources: {resource_count:,}")
        print(f"\nReferences by source type:")
        
        total_by_type = 0
        for row in result:
            print(f"  {row.source_type:<25} {row.count:>10,}")
            total_by_type += row.count
            
        # Estimate completion
        # Rough estimate: average 1.5 references per resource
        estimated_total = int(resource_count * 1.5)
        percent_complete = (ref_count / estimated_total * 100) if estimated_total > 0 else 0
        
        print(f"\nEstimated completion: {percent_complete:.1f}%")
        
        # Check for active processes
        try:
            result = await conn.execute(text("""
                SELECT COUNT(*) 
                FROM pg_stat_activity 
                WHERE query LIKE '%INSERT INTO fhir.references%'
                AND state != 'idle'
            """))
            active_count = result.scalar()
            if active_count > 0:
                print(f"\n✓ Population process is still running ({active_count} active queries)")
            else:
                print(f"\n✗ No active population queries found")
        except:
            print("\nCould not check active queries")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_status())