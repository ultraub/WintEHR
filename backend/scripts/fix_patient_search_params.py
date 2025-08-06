#!/usr/bin/env python3
"""
Fix Patient Search Parameters

This script ensures that patient/subject search parameters are properly indexed
for all clinical resources. It handles various reference formats including:
- Patient/id
- urn:uuid:id  
- Just the ID

This fixes the issue where searches like Condition?patient=id return no results.
"""

import asyncio
import asyncpg
import logging
from typing import Dict, List, Set
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Resource types that should have patient/subject search parameters
PATIENT_REFERENCED_RESOURCES = [
    'AllergyIntolerance',
    'Appointment',
    'CarePlan', 
    'CareTeam',
    'Claim',
    'Condition',
    'Coverage',
    'Device',
    'DiagnosticReport',
    'DocumentReference',
    'Encounter',
    'ExplanationOfBenefit',
    'Goal',
    'ImagingStudy',
    'Immunization',
    'MedicationAdministration',
    'MedicationDispense',
    'MedicationRequest',
    'MedicationStatement',
    'Observation',
    'Procedure',
    'ServiceRequest'
]

class PatientSearchParamFixer:
    def __init__(self):
        self.connection = None
        self.stats = {
            'total_resources': 0,
            'resources_fixed': 0,
            'params_added': 0,
            'errors': 0
        }
    
    async def connect(self):
        """Connect to database"""
        self.connection = await asyncpg.connect(
            'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        )
        logger.info("Connected to database")
    
    async def close(self):
        """Close database connection"""
        if self.connection:
            await self.connection.close()
            logger.info("Database connection closed")
    
    async def fix_patient_search_params(self):
        """Fix patient search parameters for all resources"""
        logger.info("Starting patient search parameter fix...")
        
        for resource_type in PATIENT_REFERENCED_RESOURCES:
            await self.fix_resource_type(resource_type)
        
        logger.info("=" * 60)
        logger.info("Fix Complete!")
        logger.info(f"  Total resources processed: {self.stats['total_resources']}")
        logger.info(f"  Resources fixed: {self.stats['resources_fixed']}")
        logger.info(f"  Search params added: {self.stats['params_added']}")
        logger.info(f"  Errors: {self.stats['errors']}")
    
    async def fix_resource_type(self, resource_type: str):
        """Fix patient search params for a specific resource type"""
        logger.info(f"\nProcessing {resource_type}...")
        
        # Get all resources of this type
        resources = await self.connection.fetch("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = $1
            AND deleted = false
        """, resource_type)
        
        if not resources:
            logger.info(f"  No {resource_type} resources found")
            return
        
        logger.info(f"  Found {len(resources)} {resource_type} resources")
        self.stats['total_resources'] += len(resources)
        
        fixed_count = 0
        for resource in resources:
            if await self.fix_resource(resource):
                fixed_count += 1
        
        if fixed_count > 0:
            logger.info(f"  Fixed {fixed_count} {resource_type} resources")
            self.stats['resources_fixed'] += fixed_count
    
    async def fix_resource(self, resource_row) -> bool:
        """Fix patient search param for a single resource"""
        resource_id = resource_row['id']
        resource_data = resource_row['resource']
        
        # Parse JSON if it's a string
        if isinstance(resource_data, str):
            resource_data = json.loads(resource_data)
        
        # Extract patient reference from resource
        patient_ref = self.extract_patient_reference(resource_data)
        if not patient_ref:
            return False
        
        # Check if search param already exists
        existing = await self.connection.fetchval("""
            SELECT COUNT(*) FROM fhir.search_params
            WHERE resource_id = $1
            AND param_name IN ('patient', 'subject')
        """, resource_id)
        
        if existing > 0:
            return False
        
        # Extract patient ID from reference
        patient_id = self.extract_id_from_reference(patient_ref)
        if not patient_id:
            return False
        
        # Add search parameters in multiple formats for compatibility
        try:
            # Add as patient parameter
            await self.add_search_param(
                resource_id,
                resource_data['resourceType'],
                'patient',
                patient_id,
                patient_ref
            )
            
            # Also add as subject if resource uses subject
            if 'subject' in resource_data:
                await self.add_search_param(
                    resource_id,
                    resource_data['resourceType'],
                    'subject',
                    patient_id,
                    patient_ref
                )
            
            self.stats['params_added'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Error adding search param for resource {resource_id}: {e}")
            self.stats['errors'] += 1
            return False
    
    def extract_patient_reference(self, resource: Dict) -> str:
        """Extract patient reference from resource"""
        # Common patterns for patient references
        if 'patient' in resource:
            ref = resource['patient']
            if isinstance(ref, dict) and 'reference' in ref:
                return ref['reference']
            elif isinstance(ref, str):
                return ref
        
        if 'subject' in resource:
            ref = resource['subject']
            if isinstance(ref, dict) and 'reference' in ref:
                return ref['reference']
            elif isinstance(ref, str):
                return ref
        
        return None
    
    def extract_id_from_reference(self, reference: str) -> str:
        """Extract ID from various reference formats"""
        if not reference:
            return None
        
        # Handle urn:uuid: format
        if reference.startswith('urn:uuid:'):
            return reference[9:]  # Remove 'urn:uuid:' prefix
        
        # Handle Patient/id format
        if '/' in reference:
            parts = reference.split('/')
            return parts[-1]
        
        # Assume it's just the ID
        return reference
    
    async def add_search_param(self, resource_id: int, resource_type: str, 
                               param_name: str, patient_id: str, full_ref: str):
        """Add search parameter to database"""
        # Add multiple variations for maximum compatibility
        variations = [
            patient_id,                    # Just the ID
            f"Patient/{patient_id}",       # Standard FHIR format
            full_ref                        # Original reference format
        ]
        
        for value in variations:
            await self.connection.execute("""
                INSERT INTO fhir.search_params 
                (resource_id, resource_type, param_name, param_type, value_reference, value_string)
                VALUES ($1, $2, $3, 'reference', $4, $4)
                ON CONFLICT DO NOTHING
            """, resource_id, resource_type, param_name, value)
    
    async def verify_fix(self):
        """Verify that the fix worked"""
        logger.info("\nVerifying fix...")
        
        # Check a sample of each resource type
        for resource_type in PATIENT_REFERENCED_RESOURCES[:5]:
            count = await self.connection.fetchval("""
                SELECT COUNT(DISTINCT sp.resource_id)
                FROM fhir.search_params sp
                JOIN fhir.resources r ON r.id = sp.resource_id
                WHERE r.resource_type = $1
                AND sp.param_name IN ('patient', 'subject')
            """, resource_type)
            
            total = await self.connection.fetchval("""
                SELECT COUNT(*)
                FROM fhir.resources
                WHERE resource_type = $1
                AND deleted = false
            """, resource_type)
            
            if total > 0:
                coverage = (count / total) * 100
                logger.info(f"  {resource_type}: {count}/{total} ({coverage:.1f}% coverage)")


async def main():
    """Main entry point"""
    fixer = PatientSearchParamFixer()
    
    try:
        await fixer.connect()
        await fixer.fix_patient_search_params()
        await fixer.verify_fix()
    finally:
        await fixer.close()


if __name__ == "__main__":
    asyncio.run(main())