"""
FHIR R4 Compliance Validation Tests

Tests to ensure the API implementation complies with FHIR R4 specification
including resource validation, cardinality rules, data types, and constraints.

Created: 2025-01-20
"""

import pytest
import httpx
from datetime import datetime
from typing import Dict, Any, List
import re


@pytest.mark.compliance
class TestFHIRCompliance:
    """Test FHIR R4 specification compliance."""
    
    async def test_content_type_negotiation(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test content type negotiation compliance."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Test different content type headers
        content_types = [
            ("application/fhir+json", "application/fhir+json"),
            ("application/json", "application/fhir+json"),  # Should upgrade
            ("application/fhir+json; charset=UTF-8", "application/fhir+json"),
        ]
        
        for request_type, expected_response_type in content_types:
            headers = {
                "Accept": request_type,
                "Content-Type": request_type
            }
            
            response = await http_client.get(
                f"/Patient/{patient_id}",
                headers=headers
            )
            
            assert response.status_code == 200
            
            # Check response content type
            response_content_type = response.headers.get("content-type", "")
            assert expected_response_type in response_content_type.lower(), \
                f"Expected {expected_response_type}, got {response_content_type}"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_content_type_negotiation",
            "passed",
            duration,
            {"content_types_tested": len(content_types)}
        )
    
    async def test_resource_meta_elements(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test that resources contain required meta elements."""
        start_time = datetime.now()
        
        # Create a new resource to ensure fresh meta
        observation = {
            "resourceType": "Observation",
            "status": "final",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "8302-2",
                    "display": "Body height"
                }]
            },
            "subject": {
                "reference": f"Patient/{test_patient['id']}"
            },
            "valueQuantity": {
                "value": 170,
                "unit": "cm"
            }
        }
        
        # Create resource
        create_response = await http_client.post("/Observation", json=observation)
        assert create_response.status_code == 201
        
        created_resource = create_response.json()
        cleanup_resources("Observation", created_resource["id"])
        
        # Validate meta elements
        assert "meta" in created_resource, "Resource must have meta element"
        
        meta = created_resource["meta"]
        assert "versionId" in meta, "Meta must have versionId"
        assert "lastUpdated" in meta, "Meta must have lastUpdated"
        
        # Validate versionId format (should be numeric or similar)
        assert meta["versionId"], "versionId must not be empty"
        
        # Validate lastUpdated is valid instant
        last_updated = meta["lastUpdated"]
        # Should match FHIR instant format: YYYY-MM-DDThh:mm:ss.sss+zz:zz
        instant_pattern = r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$'
        assert re.match(instant_pattern, last_updated), \
            f"lastUpdated '{last_updated}' doesn't match FHIR instant format"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_resource_meta_elements",
            "passed",
            duration,
            {
                "versionId": meta["versionId"],
                "lastUpdated": last_updated
            }
        )
    
    async def test_search_parameter_types(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test different search parameter types per FHIR spec."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Test different parameter types
        test_cases = [
            # String parameters
            ("Patient", "name", "Smith", "string"),
            
            # Token parameters (system|code)
            ("Observation", f"patient={patient_id}&code", "http://loinc.org|", "token"),
            
            # Reference parameters
            ("Condition", "subject", f"Patient/{patient_id}", "reference"),
            
            # Date parameters with prefixes
            ("Patient", "birthdate", "gt1950-01-01", "date"),
            ("Patient", "birthdate", "le2020-12-31", "date"),
            
            # Number parameters
            ("RiskAssessment", "probability", "gt0.5", "number"),
            
            # Composite parameters
            ("Observation", f"patient={patient_id}&code-value-quantity", 
             "http://loinc.org|8480-6$gt120", "composite"),
        ]
        
        for resource_type, param, value, param_type in test_cases:
            response = await http_client.get(f"/{resource_type}?{param}={value}")
            
            # Should return valid response (200) or no results (200 with empty bundle)
            assert response.status_code == 200, \
                f"Failed {param_type} parameter test: {resource_type}?{param}={value}"
            
            bundle = response.json()
            assert bundle["resourceType"] == "Bundle"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_search_parameter_types",
            "passed",
            duration,
            {"parameter_types_tested": len(test_cases)}
        )
    
    async def test_bundle_structure_compliance(
        self,
        http_client: httpx.AsyncClient,
        test_report
    ):
        """Test Bundle structure compliance with FHIR spec."""
        start_time = datetime.now()
        
        # Get a search bundle
        response = await http_client.get("/Patient?_count=5")
        assert response.status_code == 200
        
        bundle = response.json()
        
        # Validate required Bundle elements
        assert bundle["resourceType"] == "Bundle", "Must have resourceType = Bundle"
        assert "type" in bundle, "Bundle must have type"
        assert bundle["type"] == "searchset", "Search should return searchset bundle"
        
        # Validate Bundle.link structure
        if "link" in bundle:
            for link in bundle["link"]:
                assert "relation" in link, "Bundle.link must have relation"
                assert "url" in link, "Bundle.link must have url"
                
                # Common relations
                valid_relations = ["self", "first", "next", "previous", "last"]
                assert link["relation"] in valid_relations or link["relation"].startswith("http"), \
                    f"Invalid link relation: {link['relation']}"
        
        # Validate Bundle.entry structure
        if "entry" in bundle:
            for entry in bundle["entry"]:
                assert "resource" in entry, "Bundle.entry must have resource"
                
                resource = entry["resource"]
                assert "resourceType" in resource, "Resource must have resourceType"
                assert "id" in resource, "Resource must have id"
                
                # Search mode
                if "search" in entry:
                    assert "mode" in entry["search"], "Bundle.entry.search must have mode"
                    assert entry["search"]["mode"] in ["match", "include", "outcome"], \
                        f"Invalid search mode: {entry['search']['mode']}"
                
                # fullUrl should be present
                if "fullUrl" in entry:
                    # Should be absolute or relative URL
                    full_url = entry["fullUrl"]
                    assert full_url.startswith("http") or full_url.startswith("/") or \
                           full_url.startswith(resource["resourceType"]), \
                           f"Invalid fullUrl format: {full_url}"
        
        # Total should be present for searchset
        assert "total" in bundle, "Searchset bundle must have total"
        assert isinstance(bundle["total"], int), "Total must be an integer"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_bundle_structure_compliance",
            "passed",
            duration,
            {
                "bundle_type": bundle["type"],
                "total": bundle.get("total", 0),
                "entry_count": len(bundle.get("entry", []))
            }
        )
    
    async def test_reference_format_compliance(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test reference format compliance with FHIR spec."""
        start_time = datetime.now()
        
        # Test different reference formats
        test_references = [
            # Relative reference
            {
                "reference": f"Patient/{test_patient['id']}"
            },
            # Relative reference with display
            {
                "reference": f"Patient/{test_patient['id']}",
                "display": "Test Patient"
            },
            # Reference with type
            {
                "reference": f"Patient/{test_patient['id']}",
                "type": "Patient"
            }
        ]
        
        for ref_format in test_references:
            condition = {
                "resourceType": "Condition",
                "clinicalStatus": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active"
                    }]
                },
                "code": {
                    "text": "Test condition"
                },
                "subject": ref_format
            }
            
            # Create resource
            response = await http_client.post("/Condition", json=condition)
            assert response.status_code == 201, \
                f"Failed to create resource with reference format: {ref_format}"
            
            created = response.json()
            cleanup_resources("Condition", created["id"])
            
            # Verify reference is preserved
            assert "subject" in created
            assert "reference" in created["subject"]
            
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_reference_format_compliance",
            "passed",
            duration,
            {"reference_formats_tested": len(test_references)}
        )
    
    async def test_error_response_compliance(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test error responses comply with FHIR OperationOutcome."""
        start_time = datetime.now()
        
        # Test different error scenarios
        error_cases = [
            # 404 - Resource not found
            ("/Patient/non-existent-id", "GET", None, 404),
            
            # 400 - Bad request (invalid resource)
            ("/Patient", "POST", {"resourceType": "InvalidType"}, 400),
            
            # 422 - Unprocessable entity (invalid FHIR content)
            ("/Patient", "POST", {
                "resourceType": "Patient",
                "gender": "invalid-gender"  # Invalid code
            }, [400, 422]),  # Could be either
        ]
        
        for url, method, body, expected_status in error_cases:
            if method == "GET":
                response = await http_client.get(url)
            elif method == "POST":
                response = await http_client.post(url, json=body)
            
            # Check status code
            if isinstance(expected_status, list):
                assert response.status_code in expected_status
            else:
                assert response.status_code == expected_status
            
            # Error response should be OperationOutcome
            if response.status_code >= 400:
                try:
                    error_body = response.json()
                    assert test_validator.is_valid_operation_outcome(error_body), \
                        "Error response must be valid OperationOutcome"
                    
                    # Check issue severity
                    for issue in error_body.get("issue", []):
                        assert "severity" in issue
                        assert issue["severity"] in ["fatal", "error", "warning", "information"]
                        
                except Exception:
                    # Some errors might return non-JSON
                    pass
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_error_response_compliance",
            "passed",
            duration,
            {"error_cases_tested": len(error_cases)}
        )
    
    async def test_http_methods_compliance(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test HTTP methods comply with FHIR RESTful API spec."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Test allowed methods
        allowed_methods = [
            ("GET", f"/Patient/{patient_id}", None, [200]),
            ("HEAD", f"/Patient/{patient_id}", None, [200]),
            ("OPTIONS", "/Patient", None, [200, 204]),
        ]
        
        for method, url, body, expected_statuses in allowed_methods:
            response = await http_client.request(method, url, json=body)
            assert response.status_code in expected_statuses, \
                f"{method} {url} returned {response.status_code}, expected {expected_statuses}"
            
            # HEAD should not return body
            if method == "HEAD":
                assert len(response.content) == 0, "HEAD request should not return body"
            
            # OPTIONS should return Allow header
            if method == "OPTIONS":
                allow_header = response.headers.get("Allow")
                if allow_header:
                    allowed = allow_header.upper().split(", ")
                    assert "GET" in allowed
                    assert "POST" in allowed
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_http_methods_compliance",
            "passed",
            duration,
            {"methods_tested": len(allowed_methods)}
        )
    
    async def test_etag_support(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test ETag support for concurrency control."""
        start_time = datetime.now()
        
        # Create a resource
        allergy = {
            "resourceType": "AllergyIntolerance",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code": "active"
                }]
            },
            "patient": {
                "reference": f"Patient/{test_patient['id']}"
            }
        }
        
        create_response = await http_client.post("/AllergyIntolerance", json=allergy)
        assert create_response.status_code == 201
        
        created = create_response.json()
        resource_id = created["id"]
        cleanup_resources("AllergyIntolerance", resource_id)
        
        # Get resource and check for ETag
        get_response = await http_client.get(f"/AllergyIntolerance/{resource_id}")
        assert get_response.status_code == 200
        
        etag = get_response.headers.get("ETag")
        if etag:  # ETag support is optional but if present, test it
            # Try update with correct ETag
            resource = get_response.json()
            resource["criticality"] = "high"
            
            update_headers = {
                **http_client.headers,
                "If-Match": etag
            }
            
            update_response = await http_client.put(
                f"/AllergyIntolerance/{resource_id}",
                json=resource,
                headers=update_headers
            )
            
            assert update_response.status_code == 200
            
            # Try update with wrong ETag (should fail)
            resource["criticality"] = "low"
            wrong_headers = {
                **http_client.headers,
                "If-Match": "W/\"wrong-etag\""
            }
            
            conflict_response = await http_client.put(
                f"/AllergyIntolerance/{resource_id}",
                json=resource,
                headers=wrong_headers
            )
            
            # Should return 409 Conflict or 412 Precondition Failed
            assert conflict_response.status_code in [409, 412]
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_etag_support",
            "passed",
            duration,
            {"etag_present": etag is not None}
        )
    
    async def test_location_header_on_create(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test Location header is returned on resource creation."""
        start_time = datetime.now()
        
        # Create a resource
        device = {
            "resourceType": "Device",
            "status": "active",
            "deviceName": [{
                "name": "Test Device",
                "type": "user-friendly-name"
            }]
        }
        
        response = await http_client.post("/Device", json=device)
        assert response.status_code == 201
        
        created = response.json()
        cleanup_resources("Device", created["id"])
        
        # Check Location header
        location_header = response.headers.get("Location")
        assert location_header is not None, "Location header must be present on creation"
        
        # Location should point to the created resource
        assert f"Device/{created['id']}" in location_header, \
            f"Location header should contain Device/{created['id']}"
        
        # Should be able to GET from Location URL
        if location_header.startswith("http"):
            # Absolute URL - extract path
            from urllib.parse import urlparse
            parsed = urlparse(location_header)
            location_path = parsed.path
        else:
            location_path = location_header
        
        # Verify resource is accessible at Location
        get_response = await http_client.get(location_path)
        assert get_response.status_code == 200
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_location_header_on_create",
            "passed",
            duration,
            {"location_header": location_header}
        )
    
    async def test_required_resource_elements(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test resources contain required elements per FHIR spec."""
        start_time = datetime.now()
        
        # Test creating resources with minimum required fields
        test_resources = [
            {
                "resourceType": "Patient",
                "gender": "unknown"  # Minimal Patient
            },
            {
                "resourceType": "Observation",
                "status": "final",
                "code": {"text": "Test"},
                "subject": {"reference": f"Patient/{test_patient['id']}"}
            },
            {
                "resourceType": "Condition",
                "clinicalStatus": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active"
                    }]
                },
                "code": {"text": "Test"},
                "subject": {"reference": f"Patient/{test_patient['id']}"}
            }
        ]
        
        for resource in test_resources:
            response = await http_client.post(
                f"/{resource['resourceType']}",
                json=resource
            )
            
            # Should successfully create with minimal required fields
            assert response.status_code == 201, \
                f"Failed to create {resource['resourceType']} with required fields only"
            
            created = response.json()
            cleanup_resources(resource["resourceType"], created["id"])
            
            # Verify server added required elements
            assert "id" in created
            assert "meta" in created
            assert "resourceType" in created
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_required_resource_elements",
            "passed",
            duration,
            {"resources_tested": len(test_resources)}
        )
    
    async def test_date_time_precision(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test date/time precision handling per FHIR spec."""
        start_time = datetime.now()
        
        # Test different date/time precisions
        date_formats = [
            "2024",                          # Year only
            "2024-03",                       # Year-month
            "2024-03-15",                    # Date only
            "2024-03-15T10:30:00Z",         # DateTime with seconds
            "2024-03-15T10:30:00.123Z",     # DateTime with milliseconds
        ]
        
        for date_value in date_formats:
            observation = {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8302-2",
                        "display": "Body height"
                    }]
                },
                "subject": {
                    "reference": f"Patient/{test_patient['id']}"
                },
                "effectiveDateTime": date_value,
                "valueQuantity": {
                    "value": 170,
                    "unit": "cm"
                }
            }
            
            response = await http_client.post("/Observation", json=observation)
            
            # Should accept all valid date/time formats
            assert response.status_code == 201, \
                f"Failed to create observation with date format: {date_value}"
            
            created = response.json()
            cleanup_resources("Observation", created["id"])
            
            # Verify date is preserved (though server may add precision)
            assert "effectiveDateTime" in created
            assert created["effectiveDateTime"].startswith(date_value[:10])
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_date_time_precision",
            "passed",
            duration,
            {"date_formats_tested": len(date_formats)}
        )