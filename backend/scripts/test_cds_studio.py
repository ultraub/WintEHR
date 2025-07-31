#!/usr/bin/env python3
"""Test CDS Studio functionality"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_hooks_endpoint():
    """Test the hooks listing endpoint"""
    print("Testing /cds-hooks/hooks endpoint...")
    response = requests.get(f"{BASE_URL}/cds-hooks/hooks")
    
    if response.status_code == 200:
        hooks = response.json()
        print(f"✓ Found {len(hooks)} hooks")
        if hooks:
            print(f"  Sample hook: {hooks[0]['id']} - {hooks[0]['title']}")
    else:
        print(f"✗ Failed: {response.status_code}")
        return False
    return True

def test_services_discovery():
    """Test the CDS services discovery endpoint"""
    print("\nTesting /cds-hooks/cds-services endpoint...")
    response = requests.get(f"{BASE_URL}/cds-hooks/cds-services")
    
    if response.status_code == 200:
        data = response.json()
        services = data.get('services', [])
        print(f"✓ Found {len(services)} services")
        if services:
            print(f"  Sample service: {services[0]['id']} - {services[0]['title']}")
    else:
        print(f"✗ Failed: {response.status_code}")
        return False
    return True

def test_hook_execution():
    """Test executing a hook"""
    print("\nTesting hook execution...")
    
    # Get a patient ID first
    patients_response = requests.get(f"{BASE_URL}/fhir/R4/Patient?_count=1")
    if patients_response.status_code != 200:
        print("✗ Could not fetch patient for testing")
        return False
    
    patients = patients_response.json()
    if not patients.get('entry'):
        print("✗ No patients found in database")
        return False
    
    patient_id = patients['entry'][0]['resource']['id']
    print(f"  Using patient ID: {patient_id}")
    
    # Test patient-greeter hook
    hook_request = {
        "hook": "patient-view",
        "hookInstance": "test-instance",
        "context": {
            "patientId": patient_id,
            "userId": "test-user"
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/cds-hooks/cds-services/patient-greeter",
        json=hook_request,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        result = response.json()
        cards = result.get('cards', [])
        print(f"✓ Hook executed successfully, returned {len(cards)} cards")
        if cards:
            print(f"  First card: {cards[0]['summary']}")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False
    return True

def test_crud_operations():
    """Test creating, updating, and deleting a hook"""
    print("\nTesting CRUD operations...")
    
    # Create a test hook
    test_hook = {
        "id": "test-hook-123",
        "hook": "patient-view",
        "title": "Test Hook",
        "description": "Test hook for CDS Studio",
        "enabled": True,
        "conditions": [],
        "actions": [{
            "type": "show-card",
            "parameters": {
                "summary": "Test Card",
                "detail": "This is a test card",
                "indicator": "info"
            }
        }]
    }
    
    # Create
    response = requests.post(
        f"{BASE_URL}/cds-hooks/hooks",
        json=test_hook,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code in [200, 201]:
        print("✓ Hook created successfully")
    else:
        print(f"✗ Failed to create hook: {response.status_code}")
        return False
    
    # Read
    response = requests.get(f"{BASE_URL}/cds-hooks/hooks/test-hook-123")
    if response.status_code == 200:
        print("✓ Hook retrieved successfully")
    else:
        print(f"✗ Failed to retrieve hook: {response.status_code}")
    
    # Update
    test_hook['title'] = "Updated Test Hook"
    response = requests.put(
        f"{BASE_URL}/cds-hooks/hooks/test-hook-123",
        json=test_hook,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        print("✓ Hook updated successfully")
    else:
        print(f"✗ Failed to update hook: {response.status_code}")
    
    # Delete
    response = requests.delete(f"{BASE_URL}/cds-hooks/hooks/test-hook-123")
    if response.status_code in [200, 204]:
        print("✓ Hook deleted successfully")
    else:
        print(f"✗ Failed to delete hook: {response.status_code}")
    
    return True

def main():
    """Run all tests"""
    print("CDS Studio Functionality Test")
    print("=" * 50)
    
    all_passed = True
    
    # Run tests
    all_passed &= test_hooks_endpoint()
    all_passed &= test_services_discovery()
    all_passed &= test_hook_execution()
    all_passed &= test_crud_operations()
    
    print("\n" + "=" * 50)
    if all_passed:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())