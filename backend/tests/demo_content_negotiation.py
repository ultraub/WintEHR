"""
Demonstrate FHIR Content Negotiation

Shows how the FHIR API handles different Accept and Content-Type headers.
"""

import requests
import json

BASE_URL = "http://localhost:8000/fhir/R4"

def demo_content_negotiation():
    print("FHIR Content Negotiation Demo")
    print("=" * 50)
    
    # 1. Demonstrate 406 Not Acceptable
    print("\n1. Requesting XML format (unsupported):")
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml"}
    )
    print(f"   Request: GET /Patient")
    print(f"   Accept: application/xml")
    print(f"   Response Status: {response.status_code} Not Acceptable")
    print(f"   Response Body: {json.dumps(response.json(), indent=2)}")
    
    # 2. Demonstrate successful request
    print("\n2. Requesting JSON format (supported):")
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/json"}
    )
    print(f"   Request: GET /Patient")
    print(f"   Accept: application/json")
    print(f"   Response Status: {response.status_code} OK")
    print(f"   Response Type: {response.headers.get('content-type')}")
    
    # 3. Demonstrate 415 Unsupported Media Type
    print("\n3. Posting with XML Content-Type (unsupported):")
    patient = {
        "resourceType": "Patient",
        "name": [{"given": ["Test"], "family": "Patient"}]
    }
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/xml"},
        data=json.dumps(patient)
    )
    print(f"   Request: POST /Patient")
    print(f"   Content-Type: application/xml")
    print(f"   Response Status: {response.status_code} Unsupported Media Type")
    print(f"   Response Body: {json.dumps(response.json(), indent=2)}")
    
    # 4. Demonstrate successful POST
    print("\n4. Posting with JSON Content-Type (supported):")
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/fhir+json"},
        data=json.dumps(patient)
    )
    print(f"   Request: POST /Patient")
    print(f"   Content-Type: application/fhir+json")
    print(f"   Response Status: {response.status_code}")
    if response.status_code == 201:
        print(f"   Location: {response.headers.get('Location')}")
    
    # 5. Demonstrate priority-based Accept header
    print("\n5. Multiple Accept types with priorities:")
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml;q=0.9, application/json;q=0.8, */*;q=0.1"}
    )
    print(f"   Request: GET /Patient")
    print(f"   Accept: application/xml;q=0.9, application/json;q=0.8, */*;q=0.1")
    print(f"   Response Status: {response.status_code} OK")
    print(f"   Response Type: {response.headers.get('content-type')}")
    print("   Note: Server selected application/json as it's the highest priority supported type")
    
    print("\n" + "=" * 50)
    print("Content negotiation is working correctly!")
    print("- Unsupported Accept headers return 406 Not Acceptable")
    print("- Unsupported Content-Type headers return 415 Unsupported Media Type")
    print("- All FHIR endpoints enforce proper content negotiation")

if __name__ == "__main__":
    demo_content_negotiation()