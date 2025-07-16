#!/usr/bin/env python3
"""
Re-index MedicationRequest search parameters
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
import json

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@db:5432/emr_dev')

async def reindex_medication_requests():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print("=== Re-indexing MedicationRequest Search Parameters ===\n")
        
        # Get all MedicationRequests
        result = await db.execute(text("""
            SELECT id, resource
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
        """))
        
        resources = result.fetchall()
        print(f"Found {len(resources)} MedicationRequest resources to re-index")
        
        indexed = 0
        for resource_id, resource_data in resources:
            # Extract intent
            if 'intent' in resource_data:
                # Check if intent param already exists
                check_result = await db.execute(text("""
                    SELECT COUNT(*)
                    FROM fhir.search_params
                    WHERE resource_id = :resource_id
                    AND param_name = 'intent'
                """), {'resource_id': resource_id})
                
                if check_result.scalar() == 0:
                    # Add intent search parameter
                    await db.execute(text("""
                        INSERT INTO fhir.search_params (
                            resource_id, resource_type, param_name, param_type,
                            value_token_code
                        ) VALUES (
                            :resource_id, 'MedicationRequest', 'intent', 'token',
                            :intent
                        )
                    """), {
                        'resource_id': resource_id,
                        'intent': resource_data['intent']
                    })
                    indexed += 1
        
        await db.commit()
        print(f"\nIndexed {indexed} MedicationRequest intent parameters")
        
        # Verify the fix
        result = await db.execute(text("""
            SELECT COUNT(*)
            FROM fhir.search_params
            WHERE param_name = 'intent'
            AND resource_type = 'MedicationRequest'
            AND value_token_code = 'order'
        """))
        count = result.scalar()
        print(f"MedicationRequests with intent='order' in search params: {count}")

if __name__ == "__main__":
    asyncio.run(reindex_medication_requests())