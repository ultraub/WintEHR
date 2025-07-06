#!/usr/bin/env python3
"""
Fix medication format from FHIR R5 (medication.concept) to R4 (medicationCodeableConcept).
Synthea sometimes generates R5-style medication references.
"""

import asyncio
import logging
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session_maker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_medication_format(session: AsyncSession):
    """Convert medication.concept to medicationCodeableConcept for FHIR R4 compliance."""
    
    logger.info("🔧 Checking for R5-style medication references...")
    
    # Check how many MedicationRequests have medication.concept
    check_query = text("""
        SELECT COUNT(*) 
        FROM fhir.resources 
        WHERE resource_type = 'MedicationRequest'
        AND resource->'medication'->'concept' IS NOT NULL
    """)
    
    result = await session.execute(check_query)
    r5_count = result.scalar()
    
    if r5_count == 0:
        logger.info("✅ No R5-style medication references found")
        return
    
    logger.info(f"📝 Found {r5_count} MedicationRequests with R5-style medication references")
    
    # Convert medication.concept to medicationCodeableConcept
    update_query = text("""
        UPDATE fhir.resources
        SET resource = jsonb_set(
            resource - 'medication',
            '{medicationCodeableConcept}',
            resource->'medication'->'concept'
        )
        WHERE resource_type = 'MedicationRequest'
        AND resource->'medication'->'concept' IS NOT NULL
    """)
    
    result = await session.execute(update_query)
    updated = result.rowcount
    await session.commit()
    
    logger.info(f"✅ Converted {updated} MedicationRequests to R4 format")
    
    # Also check MedicationAdministration resources
    check_admin_query = text("""
        SELECT COUNT(*) 
        FROM fhir.resources 
        WHERE resource_type = 'MedicationAdministration'
        AND resource->'medication'->'concept' IS NOT NULL
    """)
    
    result = await session.execute(check_admin_query)
    admin_count = result.scalar()
    
    if admin_count > 0:
        logger.info(f"📝 Found {admin_count} MedicationAdministrations with R5-style references")
        
        update_admin_query = text("""
            UPDATE fhir.resources
            SET resource = jsonb_set(
                resource - 'medication',
                '{medicationCodeableConcept}',
                resource->'medication'->'concept'
            )
            WHERE resource_type = 'MedicationAdministration'
            AND resource->'medication'->'concept' IS NOT NULL
        """)
        
        result = await session.execute(update_admin_query)
        updated_admin = result.rowcount
        await session.commit()
        
        logger.info(f"✅ Converted {updated_admin} MedicationAdministrations to R4 format")
    
    # Check for any medication references that might be empty
    empty_check = text("""
        SELECT COUNT(*) 
        FROM fhir.resources 
        WHERE resource_type = 'MedicationRequest'
        AND resource->'medicationCodeableConcept' IS NULL
        AND resource->'medicationReference' IS NULL
    """)
    
    result = await session.execute(empty_check)
    empty_count = result.scalar()
    
    if empty_count > 0:
        logger.warning(f"⚠️  {empty_count} MedicationRequests have no medication data")

async def main():
    """Main function to run the medication format fix."""
    async with async_session_maker() as session:
        try:
            await fix_medication_format(session)
            logger.info("\n✨ Medication format fix completed successfully!")
        except Exception as e:
            logger.error(f"Error fixing medication format: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(main())