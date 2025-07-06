#!/usr/bin/env python3
"""Test search functionality directly"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from core.fhir.storage import FHIRStorageEngine

async def test_search():
    engine = create_async_engine(DATABASE_URL, echo=True)  # Enable SQL echo
    
    async with AsyncSession(engine) as session:
        storage = FHIRStorageEngine(session)
        
        # Test direct search
        search_params = {
            'category': {
                'name': 'category',
                'type': 'token',
                'modifier': None,
                'values': [{'system': None, 'code': 'vital-signs'}]
            }
        }
        
        print("Testing search with params:", search_params)
        
        resources, total = await storage.search_resources(
            'Observation',
            search_params,
            offset=0,
            limit=5
        )
        
        print(f"Found {total} total results")
        print(f"Returned {len(resources)} resources")
        
        if resources:
            print("First resource:", resources[0].get('id'))
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_search())