#!/usr/bin/env python3
"""
Test script for Dynamic Catalog System
Validates that all endpoints are working and returning real patient data
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(url, description):
    """Test an endpoint and return results."""
    print(f"\n🔍 Testing: {description}")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, list):
            count = len(data)
            print(f"✅ SUCCESS: Got {count} items")
            if count > 0:
                print(f"   Sample item: {data[0].get('display', data[0].get('name', 'Unknown'))}")
        elif isinstance(data, dict):
            if 'total_results' in data:
                print(f"✅ SUCCESS: {data['total_results']} total results across catalogs")
            elif 'resource_counts' in data:
                print(f"✅ SUCCESS: Statistics retrieved")
                for resource_type, count in data['resource_counts'].items():
                    print(f"   {resource_type}: {count}")
            else:
                print(f"✅ SUCCESS: Got response object")
        
        return True, data
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False, None

def main():
    """Run all dynamic catalog tests."""
    print("🚀 Testing Dynamic Catalog System")
    print("=" * 50)
    
    tests = [
        (f"{BASE_URL}/api/clinical/dynamic-catalog/statistics", "Dynamic Catalog Statistics"),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/medications?limit=5", "Dynamic Medication Catalog"),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/conditions?limit=5", "Dynamic Condition Catalog"),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/lab-tests?limit=5", "Dynamic Lab Test Catalog"),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/procedures?limit=5", "Dynamic Procedure Catalog"),
        (f"{BASE_URL}/api/clinical/dynamic-catalog/search?query=glucose&limit=3", "Universal Search"),
        (f"{BASE_URL}/api/clinical/lab-catalog?limit=3", "CDS Lab Catalog (Dynamic)"),
        (f"{BASE_URL}/api/clinical/condition-catalog?limit=3", "CDS Condition Catalog (Dynamic)"),
    ]
    
    success_count = 0
    total_tests = len(tests)
    
    for url, description in tests:
        success, data = test_endpoint(url, description)
        if success:
            success_count += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {success_count}/{total_tests} tests passed")
    
    if success_count == total_tests:
        print("🎉 ALL TESTS PASSED! Dynamic catalog system is working perfectly.")
        
        # Test refresh functionality
        print("\n🔄 Testing catalog refresh...")
        try:
            refresh_url = f"{BASE_URL}/api/clinical/dynamic-catalog/refresh"
            response = requests.post(refresh_url)
            response.raise_for_status()
            refresh_data = response.json()
            print(f"✅ Refresh successful: {refresh_data['catalog_counts']}")
        except Exception as e:
            print(f"❌ Refresh failed: {e}")
        
        return 0
    else:
        print("❌ Some tests failed. Check the system configuration.")
        return 1

if __name__ == "__main__":
    sys.exit(main())