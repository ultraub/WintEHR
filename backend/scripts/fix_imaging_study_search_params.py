#!/usr/bin/env python3
"""
Fix ImagingStudy search parameters that have URN format references.
Converts URN UUIDs to proper Patient references.
"""

import asyncio
import asyncpg
import logging
from typing import Dict, List, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_imaging_study_search_params():
    """Fix URN format references in ImagingStudy search parameters."""
    
    # Connect to database
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    try:
        # First, let's see what we're dealing with
        check_query = """
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN value_string LIKE 'urn:uuid:%' THEN 1 END) as urn_count,
               COUNT(CASE WHEN value_reference LIKE 'Patient/%' THEN 1 END) as proper_count
        FROM fhir.search_params
        WHERE resource_type = 'ImagingStudy'
        AND param_name = 'patient'
        """
        
        stats = await conn.fetchrow(check_query)
        logger.info(f"ImagingStudy patient references - Total: {stats['total']}, URN format: {stats['urn_count']}, Proper format: {stats['proper_count']}")
        
        if stats['urn_count'] == 0:
            logger.info("No URN format references found. Nothing to fix!")
            return
        
        # Get mapping of URN UUIDs to Patient IDs
        mapping_query = """
        SELECT DISTINCT 
            sp.value_string as urn_uuid,
            p.fhir_id as patient_fhir_id
        FROM fhir.search_params sp
        JOIN fhir.resources r ON r.id = sp.resource_id
        JOIN fhir.resources p ON p.resource_type = 'Patient'
        WHERE sp.resource_type = 'ImagingStudy'
        AND sp.param_name = 'patient'
        AND sp.value_string LIKE 'urn:uuid:%'
        AND p.resource->>'id' = substring(sp.value_string from 'urn:uuid:(.+)')
        """
        
        mappings = await conn.fetch(mapping_query)
        logger.info(f"Found {len(mappings)} URN UUID to Patient ID mappings")
        
        if not mappings:
            logger.warning("Could not find Patient resources for URN UUIDs. Trying alternative approach...")
            
            # Alternative: Map by searching for patients with matching identifiers
            alt_mapping_query = """
            SELECT DISTINCT
                sp.value_string as urn_uuid,
                p.fhir_id as patient_fhir_id
            FROM fhir.search_params sp
            JOIN fhir.resources r ON r.id = sp.resource_id
            JOIN fhir.resources p ON p.resource_type = 'Patient'
            WHERE sp.resource_type = 'ImagingStudy'
            AND sp.param_name = 'patient'
            AND sp.value_string LIKE 'urn:uuid:%'
            AND p.resource->'identifier' @> jsonb_build_array(
                jsonb_build_object(
                    'system', 'urn:ietf:rfc:3986',
                    'value', sp.value_string
                )
            )
            """
            
            mappings = await conn.fetch(alt_mapping_query)
            logger.info(f"Alternative approach found {len(mappings)} mappings")
        
        if not mappings:
            logger.error("Could not establish URN UUID to Patient ID mappings!")
            return
        
        # Create mapping dictionary
        urn_to_patient = {row['urn_uuid']: row['patient_fhir_id'] for row in mappings}
        
        # Update search parameters
        update_count = 0
        for urn_uuid, patient_fhir_id in urn_to_patient.items():
            update_query = """
            UPDATE fhir.search_params
            SET value_reference = $1,
                value_string = NULL
            WHERE resource_type = 'ImagingStudy'
            AND param_name = 'patient'
            AND value_string = $2
            """
            
            patient_ref = f"Patient/{patient_fhir_id}"
            result = await conn.execute(update_query, patient_ref, urn_uuid)
            count = int(result.split()[-1])
            update_count += count
            
            if count > 0:
                logger.info(f"Updated {count} references from {urn_uuid} to {patient_ref}")
        
        logger.info(f"Total search parameters updated: {update_count}")
        
        # Verify the fix
        verify_query = """
        SELECT COUNT(*) as remaining_urn
        FROM fhir.search_params
        WHERE resource_type = 'ImagingStudy'
        AND param_name = 'patient'
        AND value_string LIKE 'urn:uuid:%'
        """
        
        remaining = await conn.fetchrow(verify_query)
        if remaining['remaining_urn'] > 0:
            logger.warning(f"Still have {remaining['remaining_urn']} URN format references that couldn't be fixed")
        else:
            logger.info("All URN format references have been successfully converted!")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_imaging_study_search_params())