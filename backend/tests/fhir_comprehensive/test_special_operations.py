"""
Special Operations Tests for FHIR API

Tests FHIR special operations including $everything, _history, 
$validate, and other resource-specific operations.

Created: 2025-01-20
"""

import pytest
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List
import json


@pytest.mark.integration
class TestSpecialOperations:
    """Test FHIR special operations and extended functionality."""
    
    async def test_patient_everything_operation(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report,
        performance_thresholds
    ):
        """Test Patient/$everything operation."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Get everything for a patient
        response = await http_client.get(f"/Patient/{patient_id}/$everything")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Should return multiple resource types
        resource_types = set()
        patient_found = False
        
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                resource_types.add(resource["resourceType"])
                
                # Verify patient is included
                if resource["resourceType"] == "Patient" and resource["id"] == patient_id:
                    patient_found = True
                
                # Verify all resources relate to the patient
                if resource["resourceType"] != "Patient":
                    # Check common patient reference fields
                    patient_ref = f"Patient/{patient_id}"
                    has_patient_ref = False
                    
                    for field in ["patient", "subject", "participant", "individual"]:
                        if field in resource:
                            ref = resource[field].get("reference", "") if isinstance(resource[field], dict) else ""
                            if ref == patient_ref:
                                has_patient_ref = True
                                break
                    
                    # Some resources might reference patient indirectly
                    if not has_patient_ref and resource["resourceType"] in ["Practitioner", "Organization", "Location"]:
                        has_patient_ref = True  # These might be related through encounters
                    
                    assert has_patient_ref, \
                        f"Resource {resource['resourceType']}/{resource['id']} doesn't reference patient"
        
        assert patient_found, "Patient not included in $everything response"
        assert len(resource_types) > 1, "Should return multiple resource types"
        
        # Check performance
        assert duration < performance_thresholds["patient_everything"], \
            f"Patient/$everything took {duration}s, threshold is {performance_thresholds['patient_everything']}s"
        
        # Report result
        test_report(
            "test_patient_everything_operation",
            "passed",
            duration,
            {
                "patient_id": patient_id,
                "resource_types": list(resource_types),
                "total_resources": bundle.get("total", 0),
                "performance_ok": duration < performance_thresholds["patient_everything"]
            }
        )
    
    async def test_patient_everything_with_types(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test Patient/$everything with specific resource types."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        requested_types = ["Condition", "Observation", "MedicationRequest"]
        
        # Get specific types for a patient
        type_param = ",".join(requested_types)
        response = await http_client.get(
            f"/Patient/{patient_id}/$everything?_type={type_param}"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Verify only requested types are returned
        returned_types = set()
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                returned_types.add(resource["resourceType"])
        
        # Should only have requested types plus the patient
        allowed_types = set(requested_types + ["Patient"])
        assert returned_types.issubset(allowed_types), \
            f"Unexpected resource types: {returned_types - allowed_types}"
        
        # Report result
        test_report(
            "test_patient_everything_with_types",
            "passed",
            duration,
            {
                "requested_types": requested_types,
                "returned_types": list(returned_types),
                "total_resources": bundle.get("total", 0)
            }
        )
    
    async def test_patient_everything_with_date_range(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test Patient/$everything with date range filter."""
        start_time = datetime.now()
        
        patient_id = test_patient["id"]
        
        # Get everything from last 2 years
        start_date = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        response = await http_client.get(
            f"/Patient/{patient_id}/$everything"
            f"?start={start_date}&end={end_date}"
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle)
        
        # Report result
        test_report(
            "test_patient_everything_with_date_range",
            "passed",
            duration,
            {
                "date_range": f"{start_date} to {end_date}",
                "total_resources": bundle.get("total", 0)
            }
        )
    
    async def test_resource_history(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_validator,
        test_report
    ):
        """Test resource _history operation."""
        start_time = datetime.now()
        
        # Create a resource and update it to generate history
        condition = {
            "resourceType": "Condition",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "119981000146107",
                    "display": "Fever symptom"
                }]
            },
            "subject": {
                "reference": f"Patient/{test_patient['id']}"
            }
        }
        
        # Create condition
        create_response = await http_client.post("/Condition", json=condition)
        assert create_response.status_code == 201
        
        created_condition = create_response.json()
        condition_id = created_condition["id"]
        cleanup_resources("Condition", condition_id)
        
        # Update condition twice to create history
        created_condition["clinicalStatus"]["coding"][0]["code"] = "resolved"
        update1_response = await http_client.put(
            f"/Condition/{condition_id}",
            json=created_condition
        )
        assert update1_response.status_code == 200
        
        updated_condition = update1_response.json()
        updated_condition["note"] = [{"text": "Resolved after treatment"}]
        update2_response = await http_client.put(
            f"/Condition/{condition_id}",
            json=updated_condition
        )
        assert update2_response.status_code == 200
        
        # Get history
        history_response = await http_client.get(f"/Condition/{condition_id}/_history")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert history_response.status_code == 200
        
        bundle = history_response.json()
        assert test_validator.is_valid_bundle(bundle, expected_type="history")
        
        # Should have at least 3 versions
        assert bundle.get("total", 0) >= 3, "Should have at least 3 history entries"
        
        # Verify versions are in reverse chronological order
        if "entry" in bundle:
            versions = []
            for entry in bundle["entry"]:
                resource = entry["resource"]
                assert resource["id"] == condition_id
                versions.append(int(resource["meta"]["versionId"]))
            
            # Versions should be descending
            for i in range(1, len(versions)):
                assert versions[i-1] > versions[i], "History not in reverse chronological order"
        
        # Report result
        test_report(
            "test_resource_history",
            "passed",
            duration,
            {
                "resource_id": condition_id,
                "versions": bundle.get("total", 0)
            }
        )
    
    async def test_resource_type_history(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test resource type _history operation."""
        start_time = datetime.now()
        
        # Get history for all Patients (limited)
        response = await http_client.get("/Patient/_history?_count=10")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle, expected_type="history")
        
        # All entries should be Patients
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                assert resource["resourceType"] == "Patient"
                assert "meta" in resource
                assert "versionId" in resource["meta"]
        
        # Report result
        test_report(
            "test_resource_type_history",
            "passed",
            duration,
            {
                "resource_type": "Patient",
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_system_history(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test system-wide _history operation."""
        start_time = datetime.now()
        
        # Get system history (recent changes across all resources)
        since = (datetime.now() - timedelta(days=7)).isoformat()
        response = await http_client.get(f"/_history?_since={since}&_count=20")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        bundle = response.json()
        assert test_validator.is_valid_bundle(bundle, expected_type="history")
        
        # Should contain mixed resource types
        resource_types = set()
        if "entry" in bundle:
            for entry in bundle["entry"]:
                resource = entry["resource"]
                resource_types.add(resource["resourceType"])
                
                # Verify all have version info
                assert "meta" in resource
                assert "versionId" in resource["meta"]
                assert "lastUpdated" in resource["meta"]
        
        # Report result
        test_report(
            "test_system_history",
            "passed",
            duration,
            {
                "since": since,
                "resource_types": list(resource_types),
                "results": bundle.get("total", 0)
            }
        )
    
    async def test_validate_operation(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_validator,
        test_report
    ):
        """Test $validate operation."""
        start_time = datetime.now()
        
        # Valid resource
        valid_observation = {
            "resourceType": "Observation",
            "status": "final",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "29463-7",
                    "display": "Body weight"
                }]
            },
            "subject": {
                "reference": f"Patient/{test_patient['id']}"
            },
            "valueQuantity": {
                "value": 70,
                "unit": "kg",
                "system": "http://unitsofmeasure.org",
                "code": "kg"
            }
        }
        
        # Validate the resource
        response = await http_client.post(
            "/Observation/$validate",
            json=valid_observation
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Should return 200 with OperationOutcome
        assert response.status_code == 200
        
        outcome = response.json()
        assert test_validator.is_valid_operation_outcome(outcome)
        
        # Check for successful validation
        has_error = any(
            issue.get("severity") == "error"
            for issue in outcome.get("issue", [])
        )
        assert not has_error, "Valid resource should not have validation errors"
        
        # Report result
        test_report(
            "test_validate_operation",
            "passed",
            duration,
            {
                "resource_type": "Observation",
                "validation_passed": not has_error
            }
        )
    
    async def test_validate_invalid_resource(
        self,
        http_client: httpx.AsyncClient,
        test_validator,
        test_report
    ):
        """Test $validate operation with invalid resource."""
        start_time = datetime.now()
        
        # Invalid resource (missing required status)
        invalid_observation = {
            "resourceType": "Observation",
            # "status": "final",  # Missing required field
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "29463-7"
                }]
            }
        }
        
        # Validate the resource
        response = await http_client.post(
            "/Observation/$validate",
            json=invalid_observation
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Should return 200 or 400 with OperationOutcome
        assert response.status_code in [200, 400]
        
        outcome = response.json()
        assert test_validator.is_valid_operation_outcome(outcome)
        
        # Should have validation errors
        has_error = any(
            issue.get("severity") in ["error", "fatal"]
            for issue in outcome.get("issue", [])
        )
        assert has_error, "Invalid resource should have validation errors"
        
        # Report result
        test_report(
            "test_validate_invalid_resource",
            "passed",
            duration,
            {
                "validation_failed": has_error,
                "issue_count": len(outcome.get("issue", []))
            }
        )
    
    async def test_meta_operations(
        self,
        http_client: httpx.AsyncClient,
        test_report
    ):
        """Test metadata operations."""
        start_time = datetime.now()
        
        # Get metadata for Patient resource type
        response = await http_client.get("/Patient/$meta")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Should return metadata
        assert response.status_code == 200
        
        # The response format varies by implementation
        # Could be Parameters, Bundle, or direct metadata
        
        # Report result
        test_report(
            "test_meta_operations",
            "passed",
            duration,
            {"resource_type": "Patient"}
        )
    
    async def test_transaction_bundle(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_validator,
        test_report
    ):
        """Test transaction bundle processing."""
        start_time = datetime.now()
        
        # Create a transaction bundle with interdependent resources
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:condition-1",
                    "resource": {
                        "resourceType": "Condition",
                        "clinicalStatus": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                                "code": "active"
                            }]
                        },
                        "code": {
                            "coding": [{
                                "system": "http://snomed.info/sct",
                                "code": "73211009",
                                "display": "Diabetes mellitus"
                            }]
                        },
                        "subject": {
                            "reference": f"Patient/{test_patient['id']}"
                        }
                    },
                    "request": {
                        "method": "POST",
                        "url": "Condition"
                    }
                },
                {
                    "fullUrl": "urn:uuid:observation-1",
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": "4548-4",
                                "display": "Hemoglobin A1c"
                            }]
                        },
                        "subject": {
                            "reference": f"Patient/{test_patient['id']}"
                        },
                        "valueQuantity": {
                            "value": 7.5,
                            "unit": "%"
                        },
                        "reasonReference": [{
                            "reference": "urn:uuid:condition-1"  # Reference to condition in same bundle
                        }]
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
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        result_bundle = response.json()
        assert result_bundle["resourceType"] == "Bundle"
        assert result_bundle["type"] == "transaction-response"
        
        # Should have responses for both entries
        assert len(result_bundle.get("entry", [])) == 2
        
        # Track created resources for cleanup
        for entry in result_bundle["entry"]:
            if "resource" in entry:
                resource = entry["resource"]
                cleanup_resources(resource["resourceType"], resource["id"])
                
                # Verify successful creation
                assert entry.get("response", {}).get("status", "").startswith("201")
        
        # Report result
        test_report(
            "test_transaction_bundle",
            "passed",
            duration,
            {
                "entries_submitted": 2,
                "entries_processed": len(result_bundle.get("entry", []))
            }
        )
    
    async def test_batch_bundle_mixed_operations(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_validator,
        test_report
    ):
        """Test batch bundle with mixed operations."""
        start_time = datetime.now()
        
        # Create a batch bundle with different operations
        bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "GET",
                        "url": f"Patient/{test_patient['id']}"
                    }
                },
                {
                    "resource": {
                        "resourceType": "AllergyIntolerance",
                        "clinicalStatus": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                                "code": "active"
                            }]
                        },
                        "code": {
                            "coding": [{
                                "system": "http://snomed.info/sct",
                                "code": "91935009",
                                "display": "Allergy to peanuts"
                            }]
                        },
                        "patient": {
                            "reference": f"Patient/{test_patient['id']}"
                        }
                    },
                    "request": {
                        "method": "POST",
                        "url": "AllergyIntolerance"
                    }
                },
                {
                    "request": {
                        "method": "GET",
                        "url": "Condition?patient=" + test_patient['id'] + "&_count=5"
                    }
                }
            ]
        }
        
        # Submit batch
        response = await http_client.post("/", json=bundle)
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200
        
        result_bundle = response.json()
        assert result_bundle["resourceType"] == "Bundle"
        assert result_bundle["type"] == "batch-response"
        
        # Should have responses for all entries
        assert len(result_bundle.get("entry", [])) == 3
        
        # Check each response
        for i, entry in enumerate(result_bundle["entry"]):
            response_data = entry.get("response", {})
            
            if i == 0:  # GET Patient
                assert response_data.get("status", "").startswith("200")
                assert "resource" in entry
                assert entry["resource"]["resourceType"] == "Patient"
                
            elif i == 1:  # POST AllergyIntolerance
                assert response_data.get("status", "").startswith("201")
                if "resource" in entry:
                    cleanup_resources("AllergyIntolerance", entry["resource"]["id"])
                    
            elif i == 2:  # GET Conditions (search)
                assert response_data.get("status", "").startswith("200")
                assert "resource" in entry
                assert entry["resource"]["resourceType"] == "Bundle"
        
        # Report result
        test_report(
            "test_batch_bundle_mixed_operations",
            "passed",
            duration,
            {
                "operations": ["GET", "POST", "SEARCH"],
                "entries_processed": len(result_bundle.get("entry", []))
            }
        )
    
    async def test_conditional_update_operation(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test conditional update operation."""
        start_time = datetime.now()
        
        # Create a unique identifier
        identifier = f"test-allergy-{datetime.now().timestamp()}"
        
        # Create initial resource
        allergy = {
            "resourceType": "AllergyIntolerance",
            "identifier": [{
                "system": "http://example.org/allergies",
                "value": identifier
            }],
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code": "active"
                }]
            },
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "300913006",
                    "display": "Shellfish allergy"
                }]
            },
            "patient": {
                "reference": f"Patient/{test_patient['id']}"
            },
            "criticality": "low"
        }
        
        # First create
        create_response = await http_client.post("/AllergyIntolerance", json=allergy)
        assert create_response.status_code == 201
        
        created_allergy = create_response.json()
        allergy_id = created_allergy["id"]
        cleanup_resources("AllergyIntolerance", allergy_id)
        
        # Now do conditional update
        allergy["criticality"] = "high"
        allergy["note"] = [{"text": "Severe reaction reported"}]
        
        # Conditional update using search criteria
        update_response = await http_client.put(
            f"/AllergyIntolerance?identifier={identifier}",
            json=allergy
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Should return 200 (updated) or 201 (created)
        assert update_response.status_code in [200, 201]
        
        updated_allergy = update_response.json()
        assert updated_allergy["criticality"] == "high"
        assert len(updated_allergy.get("note", [])) == 1
        
        # Report result
        test_report(
            "test_conditional_update_operation",
            "passed",
            duration,
            {
                "identifier": identifier,
                "update_status": update_response.status_code
            }
        )