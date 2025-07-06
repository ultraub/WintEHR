#!/usr/bin/env python3
"""
Fix URN references in FHIR resources to use proper FHIR references.
Synthea generates URN references, but our FHIR API expects standard references.
"""

import asyncio
import logging
import re
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session_maker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_urn_references(session: AsyncSession):
    """Fix all URN references to use proper FHIR reference format."""
    
    # Resource types and their reference fields
    reference_mappings = {
        'Observation': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('performer', 'Practitioner')
        ],
        'Condition': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('asserter', 'Practitioner')
        ],
        'MedicationRequest': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('requester', 'Practitioner'),
            ('medicationReference', 'Medication')
        ],
        'Procedure': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('performer', 'Practitioner')
        ],
        'Encounter': [
            ('subject', 'Patient'),
            ('participant', 'Practitioner'),
            ('serviceProvider', 'Organization')
        ],
        'AllergyIntolerance': [
            ('patient', 'Patient'),
            ('encounter', 'Encounter'),
            ('recorder', 'Practitioner')
        ],
        'Immunization': [
            ('patient', 'Patient'),
            ('encounter', 'Encounter'),
            ('performer', 'Practitioner')
        ],
        'DiagnosticReport': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('performer', 'Practitioner'),
            ('result', 'Observation')
        ],
        'DocumentReference': [
            ('subject', 'Patient'),
            ('author', 'Practitioner'),
            ('custodian', 'Organization')
        ],
        'CarePlan': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('author', 'Practitioner')
        ],
        'Goal': [
            ('subject', 'Patient'),
            ('expressedBy', 'Practitioner')
        ],
        'ExplanationOfBenefit': [
            ('patient', 'Patient'),
            ('provider', 'Practitioner'),
            ('insurer', 'Organization'),
            ('coverage', 'Coverage')
        ],
        'Claim': [
            ('patient', 'Patient'),
            ('provider', 'Organization'),
            ('insurer', 'Organization'),
            ('insurance', 'Coverage'),
            ('prescription', 'MedicationRequest')
        ],
        'Coverage': [
            ('beneficiary', 'Patient'),
            ('payor', 'Organization')
        ],
        'MedicationAdministration': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('performer', 'Practitioner'),
            ('request', 'MedicationRequest')
        ],
        'SupplyDelivery': [
            ('patient', 'Patient'),
            ('supplier', 'Organization'),
            ('basedOn', 'SupplyRequest')
        ],
        'ImagingStudy': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('referrer', 'Practitioner'),
            ('interpreter', 'Practitioner')
        ],
        'CareTeam': [
            ('subject', 'Patient'),
            ('encounter', 'Encounter'),
            ('participant', 'Practitioner'),
            ('managingOrganization', 'Organization')
        ]
    }
    
    total_updated = 0
    
    for resource_type, field_mappings in reference_mappings.items():
        logger.info(f"Processing {resource_type} resources...")
        
        # Get count of resources with URN references
        count_query = text(f"""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE resource_type = :resource_type 
            AND resource::text LIKE '%urn:uuid:%'
        """)
        
        result = await session.execute(count_query, {"resource_type": resource_type})
        count = result.scalar()
        
        if count == 0:
            logger.info(f"  No URN references found in {resource_type}")
            continue
            
        logger.info(f"  Found {count} {resource_type} resources with URN references")
        
        # Build the UPDATE query dynamically based on field mappings
        for field_path, target_type in field_mappings:
            # Handle simple references
            update_query = text(f"""
                UPDATE fhir.resources
                SET resource = jsonb_set(
                    resource,
                    '{{{field_path},reference}}',
                    to_jsonb('{target_type}/' || substring(resource->'{field_path}'->>'reference' from 'urn:uuid:(.*)')::text)
                )
                WHERE resource_type = :resource_type
                AND resource->'{field_path}'->>'reference' LIKE 'urn:uuid:%'
            """)
            
            result = await session.execute(update_query, {"resource_type": resource_type})
            updated = result.rowcount
            if updated > 0:
                logger.info(f"    Updated {updated} {field_path} references to {target_type}")
                total_updated += updated
            
            # Handle array references (e.g., performer can be an array)
            if field_path in ['performer', 'participant', 'author']:
                array_update_query = text(f"""
                    UPDATE fhir.resources r
                    SET resource = (
                        SELECT jsonb_set(
                            r.resource,
                            '{{{field_path}}}',
                            jsonb_agg(
                                CASE 
                                    WHEN elem->>'reference' LIKE 'urn:uuid:%' THEN
                                        jsonb_set(elem, '{{reference}}', 
                                            to_jsonb('{target_type}/' || substring(elem->>'reference' from 'urn:uuid:(.*)')::text)
                                        )
                                    ELSE elem
                                END
                            )
                        )
                        FROM jsonb_array_elements(r.resource->'{field_path}') elem
                    )
                    WHERE resource_type = :resource_type
                    AND jsonb_typeof(resource->'{field_path}') = 'array'
                    AND EXISTS (
                        SELECT 1 
                        FROM jsonb_array_elements(resource->'{field_path}') elem 
                        WHERE elem->>'reference' LIKE 'urn:uuid:%'
                    )
                """)
                
                try:
                    result = await session.execute(array_update_query, {"resource_type": resource_type})
                    updated = result.rowcount
                    if updated > 0:
                        logger.info(f"    Updated {updated} {field_path} array references to {target_type}")
                        total_updated += updated
                except Exception as e:
                    logger.debug(f"    No array references for {field_path}: {e}")
        
        await session.commit()
    
    logger.info(f"\n✅ Total references updated: {total_updated}")
    
    # Update search parameters for all affected resources
    logger.info("\n🔍 Updating search parameters...")
    
    search_param_query = text("""
        -- Extract patient search parameters for all resource types
        INSERT INTO fhir.search_params (resource_id, resource_type, param_name, param_value)
        SELECT 
            r.id,
            r.resource_type,
            'patient',
            CASE 
                WHEN r.resource->'subject'->>'reference' IS NOT NULL THEN
                    substring(r.resource->'subject'->>'reference' from 'Patient/(.+)')
                WHEN r.resource->'patient'->>'reference' IS NOT NULL THEN
                    substring(r.resource->'patient'->>'reference' from 'Patient/(.+)')
                WHEN r.resource->'beneficiary'->>'reference' IS NOT NULL THEN
                    substring(r.resource->'beneficiary'->>'reference' from 'Patient/(.+)')
            END
        FROM fhir.resources r
        WHERE r.resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'Procedure', 
                                  'AllergyIntolerance', 'Immunization', 'DiagnosticReport', 
                                  'DocumentReference', 'CarePlan', 'Goal', 'Coverage')
        AND (r.resource->'subject'->>'reference' LIKE 'Patient/%'
             OR r.resource->'patient'->>'reference' LIKE 'Patient/%'
             OR r.resource->'beneficiary'->>'reference' LIKE 'Patient/%')
        ON CONFLICT (resource_id, param_name) 
        DO UPDATE SET param_value = EXCLUDED.param_value;
    """)
    
    result = await session.execute(search_param_query)
    search_params_updated = result.rowcount
    logger.info(f"  Updated {search_params_updated} patient search parameters")
    
    await session.commit()

async def main():
    """Main function to run the fix."""
    async with async_session_maker() as session:
        try:
            await fix_urn_references(session)
            logger.info("\n✨ URN reference fix completed successfully!")
        except Exception as e:
            logger.error(f"Error fixing URN references: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(main())