"""
Test Advanced FHIR Features:
- _revinclude parameter
- Additional search modifiers (:missing, :above, :below, :text)
- Batch and transaction operations
"""

import pytest
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database.database import Base, get_db
from models.synthea_models import Patient, Encounter, Observation, Condition, Medication
import logging


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_fhir_advanced.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


class TestFHIRRevInclude:
    """Test _revinclude parameter functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Observation).delete()
        db.query(Encounter).delete()
        db.query(Patient).delete()
        db.commit()
        
        # Create test patient
        self.patient = Patient(
            id="test-patient-rev",
            first_name="John",
            last_name="RevInclude",
            date_of_birth=datetime(1980, 1, 1).date(),
            gender="M"
        )
        
        # Create observations for this patient
        self.obs1 = Observation(
            id="test-obs-rev-1",
            patient_id=self.patient.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="1234-5",
            display="Test Lab 1",
            value="100",
            value_quantity=100.0,
            status="final"
        )
        
        self.obs2 = Observation(
            id="test-obs-rev-2",
            patient_id=self.patient.id,
            observation_date=datetime.now(),
            observation_type="vital-signs",
            loinc_code="8310-5",
            display="Body Temperature",
            value="98.6",
            value_quantity=98.6,
            status="final"
        )
        
        # Create encounter for this patient
        self.encounter = Encounter(
            id="test-enc-rev",
            patient_id=self.patient.id,
            encounter_date=datetime.now(),
            encounter_type="ambulatory",
            status="finished"
        )
        
        db.add(self.patient)
        db.add(self.obs1)
        db.add(self.obs2)
        db.add(self.encounter)
        db.commit()
        
        # Store IDs before closing session
        self.patient_id = self.patient.id
        self.obs1_id = self.obs1.id
        self.obs2_id = self.obs2.id
        self.encounter_id = self.encounter.id
        
        db.close()
    
    def test_revinclude_observations_with_patient(self):
        """Test finding patient with all their observations"""
        response = client.get(f"/fhir/R4/Patient?_id={self.patient_id}&_revinclude=Observation:patient")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert len(data["entry"]) == 3  # 1 patient + 2 observations
        
        # Check resource types
        resource_types = [entry["resource"]["resourceType"] for entry in data["entry"]]
        assert "Patient" in resource_types
        assert resource_types.count("Observation") == 2
    
    def test_revinclude_multiple_resource_types(self):
        """Test multiple _revinclude parameters"""
        response = client.get(
            f"/fhir/R4/Patient?_id={self.patient_id}"
            "&_revinclude=Observation:patient"
            "&_revinclude=Encounter:patient"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 4  # 1 patient + 2 observations + 1 encounter
        
        # Check all resource types are included
        resource_types = [entry["resource"]["resourceType"] for entry in data["entry"]]
        assert resource_types.count("Patient") == 1
        assert resource_types.count("Observation") == 2
        assert resource_types.count("Encounter") == 1


class TestFHIRSearchModifiers:
    """Test additional search modifiers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Patient).delete()
        db.query(Observation).delete()
        db.commit()
        
        # Create patients with various attributes
        self.patient_with_email = Patient(
            id="patient-email",
            first_name="John",
            last_name="Smith",
            date_of_birth=datetime(1980, 1, 1).date(),
            gender="M",
            email="john.smith@example.com"
        )
        
        self.patient_no_email = Patient(
            id="patient-no-email",
            first_name="Jane",
            last_name="Doe",
            date_of_birth=datetime(1990, 6, 15).date(),
            gender="F",
            email=None
        )
        
        # Create observations with various values
        self.obs_high = Observation(
            id="obs-high",
            patient_id=self.patient_with_email.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="2345-7",
            display="Glucose",
            value="180",
            value_quantity=180.0,
            status="final"
        )
        
        self.obs_normal = Observation(
            id="obs-normal",
            patient_id=self.patient_no_email.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="2345-7",
            display="Glucose",
            value="95",
            value_quantity=95.0,
            status="final"
        )
        
        self.obs_no_value = Observation(
            id="obs-no-value",
            patient_id=self.patient_with_email.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="5678-9",
            display="Pending Test",
            value=None,
            value_quantity=None,
            status="registered"
        )
        
        db.add_all([
            self.patient_with_email, self.patient_no_email,
            self.obs_high, self.obs_normal, self.obs_no_value
        ])
        db.commit()
        
        # Store IDs before closing session
        self.patient_with_email_id = self.patient_with_email.id
        self.patient_no_email_id = self.patient_no_email.id
        self.obs_high_id = self.obs_high.id
        self.obs_normal_id = self.obs_normal.id
        self.obs_no_value_id = self.obs_no_value.id
        
        db.close()
    
    def test_missing_modifier_true(self):
        """Test :missing=true returns resources with missing values"""
        # Find observations with missing values
        response = client.get("/fhir/R4/Observation?value-quantity:missing=true")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == self.obs_no_value_id
    
    def test_missing_modifier_false(self):
        """Test :missing=false returns resources with present values"""
        response = client.get("/fhir/R4/Observation?value-quantity:missing=false")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2  # obs-high and obs-normal
        
        ids = [entry["resource"]["id"] for entry in data["entry"]]
        assert self.obs_high_id in ids
        assert self.obs_normal_id in ids
    
    def test_above_modifier(self):
        """Test :above modifier for numeric values"""
        response = client.get("/fhir/R4/Observation?value-quantity:above=100")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == self.obs_high_id
        assert data["entry"][0]["resource"]["valueQuantity"]["value"] == 180.0
    
    def test_below_modifier(self):
        """Test :below modifier for numeric values"""
        response = client.get("/fhir/R4/Observation?value-quantity:below=100")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == self.obs_normal_id
        assert data["entry"][0]["resource"]["valueQuantity"]["value"] == 95.0
    
    def test_text_modifier(self):
        """Test :text modifier for text search"""
        response = client.get("/fhir/R4/Patient?family:text=smith")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["name"][0]["family"] == "Smith"


class TestFHIRBatchTransaction:
    """Test FHIR batch and transaction operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Patient).delete()
        db.query(Observation).delete()
        db.commit()
        db.close()
    
    def test_batch_mixed_operations(self):
        """Test batch bundle with mixed operations"""
        batch_bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "fullUrl": "urn:uuid:patient-1",
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"given": ["Test"], "family": "BatchPatient"}],
                        "gender": "male",
                        "birthDate": "1980-01-01"
                    },
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    }
                },
                {
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{"system": "http://loinc.org", "code": "1234-5"}]
                        },
                        "subject": {"reference": "Patient/test-patient-batch"},
                        "valueQuantity": {"value": 100, "unit": "mg/dL"}
                    },
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    }
                }
            ]
        }
        
        response = client.post("/fhir/R4/", json=batch_bundle)
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["type"] == "batch-response"
        assert len(data["entry"]) == 2
        
        # Check that both operations succeeded
        assert "201 Created" in data["entry"][0]["response"]["status"]
        
        # Debug the second entry if it fails
        if "201 Created" not in data["entry"][1]["response"]["status"]:
            logging.info(f"Second entry failed: {data['entry'][1]}")
        assert "201 Created" in data["entry"][1]["response"]["status"]
    
    def test_transaction_success(self):
        """Test successful transaction bundle"""
        transaction_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "fullUrl": "urn:uuid:patient-trans",
                    "resource": {
                        "resourceType": "Patient",
                        "id": "trans-patient-1",
                        "name": [{"given": ["Transaction"], "family": "Test"}],
                        "gender": "female",
                        "birthDate": "1990-01-01"
                    },
                    "request": {
                        "method": "PUT",
                        "url": "Patient/trans-patient-1"
                    }
                }
            ]
        }
        
        response = client.post("/fhir/R4/", json=transaction_bundle)
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["type"] == "transaction-response"
        
        # Verify the patient was created
        patient_response = client.get("/fhir/R4/Patient/trans-patient-1")
        assert patient_response.status_code == 200
        patient_data = patient_response.json()
        assert patient_data["name"][0]["family"] == "Test"
    
    def test_transaction_rollback_on_error(self):
        """Test that transaction rolls back on error"""
        transaction_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": "rollback-patient",
                        "name": [{"given": ["Rollback"], "family": "Test"}],
                        "gender": "male",
                        "birthDate": "1985-01-01"
                    },
                    "request": {
                        "method": "PUT",
                        "url": "Patient/rollback-patient"
                    }
                },
                {
                    "resource": {
                        "resourceType": "InvalidResource",  # This will cause an error
                        "id": "invalid-1"
                    },
                    "request": {
                        "method": "POST",
                        "url": "InvalidResource"
                    }
                }
            ]
        }
        
        response = client.post("/fhir/R4/", json=transaction_bundle)
        assert response.status_code == 400  # Transaction should fail
        
        # Verify the patient was NOT created due to rollback
        patient_response = client.get("/fhir/R4/Patient/rollback-patient")
        assert patient_response.status_code == 404
    
    def test_batch_read_operation(self):
        """Test batch bundle with read operations"""
        # First create a patient
        patient = {
            "resourceType": "Patient",
            "id": "batch-read-patient",
            "name": [{"given": ["Read"], "family": "Test"}],
            "gender": "male",
            "birthDate": "1975-01-01"
        }
        
        create_response = client.put("/fhir/R4/Patient/batch-read-patient", json=patient)
        assert create_response.status_code in [200, 201]
        
        # Now test batch read
        batch_bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "GET",
                        "url": "Patient/batch-read-patient"
                    }
                }
            ]
        }
        
        response = client.post("/fhir/R4/", json=batch_bundle)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["response"]["status"] == "200 OK"
        assert data["entry"][0]["resource"]["name"][0]["family"] == "Test"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])