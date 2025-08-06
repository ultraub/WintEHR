#!/usr/bin/env python3
"""
Debug why FHIR searches are returning empty results.

Author: WintEHR Team
Date: 2025-01-25
"""

import asyncio
import logging
import os
import sys
import json

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from database import get_db_session
from fhir.core.storage import FHIRStorageEngine
from fhir.core.search.basic import SearchParameterHandler
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def debug_search():
    """Debug search issue step by step."""
    async for db in get_db_session():
        try:
            storage = FHIRStorageEngine(db)
            
            # Test patient ID
            patient_id = "0288c42c-43a1-9878-4a9d-6b96caa12c40"
            
            logger.info(f"\n{'='*60}")
            logger.info(f"Debugging search for patient: {patient_id}")
            logger.info(f"{'='*60}")
            
            # 1. Verify patient exists
            patient_resource = await storage.read_resource("Patient", patient_id)
            if patient_resource:
                logger.info(f"✅ Patient exists: {patient_resource.get('name', [{}])[0].get('family', 'Unknown')}")
            else:
                logger.error(f"❌ Patient {patient_id} not found!")
                return
            
            # 2. Test direct SQL query
            logger.info("\n--- Testing direct SQL query ---")
            result = await db.execute(text("""
                SELECT COUNT(*) 
                FROM fhir.resources r
                JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE sp.param_name = 'patient' 
                AND sp.value_reference = :ref
                AND r.resource_type = 'Condition'
                AND r.deleted = false
            """), {"ref": f"Patient/{patient_id}"})
            
            count = result.scalar()
            logger.info(f"Direct SQL found {count} Conditions")
            
            # 3. Test search parameter parsing
            logger.info("\n--- Testing search parameter parsing ---")
            search_handler = SearchParameterHandler(storage._get_search_parameter_definitions())
            
            # Simulate API query params
            query_params = {
                "patient": patient_id,
                "clinical-status": "active"
            }
            
            parsed_params, result_params = search_handler.parse_search_params("Condition", query_params)
            logger.info(f"Parsed search params: {json.dumps(parsed_params, indent=2)}")
            
            # 4. Test storage.search_resources
            logger.info("\n--- Testing storage.search_resources ---")
            
            # Test with parsed params
            resources, total = await storage.search_resources(
                "Condition",
                parsed_params,
                offset=0,
                limit=10
            )
            
            logger.info(f"storage.search_resources returned: {total} total, {len(resources)} resources")
            
            # 5. Test with optimized search disabled
            logger.info("\n--- Testing with optimized search DISABLED ---")
            os.environ['USE_OPTIMIZED_SEARCH'] = 'false'
            
            resources_no_opt, total_no_opt = await storage.search_resources(
                "Condition",
                parsed_params,
                offset=0,
                limit=10
            )
            
            logger.info(f"Without optimization: {total_no_opt} total, {len(resources_no_opt)} resources")
            
            # 6. Test with optimized search enabled
            logger.info("\n--- Testing with optimized search ENABLED ---")
            os.environ['USE_OPTIMIZED_SEARCH'] = 'true'
            
            resources_opt, total_opt = await storage.search_resources(
                "Condition",
                parsed_params,
                offset=0,
                limit=10
            )
            
            logger.info(f"With optimization: {total_opt} total, {len(resources_opt)} resources")
            
            # 7. Print first resource if found
            if resources_no_opt:
                logger.info("\nFirst Condition found:")
                first = resources_no_opt[0]
                logger.info(f"  ID: {first.get('id')}")
                logger.info(f"  Code: {first.get('code', {}).get('text', 'Unknown')}")
                
            # Summary
            logger.info(f"\n{'='*60}")
            logger.info("SUMMARY:")
            logger.info(f"  Patient exists: {'✅' if patient_resource else '❌'}")
            logger.info(f"  Direct SQL finds data: {'✅' if count > 0 else '❌'}")
            logger.info(f"  Search without optimization: {'✅' if total_no_opt > 0 else '❌'}")
            logger.info(f"  Search with optimization: {'✅' if total_opt > 0 else '❌'}")
            logger.info(f"{'='*60}")
            
        except Exception as e:
            logger.error(f"Error during debugging: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await db.close()


if __name__ == "__main__":
    asyncio.run(debug_search())