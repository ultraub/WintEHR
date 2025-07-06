#!/usr/bin/env python3
"""
Check if search tables exist using HTTP API
"""

import requests
import time

def check_search_tables_via_api():
    """Check search table status via API calls."""
    
    print("=== Checking Search Tables via API ===\n")
    
    BASE_URL = "http://localhost:8000"
    
    # Test 1: Create a condition and see if search parameters are stored
    print("1. Testing search parameter storage...")
    
    patient_id = "92675303-ca5b-136a-169b-e764c5753f06"
    timestamp = int(time.time())
    
    test_condition = {
        "resourceType": "Condition",
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": "active",
                "display": "active"
            }]
        },
        "code": {
            "text": f"TABLE_TEST_{timestamp}"
        },
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "recordedDate": time.strftime('%Y-%m-%dT%H:%M:%S+00:00')
    }
    
    print("   Creating test condition...")
    response = requests.post(
        f"{BASE_URL}/fhir/R4/Condition",
        headers={'Content-Type': 'application/json'},
        json=test_condition
    )
    
    if response.status_code in [200, 201]:
        # Get the ID
        location = response.headers.get('Location', '')
        condition_id = location.split('/')[-1] if location else None
        
        if condition_id:
            print(f"   ✅ Created condition: {condition_id}")
            
            # Test searches
            print("\n2. Testing search functionality...")
            
            # Test _id search (should work with our fix)
            id_response = requests.get(f"{BASE_URL}/fhir/R4/Condition?_id={condition_id}")
            id_works = id_response.status_code == 200 and id_response.json().get('total', 0) > 0
            print(f"   _id search: {'✅ Works' if id_works else '❌ Broken'}")
            
            # Test patient search (will fail if search_params table missing)
            patient_response = requests.get(f"{BASE_URL}/fhir/R4/Condition?patient={patient_id}")
            if patient_response.status_code == 200:
                patient_bundle = patient_response.json()
                our_condition_found = any(
                    entry['resource']['id'] == condition_id 
                    for entry in patient_bundle.get('entry', [])
                )
                print(f"   Patient search: {'✅ Works' if our_condition_found else '❌ Missing new condition'}")
                print(f"   Total conditions for patient: {patient_bundle.get('total', 0)}")
            else:
                print(f"   Patient search: ❌ Failed ({patient_response.status_code})")
            
            # Test subject search
            subject_response = requests.get(f"{BASE_URL}/fhir/R4/Condition?subject=Patient/{patient_id}")
            if subject_response.status_code == 200:
                subject_bundle = subject_response.json()
                our_condition_found = any(
                    entry['resource']['id'] == condition_id 
                    for entry in subject_bundle.get('entry', [])
                )
                print(f"   Subject search: {'✅ Works' if our_condition_found else '❌ Missing new condition'}")
                print(f"   Total conditions for subject: {subject_bundle.get('total', 0)}")
            else:
                print(f"   Subject search: ❌ Failed ({subject_response.status_code})")
        else:
            print("   ❌ Could not get condition ID")
    else:
        print(f"   ❌ Failed to create condition: {response.status_code}")
        if response.text:
            print(f"   Error: {response.text}")
    
    print("\n3. Analysis:")
    
    # Test original Synthea data search
    print("   Testing search with original Synthea data...")
    original_response = requests.get(f"{BASE_URL}/fhir/R4/Condition?patient={patient_id}&_count=5")
    if original_response.status_code == 200:
        original_bundle = original_response.json()
        original_count = original_bundle.get('total', 0)
        print(f"   Original conditions found: {original_count}")
        
        if original_count > 0:
            print("   ✅ Search works for original Synthea data")
            print("   ❌ Problem: New resources not being indexed for search")
            print("\n💡 Diagnosis: fhir.search_params table likely missing or not being populated")
            print("\n🔧 Solution: Run table initialization script")
        else:
            print("   ❌ No original conditions found - major search problem")
    else:
        print("   ❌ Failed to search original data")
    
    print("\n" + "="*60)
    print("RECOMMENDATION:")
    print("Run the table initialization script to create missing search tables:")
    print("python scripts/init_search_tables.py")
    print("="*60)

if __name__ == '__main__':
    check_search_tables_via_api()