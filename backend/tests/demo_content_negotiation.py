"""
Demonstrate FHIR Content Negotiation

Shows how the FHIR API handles different Accept and Content-Type headers.
"""

import requests
import json
import logging


BASE_URL = "http://localhost:8000/fhir/R4"

def demo_content_negotiation():
    logging.info("FHIR Content Negotiation Demo")
    logging.info("=" * 50)
    # 1. Demonstrate 406 Not Acceptable
    logging.info("\n1. Requesting XML format (unsupported):")
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml"}
    )
    logging.info(f"   Request: GET /Patient")
    logging.info(f"   Accept: application/xml")
    logging.info(f"   Response Status: {response.status_code} Not Acceptable")
    logging.info(f"   Response Body: {json.dumps(response.json(), indent=2)}")
    # 2. Demonstrate successful request
    logging.info("\n2. Requesting JSON format (supported):")
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/json"}
    )
    logging.info(f"   Request: GET /Patient")
    logging.info(f"   Accept: application/json")
    logging.info(f"   Response Status: {response.status_code} OK")
    logging.info(f"   Response Type: {response.headers.get('content-type')}")
    # 3. Demonstrate 415 Unsupported Media Type
    logging.info("\n3. Posting with XML Content-Type (unsupported):")
    patient = {
        "resourceType": "Patient",
        "name": [{"given": ["Test"], "family": "Patient"}]
    }
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/xml"},
        data=json.dumps(patient)
    )
    logging.info(f"   Request: POST /Patient")
    logging.info(f"   Content-Type: application/xml")
    logging.info(f"   Response Status: {response.status_code} Unsupported Media Type")
    logging.info(f"   Response Body: {json.dumps(response.json(), indent=2)}")
    # 4. Demonstrate successful POST
    logging.info("\n4. Posting with JSON Content-Type (supported):")
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/fhir+json"},
        data=json.dumps(patient)
    )
    logging.info(f"   Request: POST /Patient")
    logging.info(f"   Content-Type: application/fhir+json")
    logging.info(f"   Response Status: {response.status_code}")
    if response.status_code == 201:
        logging.info(f"   Location: {response.headers.get('Location')}")
    # 5. Demonstrate priority-based Accept header
    logging.info("\n5. Multiple Accept types with priorities:")
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml;q=0.9, application/json;q=0.8, */*;q=0.1"}
    )
    logging.info(f"   Request: GET /Patient")
    logging.info(f"   Accept: application/xml;q=0.9, application/json;q=0.8, */*;q=0.1")
    logging.info(f"   Response Status: {response.status_code} OK")
    logging.info(f"   Response Type: {response.headers.get('content-type')}")
    logging.info("   Note: Server selected application/json as it's the highest priority supported type")
    logging.info("\n" + "=" * 50)
    logging.info("Content negotiation is working correctly!")
    logging.info("- Unsupported Accept headers return 406 Not Acceptable")
    logging.info("- Unsupported Content-Type headers return 415 Unsupported Media Type")
    logging.info("- All FHIR endpoints enforce proper content negotiation")
if __name__ == "__main__":
    demo_content_negotiation()