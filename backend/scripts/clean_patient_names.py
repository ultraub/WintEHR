#!/usr/bin/env python3
"""
Clean patient names by removing numeric suffixes
"""

import asyncio
import asyncpg
import re
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

async def clean_patient_names():
    """Clean numeric suffixes from patient names"""
    
    # Database connection
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    try:
        # Get all patients
        patients = await conn.fetch("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """)
        
        logger.info(f"Found {len(patients)} patients to process")
        
        cleaned_count = 0
        
        for patient in patients:
            resource = patient['resource']
            # Parse JSON if it's a string
            if isinstance(resource, str):
                resource = json.loads(resource)
            modified = False
            
            # Process each name in the resource
            if 'name' in resource:
                for name in resource['name']:
                    # Clean given names
                    if 'given' in name:
                        cleaned_given = []
                        for given_name in name['given']:
                            # Remove numeric suffix
                            cleaned = re.sub(r'\d+$', '', given_name)
                            cleaned = cleaned.strip()
                            if cleaned:
                                cleaned_given.append(cleaned)
                            else:
                                # If empty after cleaning, keep original
                                cleaned_given.append(given_name)
                        
                        if cleaned_given != name['given']:
                            name['given'] = cleaned_given
                            modified = True
                    
                    # Clean family name
                    if 'family' in name:
                        original = name['family']
                        # Remove numeric suffix
                        cleaned = re.sub(r'\d+$', '', original)
                        cleaned = cleaned.strip()
                        
                        if cleaned and cleaned != original:
                            name['family'] = cleaned
                            modified = True
            
            # Update if modified
            if modified:
                await conn.execute("""
                    UPDATE fhir.resources
                    SET resource = $1,
                        version_id = version_id + 1,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE id = $2
                """, json.dumps(resource), patient['id'])
                
                cleaned_count += 1
                
                # Log progress
                if cleaned_count % 10 == 0:
                    logger.info(f"Cleaned {cleaned_count} patients...")
        
        logger.info(f"✅ Successfully cleaned names for {cleaned_count} patients")
        
        # Show sample of cleaned names
        sample = await conn.fetch("""
            SELECT 
                resource->'name'->0->'given'->0 as first_name,
                resource->'name'->0->>'family' as last_name
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            LIMIT 5
        """)
        
        logger.info("Sample of cleaned names:")
        for row in sample:
            logger.info(f"  {row['first_name']} {row['last_name']}")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(clean_patient_names())