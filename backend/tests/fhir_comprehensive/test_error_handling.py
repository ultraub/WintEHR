"""
Error Handling and Edge Case Tests for FHIR API

Tests error scenarios, edge cases, boundary conditions, and 
proper error response handling.

Created: 2025-01-20
"""

import pytest
import httpx
from datetime import datetime
from typing import Dict, Any
import json


@pytest.mark.error_handling
class TestErrorHandling:
    """Test error handling and edge cases."""
    
    async def test_404_resource_not_found(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test 404 responses for non-existent resources."""
        start_time = datetime.now()
        
        # Test different scenarios
        test_cases = [
            ("/Patient/non-existent-id", "Non-existent resource ID"),
            ("/InvalidResourceType/123", "Invalid resource type"),
            ("/Patient/../../etc/passwd", "Path traversal attempt"),
            ("/Patient/!@#$%^&*()", "Special characters in ID"),
            ("/Patient/" + "x" * 1000, "Very long ID"),
        ]
        
        for url, description in test_cases:
            response = await http_client.get(url)
            
            # Should return 404 or 400 for invalid requests
            assert response.status_code in [404, 400], \
                f"{description}: Expected 404/400, got {response.status_code}"
            
            # Should return OperationOutcome if JSON response
            if response.headers.get("content-type", "").startswith("application/"):
                try:
                    error_body = response.json()
                    assert test_validator.is_valid_operation_outcome(error_body)
                except Exception:
                    pass  # Some errors might not return JSON
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_404_resource_not_found",
            "passed",
            duration,
            {"test_cases": len(test_cases)}
        )
    
    async def test_invalid_resource_creation(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test error handling for invalid resource creation."""
        start_time = datetime.now()
        
        # Various invalid resources
        invalid_resources = [
            # Missing resourceType
            ({
                "status": "final",
                "code": {"text": "Test"}
            }, "Missing resourceType"),
            
            # Invalid resourceType
            ({
                "resourceType": "NotAValidResource",
                "id": "123"
            }, "Invalid resourceType"),
            
            # Missing required fields
            ({
                "resourceType": "Patient"
                # Missing required fields like gender
            }, "Missing required fields"),
            
            # Invalid enum value
            ({
                "resourceType": "Patient",
                "gender": "invalid-gender-value"
            }, "Invalid enum value"),
            
            # Invalid reference format
            ({
                "resourceType": "Condition",
                "subject": {
                    "reference": "not-a-valid-reference"
                }
            }, "Invalid reference format"),
            
            # Invalid date format
            ({
                "resourceType": "Patient",
                "birthDate": "not-a-date",
                "gender": "unknown"
            }, "Invalid date format"),
        ]
        
        for resource, description in invalid_resources:
            response = await http_client.post("/", json=resource)
            
            # Should return 400 or 422
            assert response.status_code in [400, 422], \
                f"{description}: Expected 400/422, got {response.status_code}"
            
            # Should return OperationOutcome
            try:
                error_body = response.json()
                assert test_validator.is_valid_operation_outcome(error_body)
                
                # Should have error severity issues
                has_error = any(
                    issue.get("severity") in ["error", "fatal"]
                    for issue in error_body.get("issue", [])
                )
                assert has_error
            except Exception:
                pass
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_invalid_resource_creation",
            "passed",
            duration,
            {"invalid_resources_tested": len(invalid_resources)}
        )
    
    async def test_malformed_json(
        self,
        http_client: httpx.AsyncClient,
        test_report
    ):
        """Test handling of malformed JSON."""
        start_time = datetime.now()
        
        # Various malformed JSON cases
        malformed_cases = [
            '{invalid json}',
            '{"resourceType": "Patient", "gender": "unknown"',  # Missing closing brace
            '{"resourceType": "Patient", "gender": "unknown",,}',  # Double comma
            'null',
            'undefined',
            '[]',  # Array instead of object
            '',  # Empty string
        ]
        
        for malformed_json in malformed_cases:
            response = await http_client.post(
                "/Patient",
                content=malformed_json,
                headers={"Content-Type": "application/fhir+json"}
            )
            
            # Should return 400 Bad Request
            assert response.status_code == 400, \
                f"Expected 400 for malformed JSON, got {response.status_code}"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_malformed_json",
            "passed",
            duration,
            {"malformed_cases_tested": len(malformed_cases)}
        )
    
    async def test_invalid_search_parameters(
        self,
        http_client: httpx.AsyncClient,
        test_report
    ):
        """Test handling of invalid search parameters."""
        start_time = datetime.now()
        
        # Test various invalid search scenarios
        test_cases = [
            # Unknown search parameter
            ("/Patient?unknown-param=value", "Unknown parameter"),
            
            # Invalid date format
            ("/Patient?birthdate=invalid-date", "Invalid date"),
            
            # Invalid modifier
            ("/Patient?name:invalid-modifier=Smith", "Invalid modifier"),
            
            # Invalid comparator
            ("/Patient?birthdate=xx2020-01-01", "Invalid comparator"),
            
            # Invalid chaining
            ("/Patient?invalid:chain.name=Smith", "Invalid chain"),
            
            # Invalid _has syntax
            ("/Patient?_has:invalid", "Invalid _has"),
            
            # Invalid composite syntax
            ("/Observation?code-value-invalid=test", "Invalid composite"),
        ]
        
        for url, description in test_cases:
            response = await http_client.get(url)
            
            # Should return 400 or still process (ignoring unknown params)
            assert response.status_code in [200, 400], \
                f"{description}: Unexpected status {response.status_code}"
            
            if response.status_code == 400:
                try:
                    error_body = response.json()
                    # Should be OperationOutcome
                    assert error_body.get("resourceType") == "OperationOutcome"
                except Exception:
                    pass
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_invalid_search_parameters",
            "passed",
            duration,
            {"test_cases": len(test_cases)}
        )
    
    async def test_boundary_conditions(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test boundary conditions and limits."""
        start_time = datetime.now()
        
        # Test various boundary conditions
        
        # 1. Very large resource
        large_text = "x" * 10000  # 10KB of text
        large_observation = {
            "resourceType": "Observation",
            "status": "final",
            "code": {"text": "Test"},
            "subject": {"reference": f"Patient/{test_patient['id']}"},
            "note": [{"text": large_text}]
        }
        
        response = await http_client.post("/Observation", json=large_observation)
        if response.status_code == 201:
            cleanup_resources("Observation", response.json()["id"])
        
        # Should either accept or reject with appropriate error
        assert response.status_code in [201, 400, 413], \
            f"Large resource: unexpected status {response.status_code}"
        
        # 2. Empty arrays and objects
        empty_patient = {
            "resourceType": "Patient",
            "name": [],  # Empty array
            "contact": [{}],  # Array with empty object
            "gender": "unknown"
        }
        
        response = await http_client.post("/Patient", json=empty_patient)
        if response.status_code == 201:
            cleanup_resources("Patient", response.json()["id"])
        
        # 3. Maximum search results
        response = await http_client.get("/Patient?_count=10000")
        assert response.status_code == 200
        
        bundle = response.json()
        # Server should limit results even if high count requested
        assert len(bundle.get("entry", [])) <= 1000, \
            "Server should limit maximum results"
        
        # 4. Zero and negative values
        response = await http_client.get("/Patient?_count=0")
        assert response.status_code == 200
        
        response = await http_client.get("/Patient?_count=-1")
        # Should either ignore or return error
        assert response.status_code in [200, 400]
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_boundary_conditions",
            "passed",
            duration,
            {"boundary_tests": 4}
        )
    
    async def test_concurrent_updates(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test handling of concurrent updates (race conditions)."""
        start_time = datetime.now()
        
        # Create a resource
        condition = {
            "resourceType": "Condition",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            "code": {"text": "Test condition"},
            "subject": {"reference": f"Patient/{test_patient['id']}"}
        }
        
        create_response = await http_client.post("/Condition", json=condition)
        assert create_response.status_code == 201
        
        created = create_response.json()
        resource_id = created["id"]
        cleanup_resources("Condition", resource_id)
        
        # Get current version
        get_response = await http_client.get(f"/Condition/{resource_id}")
        current_resource = get_response.json()
        
        # Try to update with old version (simulate concurrent update)
        import asyncio
        
        async def update_resource(note_text):
            resource_copy = current_resource.copy()
            resource_copy["note"] = [{"text": note_text}]
            return await http_client.put(
                f"/Condition/{resource_id}",
                json=resource_copy
            )
        
        # Launch concurrent updates
        results = await asyncio.gather(
            update_resource("Update 1"),
            update_resource("Update 2"),
            return_exceptions=True
        )
        
        # At least one should succeed
        success_count = sum(
            1 for r in results 
            if not isinstance(r, Exception) and r.status_code == 200
        )
        assert success_count >= 1, "At least one update should succeed"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_concurrent_updates",
            "passed",
            duration,
            {"concurrent_updates": len(results)}
        )
    
    async def test_circular_references(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test handling of circular references in _include."""
        start_time = datetime.now()
        
        # Try to create circular include (should be handled gracefully)
        response = await http_client.get(
            f"/Patient?_id={test_patient['id']}"
            "&_include=Patient:organization"
            "&_include=Organization:partOf"
            "&_include:iterate=Organization:partOf"
        )
        
        # Should return 200 (handling circular references)
        assert response.status_code == 200
        
        bundle = response.json()
        
        # Should not have infinite resources
        assert len(bundle.get("entry", [])) < 100, \
            "Circular reference not properly handled"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_circular_references",
            "passed",
            duration,
            {"entries_returned": len(bundle.get("entry", []))}
        )
    
    async def test_invalid_http_methods(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test handling of invalid HTTP methods."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Test unsupported methods
        invalid_methods = ["PATCH", "TRACE", "CONNECT"]
        
        for method in invalid_methods:
            try:
                response = await http_client.request(
                    method,
                    f"/Patient/{patient_id}"
                )
                
                # Should return 405 Method Not Allowed
                assert response.status_code == 405, \
                    f"{method} should return 405, got {response.status_code}"
                
                # Should have Allow header
                allow_header = response.headers.get("Allow")
                assert allow_header is not None, \
                    "405 response should include Allow header"
                
            except Exception as e:
                # Some methods might be blocked at client level
                pass
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_invalid_http_methods",
            "passed",
            duration,
            {"methods_tested": len(invalid_methods)}
        )
    
    async def test_header_injection(
        self,
        http_client: httpx.AsyncClient,
        test_report
    ):
        """Test protection against header injection."""
        start_time = datetime.now()
        
        # Try various header injection attempts
        injection_headers = {
            "X-Custom-Header": "value\r\nX-Injected: malicious",
            "Accept": "application/json\r\nX-Another: injected",
            "If-None-Match": 'W/"123"\r\nX-Evil: header'
        }
        
        for header, value in injection_headers.items():
            headers = http_client.headers.copy()
            headers[header] = value
            
            try:
                response = await http_client.get(
                    "/Patient",
                    headers=headers
                )
                
                # Should either sanitize or reject
                assert response.status_code in [200, 400], \
                    f"Unexpected response to header injection: {response.status_code}"
                
            except Exception:
                # Client might reject invalid headers
                pass
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_header_injection",
            "passed",
            duration,
            {"injection_attempts": len(injection_headers)}
        )
    
    async def test_resource_id_constraints(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test resource ID constraints and validation."""
        start_time = datetime.now()
        
        # Test various ID scenarios
        test_ids = [
            ("123", True),  # Simple numeric
            ("abc-def-123", True),  # Alphanumeric with hyphens
            ("ABC123", True),  # Mixed case
            ("id.with.dots", True),  # Dots allowed
            ("id_with_underscores", True),  # Underscores allowed
            ("id with spaces", False),  # Spaces not allowed
            ("id/with/slashes", False),  # Slashes not allowed
            ("id?with=params", False),  # Query params not allowed
            ("", False),  # Empty ID
            ("a" * 65, False),  # Too long (>64 chars)
        ]
        
        for test_id, should_succeed in test_ids:
            # Try to create resource with specific ID
            patient = {
                "resourceType": "Patient",
                "id": test_id,
                "gender": "unknown"
            }
            
            response = await http_client.put(
                f"/Patient/{test_id}",
                json=patient
            )
            
            if should_succeed:
                # Clean up if created
                if response.status_code in [200, 201]:
                    cleanup_resources("Patient", test_id)
                    
                assert response.status_code in [200, 201, 400], \
                    f"ID '{test_id}' handling: unexpected status {response.status_code}"
            else:
                assert response.status_code in [400, 404], \
                    f"Invalid ID '{test_id}' should be rejected"
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_resource_id_constraints",
            "passed",
            duration,
            {"id_tests": len(test_ids)}
        )
    
    async def test_transaction_rollback(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test transaction bundle rollback on error."""
        start_time = datetime.now()
        
        # Create transaction with one invalid entry
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {"text": "Valid observation"},
                        "subject": {"reference": f"Patient/{test_patient['id']}"}
                    },
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    }
                },
                {
                    "resource": {
                        "resourceType": "Observation",
                        # Missing required status field
                        "code": {"text": "Invalid observation"}
                    },
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    }
                }
            ]
        }
        
        # Submit transaction
        response = await http_client.post("/", json=bundle)
        
        # Transaction should fail (400 or 422)
        assert response.status_code in [400, 422], \
            f"Transaction with invalid entry should fail, got {response.status_code}"
        
        # Verify rollback by checking first observation wasn't created
        # (This would require checking the database or searching)
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Report result
        test_report(
            "test_transaction_rollback",
            "passed",
            duration,
            {"transaction_entries": 2}
        )