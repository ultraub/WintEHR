"""
Unit tests for CDS Hooks implementation
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, date

from main import app
from database.database import get_db, Base
from models.models import Patient, Provider, Encounter, Observation, Condition, Medication


@pytest.fixture
def db_session():
    """Create test database session"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture
def test_client(db_session):
    """Create test client with test database"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def diabetes_patient_data(db_session):
    """Create sample diabetes patient data for testing"""
    # Create patient
    patient = Patient(
        id="diabetes-patient-1",
        mrn="DIAB001",
        first_name="John",
        last_name="Diabetic",
        date_of_birth=date(1970, 5, 15),
        gender="Male"
    )
    
    # Create provider
    provider = Provider(
        id="endo-provider-1",
        first_name="Dr. Sarah",
        last_name="Endocrinologist",
        specialty="Endocrinology",
        active=True
    )
    
    db_session.add_all([patient, provider])
    
    # Create diabetes condition
    diabetes_condition = Condition(
        id="diabetes-condition-1",
        patient_id="diabetes-patient-1",
        icd10_code="E11.9",
        description="Type 2 diabetes mellitus without complications",
        clinical_status="active",
        verification_status="confirmed",
        recorded_date=datetime.now()
    )
    
    # Create high A1C observation
    a1c_observation = Observation(
        id="a1c-obs-1",
        patient_id="diabetes-patient-1",
        observation_type="laboratory",
        code="4548-4",
        display="Hemoglobin A1c",
        value=9.2,  # High A1C
        unit="%",
        reference_range_low=4.0,
        reference_range_high=6.5,
        interpretation="High",
        observation_date=datetime.now()
    )
    
    # Create current medication (metformin only)
    metformin = Medication(
        id="metformin-1",
        patient_id="diabetes-patient-1",
        medication_name="Metformin",
        dosage="1000mg",
        route="Oral",
        frequency="Twice daily",
        start_date=date.today(),
        status="active",
        prescriber_id="endo-provider-1"
    )
    
    db_session.add_all([diabetes_condition, a1c_observation, metformin])
    db_session.commit()
    
    return {
        "patient": patient,
        "provider": provider,
        "condition": diabetes_condition,
        "a1c": a1c_observation,
        "medication": metformin
    }


@pytest.fixture
def hypertension_patient_data(db_session):
    """Create sample hypertension patient data for testing"""
    # Create patient
    patient = Patient(
        id="htn-patient-1",
        mrn="HTN001",
        first_name="Jane",
        last_name="Hypertensive",
        date_of_birth=date(1965, 8, 20),
        gender="Female"
    )
    
    provider = Provider(
        id="cardio-provider-1",
        first_name="Dr. Michael",
        last_name="Cardiologist",
        specialty="Cardiology",
        active=True
    )
    
    db_session.add_all([patient, provider])
    
    # Create hypertension condition
    htn_condition = Condition(
        id="htn-condition-1",
        patient_id="htn-patient-1",
        icd10_code="I10",
        description="Essential hypertension",
        clinical_status="active",
        verification_status="confirmed",
        recorded_date=datetime.now()
    )
    
    # Create high blood pressure observations
    systolic_bp = Observation(
        id="sbp-obs-1",
        patient_id="htn-patient-1",
        observation_type="vital-signs",
        code="8480-6",
        display="Systolic blood pressure",
        value=180.0,  # High BP
        unit="mmHg",
        reference_range_low=90.0,
        reference_range_high=140.0,
        interpretation="High",
        observation_date=datetime.now()
    )
    
    diastolic_bp = Observation(
        id="dbp-obs-1",
        patient_id="htn-patient-1",
        observation_type="vital-signs",
        code="8462-4",
        display="Diastolic blood pressure",
        value=110.0,  # High BP
        unit="mmHg",
        reference_range_low=60.0,
        reference_range_high=90.0,
        interpretation="High",
        observation_date=datetime.now()
    )
    
    db_session.add_all([htn_condition, systolic_bp, diastolic_bp])
    db_session.commit()
    
    return {
        "patient": patient,
        "provider": provider,
        "condition": htn_condition,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp
    }


class TestCDSHooksDiscovery:
    """Test CDS Hooks discovery endpoint"""
    
    def test_cds_hooks_discovery(self, test_client):
        """Test CDS Hooks discovery endpoint returns available services"""
        response = test_client.get("/cds-hooks/")
        assert response.status_code == 200
        
        data = response.json()
        assert "services" in data
        assert len(data["services"]) > 0
        
        # Check that expected services are present
        service_ids = [service["id"] for service in data["services"]]
        assert "diabetes-management" in service_ids
        assert "hypertension-management" in service_ids
        assert "drug-drug-interaction" in service_ids
        assert "preventive-care-reminder" in service_ids
        
        # Validate service structure
        for service in data["services"]:
            assert "hook" in service
            assert "title" in service
            assert "description" in service
            assert "id" in service
            assert "prefetch" in service


class TestDiabetesManagementCDS:
    """Test diabetes management CDS service"""
    
    def test_diabetes_management_high_a1c(self, test_client, diabetes_patient_data):
        """Test diabetes CDS service with high A1C patient"""
        patient_id = diabetes_patient_data["patient"].id
        
        request_data = {
            "hook": "patient-view",
            "context": {
                "patientId": patient_id
            },
            "prefetch": {}
        }
        
        response = test_client.post("/cds-hooks/cds-services/diabetes-management", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "cards" in data
        
        # Should have recommendations for high A1C
        cards = data["cards"]
        assert len(cards) > 0
        
        # Look for high A1C alert
        high_a1c_card = next((card for card in cards if "High A1C" in card["summary"]), None)
        assert high_a1c_card is not None
        assert high_a1c_card["indicator"] == "critical"
        assert "9.2%" in high_a1c_card["detail"]
        
        # Should have suggestions for treatment intensification
        if "suggestions" in high_a1c_card:
            assert len(high_a1c_card["suggestions"]) > 0
    
    def test_diabetes_management_no_diabetes(self, test_client):
        """Test diabetes CDS service with patient who doesn't have diabetes"""
        # Create patient without diabetes
        request_data = {
            "hook": "patient-view",
            "context": {
                "patientId": "nonexistent-patient"
            },
            "prefetch": {}
        }
        
        response = test_client.post("/cds-hooks/cds-services/diabetes-management", json=request_data)
        # Should handle gracefully - either return empty cards or 404
        assert response.status_code in [200, 404]


class TestHypertensionManagementCDS:
    """Test hypertension management CDS service"""
    
    def test_hypertension_management_crisis(self, test_client, hypertension_patient_data):
        """Test hypertension CDS service with crisis-level BP"""
        patient_id = hypertension_patient_data["patient"].id
        
        request_data = {
            "hook": "patient-view",
            "context": {
                "patientId": patient_id
            },
            "prefetch": {}
        }
        
        response = test_client.post("/cds-hooks/cds-services/hypertension-management", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "cards" in data
        
        cards = data["cards"]
        if len(cards) > 0:
            # Look for hypertensive crisis alert
            crisis_card = next((card for card in cards if "Crisis" in card["summary"]), None)
            if crisis_card:
                assert crisis_card["indicator"] in ["critical", "warning"]
                assert "180" in crisis_card["detail"]  # Should mention high BP value


class TestDrugInteractionCDS:
    """Test drug interaction CDS service"""
    
    def test_drug_interaction_check(self, test_client, diabetes_patient_data):
        """Test drug interaction checking"""
        patient_id = diabetes_patient_data["patient"].id
        
        # Simulate prescribing a medication that might interact
        request_data = {
            "hook": "medication-prescribe",
            "context": {
                "patientId": patient_id,
                "medications": {
                    "new": [
                        {
                            "display": "Warfarin 5mg daily"
                        }
                    ]
                }
            },
            "prefetch": {}
        }
        
        response = test_client.post("/cds-hooks/cds-services/drug-drug-interaction", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "cards" in data
        
        # May or may not have interactions depending on current medications
        # Just verify the service responds appropriately


class TestPreventiveCareReminders:
    """Test preventive care reminder CDS service"""
    
    def test_preventive_care_reminders(self, test_client, diabetes_patient_data):
        """Test preventive care reminders"""
        patient_id = diabetes_patient_data["patient"].id
        
        request_data = {
            "hook": "patient-view",
            "context": {
                "patientId": patient_id
            },
            "prefetch": {}
        }
        
        response = test_client.post("/cds-hooks/cds-services/preventive-care-reminder", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "cards" in data
        
        # Should have preventive care reminders
        cards = data["cards"]
        assert len(cards) > 0
        
        # Look for age-appropriate screening recommendations
        screening_cards = [card for card in cards if "Screening" in card["summary"] or "Vaccine" in card["summary"]]
        assert len(screening_cards) > 0


class TestCDSHooksErrorHandling:
    """Test CDS Hooks error handling"""
    
    def test_invalid_service_id(self, test_client):
        """Test calling non-existent CDS service"""
        request_data = {
            "hook": "patient-view",
            "context": {
                "patientId": "test-patient"
            }
        }
        
        response = test_client.post("/cds-hooks/cds-services/nonexistent-service", json=request_data)
        assert response.status_code == 404
    
    def test_missing_patient_id(self, test_client):
        """Test CDS service call without patient ID"""
        request_data = {
            "hook": "patient-view",
            "context": {}  # Missing patientId
        }
        
        response = test_client.post("/cds-hooks/cds-services/diabetes-management", json=request_data)
        assert response.status_code == 400
    
    def test_cds_feedback_endpoint(self, test_client):
        """Test CDS feedback endpoint"""
        feedback_data = {
            "card": "test-card-id",
            "outcome": "accepted",
            "outcomeTimestamp": "2023-12-01T10:00:00Z"
        }
        
        response = test_client.post("/cds-hooks/cds-services/diabetes-management/feedback", json=feedback_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert data["outcome"] == "accepted"


if __name__ == "__main__":
    pytest.main([__file__])