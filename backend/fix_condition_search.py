#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"
PATIENT_ID = "92675303-ca5b-136a-169b-e764c5753f06"

print("=== Creating a New Test Condition ===\n")

# Create a new condition that should appear in search
new_condition = {
    "resourceType": "Condition",
    "clinicalStatus": {
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
            "code": "active",
            "display": "active"
        }]
    },
    "verificationStatus": {
        "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            "code": "confirmed",
            "display": "Confirmed"
        }]
    },
    "code": {
        "coding": [{
            "system": "http://snomed.info/sct",
            "code": "44054006",
            "display": "Diabetes mellitus"
        }],
        "text": f"TEST CONDITION - Created at {time.strftime('%Y-%m-%d %H:%M:%S')}"
    },
    "subject": {
        "reference": f"Patient/{PATIENT_ID}"
    },
    "recordedDate": time.strftime('%Y-%m-%dT%H:%M:%S+00:00'),
    "onsetDateTime": time.strftime('%Y-%m-%dT%H:%M:%S+00:00')
}

# Create the condition
response = requests.post(
    f"{BASE_URL}/fhir/R4/Condition",
    headers={'Content-Type': 'application/json'},
    data=json.dumps(new_condition)
)

print(f"Create response status: {response.status_code}")
if response.status_code in [200, 201]:
    # Handle empty response body for 201 Created
    location = response.headers.get('Location', '')
    if location:
        condition_id = location.split('/')[-1]
    else:
        # Try to parse response body if available
        try:
            created_condition = response.json()
            condition_id = created_condition.get('id')
        except:
            print("Error: Could not get condition ID from response")
            condition_id = None
    
    if condition_id:
        print(f"Created condition ID: {condition_id}")
        
        # Get the full condition
        get_response = requests.get(f"{BASE_URL}/fhir/R4/Condition/{condition_id}")
        if get_response.status_code == 200:
            created_condition = get_response.json()
        else:
            print("Error: Could not retrieve created condition")
            created_condition = None
    
    # Wait a moment
    time.sleep(2)
    
    # Search for it
    print("\nSearching for the new condition...")
    search_response = requests.get(
        f"{BASE_URL}/fhir/R4/Condition",
        params={'patient': PATIENT_ID, '_count': '100', '_sort': '-recorded-date'}
    )
    
    if search_response.status_code == 200:
        bundle = search_response.json()
        found = False
        for entry in bundle.get('entry', []):
            if entry['resource']['id'] == condition_id:
                found = True
                print(f"✅ SUCCESS: New condition found in search results!")
                print(f"   Text: {entry['resource']['code']['text']}")
                break
        
        if not found:
            print("❌ FAILURE: New condition NOT found in search results")
    
    # Now update it
    print("\n=== Updating the New Condition ===")
    timestamp = f"UPDATED - {time.strftime('%Y-%m-%d %H:%M:%S')}"
    created_condition['code']['text'] = timestamp
    
    update_response = requests.put(
        f"{BASE_URL}/fhir/R4/Condition/{condition_id}",
        headers={'Content-Type': 'application/json'},
        data=json.dumps(created_condition)
    )
    
    print(f"Update response status: {update_response.status_code}")
    
    # Wait and search again
    time.sleep(2)
    print("\nSearching for the updated condition...")
    search_response = requests.get(
        f"{BASE_URL}/fhir/R4/Condition",
        params={'patient': PATIENT_ID, '_count': '100', '_sort': '-recorded-date'}
    )
    
    if search_response.status_code == 200:
        bundle = search_response.json()
        found = False
        for entry in bundle.get('entry', []):
            if entry['resource']['id'] == condition_id:
                found = True
                text = entry['resource']['code']['text']
                print(f"Found condition in search results!")
                print(f"   Text: {text}")
                if timestamp in text:
                    print("✅ SUCCESS: Update is visible in search results!")
                else:
                    print("❌ FAILURE: Update not reflected in search results")
                break
        
        if not found:
            print("❌ FAILURE: Updated condition NOT found in search results")
            
            # Try direct read
            direct_response = requests.get(f"{BASE_URL}/fhir/R4/Condition/{condition_id}")
            if direct_response.status_code == 200:
                direct_condition = direct_response.json()
                print(f"\nDirect read shows: {direct_condition['code']['text']}")
                print("This confirms the search index is not updating!")
else:
    print(f"Failed to create condition: {response.status_code}")
    print(response.text)