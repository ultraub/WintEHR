"""
Integration Test for Medication Workflow
Tests end-to-end medication workflow from prescription to administration.
"""

import pytest
import json
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.main import app
from database import get_db_session, get_db


class TestMedicationWorkflowIntegration:
    """Test complete medication workflow integration."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    def test_complete_medication_workflow(self, client: TestClient):
        """Test complete workflow: Request → Dispense → Administration."""
        
        # Step 1: Create a patient
        patient_data = {
            "resourceType": "Patient",
            "name": [{
                "family": "TestPatient",
                "given": ["Medication", "Workflow"]
            }],
            "gender": "male",
            "birthDate": "1990-01-01"
        }
        
        patient_response = client.post("/R4/Patient", json=patient_data)
        assert patient_response.status_code == 201
        patient = patient_response.json()
        patient_id = patient["id"]
        
        # Step 2: Create a medication request (prescription)
        medication_request_data = {
            "resourceType": "MedicationRequest",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "197904",
                    "display": "Lisinopril 10 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "authoredOn": "2024-01-15T10:30:00Z",
            "dosageInstruction": [{
                "text": "Take 1 tablet by mouth once daily",
                "timing": {
                    "repeat": {
                        "frequency": 1,
                        "period": 1,
                        "periodUnit": "d"
                    }
                }
            }]
        }
        
        request_response = client.post("/R4/MedicationRequest", json=medication_request_data)
        assert request_response.status_code == 201
        medication_request = request_response.json()
        prescription_id = medication_request["id"]
        
        # Step 3: Create a medication dispense (pharmacy fulfillment)
        medication_dispense_data = {
            "resourceType": "MedicationDispense",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "197904",
                    "display": "Lisinopril 10 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "authorizingPrescription": [{
                "reference": f"MedicationRequest/{prescription_id}"
            }],
            "quantity": {
                "value": 30,
                "unit": "tablet",
                "system": "http://unitsofmeasure.org",
                "code": "{tablet}"
            },
            "daysSupply": {
                "value": 30,
                "unit": "days",
                "system": "http://unitsofmeasure.org",
                "code": "d"
            },
            "whenPrepared": "2024-01-16T14:30:00Z",
            "whenHandedOver": "2024-01-16T15:00:00Z"
        }
        
        dispense_response = client.post("/R4/MedicationDispense", json=medication_dispense_data)
        assert dispense_response.status_code == 201
        medication_dispense = dispense_response.json()
        dispense_id = medication_dispense["id"]
        
        # Step 4: Create a medication administration (clinical administration)
        medication_administration_data = {
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "197904",
                    "display": "Lisinopril 10 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": "2024-01-17T08:00:00Z",
            "request": {
                "reference": f"MedicationRequest/{prescription_id}"
            },
            "performer": [{
                "actor": {
                    "reference": "Practitioner/nurse-123",
                    "display": "Nurse Johnson"
                }
            }],
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
        
        administration_response = client.post("/R4/MedicationAdministration", json=medication_administration_data)
        assert administration_response.status_code == 201
        medication_administration = administration_response.json()
        administration_id = medication_administration["id"]
        
        # Step 5: Verify workflow linking by searching
        
        # Search for dispenses linked to the prescription
        dispense_search = client.get(f"/R4/MedicationDispense?prescription=MedicationRequest/{prescription_id}")
        assert dispense_search.status_code == 200
        dispense_bundle = dispense_search.json()
        assert dispense_bundle["total"] >= 1
        
        # Search for administrations linked to the prescription
        admin_search = client.get(f"/R4/MedicationAdministration?request=MedicationRequest/{prescription_id}")
        assert admin_search.status_code == 200
        admin_bundle = admin_search.json()
        assert admin_bundle["total"] >= 1
        
        # Search for patient's medication history
        patient_dispenses = client.get(f"/R4/MedicationDispense?patient=Patient/{patient_id}")
        assert patient_dispenses.status_code == 200
        patient_dispense_bundle = patient_dispenses.json()
        assert patient_dispense_bundle["total"] >= 1
        
        patient_administrations = client.get(f"/R4/MedicationAdministration?patient=Patient/{patient_id}")
        assert patient_administrations.status_code == 200
        patient_admin_bundle = patient_administrations.json()
        assert patient_admin_bundle["total"] >= 1
        
        # Step 6: Verify medication parameter search works
        medication_search = client.get(f"/R4/MedicationDispense?medication=197904")
        assert medication_search.status_code == 200
        med_bundle = medication_search.json()
        assert med_bundle["total"] >= 1
        
        # Step 7: Verify status search works
        status_search = client.get(f"/R4/MedicationDispense?status=completed")
        assert status_search.status_code == 200
        status_bundle = status_search.json()
        assert status_bundle["total"] >= 1
        
        print("✅ Complete medication workflow test passed!")
        print(f"   Patient: {patient_id}")
        print(f"   Prescription: {prescription_id}")
        print(f"   Dispense: {dispense_id}")
        print(f"   Administration: {administration_id}")
        
        return {
            "patient_id": patient_id,
            "prescription_id": prescription_id,
            "dispense_id": dispense_id,
            "administration_id": administration_id
        }
    
    def test_medication_request_search_parameters(self, client: TestClient):
        """Test MedicationRequest search with new FHIR R4 compliant medication parameter."""
        
        # Test medication parameter search (FHIR R4 compliant)
        response = client.get("/R4/MedicationRequest?medication=197904")
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        
        # Test backward compatibility with code parameter
        response = client.get("/R4/MedicationRequest?code=197904")
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        
        print("✅ MedicationRequest FHIR R4 compliance test passed!")
    
    def test_date_range_searches(self, client: TestClient):
        """Test date range searches for medication resources."""
        
        # Test MedicationDispense date range search
        response = client.get("/R4/MedicationDispense?whenhandedover=ge2024-01-01&whenhandedover=le2024-12-31")
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        
        # Test MedicationAdministration date range search
        response = client.get("/R4/MedicationAdministration?effective-time=ge2024-01-01&effective-time=le2024-12-31")
        assert response.status_code == 200
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        
        print("✅ Date range search tests passed!")
    
    def test_error_handling(self, client: TestClient):
        """Test error handling for invalid medication resources."""
        
        # Test invalid MedicationDispense status
        invalid_dispense = {
            "resourceType": "MedicationDispense",
            "status": "invalid-status",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "197904",
                    "display": "Lisinopril 10 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": "Patient/test-patient"
            }
        }
        
        response = client.post("/R4/MedicationDispense", json=invalid_dispense)
        assert response.status_code == 400
        
        # Test invalid MedicationAdministration (missing required fields)
        invalid_administration = {
            "resourceType": "MedicationAdministration"
            # Missing required fields
        }
        
        response = client.post("/R4/MedicationAdministration", json=invalid_administration)
        assert response.status_code == 400
        
        print("✅ Error handling tests passed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])