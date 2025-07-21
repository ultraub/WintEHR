#!/usr/bin/env python3
"""
Test reference search parameters with actual resource relationships.
Tests patient references, practitioner references, and other FHIR references.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import httpx

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class ReferenceSearchTester:
    """Tests reference search parameters with real data."""
    
    def __init__(self):
        self.api_base = "http://localhost:8000/fhir/R4"
        self.results = []
        self.stats = {
            'total': 0,
            'passed': 0,
            'failed': 0,
            'errors': []
        }
    
    async def run_all_tests(self):
        """Run all reference search tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🔗 Testing Reference Search Parameters\n")
                print("="*60)
                
                # Test basic reference searches
                await self.test_patient_references()
                await self.test_practitioner_references()
                await self.test_encounter_references()
                await self.test_organization_references()
                
                # Test reference formats
                await self.test_reference_formats()
                
                # Test chained references
                await self.test_chained_references()
                
                # Test reference aliases
                await self.test_reference_aliases()
                
                # Print summary
                self.print_summary()
    
    async def test_patient_references(self):
        """Test searches by patient reference."""
        print("\n📋 Testing Patient reference searches...")
        
        # Get a patient with multiple resource types
        result = await self.db.execute(text("""
            SELECT 
                c.compartment_id as patient_id,
                COUNT(DISTINCT r.resource_type) as resource_types,
                COUNT(*) as total_resources,
                string_agg(DISTINCT r.resource_type, ', ') as types
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND r.deleted = false
            GROUP BY c.compartment_id
            ORDER BY total_resources DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            print(f"  Using patient {patient.patient_id} with {patient.total_resources} resources")
            print(f"  Resource types: {patient.types}")
            
            # Test Observation by patient - handle both Patient/ and urn:uuid: formats
            obs_count = await self.db.execute(text("""
                SELECT COUNT(*) as count
                FROM fhir.resources r
                WHERE r.resource_type = 'Observation'
                AND r.deleted = false
                AND (r.resource->'subject'->>'reference' = :ref1
                     OR r.resource->'subject'->>'reference' = :ref2)
            """), {'ref1': f'Patient/{patient.patient_id}', 'ref2': f'urn:uuid:{patient.patient_id}'})
            expected = obs_count.scalar()
            
            await self.test_search('Observation', 'patient', patient.patient_id,
                                 expected_exact=expected,
                                 description=f"Observations for patient {patient.patient_id}")
            
            # Test with full reference format
            await self.test_search('Observation', 'patient', f'Patient/{patient.patient_id}',
                                 expected_exact=expected,
                                 description=f"Observations with full reference")
            
            # Test Condition by patient
            cond_count = await self.db.execute(text("""
                SELECT COUNT(*) as count
                FROM fhir.resources r
                WHERE r.resource_type = 'Condition'
                AND r.deleted = false
                AND (r.resource->'subject'->>'reference' = :ref1
                     OR r.resource->'subject'->>'reference' = :ref2)
            """), {'ref1': f'Patient/{patient.patient_id}', 'ref2': f'urn:uuid:{patient.patient_id}'})
            expected = cond_count.scalar()
            
            await self.test_search('Condition', 'patient', patient.patient_id,
                                 expected_exact=expected,
                                 description=f"Conditions for patient {patient.patient_id}")
            
            # Test MedicationRequest by patient
            med_count = await self.db.execute(text("""
                SELECT COUNT(*) as count
                FROM fhir.resources r
                WHERE r.resource_type = 'MedicationRequest'
                AND r.deleted = false
                AND (r.resource->'subject'->>'reference' = :ref1
                     OR r.resource->'subject'->>'reference' = :ref2)
            """), {'ref1': f'Patient/{patient.patient_id}', 'ref2': f'urn:uuid:{patient.patient_id}'})
            expected = med_count.scalar()
            
            await self.test_search('MedicationRequest', 'patient', patient.patient_id,
                                 expected_exact=expected,
                                 description=f"MedicationRequests for patient {patient.patient_id}")
    
    async def test_practitioner_references(self):
        """Test searches by practitioner reference."""
        print("\n👨‍⚕️ Testing Practitioner reference searches...")
        
        # Get a practitioner with encounters
        result = await self.db.execute(text("""
            WITH practitioner_refs AS (
                SELECT 
                    participant->'individual'->>'reference' as practitioner_ref
                FROM fhir.resources,
                     jsonb_array_elements(resource->'participant') as participant
                WHERE resource_type = 'Encounter'
                AND deleted = false
            )
            SELECT 
                practitioner_ref,
                COUNT(*) as encounter_count
            FROM practitioner_refs
            WHERE practitioner_ref LIKE 'Practitioner/%'
            GROUP BY practitioner_ref
            ORDER BY encounter_count DESC
            LIMIT 1
        """))
        
        practitioner = result.fetchone()
        
        if practitioner and practitioner.practitioner_ref:
            practitioner_id = practitioner.practitioner_ref.split('/')[-1]
            
            await self.test_search('Encounter', 'practitioner', practitioner_id,
                                 expected_min=1,
                                 description=f"Encounters with practitioner {practitioner_id}")
    
    async def test_encounter_references(self):
        """Test searches by encounter reference."""
        print("\n🏨 Testing Encounter reference searches...")
        
        # Get an encounter with observations
        result = await self.db.execute(text("""
            SELECT 
                resource->'encounter'->>'reference' as encounter_ref,
                COUNT(*) as obs_count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'encounter'->>'reference' IS NOT NULL
            GROUP BY encounter_ref
            ORDER BY obs_count DESC
            LIMIT 1
        """))
        encounter = result.fetchone()
        
        if encounter and encounter.encounter_ref:
            encounter_id = encounter.encounter_ref.split('/')[-1]
            
            await self.test_search('Observation', 'encounter', encounter_id,
                                 expected_exact=encounter.obs_count,
                                 description=f"Observations for encounter {encounter_id}")
            
            # Test with full reference
            await self.test_search('Observation', 'encounter', encounter.encounter_ref,
                                 expected_exact=encounter.obs_count,
                                 description=f"Observations with full encounter reference")
    
    async def test_organization_references(self):
        """Test searches by organization reference."""
        print("\n🏢 Testing Organization reference searches...")
        
        # Get patients with managing organization
        result = await self.db.execute(text("""
            SELECT 
                resource->'managingOrganization'->>'reference' as org_ref,
                COUNT(*) as patient_count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->'managingOrganization'->>'reference' IS NOT NULL
            GROUP BY org_ref
            ORDER BY patient_count DESC
            LIMIT 1
        """))
        org = result.fetchone()
        
        if org and org.org_ref:
            org_id = org.org_ref.split('/')[-1]
            
            await self.test_search('Patient', 'organization', org_id,
                                 expected_exact=org.patient_count,
                                 description=f"Patients managed by organization {org_id}")
    
    async def test_reference_formats(self):
        """Test different reference formats."""
        print("\n📝 Testing reference format variations...")
        
        # Get a sample patient reference
        result = await self.db.execute(text("""
            SELECT 
                r.fhir_id as patient_id,
                COUNT(DISTINCT obs.id) as obs_count
            FROM fhir.resources r
            JOIN fhir.resources obs ON obs.resource->'subject'->>'reference' = 'Patient/' || r.fhir_id
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND obs.resource_type = 'Observation'
            AND obs.deleted = false
            GROUP BY r.fhir_id
            HAVING COUNT(DISTINCT obs.id) > 0
            ORDER BY obs_count DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            # Test different formats - all should return same results
            formats = [
                (patient.patient_id, "Relative reference (ID only)"),
                (f"Patient/{patient.patient_id}", "Absolute reference"),
                (f"http://example.com/Patient/{patient.patient_id}", "Full URL reference"),
            ]
            
            for ref_format, desc in formats:
                await self.test_search('Observation', 'patient', ref_format,
                                     expected_exact=patient.obs_count,
                                     description=desc)
    
    async def test_chained_references(self):
        """Test chained reference searches."""
        print("\n⛓️ Testing chained reference searches...")
        
        # Note: Chained searches like patient.gender require special implementation
        # For now, we'll mark these as expected failures if not implemented
        
        # Test simple chained search
        try:
            response = await self.client.get("/Observation?patient.gender=female")
            if response.status_code == 400:
                print("  ⚠️  Chained searches not yet implemented (patient.gender)")
            else:
                bundle = response.json()
                print(f"  ✅ Chained search patient.gender=female returned {bundle.get('total', 0)} results")
        except Exception as e:
            print(f"  ❌ Chained search failed: {str(e)}")
    
    async def test_reference_aliases(self):
        """Test reference parameter aliases (subject vs patient)."""
        print("\n🏷️ Testing reference parameter aliases...")
        
        # Get a patient with observations
        result = await self.db.execute(text("""
            SELECT 
                fhir_id as patient_id,
                (SELECT COUNT(*) FROM fhir.resources o 
                 WHERE o.resource_type = 'Observation' 
                 AND o.deleted = false
                 AND o.resource->'subject'->>'reference' = 'Patient/' || r.fhir_id) as obs_count
            FROM fhir.resources r
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            ORDER BY obs_count DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient and patient.obs_count > 0:
            # Both 'patient' and 'subject' should work for Observation
            await self.test_search('Observation', 'patient', patient.patient_id,
                                 expected_exact=patient.obs_count,
                                 description="Search by 'patient' parameter")
            
            await self.test_search('Observation', 'subject', f'Patient/{patient.patient_id}',
                                 expected_exact=patient.obs_count,
                                 description="Search by 'subject' parameter")
    
    async def test_search(self, resource_type: str, param_name: str, param_value: str,
                         expected_min: int = 0, expected_max: int = None,
                         expected_exact: int = None, description: str = None):
        """Test a single search parameter."""
        try:
            # Build query
            query = f"/{resource_type}?{param_name}={param_value}"
            
            # Execute search
            response = await self.client.get(query)
            
            if response.status_code != 200:
                self.record_result(False, description or query,
                                 f"HTTP {response.status_code}: {response.text[:100]}")
                return
            
            bundle = response.json()
            total = bundle.get('total', 0)
            
            # Check expectations
            success = True
            error_msg = None
            
            if expected_exact is not None and total != expected_exact:
                success = False
                error_msg = f"Expected exactly {expected_exact}, got {total}"
            elif expected_min is not None and total < expected_min:
                success = False
                error_msg = f"Expected at least {expected_min}, got {total}"
            elif expected_max is not None and total > expected_max:
                success = False
                error_msg = f"Expected at most {expected_max}, got {total}"
            
            self.record_result(success, description or query, error_msg, total)
            
        except Exception as e:
            self.record_result(False, description or query, f"Exception: {str(e)}")
    
    def record_result(self, success: bool, description: str, error: str = None, count: int = None):
        """Record test result."""
        self.stats['total'] += 1
        
        if success:
            self.stats['passed'] += 1
            count_str = f" ({count} results)" if count is not None else ""
            print(f"  ✅ {description}{count_str}")
        else:
            self.stats['failed'] += 1
            self.stats['errors'].append({'test': description, 'error': error})
            print(f"  ❌ {description}: {error}")
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 REFERENCE SEARCH SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/self.stats['total']*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/self.stats['total']*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")


async def main():
    """Run reference search tests."""
    tester = ReferenceSearchTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())