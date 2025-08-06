"""
Test suite for Phase 2 FHIR search implementations
Tests:
- Universal identifier search across all resources
- :missing modifier support
- Provider credential searches
- Basic chained parameter support
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import json

pytestmark = pytest.mark.asyncio


class TestPhase2FHIRSearch:
    """Test Phase 2 FHIR search functionality"""
    
    @pytest.mark.asyncio
    async def test_universal_identifier_search(self, async_client: AsyncClient):
        """Test identifier search works across all resource types"""
        
        # Test identifier search for Patient
        response = await async_client.get("/api/fhir/Patient", params={
            "identifier": "999-99-9999"  # SSN
        })
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        # Should find patients with this SSN
        
        # Test identifier search with system
        response = await async_client.get("/api/fhir/Patient", params={
            "identifier": "http://hl7.org/fhir/sid/us-ssn|999-99-9999"
        })
        assert response.status_code == 200
        
        # Test identifier search for Practitioner
        response = await async_client.get("/api/fhir/Practitioner", params={
            "identifier": "1234567890"  # NPI
        })
        assert response.status_code == 200
        
        # Test identifier search for Organization
        response = await async_client.get("/api/fhir/Organization", params={
            "identifier": "12345"
        })
        assert response.status_code == 200
        
        # Test identifier search for JSONB resources (e.g., Observation)
        response = await async_client.get("/api/fhir/Observation", params={
            "identifier": "OBS-001"
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_missing_modifier_support(self, async_client: AsyncClient):
        """Test :missing modifier works for various parameter types"""
        
        # Test missing encounter on Condition
        response = await async_client.get("/api/fhir/Condition", params={
            "encounter:missing": "true"
        })
        assert response.status_code == 200
        bundle = response.json()
        # Should return conditions without encounter references
        
        # Test missing=false
        response = await async_client.get("/api/fhir/Condition", params={
            "encounter:missing": "false"
        })
        assert response.status_code == 200
        # Should return conditions with encounter references
        
        # Test missing identifier on JSONB resources
        response = await async_client.get("/api/fhir/Observation", params={
            "identifier:missing": "true"
        })
        assert response.status_code == 200
        
        # Test missing patient reference
        response = await async_client.get("/api/fhir/DocumentReference", params={
            "subject:missing": "true"
        })
        assert response.status_code == 200
        
        # Test missing category
        response = await async_client.get("/api/fhir/Condition", params={
            "category:missing": "true"
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_provider_credential_searches(self, async_client: AsyncClient):
        """Test provider qualification and credential searches"""
        
        # Test Practitioner qualification search
        response = await async_client.get("/api/fhir/Practitioner", params={
            "qualification": "MD"
        })
        assert response.status_code == 200
        bundle = response.json()
        # Should find practitioners with MD qualification
        
        # Test with system|code format
        response = await async_client.get("/api/fhir/Practitioner", params={
            "qualification": "http://terminology.hl7.org/CodeSystem/v2-0360|MD"
        })
        assert response.status_code == 200
        
        # Test PractitionerRole role search
        response = await async_client.get("/api/fhir/PractitionerRole", params={
            "role": "doctor"
        })
        assert response.status_code == 200
        
        # Test PractitionerRole specialty search
        response = await async_client.get("/api/fhir/PractitionerRole", params={
            "specialty": "http://nucc.org/provider-taxonomy|207Q00000X"  # Family Medicine
        })
        assert response.status_code == 200
        
        # Test PractitionerRole by practitioner reference
        response = await async_client.get("/api/fhir/PractitionerRole", params={
            "practitioner": "Practitioner/123"
        })
        assert response.status_code == 200
        
        # Test PractitionerRole by organization
        response = await async_client.get("/api/fhir/PractitionerRole", params={
            "organization": "Organization/456"
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_basic_chained_parameters(self, async_client: AsyncClient):
        """Test basic chained parameter support"""
        
        # Test patient.name chain on Observation
        response = await async_client.get("/api/fhir/Observation", params={
            "patient.name": "Smith"
        })
        assert response.status_code == 200
        bundle = response.json()
        # Should find observations for patients with name containing Smith
        
        # Test subject.family chain
        response = await async_client.get("/api/fhir/Condition", params={
            "subject.family": "Johnson"
        })
        assert response.status_code == 200
        
        # Test patient.given chain
        response = await async_client.get("/api/fhir/MedicationRequest", params={
            "patient.given": "John"
        })
        assert response.status_code == 200
        
        # Test patient.identifier chain
        response = await async_client.get("/api/fhir/Encounter", params={
            "patient.identifier": "MRN12345"
        })
        assert response.status_code == 200
        
        # Test performer.name chain
        response = await async_client.get("/api/fhir/Procedure", params={
            "performer.name": "Williams"
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_combined_search_features(self, async_client: AsyncClient):
        """Test combinations of Phase 2 features"""
        
        # Test identifier with missing modifier
        response = await async_client.get("/api/fhir/Patient", params={
            "identifier:missing": "false",
            "name": "Test"
        })
        assert response.status_code == 200
        
        # Test chained parameter with other filters
        response = await async_client.get("/api/fhir/Observation", params={
            "patient.name": "Smith",
            "code": "http://loinc.org|2339-0",  # Glucose
            "date": f"ge{(datetime.now() - timedelta(days=30)).date()}"
        })
        assert response.status_code == 200
        
        # Test provider search with qualification
        response = await async_client.get("/api/fhir/Practitioner", params={
            "qualification": "MD",
            "active": "true"
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_error_handling(self, async_client: AsyncClient):
        """Test error handling for Phase 2 features"""
        
        # Test invalid missing modifier value
        response = await async_client.get("/api/fhir/Condition", params={
            "encounter:missing": "invalid"
        })
        assert response.status_code == 200  # Should treat as false
        
        # Test chained parameter on non-reference field
        response = await async_client.get("/api/fhir/Observation", params={
            "status.name": "final"  # Invalid chain
        })
        assert response.status_code == 200  # Should handle gracefully