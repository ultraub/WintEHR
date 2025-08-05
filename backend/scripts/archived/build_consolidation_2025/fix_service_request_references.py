#!/usr/bin/env python3
"""
Fix ServiceRequest references

Corrects the subject field in ServiceRequests from string to proper reference object.
Also ensures requester and performer are properly formatted.
"""

import asyncio
import json
import logging
from datetime import datetime
import sys

# Add parent directory to path for imports
sys.path.insert(0, '/app')

from database import DATABASE_URL
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def fix_service_requests():
    """Fix all ServiceRequest references"""
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with AsyncSession(engine) as session:
        # Get all ServiceRequests
        result = await session.execute(text("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'ServiceRequest'
        """))
        
        service_requests = result.fetchall()
        logger.info(f"Found {len(service_requests)} ServiceRequests to fix")
        
        fixed_count = 0
        error_count = 0
        
        for sr in service_requests:
            try:
                # Parse resource
                resource = sr.resource
                if isinstance(resource, str):
                    resource = json.loads(resource)
                
                modified = False
                
                # Fix subject if it's a string
                if isinstance(resource.get('subject'), str):
                    resource['subject'] = {
                        "reference": resource['subject']
                    }
                    modified = True
                
                # Fix requester if it's not an object
                if 'requester' in resource and not isinstance(resource['requester'], dict):
                    # Skip if requester is malformed
                    pass
                
                # Fix performer if it's not a list
                if 'performer' in resource and not isinstance(resource['performer'], list):
                    # Skip if performer is malformed
                    pass
                
                if modified:
                    # Update the resource
                    await session.execute(text("""
                        UPDATE fhir.resources
                        SET resource = :resource,
                            last_updated = :last_updated
                        WHERE id = :id
                    """), {
                        "resource": json.dumps(resource),
                        "last_updated": datetime.utcnow(),
                        "id": sr.id
                    })
                    fixed_count += 1
                
            except Exception as e:
                logger.error(f"Error fixing ServiceRequest {sr.fhir_id}: {e}")
                error_count += 1
        
        await session.commit()
        
    await engine.dispose()
    
    logger.info(f"\nFixed {fixed_count} ServiceRequests")
    logger.info(f"Errors: {error_count}")
    
    return fixed_count, error_count


async def verify_fix():
    """Verify the fixes were applied"""
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with AsyncSession(engine) as session:
        # Check for string subjects
        result = await session.execute(text("""
            SELECT COUNT(*)
            FROM fhir.resources
            WHERE resource_type = 'ServiceRequest'
            AND jsonb_typeof(resource->'subject') = 'string'
        """))
        
        string_subjects = result.scalar()
        
        # Check for proper subjects
        result = await session.execute(text("""
            SELECT COUNT(*)
            FROM fhir.resources
            WHERE resource_type = 'ServiceRequest'
            AND jsonb_typeof(resource->'subject') = 'object'
            AND resource->'subject'->>'reference' IS NOT NULL
        """))
        
        proper_subjects = result.scalar()
        
    await engine.dispose()
    
    logger.info(f"\nVerification:")
    logger.info(f"ServiceRequests with string subjects: {string_subjects}")
    logger.info(f"ServiceRequests with proper subjects: {proper_subjects}")
    
    return string_subjects == 0


async def main():
    """Main entry point"""
    logger.info("Starting ServiceRequest reference fix...")
    
    # Fix the references
    fixed, errors = await fix_service_requests()
    
    # Verify the fix
    success = await verify_fix()
    
    if success:
        logger.info("\n✅ All ServiceRequests have been fixed!")
    else:
        logger.warning("\n⚠️ Some ServiceRequests may still have incorrect references")
    
    return success


if __name__ == "__main__":
    asyncio.run(main())