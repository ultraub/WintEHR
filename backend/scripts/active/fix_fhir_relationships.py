#!/usr/bin/env python3
"""
Fix FHIR Relationships and Search Parameters

This script fixes the critical issues with FHIR relationships and search parameters:
1. Transforms "Resource/uuid" references to proper "Patient/uuid" format
2. Re-indexes search parameters using the comprehensive extraction module
3. Populates patient compartments for all patient-related resources
4. Verifies the fixes were applied correctly

Created: 2025-08-05
"""

import asyncio
import asyncpg
import json
import logging
from datetime import datetime
from pathlib import Path
import sys

# Add parent directory to path for imports
import os
# In Docker, add /app first
if os.path.exists('/app/fhir'):
    sys.path.insert(0, '/app')
else:
    sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the comprehensive search parameter extractor
from fhir.core.search_param_extraction import SearchParameterExtractor

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FHIRRelationshipFixer:
    """Fix FHIR relationships and search parameters."""
    
    def __init__(self):
        self.conn = None
        self.extractor = SearchParameterExtractor()
        self.stats = {
            'references_fixed': 0,
            'search_params_added': 0,
            'compartments_added': 0,
            'errors': 0
        }
        
    async def connect(self):
        """Connect to database."""
        self.conn = await asyncpg.connect(
            "postgresql://emr_user:emr_password@postgres:5432/emr_db"
        )
        logger.info("✅ Connected to database")
        
    async def disconnect(self):
        """Disconnect from database."""
        if self.conn:
            await self.conn.close()
            logger.info("🔌 Disconnected from database")
    
    async def fix_references(self):
        """Fix Resource/uuid references to be Patient/uuid where appropriate."""
        logger.info("\n🔧 Fixing references...")
        
        # First, build a mapping of UUIDs to Patient IDs
        patient_map = {}
        patients = await self.conn.fetch(
            "SELECT fhir_id FROM fhir.resources WHERE resource_type = 'Patient'"
        )
        for patient in patients:
            patient_map[patient['fhir_id']] = f"Patient/{patient['fhir_id']}"
        
        logger.info(f"Found {len(patient_map)} patients")
        
        # Fix references in resource JSON
        resources_to_fix = await self.conn.fetch("""
            SELECT id, resource_type, resource
            FROM fhir.resources
            WHERE resource::text LIKE '%"Resource/%'
        """)
        
        logger.info(f"Found {len(resources_to_fix)} resources with Resource/ references")
        
        for record in resources_to_fix:
            resource_data = json.loads(record['resource']) if isinstance(record['resource'], str) else record['resource']
            
            # Transform references
            def transform_references(obj):
                if isinstance(obj, dict):
                    if 'reference' in obj and isinstance(obj['reference'], str):
                        ref = obj['reference']
                        if ref.startswith('Resource/'):
                            uuid = ref.replace('Resource/', '')
                            if uuid in patient_map:
                                obj['reference'] = patient_map[uuid]
                                self.stats['references_fixed'] += 1
                    
                    for value in obj.values():
                        transform_references(value)
                elif isinstance(obj, list):
                    for item in obj:
                        transform_references(item)
            
            transform_references(resource_data)
            
            # Update the resource
            await self.conn.execute("""
                UPDATE fhir.resources 
                SET resource = $1 
                WHERE id = $2
            """, json.dumps(resource_data), record['id'])
        
        # Fix references table
        await self.conn.execute("""
            UPDATE fhir.references
            SET target_type = 'Patient',
                reference_value = REPLACE(reference_value, 'Resource/', 'Patient/')
            WHERE target_type = 'Resource'
            AND target_id IN (
                SELECT fhir_id FROM fhir.resources WHERE resource_type = 'Patient'
            )
        """)
        
        logger.info(f"✅ Fixed {self.stats['references_fixed']} references")
    
    async def reindex_search_params(self):
        """Re-index search parameters using comprehensive extraction."""
        logger.info("\n🔍 Re-indexing search parameters...")
        
        # Get all resources that need patient/subject references
        resources = await self.conn.fetch("""
            SELECT r.id, r.resource_type, r.resource
            FROM fhir.resources r
            WHERE r.resource_type IN (
                'Condition', 'Observation', 'MedicationRequest', 'Procedure',
                'Immunization', 'AllergyIntolerance', 'DiagnosticReport',
                'CarePlan', 'Goal', 'Encounter', 'DocumentReference',
                'ServiceRequest', 'Claim', 'ExplanationOfBenefit'
            )
            AND r.deleted = false
        """)
        
        logger.info(f"Processing {len(resources)} clinical resources")
        
        for record in resources:
            resource_id = record['id']
            resource_type = record['resource_type']
            resource_data = json.loads(record['resource']) if isinstance(record['resource'], str) else record['resource']
            
            try:
                # Extract search parameters
                params = self.extractor.extract_parameters(resource_type, resource_data)
                
                # Delete existing patient/subject parameters for this resource
                await self.conn.execute("""
                    DELETE FROM fhir.search_params 
                    WHERE resource_id = $1 
                    AND param_name IN ('patient', 'subject')
                """, resource_id)
                
                # Insert new parameters
                for param in params:
                    if param['param_name'] in ('patient', 'subject'):
                        # Prepare values - match actual column names
                        values = {
                            'resource_id': resource_id,
                            'resource_type': resource_type,
                            'param_name': param['param_name'],
                            'param_type': param['param_type'],
                            'value_string': param.get('value_string'),
                            'value_number': param.get('value_number'),
                            'value_date': param.get('value_date'),
                            'value_token': param.get('value_token'),
                            'value_token_system': param.get('value_token_system'),
                            'value_token_code': param.get('value_token_code'),
                            'value_reference': param.get('value_reference'),
                            'value_quantity_value': param.get('value_quantity'),  # Note: renamed
                            'value_quantity_system': param.get('value_quantity_system'),
                            'value_quantity_code': param.get('value_quantity_code'),
                            'value_quantity_unit': param.get('value_quantity_unit')
                        }
                        
                        await self.conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_number, value_date, value_token,
                                value_token_system, value_token_code, value_reference,
                                value_quantity_value, value_quantity_system, 
                                value_quantity_code, value_quantity_unit
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                            )
                        """, *values.values())
                        
                        self.stats['search_params_added'] += 1
                        
            except Exception as e:
                logger.error(f"Error processing {resource_type}/{resource_id}: {e}")
                self.stats['errors'] += 1
        
        logger.info(f"✅ Added {self.stats['search_params_added']} search parameters")
    
    async def populate_compartments(self):
        """Populate patient compartments for all patient-related resources."""
        logger.info("\n🏥 Populating patient compartments...")
        
        # Clear existing compartments (except for Patient resources themselves)
        await self.conn.execute("""
            DELETE FROM fhir.compartments 
            WHERE compartment_type = 'Patient'
            AND resource_id NOT IN (
                SELECT id FROM fhir.resources WHERE resource_type = 'Patient'
            )
        """)
        
        # Get all resources with patient references
        resources = await self.conn.fetch("""
            SELECT DISTINCT 
                sp.resource_id,
                sp.value_reference,
                r.resource_type
            FROM fhir.search_params sp
            JOIN fhir.resources r ON r.id = sp.resource_id
            WHERE sp.param_name IN ('patient', 'subject')
            AND sp.value_reference LIKE 'Patient/%'
            AND r.deleted = false
        """)
        
        logger.info(f"Found {len(resources)} resources to add to compartments")
        
        for record in resources:
            patient_id = record['value_reference'].split('/')[-1]
            
            # Check if compartment entry already exists
            exists = await self.conn.fetchval("""
                SELECT 1 FROM fhir.compartments
                WHERE compartment_type = 'Patient'
                AND compartment_id = $1
                AND resource_id = $2
            """, patient_id, record['resource_id'])
            
            if not exists:
                await self.conn.execute("""
                    INSERT INTO fhir.compartments (
                        compartment_type, compartment_id, resource_id
                    ) VALUES ('Patient', $1, $2)
                """, patient_id, record['resource_id'])
                
                self.stats['compartments_added'] += 1
        
        logger.info(f"✅ Added {self.stats['compartments_added']} compartment entries")
    
    async def verify_fixes(self):
        """Verify that fixes were applied correctly."""
        logger.info("\n✅ Verifying fixes...")
        
        # Check for remaining Resource/ references
        bad_refs = await self.conn.fetchval("""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE resource::text LIKE '%"Resource/%'
        """)
        
        if bad_refs > 0:
            logger.warning(f"⚠️  Still have {bad_refs} resources with Resource/ references")
        else:
            logger.info("✅ No Resource/ references found")
        
        # Check search parameters
        resources_with_params = await self.conn.fetchval("""
            SELECT COUNT(DISTINCT resource_id)
            FROM fhir.search_params
            WHERE param_name IN ('patient', 'subject')
        """)
        
        clinical_resources = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources
            WHERE resource_type IN (
                'Condition', 'Observation', 'MedicationRequest', 'Procedure',
                'Immunization', 'AllergyIntolerance', 'DiagnosticReport'
            )
            AND deleted = false
        """)
        
        logger.info(f"📊 {resources_with_params}/{clinical_resources} clinical resources have patient/subject params")
        
        # Check compartments
        compartment_count = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.compartments
            WHERE compartment_type = 'Patient'
        """)
        
        patient_count = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """)
        
        logger.info(f"🏥 {compartment_count} compartment entries for {patient_count} patients")
        
        # Test a sample query
        test_result = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE sp.param_name = 'patient'
            AND sp.value_reference LIKE 'Patient/%'
            AND r.resource_type = 'Condition'
        """)
        
        logger.info(f"🔍 Test query: Found {test_result} Conditions with patient search param")
    
    async def run(self):
        """Run all fixes."""
        try:
            await self.connect()
            
            logger.info("🚀 Starting FHIR relationship fixes")
            logger.info("=" * 60)
            
            await self.fix_references()
            await self.reindex_search_params()
            await self.populate_compartments()
            await self.verify_fixes()
            
            logger.info("\n" + "=" * 60)
            logger.info("📊 Final Statistics:")
            logger.info(f"  References fixed: {self.stats['references_fixed']}")
            logger.info(f"  Search params added: {self.stats['search_params_added']}")
            logger.info(f"  Compartments added: {self.stats['compartments_added']}")
            logger.info(f"  Errors: {self.stats['errors']}")
            
            if self.stats['errors'] == 0:
                logger.info("\n✅ All fixes completed successfully!")
            else:
                logger.warning(f"\n⚠️  Completed with {self.stats['errors']} errors")
            
        finally:
            await self.disconnect()


async def main():
    """Main entry point."""
    fixer = FHIRRelationshipFixer()
    await fixer.run()


if __name__ == "__main__":
    asyncio.run(main())