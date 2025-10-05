#!/usr/bin/env python3
"""
Test parameter combinations using actual multi-criteria data patterns.
Tests combining multiple search parameters in a single query.

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


class ParameterCombinationTester:
    """Tests search parameter combinations with real data."""
    
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
        """Run all parameter combination tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🔗 Testing Parameter Combinations\n")
                print("="*60)
                
                # Test Patient combinations
                await self.test_patient_combinations()
                
                # Test Observation combinations
                await self.test_observation_combinations()
                
                # Test Condition combinations
                await self.test_condition_combinations()
                
                # Test MedicationRequest combinations
                await self.test_medication_request_combinations()
                
                # Test Encounter combinations
                await self.test_encounter_combinations()
                
                # Test complex multi-resource queries
                await self.test_complex_combinations()
                
                # Print summary
                self.print_summary()
    
    async def test_patient_combinations(self):
        """Test Patient search parameter combinations."""
        print("\n👤 Testing Patient parameter combinations...")
        
        # Test gender + birthdate
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'gender' = 'female'
            AND resource->>'birthDate' < '1980-01-01'
        """))
        female_before_1980 = result.scalar()
        
        if female_before_1980:
            await self.test_search('Patient', 'gender=female&birthdate=lt1980-01-01',
                                 expected_exact=female_before_1980,
                                 description="Female patients born before 1980")
        
        # Test name + gender
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'gender' = 'male'
            AND (resource->'name'->0->>'family' LIKE 'S%'
                 OR resource->'name'->0->'given'->>0 LIKE 'S%')
        """))
        male_s_names = result.scalar()
        
        await self.test_search('Patient', 'gender=male&name=S',
                             expected_exact=male_s_names,
                             description="Male patients with names starting with S")
        
        # Test address + birthdate
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'birthDate' >= '1990-01-01'
            AND resource->'address'->0->>'state' = 'Massachusetts'
        """))
        ma_after_1990 = result.scalar()
        
        await self.test_search('Patient', 'birthdate=ge1990-01-01&address-state=Massachusetts',
                             expected_exact=ma_after_1990,
                             description="Patients born after 1990 in Massachusetts")
    
    async def test_observation_combinations(self):
        """Test Observation search parameter combinations."""
        print("\n🔬 Testing Observation parameter combinations...")
        
        # Test patient + code + status
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id, COUNT(o.id) as count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.resource_type = 'Patient'
                AND p.deleted = false
                AND (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND o.resource->>'status' = 'final'
            AND o.resource->'code'->'coding'->0->>'code' = '85354-9'  -- Blood pressure
            GROUP BY p.fhir_id
            ORDER BY count DESC
            LIMIT 1
        """))
        bp_patient = result.fetchone()
        
        if bp_patient:
            await self.test_search('Observation', 
                                 f'patient={bp_patient.patient_id}&code=85354-9&status=final',
                                 expected_exact=bp_patient.count,
                                 description="Final blood pressure observations for specific patient")
        
        # Test date range + category
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'category'->0->'coding'->0->>'code' = 'vital-signs'
            AND resource->>'effectiveDateTime' >= '2024-01-01'
            AND resource->>'effectiveDateTime' < '2025-01-01'
        """))
        vitals_2024 = result.scalar()
        
        await self.test_search('Observation', 
                             'category=vital-signs&date=ge2024-01-01&date=lt2025-01-01',
                             expected_exact=vitals_2024,
                             description="Vital signs in 2024")
        
        # Test patient + value quantity range
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id, COUNT(o.id) as count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.resource_type = 'Patient'
                AND p.deleted = false
                AND (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND o.resource->'valueQuantity'->>'value' IS NOT NULL
            AND CAST(o.resource->'valueQuantity'->>'value' AS NUMERIC) > 100
            AND CAST(o.resource->'valueQuantity'->>'value' AS NUMERIC) < 200
            GROUP BY p.fhir_id
            HAVING COUNT(o.id) > 5
            ORDER BY count DESC
            LIMIT 1
        """))
        value_patient = result.fetchone()
        
        if value_patient:
            await self.test_search('Observation',
                                 f'patient={value_patient.patient_id}&value-quantity=gt100&value-quantity=lt200',
                                 expected_exact=value_patient.count,
                                 description="Observations with value 100-200 for patient")
    
    async def test_condition_combinations(self):
        """Test Condition search parameter combinations."""
        print("\n🏥 Testing Condition parameter combinations...")
        
        # Test patient + clinical-status + code
        result = await self.db.execute(text("""
            SELECT 
                CASE 
                    WHEN c.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(c.resource->'subject'->>'reference', 9)
                    WHEN c.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(c.resource->'subject'->>'reference', 10)
                END as patient_id,
                COUNT(*) as count
            FROM fhir.resources c
            WHERE c.resource_type = 'Condition'
            AND c.deleted = false
            AND c.resource->'clinicalStatus'->'coding'->0->>'code' = 'active'
            AND c.resource->'code'->'coding'->0->>'code' = '44054006'  -- Diabetes
            AND (c.resource->'subject'->>'reference' LIKE 'Patient/%' 
                 OR c.resource->'subject'->>'reference' LIKE 'urn:uuid:%')
            GROUP BY 1
            ORDER BY count DESC
            LIMIT 1
        """))
        diabetes_patient = result.fetchone()
        
        if diabetes_patient:
            await self.test_search('Condition',
                                 f'patient={diabetes_patient.patient_id}&clinical-status=active&code=44054006',
                                 expected_exact=diabetes_patient.count,
                                 description="Active diabetes conditions for patient")
        
        # Test onset-date range + clinical-status
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            AND resource->'clinicalStatus'->'coding'->0->>'code' = 'active'
            AND resource->>'onsetDateTime' >= '2023-01-01'
        """))
        active_since_2023 = result.scalar()
        
        await self.test_search('Condition',
                             'clinical-status=active&onset-date=ge2023-01-01',
                             expected_exact=active_since_2023,
                             description="Active conditions with onset after 2023")
    
    async def test_medication_request_combinations(self):
        """Test MedicationRequest search parameter combinations."""
        print("\n💊 Testing MedicationRequest parameter combinations...")
        
        # Test patient + status + intent
        result = await self.db.execute(text("""
            SELECT 
                CASE 
                    WHEN m.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(m.resource->'subject'->>'reference', 9)
                    WHEN m.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(m.resource->'subject'->>'reference', 10)
                END as patient_id,
                COUNT(*) as count
            FROM fhir.resources m
            WHERE m.resource_type = 'MedicationRequest'
            AND m.deleted = false
            AND m.resource->>'status' = 'active'
            AND m.resource->>'intent' = 'order'
            AND (m.resource->'subject'->>'reference' LIKE 'Patient/%' 
                 OR m.resource->'subject'->>'reference' LIKE 'urn:uuid:%')
            GROUP BY 1
            HAVING COUNT(*) > 0
            ORDER BY count DESC
            LIMIT 1
        """))
        med_patient = result.fetchone()
        
        if med_patient:
            await self.test_search('MedicationRequest',
                                 f'patient={med_patient.patient_id}&status=active&intent=order',
                                 expected_exact=med_patient.count,
                                 description="Active medication orders for patient")
        
        # Test status + authoredon date range
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
            AND resource->>'status' = 'completed'
            AND resource->>'authoredOn' >= '2024-01-01'
            AND resource->>'authoredOn' < '2025-01-01'
        """))
        completed_2024 = result.scalar()
        
        await self.test_search('MedicationRequest',
                             'status=completed&authoredon=ge2024-01-01&authoredon=lt2025-01-01',
                             expected_exact=completed_2024,
                             description="Completed medication requests in 2024")
    
    async def test_encounter_combinations(self):
        """Test Encounter search parameter combinations."""
        print("\n🏨 Testing Encounter parameter combinations...")
        
        # Test patient + status + class
        result = await self.db.execute(text("""
            SELECT 
                CASE 
                    WHEN e.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(e.resource->'subject'->>'reference', 9)
                    WHEN e.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(e.resource->'subject'->>'reference', 10)
                END as patient_id,
                COUNT(*) as count
            FROM fhir.resources e
            WHERE e.resource_type = 'Encounter'
            AND e.deleted = false
            AND e.resource->>'status' = 'finished'
            AND e.resource->'class'->>'code' = 'ambulatory'
            AND (e.resource->'subject'->>'reference' LIKE 'Patient/%' 
                 OR e.resource->'subject'->>'reference' LIKE 'urn:uuid:%')
            GROUP BY 1
            HAVING COUNT(*) > 0
            ORDER BY count DESC
            LIMIT 1
        """))
        enc_patient = result.fetchone()
        
        if enc_patient:
            await self.test_search('Encounter',
                                 f'patient={enc_patient.patient_id}&status=finished&class=ambulatory',
                                 expected_exact=enc_patient.count,
                                 description="Finished ambulatory encounters for patient")
        
        # Test date range + type
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            AND resource->'period'->>'start' >= '2024-01-01'
            AND resource->'period'->>'start' < '2025-01-01'
            AND resource->'type'->0->'coding'->0->>'code' IS NOT NULL
        """))
        typed_2024 = result.scalar()
        
        await self.test_search('Encounter',
                             'date=ge2024-01-01&date=lt2025-01-01&type:missing=false',
                             expected_exact=typed_2024,
                             description="Typed encounters in 2024")
    
    async def test_complex_combinations(self):
        """Test complex multi-parameter combinations."""
        print("\n🔧 Testing complex parameter combinations...")
        
        # Test 4+ parameter combination on Observation
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources o
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND o.resource->>'status' = 'final'
            AND o.resource->'category'->0->'coding'->0->>'code' = 'vital-signs'
            AND o.resource->>'effectiveDateTime' >= '2024-01-01'
            AND o.resource->'valueQuantity'->>'value' IS NOT NULL
        """))
        complex_obs = result.scalar()
        
        await self.test_search('Observation',
                             'status=final&category=vital-signs&date=ge2024-01-01&value:missing=false',
                             expected_exact=complex_obs,
                             description="Final vital signs in 2024 with values")
        
        # Test Patient with 3+ parameters
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'gender' = 'female'
            AND resource->>'birthDate' >= '1970-01-01'
            AND resource->>'birthDate' < '1990-01-01'
            AND resource->'address'->0->>'city' IS NOT NULL
        """))
        complex_patient = result.scalar()
        
        await self.test_search('Patient',
                             'gender=female&birthdate=ge1970-01-01&birthdate=lt1990-01-01&address:missing=false',
                             expected_exact=complex_patient,
                             description="Female patients born 1970-1990 with address")
        
        # Test mixing different parameter types
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id, COUNT(c.id) as count
            FROM fhir.resources p
            JOIN fhir.resources c ON c.resource_type = 'Condition'
                AND c.deleted = false
                AND (c.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR c.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND p.resource->>'gender' = 'male'
            AND c.resource->'clinicalStatus'->'coding'->0->>'code' = 'active'
            AND c.resource->>'recordedDate' >= '2023-01-01'
            GROUP BY p.fhir_id
            HAVING COUNT(c.id) >= 2
            ORDER BY count DESC
            LIMIT 1
        """))
        multi_condition = result.fetchone()
        
        if multi_condition:
            # This combines reference, token, and date parameters
            await self.test_search('Condition',
                                 f'patient={multi_condition.patient_id}&clinical-status=active&recorded-date=ge2023-01-01',
                                 expected_exact=multi_condition.count,
                                 description="Active conditions recorded after 2023 for male patient")
    
    async def test_search(self, resource_type: str, query_params: str,
                         expected_min: int = 0, expected_max: int = None,
                         expected_exact: int = None, description: str = None):
        """Test a single search query."""
        try:
            # Build query
            query = f"/{resource_type}?{query_params}"
            
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
        print("📊 PARAMETER COMBINATION SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - Multiple parameters are combined with '&'")
        print("  - All parameters must match for a resource to be included")
        print("  - Date ranges use multiple date parameters")
        print("  - Complex queries test the system's ability to handle multiple criteria")


async def main():
    """Run parameter combination tests."""
    tester = ParameterCombinationTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())