"""
Test FHIR Content Negotiation

Tests that the FHIR API properly handles Accept and Content-Type headers.
"""

import requests
import json

BASE_URL = "http://localhost:8000/fhir/R4"

def test_unsupported_accept_header():
    """Test that unsupported Accept header returns 406."""
    print("\n=== Testing Unsupported Accept Header ===")
    
    # Test with application/xml
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml"}
    )
    print(f"GET /Patient with Accept: application/xml")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    assert response.status_code == 406, f"Expected 406, got {response.status_code}"
    
    # Test with text/html
    response = requests.get(
        f"{BASE_URL}/Patient/123",
        headers={"Accept": "text/html"}
    )
    print(f"\nGET /Patient/123 with Accept: text/html")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    assert response.status_code == 406, f"Expected 406, got {response.status_code}"

def test_supported_accept_headers():
    """Test that supported Accept headers work correctly."""
    print("\n=== Testing Supported Accept Headers ===")
    
    # Test with application/json
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/json"}
    )
    print(f"GET /Patient with Accept: application/json")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    # Test with application/fhir+json
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/fhir+json"}
    )
    print(f"\nGET /Patient with Accept: application/fhir+json")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    # Test with */*
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "*/*"}
    )
    print(f"\nGET /Patient with Accept: */*")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

def test_unsupported_content_type():
    """Test that unsupported Content-Type returns 415."""
    print("\n=== Testing Unsupported Content-Type ===")
    
    patient_data = {
        "resourceType": "Patient",
        "name": [{"given": ["Test"], "family": "Patient"}]
    }
    
    # Test with application/xml
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/xml"},
        data=json.dumps(patient_data)
    )
    print(f"POST /Patient with Content-Type: application/xml")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    assert response.status_code == 415, f"Expected 415, got {response.status_code}"
    
    # Test with text/plain
    response = requests.put(
        f"{BASE_URL}/Patient/123",
        headers={"Content-Type": "text/plain"},
        data=json.dumps(patient_data)
    )
    print(f"\nPUT /Patient/123 with Content-Type: text/plain")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    assert response.status_code == 415, f"Expected 415, got {response.status_code}"

def test_missing_content_type():
    """Test that missing Content-Type for POST/PUT returns 415."""
    print("\n=== Testing Missing Content-Type ===")
    
    patient_data = {
        "resourceType": "Patient",
        "name": [{"given": ["Test"], "family": "Patient"}]
    }
    
    # Test POST without Content-Type
    response = requests.post(
        f"{BASE_URL}/Patient",
        data=json.dumps(patient_data)
    )
    print(f"POST /Patient without Content-Type header")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    assert response.status_code == 415, f"Expected 415, got {response.status_code}"

def test_supported_content_types():
    """Test that supported Content-Types work correctly."""
    print("\n=== Testing Supported Content-Types ===")
    
    patient_data = {
        "resourceType": "Patient",
        "name": [{"given": ["Test"], "family": "Patient"}]
    }
    
    # Test with application/json
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/json"},
        data=json.dumps(patient_data)
    )
    print(f"POST /Patient with Content-Type: application/json")
    print(f"Status Code: {response.status_code}")
    # Should be 201 (created) or 400 (validation error), not 415
    assert response.status_code != 415, f"Should not get 415 with supported Content-Type"
    
    # Test with application/fhir+json
    response = requests.post(
        f"{BASE_URL}/Patient",
        headers={"Content-Type": "application/fhir+json"},
        data=json.dumps(patient_data)
    )
    print(f"\nPOST /Patient with Content-Type: application/fhir+json")
    print(f"Status Code: {response.status_code}")
    # Should be 201 (created) or 400 (validation error), not 415
    assert response.status_code != 415, f"Should not get 415 with supported Content-Type"

def test_metadata_endpoint_bypass():
    """Test that metadata endpoint bypasses content negotiation."""
    print("\n=== Testing Metadata Endpoint Bypass ===")
    
    # Test metadata with unsupported Accept header
    response = requests.get(
        f"{BASE_URL}/metadata",
        headers={"Accept": "application/xml"}
    )
    print(f"GET /metadata with Accept: application/xml")
    print(f"Status Code: {response.status_code}")
    
    # Metadata endpoint should return 200 even with unsupported Accept
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

def test_multiple_accept_types():
    """Test Accept header with multiple media types and quality values."""
    print("\n=== Testing Multiple Accept Types ===")
    
    # Test with mixed supported and unsupported types
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml, application/json;q=0.8, text/html;q=0.5"}
    )
    print(f"GET /Patient with Accept: application/xml, application/json;q=0.8, text/html;q=0.5")
    print(f"Status Code: {response.status_code}")
    
    # Should be 200 because application/json is supported
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    # Test with only unsupported types
    response = requests.get(
        f"{BASE_URL}/Patient",
        headers={"Accept": "application/xml, text/html"}
    )
    print(f"\nGET /Patient with Accept: application/xml, text/html")
    print(f"Status Code: {response.status_code}")
    
    # Should be 406 because none are supported
    assert response.status_code == 406, f"Expected 406, got {response.status_code}"

if __name__ == "__main__":
    print("Testing FHIR Content Negotiation")
    print("================================")
    
    try:
        test_unsupported_accept_header()
        print("\n✓ Unsupported Accept header tests passed")
    except Exception as e:
        print(f"\n✗ Unsupported Accept header tests failed: {e}")
    
    try:
        test_supported_accept_headers()
        print("\n✓ Supported Accept header tests passed")
    except Exception as e:
        print(f"\n✗ Supported Accept header tests failed: {e}")
    
    try:
        test_unsupported_content_type()
        print("\n✓ Unsupported Content-Type tests passed")
    except Exception as e:
        print(f"\n✗ Unsupported Content-Type tests failed: {e}")
    
    try:
        test_missing_content_type()
        print("\n✓ Missing Content-Type tests passed")
    except Exception as e:
        print(f"\n✗ Missing Content-Type tests failed: {e}")
    
    try:
        test_supported_content_types()
        print("\n✓ Supported Content-Type tests passed")
    except Exception as e:
        print(f"\n✗ Supported Content-Type tests failed: {e}")
    
    try:
        test_metadata_endpoint_bypass()
        print("\n✓ Metadata endpoint bypass tests passed")
    except Exception as e:
        print(f"\n✗ Metadata endpoint bypass tests failed: {e}")
    
    try:
        test_multiple_accept_types()
        print("\n✓ Multiple Accept types tests passed")
    except Exception as e:
        print(f"\n✗ Multiple Accept types tests failed: {e}")
    
    print("\n\nAll tests completed!")