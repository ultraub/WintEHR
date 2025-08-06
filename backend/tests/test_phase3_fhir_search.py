"""
Test suite for Phase 3 FHIR search implementations
Tests:
- Enhanced _include and _revinclude parameters
- _has parameter for reverse chaining
- Composite search parameters
- Advanced search features
"""

import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta
import json

pytestmark = pytest.mark.asyncio


class TestPhase3FHIRSearch:
    """Test Phase 3 FHIR search functionality"""
    
    @pytest.mark.asyncio
    async def test_enhanced_include_parameters(self, async_client: AsyncClient):
        """Test enhanced _include parameter support"""
        
        # Test including patient from observation
        response = await async_client.get("/api/fhir/Observation", params={
            "_include": "Observation:subject"
        })
        assert response.status_code == 200
        bundle = response.json()
        
        # Check that bundle contains both observations and patients
        resource_types = {entry["resource"]["resourceType"] for entry in bundle.get("entry", [])}
        assert "Observation" in resource_types
        # May include Patient if references exist
        
        # Test including encounter
        response = await async_client.get("/api/fhir/Condition", params={
            "_include": "Condition:encounter"
        })
        assert response.status_code == 200
        
        # Test including practitioner
        response = await async_client.get("/api/fhir/Procedure", params={
            "_include": "Procedure:performer"
        })
        assert response.status_code == 200
        
        # Test including organization
        response = await async_client.get("/api/fhir/Encounter", params={
            "_include": "Encounter:serviceProvider"
        })
        assert response.status_code == 200
        
        # Test including medication
        response = await async_client.get("/api/fhir/MedicationRequest", params={
            "_include": "MedicationRequest:medication"
        })
        assert response.status_code == 200
        
        # Test multiple includes
        response = await async_client.get("/api/fhir/Observation", params={
            "_include": ["Observation:subject", "Observation:encounter"]
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_enhanced_revinclude_parameters(self, async_client: AsyncClient):
        """Test enhanced _revinclude parameter support"""
        
        # Test revinclude for AllergyIntolerance
        response = await async_client.get("/api/fhir/Patient", params={
            "_revinclude": "AllergyIntolerance:patient"
        })
        assert response.status_code == 200
        bundle = response.json()
        
        # Test revinclude for Immunization
        response = await async_client.get("/api/fhir/Patient", params={
            "_revinclude": "Immunization:patient"
        })
        assert response.status_code == 200
        
        # Test revinclude for Procedure
        response = await async_client.get("/api/fhir/Patient", params={
            "_revinclude": "Procedure:subject"
        })
        assert response.status_code == 200
        
        # Test revinclude for DiagnosticReport
        response = await async_client.get("/api/fhir/Patient", params={
            "_revinclude": "DiagnosticReport:subject"
        })
        assert response.status_code == 200
        
        # Test encounter-based revincludes
        response = await async_client.get("/api/fhir/Encounter", params={
            "_revinclude": "Condition:encounter"
        })
        assert response.status_code == 200
        
        # Test practitioner-based revincludes
        response = await async_client.get("/api/fhir/Practitioner", params={
            "_revinclude": "Observation:performer"
        })
        assert response.status_code == 200
        
        # Test multiple revincludes
        response = await async_client.get("/api/fhir/Patient", params={
            "_revinclude": ["Observation:patient", "Condition:patient", "MedicationRequest:patient"]
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_has_parameter(self, async_client: AsyncClient):
        """Test _has parameter for reverse chaining"""
        
        # Find patients who have glucose observations
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:Observation:patient:code": "http://loinc.org|2339-0"
        })
        assert response.status_code == 200
        bundle = response.json()
        # Should return patients who have glucose observations
        
        # Find patients who have active conditions
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:Condition:patient:clinical-status": "active"
        })
        assert response.status_code == 200
        
        # Find patients who have specific medications
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:MedicationRequest:patient:code": "http://www.nlm.nih.gov/research/umls/rxnorm|123456"
        })
        assert response.status_code == 200
        
        # Find encounters that have procedures
        response = await async_client.get("/api/fhir/Encounter", params={
            "_has:Procedure:encounter:code": "http://snomed.info/sct|12345"
        })
        assert response.status_code == 200
        
        # Multiple _has parameters (AND logic)
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:Observation:patient:code": "http://loinc.org|2339-0",
            "_has:Condition:patient:code": "http://snomed.info/sct|44054006"  # Diabetes
        })
        assert response.status_code == 200
        # Should return patients who have both glucose observations AND diabetes
    
    @pytest.mark.asyncio
    async def test_composite_search_parameters(self, async_client: AsyncClient):
        """Test composite search parameters"""
        
        # Test Observation code-value-quantity composite
        response = await async_client.get("/api/fhir/Observation", params={
            "code-value-quantity": "http://loinc.org|8480-6$gt120"  # Systolic BP > 120
        })
        assert response.status_code == 200
        bundle = response.json()
        
        # Test with different comparators
        response = await async_client.get("/api/fhir/Observation", params={
            "code-value-quantity": "http://loinc.org|2339-0$le7.0"  # Glucose <= 7.0
        })
        assert response.status_code == 200
        
        # Test component-code-value-quantity for blood pressure
        response = await async_client.get("/api/fhir/Observation", params={
            "component-code-value-quantity": "http://loinc.org|8480-6$gt140"  # Systolic > 140
        })
        assert response.status_code == 200
        
        # Test MedicationRequest composite
        response = await async_client.get("/api/fhir/MedicationRequest", params={
            "medication-code-status": "http://www.nlm.nih.gov/research/umls/rxnorm|123456$active"
        })
        assert response.status_code == 200
        
        # Test Condition composite
        response = await async_client.get("/api/fhir/Condition", params={
            "code-status": "http://snomed.info/sct|44054006$active"  # Active diabetes
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_combined_advanced_features(self, async_client: AsyncClient):
        """Test combinations of Phase 3 features"""
        
        # _has with _include
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:Observation:patient:code": "http://loinc.org|2339-0",
            "_include": "Patient:generalPractitioner"
        })
        assert response.status_code == 200
        
        # _has with _revinclude
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:Observation:patient:code": "http://loinc.org|2339-0",
            "_revinclude": "Condition:patient"
        })
        assert response.status_code == 200
        
        # Composite with _include
        response = await async_client.get("/api/fhir/Observation", params={
            "code-value-quantity": "http://loinc.org|8480-6$gt140",
            "_include": "Observation:subject"
        })
        assert response.status_code == 200
        
        # Multiple advanced features
        response = await async_client.get("/api/fhir/Patient", params={
            "_has:Observation:patient:code": "http://loinc.org|2339-0",
            "_include": "Patient:generalPractitioner",
            "_revinclude": ["Condition:patient", "MedicationRequest:patient"],
            "_count": "10"
        })
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_search_mode_indicators(self, async_client: AsyncClient):
        """Test that included resources have correct search mode"""
        
        response = await async_client.get("/api/fhir/Observation", params={
            "_include": "Observation:subject",
            "_count": "5"
        })
        assert response.status_code == 200
        bundle = response.json()
        
        # Check search modes
        for entry in bundle.get("entry", []):
            search_mode = entry.get("search", {}).get("mode")
            if entry["resource"]["resourceType"] == "Observation":
                assert search_mode == "match"
            else:
                assert search_mode == "include"
    
    @pytest.mark.asyncio
    async def test_error_handling(self, async_client: AsyncClient):
        """Test error handling for Phase 3 features"""
        
        # Invalid _has format
        response = await async_client.get("/api/fhir/Patient", params={
            "_has": "InvalidFormat"
        })
        assert response.status_code == 200  # Should handle gracefully
        
        # Invalid composite parameter value
        response = await async_client.get("/api/fhir/Observation", params={
            "code-value-quantity": "invalid-format"  # Missing $
        })
        assert response.status_code == 200  # Should handle gracefully
        
        # Unknown composite parameter
        response = await async_client.get("/api/fhir/Patient", params={
            "unknown-composite": "value1$value2"
        })
        assert response.status_code == 400  # Should reject unknown parameter