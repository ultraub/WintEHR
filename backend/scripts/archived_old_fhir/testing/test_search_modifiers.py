#!/usr/bin/env python3
"""
Test search modifiers (:exact, :contains, :missing, :not, :text, etc.) with real data.
Tests modifiers across different parameter types.

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


class SearchModifierTester:
    """Tests search modifiers with real data."""
    
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
        """Run all search modifier tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🔍 Testing Search Modifiers\n")
                print("="*60)
                
                # Test string modifiers
                await self.test_string_modifiers()
                
                # Test token modifiers
                await self.test_token_modifiers()
                
                # Test :missing modifier
                await self.test_missing_modifier()
                
                # Test :not modifier
                await self.test_not_modifier()
                
                # Test reference modifiers
                await self.test_reference_modifiers()
                
                # Test date modifiers
                await self.test_date_modifiers()
                
                # Print summary
                self.print_summary()
    
    async def test_string_modifiers(self):
        """Test string search modifiers (:exact, :contains)."""
        print("\n📝 Testing string modifiers...")
        
        # Get sample patient names
        result = await self.db.execute(text("""
            SELECT 
                resource->'name'->0->>'family' as family_name,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->'name'->0->>'family' IS NOT NULL
            GROUP BY family_name
            ORDER BY count DESC
            LIMIT 3
        """))
        names = result.fetchall()
        
        for name in names:
            # Test default (starts with)
            await self.test_search('Patient', 'name', name.family_name,
                                 expected_exact=name.count,
                                 description=f"Patient name={name.family_name} (default)")
            
            # Test :exact modifier
            await self.test_search('Patient', 'name:exact', name.family_name,
                                 expected_exact=name.count,
                                 description=f"Patient name:exact={name.family_name}")
            
            # Test :contains modifier with substring
            if len(name.family_name) > 3:
                substring = name.family_name[1:-1]  # Middle part
                contains_count = await self.db.execute(text("""
                    SELECT COUNT(*) as count
                    FROM fhir.resources
                    WHERE resource_type = 'Patient'
                    AND deleted = false
                    AND resource->'name'->0->>'family' ILIKE :pattern
                """), {'pattern': f'%{substring}%'})
                expected = contains_count.scalar()
                
                await self.test_search('Patient', 'name:contains', substring,
                                     expected_exact=expected,
                                     description=f"Patient name:contains={substring}")
        
        # Test with given names
        result = await self.db.execute(text("""
            SELECT 
                resource->'name'->0->'given'->0 as given_name,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->'name'->0->'given'->0 IS NOT NULL
            GROUP BY given_name
            ORDER BY count DESC
            LIMIT 2
        """))
        given_names = result.fetchall()
        
        for gn in given_names:
            given = gn.given_name.strip('"')
            if len(given) > 3:
                substring = given[0:3]  # First 3 chars
                await self.test_search('Patient', 'given:contains', substring,
                                     expected_min=1,
                                     description=f"Patient given:contains={substring}")
    
    async def test_token_modifiers(self):
        """Test token search modifiers (:text, :not, :exact)."""
        print("\n🏷️ Testing token modifiers...")
        
        # We already tested some token modifiers in test_token_searches.py
        # Here we'll test additional cases
        
        # Test :text modifier on CodeableConcept
        result = await self.db.execute(text("""
            SELECT 
                resource->'code'->>'text' as display_text,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            AND resource->'code'->>'text' IS NOT NULL
            GROUP BY display_text
            ORDER BY count DESC
            LIMIT 2
        """))
        conditions = result.fetchall()
        
        for cond in conditions:
            # Extract a word from the display text
            words = cond.display_text.split()
            if words:
                search_word = words[0]
                
                # Count how many conditions have this word in their text
                text_count = await self.db.execute(text("""
                    SELECT COUNT(*) as count
                    FROM fhir.resources
                    WHERE resource_type = 'Condition'
                    AND deleted = false
                    AND resource->'code'->>'text' ILIKE :pattern
                """), {'pattern': f'%{search_word}%'})
                expected = text_count.scalar()
                
                await self.test_search('Condition', 'code:text', search_word,
                                     expected_exact=expected,
                                     description=f"Condition code:text={search_word}")
        
        # Test :not modifier with status
        result = await self.db.execute(text("""
            SELECT 
                resource->>'status' as status,
                (SELECT COUNT(*) FROM fhir.resources 
                 WHERE resource_type = 'MedicationRequest' 
                 AND deleted = false
                 AND resource->>'status' != :status) as not_count
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
            AND resource->>'status' IS NOT NULL
            GROUP BY status
            LIMIT 1
        """), {'status': 'active'})
        med_status = result.fetchone()
        
        if med_status:
            await self.test_search('MedicationRequest', 'status:not', med_status.status,
                                 expected_exact=med_status.not_count,
                                 description=f"MedicationRequest status:not={med_status.status}")
    
    async def test_missing_modifier(self):
        """Test :missing modifier for presence/absence of values."""
        print("\n❓ Testing :missing modifier...")
        
        # Test Patient with missing birthDate
        missing_birth = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'birthDate' IS NULL
        """))
        expected = missing_birth.scalar()
        
        await self.test_search('Patient', 'birthdate:missing', 'true',
                             expected_exact=expected,
                             description="Patients with missing birthdate")
        
        # Test Patient with birthDate present
        has_birth = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'birthDate' IS NOT NULL
        """))
        expected = has_birth.scalar()
        
        await self.test_search('Patient', 'birthdate:missing', 'false',
                             expected_exact=expected,
                             description="Patients with birthdate present")
        
        # Test Observation with missing value
        missing_value = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'valueQuantity' IS NULL
            AND resource->'valueCodeableConcept' IS NULL
            AND resource->'valueString' IS NULL
            AND resource->'valueBoolean' IS NULL
            AND resource->'valueInteger' IS NULL
            AND resource->'valueRange' IS NULL
            AND resource->'valueRatio' IS NULL
            AND resource->'valueSampledData' IS NULL
            AND resource->'valueTime' IS NULL
            AND resource->'valueDateTime' IS NULL
            AND resource->'valuePeriod' IS NULL
        """))
        expected = missing_value.scalar()
        
        await self.test_search('Observation', 'value:missing', 'true',
                             expected_exact=expected,
                             description="Observations with missing value")
        
        # Test Condition with missing severity
        missing_severity = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            AND resource->'severity' IS NULL
        """))
        expected = missing_severity.scalar()
        
        await self.test_search('Condition', 'severity:missing', 'true',
                             expected_exact=expected,
                             description="Conditions with missing severity")
        
        # Test MedicationRequest with requester present
        has_requester = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
            AND resource->'requester' IS NOT NULL
        """))
        expected = has_requester.scalar()
        
        await self.test_search('MedicationRequest', 'requester:missing', 'false',
                             expected_exact=expected,
                             description="MedicationRequests with requester present")
    
    async def test_not_modifier(self):
        """Test :not modifier for negation."""
        print("\n🚫 Testing :not modifier...")
        
        # Test Observation NOT with specific code
        result = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                (SELECT COUNT(*) FROM fhir.resources 
                 WHERE resource_type = 'Observation' 
                 AND deleted = false
                 AND resource->'code'->'coding'->0->>'code' != :code) as not_count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """), {'code': '85354-9'})  # Blood pressure
        obs_code = result.fetchone()
        
        if obs_code:
            await self.test_search('Observation', 'code:not', obs_code.code,
                                 expected_exact=obs_code.not_count,
                                 description=f"Observations NOT with code {obs_code.code}")
        
        # Test Encounter NOT with specific class
        result = await self.db.execute(text("""
            SELECT 
                resource->'class'->>'code' as class_code,
                (SELECT COUNT(*) FROM fhir.resources 
                 WHERE resource_type = 'Encounter' 
                 AND deleted = false
                 AND resource->'class'->>'code' != :class) as not_count
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            AND resource->'class'->>'code' IS NOT NULL
            GROUP BY class_code
            LIMIT 1
        """), {'class': 'ambulatory'})
        enc_class = result.fetchone()
        
        if enc_class:
            await self.test_search('Encounter', 'class:not', enc_class.class_code,
                                 expected_exact=enc_class.not_count,
                                 description=f"Encounters NOT with class {enc_class.class_code}")
    
    async def test_reference_modifiers(self):
        """Test reference modifiers (:identifier, :type)."""
        print("\n🔗 Testing reference modifiers...")
        
        # Test :identifier modifier (search by identifier instead of id)
        # First, find a patient with an identifier
        result = await self.db.execute(text("""
            SELECT 
                p.fhir_id as patient_id,
                ident->>'value' as identifier_value,
                COUNT(o.id) as obs_count
            FROM fhir.resources p
            CROSS JOIN LATERAL jsonb_array_elements(p.resource->'identifier') as ident
            JOIN fhir.resources o ON (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                                   OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND o.resource_type = 'Observation'
            AND o.deleted = false
            GROUP BY p.fhir_id, identifier_value
            ORDER BY obs_count DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            await self.test_search('Observation', 'patient:identifier', patient.identifier_value,
                                 expected_exact=patient.obs_count,
                                 description=f"Observations by patient identifier {patient.identifier_value}")
        
        # Test searching with resource type specified
        if patient:
            await self.test_search('Observation', 'patient:Patient', patient.patient_id,
                                 expected_exact=patient.obs_count,
                                 description=f"Observations by patient with type specified")
    
    async def test_date_modifiers(self):
        """Test date modifiers (already covered in date tests, but add :missing)."""
        print("\n📅 Testing date modifiers...")
        
        # Test Encounter with missing period
        missing_period = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            AND resource->'period' IS NULL
        """))
        expected = missing_period.scalar()
        
        await self.test_search('Encounter', 'date:missing', 'true',
                             expected_exact=expected,
                             description="Encounters with missing period")
        
        # Test Procedure with performedDateTime present
        has_performed = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Procedure'
            AND deleted = false
            AND (resource->>'performedDateTime' IS NOT NULL
                 OR resource->'performedPeriod' IS NOT NULL)
        """))
        expected = has_performed.scalar()
        
        await self.test_search('Procedure', 'performed:missing', 'false',
                             expected_exact=expected,
                             description="Procedures with performed date/period present")
    
    async def test_search(self, resource_type: str, param_name: str, param_value: str,
                         expected_min: int = 0, expected_max: int = None,
                         expected_exact: int = None, description: str = None):
        """Test a single search parameter."""
        try:
            # Build query
            query = f"/{resource_type}?{param_name}={param_value}"
            
            # Execute search
            response = await self.client.get(query)
            
            if response.status_code == 400:
                # Modifier might not be implemented
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
        print("📊 SEARCH MODIFIER SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - String modifiers: :exact (exact match), :contains (substring)")
        print("  - Token modifiers: :text (display text), :not (negation), :exact")
        print("  - :missing=true/false tests presence/absence of values")
        print("  - Reference modifiers: :identifier (by identifier), :type (specify type)")
        print("  - Modifier support varies by parameter type")


async def main():
    """Run search modifier tests."""
    tester = SearchModifierTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())