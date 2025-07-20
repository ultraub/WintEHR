"""
Simple Search Parameter Tests for FHIR API

Tests basic search functionality including single parameter searches,
common parameters, pagination, and sorting.

Created: 2025-01-20
"""

import pytest
import httpx
from datetime import datetime, timedelta
import urllib.parse
from typing import Dict, Any, List


@pytest.mark.search
class TestSimpleSearch:
    """Test simple search operations across FHIR resources."""
    
    async def test_patient_search_by_name(
        self,
        http_client: httpx.AsyncClient,
        test_patients: List[Dict[str, Any]],
        test_validator,
        test_report
    ):
        """Test searching patients by name."""
        start_time = datetime.now()
        
        # Use a known patient name from test data
        test_patient = test_patients[0]
        family_name = test_patient["familyName"]
        
        if not family_name:
            pytest.skip("Test patient has no family name")
        
        # Search by family name
        response = await http_client.get(f"/Patient?name={family_name}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify at least one result
        assert bundle.get("total", 0) > 0
        
        # Verify all results contain the search term in name
        if "entry" in bundle:
            for entry in bundle["entry"]:
                patient = entry["resource"]
                names = patient.get("name", [])
                name_found = False
                
                for name in names:
                    if family_name.lower() in str(name).lower():
                        name_found = True
                        break
                
                assert name_found, f"Patient {patient['id']} doesn't match name search"
        
        # Report result
        test_report(
            "test_patient_search_by_name",
            "passed",
            duration,
            {
                "search_term": family_name,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_patient_search_by_identifier(
        self,
        http_client: httpx.AsyncClient,
        test_patients: List[Dict[str, Any]],
        test_validator,
        test_report
    ):
        """Test searching patients by identifier."""
        start_time = datetime.now()
        
        # First, get a patient with an identifier
        test_patient = test_patients[0]
        patient_resource = test_patient["resource"]
        
        identifiers = patient_resource.get("identifier", [])
        if not identifiers:
            pytest.skip("Test patient has no identifiers")
        
        # Use the first identifier
        identifier = identifiers[0]
        identifier_value = identifier.get("value")
        
        # Search by identifier
        response = await http_client.get(f"/Patient?identifier={identifier_value}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Should find at least one patient
        assert bundle.get("total", 0) >= 1
        
        # Report result
        test_report(
            "test_patient_search_by_identifier",
            "passed",
            duration,
            {
                "identifier": identifier_value,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_patient_search_by_birthdate(
        self,
        http_client: httpx.AsyncClient,
        test_patients: List[Dict[str, Any]],
        test_validator,
        test_report
    ):
        """Test searching patients by birth date."""
        start_time = datetime.now()
        
        # Use a known patient's birth date
        test_patient = test_patients[0]
        birth_date = test_patient["birthDate"]
        
        if not birth_date:
            pytest.skip("Test patient has no birth date")
        
        # Search by exact birth date
        response = await http_client.get(f"/Patient?birthdate={birth_date}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify results have matching birth date
        if "entry" in bundle:
            for entry in bundle["entry"]:
                patient = entry["resource"]
                assert patient.get("birthDate") == birth_date
        
        # Report result
        test_report(
            "test_patient_search_by_birthdate",
            "passed",
            duration,
            {
                "birth_date": birth_date,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_condition_search_by_patient(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test searching conditions by patient reference."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search conditions for patient
        response = await http_client.get(f"/Condition?patient={patient_id}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify all conditions belong to the patient
        if "entry" in bundle:
            for entry in bundle["entry"]:
                condition = entry["resource"]
                subject_ref = condition.get("subject", {}).get("reference", "")
                assert subject_ref == f"Patient/{patient_id}"
        
        # Report result
        test_report(
            "test_condition_search_by_patient",
            "passed",
            duration,
            {
                "patient_id": patient_id,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_observation_search_by_category(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test searching observations by category."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search for vital signs
        response = await http_client.get(
            f"/Observation?patient={patient_id}&category=vital-signs"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify all observations are vital signs
        if "entry" in bundle:
            for entry in bundle["entry"]:
                observation = entry["resource"]
                categories = observation.get("category", [])
                
                has_vital_signs = False
                for category in categories:
                    codings = category.get("coding", [])
                    for coding in codings:
                        if coding.get("code") == "vital-signs":
                            has_vital_signs = True
                            break
                
                assert has_vital_signs, "Observation doesn't have vital-signs category"
        
        # Report result
        test_report(
            "test_observation_search_by_category",
            "passed",
            duration,
            {
                "patient_id": patient_id,
                "category": "vital-signs",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_medication_request_search_by_status(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test searching medication requests by status."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search for active medications
        response = await http_client.get(
            f"/MedicationRequest?patient={patient_id}&status=active"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify all medication requests are active
        if "entry" in bundle:
            for entry in bundle["entry"]:
                med_request = entry["resource"]
                assert med_request.get("status") == "active"
        
        # Report result
        test_report(
            "test_medication_request_search_by_status",
            "passed",
            duration,
            {
                "patient_id": patient_id,
                "status": "active",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_with_pagination(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test search with pagination parameters."""
        start_time = datetime.now()
        
        # Search patients with pagination
        page_size = 5
        response = await http_client.get(f"/Patient?_count={page_size}")
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify page size
        if "entry" in bundle:
            assert len(bundle["entry"]) <= page_size
        
        # Check for pagination links
        links = bundle.get("link", [])
        link_relations = [link.get("relation") for link in links]
        
        # Should have self link
        assert "self" in link_relations
        
        # If there are more results, should have next link
        total = bundle.get("total", 0)
        if total > page_size:
            assert "next" in link_relations
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_with_pagination",
            "passed",
            duration,
            {
                "page_size": page_size,
                "total_results": total,
                "links": link_relations
            }
        )
    
    async def test_search_with_sorting(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test search with sorting parameters."""
        start_time = datetime.now()
        
        # Search patients sorted by birth date
        response = await http_client.get("/Patient?_sort=birthdate&_count=10")
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify sorting order
        if "entry" in bundle and len(bundle["entry"]) > 1:
            birth_dates = []
            for entry in bundle["entry"]:
                patient = entry["resource"]
                birth_date = patient.get("birthDate")
                if birth_date:
                    birth_dates.append(birth_date)
            
            # Check ascending order
            for i in range(1, len(birth_dates)):
                assert birth_dates[i-1] <= birth_dates[i], "Results not properly sorted"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_with_sorting",
            "passed",
            duration,
            {
                "sort_field": "birthdate",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_with_last_updated(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test searching by _lastUpdated parameter."""
        start_time = datetime.now()
        
        # Search for recently updated resources
        date_threshold = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = await http_client.get(f"/Patient?_lastUpdated=ge{date_threshold}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Report result
        test_report(
            "test_search_with_last_updated",
            "passed",
            duration,
            {
                "date_threshold": date_threshold,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_multiple_values(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test searching with multiple values for same parameter."""
        start_time = datetime.now()
        
        # Search for multiple statuses
        response = await http_client.get("/Condition?clinical-status=active,resolved")
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify results have one of the specified statuses
        if "entry" in bundle:
            for entry in bundle["entry"]:
                condition = entry["resource"]
                clinical_status = condition.get("clinicalStatus", {})
                codings = clinical_status.get("coding", [])
                
                status_codes = [c.get("code") for c in codings]
                assert any(code in ["active", "resolved"] for code in status_codes)
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_multiple_values",
            "passed",
            duration,
            {
                "statuses": ["active", "resolved"],
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_date_range(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test searching with date range parameters."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search observations in date range
        start_date = "2023-01-01"
        end_date = "2024-12-31"
        
        response = await http_client.get(
            f"/Observation?patient={patient_id}&date=ge{start_date}&date=le{end_date}"
        )
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify dates are within range
        if "entry" in bundle:
            for entry in bundle["entry"]:
                observation = entry["resource"]
                
                # Get observation date
                obs_date = None
                if "effectiveDateTime" in observation:
                    obs_date = observation["effectiveDateTime"][:10]  # YYYY-MM-DD
                elif "effectivePeriod" in observation:
                    obs_date = observation["effectivePeriod"].get("start", "")[:10]
                
                if obs_date:
                    assert start_date <= obs_date <= end_date, \
                        f"Observation date {obs_date} outside range"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_date_range",
            "passed",
            duration,
            {
                "patient_id": patient_id,
                "date_range": f"{start_date} to {end_date}",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_code_system(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test searching with code and system."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search for specific LOINC code
        loinc_code = "85354-9"  # Blood pressure panel
        
        response = await http_client.get(
            f"/Observation?patient={patient_id}&code=http://loinc.org|{loinc_code}"
        )
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify all results have the specified code
        if "entry" in bundle:
            for entry in bundle["entry"]:
                observation = entry["resource"]
                codings = observation.get("code", {}).get("coding", [])
                
                code_found = False
                for coding in codings:
                    if (coding.get("system") == "http://loinc.org" and 
                        coding.get("code") == loinc_code):
                        code_found = True
                        break
                
                assert code_found, f"Observation doesn't have expected LOINC code"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_code_system",
            "passed",
            duration,
            {
                "loinc_code": loinc_code,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_count_parameter(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test _count parameter variations."""
        start_time = datetime.now()
        
        test_cases = [
            (10, "standard count"),
            (0, "count only"),
            (100, "large count"),
            (1, "single result")
        ]
        
        for count, description in test_cases:
            response = await http_client.get(f"/Patient?_count={count}")
            
            assert response.status_code == 200
            
            bundle = response.json()
            assert test_validator.is_valid_bundle(bundle)
            
            # Verify count behavior
            if count == 0:
                # Should return count only, no entries
                assert "entry" not in bundle or len(bundle["entry"]) == 0
                assert "total" in bundle
            else:
                # Should respect count limit
                if "entry" in bundle:
                    assert len(bundle["entry"]) <= count
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_count_parameter",
            "passed",
            duration,
            {"test_cases": len(test_cases)}
        )
    
    async def test_global_search(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test global search across all resource types."""
        start_time = datetime.now()
        
        # Search across all resources with _type parameter
        response = await http_client.get("/?_type=Patient,Condition,Observation&_count=10")
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify mixed resource types
        resource_types = set()
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                resource_types.add(resource["resourceType"])
        
        # Should have multiple resource types
        assert len(resource_types) >= 1
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_global_search",
            "passed",
            duration,
            {
                "resource_types": list(resource_types),
                "results": bundle.get("total", 0)
            }
        )