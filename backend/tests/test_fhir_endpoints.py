"""
Test FHIR R4 Endpoints

Tests for FHIR R4 API endpoints including content negotiation.
"""

import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
import json

from main import app

# Use TestClient for synchronous tests
client = TestClient(app)

class TestContentNegotiation:
    """Test content negotiation for FHIR endpoints."""
    
    def test_unsupported_accept_returns_406(self):
        """Test that unsupported Accept header returns 406."""
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "application/xml"}
        )
        assert response.status_code == 406
        
        outcome = response.json()
        assert outcome["resourceType"] == "OperationOutcome"
        assert outcome["issue"][0]["severity"] == "error"
        assert outcome["issue"][0]["code"] == "not-acceptable"
    
    def test_unsupported_content_type_returns_415(self):
        """Test that unsupported Content-Type returns 415."""
        patient = {
            "resourceType": "Patient",
            "name": [{"given": ["Test"], "family": "Patient"}]
        }
        
        response = client.post(
            "/fhir/R4/Patient",
            headers={"Content-Type": "application/xml"},
            data=json.dumps(patient)
        )
        assert response.status_code == 415
        
        outcome = response.json()
        assert outcome["resourceType"] == "OperationOutcome"
        assert outcome["issue"][0]["severity"] == "error"
        assert outcome["issue"][0]["code"] == "not-supported"
    
    def test_missing_content_type_for_post_returns_415(self):
        """Test that missing Content-Type for POST returns 415."""
        patient = {
            "resourceType": "Patient",
            "name": [{"given": ["Test"], "family": "Patient"}]
        }
        
        # Remove Content-Type header
        response = client.post(
            "/fhir/R4/Patient",
            content=json.dumps(patient)
        )
        assert response.status_code == 415
    
    def test_supported_accept_headers(self):
        """Test that supported Accept headers work."""
        # Test application/json
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "application/json"}
        )
        assert response.status_code == 200
        
        # Test application/fhir+json
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "application/fhir+json"}
        )
        assert response.status_code == 200
        
        # Test */*
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "*/*"}
        )
        assert response.status_code == 200
    
    def test_supported_content_types(self):
        """Test that supported Content-Types work."""
        patient = {
            "resourceType": "Patient",
            "name": [{"given": ["Test"], "family": "Patient"}]
        }
        
        # Test application/json
        response = client.post(
            "/fhir/R4/Patient",
            headers={"Content-Type": "application/json"},
            data=json.dumps(patient)
        )
        # Should not be 415
        assert response.status_code != 415
        
        # Test application/fhir+json
        response = client.post(
            "/fhir/R4/Patient",
            headers={"Content-Type": "application/fhir+json"},
            data=json.dumps(patient)
        )
        # Should not be 415
        assert response.status_code != 415
    
    def test_metadata_bypasses_content_negotiation(self):
        """Test that metadata endpoint bypasses content negotiation."""
        response = client.get(
            "/fhir/R4/metadata",
            headers={"Accept": "application/xml"}
        )
        # Should return 200 even with unsupported Accept
        assert response.status_code == 200
    
    def test_multiple_accept_types_with_priority(self):
        """Test Accept header with multiple types and priorities."""
        # Include a supported type in the list
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "application/xml, application/json;q=0.8"}
        )
        assert response.status_code == 200
        
        # Only unsupported types
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "application/xml, text/html"}
        )
        assert response.status_code == 406
    
    def test_response_includes_content_type(self):
        """Test that responses include proper Content-Type header."""
        response = client.get(
            "/fhir/R4/Patient",
            headers={"Accept": "application/fhir+json"}
        )
        assert response.status_code == 200
        assert "application/fhir+json" in response.headers.get("content-type", "")


class TestFHIREndpoints:
    """Test basic FHIR endpoint functionality."""
    
    def test_capability_statement(self):
        """Test that capability statement is returned."""
        response = client.get("/fhir/R4/metadata")
        assert response.status_code == 200
        
        capability = response.json()
        assert capability["resourceType"] == "CapabilityStatement"
        assert capability["status"] == "active"
        assert capability["fhirVersion"] == "4.0.1"
        assert "application/fhir+json" in capability["format"]
        assert "application/json" in capability["format"]
    
    def test_search_patients(self):
        """Test patient search endpoint."""
        response = client.get("/fhir/R4/Patient")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
    
    def test_create_patient_validation(self):
        """Test patient creation with validation."""
        # Invalid patient (missing resourceType)
        invalid_patient = {
            "name": [{"given": ["Test"], "family": "Patient"}]
        }
        
        response = client.post(
            "/fhir/R4/Patient",
            headers={"Content-Type": "application/fhir+json"},
            json=invalid_patient
        )
        assert response.status_code == 400
        
        outcome = response.json()
        assert outcome["resourceType"] == "OperationOutcome"
    
    def test_resource_not_found(self):
        """Test 404 for non-existent resources."""
        response = client.get("/fhir/R4/Patient/non-existent-id")
        assert response.status_code == 404
    
    def test_unsupported_resource_type(self):
        """Test 404 for unsupported resource types."""
        response = client.get("/fhir/R4/UnsupportedResource")
        assert response.status_code == 404


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])