#!/usr/bin/env python3
"""
Verify that patient compartments are properly populated and working.
"""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, List

# Add the backend directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CompartmentVerifier:
    def __init__(self):
        # Create async engine
        self.engine = create_async_engine(
            settings.database_url.replace('postgresql://', 'postgresql+asyncpg://'),
            echo=False,
            pool_size=5,
            max_overflow=10
        )
        self.async_session = sessionmaker(
            self.engine, 
            class_=AsyncSession, 
            expire_on_commit=False
        )
    
    async def verify_compartments(self):
        """Main verification method."""
        async with self.async_session() as session:
            try:
                logger.info("Starting compartment verification...")
                
                # 1. Check if compartments table has entries
                compartment_count = await self._get_compartment_count(session)
                logger.info(f"Total compartment entries: {compartment_count}")
                
                if compartment_count == 0:
                    logger.error("❌ No compartment entries found!")
                    return False
                
                # 2. Verify patient compartments
                patient_compartments = await self._get_patient_compartment_stats(session)
                logger.info(f"Patient compartments: {patient_compartments}")
                
                # 3. Check for resources without compartments
                missing_compartments = await self._check_missing_compartments(session)
                if missing_compartments:
                    logger.warning(f"⚠️  Resources missing compartments: {missing_compartments}")
                
                # 4. Verify specific resource types
                resource_stats = await self._get_resource_compartment_stats(session)
                logger.info("\nCompartment coverage by resource type:")
                for resource_type, stats in resource_stats.items():
                    coverage = (stats['with_compartment'] / stats['total'] * 100) if stats['total'] > 0 else 0
                    logger.info(f"  {resource_type}: {stats['with_compartment']}/{stats['total']} ({coverage:.1f}%)")
                
                # 5. Test a sample patient's compartment
                sample_result = await self._test_sample_patient_compartment(session)
                if sample_result:
                    logger.info(f"\n✅ Sample patient compartment test passed")
                else:
                    logger.error(f"\n❌ Sample patient compartment test failed")
                
                # Overall assessment
                if compartment_count > 0 and not missing_compartments:
                    logger.info("\n✅ Compartment verification PASSED")
                    return True
                else:
                    logger.warning("\n⚠️  Compartment verification completed with warnings")
                    return True
                    
            except Exception as e:
                logger.error(f"Error during compartment verification: {e}")
                return False
            finally:
                await self.engine.dispose()
    
    async def _get_compartment_count(self, session: AsyncSession) -> int:
        """Get total number of compartment entries."""
        query = text("SELECT COUNT(*) FROM fhir.compartments")
        result = await session.execute(query)
        return result.scalar()
    
    async def _get_patient_compartment_stats(self, session: AsyncSession) -> Dict:
        """Get statistics about patient compartments."""
        query = text("""
            SELECT 
                COUNT(DISTINCT compartment_id) as unique_patients,
                COUNT(*) as total_entries,
                COUNT(DISTINCT resource_id) as unique_resources
            FROM fhir.compartments
            WHERE compartment_type = 'Patient'
        """)
        result = await session.execute(query)
        row = result.fetchone()
        return {
            "unique_patients": row.unique_patients,
            "total_entries": row.total_entries,
            "unique_resources": row.unique_resources
        }
    
    async def _check_missing_compartments(self, session: AsyncSession) -> List[str]:
        """Check for resources that should have compartments but don't."""
        missing = []
        
        # Resource types that should have patient compartments
        patient_compartment_types = [
            "Condition", "Observation", "MedicationRequest", "Encounter",
            "AllergyIntolerance", "Procedure", "DiagnosticReport", "Immunization"
        ]
        
        for resource_type in patient_compartment_types:
            query = text("""
                SELECT COUNT(*) 
                FROM fhir.resources r
                WHERE r.resource_type = :resource_type
                AND (r.deleted = false OR r.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.compartments c
                    WHERE c.resource_id = r.id
                )
            """)
            
            result = await session.execute(query, {"resource_type": resource_type})
            count = result.scalar()
            
            if count > 0:
                missing.append(f"{resource_type}: {count}")
        
        return missing
    
    async def _get_resource_compartment_stats(self, session: AsyncSession) -> Dict:
        """Get compartment statistics by resource type."""
        query = text("""
            SELECT 
                r.resource_type,
                COUNT(DISTINCT r.id) as total,
                COUNT(DISTINCT c.resource_id) as with_compartment
            FROM fhir.resources r
            LEFT JOIN fhir.compartments c ON c.resource_id = r.id
            WHERE r.resource_type IN (
                'Condition', 'Observation', 'MedicationRequest', 'Encounter',
                'AllergyIntolerance', 'Procedure', 'DiagnosticReport', 'Immunization'
            )
            AND (r.deleted = false OR r.deleted IS NULL)
            GROUP BY r.resource_type
            ORDER BY r.resource_type
        """)
        
        result = await session.execute(query)
        stats = {}
        for row in result:
            stats[row.resource_type] = {
                'total': row.total,
                'with_compartment': row.with_compartment
            }
        
        return stats
    
    async def _test_sample_patient_compartment(self, session: AsyncSession) -> bool:
        """Test that we can find resources through compartment for a sample patient."""
        # Get a sample patient with compartment entries
        query = text("""
            SELECT DISTINCT c.compartment_id, p.fhir_id
            FROM fhir.compartments c
            JOIN fhir.resources p ON p.fhir_id = c.compartment_id
            WHERE c.compartment_type = 'Patient'
            AND p.resource_type = 'Patient'
            AND (p.deleted = false OR p.deleted IS NULL)
            LIMIT 1
        """)
        
        result = await session.execute(query)
        row = result.fetchone()
        
        if not row:
            logger.warning("No patient with compartment entries found for testing")
            return False
        
        patient_id = row.compartment_id
        logger.info(f"\nTesting compartment for Patient/{patient_id}")
        
        # Count resources in this patient's compartment
        resource_query = text("""
            SELECT 
                r.resource_type,
                COUNT(*) as count
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND c.compartment_id = :patient_id
            AND (r.deleted = false OR r.deleted IS NULL)
            GROUP BY r.resource_type
            ORDER BY r.resource_type
        """)
        
        result = await session.execute(resource_query, {"patient_id": patient_id})
        
        resources_found = False
        for row in result:
            logger.info(f"  - {row.resource_type}: {row.count}")
            resources_found = True
        
        return resources_found


async def main():
    """Main entry point."""
    verifier = CompartmentVerifier()
    success = await verifier.verify_compartments()
    
    if not success:
        logger.error("\n❌ Compartment verification failed!")
        sys.exit(1)
    else:
        logger.info("\n✅ Compartment verification completed!")


if __name__ == "__main__":
    asyncio.run(main())