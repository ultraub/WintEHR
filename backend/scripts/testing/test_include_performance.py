#!/usr/bin/env python3
"""
Test Include Operation Performance

Tests the performance improvement from batch fetching in _include operations.
"""

import asyncio
import time
import json
from typing import Dict, Tuple
import httpx
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class IncludePerformanceTester:
    def __init__(self):
        self.base_url = "http://localhost:8000/fhir/R4"
        self.results = {}
    
    async def run_tests(self):
        """Run all include performance tests."""
        print("🚀 Starting Include Operation Performance Tests...")
        print("=" * 60)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First, find suitable test data
            patient_id = await self._find_patient_with_data(client)
            if not patient_id:
                print("❌ No suitable patient found for testing")
                return
            
            print(f"\n📋 Using patient: {patient_id}")
            
            # Test 1: Single _include
            await self._test_single_include(client, patient_id)
            
            # Test 2: Multiple _include
            await self._test_multiple_includes(client, patient_id)
            
            # Test 3: _revinclude
            await self._test_revinclude(client, patient_id)
            
            # Test 4: Combined _include and _revinclude
            await self._test_combined_includes(client, patient_id)
            
            # Print summary
            self._print_summary()
    
    async def _find_patient_with_data(self, client: httpx.AsyncClient) -> str:
        """Find a patient with encounters and observations."""
        # Get a patient
        response = await client.get(f"{self.base_url}/Patient?_count=1")
        if response.status_code != 200:
            return None
        
        bundle = response.json()
        if not bundle.get('entry'):
            return None
        
        patient_id = bundle['entry'][0]['resource']['id']
        
        # Verify patient has encounters
        response = await client.get(
            f"{self.base_url}/Encounter?patient={patient_id}&_count=1"
        )
        if response.status_code == 200:
            bundle = response.json()
            if bundle.get('total', 0) > 0:
                return patient_id
        
        return None
    
    async def _test_single_include(self, client: httpx.AsyncClient, patient_id: str):
        """Test single _include performance."""
        print("\n1️⃣ Testing single _include (Encounter:patient)...")
        
        # Warm up
        await client.get(f"{self.base_url}/Encounter?patient={patient_id}&_count=5")
        
        # Test without include
        start = time.time()
        response = await client.get(
            f"{self.base_url}/Encounter?patient={patient_id}&_count=10"
        )
        time_without = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed: HTTP {response.status_code}")
            return
        
        bundle_without = response.json()
        count_without = len(bundle_without.get('entry', []))
        
        # Test with include
        start = time.time()
        response = await client.get(
            f"{self.base_url}/Encounter?patient={patient_id}&_count=10&_include=Encounter:patient"
        )
        time_with = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed with include: HTTP {response.status_code}")
            return
        
        bundle_with = response.json()
        count_with = len(bundle_with.get('entry', []))
        included_count = count_with - count_without
        
        # Calculate overhead
        overhead = ((time_with - time_without) / time_without * 100) if time_without > 0 else 0
        
        self.results['single_include'] = {
            'without_ms': time_without,
            'with_ms': time_with,
            'overhead_percent': overhead,
            'resources': count_without,
            'included': included_count
        }
        
        print(f"  ✓ Without _include: {time_without:.1f}ms ({count_without} resources)")
        print(f"  ✓ With _include: {time_with:.1f}ms ({count_with} resources, {included_count} included)")
        print(f"  ✓ Overhead: {overhead:.1f}%")
    
    async def _test_multiple_includes(self, client: httpx.AsyncClient, patient_id: str):
        """Test multiple _include performance."""
        print("\n2️⃣ Testing multiple _include parameters...")
        
        # Test without includes
        start = time.time()
        response = await client.get(
            f"{self.base_url}/MedicationRequest?patient={patient_id}&_count=10"
        )
        time_without = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed: HTTP {response.status_code}")
            return
        
        bundle_without = response.json()
        count_without = len(bundle_without.get('entry', []))
        
        # Test with multiple includes
        start = time.time()
        response = await client.get(
            f"{self.base_url}/MedicationRequest?patient={patient_id}&_count=10"
            "&_include=MedicationRequest:patient"
            "&_include=MedicationRequest:requester"
            "&_include=MedicationRequest:medication"
        )
        time_with = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed with includes: HTTP {response.status_code}")
            return
        
        bundle_with = response.json()
        count_with = len(bundle_with.get('entry', []))
        included_count = count_with - count_without
        
        # Calculate overhead
        overhead = ((time_with - time_without) / time_without * 100) if time_without > 0 else 0
        
        self.results['multiple_includes'] = {
            'without_ms': time_without,
            'with_ms': time_with,
            'overhead_percent': overhead,
            'resources': count_without,
            'included': included_count
        }
        
        print(f"  ✓ Without _include: {time_without:.1f}ms ({count_without} resources)")
        print(f"  ✓ With 3 _includes: {time_with:.1f}ms ({count_with} resources, {included_count} included)")
        print(f"  ✓ Overhead: {overhead:.1f}%")
    
    async def _test_revinclude(self, client: httpx.AsyncClient, patient_id: str):
        """Test _revinclude performance."""
        print("\n3️⃣ Testing _revinclude (Patient + Observations)...")
        
        # Test without revinclude
        start = time.time()
        response = await client.get(
            f"{self.base_url}/Patient/{patient_id}"
        )
        time_without = (time.time() - start) * 1000
        
        # Test with revinclude
        start = time.time()
        response = await client.get(
            f"{self.base_url}/Patient?_id={patient_id}"
            "&_revinclude=Observation:patient"
            "&_revinclude=Condition:patient"
        )
        time_with = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed with revinclude: HTTP {response.status_code}")
            return
        
        bundle_with = response.json()
        total_resources = len(bundle_with.get('entry', []))
        
        # Calculate overhead
        overhead = ((time_with - time_without) / time_without * 100) if time_without > 0 else 0
        
        self.results['revinclude'] = {
            'without_ms': time_without,
            'with_ms': time_with,
            'overhead_percent': overhead,
            'total_resources': total_resources
        }
        
        print(f"  ✓ Without _revinclude: {time_without:.1f}ms (1 resource)")
        print(f"  ✓ With _revinclude: {time_with:.1f}ms ({total_resources} resources)")
        print(f"  ✓ Overhead: {overhead:.1f}%")
    
    async def _test_combined_includes(self, client: httpx.AsyncClient, patient_id: str):
        """Test combined _include and _revinclude."""
        print("\n4️⃣ Testing combined _include and _revinclude...")
        
        # Test without any includes
        start = time.time()
        response = await client.get(
            f"{self.base_url}/Encounter?patient={patient_id}&_count=5"
        )
        time_without = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed: HTTP {response.status_code}")
            return
        
        bundle_without = response.json()
        count_without = len(bundle_without.get('entry', []))
        
        # Test with both includes and revincludes
        start = time.time()
        response = await client.get(
            f"{self.base_url}/Encounter?patient={patient_id}&_count=5"
            "&_include=Encounter:patient"
            "&_include=Encounter:practitioner"
            "&_revinclude=Observation:encounter"
        )
        time_with = (time.time() - start) * 1000
        
        if response.status_code != 200:
            print(f"❌ Failed with combined: HTTP {response.status_code}")
            return
        
        bundle_with = response.json()
        count_with = len(bundle_with.get('entry', []))
        included_count = count_with - count_without
        
        # Calculate overhead
        overhead = ((time_with - time_without) / time_without * 100) if time_without > 0 else 0
        
        self.results['combined'] = {
            'without_ms': time_without,
            'with_ms': time_with,
            'overhead_percent': overhead,
            'resources': count_without,
            'included': included_count
        }
        
        print(f"  ✓ Without includes: {time_without:.1f}ms ({count_without} resources)")
        print(f"  ✓ With combined: {time_with:.1f}ms ({count_with} resources, {included_count} included)")
        print(f"  ✓ Overhead: {overhead:.1f}%")
    
    def _print_summary(self):
        """Print test summary."""
        print("\n" + "=" * 60)
        print("📈 INCLUDE OPERATION PERFORMANCE SUMMARY")
        print("=" * 60)
        
        if 'single_include' in self.results:
            result = self.results['single_include']
            print(f"\nSingle _include:")
            print(f"  Base query: {result['without_ms']:.1f}ms")
            print(f"  With include: {result['with_ms']:.1f}ms")
            print(f"  Overhead: {result['overhead_percent']:.1f}%")
            print(f"  Resources fetched: {result['included']}")
        
        if 'multiple_includes' in self.results:
            result = self.results['multiple_includes']
            print(f"\nMultiple _includes (3):")
            print(f"  Base query: {result['without_ms']:.1f}ms")
            print(f"  With includes: {result['with_ms']:.1f}ms")
            print(f"  Overhead: {result['overhead_percent']:.1f}%")
            print(f"  Resources fetched: {result['included']}")
        
        if 'revinclude' in self.results:
            result = self.results['revinclude']
            print(f"\n_revinclude:")
            print(f"  Base query: {result['without_ms']:.1f}ms")
            print(f"  With revinclude: {result['with_ms']:.1f}ms")
            print(f"  Overhead: {result['overhead_percent']:.1f}%")
            print(f"  Total resources: {result['total_resources']}")
        
        if 'combined' in self.results:
            result = self.results['combined']
            print(f"\nCombined includes:")
            print(f"  Base query: {result['without_ms']:.1f}ms")
            print(f"  With combined: {result['with_ms']:.1f}ms")
            print(f"  Overhead: {result['overhead_percent']:.1f}%")
            print(f"  Resources fetched: {result['included']}")
        
        # Average overhead
        if self.results:
            avg_overhead = sum(r['overhead_percent'] for r in self.results.values()) / len(self.results)
            print(f"\n✅ Average overhead: {avg_overhead:.1f}%")
            
            if avg_overhead < 100:
                print("🎉 Include operations are well optimized!")
            elif avg_overhead < 200:
                print("✓ Include operations have acceptable performance")
            else:
                print("⚠️  Include operations may need further optimization")


async def main():
    tester = IncludePerformanceTester()
    await tester.run_tests()


if __name__ == "__main__":
    asyncio.run(main())