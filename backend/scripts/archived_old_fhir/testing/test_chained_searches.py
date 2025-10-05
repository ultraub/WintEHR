#!/usr/bin/env python3
"""
Test chained search parameters with actual reference chains.
Chained searches allow searching through reference relationships.

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


class ChainedSearchTester:
    """Tests chained search parameters with real data."""
    
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
        """Run all chained search tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("⛓️ Testing Chained Search Parameters\n")
                print("="*60)
                
                # Test simple chains
                await self.test_simple_chains()
                
                # Test reverse chains
                await self.test_reverse_chains()
                
                # Test multi-level chains
                await self.test_multi_level_chains()
                
                # Test chains with modifiers
                await self.test_chains_with_modifiers()
                
                # Print summary
                self.print_summary()
    
    async def test_simple_chains(self):
        """Test simple one-level chained searches."""
        print("\n🔗 Testing simple chained searches...")
        
        # Find observations where patient gender is female
        female_count = await self.db.execute(text("""
            SELECT COUNT(DISTINCT o.id) as count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.fhir_id = 
                CASE 
                    WHEN o.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(o.resource->'subject'->>'reference', 9)
                    WHEN o.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(o.resource->'subject'->>'reference', 10)
                    ELSE NULL
                END
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND p.resource->>'gender' = 'female'
        """))
        expected = female_count.scalar()
        
        await self.test_search('Observation', 'patient.gender=female',
                             expected_exact=expected,
                             description="Observations for female patients")
        
        # Find observations where patient gender is male
        male_count = await self.db.execute(text("""
            SELECT COUNT(DISTINCT o.id) as count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.fhir_id = 
                CASE 
                    WHEN o.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(o.resource->'subject'->>'reference', 9)
                    WHEN o.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(o.resource->'subject'->>'reference', 10)
                    ELSE NULL
                END
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND p.resource->>'gender' = 'male'
        """))
        expected = male_count.scalar()
        
        await self.test_search('Observation', 'patient.gender=male',
                             expected_exact=expected,
                             description="Observations for male patients")
        
        # Find MedicationRequests where patient has a specific name
        result = await self.db.execute(text("""
            SELECT p.resource->>'family' as family_name, COUNT(DISTINCT m.id) as count
            FROM fhir.resources m
            JOIN fhir.resources p ON p.fhir_id = 
                CASE 
                    WHEN m.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(m.resource->'subject'->>'reference', 9)
                    WHEN m.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(m.resource->'subject'->>'reference', 10)
                    ELSE NULL
                END
            WHERE m.resource_type = 'MedicationRequest'
            AND m.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND p.resource->'name'->0->>'family' IS NOT NULL
            GROUP BY family_name
            ORDER BY count DESC
            LIMIT 1
        """))
        patient_name = result.fetchone()
        
        if patient_name:
            await self.test_search('MedicationRequest', f'patient.name={patient_name.family_name}',
                                 expected_exact=patient_name.count,
                                 description=f"MedicationRequests for patients named {patient_name.family_name}")
        
        # Find Conditions where patient birthdate is before a certain date
        result = await self.db.execute(text("""
            SELECT COUNT(DISTINCT c.id) as count
            FROM fhir.resources c
            JOIN fhir.resources p ON p.fhir_id = 
                CASE 
                    WHEN c.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(c.resource->'subject'->>'reference', 9)
                    WHEN c.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(c.resource->'subject'->>'reference', 10)
                    ELSE NULL
                END
            WHERE c.resource_type = 'Condition'
            AND c.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND p.resource->>'birthDate' < '1980-01-01'
        """))
        expected = result.scalar()
        
        await self.test_search('Condition', 'patient.birthdate=lt1980-01-01',
                             expected_exact=expected,
                             description="Conditions for patients born before 1980")
        
        # Find Encounters where practitioner has a specific name
        result = await self.db.execute(text("""
            SELECT pr.resource->'name'->0->>'family' as practitioner_name, COUNT(DISTINCT e.id) as count
            FROM fhir.resources e,
                 jsonb_array_elements(e.resource->'participant') as participant
            JOIN fhir.resources pr ON pr.fhir_id = 
                CASE 
                    WHEN participant->'individual'->>'reference' LIKE 'Practitioner/%' 
                    THEN substring(participant->'individual'->>'reference', 14)
                    ELSE NULL
                END
            WHERE e.resource_type = 'Encounter'
            AND e.deleted = false
            AND pr.resource_type = 'Practitioner'
            AND pr.deleted = false
            AND pr.resource->'name'->0->>'family' IS NOT NULL
            GROUP BY practitioner_name
            ORDER BY count DESC
            LIMIT 1
        """))
        practitioner = result.fetchone()
        
        if practitioner:
            await self.test_search('Encounter', f'practitioner.name={practitioner.practitioner_name}',
                                 expected_exact=practitioner.count,
                                 description=f"Encounters with practitioner {practitioner.practitioner_name}")
    
    async def test_reverse_chains(self):
        """Test reverse chained searches using _has."""
        print("\n↩️ Testing reverse chained searches (_has)...")
        
        # Find patients who have active conditions
        result = await self.db.execute(text("""
            SELECT COUNT(DISTINCT p.id) as count
            FROM fhir.resources p
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND EXISTS (
                SELECT 1 FROM fhir.resources c
                WHERE c.resource_type = 'Condition'
                AND c.deleted = false
                AND (c.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR c.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
                AND c.resource->'clinicalStatus'->'coding'->0->>'code' = 'active'
            )
        """))
        expected = result.scalar()
        
        await self.test_search('Patient', '_has:Condition:patient:clinical-status=active',
                             expected_exact=expected,
                             description="Patients with active conditions")
        
        # Find patients who have observations with specific code
        result = await self.db.execute(text("""
            SELECT COUNT(DISTINCT p.id) as count
            FROM fhir.resources p
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND EXISTS (
                SELECT 1 FROM fhir.resources o
                WHERE o.resource_type = 'Observation'
                AND o.deleted = false
                AND (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
                AND o.resource->'code'->'coding'->0->>'code' = '85354-9'
            )
        """))
        expected = result.scalar()
        
        await self.test_search('Patient', '_has:Observation:patient:code=85354-9',
                             expected_exact=expected,
                             description="Patients with blood pressure observations")
        
        # Find practitioners who have encounters
        result = await self.db.execute(text("""
            SELECT COUNT(DISTINCT pr.id) as count
            FROM fhir.resources pr
            WHERE pr.resource_type = 'Practitioner'
            AND pr.deleted = false
            AND EXISTS (
                SELECT 1 FROM fhir.resources e,
                     jsonb_array_elements(e.resource->'participant') as participant
                WHERE e.resource_type = 'Encounter'
                AND e.deleted = false
                AND participant->'individual'->>'reference' = 'Practitioner/' || pr.fhir_id
            )
        """))
        expected = result.scalar()
        
        await self.test_search('Practitioner', '_has:Encounter:practitioner:_id=*',
                             expected_exact=expected,
                             description="Practitioners with any encounters")
    
    async def test_multi_level_chains(self):
        """Test multi-level chained searches."""
        print("\n🔗🔗 Testing multi-level chained searches...")
        
        # Find observations where patient's managing organization has a specific name
        # This would be: Observation -> Patient -> Organization
        # Format: patient.organization.name=value
        
        # First, find an organization with patients
        result = await self.db.execute(text("""
            SELECT o.resource->>'name' as org_name, COUNT(DISTINCT obs.id) as obs_count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.resource->'managingOrganization'->>'reference' = 'Organization/' || o.fhir_id
            JOIN fhir.resources obs ON (obs.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                                     OR obs.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE o.resource_type = 'Organization'
            AND o.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND obs.resource_type = 'Observation'
            AND obs.deleted = false
            AND o.resource->>'name' IS NOT NULL
            GROUP BY org_name
            ORDER BY obs_count DESC
            LIMIT 1
        """))
        org = result.fetchone()
        
        if org:
            await self.test_search('Observation', f'patient.organization.name={org.org_name}',
                                 expected_exact=org.obs_count,
                                 description=f"Observations for patients managed by {org.org_name}")
    
    async def test_chains_with_modifiers(self):
        """Test chained searches with search modifiers."""
        print("\n🔍 Testing chained searches with modifiers...")
        
        # Find observations where patient name contains a string
        result = await self.db.execute(text("""
            SELECT substring(p.resource->'name'->0->>'family', 1, 3) as name_part, COUNT(DISTINCT o.id) as count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.fhir_id = 
                CASE 
                    WHEN o.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(o.resource->'subject'->>'reference', 9)
                    WHEN o.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(o.resource->'subject'->>'reference', 10)
                    ELSE NULL
                END
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND p.resource->'name'->0->>'family' IS NOT NULL
            GROUP BY name_part
            HAVING COUNT(DISTINCT o.id) > 10
            ORDER BY count DESC
            LIMIT 1
        """))
        name_part = result.fetchone()
        
        if name_part:
            await self.test_search('Observation', f'patient.name:contains={name_part.name_part}',
                                 expected_min=name_part.count,
                                 description=f"Observations for patients with name containing '{name_part.name_part}'")
        
        # Test chained search with :not modifier
        # Find observations where patient is NOT male
        result = await self.db.execute(text("""
            SELECT COUNT(DISTINCT o.id) as count
            FROM fhir.resources o
            JOIN fhir.resources p ON p.fhir_id = 
                CASE 
                    WHEN o.resource->'subject'->>'reference' LIKE 'Patient/%' 
                    THEN substring(o.resource->'subject'->>'reference', 9)
                    WHEN o.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    THEN substring(o.resource->'subject'->>'reference', 10)
                    ELSE NULL
                END
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND p.resource_type = 'Patient'
            AND p.deleted = false
            AND (p.resource->>'gender' != 'male' OR p.resource->>'gender' IS NULL)
        """))
        expected = result.scalar()
        
        await self.test_search('Observation', 'patient.gender:not=male',
                             expected_exact=expected,
                             description="Observations for non-male patients")
    
    async def test_search(self, resource_type: str, query_params: str,
                         expected_min: int = 0, expected_max: int = None,
                         expected_exact: int = None, description: str = None):
        """Test a single search parameter."""
        try:
            # Build query
            query = f"/{resource_type}?{query_params}"
            
            # Execute search
            response = await self.client.get(query)
            
            if response.status_code == 400:
                # Chained search might not be implemented
                self.record_result(False, description or query,
                                 f"Not implemented (HTTP 400)")
                return
            elif response.status_code != 200:
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
        print("📊 CHAINED SEARCH SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - Chained searches allow querying through reference relationships")
        print("  - Format: reference.searchParam=value (e.g., patient.gender=female)")
        print("  - _has enables reverse chaining (find resources that are referenced)")
        print("  - Requires special implementation beyond basic search")


async def main():
    """Run chained search tests."""
    tester = ChainedSearchTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())