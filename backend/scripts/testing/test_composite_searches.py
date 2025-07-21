#!/usr/bin/env python3
"""
Test composite search parameters with actual data combinations.
Composite parameters combine multiple search parameters with $ separator.

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


class CompositeSearchTester:
    """Tests composite search parameters with real data."""
    
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
        """Run all composite search tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🔗 Testing Composite Search Parameters\n")
                print("="*60)
                
                # Test Observation composite searches
                await self.test_observation_composites()
                
                # Test if other composites are supported
                await self.test_other_composites()
                
                # Print summary
                self.print_summary()
    
    async def test_observation_composites(self):
        """Test Observation composite search parameters."""
        print("\n🔬 Testing Observation composite searches...")
        
        # Get observations with both code and value for testing
        result = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'system' as code_system,
                resource->'valueQuantity'->>'value' as value,
                resource->'valueQuantity'->>'unit' as unit,
                resource->'valueQuantity'->>'system' as value_system,
                resource->'valueQuantity'->>'code' as value_code,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            AND resource->'valueQuantity'->>'value' IS NOT NULL
            GROUP BY code, code_system, value, unit, value_system, value_code
            ORDER BY count DESC
            LIMIT 10
        """))
        
        observations = result.fetchall()
        
        if observations:
            print(f"  Found {len(observations)} observation code-value combinations")
            
            # Test code-value-quantity composite
            for obs in observations[:3]:  # Test top 3
                # Format: code$value[comparator]number[unit]
                # Example: 8480-6$gt140 (systolic BP > 140)
                
                # Test exact value match
                composite_value = f"{obs.code}${obs.value}"
                await self.test_search('Observation', 'code-value-quantity', composite_value,
                                     expected_exact=obs.count,
                                     description=f"Code {obs.code} with value {obs.value}")
                
                # Test with comparator
                if obs.value and float(obs.value) > 0:
                    # Test greater than half the value
                    half_value = float(obs.value) / 2
                    composite_value = f"{obs.code}$gt{half_value}"
                    await self.test_search('Observation', 'code-value-quantity', composite_value,
                                         expected_min=obs.count,
                                         description=f"Code {obs.code} with value > {half_value}")
                    
                    # Test less than double the value
                    double_value = float(obs.value) * 2
                    composite_value = f"{obs.code}$lt{double_value}"
                    await self.test_search('Observation', 'code-value-quantity', composite_value,
                                         expected_min=obs.count,
                                         description=f"Code {obs.code} with value < {double_value}")
                
                # Test with system|code format
                if obs.code_system:
                    composite_value = f"{obs.code_system}|{obs.code}${obs.value}"
                    await self.test_search('Observation', 'code-value-quantity', composite_value,
                                         expected_exact=obs.count,
                                         description=f"System|code with value {obs.value}")
        
        # Test component-code-value-quantity for observations with components
        result = await self.db.execute(text("""
            SELECT 
                comp->'code'->'coding'->0->>'code' as component_code,
                comp->'valueQuantity'->>'value' as component_value,
                COUNT(*) as count
            FROM fhir.resources,
                 jsonb_array_elements(resource->'component') as comp
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND comp->'code'->'coding'->0->>'code' IS NOT NULL
            AND comp->'valueQuantity'->>'value' IS NOT NULL
            GROUP BY component_code, component_value
            ORDER BY count DESC
            LIMIT 5
        """))
        
        components = result.fetchall()
        
        if components:
            print(f"\n  Found {len(components)} observation component combinations")
            
            for comp in components[:2]:  # Test top 2
                composite_value = f"{comp.component_code}${comp.component_value}"
                await self.test_search('Observation', 'component-code-value-quantity', composite_value,
                                     expected_exact=comp.count,
                                     description=f"Component {comp.component_code} = {comp.component_value}")
    
    async def test_other_composites(self):
        """Test if other resource types support composite searches."""
        print("\n🏥 Testing other composite searches...")
        
        # According to FHIR R4, there are many composite parameters
        # Let's test a few common ones
        
        # Test Condition code-severity (if implemented)
        print("\n  Testing Condition composites...")
        
        # Check if any conditions have both code and severity
        result = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'severity'->'coding'->0->>'code' as severity,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            AND resource->'severity'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code, severity
            LIMIT 5
        """))
        
        code_severities = result.fetchall()
        
        if code_severities:
            for cs in code_severities[:1]:
                # Try composite search (may not be implemented)
                composite_value = f"{cs.code}${cs.severity}"
                response = await self.client.get(f"/Condition?code-severity={composite_value}")
                
                if response.status_code == 400:
                    print(f"  ⚠️  Condition code-severity composite not implemented")
                else:
                    bundle = response.json()
                    print(f"  ✅ Condition code-severity={composite_value}: {bundle.get('total', 0)} results")
        else:
            print("  ℹ️  No Conditions with both code and severity found")
        
        # Test MedicationRequest medication-status (if implemented)
        print("\n  Testing MedicationRequest composites...")
        
        result = await self.db.execute(text("""
            SELECT 
                resource->'medicationCodeableConcept'->'coding'->0->>'code' as med_code,
                resource->>'status' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest'
            AND deleted = false
            AND resource->'medicationCodeableConcept'->'coding'->0->>'code' IS NOT NULL
            AND resource->>'status' IS NOT NULL
            GROUP BY med_code, status
            LIMIT 5
        """))
        
        med_statuses = result.fetchall()
        
        if med_statuses:
            for ms in med_statuses[:1]:
                # Try composite search (may not be implemented)
                composite_value = f"{ms.med_code}${ms.status}"
                response = await self.client.get(f"/MedicationRequest?medication-status={composite_value}")
                
                if response.status_code == 400:
                    print(f"  ⚠️  MedicationRequest medication-status composite not implemented")
                else:
                    bundle = response.json()
                    print(f"  ✅ MedicationRequest medication-status={composite_value}: {bundle.get('total', 0)} results")
        else:
            print("  ℹ️  No MedicationRequests with both medication code and status found")
    
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
                # Might not be implemented
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
        print("📊 COMPOSITE SEARCH SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - Composite searches combine multiple parameters with '$' separator")
        print("  - Format: param1$param2$param3...")
        print("  - Common pattern: code$value for Observations")
        print("  - Requires special implementation beyond basic search")


async def main():
    """Run composite search tests."""
    tester = CompositeSearchTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())