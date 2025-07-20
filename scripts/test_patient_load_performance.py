#!/usr/bin/env python3
"""
Test script to measure patient load performance improvements
"""

import asyncio
import time
import aiohttp
import json
from typing import Dict, List, Any

# Configuration
BASE_URL = "http://localhost:8000"
FHIR_BASE = f"{BASE_URL}/fhir/R4"

async def fetch_individual_resources(session: aiohttp.ClientSession, patient_id: str) -> Dict[str, Any]:
    """Original approach: individual API calls for each resource type"""
    start_time = time.time()
    
    resource_types = [
        ('Patient', f'/Patient/{patient_id}'),
        ('Encounter', f'/Encounter?patient={patient_id}&_count=10&_sort=-date'),
        ('Condition', f'/Condition?patient={patient_id}&_count=20&_sort=-recorded-date'),
        ('MedicationRequest', f'/MedicationRequest?patient={patient_id}&_count=20&_sort=-authored'),
        ('AllergyIntolerance', f'/AllergyIntolerance?patient={patient_id}&_count=10')
    ]
    
    results = {}
    total_resources = 0
    
    for resource_type, path in resource_types:
        try:
            async with session.get(f"{FHIR_BASE}{path}") as response:
                data = await response.json()
                
                if resource_type == 'Patient':
                    results[resource_type] = [data]
                    total_resources += 1
                else:
                    # It's a bundle
                    resources = [entry['resource'] for entry in data.get('entry', [])]
                    results[resource_type] = resources
                    total_resources += len(resources)
                    
        except Exception as e:
            print(f"Error fetching {resource_type}: {e}")
            results[resource_type] = []
    
    elapsed = time.time() - start_time
    return {
        'method': 'individual',
        'elapsed_seconds': elapsed,
        'total_resources': total_resources,
        'resource_counts': {k: len(v) for k, v in results.items()},
        'api_calls': len(resource_types)
    }

async def fetch_batch_resources(session: aiohttp.ClientSession, patient_id: str) -> Dict[str, Any]:
    """Optimized approach: FHIR batch request"""
    start_time = time.time()
    
    batch_bundle = {
        "resourceType": "Bundle",
        "type": "batch",
        "entry": [
            {"request": {"method": "GET", "url": f"Patient/{patient_id}"}},
            {"request": {"method": "GET", "url": f"Encounter?patient={patient_id}&_count=10&_sort=-date"}},
            {"request": {"method": "GET", "url": f"Condition?patient={patient_id}&_count=20&_sort=-recorded-date"}},
            {"request": {"method": "GET", "url": f"MedicationRequest?patient={patient_id}&_count=20&_sort=-authored"}},
            {"request": {"method": "GET", "url": f"AllergyIntolerance?patient={patient_id}&_count=10"}}
        ]
    }
    
    try:
        async with session.post(
            FHIR_BASE,
            json=batch_bundle,
            headers={'Content-Type': 'application/fhir+json'}
        ) as response:
            result = await response.json()
            
            total_resources = 0
            resource_counts = {}
            
            for entry in result.get('entry', []):
                if entry.get('response', {}).get('status', '').startswith('2'):
                    resource = entry.get('resource', {})
                    if resource.get('resourceType') == 'Bundle':
                        # Search result bundle
                        resource_type = None
                        count = 0
                        for sub_entry in resource.get('entry', []):
                            sub_resource = sub_entry.get('resource', {})
                            resource_type = sub_resource.get('resourceType')
                            count += 1
                            total_resources += 1
                        if resource_type:
                            resource_counts[resource_type] = count
                    else:
                        # Direct resource (Patient)
                        resource_type = resource.get('resourceType')
                        resource_counts[resource_type] = 1
                        total_resources += 1
            
            elapsed = time.time() - start_time
            return {
                'method': 'batch',
                'elapsed_seconds': elapsed,
                'total_resources': total_resources,
                'resource_counts': resource_counts,
                'api_calls': 1
            }
            
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            'method': 'batch',
            'elapsed_seconds': elapsed,
            'error': str(e),
            'api_calls': 1
        }

async def fetch_everything(session: aiohttp.ClientSession, patient_id: str) -> Dict[str, Any]:
    """Most optimized: Patient/$everything operation"""
    start_time = time.time()
    
    params = {
        '_type': 'Condition,MedicationRequest,AllergyIntolerance,Observation,Encounter',
        '_count': '100'
    }
    
    try:
        async with session.get(
            f"{FHIR_BASE}/Patient/{patient_id}/$everything",
            params=params
        ) as response:
            result = await response.json()
            
            total_resources = 0
            resource_counts = {}
            
            for entry in result.get('entry', []):
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType')
                if resource_type:
                    resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1
                    total_resources += 1
            
            elapsed = time.time() - start_time
            return {
                'method': '$everything',
                'elapsed_seconds': elapsed,
                'total_resources': total_resources,
                'resource_counts': resource_counts,
                'api_calls': 1
            }
            
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            'method': '$everything',
            'elapsed_seconds': elapsed,
            'error': str(e),
            'api_calls': 1
        }

async def test_patient_load_performance(patient_id: str):
    """Test all three approaches and compare performance"""
    print(f"\n{'='*60}")
    print(f"Testing Patient Load Performance for Patient: {patient_id}")
    print(f"{'='*60}\n")
    
    async with aiohttp.ClientSession() as session:
        # Test individual requests
        print("Testing individual requests...")
        individual_result = await fetch_individual_resources(session, patient_id)
        print_result(individual_result)
        
        # Test batch request
        print("\nTesting batch request...")
        batch_result = await fetch_batch_resources(session, patient_id)
        print_result(batch_result)
        
        # Test $everything
        print("\nTesting $everything operation...")
        everything_result = await fetch_everything(session, patient_id)
        print_result(everything_result)
        
        # Compare results
        print(f"\n{'='*60}")
        print("Performance Comparison:")
        print(f"{'='*60}")
        
        if 'error' not in individual_result:
            baseline = individual_result['elapsed_seconds']
            
            print(f"\nIndividual requests (baseline):")
            print(f"  Time: {baseline:.3f}s")
            print(f"  API calls: {individual_result['api_calls']}")
            
            if 'error' not in batch_result:
                batch_speedup = baseline / batch_result['elapsed_seconds']
                print(f"\nBatch request:")
                print(f"  Time: {batch_result['elapsed_seconds']:.3f}s")
                print(f"  Speedup: {batch_speedup:.1f}x faster")
                print(f"  API calls: {batch_result['api_calls']}")
            
            if 'error' not in everything_result:
                everything_speedup = baseline / everything_result['elapsed_seconds']
                print(f"\n$everything operation:")
                print(f"  Time: {everything_result['elapsed_seconds']:.3f}s")
                print(f"  Speedup: {everything_speedup:.1f}x faster")
                print(f"  API calls: {everything_result['api_calls']}")

def print_result(result: Dict[str, Any]):
    """Pretty print result"""
    if 'error' in result:
        print(f"  ❌ Error: {result['error']}")
    else:
        print(f"  ✅ Success in {result['elapsed_seconds']:.3f} seconds")
        print(f"  Total resources: {result['total_resources']}")
        print(f"  API calls: {result['api_calls']}")
        if result.get('resource_counts'):
            print("  Resource breakdown:")
            for resource_type, count in sorted(result['resource_counts'].items()):
                print(f"    - {resource_type}: {count}")

async def get_first_patient():
    """Get the first patient ID from the system"""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{FHIR_BASE}/Patient?_count=1") as response:
            result = await response.json()
            if result.get('entry'):
                return result['entry'][0]['resource']['id']
    return None

async def main():
    """Main test function"""
    # Get first patient or use provided ID
    patient_id = await get_first_patient()
    
    if not patient_id:
        print("No patients found in the system!")
        return
    
    await test_patient_load_performance(patient_id)
    
    # Test multiple patients to get average
    print(f"\n\n{'='*60}")
    print("Testing with 3 different patients for average performance...")
    print(f"{'='*60}")
    
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{FHIR_BASE}/Patient?_count=3") as response:
            result = await response.json()
            patient_ids = [entry['resource']['id'] for entry in result.get('entry', [])]
    
    if len(patient_ids) >= 3:
        for i, pid in enumerate(patient_ids[:3], 1):
            print(f"\n--- Patient {i}/3 ---")
            await test_patient_load_performance(pid)

if __name__ == "__main__":
    asyncio.run(main())