#!/usr/bin/env python3
"""
Check the progress of the search parameter migration
"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL


async def check_progress():
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    async with engine.connect() as conn:
        # Check ServiceRequest indexing progress
        result = await conn.execute(text('''
            SELECT 
                (SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'ServiceRequest') as total_sr,
                (SELECT COUNT(DISTINCT resource_id) FROM fhir.search_params 
                 WHERE resource_type = 'ServiceRequest' AND param_name = 'patient') as indexed_sr,
                (SELECT COUNT(DISTINCT resource_type) FROM fhir.search_params) as types_indexed,
                (SELECT COUNT(*) FROM fhir.search_params) as total_params
        '''))
        
        row = result.fetchone()
        sr_pct = (row.indexed_sr / row.total_sr * 100) if row.total_sr > 0 else 0
        
        print(f'Migration Progress:')
        print(f'==================')
        print(f'ServiceRequests indexed: {row.indexed_sr:,}/{row.total_sr:,} ({sr_pct:.1f}%)')
        print(f'Resource types with params: {row.types_indexed}')
        print(f'Total search parameters: {row.total_params:,}')
        
        # Check recently indexed types
        result = await conn.execute(text('''
            SELECT resource_type, param_name, COUNT(*) as count
            FROM fhir.search_params
            WHERE resource_type IN ('ServiceRequest', 'CarePlan', 'CareTeam', 'Organization')
            GROUP BY resource_type, param_name
            ORDER BY resource_type, param_name
            LIMIT 20
        '''))
        
        print(f'\nNewly Indexed Parameters:')
        current_type = None
        for row in result:
            if row.resource_type != current_type:
                current_type = row.resource_type
                print(f'\n{current_type}:')
            print(f'  {row.param_name:<20} {row.count:>8,}')
            
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_progress())