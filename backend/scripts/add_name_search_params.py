#!/usr/bin/env python3
"""
Add 'name' search parameters for Patient resources

This script adds the FHIR standard 'name' search parameter that searches
across all name fields (given, family, prefix, suffix) for Patient resources.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def add_name_search_parameters():
    """Add name search parameters for all Patient resources."""
    logger.info("🔍 Adding 'name' search parameters for Patient resources...")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with AsyncSession(engine) as session:
            # Check current name search parameters
            existing_check = text("""
                SELECT COUNT(*) 
                FROM fhir.search_params sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Patient' 
                AND sp.param_name = 'name'
            """)
            
            result = await session.execute(existing_check)
            existing_count = result.scalar()
            
            logger.info(f"📊 Current 'name' search parameters: {existing_count}")
            
            # Add name search parameters for all name components
            # This creates a 'name' parameter that matches any part of the name
            insert_query = text("""
                INSERT INTO fhir.search_params (
                    resource_id, param_name, param_type, value_string
                )
                SELECT DISTINCT
                    p.id,
                    'name',
                    'string',
                    name_part.value
                FROM fhir.resources p,
                LATERAL (
                    SELECT jsonb_array_elements_text(
                        COALESCE(name_obj->>'given', '[]')::jsonb ||
                        jsonb_build_array(COALESCE(name_obj->>'family', '')) ||
                        COALESCE(name_obj->>'prefix', '[]')::jsonb ||
                        COALESCE(name_obj->>'suffix', '[]')::jsonb
                    ) as value
                    FROM jsonb_array_elements(p.resource->'name') as name_obj
                    WHERE name_obj->>'use' = 'official' OR name_obj->>'use' IS NULL
                ) as name_part
                WHERE p.resource_type = 'Patient'
                AND p.deleted = false
                AND name_part.value IS NOT NULL
                AND name_part.value != ''
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp
                    WHERE sp.resource_id = p.id 
                    AND sp.param_name = 'name'
                    AND sp.value_string = name_part.value
                )
            """)
            
            result = await session.execute(insert_query)
            new_count = result.rowcount
            
            await session.commit()
            
            logger.info(f"✅ Added {new_count} 'name' search parameters")
            
            # Verify the results
            verification_query = text("""
                SELECT 
                    COUNT(*) as total_name_params,
                    COUNT(DISTINCT sp.resource_id) as patients_with_name_params
                FROM fhir.search_params sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Patient' 
                AND sp.param_name = 'name'
            """)
            
            result = await session.execute(verification_query)
            verification = result.fetchone()
            
            logger.info(f"📊 Verification:")
            logger.info(f"  Total 'name' search parameters: {verification.total_name_params}")
            logger.info(f"  Patients with 'name' parameters: {verification.patients_with_name_params}")
            
            # Show sample name search parameters
            sample_query = text("""
                SELECT DISTINCT sp.value_string
                FROM fhir.search_params sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Patient' 
                AND sp.param_name = 'name'
                LIMIT 10
            """)
            
            result = await session.execute(sample_query)
            samples = result.fetchall()
            
            logger.info("📝 Sample name search values:")
            for sample in samples:
                logger.info(f"  - '{sample.value_string}'")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Failed to add name search parameters: {e}")
        return False
    finally:
        await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(add_name_search_parameters())
    sys.exit(0 if success else 1)