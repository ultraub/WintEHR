"""
Comprehensive Test Harness for MedicationAdministration Resource
Tests FHIR R4 compliance and workflow integration functionality.
"""

import pytest
import json
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.main import app
from database import get_db_session, get_db
from fhir.models.resource import FHIRResource
from models.synthea_models import Patient
from models.clinical.orders import MedicationOrder as MedicationRequest


class TestMedicationAdministrationResource:
    """Test MedicationAdministration resource CRUD operations and FHIR R4 compliance."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    @pytest.fixture
    def sample_patient(self, db_session: Session):
        """Create a sample patient for testing."""
        patient = Patient(
            id=str(uuid.uuid4()),
            birthdate="1985-03-15",
            deathdate=None,
            ssn="987-65-4321",
            first="Jane",
            last="Smith",
            maiden=None,
            marital="S",
            race="black",
            ethnicity="nonhispanic",
            gender="F",
            birthplace="Chicago, IL",
            address="456 Oak Ave",
            city="Chicago",
            state="IL",
            county="Cook",
            zip_code="60601",
            lat=41.8781,
            lon=-87.6298,
            healthcare_expenses=1500.00,
            healthcare_coverage=1200.00,
            income=60000
        )
        db_session.add(patient)
        db_session.commit()
        return patient
    
    @pytest.fixture
    def sample_medication_request(self, db_session: Session, sample_patient):
        """Create a sample medication request for testing."""
        medication_request = FHIRResource(
            resource_type="MedicationRequest",
            fhir_id=str(uuid.uuid4()),
            data={
                "resourceType": "MedicationRequest",
                "id": str(uuid.uuid4()),
                "status": "active",
                "intent": "order",
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "860975",
                        "display": "Metformin hydrochloride 500 MG Oral Tablet"
                    }]
                },
                "subject": {
                    "reference": f"Patient/{sample_patient.id}"
                },
                "authoredOn": "2024-01-15T08:00:00Z",
                "dosageInstruction": [{
                    "text": "Take 1 tablet by mouth twice daily with meals",
                    "timing": {
                        "repeat": {
                            "frequency": 2,
                            "period": 1,
                            "periodUnit": "d"
                        }
                    },
                    "route": {
                        "coding": [{
                            "system": "http://snomed.info/sct",
                            "code": "26643006",
                            "display": "Oral route"
                        }]
                    },
                    "doseAndRate": [{
                        "doseQuantity": {
                            "value": 1,
                            "unit": "tablet",
                            "system": "http://unitsofmeasure.org",
                            "code": "{tablet}"
                        }
                    }]
                }]
            }
        )
        db_session.add(medication_request)
        db_session.commit()
        return medication_request
    
    def test_create_medication_administration(self, client: TestClient, sample_patient, sample_medication_request):
        """Test creating a valid MedicationAdministration resource."""
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{sample_patient.id}"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z",
            "performer": [{
                "actor": {
                    "reference": "Practitioner/nurse-123",
                    "display": "Nurse Johnson"
                }
            }],
            "request": {
                "reference": f"MedicationRequest/{sample_medication_request.fhir_id}"
            },
            "dosage": {
                "text": "1 tablet by mouth",
                "route": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "26643006",
                        "display": "Oral route"
                    }]
                },
                "dose": {
                    "value": 1,
                    "unit": "tablet",
                    "system": "http://unitsofmeasure.org",
                    "code": "{tablet}"
                }
            }
        }
        
        response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["resourceType"] == "MedicationAdministration"
        assert response_data["status"] == "completed"
        assert "id" in response_data
        
    def test_search_medication_administration_by_patient(self, client: TestClient, sample_patient):
        """Test searching MedicationAdministration by patient."""
        response = client.get(f"/R4/MedicationAdministration?patient={sample_patient.id}")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_administration_by_status(self, client: TestClient):
        """Test searching MedicationAdministration by status."""
        response = client.get("/R4/MedicationAdministration?status=completed")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_administration_by_medication(self, client: TestClient):
        """Test searching MedicationAdministration by medication code."""
        response = client.get("/R4/MedicationAdministration?medication=860975")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_administration_by_request(self, client: TestClient, sample_medication_request):
        """Test searching MedicationAdministration by request reference."""
        response = client.get(f"/R4/MedicationAdministration?request=MedicationRequest/{sample_medication_request.fhir_id}")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_administration_by_effective_time(self, client: TestClient):
        """Test searching MedicationAdministration by effective time."""
        response = client.get("/R4/MedicationAdministration?effective-time=2024-01-16")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_read_medication_administration(self, client: TestClient):
        """Test reading a MedicationAdministration by ID."""
        # First create an administration
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z"
        }
        
        create_response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        assert create_response.status_code == 201
        created_administration = create_response.json()
        
        # Then read it
        response = client.get(f"/R4/MedicationAdministration/{created_administration['id']}")
        
        assert response.status_code == 200
        administration_data = response.json()
        assert administration_data["resourceType"] == "MedicationAdministration"
        assert administration_data["id"] == created_administration["id"]
        
    def test_update_medication_administration(self, client: TestClient):
        """Test updating a MedicationAdministration."""
        # First create an administration
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "in-progress",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z"
        }
        
        create_response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        assert create_response.status_code == 201
        created_administration = create_response.json()
        
        # Update the status to completed and add notes
        created_administration["status"] = "completed"
        created_administration["note"] = [{
            "text": "Patient tolerated medication well"
        }]
        
        response = client.put(f"/R4/MedicationAdministration/{created_administration['id']}", json=created_administration)
        
        assert response.status_code == 200
        updated_administration = response.json()
        assert updated_administration["status"] == "completed"
        assert updated_administration["note"][0]["text"] == "Patient tolerated medication well"
        
    def test_delete_medication_administration(self, client: TestClient):
        """Test deleting a MedicationAdministration."""
        # First create an administration
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z"
        }
        
        create_response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        assert create_response.status_code == 201
        created_administration = create_response.json()
        
        # Delete it
        response = client.delete(f"/R4/MedicationAdministration/{created_administration['id']}")
        
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = client.get(f"/R4/MedicationAdministration/{created_administration['id']}")
        assert get_response.status_code == 404


class TestMedicationAdministrationValidation:
    """Test MedicationAdministration FHIR R4 validation."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_invalid_status(self, client: TestClient):
        """Test validation fails for invalid status."""
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "invalid-status",  # Invalid status
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z"
        }
        
        response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        
        assert response.status_code == 400
        error_data = response.json()
        assert "status" in str(error_data).lower()
        
    def test_missing_required_fields(self, client: TestClient):
        """Test validation fails when required fields are missing."""
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            # Missing status, medication, subject, and effectiveDateTime
        }
        
        response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        
        assert response.status_code == 400
        
    def test_invalid_effective_datetime(self, client: TestClient):
        """Test validation fails for invalid effective datetime."""
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "effectiveDateTime": "invalid-date"  # Invalid date format
        }
        
        response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        
        assert response.status_code == 400


class TestMedicationAdministrationWorkflow:
    """Test MedicationAdministration workflow integration."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_request_to_administration_workflow(self, client: TestClient):
        """Test complete request to administration workflow."""
        # Create a patient
        patient_data = {
            "resourceType": "Patient",
            "name": [{
                "family": "Smith",
                "given": ["Jane"]
            }],
            "gender": "female",
            "birthDate": "1985-03-15"
        }
        
        patient_response = client.post("/R4/Patient", json=patient_data)
        assert patient_response.status_code == 201
        patient = patient_response.json()
        
        # Create a medication request
        medication_request_data = {
            "resourceType": "MedicationRequest",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient['id']}"
            },
            "authoredOn": "2024-01-15T08:00:00Z"
        }
        
        request_response = client.post("/R4/MedicationRequest", json=medication_request_data)
        assert request_response.status_code == 201
        medication_request = request_response.json()
        
        # Create a medication administration linked to the request
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient['id']}"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z",
            "request": {
                "reference": f"MedicationRequest/{medication_request['id']}"
            },
            "performer": [{
                "actor": {
                    "reference": "Practitioner/nurse-123",
                    "display": "Nurse Johnson"
                }
            }]
        }
        
        administration_response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        assert administration_response.status_code == 201
        medication_administration = administration_response.json()
        
        # Verify the workflow linking
        assert medication_administration["request"]["reference"] == f"MedicationRequest/{medication_request['id']}"
        
        # Search for administrations by request
        search_response = client.get(f"/R4/MedicationAdministration?request=MedicationRequest/{medication_request['id']}")
        assert search_response.status_code == 200
        search_bundle = search_response.json()
        assert search_bundle["total"] >= 1
        
    def test_medication_administration_record_workflow(self, client: TestClient):
        """Test Medication Administration Record (MAR) workflow."""
        # Create multiple administrations for the same patient
        patient_id = "test-patient-mar"
        medication_code = "860975"
        
        # Morning administration
        morning_admin_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": medication_code,
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z",
            "performer": [{
                "actor": {
                    "reference": "Practitioner/nurse-123",
                    "display": "Nurse Johnson"
                }
            }]
        }
        
        morning_response = client.post("/R4/MedicationAdministration", json=morning_admin_data)
        assert morning_response.status_code == 201
        
        # Evening administration
        evening_admin_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": medication_code,
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": "2024-01-16T20:00:00Z",
            "performer": [{
                "actor": {
                    "reference": "Practitioner/nurse-456",
                    "display": "Nurse Smith"
                }
            }]
        }
        
        evening_response = client.post("/R4/MedicationAdministration", json=evening_admin_data)
        assert evening_response.status_code == 201
        
        # Search for all administrations for the patient on that date
        search_response = client.get(f"/R4/MedicationAdministration?patient=Patient/{patient_id}&effective-time=2024-01-16")
        assert search_response.status_code == 200
        search_bundle = search_response.json()
        assert search_bundle["total"] >= 2
        
    def test_missed_dose_documentation(self, client: TestClient):
        """Test documenting missed doses."""
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "not-done",
            "statusReason": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/reason-medication-not-given",
                    "code": "patientchoice",
                    "display": "Patient choice"
                }]
            }],
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "860975",
                    "display": "Metformin hydrochloride 500 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "effectiveDateTime": "2024-01-16T08:00:00Z",
            "note": [{
                "text": "Patient refused morning dose, will retry at lunch"
            }]
        }
        
        response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        assert response.status_code == 201
        missed_dose = response.json()
        assert missed_dose["status"] == "not-done"
        assert missed_dose["statusReason"][0]["coding"][0]["code"] == "patientchoice"


class TestMedicationAdministrationSearchParameters:
    """Test all FHIR R4 search parameters for MedicationAdministration."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_search_by_identifier(self, client: TestClient):
        """Test search by identifier parameter."""
        response = client.get("/R4/MedicationAdministration?identifier=MAR-12345")
        assert response.status_code == 200
        
    def test_search_by_subject(self, client: TestClient):
        """Test search by subject parameter."""
        response = client.get("/R4/MedicationAdministration?subject=Patient/test-patient-id")
        assert response.status_code == 200
        
    def test_search_by_context(self, client: TestClient):
        """Test search by context parameter."""
        response = client.get("/R4/MedicationAdministration?context=Encounter/test-encounter-id")
        assert response.status_code == 200
        
    def test_search_by_encounter(self, client: TestClient):
        """Test search by encounter parameter."""
        response = client.get("/R4/MedicationAdministration?encounter=Encounter/test-encounter-id")
        assert response.status_code == 200
        
    def test_search_by_performer(self, client: TestClient):
        """Test search by performer parameter."""
        response = client.get("/R4/MedicationAdministration?performer=Practitioner/test-practitioner-id")
        assert response.status_code == 200
        
    def test_search_by_device(self, client: TestClient):
        """Test search by device parameter."""
        response = client.get("/R4/MedicationAdministration?device=Device/test-device-id")
        assert response.status_code == 200
        
    def test_search_by_code(self, client: TestClient):
        """Test search by code parameter."""
        response = client.get("/R4/MedicationAdministration?code=SNOMED-CT-CODE")
        assert response.status_code == 200
        
    def test_search_by_reason_given(self, client: TestClient):
        """Test search by reason given parameter."""
        response = client.get("/R4/MedicationAdministration?reason-given=pain")
        assert response.status_code == 200
        
    def test_search_by_reason_not_given(self, client: TestClient):
        """Test search by reason not given parameter."""
        response = client.get("/R4/MedicationAdministration?reason-not-given=patientchoice")
        assert response.status_code == 200
        
    def test_search_with_date_range(self, client: TestClient):
        """Test search with date range operators."""
        response = client.get("/R4/MedicationAdministration?effective-time=ge2024-01-01&effective-time=le2024-12-31")
        assert response.status_code == 200
        
    def test_search_with_multiple_parameters(self, client: TestClient):
        """Test search with multiple parameters."""
        response = client.get("/R4/MedicationAdministration?patient=Patient/test-patient-id&status=completed&medication=860975")
        assert response.status_code == 200
        
    def test_search_by_partof(self, client: TestClient):
        """Test search by part of parameter."""
        response = client.get("/R4/MedicationAdministration?partof=Procedure/test-procedure-id")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])