#!/usr/bin/env python3
"""
Comprehensive test of search functionality after fixing parameter storage issues.
"""

import asyncio
import aiohttp
import json

BASE_URL = "http://localhost:8000/fhir/R4"

async def test_searches():
    async with aiohttp.ClientSession() as session:
        print("=== Testing Search Functionality ===\n")
        
        tests = [
            # Token searches
            {
                "name": "Patient gender search",
                "url": f"{BASE_URL}/Patient?gender=female&_count=5",
                "expected_field": "total",
                "min_expected": 100
            },
            {
                "name": "Observation status search",
                "url": f"{BASE_URL}/Observation?status=final&_count=5",
                "expected_field": "total",
                "min_expected": 50000
            },
            {
                "name": "Patient by ID search",
                "url": f"{BASE_URL}/Patient?_id=test-patient-123",
                "expected_field": "total",
                "min_expected": 1
            },
            {
                "name": "MedicationRequest intent search",
                "url": f"{BASE_URL}/MedicationRequest?intent=order&_count=5",
                "expected_field": "total",
                "min_expected": 1
            },
            
            # String searches
            {
                "name": "Patient name search",
                "url": f"{BASE_URL}/Patient?family=Davis923&_count=5",
                "expected_field": "total",
                "min_expected": 1
            },
            
            # Date searches
            {
                "name": "Patient birthdate search",
                "url": f"{BASE_URL}/Patient?birthdate=lt2000-01-01&_count=5",
                "expected_field": "total",
                "min_expected": 50
            },
            
            # Reference searches
            {
                "name": "Observation patient reference search",
                "url": f"{BASE_URL}/Observation?patient=test-patient-123&_count=5",
                "expected_field": "total",
                "min_expected": 1
            },
            
            # Composite searches
            {
                "name": "Observation code-value composite search",
                "url": f"{BASE_URL}/Observation?code-value-quantity=8302-2$gt130&_count=5",
                "expected_field": "total",
                "min_expected": 0  # May or may not have high body heights
            },
            
            # _has searches (reverse chaining)
            {
                "name": "Patient with observations",
                "url": f"{BASE_URL}/Patient?_has:Observation:patient:code=8310-5&_count=5",
                "expected_field": "total",
                "min_expected": 1
            },
            
            # Missing modifier
            {
                "name": "Patients without gender",
                "url": f"{BASE_URL}/Patient?gender:missing=true&_count=5",
                "expected_field": "total",
                "min_expected": 0  # Synthea data should have gender
            },
            
            # Multiple parameters
            {
                "name": "Complex multi-parameter search",
                "url": f"{BASE_URL}/Patient?gender=male&birthdate=ge1950-01-01&birthdate=le2000-01-01&_count=5",
                "expected_field": "total",
                "min_expected": 10
            }
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                async with session.get(test["url"], headers={"Accept": "application/fhir+json"}) as response:
                    if response.status == 200:
                        data = await response.json()
                        actual = data.get(test["expected_field"], 0)
                        
                        if actual >= test["min_expected"]:
                            print(f"✓ {test['name']}: {actual} results (expected >= {test['min_expected']})")
                            passed += 1
                        else:
                            print(f"✗ {test['name']}: {actual} results (expected >= {test['min_expected']})")
                            failed += 1
                            # Show sample response for debugging
                            if data.get('entry'):
                                print(f"  First result: {data['entry'][0]['resource']['resourceType']} {data['entry'][0]['resource']['id']}")
                    else:
                        print(f"✗ {test['name']}: HTTP {response.status}")
                        error_text = await response.text()
                        print(f"  Error: {error_text[:200]}")
                        failed += 1
            except Exception as e:
                print(f"✗ {test['name']}: Exception - {str(e)}")
                failed += 1
        
        print(f"\n=== Summary ===")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Total: {passed + failed}")
        
        if failed == 0:
            print("\n✅ All search tests passed!")
        else:
            print(f"\n⚠️  {failed} tests failed")

if __name__ == "__main__":
    asyncio.run(test_searches())