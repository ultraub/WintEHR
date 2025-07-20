#!/usr/bin/env python3
"""
Populate compartments table for existing FHIR resources.

This script populates the fhir.compartments table with patient compartment
relationships for all existing resources. This is necessary for resources
that were imported before compartment extraction was implemented.

Usage:
    python populate_compartments.py
    python populate_compartments.py --verify-only
"""

import asyncio
import asyncpg
import json
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Set, Tuple
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CompartmentPopulator:
    """Populates compartments table for existing FHIR resources."""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        self.conn = None
        self.stats = {
            'processed': 0,
            'compartments_created': 0,
            'resources_with_compartments': 0,
            'errors': 0
        }
        
        # Define patient compartment reference fields by resource type
        # This matches the definition in storage.py
        self.patient_reference_fields = {
            # Core clinical resources with 'patient' reference
            "AllergyIntolerance": ["patient"],
            "CarePlan": ["patient", "subject"],
            "CareTeam": ["patient", "subject"],
            "ClinicalImpression": ["patient", "subject"],
            "Condition": ["patient", "subject"],
            "DiagnosticReport": ["patient", "subject"],
            "DocumentReference": ["patient", "subject"],
            "Encounter": ["patient", "subject"],
            "Goal": ["patient", "subject"],
            "ImagingStudy": ["patient", "subject"],
            "Immunization": ["patient"],
            "MedicationAdministration": ["patient", "subject"],
            "MedicationDispense": ["patient", "subject"],
            "MedicationRequest": ["patient", "subject"],
            "MedicationStatement": ["patient", "subject"],
            "Observation": ["patient", "subject"],
            "Procedure": ["patient", "subject"],
            "RiskAssessment": ["patient", "subject"],
            "ServiceRequest": ["patient", "subject"],
            
            # Resources that use 'subject' as patient reference
            "Basic": ["subject"],
            "BodyStructure": ["patient"],
            "Consent": ["patient"],
            "DetectedIssue": ["patient"],
            "Media": ["subject"],
            "QuestionnaireResponse": ["subject"],
            
            # Administrative resources
            "Account": ["patient", "subject"],
            "AdverseEvent": ["patient", "subject"],
            "Appointment": ["participant"],  # Special handling needed
            "AppointmentResponse": ["actor"],  # If actor is Patient
            "ChargeItem": ["subject"],
            "Claim": ["patient"],
            "ClaimResponse": ["patient"],
            "Communication": ["patient", "subject"],
            "CommunicationRequest": ["patient", "subject"],
            "Composition": ["subject"],
            "Coverage": ["beneficiary"],
            "DeviceRequest": ["subject"],
            "DeviceUseStatement": ["patient", "subject"],
            "EpisodeOfCare": ["patient"],
            "ExplanationOfBenefit": ["patient"],
            "FamilyMemberHistory": ["patient"],
            "Flag": ["patient", "subject"],
            "Invoice": ["patient", "subject"],
            "List": ["patient", "subject"],
            "NutritionOrder": ["patient"],
            "Person": ["link"],  # If link target is Patient
            "Provenance": ["patient"],  # If target is patient-related
            "RelatedPerson": ["patient"],
            "RequestGroup": ["patient", "subject"],
            "ResearchSubject": ["individual"],  # If individual is Patient
            "Schedule": ["actor"],  # If actor is Patient
            "Specimen": ["subject"],
            "SupplyDelivery": ["patient"],
            "SupplyRequest": ["deliverFor"],
            "VisionPrescription": ["patient"]
        }
    
    async def connect(self):
        """Connect to the database."""
        try:
            self.conn = await asyncpg.connect(self.database_url)
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from the database."""
        if self.conn:
            await self.conn.close()
            logger.info("Disconnected from database")
    
    def extract_patient_references(self, resource_type: str, resource_data: dict) -> Set[str]:
        """Extract patient references from a resource."""
        patient_ids = set()
        reference_fields = self.patient_reference_fields.get(resource_type, [])
        
        for field in reference_fields:
            if field in resource_data:
                ref_value = resource_data[field]
                
                # Handle different field structures
                if isinstance(ref_value, dict) and 'reference' in ref_value:
                    ref = ref_value['reference']
                    # Handle different reference formats
                    if ref.startswith('Patient/'):
                        patient_id = ref.split('/', 1)[1]
                        patient_ids.add(patient_id)
                    elif ref.startswith('urn:uuid:'):
                        # For urn:uuid references, extract the UUID
                        patient_id = ref.replace('urn:uuid:', '')
                        patient_ids.add(patient_id)
                
                # Handle array fields (e.g., Appointment.participant)
                elif isinstance(ref_value, list):
                    for item in ref_value:
                        if isinstance(item, dict):
                            # Check for actor/individual fields
                            for sub_field in ['actor', 'individual', 'reference']:
                                if sub_field in item:
                                    sub_ref = item[sub_field]
                                    if isinstance(sub_ref, dict) and 'reference' in sub_ref:
                                        ref = sub_ref['reference']
                                    elif isinstance(sub_ref, str):
                                        ref = sub_ref
                                    else:
                                        continue
                                    
                                    if ref.startswith('Patient/'):
                                        patient_id = ref.split('/', 1)[1]
                                        patient_ids.add(patient_id)
                                    elif ref.startswith('urn:uuid:'):
                                        patient_id = ref.replace('urn:uuid:', '')
                                        patient_ids.add(patient_id)
        
        return patient_ids
    
    async def populate_compartments(self):
        """Populate compartments for all existing resources."""
        logger.info("Starting compartment population...")
        
        # Get resource types that can belong to patient compartments
        resource_types = list(self.patient_reference_fields.keys())
        
        for resource_type in resource_types:
            logger.info(f"Processing {resource_type} resources...")
            
            # Get all resources of this type
            resources = await self.conn.fetch("""
                SELECT id, resource
                FROM fhir.resources
                WHERE resource_type = $1
                AND (deleted = false OR deleted IS NULL)
                ORDER BY id
            """, resource_type)
            
            if not resources:
                logger.info(f"  No {resource_type} resources found")
                continue
            
            type_stats = {
                'total': len(resources),
                'with_compartments': 0,
                'compartments_created': 0,
                'errors': 0
            }
            
            for resource in resources:
                self.stats['processed'] += 1
                
                try:
                    # Parse resource data if it's a string
                    resource_data = resource['resource']
                    if isinstance(resource_data, str):
                        resource_data = json.loads(resource_data)
                    
                    # Extract patient references
                    patient_ids = self.extract_patient_references(resource_type, resource_data)
                    
                    if patient_ids:
                        type_stats['with_compartments'] += 1
                        self.stats['resources_with_compartments'] += 1
                        
                        # Insert compartment entries
                        for patient_id in patient_ids:
                            result = await self.conn.execute("""
                                INSERT INTO fhir.compartments (
                                    compartment_type, compartment_id, resource_id
                                ) VALUES (
                                    'Patient', $1, $2
                                )
                                ON CONFLICT (compartment_type, compartment_id, resource_id) 
                                DO NOTHING
                                RETURNING id
                            """, patient_id, resource['id'])
                            
                            if result:
                                type_stats['compartments_created'] += 1
                                self.stats['compartments_created'] += 1
                
                except Exception as e:
                    logger.error(f"Error processing {resource_type} resource {resource['id']}: {e}")
                    type_stats['errors'] += 1
                    self.stats['errors'] += 1
            
            logger.info(f"  {resource_type}: {type_stats['total']} total, "
                       f"{type_stats['with_compartments']} with patient refs, "
                       f"{type_stats['compartments_created']} compartments created, "
                       f"{type_stats['errors']} errors")
    
    async def verify_compartments(self):
        """Verify compartment population."""
        logger.info("\nVerifying compartment population...")
        
        # Get total compartments
        total_compartments = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.compartments
            WHERE compartment_type = 'Patient'
        """)
        
        logger.info(f"Total patient compartments: {total_compartments}")
        
        # Get compartments by resource type
        logger.info("\nCompartments by resource type:")
        type_stats = await self.conn.fetch("""
            SELECT r.resource_type, COUNT(DISTINCT c.resource_id) as count
            FROM fhir.compartments c
            JOIN fhir.resources r ON c.resource_id = r.id
            WHERE c.compartment_type = 'Patient'
            AND (r.deleted = false OR r.deleted IS NULL)
            GROUP BY r.resource_type
            ORDER BY count DESC
        """)
        
        for stat in type_stats:
            logger.info(f"  {stat['resource_type']}: {stat['count']}")
        
        # Check for resources that should have compartments but don't
        logger.info("\nChecking for missing compartments...")
        
        for resource_type in ['Condition', 'Observation', 'MedicationRequest', 'Procedure', 'Encounter']:
            missing = await self.conn.fetchval("""
                SELECT COUNT(*)
                FROM fhir.resources r
                WHERE r.resource_type = $1
                AND (r.deleted = false OR r.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.compartments c
                    WHERE c.resource_id = r.id
                    AND c.compartment_type = 'Patient'
                )
            """, resource_type)
            
            if missing > 0:
                logger.warning(f"  {resource_type}: {missing} resources without compartments")
        
        # Get sample patient compartment
        sample = await self.conn.fetchrow("""
            SELECT c.compartment_id, COUNT(*) as resource_count
            FROM fhir.compartments c
            WHERE c.compartment_type = 'Patient'
            GROUP BY c.compartment_id
            ORDER BY resource_count DESC
            LIMIT 1
        """)
        
        if sample:
            logger.info(f"\nSample: Patient/{sample['compartment_id']} has {sample['resource_count']} resources")
    
    async def run(self, verify_only: bool = False):
        """Run the compartment populator."""
        await self.connect()
        
        try:
            if not verify_only:
                await self.populate_compartments()
                
                logger.info(f"\nPopulation complete:")
                logger.info(f"  Resources processed: {self.stats['processed']}")
                logger.info(f"  Resources with compartments: {self.stats['resources_with_compartments']}")
                logger.info(f"  Compartments created: {self.stats['compartments_created']}")
                logger.info(f"  Errors: {self.stats['errors']}")
            
            await self.verify_compartments()
            
        finally:
            await self.disconnect()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Populate FHIR compartments table')
    parser.add_argument('--verify-only', action='store_true', 
                       help='Only verify compartments without populating')
    parser.add_argument('--database-url', help='Database connection URL')
    
    args = parser.parse_args()
    
    populator = CompartmentPopulator(database_url=args.database_url)
    await populator.run(verify_only=args.verify_only)


if __name__ == '__main__':
    asyncio.run(main())