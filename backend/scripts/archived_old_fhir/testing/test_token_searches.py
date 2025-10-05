#!/usr/bin/env python3
"""
Test token search parameters with actual coded values from the database.
Tests identifiers, codes, status values, and other token-type parameters.

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


class TokenSearchTester:
    """Tests token search parameters with real data."""
    
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
        """Run all token search tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🔖 Testing Token Search Parameters\n")
                print("="*60)
                
                # Test each resource type
                await self.test_patient_tokens()
                await self.test_observation_tokens()
                await self.test_condition_tokens()
                await self.test_medication_request_tokens()
                await self.test_encounter_tokens()
                await self.test_procedure_tokens()
                
                # Test token search modifiers
                await self.test_token_modifiers()
                
                # Test system|code format
                await self.test_system_code_format()
                
                # Print summary
                self.print_summary()
    
    async def test_patient_tokens(self):
        """Test Patient token searches (identifier, gender)."""
        print("\n📋 Testing Patient token searches...")
        
        # Test gender tokens
        genders = await self.db.execute(text("""
            SELECT DISTINCT resource->>'gender' as gender, COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'gender' IS NOT NULL
            GROUP BY gender
        """))
        
        for row in genders:
            await self.test_search('Patient', 'gender', row.gender,
                                 expected_exact=row.count,
                                 description=f"Gender = {row.gender}")
        
        # Test identifiers
        identifiers = await self.db.execute(text("""
            SELECT 
                jsonb_array_elements(resource->'identifier')->>'value' as identifier,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->'identifier' IS NOT NULL
            GROUP BY identifier
            ORDER BY count DESC
            LIMIT 5
        """))
        
        for row in identifiers:
            await self.test_search('Patient', 'identifier', row.identifier,
                                 expected_min=1,
                                 description=f"Identifier = {row.identifier}")
    
    async def test_observation_tokens(self):
        """Test Observation token searches (code, status, category)."""
        print("\n🔬 Testing Observation token searches...")
        
        # Test codes
        codes = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'system' as system,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code, system
            ORDER BY count DESC
            LIMIT 5
        """))
        
        for row in codes:
            await self.test_search('Observation', 'code', row.code,
                                 expected_exact=row.count,
                                 description=f"Code = {row.code}")
            
            # Test with system|code format
            if row.system:
                await self.test_search('Observation', 'code', f"{row.system}|{row.code}",
                                     expected_exact=row.count,
                                     description=f"Code = {row.system}|{row.code}")
        
        # Test status
        statuses = await self.db.execute(text("""
            SELECT 
                resource->>'status' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->>'status' IS NOT NULL
            GROUP BY status
        """))
        
        for row in statuses:
            await self.test_search('Observation', 'status', row.status,
                                 expected_exact=row.count,
                                 description=f"Status = {row.status}")
        
        # Test category
        categories = await self.db.execute(text("""
            SELECT 
                resource->'category'->0->'coding'->0->>'code' as category,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'category'->0->'coding'->0->>'code' IS NOT NULL
            GROUP BY category
            ORDER BY count DESC
            LIMIT 5
        """))
        
        for row in categories:
            await self.test_search('Observation', 'category', row.category,
                                 expected_exact=row.count,
                                 description=f"Category = {row.category}")
    
    async def test_condition_tokens(self):
        """Test Condition token searches (code, clinical-status)."""
        print("\n🏥 Testing Condition token searches...")
        
        # Test clinical status
        statuses = await self.db.execute(text("""
            SELECT 
                resource->'clinicalStatus'->'coding'->0->>'code' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            AND resource->'clinicalStatus'->'coding'->0->>'code' IS NOT NULL
            GROUP BY status
        """))
        
        for row in statuses:
            await self.test_search('Condition', 'clinical-status', row.status,
                                 expected_exact=row.count,
                                 description=f"Clinical status = {row.status}")
        
        # Test condition codes
        codes = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->>'text' as display,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code, display
            ORDER BY count DESC
            LIMIT 5
        """))
        
        for row in codes:
            await self.test_search('Condition', 'code', row.code,
                                 expected_exact=row.count,
                                 description=f"Code = {row.code}")
    
    async def test_medication_request_tokens(self):
        """Test MedicationRequest token searches (status, intent)."""
        print("\n💊 Testing MedicationRequest token searches...")
        
        # Test status
        statuses = await self.db.execute(text("""
            SELECT 
                resource->>'status' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
            AND resource->>'status' IS NOT NULL
            GROUP BY status
        """))
        
        for row in statuses:
            await self.test_search('MedicationRequest', 'status', row.status,
                                 expected_exact=row.count,
                                 description=f"Status = {row.status}")
        
        # Test intent
        intents = await self.db.execute(text("""
            SELECT 
                resource->>'intent' as intent,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
            AND resource->>'intent' IS NOT NULL
            GROUP BY intent
        """))
        
        for row in intents:
            await self.test_search('MedicationRequest', 'intent', row.intent,
                                 expected_exact=row.count,
                                 description=f"Intent = {row.intent}")
    
    async def test_encounter_tokens(self):
        """Test Encounter token searches (status, class)."""
        print("\n🏨 Testing Encounter token searches...")
        
        # Test status
        statuses = await self.db.execute(text("""
            SELECT 
                resource->>'status' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            AND resource->>'status' IS NOT NULL
            GROUP BY status
        """))
        
        for row in statuses:
            await self.test_search('Encounter', 'status', row.status,
                                 expected_exact=row.count,
                                 description=f"Status = {row.status}")
        
        # Test class
        classes = await self.db.execute(text("""
            SELECT 
                resource->'class'->>'code' as class_code,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            AND resource->'class'->>'code' IS NOT NULL
            GROUP BY class_code
        """))
        
        for row in classes:
            await self.test_search('Encounter', 'class', row.class_code,
                                 expected_exact=row.count,
                                 description=f"Class = {row.class_code}")
    
    async def test_procedure_tokens(self):
        """Test Procedure token searches (status, code)."""
        print("\n🔧 Testing Procedure token searches...")
        
        # Test status
        statuses = await self.db.execute(text("""
            SELECT 
                resource->>'status' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Procedure'
            AND deleted = false
            AND resource->>'status' IS NOT NULL
            GROUP BY status
        """))
        
        for row in statuses:
            await self.test_search('Procedure', 'status', row.status,
                                 expected_exact=row.count,
                                 description=f"Status = {row.status}")
        
        # Test procedure codes
        codes = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Procedure'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code
            ORDER BY count DESC
            LIMIT 5
        """))
        
        for row in codes:
            await self.test_search('Procedure', 'code', row.code,
                                 expected_exact=row.count,
                                 description=f"Code = {row.code}")
    
    async def test_token_modifiers(self):
        """Test token search modifiers (:text, :not, :exact)."""
        print("\n🔍 Testing token search modifiers...")
        
        # Test :text modifier with gender
        await self.test_search('Patient', 'gender:text', 'male',
                             expected_min=1,
                             description="Gender text search for 'male'")
        
        # Test :not modifier
        # Get a gender value to test
        result = await self.db.execute(text("""
            SELECT resource->>'gender' as gender
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'gender' IS NOT NULL
            LIMIT 1
        """))
        sample = result.fetchone()
        
        if sample:
            # Count how many patients don't have this gender
            not_count = await self.db.execute(text("""
                SELECT COUNT(*) as count
                FROM fhir.resources
                WHERE resource_type = 'Patient'
                AND deleted = false
                AND (resource->>'gender' != :gender OR resource->>'gender' IS NULL)
            """), {'gender': sample.gender})
            expected = not_count.scalar()
            
            await self.test_search('Patient', 'gender:not', sample.gender,
                                 expected_exact=expected,
                                 description=f"Gender NOT {sample.gender}")
        
        # Test :exact modifier (should behave same as no modifier for tokens)
        await self.test_search('Patient', 'gender:exact', 'female',
                             expected_min=1,
                             description="Gender exact match for 'female'")
    
    async def test_system_code_format(self):
        """Test system|code format for token searches."""
        print("\n🏷️ Testing system|code format...")
        
        # Get a sample observation with system and code
        result = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->'coding'->0->>'code' as code,
                COUNT(*) OVER (PARTITION BY 
                    resource->'code'->'coding'->0->>'system',
                    resource->'code'->'coding'->0->>'code'
                ) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'system' IS NOT NULL
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            LIMIT 1
        """))
        sample = result.fetchone()
        
        if sample:
            # Test system|code format
            await self.test_search('Observation', 'code', f"{sample.system}|{sample.code}",
                                 expected_exact=sample.count,
                                 description=f"System|code = {sample.system}|{sample.code}")
            
            # Test |code format (empty system)
            await self.test_search('Observation', 'code', f"|{sample.code}",
                                 expected_min=sample.count,
                                 description=f"Any system with code = {sample.code}")
            
            # Test system| format (any code in system)
            await self.test_search('Observation', 'code', f"{sample.system}|",
                                 expected_min=1,
                                 description=f"Any code in system = {sample.system}")
    
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
        print("📊 TOKEN SEARCH SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/self.stats['total']*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/self.stats['total']*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")


async def main():
    """Run token search tests."""
    tester = TokenSearchTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())