#!/usr/bin/env python3
"""
Fix Search Parameters Script

Re-extracts and updates search parameters for all FHIR resources,
specifically targeting the missing category parameters for Observations.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from core.fhir.storage import FHIRStorageEngine
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def fix_search_parameters():
    """Re-extract search parameters for all resources."""
    logger.info("🔧 Starting search parameter extraction fix")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with AsyncSession(engine) as session:
            storage = FHIRStorageEngine(session)
            
            # Get all resources that need search parameter re-extraction
            query = text("""
                SELECT id, resource_type, fhir_id, resource 
                FROM fhir.resources 
                WHERE resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'AllergyIntolerance')
                ORDER BY resource_type, last_updated
            """)
            
            result = await session.execute(query)
            resources = result.fetchall()
            
            logger.info(f"📊 Found {len(resources)} resources to process")
            
            processed = 0
            errors = 0
            
            for resource in resources:
                try:
                    resource_id = resource.id
                    resource_type = resource.resource_type
                    resource_data = resource.resource
                    
                    # Delete existing search parameters
                    await storage._delete_search_parameters(resource_id)
                    
                    # Re-extract search parameters
                    await storage._extract_search_parameters(
                        resource_id, resource_type, resource_data
                    )
                    
                    processed += 1
                    if processed % 100 == 0:
                        logger.info(f"Progress: {processed} resources processed")
                        await session.commit()
                
                except Exception as e:
                    logger.error(f"Failed to process {resource_type}/{resource.fhir_id}: {e}")
                    errors += 1
                    continue
            
            # Final commit
            await session.commit()
            
            logger.info("✅ Search parameter extraction completed")
            logger.info(f"📊 Processed: {processed} resources")
            logger.info(f"❌ Errors: {errors} resources")
            
            # Verify the fix
            logger.info("🔍 Verifying category parameters...")
            
            verify_query = text("""
                SELECT COUNT(*) as category_count
                FROM fhir.search_params 
                WHERE param_name = 'category'
            """)
            
            result = await session.execute(verify_query)
            category_count = result.scalar()
            
            logger.info(f"📈 Found {category_count} category search parameters")
            
            # Check vital signs specifically
            vital_signs_query = text("""
                SELECT COUNT(*) as vital_signs_count
                FROM fhir.search_params 
                WHERE param_name = 'category' 
                AND value_token_code = 'vital-signs'
            """)
            
            result = await session.execute(vital_signs_query)
            vital_signs_count = result.scalar()
            
            logger.info(f"💓 Found {vital_signs_count} vital-signs category parameters")
            
    except Exception as e:
        logger.error(f"Search parameter fix failed: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_search_parameters())