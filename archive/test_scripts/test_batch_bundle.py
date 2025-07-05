import requests
import json

# Test batch bundle with GET requests
batch_bundle = {
    "resourceType": "Bundle",
    "type": "batch",
    "entry": [
        {
            "request": {
                "method": "GET",
                "url": "Patient?_count=1"
            }
        },
        {
            "request": {
                "method": "GET",
                "url": "Observation?_count=1"
            }
        },
        {
            "request": {
                "method": "GET",
                "url": "CapabilityStatement/metadata"  # Invalid - should fail
            }
        }
    ]
}

print("Testing batch bundle...")
response = requests.post("http://localhost:8000/fhir/R4/", json=batch_bundle)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"Response type: {data.get('type')}")
    entries = data.get('entry', [])
    for i, entry in enumerate(entries):
        req = batch_bundle['entry'][i]['request']
        resp = entry.get('response', {})
        print(f"  Entry {i}: {req['method']} {req['url']} -> Status {resp.get('status', 'None')}")
else:
    print(f"Error: {response.text}")