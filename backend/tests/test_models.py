"""
Unit tests for database models
"""

import pytest
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.database import Base
from models.models import Patient, Provider, Location, Encounter, Observation, Condition, Medication


@pytest.fixture
def db_session():
    """Create test database session"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


class TestPatientModel:
    """Test Patient model functionality"""
    
    def test_create_patient(self, db_session):
        """Test creating a new patient"""
        patient = Patient(
            id="test-patient-1",
            mrn="MRN001",
            first_name="John",
            last_name="Doe",
            date_of_birth=date(1990, 1, 1),
            gender="Male",
            race="White",
            ethnicity="Not Hispanic or Latino"
        )
        
        db_session.add(patient)
        db_session.commit()
        
        # Verify patient was created
        saved_patient = db_session.query(Patient).filter(Patient.id == "test-patient-1").first()
        assert saved_patient is not None
        assert saved_patient.first_name == "John"
        assert saved_patient.last_name == "Doe"
        assert saved_patient.mrn == "MRN001"
    
    def test_patient_relationships(self, db_session):
        """Test patient relationships with other entities"""
        # Create patient
        patient = Patient(
            id="test-patient-2",
            mrn="MRN002",
            first_name="Jane",
            last_name="Smith",
            date_of_birth=date(1985, 5, 15),
            gender="Female"
        )
        db_session.add(patient)
        
        # Create related condition
        condition = Condition(
            id="test-condition-1",
            patient_id="test-patient-2",
            icd10_code="E11.9",
            description="Type 2 diabetes mellitus without complications",
            clinical_status="active",
            verification_status="confirmed"
        )
        db_session.add(condition)
        db_session.commit()
        
        # Test relationship
        saved_patient = db_session.query(Patient).filter(Patient.id == "test-patient-2").first()
        assert len(saved_patient.conditions) == 1
        assert saved_patient.conditions[0].icd10_code == "E11.9"


class TestProviderModel:
    """Test Provider model functionality"""
    
    def test_create_provider(self, db_session):
        """Test creating a new provider"""
        provider = Provider(
            id="test-provider-1",
            npi="1234567890",
            first_name="Dr. Sarah",
            last_name="Johnson",
            title="MD",
            specialty="Internal Medicine",
            active=True
        )
        
        db_session.add(provider)
        db_session.commit()
        
        saved_provider = db_session.query(Provider).filter(Provider.id == "test-provider-1").first()
        assert saved_provider is not None
        assert saved_provider.specialty == "Internal Medicine"
        assert saved_provider.active is True


class TestEncounterModel:
    """Test Encounter model functionality"""
    
    def test_create_encounter(self, db_session):
        """Test creating a new encounter"""
        # Create prerequisites
        patient = Patient(
            id="test-patient-3",
            mrn="MRN003",
            first_name="Bob",
            last_name="Wilson",
            date_of_birth=date(1975, 3, 20),
            gender="Male"
        )
        
        provider = Provider(
            id="test-provider-2",
            first_name="Dr. Emily",
            last_name="Davis",
            specialty="Family Medicine",
            active=True
        )
        
        location = Location(
            id="test-location-1",
            name="Main Clinic",
            type="Clinic"
        )
        
        db_session.add_all([patient, provider, location])
        
        encounter = Encounter(
            id="test-encounter-1",
            patient_id="test-patient-3",
            provider_id="test-provider-2",
            location_id="test-location-1",
            encounter_date=datetime.now(),
            encounter_type="Outpatient",
            status="finished",
            chief_complaint="Annual physical"
        )
        
        db_session.add(encounter)
        db_session.commit()
        
        saved_encounter = db_session.query(Encounter).filter(Encounter.id == "test-encounter-1").first()
        assert saved_encounter is not None
        assert saved_encounter.encounter_type == "Outpatient"
        assert saved_encounter.chief_complaint == "Annual physical"
        assert saved_encounter.patient.first_name == "Bob"
        assert saved_encounter.provider.specialty == "Family Medicine"


class TestObservationModel:
    """Test Observation model functionality"""
    
    def test_create_vital_signs(self, db_session):
        """Test creating vital sign observations"""
        # Create patient first
        patient = Patient(
            id="test-patient-4",
            mrn="MRN004",
            first_name="Alice",
            last_name="Brown",
            date_of_birth=date(1980, 8, 10),
            gender="Female"
        )
        db_session.add(patient)
        
        # Create vital sign observation
        vital_sign = Observation(
            id="test-obs-1",
            patient_id="test-patient-4",
            observation_type="vital-signs",
            code="8480-6",
            display="Systolic blood pressure",
            value=120.0,
            unit="mmHg",
            reference_range_low=90.0,
            reference_range_high=140.0,
            interpretation="Normal",
            observation_date=datetime.now()
        )
        
        db_session.add(vital_sign)
        db_session.commit()
        
        saved_obs = db_session.query(Observation).filter(Observation.id == "test-obs-1").first()
        assert saved_obs is not None
        assert saved_obs.observation_type == "vital-signs"
        assert saved_obs.value == 120.0
        assert saved_obs.interpretation == "Normal"
    
    def test_create_lab_result(self, db_session):
        """Test creating laboratory result observations"""
        patient = Patient(
            id="test-patient-5",
            mrn="MRN005",
            first_name="Charlie",
            last_name="Green",
            date_of_birth=date(1970, 12, 5),
            gender="Male"
        )
        db_session.add(patient)
        
        lab_result = Observation(
            id="test-obs-2",
            patient_id="test-patient-5",
            observation_type="laboratory",
            code="4548-4",
            display="Hemoglobin A1c",
            value=7.2,
            unit="%",
            reference_range_low=4.0,
            reference_range_high=6.0,
            interpretation="High",
            observation_date=datetime.now()
        )
        
        db_session.add(lab_result)
        db_session.commit()
        
        saved_lab = db_session.query(Observation).filter(Observation.id == "test-obs-2").first()
        assert saved_lab is not None
        assert saved_lab.observation_type == "laboratory"
        assert saved_lab.display == "Hemoglobin A1c"
        assert saved_lab.interpretation == "High"


class TestMedicationModel:
    """Test Medication model functionality"""
    
    def test_create_medication(self, db_session):
        """Test creating medication records"""
        patient = Patient(
            id="test-patient-6",
            mrn="MRN006",
            first_name="Diana",
            last_name="White",
            date_of_birth=date(1965, 7, 22),
            gender="Female"
        )
        
        provider = Provider(
            id="test-provider-3",
            first_name="Dr. Michael",
            last_name="Brown",
            specialty="Endocrinology",
            active=True
        )
        
        db_session.add_all([patient, provider])
        
        medication = Medication(
            id="test-med-1",
            patient_id="test-patient-6",
            medication_name="Metformin",
            dosage="1000mg",
            route="Oral",
            frequency="Twice daily",
            start_date=date.today(),
            status="active",
            prescriber_id="test-provider-3"
        )
        
        db_session.add(medication)
        db_session.commit()
        
        saved_med = db_session.query(Medication).filter(Medication.id == "test-med-1").first()
        assert saved_med is not None
        assert saved_med.medication_name == "Metformin"
        assert saved_med.status == "active"
        assert saved_med.prescriber.specialty == "Endocrinology"


if __name__ == "__main__":
    pytest.main([__file__])