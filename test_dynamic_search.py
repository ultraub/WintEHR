#!/usr/bin/env python3
"""
Comprehensive Search Test for Dynamic Catalog System
Tests all search functionality and validates performance
"""

import requests
import json
import sys
import time

BASE_URL = "http://localhost:8000"

def test_search_endpoint(url, description, expected_min_results=0):
    """Test a search endpoint and validate results."""
    print(f"\n🔍 Testing: {description}")
    print(f"URL: {url}")
    
    start_time = time.time()
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        end_time = time.time()
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        if isinstance(data, list):
            count = len(data)
            print(f"✅ SUCCESS: Got {count} items ({response_time:.1f}ms)")
            if count > 0:
                print(f"   Sample: {data[0].get('display', data[0].get('name', 'Unknown'))}")
            success = count >= expected_min_results
        elif isinstance(data, dict):
            if 'total_results' in data:
                total = data['total_results']
                print(f"✅ SUCCESS: {total} total results across catalogs ({response_time:.1f}ms)")
                for category, items in data.items():
                    if isinstance(items, list) and len(items) > 0:
                        print(f"   {category}: {len(items)} items")
                success = total >= expected_min_results
            else:
                print(f"✅ SUCCESS: Got response object ({response_time:.1f}ms)")
                success = True
        else:
            print(f"❌ UNEXPECTED: Response format not recognized")
            success = False
        
        return success, data, response_time
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, None, 0

def main():
    """Run comprehensive search tests."""
    print("🚀 Testing Dynamic Catalog Search System")
    print("=" * 60)
    
    # Test individual catalog searches
    individual_tests = [
        (f"{BASE_URL}/api/clinical/dynamic-catalog/medications?search=amlodipine&limit=5", 
         "Medication Search: amlodipine", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/conditions?search=stress&limit=5", 
         "Condition Search: stress", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/lab-tests?search=glucose&limit=5", 
         "Lab Test Search: glucose", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/procedures?search=therapy&limit=5", 
         "Procedure Search: therapy", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/lab-tests?search=urine&limit=5", 
         "Lab Test Search: urine", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/medications?limit=10", 
         "Medication Catalog (no search)", 5),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/conditions?limit=10", 
         "Condition Catalog (no search)", 5),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/lab-tests?limit=10", 
         "Lab Test Catalog (no search)", 5),
    ]
    
    # Universal search tests  
    universal_tests = [
        (f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=glucose&limit=5", 
         "Universal Search: glucose", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=stress&limit=5", 
         "Universal Search: stress", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=urine&limit=5", 
         "Universal Search: urine", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=therapy&limit=5", 
         "Universal Search: therapy", 1),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=amlodipine&limit=5", 
         "Universal Search: amlodipine", 1),
    ]
    
    # CDS Hook integration tests
    cds_tests = [
        (f"{BASE_URL}/api/clinical/lab-catalog?search=glucose&limit=5", 
         "CDS Lab Catalog Search: glucose", 1),
        (f"{BASE_URL}/api/clinical/condition-catalog?search=stress&limit=5", 
         "CDS Condition Catalog Search: stress", 1),
        (f"{BASE_URL}/api/clinical/lab-catalog?limit=10", 
         "CDS Lab Catalog (no search)", 3),
        (f"{BASE_URL}/api/clinical/condition-catalog?limit=10", 
         "CDS Condition Catalog (no search)", 3),
    ]
    
    all_tests = individual_tests + universal_tests + cds_tests
    
    success_count = 0
    total_tests = len(all_tests)
    response_times = []
    
    for url, description, min_results in all_tests:
        success, data, response_time = test_search_endpoint(url, description, min_results)
        if success:
            success_count += 1
        if response_time > 0:
            response_times.append(response_time)
    
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {success_count}/{total_tests} tests passed")
    
    if response_times:
        avg_response_time = sum(response_times) / len(response_times)
        max_response_time = max(response_times)
        print(f"⚡ Performance: Avg {avg_response_time:.1f}ms, Max {max_response_time:.1f}ms")
    
    if success_count == total_tests:
        print("🎉 ALL SEARCH TESTS PASSED! Dynamic search system is working perfectly.")
        
        # Test cache refresh
        print("\n🔄 Testing search after cache refresh...")
        refresh_url = f"{BASE_URL}/api/clinical/dynamic-catalog/refresh"
        try:
            response = requests.post(refresh_url)
            response.raise_for_status()
            refresh_data = response.json()
            print(f"✅ Refresh successful: {refresh_data.get('catalog_counts', 'Unknown')}")
            
            # Test search after refresh
            success, data, _ = test_search_endpoint(
                f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=glucose&limit=3", 
                "Post-refresh search test", 1
            )
            if success:
                print("✅ Search functionality confirmed working after refresh")
            else:
                print("❌ Search failed after refresh")
                
        except Exception as e:
            print(f"❌ Refresh test failed: {e}")
        
        return 0
    else:
        print("❌ Some search tests failed. Check the system configuration.")
        return 1

if __name__ == "__main__":
    sys.exit(main())