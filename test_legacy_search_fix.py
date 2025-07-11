#!/usr/bin/env python3
"""
Quick test to verify legacy search service fixes are working
"""

import requests
import json

def test_dynamic_endpoints():
    """Test that our dynamic endpoints work"""
    base_url = "http://localhost:8000/api/clinical/dynamic-catalog"
    
    tests = [
        f"{base_url}/medications?search=amlodipine&limit=2",
        f"{base_url}/conditions?search=stress&limit=2", 
        f"{base_url}/lab-tests?search=glucose&limit=2",
        f"{base_url}/procedures?search=therapy&limit=2",
        f"{base_url}/search?query=glucose&limit=2"
    ]
    
    for url in tests:
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict) and 'total_results' in data:
                count = data['total_results']
            else:
                count = "unknown"
            print(f"✅ {url.split('/')[-1].split('?')[0]}: {count} results")
        except Exception as e:
            print(f"❌ {url}: {e}")

if __name__ == "__main__":
    print("🔍 Testing Dynamic Catalog Endpoints")
    test_dynamic_endpoints()