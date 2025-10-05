#!/usr/bin/env python3
"""
Test script to debug fhirclient search issue
"""

import sys
import traceback
from services.fhir_client_config import search_resources, get_fhir_server

def test_observation_search():
    """Test Observation search with category parameter"""
    print("="*60)
    print("Testing Observation search with category=laboratory")
    print("="*60)

    try:
        # This is what DynamicCatalogService is trying to do
        observations = search_resources('Observation', {
            'category': 'laboratory',
            '_count': 10
        })

        print(f"\n✓ Success! Found {len(observations)} observations")

        if observations:
            obs = observations[0]
            print(f"\nFirst observation:")
            print(f"  ID: {obs.id}")
            print(f"  Status: {obs.status}")
            if hasattr(obs, 'code') and obs.code:
                print(f"  Code: {obs.code.coding[0].display if obs.code.coding else 'N/A'}")

        return True

    except Exception as e:
        print(f"\n✗ Error occurred:")
        print(f"  Error type: {type(e).__name__}")
        print(f"  Error message: {str(e)}")
        print(f"\nFull traceback:")
        traceback.print_exc()
        return False

def test_direct_server_request():
    """Test direct server request to HAPI FHIR"""
    print("\n" + "="*60)
    print("Testing direct server request")
    print("="*60)

    try:
        server = get_fhir_server()

        # Direct HTTP request
        url = "Observation?category=laboratory&_count=10"
        print(f"\nRequesting: {url}")

        bundle = server.request_json(url)

        print(f"\n✓ Success! Bundle type: {bundle.get('type')}")
        print(f"  Total: {bundle.get('total', 0)}")
        print(f"  Entries: {len(bundle.get('entry', []))}")

        return True

    except Exception as e:
        print(f"\n✗ Error occurred:")
        print(f"  Error type: {type(e).__name__}")
        print(f"  Error message: {str(e)}")
        print(f"\nFull traceback:")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("FHIR Client Search Debugging\n")

    # Test 1: Try the search_resources function
    test1_success = test_observation_search()

    # Test 2: Try direct server request
    test2_success = test_direct_server_request()

    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"search_resources() test: {'✓ PASS' if test1_success else '✗ FAIL'}")
    print(f"Direct server request test: {'✓ PASS' if test2_success else '✗ FAIL'}")

    sys.exit(0 if (test1_success or test2_success) else 1)
