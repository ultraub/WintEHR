#!/usr/bin/env python3
"""
Populate the fhir.compartments table for patient compartments.

This script identifies all resources that belong to patient compartments and
creates the appropriate entries in the compartments table.
"""

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set

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

# Define which resource types belong to patient compartments and their patient reference paths
PATIENT_COMPARTMENT_DEFINITIONS = {
    # Core clinical resources with 'patient' reference
    "AllergyIntolerance": ["patient"],
    "CarePlan": ["patient"],
    "CareTeam": ["patient"],
    "ClinicalImpression": ["patient"],
    "Condition": ["patient"],
    "DiagnosticReport": ["patient"],
    "DocumentReference": ["patient"],
    "Encounter": ["patient"],
    "Goal": ["patient"],
    "ImagingStudy": ["patient"],
    "Immunization": ["patient"],
    "MedicationAdministration": ["patient"],
    "MedicationDispense": ["patient"],
    "MedicationRequest": ["patient"],
    "MedicationStatement": ["patient"],
    "Observation": ["patient"],
    "Procedure": ["patient"],
    "RiskAssessment": ["patient"],
    "ServiceRequest": ["patient"],
    
    # Resources that use 'subject' as patient reference
    "Basic": ["subject"],
    "BodyStructure": ["subject"],
    "Consent": ["subject"],
    "DetectedIssue": ["subject"],
    "Media": ["subject"],
    "QuestionnaireResponse": ["subject"],
    
    # Administrative resources
    "Account": ["patient"],
    "AdverseEvent": ["patient"],
    "Appointment": ["patient"],
    "AppointmentResponse": ["patient"],
    "ChargeItem": ["patient"],
    "Claim": ["patient"],
    "ClaimResponse": ["patient"],
    "Communication": ["patient"],
    "CommunicationRequest": ["patient"],
    "Composition": ["patient"],
    "Coverage": ["patient"],
    "DeviceRequest": ["patient"],
    "DeviceUseStatement": ["patient"],
    "EpisodeOfCare": ["patient"],
    "ExplanationOfBenefit": ["patient"],
    "FamilyMemberHistory": ["patient"],
    "Flag": ["patient"],
    "Invoice": ["patient"],
    "List": ["patient"],
    "NutritionOrder": ["patient"],
    "Person": ["patient"],
    "Provenance": ["patient"],
    "RelatedPerson": ["patient"],
    "RequestGroup": ["patient"],
    "ResearchSubject": ["patient"],
    "Schedule": ["patient"],
    "Specimen": ["patient"],
    "SupplyDelivery": ["patient"],
    "SupplyRequest": ["patient"],
    "VisionPrescription": ["patient"]
}


class CompartmentPopulator:
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
    
    async def populate_compartments(self):
        """Main method to populate compartments table."""
        async with self.async_session() as session:
            try:
                # First, check if compartments table is already populated
                existing_count = await self._get_existing_compartment_count(session)
                logger.info(f"Found {existing_count} existing compartment entries")
                
                if existing_count > 0:
                    logger.info("Clearing existing compartment entries...")
                    await self._clear_compartments(session)
                
                # Process each resource type
                total_compartments = 0
                for resource_type, reference_paths in PATIENT_COMPARTMENT_DEFINITIONS.items():
                    count = await self._process_resource_type(session, resource_type, reference_paths)
                    total_compartments += count
                    if count > 0:
                        logger.info(f"Created {count} compartment entries for {resource_type}")
                
                await session.commit()
                logger.info(f"Successfully created {total_compartments} compartment entries")
                
                # Verify the population
                await self._verify_compartments(session)
                
            except Exception as e:
                logger.error(f"Error populating compartments: {e}")
                await session.rollback()
                raise
            finally:
                await self.engine.dispose()
    
    async def _get_existing_compartment_count(self, session: AsyncSession) -> int:
        """Get count of existing compartment entries."""
        query = text("SELECT COUNT(*) FROM fhir.compartments")
        result = await session.execute(query)
        return result.scalar()
    
    async def _clear_compartments(self, session: AsyncSession):
        """Clear existing compartment entries."""
        query = text("DELETE FROM fhir.compartments")
        await session.execute(query)
    
    async def _process_resource_type(
        self, 
        session: AsyncSession, 
        resource_type: str, 
        reference_paths: List[str]
    ) -> int:
        """Process a single resource type and create compartment entries."""
        # Query all resources of this type
        query = text("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = :resource_type
            AND deleted = false
        """)
        
        result = await session.execute(query, {"resource_type": resource_type})
        rows = result.fetchall()
        
        compartment_count = 0
        for row in rows:
            resource_id = row.id
            fhir_id = row.fhir_id
            resource_data = row.resource
            
            # Extract patient references
            patient_ids = self._extract_patient_references(resource_data, reference_paths)
            
            # Create compartment entries
            for patient_id in patient_ids:
                await self._create_compartment_entry(
                    session, 
                    "Patient", 
                    patient_id, 
                    resource_id
                )
                compartment_count += 1
        
        return compartment_count
    
    def _extract_patient_references(
        self, 
        resource_data: Dict, 
        reference_paths: List[str]
    ) -> Set[str]:
        """Extract patient IDs from resource data."""
        patient_ids = set()
        
        for path in reference_paths:
            value = resource_data.get(path)
            if value:
                patient_id = self._extract_reference_id(value)
                if patient_id:
                    patient_ids.add(patient_id)
        
        return patient_ids
    
    def _extract_reference_id(self, reference_value) -> Optional[str]:
        """Extract patient ID from a reference value."""
        if isinstance(reference_value, dict) and 'reference' in reference_value:
            ref = reference_value['reference']
            
            # Handle different reference formats
            if ref.startswith('Patient/'):
                return ref.split('/', 1)[1]
            elif ref.startswith('urn:uuid:'):
                # For urn:uuid references, we need to resolve them
                # This would require looking up the actual Patient resource
                # For now, we'll skip these
                return None
        
        return None
    
    async def _create_compartment_entry(
        self,
        session: AsyncSession,
        compartment_type: str,
        compartment_id: str,
        resource_id: int
    ):
        """Create a single compartment entry."""
        query = text("""
            INSERT INTO fhir.compartments (
                compartment_type, compartment_id, resource_id, created_at
            ) VALUES (
                :compartment_type, :compartment_id, :resource_id, :created_at
            )
            ON CONFLICT DO NOTHING
        """)
        
        await session.execute(query, {
            "compartment_type": compartment_type,
            "compartment_id": compartment_id,
            "resource_id": resource_id,
            "created_at": datetime.utcnow()
        })
    
    async def _verify_compartments(self, session: AsyncSession):
        """Verify compartment population."""
        # Count compartments by resource type
        query = text("""
            SELECT r.resource_type, COUNT(DISTINCT c.id) as compartment_count
            FROM fhir.compartments c
            JOIN fhir.resources r ON c.resource_id = r.id
            GROUP BY r.resource_type
            ORDER BY r.resource_type
        """)
        
        result = await session.execute(query)
        rows = result.fetchall()
        
        logger.info("\nCompartment summary by resource type:")
        for row in rows:
            logger.info(f"  {row.resource_type}: {row.compartment_count} compartments")
        
        # Sample check: verify a few resources have correct compartments
        sample_query = text("""
            SELECT r.resource_type, r.fhir_id, c.compartment_id
            FROM fhir.compartments c
            JOIN fhir.resources r ON c.resource_id = r.id
            WHERE c.compartment_type = 'Patient'
            LIMIT 10
        """)
        
        result = await session.execute(sample_query)
        rows = result.fetchall()
        
        logger.info("\nSample compartment entries:")
        for row in rows:
            logger.info(f"  {row.resource_type}/{row.fhir_id} -> Patient/{row.compartment_id}")


async def main():
    """Main entry point."""
    logger.info("Starting compartment population...")
    
    populator = CompartmentPopulator()
    await populator.populate_compartments()
    
    logger.info("Compartment population completed!")


if __name__ == "__main__":
    asyncio.run(main())