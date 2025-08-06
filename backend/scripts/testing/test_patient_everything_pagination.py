#!/usr/bin/env python3
"""
Test script to verify Patient/$everything pagination improvements.

Compares performance between the original in-memory pagination
and the optimized database-level pagination.
"""

import asyncio
import os
import sys
import time
import httpx
from datetime import datetime, timedelta
import statistics

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from database import get_db_context
from fhir.core.storage import FHIRStorageEngine
from fhir.core.operations import OperationHandler
from fhir.core.operations_optimized import OptimizedPatientEverythingOperation
from fhir.core.validators.synthea import SyntheaFHIRValidator
from sqlalchemy import text


async def get_patient_with_most_resources():
    """Find a patient with many resources for testing."""
    async with get_db_context() as db:
        # Find patient with most resources
        result = await db.execute(text("""
            SELECT 
                sp.value_string as patient_ref,
                COUNT(*) as resource_count
            FROM fhir.search_params sp
            JOIN fhir.resources r ON r.id = sp.resource_id
            WHERE sp.param_name IN ('patient', 'subject')
            AND sp.value_string LIKE 'Patient/%'
            AND r.deleted = false
            GROUP BY sp.value_string
            ORDER BY resource_count DESC
            LIMIT 1
        """))
        
        row = result.first()
        if row:
            patient_id = row.patient_ref.split('/')[1]
            return patient_id, row.resource_count
        return None, 0


async def test_original_pagination(patient_id: str, count: int = 10, offset: int = 0):
    """Test the original in-memory pagination implementation."""
    print(f"\n=== Testing Original Implementation ===")
    print(f"Patient ID: {patient_id}, Count: {count}, Offset: {offset}")
    
    start_time = time.time()
    memory_before = get_memory_usage()
    
    async with get_db_context() as db:
        storage = FHIRStorageEngine(db)
        validator = SyntheaFHIRValidator()
        handler = OperationHandler(storage, validator)
        
        # Execute operation
        result = await handler.execute_operation(
            "everything",
            "Patient",
            patient_id,
            {
                "_count": count,
                "_offset": offset
            }
        )
    
    execution_time = time.time() - start_time
    memory_after = get_memory_usage()
    memory_used = memory_after - memory_before
    
    print(f"Execution time: {execution_time:.3f}s")
    print(f"Memory used: {memory_used:.1f} MB")
    print(f"Total resources: {result.get('total', 0)}")
    print(f"Resources in page: {len(result.get('entry', []))}")
    
    return {
        "time": execution_time,
        "memory": memory_used,
        "total": result.get('total', 0),
        "page_size": len(result.get('entry', []))
    }


async def test_optimized_pagination(patient_id: str, count: int = 10, offset: int = 0):
    """Test the optimized database-level pagination implementation."""
    print(f"\n=== Testing Optimized Implementation ===")
    print(f"Patient ID: {patient_id}, Count: {count}, Offset: {offset}")
    
    start_time = time.time()
    memory_before = get_memory_usage()
    
    async with get_db_context() as db:
        storage = FHIRStorageEngine(db)
        optimized_handler = OptimizedPatientEverythingOperation(storage, db)
        
        # Execute operation
        result = await optimized_handler.execute(
            patient_id,
            {
                "_count": count,
                "_offset": offset
            }
        )
    
    execution_time = time.time() - start_time
    memory_after = get_memory_usage()
    memory_used = memory_after - memory_before
    
    print(f"Execution time: {execution_time:.3f}s")
    print(f"Memory used: {memory_used:.1f} MB")
    print(f"Total resources: {result.get('total', 0)}")
    print(f"Resources in page: {len(result.get('entry', []))}")
    
    # Verify pagination links
    if 'link' in result:
        print(f"Pagination links: {[link['relation'] for link in result['link']]}")
    
    return {
        "time": execution_time,
        "memory": memory_used,
        "total": result.get('total', 0),
        "page_size": len(result.get('entry', []))
    }


async def test_api_pagination():
    """Test pagination through the API endpoints."""
    print("\n=== Testing API Pagination ===")
    
    # First get a patient with resources
    patient_id, resource_count = await get_patient_with_most_resources()
    
    if not patient_id:
        print("No patients found with resources")
        return
    
    print(f"Testing with patient {patient_id} ({resource_count} resources)")
    
    base_url = "http://localhost:8000/fhir/R4"
    
    async with httpx.AsyncClient() as client:
        # Test different page sizes
        for page_size in [10, 50, 100]:
            print(f"\n--- Page size: {page_size} ---")
            
            # First page
            start_time = time.time()
            response = await client.get(
                f"{base_url}/Patient/{patient_id}/$everything?_count={page_size}"
            )
            first_page_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                print(f"First page time: {first_page_time:.3f}s")
                print(f"Total resources: {data.get('total', 0)}")
                print(f"Resources in page: {len(data.get('entry', []))}")
                
                # Test pagination links
                if 'link' in data:
                    next_link = next((l for l in data['link'] if l['relation'] == 'next'), None)
                    if next_link:
                        # Fetch second page
                        start_time = time.time()
                        response2 = await client.get(
                            f"{base_url}/{next_link['url']}"
                        )
                        second_page_time = time.time() - start_time
                        
                        if response2.status_code == 200:
                            data2 = response2.json()
                            print(f"Second page time: {second_page_time:.3f}s")
                            print(f"Resources in second page: {len(data2.get('entry', []))}")
                        else:
                            print(f"Failed to fetch second page: {response2.status_code}")
            else:
                print(f"Failed to fetch first page: {response.status_code}")


def get_memory_usage():
    """Get current memory usage in MB."""
    import psutil
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024


async def performance_comparison():
    """Compare performance between implementations."""
    print(f"Patient/$everything Pagination Testing - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Find a patient with many resources
    patient_id, resource_count = await get_patient_with_most_resources()
    
    if not patient_id:
        print("No patients found with resources")
        return
    
    print(f"\nSelected patient: {patient_id} with {resource_count} resources")
    
    # Test different scenarios
    test_cases = [
        {"count": 10, "offset": 0, "desc": "First small page"},
        {"count": 50, "offset": 0, "desc": "First medium page"},
        {"count": 100, "offset": 0, "desc": "First large page"},
        {"count": 50, "offset": 100, "desc": "Middle page"},
        {"count": 50, "offset": max(0, resource_count - 50), "desc": "Last page"}
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"\n{'=' * 80}")
        print(f"Test Case: {test_case['desc']}")
        print('=' * 80)
        
        # Test original implementation
        try:
            original_result = await test_original_pagination(
                patient_id, 
                test_case['count'], 
                test_case['offset']
            )
        except Exception as e:
            print(f"Original implementation error: {e}")
            original_result = None
        
        # Test optimized implementation
        try:
            optimized_result = await test_optimized_pagination(
                patient_id,
                test_case['count'],
                test_case['offset']
            )
        except Exception as e:
            print(f"Optimized implementation error: {e}")
            optimized_result = None
        
        if original_result and optimized_result:
            # Calculate improvements
            time_improvement = (original_result['time'] - optimized_result['time']) / original_result['time'] * 100
            memory_improvement = (original_result['memory'] - optimized_result['memory']) / original_result['memory'] * 100
            
            print(f"\n--- Performance Comparison ---")
            print(f"Time improvement: {time_improvement:.1f}%")
            print(f"Memory improvement: {memory_improvement:.1f}%")
            
            results.append({
                "case": test_case['desc'],
                "time_improvement": time_improvement,
                "memory_improvement": memory_improvement
            })
    
    # Test API pagination
    await test_api_pagination()
    
    # Summary
    if results:
        print("\n" + "=" * 80)
        print("PERFORMANCE SUMMARY")
        print("=" * 80)
        
        avg_time_improvement = statistics.mean([r['time_improvement'] for r in results])
        avg_memory_improvement = statistics.mean([r['memory_improvement'] for r in results])
        
        print(f"\nAverage time improvement: {avg_time_improvement:.1f}%")
        print(f"Average memory improvement: {avg_memory_improvement:.1f}%")
        
        print("\nDetailed results:")
        for result in results:
            print(f"  {result['case']:.<40} Time: {result['time_improvement']:>6.1f}%  Memory: {result['memory_improvement']:>6.1f}%")
        
        if avg_time_improvement > 20 and avg_memory_improvement > 20:
            print("\n✅ Pagination optimization successful!")
        else:
            print("\n⚠️  Optimization improvements are modest - may need further tuning")


async def main():
    """Run all pagination tests."""
    try:
        await performance_comparison()
        return True
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)