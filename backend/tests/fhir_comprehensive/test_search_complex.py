"""
Complex Search and Chained Query Tests for FHIR API

Tests advanced search functionality including chained searches,
reverse chaining (_has), composite searches, and complex query combinations.

Created: 2025-01-20
"""

import pytest
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List
import urllib.parse


@pytest.mark.search
class TestComplexSearch:
    """Test complex search operations and chained queries."""
    
    async def test_chained_search_single_level(
        self,
        http_client: httpx.AsyncClient,
        test_patients: List[Dict[str, Any]],
        test_validator,
        test_report
    ):
        """Test single-level chained search (e.g., Observation by patient name)."""
        start_time = datetime.now()
        
        # Use a known patient name
        test_patient = test_patients[0]
        family_name = test_patient["familyName"]
        
        if not family_name:
            pytest.skip("Test patient has no family name")
        
        # Search observations by patient name (chained)
        response = await http_client.get(
            f"/Observation?subject:Patient.name={family_name}"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # If we have results, verify they belong to patients with matching name
        if "entry" in bundle and bundle["entry"]:
            # Get the patient IDs that match the name
            patient_response = await http_client.get(f"/Patient?name={family_name}")
            patient_bundle = patient_response.json()
            
            matching_patient_ids = set()
            if "entry" in patient_bundle:
                for entry in patient_bundle["entry"]:
                    matching_patient_ids.add(f"Patient/{entry['resource']['id']}")
            
            # Verify all observations belong to matching patients
            for entry in bundle["entry"]:
                observation = entry["resource"]
                subject_ref = observation.get("subject", {}).get("reference", "")
                assert subject_ref in matching_patient_ids, \
                    f"Observation subject {subject_ref} doesn't match patient name search"
        
        # Report result
        test_report(
            "test_chained_search_single_level",
            "passed",
            duration,
            {
                "patient_name": family_name,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_reverse_chained_search(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test reverse chained search using _has parameter."""
        start_time = datetime.now()
        
        # Search for patients who have active conditions
        response = await http_client.get(
            "/Patient?_has:Condition:patient:clinical-status=active"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # If we have results, verify these patients have active conditions
        if "entry" in bundle and bundle["entry"]:
            # Check first patient
            patient = bundle["entry"][0]["resource"]
            patient_id = patient["id"]
            
            # Verify patient has active conditions
            condition_response = await http_client.get(
                f"/Condition?patient={patient_id}&clinical-status=active"
            )
            condition_bundle = condition_response.json()
            
            assert condition_bundle.get("total", 0) > 0, \
                "Patient returned by _has doesn't have active conditions"
        
        # Report result
        test_report(
            "test_reverse_chained_search",
            "passed",
            duration,
            {"results": bundle.get("total", 0)}
        )
    
    async def test_multiple_parameter_combination(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test search with multiple parameter combinations."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Complex search: observations for patient, specific category, date range, sorted
        date_from = "2023-01-01"
        date_to = "2024-12-31"
        
        params = {
            "patient": patient_id,
            "category": "vital-signs",
            "date": [f"ge{date_from}", f"le{date_to}"],
            "_sort": "-date",
            "_count": "20"
        }
        
        # Build query string
        query_parts = []
        for key, value in params.items():
            if isinstance(value, list):
                for v in value:
                    query_parts.append(f"{key}={v}")
            else:
                query_parts.append(f"{key}={value}")
        
        query_string = "&".join(query_parts)
        response = await http_client.get(f"/Observation?{query_string}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify all criteria are met
        if "entry" in bundle:
            dates = []
            for entry in bundle["entry"]:
                observation = entry["resource"]
                
                # Check patient
                assert observation.get("subject", {}).get("reference") == f"Patient/{patient_id}"
                
                # Check category
                categories = observation.get("category", [])
                has_vital_signs = any(
                    any(c.get("code") == "vital-signs" for c in cat.get("coding", []))
                    for cat in categories
                )
                assert has_vital_signs
                
                # Collect dates for sort verification
                if "effectiveDateTime" in observation:
                    dates.append(observation["effectiveDateTime"])
            
            # Verify descending sort
            for i in range(1, len(dates)):
                assert dates[i-1] >= dates[i], "Results not properly sorted descending"
        
        # Report result
        test_report(
            "test_multiple_parameter_combination",
            "passed",
            duration,
            {
                "parameters": len(params),
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_composite_search_parameter(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test composite search parameters (e.g., code-value-quantity)."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search for blood pressure observations with specific systolic value
        # Using composite parameter for blood pressure components
        response = await http_client.get(
            f"/Observation?patient={patient_id}"
            "&component-code=http://loinc.org|8480-6"  # Systolic BP
            "&component-value-quantity=gt100"  # Greater than 100
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Report result
        test_report(
            "test_composite_search_parameter",
            "passed",
            duration,
            {
                "composite_param": "component-code-value",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_include_forward_reference(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test _include parameter for forward references."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Get conditions and include the patient
        response = await http_client.get(
            f"/Condition?patient={patient_id}&_include=Condition:subject"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Check that we have both conditions and included patients
        resource_types = set()
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                resource_types.add(resource["resourceType"])
                
                # Check search mode for included resources
                if resource["resourceType"] == "Patient":
                    search_mode = entry.get("search", {}).get("mode")
                    assert search_mode == "include", "Patient should have search mode 'include'"
        
        # Should have both Condition and Patient resources
        if bundle.get("total", 0) > 0:
            assert "Condition" in resource_types
            assert "Patient" in resource_types
        
        # Report result
        test_report(
            "test_include_forward_reference",
            "passed",
            duration,
            {
                "resource_types": list(resource_types),
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_revinclude_reverse_reference(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test _revinclude parameter for reverse references."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Get patient and include all their conditions
        response = await http_client.get(
            f"/Patient?_id={patient_id}&_revinclude=Condition:subject"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Check resource types
        resource_types = {}
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                resource_type = resource["resourceType"]
                resource_types[resource_type] = resource_types.get(resource_type, 0) + 1
                
                # Check search mode
                if resource_type == "Condition":
                    search_mode = entry.get("search", {}).get("mode")
                    assert search_mode == "include", "Condition should have search mode 'include'"
        
        # Should have patient and potentially conditions
        assert "Patient" in resource_types
        
        # Report result
        test_report(
            "test_revinclude_reverse_reference",
            "passed",
            duration,
            {
                "resource_counts": resource_types,
                "total_resources": sum(resource_types.values())
            }
        )
    
    async def test_complex_date_search(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test complex date searches with multiple operators."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search for observations in specific date ranges with multiple conditions
        # Last 2 years but not in the last month
        two_years_ago = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")
        one_month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = await http_client.get(
            f"/Observation?patient={patient_id}"
            f"&date=ge{two_years_ago}"
            f"&date=lt{one_month_ago}"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify dates are in the expected range
        if "entry" in bundle:
            for entry in bundle["entry"]:
                observation = entry["resource"]
                
                if "effectiveDateTime" in observation:
                    obs_date = observation["effectiveDateTime"][:10]
                    assert obs_date >= two_years_ago, f"Date {obs_date} is before {two_years_ago}"
                    assert obs_date < one_month_ago, f"Date {obs_date} is after {one_month_ago}"
        
        # Report result
        test_report(
            "test_complex_date_search",
            "passed",
            duration,
            {
                "date_range": f"{two_years_ago} to {one_month_ago}",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_text_search_modifier(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test :text search modifier for narrative text search."""
        start_time = datetime.now()
        
        # Search for conditions with text containing specific terms
        search_term = "hypertension"
        
        response = await http_client.get(
            f"/Condition?_text:contains={search_term}"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Report result
        test_report(
            "test_text_search_modifier",
            "passed",
            duration,
            {
                "search_term": search_term,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_missing_parameter_search(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test :missing modifier to find resources with missing values."""
        start_time = datetime.now()
        
        # Search for patients without a death date (living patients)
        response = await http_client.get("/Patient?death-date:missing=true")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify no death dates in results
        if "entry" in bundle:
            for entry in bundle["entry"]:
                patient = entry["resource"]
                assert "deceasedDateTime" not in patient, \
                    "Found patient with death date in :missing=true search"
        
        # Report result
        test_report(
            "test_missing_parameter_search",
            "passed",
            duration,
            {"results": bundle.get("total", 0)}
        )
    
    async def test_reference_search_variations(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        db_connection,
        test_validator,
        test_report
    ):
        """Test different reference search variations."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Test different reference formats
        test_cases = [
            (f"/Condition?subject={patient_id}", "relative reference"),
            (f"/Condition?subject=Patient/{patient_id}", "full reference"),
            (f"/Condition?subject:Patient={patient_id}", "typed reference"),
        ]
        
        results = {}
        for query, description in test_cases:
            response = await http_client.get(query)
            assert response.status_code == 200
            
            bundle = response.json()
            assert test_validator.is_valid_bundle(bundle)
            
            results[description] = bundle.get("total", 0)
        
        # All formats should return the same results
        result_counts = list(results.values())
        if result_counts:
            assert all(count == result_counts[0] for count in result_counts), \
                "Different reference formats returned different results"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_reference_search_variations",
            "passed",
            duration,
            results
        )
    
    async def test_complex_boolean_logic(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test complex boolean logic in searches."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Search for observations that are either:
        # - Vital signs from last year
        # - Lab results with abnormal flag
        current_year = datetime.now().year
        last_year = current_year - 1
        
        # FHIR doesn't support OR directly, so we do two searches
        # Search 1: Vital signs from last year
        response1 = await http_client.get(
            f"/Observation?patient={patient_id}"
            f"&category=vital-signs"
            f"&date=ge{last_year}-01-01"
            f"&date=le{last_year}-12-31"
        )
        
        # Search 2: Lab results with specific interpretation
        response2 = await http_client.get(
            f"/Observation?patient={patient_id}"
            f"&category=laboratory"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Both should succeed
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        bundle1 = response1.json()
        bundle2 = response2.json()
        
        assert test_validator.is_valid_bundle(bundle1)
        assert test_validator.is_valid_bundle(bundle2)
        
        # Report result
        test_report(
            "test_complex_boolean_logic",
            "passed",
            duration,
            {
                "vital_signs_results": bundle1.get("total", 0),
                "lab_results": bundle2.get("total", 0)
            }
        )
    
    async def test_chained_search_multiple_levels(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test multi-level chained searches."""
        start_time = datetime.now()
        
        # Search for observations where the patient's managing organization has a specific name
        # This requires chaining through Patient to Organization
        org_name = "General Hospital"  # Common in Synthea data
        
        response = await http_client.get(
            f"/Observation?subject:Patient.organization:Organization.name:contains={org_name}"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Report result
        test_report(
            "test_chained_search_multiple_levels",
            "passed",
            duration,
            {
                "chain_depth": 2,
                "organization_name": org_name,
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_search_result_pagination_navigation(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test navigating through paginated search results."""
        start_time = datetime.now()
        
        # Initial search with small page size
        page_size = 5
        response = await http_client.get(f"/Patient?_count={page_size}")
        
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        total = bundle.get("total", 0)
        pages_navigated = 1
        
        # Navigate through pages using next links
        while "link" in bundle:
            next_link = None
            for link in bundle["link"]:
                if link.get("relation") == "next":
                    next_link = link.get("url")
                    break
            
            if not next_link:
                break
            
            # Extract path from full URL
            if next_link.startswith("http"):
                from urllib.parse import urlparse
                parsed = urlparse(next_link)
                next_path = parsed.path + "?" + parsed.query
            else:
                next_path = next_link
            
            # Follow next link
            response = await http_client.get(next_path)
            assert response.status_code == 200
            
            bundle = response.json()
            assert test_validator.is_valid_bundle(bundle)
            
            pages_navigated += 1
            
            # Limit navigation to prevent infinite loops
            if pages_navigated >= 3:
                break
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_result_pagination_navigation",
            "passed",
            duration,
            {
                "total_results": total,
                "page_size": page_size,
                "pages_navigated": pages_navigated
            }
        )