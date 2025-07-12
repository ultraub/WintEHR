#!/usr/bin/env python3
"""
Clean Synthea-generated patient names by removing numbers.
"""

import asyncio
import sys
import re
import json
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
from database import DATABASE_URL

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


async def clean_patient_names():
    """Clean patient names in the database."""
    engine = create_async_engine(
        DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
        echo=False
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        logging.info("🧹 Cleaning patient names...")
        
        # Temporarily disable history trigger
        await session.execute(text("ALTER TABLE fhir.resources DISABLE TRIGGER resource_history_trigger"))
        
        # Get all patients
        result = await session.execute(text("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """))
        
        patients = result.fetchall()
        cleaned_count = 0
        
        for db_id, fhir_id, resource_data in patients:
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            
            modified = False
            
            # Clean name array
            if 'name' in resource_data and isinstance(resource_data['name'], list):
                for name in resource_data['name']:
                    # Clean given names
                    if 'given' in name and isinstance(name['given'], list):
                        cleaned_given = []
                        for given_name in name['given']:
                            # Remove trailing numbers (e.g., "John123" becomes "John")
                            cleaned = re.sub(r'\d+$', '', given_name)
                            if cleaned != given_name:
                                modified = True
                                logging.info(f"  Cleaning: {given_name} -> {cleaned}")
                            cleaned_given.append(cleaned)
                        name['given'] = cleaned_given
                    
                    # Clean family name
                    if 'family' in name:
                        cleaned_family = re.sub(r'\d+$', '', name['family'])
                        if cleaned_family != name['family']:
                            modified = True
                            logging.info(f"  Cleaning: {name['family']} -> {cleaned_family}")
                            name['family'] = cleaned_family
            
            if modified:
                # Update the resource
                await session.execute(text("""
                    UPDATE fhir.resources
                    SET resource = :resource
                    WHERE id = :id
                """), {
                    'id': db_id,
                    'resource': json.dumps(resource_data)
                })
                cleaned_count += 1
                logging.info(f"  ✅ Cleaned patient {fhir_id}")
        
        await session.commit()
        
        # Re-enable history trigger
        await session.execute(text("ALTER TABLE fhir.resources ENABLE TRIGGER resource_history_trigger"))
        await session.commit()
        
        logging.info(f"✅ Cleaned {cleaned_count} patient names")
        
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(clean_patient_names())