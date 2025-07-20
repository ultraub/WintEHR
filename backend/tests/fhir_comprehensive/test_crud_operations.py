"""
CRUD Operation Tests for FHIR API

Tests Create, Read, Update, Delete, and Vread operations for all supported resource types.

Created: 2025-01-20
"""

import pytest
import httpx
from datetime import datetime
import json
from typing import Dict, Any

# All FHIR resource types supported by the system
FHIR_RESOURCE_TYPES = [
    "Patient", "Practitioner", "Organization", "Location", "Encounter",
    "Appointment", "Observation", "Condition", "Procedure", "Medication",
    "MedicationRequest", "MedicationStatement", "MedicationDispense", 
    "MedicationAdministration", "DiagnosticReport", "ImagingStudy", 
    "CarePlan", "Goal", "Immunization", "AllergyIntolerance", 
    "DocumentReference", "Task", "ServiceRequest", "Specimen", "Device",
    "Questionnaire", "QuestionnaireResponse", "ValueSet", "CodeSystem",
    "ConceptMap", "StructureDefinition", "PractitionerRole", "CareTeam",
    "Claim", "Coverage", "ExplanationOfBenefit", "SupplyDelivery",
    "Provenance", "List", "Basic", "Composition", "Media", "Schedule",
    "Slot", "Communication", "CommunicationRequest"
]


@pytest.mark.crud
class TestCRUDOperations:
    """Test CRUD operations for all FHIR resource types."""
    
    @pytest.mark.parametrize("resource_type", FHIR_RESOURCE_TYPES)
    async def test_create_resource(
        self, 
        http_client: httpx.AsyncClient,
        resource_type: str,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test creating a new resource via POST."""
        start_time = datetime.now()
        
        # Get appropriate test resource based on type
        resource = self._get_test_resource(resource_type, test_patient["id"])
        
        # Skip if we don't have a test resource for this type
        if not resource:
            pytest.skip(f"No test data for {resource_type}")
        
        # Create resource
        response = await http_client.post(
            f"/{resource_type}",
            json=resource
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 201, f"Failed to create {resource_type}: {response.text}"
        
        created_resource = response.json()
        assert created_resource["resourceType"] == resource_type
        assert "id" in created_resource
        assert "meta" in created_resource
        assert "lastUpdated" in created_resource["meta"]
        
        # Track for cleanup
        cleanup_resources(resource_type, created_resource["id"])
        
        # Report result
        test_report(
            f"test_create_{resource_type}",
            "passed",
            duration,
            {"resource_id": created_resource["id"]}
        )
    
    @pytest.mark.parametrize("resource_type", ["Patient", "Condition", "Observation", "MedicationRequest"])
    async def test_read_resource(
        self,
        http_client: httpx.AsyncClient,
        resource_type: str,
        db_connection,
        test_report
    ):
        """Test reading an existing resource via GET."""
        start_time = datetime.now()
        
        # Get an existing resource ID from database
        row = await db_connection.fetchrow(f"""
            SELECT fhir_id FROM fhir.resources
            WHERE resource_type = $1
            AND deleted = false
            LIMIT 1
        """, resource_type)
        
        if not row:
            pytest.skip(f"No existing {resource_type} found")
        
        resource_id = row["fhir_id"]
        
        # Read resource
        response = await http_client.get(f"/{resource_type}/{resource_id}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert response.status_code == 200, f"Failed to read {resource_type}/{resource_id}"
        
        resource = response.json()
        assert resource["resourceType"] == resource_type
        assert resource["id"] == resource_id
        assert "meta" in resource
        
        # Report result
        test_report(
            f"test_read_{resource_type}",
            "passed",
            duration,
            {"resource_id": resource_id}
        )
    
    async def test_update_resource(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test updating a resource via PUT."""
        start_time = datetime.now()
        
        # First create a condition
        condition = {
            "resourceType": "Condition",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            "verificationStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "provisional"
                }]
            },
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "386661006",
                    "display": "Fever"
                }]
            },
            "subject": {
                "reference": f"Patient/{test_patient['id']}"
            }
        }
        
        # Create resource
        create_response = await http_client.post("/Condition", json=condition)
        assert create_response.status_code == 201
        
        created_condition = create_response.json()
        condition_id = created_condition["id"]
        cleanup_resources("Condition", condition_id)
        
        # Update the condition
        created_condition["verificationStatus"]["coding"][0]["code"] = "confirmed"
        created_condition["note"] = [{
            "text": "Patient confirmed symptoms"
        }]
        
        # Update resource
        update_response = await http_client.put(
            f"/Condition/{condition_id}",
            json=created_condition
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert update_response.status_code == 200
        
        updated_condition = update_response.json()
        assert updated_condition["id"] == condition_id
        assert updated_condition["verificationStatus"]["coding"][0]["code"] == "confirmed"
        assert len(updated_condition["note"]) == 1
        
        # Verify version incremented
        assert int(updated_condition["meta"]["versionId"]) > int(created_condition["meta"]["versionId"])
        
        # Report result
        test_report(
            "test_update_resource",
            "passed",
            duration,
            {"resource_id": condition_id}
        )
    
    async def test_delete_resource(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        test_report
    ):
        """Test deleting a resource via DELETE."""
        start_time = datetime.now()
        
        # Create a resource to delete
        allergy = {
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
                    "code": "227493005",
                    "display": "Cashew nut"
                }]
            },
            "patient": {
                "reference": f"Patient/{test_patient['id']}"
            }
        }
        
        # Create resource
        create_response = await http_client.post("/AllergyIntolerance", json=allergy)
        assert create_response.status_code == 201
        
        resource_id = create_response.json()["id"]
        
        # Delete resource
        delete_response = await http_client.delete(f"/AllergyIntolerance/{resource_id}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert delete_response.status_code == 204
        
        # Verify resource is deleted (should return 410 Gone)
        get_response = await http_client.get(f"/AllergyIntolerance/{resource_id}")
        assert get_response.status_code == 410
        
        # Report result
        test_report(
            "test_delete_resource",
            "passed",
            duration,
            {"resource_id": resource_id}
        )
    
    async def test_vread_resource(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test reading a specific version of a resource."""
        start_time = datetime.now()
        
        # Create and update a resource to have multiple versions
        observation = {
            "resourceType": "Observation",
            "status": "preliminary",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "15074-8",
                    "display": "Glucose"
                }]
            },
            "subject": {
                "reference": f"Patient/{test_patient['id']}"
            },
            "valueQuantity": {
                "value": 95,
                "unit": "mg/dL"
            }
        }
        
        # Create resource
        create_response = await http_client.post("/Observation", json=observation)
        assert create_response.status_code == 201
        
        created_obs = create_response.json()
        obs_id = created_obs["id"]
        version1 = created_obs["meta"]["versionId"]
        cleanup_resources("Observation", obs_id)
        
        # Update to create version 2
        created_obs["status"] = "final"
        created_obs["valueQuantity"]["value"] = 98
        
        update_response = await http_client.put(f"/Observation/{obs_id}", json=created_obs)
        assert update_response.status_code == 200
        
        updated_obs = update_response.json()
        version2 = updated_obs["meta"]["versionId"]
        
        # Vread version 1
        vread_response = await http_client.get(f"/Observation/{obs_id}/_history/{version1}")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Validate response
        assert vread_response.status_code == 200
        
        version1_obs = vread_response.json()
        assert version1_obs["meta"]["versionId"] == version1
        assert version1_obs["status"] == "preliminary"
        assert version1_obs["valueQuantity"]["value"] == 95
        
        # Report result
        test_report(
            "test_vread_resource",
            "passed",
            duration,
            {
                "resource_id": obs_id,
                "version": version1
            }
        )
    
    async def test_conditional_create(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test conditional create with If-None-Exist header."""
        start_time = datetime.now()
        
        # Create a unique identifier for testing
        identifier = f"test-med-{datetime.now().timestamp()}"
        
        medication = {
            "resourceType": "MedicationRequest",
            "identifier": [{
                "system": "http://example.org/medication-orders",
                "value": identifier
            }],
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1049221",
                    "display": "Acetaminophen 325 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{test_patient['id']}"
            }
        }
        
        # First conditional create - should create new resource
        headers = {
            **http_client.headers,
            "If-None-Exist": f"identifier={identifier}"
        }
        
        response1 = await http_client.post(
            "/MedicationRequest",
            json=medication,
            headers=headers
        )
        
        assert response1.status_code == 201
        resource_id = response1.json()["id"]
        cleanup_resources("MedicationRequest", resource_id)
        
        # Second conditional create - should return existing resource
        response2 = await http_client.post(
            "/MedicationRequest",
            json=medication,
            headers=headers
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        # Should return 200 OK with existing resource
        assert response2.status_code == 200
        assert response2.json()["id"] == resource_id
        
        # Report result
        test_report(
            "test_conditional_create",
            "passed",
            duration,
            {"resource_id": resource_id}
        )
    
    async def test_batch_create(
        self,
        http_client: httpx.AsyncClient,
        test_patient: Dict[str, Any],
        cleanup_resources,
        test_report
    ):
        """Test creating multiple resources in a batch."""
        start_time = datetime.now()
        
        # Create a bundle with multiple resources
        bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "POST",
                        "url": "Condition"
                    },
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
                                "code": "38341003",
                                "display": "Hypertension"
                            }]
                        },
                        "subject": {
                            "reference": f"Patient/{test_patient['id']}"
                        }
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    },
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{
                                "system": "http://loinc.org",
                                "code": "85354-9",
                                "display": "Blood pressure"
                            }]
                        },
                        "subject": {
                            "reference": f"Patient/{test_patient['id']}"
                        },
                        "component": [
                            {
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "8480-6"
                                    }]
                                },
                                "valueQuantity": {
                                    "value": 140,
                                    "unit": "mmHg"
                                }
                            },
                            {
                                "code": {
                                    "coding": [{
                                        "system": "http://loinc.org",
                                        "code": "8462-4"
                                    }]
                                },
                                "valueQuantity": {
                                    "value": 90,
                                    "unit": "mmHg"
                                }
                            }
                        ]
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
        assert len(result_bundle["entry"]) == 2
        
        # Track created resources for cleanup
        for entry in result_bundle["entry"]:
            if "resource" in entry and "id" in entry["resource"]:
                cleanup_resources(
                    entry["resource"]["resourceType"],
                    entry["resource"]["id"]
                )
        
        # Report result
        test_report(
            "test_batch_create",
            "passed",
            duration,
            {"resources_created": len(result_bundle["entry"])}
        )
    
    def _get_test_resource(self, resource_type: str, patient_id: str) -> Dict[str, Any]:
        """Get a minimal valid resource for testing based on type."""
        
        # Map of resource types to minimal valid resources
        resource_templates = {
            "Patient": {
                "resourceType": "Patient",
                "name": [{
                    "family": "TestPatient",
                    "given": ["CRUD", "Test"]
                }],
                "gender": "unknown",
                "birthDate": "2000-01-01"
            },
            "Practitioner": {
                "resourceType": "Practitioner",
                "name": [{
                    "family": "TestDoctor",
                    "given": ["CRUD"]
                }]
            },
            "Organization": {
                "resourceType": "Organization",
                "name": "Test Organization",
                "active": True
            },
            "Location": {
                "resourceType": "Location",
                "name": "Test Location",
                "status": "active"
            },
            "Encounter": {
                "resourceType": "Encounter",
                "status": "planned",
                "class": {
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "AMB"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "Condition": {
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
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "Observation": {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "text": "Test observation"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "Procedure": {
                "resourceType": "Procedure",
                "status": "completed",
                "code": {
                    "text": "Test procedure"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "MedicationRequest": {
                "resourceType": "MedicationRequest",
                "status": "active",
                "intent": "order",
                "medicationCodeableConcept": {
                    "text": "Test medication"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "AllergyIntolerance": {
                "resourceType": "AllergyIntolerance",
                "clinicalStatus": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                        "code": "active"
                    }]
                },
                "patient": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "Immunization": {
                "resourceType": "Immunization",
                "status": "completed",
                "vaccineCode": {
                    "text": "Test vaccine"
                },
                "patient": {
                    "reference": f"Patient/{patient_id}"
                },
                "occurrenceDateTime": "2024-01-01"
            },
            "DiagnosticReport": {
                "resourceType": "DiagnosticReport",
                "status": "final",
                "code": {
                    "text": "Test report"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "CarePlan": {
                "resourceType": "CarePlan",
                "status": "active",
                "intent": "plan",
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "Goal": {
                "resourceType": "Goal",
                "lifecycleStatus": "active",
                "description": {
                    "text": "Test goal"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "ServiceRequest": {
                "resourceType": "ServiceRequest",
                "status": "active",
                "intent": "order",
                "code": {
                    "text": "Test service"
                },
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "DocumentReference": {
                "resourceType": "DocumentReference",
                "status": "current",
                "content": [{
                    "attachment": {
                        "contentType": "text/plain",
                        "data": "VGVzdCBkb2N1bWVudA=="  # Base64 encoded "Test document"
                    }
                }],
                "subject": {
                    "reference": f"Patient/{patient_id}"
                }
            },
            "Device": {
                "resourceType": "Device",
                "status": "active",
                "deviceName": [{
                    "name": "Test Device",
                    "type": "user-friendly-name"
                }]
            },
            "Task": {
                "resourceType": "Task",
                "status": "requested",
                "intent": "order"
            },
            "Medication": {
                "resourceType": "Medication",
                "code": {
                    "text": "Test Medication"
                }
            },
            "Basic": {
                "resourceType": "Basic",
                "code": {
                    "text": "Test Basic Resource"
                }
            }
        }
        
        return resource_templates.get(resource_type)