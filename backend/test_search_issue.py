#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"
CONDITION_ID = "64fbe8a6-4059-f7fe-2bdf-8f2e4cdd69ed"
PATIENT_ID = "92675303-ca5b-136a-169b-e764c5753f06"

print("=== Testing Search Index Issue ===\n")

# 1. Direct read
print("1. Direct read of condition:")
response = requests.get(f"{BASE_URL}/fhir/R4/Condition/{CONDITION_ID}")
if response.status_code == 200:
    condition = response.json()
    print(f"   ID: {condition.get('id')}")
    print(f"   Text: {condition.get('code', {}).get('text', 'No text')}")
    print(f"   Patient: {condition.get('subject', {}).get('reference')}")
    print(f"   Clinical Status: {condition.get('clinicalStatus', {}).get('coding', [{}])[0].get('code', 'Unknown')}")
    print(f"   Version: {condition.get('meta', {}).get('versionId')}")
else:
    print(f"   Failed: {response.status_code}")

# 2. Search by ID
print("\n2. Search by _id parameter:")
response = requests.get(f"{BASE_URL}/fhir/R4/Condition", params={'_id': CONDITION_ID})
if response.status_code == 200:
    bundle = response.json()
    print(f"   Total found: {bundle.get('total', 0)}")
    if bundle.get('entry'):
        print("   ✅ Found in search results")
    else:
        print("   ❌ NOT found in search results")

# 3. Search by patient
print("\n3. Search by patient:")
response = requests.get(f"{BASE_URL}/fhir/R4/Condition", params={'patient': PATIENT_ID, '_count': '1000'})
if response.status_code == 200:
    bundle = response.json()
    print(f"   Total conditions for patient: {bundle.get('total', 0)}")
    
    # Look for our condition
    found = False
    if bundle.get('entry'):
        for entry in bundle['entry']:
            if entry['resource']['id'] == CONDITION_ID:
                found = True
                break
    
    if found:
        print(f"   ✅ Condition {CONDITION_ID} found in patient's conditions")
    else:
        print(f"   ❌ Condition {CONDITION_ID} NOT found in patient's conditions")

# 4. Search with all frontend parameters
print("\n4. Search with frontend parameters:")
params = {
    'patient': PATIENT_ID,
    '_count': '1000',
    '_sort': '-recorded-date'
}
response = requests.get(f"{BASE_URL}/fhir/R4/Condition", params=params)
if response.status_code == 200:
    bundle = response.json()
    print(f"   Total found: {bundle.get('total', 0)}")
    
    # Look for our condition
    found = False
    position = -1
    if bundle.get('entry'):
        for i, entry in enumerate(bundle['entry']):
            if entry['resource']['id'] == CONDITION_ID:
                found = True
                position = i
                break
    
    if found:
        print(f"   ✅ Condition found at position {position + 1}")
    else:
        print(f"   ❌ Condition NOT found with frontend parameters")