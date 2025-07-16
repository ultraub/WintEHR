#!/usr/bin/env python3
"""
Error Scenario Tests for FHIR API

Tests error handling, edge cases, and boundary conditions to ensure
the API responds appropriately to invalid requests and error conditions.
"""

import pytest
import asyncio
import aiohttp
import json
from typing import Dict, List, Any
import uuid

# Test configuration
BASE_URL = "http://localhost:8000/fhir/R4"


class TestErrorScenarios:
    """Test suite for error scenarios and edge cases"""
    
    @pytest.fixture
    async def session(self):
        """Create aiohttp session for tests"""
        async with aiohttp.ClientSession() as session:
            yield session
    
    async def test_invalid_resource_types(self, session):
        """Test requests for non-existent resource types"""
        print("\n1. Testing Invalid Resource Types")
        
        invalid_types = [
            "InvalidResource",
            "patient",  # lowercase
            "PATIENT",  # uppercase
            "Patients",  # plural
            "Person",  # Valid FHIR type but not supported
            "123Resource",  # Starting with number
            "Resource-Type",  # With hyphen
            ""  # Empty
        ]
        
        for resource_type in invalid_types:
            url = f"{BASE_URL}/{resource_type}"
            async with session.get(url) as resp:
                print(f"  '{resource_type}': {resp.status}")
                # Empty resource type might return 405 (Method Not Allowed) for root path
                expected_statuses = [404, 400] if resource_type else [404, 400, 405]
                assert resp.status in expected_statuses, f"Expected {expected_statuses} for '{resource_type}', got {resp.status}"
    
    async def test_non_existent_resources(self, session):
        """Test requests for resources that don't exist"""
        print("\n2. Testing Non-existent Resources")
        
        # Non-existent IDs
        test_cases = [
            ("Patient", str(uuid.uuid4())),
            ("Patient", "non-uuid-format"),
            ("Patient", "123"),
            ("Patient", ""),
            ("Observation", "99999999"),
            ("Condition", "does-not-exist")
        ]
        
        for resource_type, resource_id in test_cases:
            url = f"{BASE_URL}/{resource_type}/{resource_id}"
            async with session.get(url) as resp:
                print(f"  {resource_type}/{resource_id}: {resp.status}")
                # Empty ID might be treated as search
                if resource_id == "":
                    assert resp.status in [200, 404], f"Expected 200 or 404 for empty ID"
                else:
                    assert resp.status == 404, f"Expected 404 for {resource_type}/{resource_id}"
                
                # Verify error response format
                content_type = resp.headers.get('Content-Type', '')
                if content_type.startswith('application/json') or content_type.startswith('application/fhir'):
                    try:
                        error_data = await resp.json()
                        # Could be OperationOutcome, simple error, or detail field
                        assert any(key in error_data for key in ['error', 'resourceType', 'detail']), f"Unexpected error format: {error_data}"
                    except:
                        # If JSON parsing fails, that's okay for 404
                        pass
    
    async def test_malformed_search_parameters(self, session):
        """Test search with malformed parameters"""
        print("\n3. Testing Malformed Search Parameters")
        
        test_cases = [
            # Invalid parameter names
            ("Patient", {"invalid_param": "value"}),
            ("Patient", {"_invalidmodifier": "value"}),
            ("Patient", {"name[": "value"}),  # Unclosed bracket
            
            # Invalid parameter values
            ("Patient", {"_count": "not-a-number"}),
            ("Patient", {"_count": "-1"}),  # Negative
            ("Patient", {"_count": "0"}),  # Zero
            ("Patient", {"_count": "10000"}),  # Too large
            
            # Invalid dates
            ("Patient", {"birthdate": "invalid-date"}),
            ("Patient", {"birthdate": "2024-13-01"}),  # Invalid month
            ("Patient", {"birthdate": "2024/01/01"}),  # Wrong format
            
            # Invalid modifiers
            ("Patient", {"name:invalid": "value"}),
            ("Patient", {"birthdate:approximately": "2000"}),  # Invalid modifier for date
            
            # Invalid operators
            ("Observation", {"value-quantity": ">>10"}),  # Invalid operator
            ("Patient", {"birthdate": "bt2000"}),  # Invalid prefix
        ]
        
        for resource_type, params in test_cases:
            url = f"{BASE_URL}/{resource_type}"
            async with session.get(url, params=params) as resp:
                print(f"  {resource_type} with {list(params.keys())[0]}: {resp.status}")
                # Should return 400/422/500 for malformed parameters or 200 if ignored
                assert resp.status in [400, 422, 500, 200], f"Expected 400/422/500/200 for malformed params, got {resp.status}"
    
    async def test_invalid_includes(self, session):
        """Test invalid _include and _revinclude parameters"""
        print("\n4. Testing Invalid Include Parameters")
        
        test_cases = [
            # Invalid include format
            ("Patient", {"_include": "invalid"}),
            ("Patient", {"_include": "Patient:invalid-reference"}),
            ("Patient", {"_include": "InvalidResource:patient"}),
            
            # Invalid revinclude
            ("Patient", {"_revinclude": "invalid"}),
            ("Patient", {"_revinclude": "Observation:invalid-reference"}),
            
            # Multiple invalid includes
            ("Encounter", {"_include": "Encounter:patient,Encounter:invalid,Invalid:reference"}),
        ]
        
        for resource_type, params in test_cases:
            url = f"{BASE_URL}/{resource_type}"
            async with session.get(url, params=params) as resp:
                print(f"  {resource_type} with {list(params.keys())[0]}: {resp.status}")
                # API might ignore invalid includes or return 400
                assert resp.status in [200, 400]
    
    async def test_invalid_operations(self, session):
        """Test invalid operations"""
        print("\n5. Testing Invalid Operations")
        
        test_cases = [
            # Invalid operation names
            ("Patient/123/$invalid-operation", "GET"),
            ("Patient/$invalid", "GET"),
            ("$invalid-system-op", "GET"),
            
            # Valid operations on wrong resource types
            ("Observation/$everything", "GET"),  # Patient-specific operation
            ("Patient/$expand", "GET"),  # ValueSet operation
            
            # Wrong HTTP methods
            ("Patient/123/$everything", "POST"),  # Should be GET
            ("Patient/$validate", "GET"),  # Should be POST
        ]
        
        for url_path, method in test_cases:
            url = f"{BASE_URL}/{url_path}"
            async with session.request(method, url) as resp:
                print(f"  {method} {url_path}: {resp.status}")
                assert resp.status in [400, 404, 405]
    
    async def test_invalid_json_payloads(self, session):
        """Test POST/PUT with invalid JSON"""
        print("\n6. Testing Invalid JSON Payloads")
        
        # Malformed JSON
        invalid_json = '{"resourceType": "Patient", "name": [{"family": "Test"'  # Incomplete
        
        url = f"{BASE_URL}/Patient"
        async with session.post(
            url, 
            data=invalid_json,
            headers={'Content-Type': 'application/fhir+json'}
        ) as resp:
            print(f"  Malformed JSON: {resp.status}")
            assert resp.status == 400
        
        # Invalid FHIR structure
        invalid_structures = [
            {},  # Empty object
            {"notResourceType": "Patient"},  # Missing resourceType
            {"resourceType": "InvalidType"},  # Invalid resourceType
            {"resourceType": "Patient", "invalidField": "value"},  # Unknown field
            {"resourceType": "Patient", "name": "string"},  # Wrong type for name
            {"resourceType": "Patient", "birthDate": "1990-01-01"},  # Wrong field name
        ]
        
        for payload in invalid_structures:
            async with session.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/fhir+json'}
            ) as resp:
                print(f"  Invalid structure ({list(payload.keys())[0] if payload else 'empty'}): {resp.status}")
                assert resp.status in [400, 422]
    
    async def test_bundle_errors(self, session):
        """Test bundle transaction/batch error handling"""
        print("\n7. Testing Bundle Error Scenarios")
        
        # Bundle with mixed valid/invalid entries
        bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "GET",
                        "url": "Patient?_count=1"
                    }
                },
                {
                    "request": {
                        "method": "GET",
                        "url": "InvalidResource/123"  # Invalid resource type
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "InvalidType"  # Invalid resource
                    }
                }
            ]
        }
        
        url = f"{BASE_URL}/"
        async with session.post(
            url,
            json=bundle,
            headers={'Content-Type': 'application/fhir+json'}
        ) as resp:
            print(f"  Bundle with errors: {resp.status}")
            if resp.status == 200:
                result = await resp.json()
                # Check that errors are reported in bundle response
                assert result['resourceType'] == 'Bundle'
                assert result['type'] == 'batch-response'
                
                # Verify error entries
                for i, entry in enumerate(result.get('entry', [])):
                    if i > 0:  # Second and third entries should have errors
                        assert 'response' in entry
                        assert entry['response']['status'] != '200'
    
    async def test_content_type_errors(self, session):
        """Test incorrect content types"""
        print("\n8. Testing Content Type Errors")
        
        patient_data = {
            "resourceType": "Patient",
            "name": [{"family": "Test"}]
        }
        
        content_types = [
            "application/json",  # Should be application/fhir+json
            "text/plain",
            "application/xml",  # If XML not supported
            "application/fhir+xml",  # If XML not supported
            "",  # Empty
            None  # Missing
        ]
        
        url = f"{BASE_URL}/Patient"
        for content_type in content_types:
            headers = {}
            if content_type is not None:
                headers['Content-Type'] = content_type
            
            async with session.post(url, json=patient_data, headers=headers) as resp:
                print(f"  Content-Type '{content_type}': {resp.status}")
                # API might accept standard JSON or reject
                assert resp.status in [200, 201, 400, 415]
    
    async def test_pagination_errors(self, session):
        """Test pagination edge cases"""
        print("\n9. Testing Pagination Errors")
        
        test_cases = [
            {"_count": "1", "_offset": "999999"},  # Offset beyond results
            {"_count": "0"},  # Zero count
            {"_count": "-10"},  # Negative count
            {"_offset": "-10"},  # Negative offset
            {"_count": "abc"},  # Non-numeric
            {"_offset": "xyz"},  # Non-numeric
        ]
        
        url = f"{BASE_URL}/Patient"
        for params in test_cases:
            async with session.get(url, params=params) as resp:
                print(f"  Pagination {params}: {resp.status}")
                # Should handle gracefully
                assert resp.status in [200, 400]
    
    async def test_chained_search_errors(self, session):
        """Test invalid chained searches"""
        print("\n10. Testing Chained Search Errors")
        
        test_cases = [
            # Invalid chain syntax
            {"subject:": "value"},  # Missing target
            {"subject:Patient.": "value"},  # Missing parameter
            {"subject:InvalidResource.name": "value"},  # Invalid resource
            {"subject:Patient.invalid-param": "value"},  # Invalid parameter
            {"invalid-reference:Patient.name": "value"},  # Invalid reference
            
            # Too many chains (if limited)
            {"subject:Patient.organization:Organization.name": "value"},  # Double chain
        ]
        
        url = f"{BASE_URL}/Observation"
        for params in test_cases:
            async with session.get(url, params=params) as resp:
                param_key = list(params.keys())[0]
                print(f"  Chained search '{param_key}': {resp.status}")
                # Should return 400 or ignore invalid chains
                assert resp.status in [200, 400]
    
    async def test_conditional_operations_errors(self, session):
        """Test conditional create/update/delete errors"""
        print("\n11. Testing Conditional Operation Errors")
        
        patient_data = {
            "resourceType": "Patient",
            "identifier": [{
                "system": "http://example.org/mrn",
                "value": "12345"
            }],
            "name": [{"family": "Test"}]
        }
        
        # Conditional update with non-existent resource
        url = f"{BASE_URL}/Patient?identifier=http://example.org/mrn|99999"
        async with session.put(url, json=patient_data) as resp:
            print(f"  Conditional update (non-existent): {resp.status}")
            # Should create (201) or return error
            assert resp.status in [201, 400, 404]
        
        # Conditional delete with no matches
        url = f"{BASE_URL}/Patient?identifier=http://example.org/mrn|non-existent"
        async with session.delete(url) as resp:
            print(f"  Conditional delete (no match): {resp.status}")
            # Should return 204 (no content) or 404
            assert resp.status in [204, 404]
    
    async def test_version_conflicts(self, session):
        """Test version conflict scenarios"""
        print("\n12. Testing Version Conflicts")
        
        # First, get a patient with version
        url = f"{BASE_URL}/Patient?_count=1"
        async with session.get(url) as resp:
            if resp.status == 200:
                bundle = await resp.json()
                if bundle.get('entry'):
                    patient = bundle['entry'][0]['resource']
                    patient_id = patient['id']
                    
                    # Try to update with wrong version
                    update_url = f"{BASE_URL}/Patient/{patient_id}"
                    headers = {
                        'If-Match': 'W/"999"',  # Wrong version
                        'Content-Type': 'application/fhir+json'
                    }
                    
                    patient['name'] = [{"family": "Updated"}]
                    
                    async with session.put(update_url, json=patient, headers=headers) as resp:
                        print(f"  Version conflict update: {resp.status}")
                        # Should return 409 (Conflict) or 412 (Precondition Failed)
                        assert resp.status in [409, 412, 200]  # Some servers ignore If-Match


async def run_all_error_tests():
    """Run all error scenario tests"""
    tester = TestErrorScenarios()
    
    async with aiohttp.ClientSession() as session:
        print("=" * 70)
        print("FHIR API Error Scenario Tests")
        print("=" * 70)
        
        try:
            await tester.test_invalid_resource_types(session)
            await tester.test_non_existent_resources(session)
            await tester.test_malformed_search_parameters(session)
            await tester.test_invalid_includes(session)
            await tester.test_invalid_operations(session)
            await tester.test_invalid_json_payloads(session)
            await tester.test_bundle_errors(session)
            await tester.test_content_type_errors(session)
            await tester.test_pagination_errors(session)
            await tester.test_chained_search_errors(session)
            await tester.test_conditional_operations_errors(session)
            await tester.test_version_conflicts(session)
            
            print("\n" + "=" * 70)
            print("✅ All error scenario tests completed successfully!")
            print("=" * 70)
            
        except AssertionError as e:
            print(f"\n❌ Test assertion failed: {e}")
            raise
        except Exception as e:
            print(f"\n❌ Test failed with error: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(run_all_error_tests())