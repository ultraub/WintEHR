"""
Comprehensive Test Harness for MedicationDispense Resource
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


class TestMedicationDispenseResource:
    """Test MedicationDispense resource CRUD operations and FHIR R4 compliance."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    @pytest.fixture
    def sample_patient(self, db_session: Session):
        """Create a sample patient for testing."""
        patient = Patient(
            id=str(uuid.uuid4()),
            birthdate="1980-01-01",
            deathdate=None,
            ssn="123-45-6789",
            first="John",
            last="Doe",
            maiden=None,
            marital="M",
            race="white",
            ethnicity="nonhispanic",
            gender="M",
            birthplace="Boston, MA",
            address="123 Main St",
            city="Boston",
            state="MA",
            county="Suffolk",
            zip_code="02101",
            lat=42.3584,
            lon=-71.0598,
            healthcare_expenses=1000.00,
            healthcare_coverage=800.00,
            income=50000
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
                        "code": "1998",
                        "display": "Amoxicillin 500 MG Oral Capsule"
                    }]
                },
                "subject": {
                    "reference": f"Patient/{sample_patient.id}"
                },
                "authoredOn": "2024-01-15T10:30:00Z",
                "dosageInstruction": [{
                    "text": "Take 1 capsule by mouth three times daily for 7 days",
                    "timing": {
                        "repeat": {
                            "frequency": 3,
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
                            "unit": "capsule",
                            "system": "http://unitsofmeasure.org",
                            "code": "{capsule}"
                        }
                    }]
                }]
            }
        )
        db_session.add(medication_request)
        db_session.commit()
        return medication_request
    
    def test_create_medication_dispense(self, client: TestClient, sample_patient, sample_medication_request):
        """Test creating a valid MedicationDispense resource."""
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": f"Patient/{sample_patient.id}"
            },
            "authorizingPrescription": [{
                "reference": f"MedicationRequest/{sample_medication_request.fhir_id}"
            }],
            "quantity": {
                "value": 21,
                "unit": "capsule",
                "system": "http://unitsofmeasure.org",
                "code": "{capsule}"
            },
            "daysSupply": {
                "value": 7,
                "unit": "days",
                "system": "http://unitsofmeasure.org",
                "code": "d"
            },
            "whenPrepared": "2024-01-16T14:30:00Z",
            "whenHandedOver": "2024-01-16T15:00:00Z",
            "dosageInstruction": [{
                "text": "Take 1 capsule by mouth three times daily for 7 days"
            }]
        }
        
        response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        
        assert response.status_code == 201
        response_data = response.json()
        assert response_data["resourceType"] == "MedicationDispense"
        assert response_data["status"] == "completed"
        assert "id" in response_data
        
    def test_search_medication_dispense_by_patient(self, client: TestClient, sample_patient):
        """Test searching MedicationDispense by patient."""
        response = client.get(f"/R4/MedicationDispense?patient={sample_patient.id}")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_dispense_by_status(self, client: TestClient):
        """Test searching MedicationDispense by status."""
        response = client.get("/R4/MedicationDispense?status=completed")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_dispense_by_medication(self, client: TestClient):
        """Test searching MedicationDispense by medication code."""
        response = client.get("/R4/MedicationDispense?medication=1998")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_dispense_by_prescription(self, client: TestClient, sample_medication_request):
        """Test searching MedicationDispense by prescription reference."""
        response = client.get(f"/R4/MedicationDispense?prescription=MedicationRequest/{sample_medication_request.fhir_id}")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_search_medication_dispense_by_whenhandedover(self, client: TestClient):
        """Test searching MedicationDispense by when handed over date."""
        response = client.get("/R4/MedicationDispense?whenhandedover=2024-01-16")
        
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "searchset"
        
    def test_read_medication_dispense(self, client: TestClient):
        """Test reading a MedicationDispense by ID."""
        # First create a dispense
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            }
        }
        
        create_response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        assert create_response.status_code == 201
        created_dispense = create_response.json()
        
        # Then read it
        response = client.get(f"/R4/MedicationDispense/{created_dispense['id']}")
        
        assert response.status_code == 200
        dispense_data = response.json()
        assert dispense_data["resourceType"] == "MedicationDispense"
        assert dispense_data["id"] == created_dispense["id"]
        
    def test_update_medication_dispense(self, client: TestClient):
        """Test updating a MedicationDispense."""
        # First create a dispense
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "in-progress",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            }
        }
        
        create_response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        assert create_response.status_code == 201
        created_dispense = create_response.json()
        
        # Update the status to completed
        created_dispense["status"] = "completed"
        created_dispense["whenHandedOver"] = "2024-01-16T15:00:00Z"
        
        response = client.put(f"/R4/MedicationDispense/{created_dispense['id']}", json=created_dispense)
        
        assert response.status_code == 200
        updated_dispense = response.json()
        assert updated_dispense["status"] == "completed"
        assert updated_dispense["whenHandedOver"] == "2024-01-16T15:00:00Z"
        
    def test_delete_medication_dispense(self, client: TestClient):
        """Test deleting a MedicationDispense."""
        # First create a dispense
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            }
        }
        
        create_response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        assert create_response.status_code == 201
        created_dispense = create_response.json()
        
        # Delete it
        response = client.delete(f"/R4/MedicationDispense/{created_dispense['id']}")
        
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = client.get(f"/R4/MedicationDispense/{created_dispense['id']}")
        assert get_response.status_code == 404


class TestMedicationDispenseValidation:
    """Test MedicationDispense FHIR R4 validation."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_invalid_status(self, client: TestClient):
        """Test validation fails for invalid status."""
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "invalid-status",  # Invalid status
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            }
        }
        
        response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        
        assert response.status_code == 400
        error_data = response.json()
        assert "status" in str(error_data).lower()
        
    def test_missing_required_fields(self, client: TestClient):
        """Test validation fails when required fields are missing."""
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            # Missing status, medication, and subject
        }
        
        response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        
        assert response.status_code == 400
        
    def test_invalid_medication_reference(self, client: TestClient):
        """Test validation fails for invalid medication reference."""
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationReference": {
                "reference": "InvalidResource/invalid-id"  # Invalid resource type
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            }
        }
        
        response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        
        assert response.status_code == 400


class TestMedicationDispenseWorkflow:
    """Test MedicationDispense workflow integration."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_prescription_to_dispense_workflow(self, client: TestClient):
        """Test complete prescription to dispense workflow."""
        # Create a patient
        patient_data = {
            "resourceType": "Patient",
            "name": [{
                "family": "Doe",
                "given": ["John"]
            }],
            "gender": "male",
            "birthDate": "1980-01-01"
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
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient['id']}"
            },
            "authoredOn": "2024-01-15T10:30:00Z"
        }
        
        request_response = client.post("/R4/MedicationRequest", json=medication_request_data)
        assert request_response.status_code == 201
        medication_request = request_response.json()
        
        # Create a medication dispense linked to the request
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient['id']}"
            },
            "authorizingPrescription": [{
                "reference": f"MedicationRequest/{medication_request['id']}"
            }],
            "quantity": {
                "value": 21,
                "unit": "capsule",
                "system": "http://unitsofmeasure.org",
                "code": "{capsule}"
            },
            "whenHandedOver": "2024-01-16T15:00:00Z"
        }
        
        dispense_response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        assert dispense_response.status_code == 201
        medication_dispense = dispense_response.json()
        
        # Verify the workflow linking
        assert medication_dispense["authorizingPrescription"][0]["reference"] == f"MedicationRequest/{medication_request['id']}"
        
        # Search for dispenses by prescription
        search_response = client.get(f"/R4/MedicationDispense?prescription=MedicationRequest/{medication_request['id']}")
        assert search_response.status_code == 200
        search_bundle = search_response.json()
        assert search_bundle["total"] >= 1
        
    def test_pharmacy_queue_workflow(self, client: TestClient):
        """Test pharmacy queue workflow with status transitions."""
        # Create dispense in preparation status
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "preparation",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1998",
                    "display": "Amoxicillin 500 MG Oral Capsule"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient-id"
            },
            "whenPrepared": "2024-01-16T14:00:00Z"
        }
        
        create_response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        assert create_response.status_code == 201
        created_dispense = create_response.json()
        assert created_dispense["status"] == "preparation"
        
        # Update to in-progress
        created_dispense["status"] = "in-progress"
        update_response = client.put(f"/R4/MedicationDispense/{created_dispense['id']}", json=created_dispense)
        assert update_response.status_code == 200
        updated_dispense = update_response.json()
        assert updated_dispense["status"] == "in-progress"
        
        # Update to completed with hand-over time
        updated_dispense["status"] = "completed"
        updated_dispense["whenHandedOver"] = "2024-01-16T15:00:00Z"
        final_response = client.put(f"/R4/MedicationDispense/{updated_dispense['id']}", json=updated_dispense)
        assert final_response.status_code == 200
        final_dispense = final_response.json()
        assert final_dispense["status"] == "completed"
        assert final_dispense["whenHandedOver"] == "2024-01-16T15:00:00Z"


class TestMedicationDispenseSearchParameters:
    """Test all FHIR R4 search parameters for MedicationDispense."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_search_by_identifier(self, client: TestClient):
        """Test search by identifier parameter."""
        response = client.get("/R4/MedicationDispense?identifier=12345")
        assert response.status_code == 200
        
    def test_search_by_subject(self, client: TestClient):
        """Test search by subject parameter."""
        response = client.get("/R4/MedicationDispense?subject=Patient/test-patient-id")
        assert response.status_code == 200
        
    def test_search_by_context(self, client: TestClient):
        """Test search by context parameter."""
        response = client.get("/R4/MedicationDispense?context=Encounter/test-encounter-id")
        assert response.status_code == 200
        
    def test_search_by_performer(self, client: TestClient):
        """Test search by performer parameter."""
        response = client.get("/R4/MedicationDispense?performer=Practitioner/test-practitioner-id")
        assert response.status_code == 200
        
    def test_search_by_receiver(self, client: TestClient):
        """Test search by receiver parameter."""
        response = client.get("/R4/MedicationDispense?receiver=Patient/test-patient-id")
        assert response.status_code == 200
        
    def test_search_by_destination(self, client: TestClient):
        """Test search by destination parameter."""
        response = client.get("/R4/MedicationDispense?destination=Location/test-location-id")
        assert response.status_code == 200
        
    def test_search_by_responsibleparty(self, client: TestClient):
        """Test search by responsible party parameter."""
        response = client.get("/R4/MedicationDispense?responsibleparty=Practitioner/test-practitioner-id")
        assert response.status_code == 200
        
    def test_search_by_type(self, client: TestClient):
        """Test search by type parameter."""
        response = client.get("/R4/MedicationDispense?type=RFP")
        assert response.status_code == 200
        
    def test_search_by_whenprepared(self, client: TestClient):
        """Test search by when prepared parameter."""
        response = client.get("/R4/MedicationDispense?whenprepared=2024-01-16")
        assert response.status_code == 200
        
    def test_search_with_date_range(self, client: TestClient):
        """Test search with date range operators."""
        response = client.get("/R4/MedicationDispense?whenhandedover=ge2024-01-01&whenhandedover=le2024-12-31")
        assert response.status_code == 200
        
    def test_search_with_multiple_parameters(self, client: TestClient):
        """Test search with multiple parameters."""
        response = client.get("/R4/MedicationDispense?patient=Patient/test-patient-id&status=completed&medication=1998")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])