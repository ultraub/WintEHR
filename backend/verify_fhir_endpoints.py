#!/usr/bin/env python3
"""
Verify FHIR Endpoints
Tests that all basic FHIR endpoints are working correctly
"""

import requests
import json
import sys
from datetime import datetime

# Base URL for the FHIR server
BASE_URL = "http://localhost:8000/fhir/R4"

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def test_endpoint(method, path, description, params=None, data=None):
    """Test a single endpoint"""
    url = f"{BASE_URL}{path}"
    
    try:
        if method == "GET":
            response = requests.get(url, params=params)
        elif method == "POST":
            response = requests.post(url, json=data)
        else:
            response = requests.request(method, url, json=data)
        
        if response.status_code in [200, 201]:
            print(f"{GREEN}✓{RESET} {description}")
            return True, response.json()
        else:
            print(f"{RED}✗{RESET} {description}")
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False, None
    except Exception as e:
        print(f"{RED}✗{RESET} {description}")
        print(f"  Error: {str(e)}")
        return False, None

def main():
    print(f"\n{BLUE}=== FHIR Endpoint Verification ==={RESET}")
    print(f"Testing FHIR server at: {BASE_URL}\n")
    
    total_tests = 0
    passed_tests = 0
    
    # Test 1: Metadata endpoint
    total_tests += 1
    success, _ = test_endpoint("GET", "/metadata", "Capability Statement")
    if success:
        passed_tests += 1
    
    # Test 2: Patient search
    total_tests += 1
    success, data = test_endpoint("GET", "/Patient", "Patient - Search all")
    if success:
        passed_tests += 1
        patient_count = data.get('total', 0)
        print(f"  Found {patient_count} patients")
    
    # Test 3: Patient with parameters
    total_tests += 1
    success, _ = test_endpoint("GET", "/Patient", "Patient - Search by name", params={"family": "Walker"})
    if success:
        passed_tests += 1
    
    # Test 4: Patient pagination
    total_tests += 1
    success, _ = test_endpoint("GET", "/Patient", "Patient - Pagination", params={"_count": 5, "_offset": 0})
    if success:
        passed_tests += 1
    
    # Test 5: Encounter search
    total_tests += 1
    success, data = test_endpoint("GET", "/Encounter", "Encounter - Search all")
    if success:
        passed_tests += 1
        encounter_count = data.get('total', 0)
        print(f"  Found {encounter_count} encounters")
    
    # Test 6: Observation search
    total_tests += 1
    success, data = test_endpoint("GET", "/Observation", "Observation - Search all")
    if success:
        passed_tests += 1
        obs_count = data.get('total', 0)
        print(f"  Found {obs_count} observations")
    
    # Test 7: Observation by category
    total_tests += 1
    success, _ = test_endpoint("GET", "/Observation", "Observation - Vital signs", params={"category": "vital-signs"})
    if success:
        passed_tests += 1
    
    # Test 8: Condition search
    total_tests += 1
    success, data = test_endpoint("GET", "/Condition", "Condition - Search all")
    if success:
        passed_tests += 1
        condition_count = data.get('total', 0)
        print(f"  Found {condition_count} conditions")
    
    # Test 9: MedicationRequest search
    total_tests += 1
    success, data = test_endpoint("GET", "/MedicationRequest", "MedicationRequest - Search all")
    if success:
        passed_tests += 1
        med_count = data.get('total', 0)
        print(f"  Found {med_count} medication requests")
    
    # Test 10: Practitioner search
    total_tests += 1
    success, data = test_endpoint("GET", "/Practitioner", "Practitioner - Search all")
    if success:
        passed_tests += 1
        prac_count = data.get('total', 0)
        print(f"  Found {prac_count} practitioners")
    
    # Test 11: Organization search
    total_tests += 1
    success, data = test_endpoint("GET", "/Organization", "Organization - Search all")
    if success:
        passed_tests += 1
        org_count = data.get('total', 0)
        print(f"  Found {org_count} organizations")
    
    # Test 12: Location search
    total_tests += 1
    success, data = test_endpoint("GET", "/Location", "Location - Search all")
    if success:
        passed_tests += 1
        loc_count = data.get('total', 0)
        print(f"  Found {loc_count} locations")
    
    # Test 13: Chained query
    total_tests += 1
    success, _ = test_endpoint("GET", "/Observation", "Observation - Chained query", params={"subject.family": "Walker"})
    if success:
        passed_tests += 1
    
    # Test 14: Date range query
    total_tests += 1
    success, _ = test_endpoint("GET", "/Encounter", "Encounter - Date range", params={"date": "ge2020-01-01", "date": "le2024-12-31"})
    if success:
        passed_tests += 1
    
    # Test 15: Include resources
    total_tests += 1
    success, _ = test_endpoint("GET", "/Encounter", "Encounter - With includes", params={"_include": "Encounter:patient", "_count": 5})
    if success:
        passed_tests += 1
    
    # Test 16: Reverse include
    total_tests += 1
    success, _ = test_endpoint("GET", "/Patient", "Patient - Reverse include", params={"_id": "91691801-042a-463c-ad6d-648cd4264ca8", "_revinclude": "Observation:patient"})
    if success:
        passed_tests += 1
    
    # Test 17: Sorting
    total_tests += 1
    success, _ = test_endpoint("GET", "/Patient", "Patient - Sort by name", params={"_sort": "family,given"})
    if success:
        passed_tests += 1
    
    # Test 18: Search with OR
    total_tests += 1
    success, _ = test_endpoint("GET", "/Patient", "Patient - OR search", params={"family": "Walker,Williams"})
    if success:
        passed_tests += 1
    
    # Summary
    print(f"\n{BLUE}=== Summary ==={RESET}")
    print(f"Total tests: {total_tests}")
    print(f"Passed: {GREEN}{passed_tests}{RESET}")
    print(f"Failed: {RED}{total_tests - passed_tests}{RESET}")
    
    if passed_tests == total_tests:
        print(f"\n{GREEN}All FHIR endpoints are working correctly!{RESET}")
        return 0
    else:
        print(f"\n{YELLOW}Some endpoints failed. Please check the errors above.{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())