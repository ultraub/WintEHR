"""
Comprehensive FHIR R4 API Test Suite
Tests all FHIR resources, search parameters, chained queries, and bulk operations
"""

import pytest
import json
from datetime import datetime, timedelta
from urllib.parse import quote
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import Base, get_db_session as get_db
from models.synthea_models import Patient, Provider, Organization, Location, Encounter, Observation, Condition, Medication

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_fhir.db"
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

class TestFHIRPatientResource:
    """Test Patient FHIR resource operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Clear test data
        db = TestingSessionLocal()
        db.query(Patient).delete()
        db.query(Provider).delete()
        db.query(Organization).delete()
        db.query(Location).delete()
        db.commit()
        
        # Create test patients
        self.patient1 = Patient(
            id="test-patient-1",
            first_name="John",
            last_name="Doe",
            date_of_birth=datetime(1980, 1, 15).date(),
            gender="M",
            ssn="123-45-6789",
            address="123 Main St",
            city="Boston",
            state="MA",
            zip_code="02101",
            phone="617-555-0001",
            email="john.doe@example.com"        )
        
        self.patient2 = Patient(
            id="test-patient-2",
            first_name="Jane",
            last_name="Smith",
            date_of_birth=datetime(1990, 6, 20).date(),
            gender="F",
            address="456 Oak Ave",
            city="Cambridge",
            state="MA",
            zip_code="02139",
            phone="617-555-0002"        )
        
        db.add(self.patient1)
        db.add(self.patient2)
        db.commit()
        
        # Store IDs before closing session
        self.patient1_id = self.patient1.id
        self.patient2_id = self.patient2.id
        
        db.close()
    
    def test_get_patient_by_id(self):
        """Test retrieving a single patient by ID"""
        response = client.get(f"/fhir/R4/Patient/{self.patient1_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Patient"
        assert data["id"] == self.patient1_id
        assert data["name"][0]["family"] == "Doe"
        assert data["name"][0]["given"] == ["John"]
        assert data["gender"] == "male"
        assert data["birthDate"] == "1980-01-15"
    
    def test_search_patients_no_params(self):
        """Test searching all patients"""
        response = client.get("/fhir/R4/Patient")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Bundle"
        assert data["type"] == "searchset"
        assert len(data["entry"]) == 2
    
    def test_search_patient_by_name(self):
        """Test searching patients by name"""
        response = client.get("/fhir/R4/Patient?name=John")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["name"][0]["given"] == ["John"]
    
    def test_search_patient_by_family(self):
        """Test searching patients by family name"""
        response = client.get("/fhir/R4/Patient?family=Smith")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["name"][0]["family"] == "Smith"
    
    def test_search_patient_by_gender(self):
        """Test searching patients by gender"""
        response = client.get("/fhir/R4/Patient?gender=female")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["gender"] == "female"
    
    def test_search_patient_by_birthdate(self):
        """Test searching patients by birthdate"""
        response = client.get("/fhir/R4/Patient?birthdate=1980-01-15")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["birthDate"] == "1980-01-15"
    
    def test_search_patient_with_multiple_params(self):
        """Test searching patients with multiple parameters"""
        response = client.get("/fhir/R4/Patient?gender=male&family=Doe")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == self.patient1.id
    
    def test_search_patient_with_pagination(self):
        """Test patient search with pagination"""
        response = client.get("/fhir/R4/Patient?_count=1&_offset=0")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert "link" in data
        
        # Check for next link
        next_link = next((link for link in data["link"] if link["relation"] == "next"), None)
        assert next_link is not None
    
    def test_search_patient_with_sort(self):
        """Test patient search with sorting"""
        response = client.get("/fhir/R4/Patient?_sort=birthdate")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2
        # First patient should be older (1980)
        assert data["entry"][0]["resource"]["birthDate"] == "1980-01-15"
        assert data["entry"][1]["resource"]["birthDate"] == "1990-06-20"
        
        # Test descending sort
        response = client.get("/fhir/R4/Patient?_sort=-birthdate")
        assert response.status_code == 200
        
        data = response.json()
        # First patient should be younger (1990)
        assert data["entry"][0]["resource"]["birthDate"] == "1990-06-20"
        assert data["entry"][1]["resource"]["birthDate"] == "1980-01-15"
    
    def test_search_patient_exact_modifier(self):
        """Test exact string matching modifier"""
        response = client.get("/fhir/R4/Patient?family:exact=Doe")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["name"][0]["family"] == "Doe"
    
    def test_search_patient_contains_modifier(self):
        """Test contains string matching modifier"""
        response = client.get("/fhir/R4/Patient?family:contains=oe")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["name"][0]["family"] == "Doe"


class TestFHIREncounterResource:
    """Test Encounter FHIR resource operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Encounter).delete()
        db.query(Patient).delete()
        db.query(Provider).delete()
        db.commit()
        
        # Create test data
        self.patient = Patient(
            id="test-patient-enc",
            first_name="Test",
            last_name="Patient",
            date_of_birth=datetime(1985, 5, 15).date(),
            gender="M"
        )
        
        self.provider = Provider(
            id="test-provider-1",
            first_name="Dr.",
            last_name="Smith",
            npi="1234567890",
            specialty="Internal Medicine"
        )
        
        self.encounter1 = Encounter(
            id="test-encounter-1",
            patient_id=self.patient.id,
            provider_id=self.provider.id,
            encounter_date=datetime.now() - timedelta(days=7),
            encounter_type="ambulatory",
            encounter_class="AMB",
            status="finished",
            chief_complaint="Annual checkup"
        )
        
        self.encounter2 = Encounter(
            id="test-encounter-2",
            patient_id=self.patient.id,
            encounter_date=datetime.now() - timedelta(days=30),
            encounter_type="emergency",
            encounter_class="EMER",
            status="finished",
            chief_complaint="Chest pain"
        )
        
        db.add(self.patient)
        db.add(self.provider)
        db.add(self.encounter1)
        db.add(self.encounter2)
        db.commit()
        
        # Store IDs before closing session
        self.patient_id = self.patient.id
        self.provider_id = self.provider.id
        self.encounter1_id = self.encounter1.id
        self.encounter2_id = self.encounter2.id
        
        db.close()
    
    def test_get_encounter_by_id(self):
        """Test retrieving a single encounter by ID"""
        response = client.get(f"/fhir/R4/Encounter/{self.encounter1_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Encounter"
        assert data["id"] == self.encounter1_id
        assert data["class"]["code"] == "AMB"
        assert data["status"] == "finished"
    
    def test_search_encounter_by_patient(self):
        """Test searching encounters by patient"""
        response = client.get(f"/fhir/R4/Encounter?subject={self.patient_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2
        for entry in data["entry"]:
            assert entry["resource"]["subject"]["reference"] == f"Patient/{self.patient_id}"
    
    def test_search_encounter_by_type(self):
        """Test searching encounters by type"""
        response = client.get("/fhir/R4/Encounter?type=ambulatory")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["type"][0]["text"] == "ambulatory"
    
    def test_search_encounter_by_date_range(self):
        """Test searching encounters by date range"""
        start_date = (datetime.now() - timedelta(days=10)).date().isoformat()
        end_date = datetime.now().date().isoformat()
        
        response = client.get(f"/fhir/R4/Encounter?period=ge{start_date}&period=le{end_date}")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == self.encounter1_id
    
    def test_encounter_chained_query(self):
        """Test chained query on encounter (e.g., find encounters for patients with specific name)"""
        response = client.get("/fhir/R4/Encounter?subject.family=Patient")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2


class TestFHIRObservationResource:
    """Test Observation FHIR resource operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Observation).delete()
        db.query(Encounter).delete()
        db.query(Patient).delete()
        db.commit()
        
        # Create test data
        self.patient = Patient(
            id="test-patient-obs",
            first_name="Test",
            last_name="ObsPatient",
            date_of_birth=datetime(1985, 5, 15).date(),
            gender="F"
        )
        
        self.encounter = Encounter(
            id="test-encounter-obs",
            patient_id=self.patient.id,
            encounter_date=datetime.now(),
            encounter_type="ambulatory",
            status="finished"
        )
        
        self.obs_lab = Observation(
            id="test-obs-lab-1",
            patient_id=self.patient.id,
            encounter_id=self.encounter.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="2345-7",
            display="Glucose",
            value="95",
            value_quantity=95.0,
            value_unit="mg/dL",
            reference_range_low=70.0,
            reference_range_high=100.0,
            interpretation="normal",
            status="final"
        )
        
        self.obs_vital = Observation(
            id="test-obs-vital-1",
            patient_id=self.patient.id,
            encounter_id=self.encounter.id,
            observation_date=datetime.now(),
            observation_type="vital-signs",
            loinc_code="8310-5",
            display="Body temperature",
            value="98.6",
            value_quantity=98.6,
            value_unit="F",
            status="final"
        )
        
        self.obs_high = Observation(
            id="test-obs-high-1",
            patient_id=self.patient.id,
            observation_date=datetime.now() - timedelta(days=1),
            observation_type="laboratory",
            loinc_code="2345-7",
            display="Glucose",
            value="150",
            value_quantity=150.0,
            value_unit="mg/dL",
            reference_range_low=70.0,
            reference_range_high=100.0,
            interpretation="high",
            status="final"
        )
        
        db.add(self.patient)
        db.add(self.encounter)
        db.add(self.obs_lab)
        db.add(self.obs_vital)
        db.add(self.obs_high)
        db.commit()
        
        # Store IDs before closing session
        self.patient_id = self.patient.id
        self.encounter_id = self.encounter.id
        self.obs_lab_id = self.obs_lab.id
        self.obs_vital_id = self.obs_vital.id
        self.obs_high_id = self.obs_high.id
        
        db.close()
    
    def test_get_observation_by_id(self):
        """Test retrieving a single observation by ID"""
        response = client.get(f"/fhir/R4/Observation/{self.obs_lab_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Observation"
        assert data["id"] == self.obs_lab_id
        assert data["code"]["coding"][0]["code"] == "2345-7"
        assert data["valueQuantity"]["value"] == 95.0
        assert data["valueQuantity"]["unit"] == "mg/dL"
    
    def test_search_observation_by_patient(self):
        """Test searching observations by patient"""
        response = client.get(f"/fhir/R4/Observation?subject={self.patient_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 3
    
    def test_search_observation_by_category(self):
        """Test searching observations by category"""
        response = client.get("/fhir/R4/Observation?category=laboratory")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2
        for entry in data["entry"]:
            assert any(cat["coding"][0]["code"] == "laboratory" 
                      for cat in entry["resource"]["category"])
    
    def test_search_observation_by_code(self):
        """Test searching observations by LOINC code"""
        response = client.get("/fhir/R4/Observation?code=2345-7")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2
        for entry in data["entry"]:
            assert entry["resource"]["code"]["coding"][0]["code"] == "2345-7"
    
    def test_search_observation_by_value_quantity(self):
        """Test searching observations by value-quantity"""
        # Test exact value
        response = client.get("/fhir/R4/Observation?value-quantity=95")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["valueQuantity"]["value"] == 95.0
        
        # Test greater than
        response = client.get("/fhir/R4/Observation?value-quantity=gt100")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["valueQuantity"]["value"] == 150.0
        
        # Test less than or equal
        response = client.get("/fhir/R4/Observation?value-quantity=le100")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) == 2
    
    def test_search_observation_with_include(self):
        """Test searching observations with _include"""
        response = client.get("/fhir/R4/Observation?code=2345-7&_include=Observation:subject")
        assert response.status_code == 200
        
        data = response.json()
        # Should include both observations and the related patient
        assert len(data["entry"]) >= 2
        
        # Check that we have both Observation and Patient resources
        resource_types = {entry["resource"]["resourceType"] for entry in data["entry"]}
        assert "Observation" in resource_types
    
    def test_observation_reference_ranges(self):
        """Test that reference ranges are properly included"""
        response = client.get(f"/fhir/R4/Observation/{self.obs_lab_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "referenceRange" in data
        assert len(data["referenceRange"]) == 1
        assert data["referenceRange"][0]["low"]["value"] == 70.0
        assert data["referenceRange"][0]["high"]["value"] == 100.0
        assert data["interpretation"][0]["coding"][0]["code"] == "N"  # Normal


class TestFHIRConditionResource:
    """Test Condition FHIR resource operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Condition).delete()
        db.query(Patient).delete()
        db.commit()
        
        # Create test data
        self.patient = Patient(
            id="test-patient-cond",
            first_name="Test",
            last_name="CondPatient",
            date_of_birth=datetime(1975, 3, 10).date(),
            gender="M"
        )
        
        self.condition1 = Condition(
            id="test-condition-1",
            patient_id=self.patient.id,
            onset_date=datetime(2023, 1, 15),
            icd10_code="I10",
            description="Essential hypertension",
            clinical_status="active",
            verification_status="confirmed"
        )
        
        self.condition2 = Condition(
            id="test-condition-2",
            patient_id=self.patient.id,
            onset_date=datetime(2022, 6, 1),
            icd10_code="E11.9",
            description="Type 2 diabetes mellitus without complications",
            clinical_status="active",
            verification_status="confirmed"
        )
        
        db.add(self.patient)
        db.add(self.condition1)
        db.add(self.condition2)
        db.commit()
        
        # Store IDs before closing session
        self.patient_id = self.patient.id
        self.condition1_id = self.condition1.id
        self.condition2_id = self.condition2.id
        
        db.close()
    
    def test_get_condition_by_id(self):
        """Test retrieving a single condition by ID"""
        response = client.get(f"/fhir/R4/Condition/{self.condition1_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "Condition"
        assert data["id"] == self.condition1_id
        assert data["code"]["coding"][0]["code"] == "I10"
        assert data["clinicalStatus"]["coding"][0]["code"] == "active"
    
    def test_search_condition_by_patient(self):
        """Test searching conditions by patient"""
        response = client.get(f"/fhir/R4/Condition?subject={self.patient_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2
    
    def test_search_condition_by_code(self):
        """Test searching conditions by ICD-10 code"""
        response = client.get("/fhir/R4/Condition?code=I10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["code"]["text"] == "Essential hypertension"
    
    def test_search_condition_by_clinical_status(self):
        """Test searching conditions by clinical status"""
        response = client.get("/fhir/R4/Condition?clinical-status=active")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2


class TestFHIRMedicationRequest:
    """Test MedicationRequest FHIR resource operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Medication).delete()
        db.query(Patient).delete()
        db.query(Provider).delete()
        db.commit()
        
        # Create test data
        self.patient = Patient(
            id="test-patient-med",
            first_name="Test",
            last_name="MedPatient",
            date_of_birth=datetime(1960, 8, 25).date(),
            gender="F"
        )
        
        self.provider = Provider(
            id="test-provider-med",
            first_name="Dr.",
            last_name="Jones",
            npi="9876543210"
        )
        
        self.medication1 = Medication(
            id="test-med-1",
            patient_id=self.patient.id,
            prescriber_id=self.provider.id,
            medication_name="Lisinopril",
            dosage="10mg",
            frequency="daily",
            route="oral",
            start_date=datetime(2023, 1, 1),
            status="active"
        )
        
        self.medication2 = Medication(
            id="test-med-2",
            patient_id=self.patient.id,
            medication_name="Metformin",
            dosage="500mg",
            frequency="twice daily",
            route="oral",
            start_date=datetime(2022, 6, 1),
            end_date=datetime(2023, 6, 1),
            status="stopped"
        )
        
        db.add(self.patient)
        db.add(self.provider)
        db.add(self.medication1)
        db.add(self.medication2)
        db.commit()
        
        # Store IDs before closing session
        self.patient_id = self.patient.id
        self.provider_id = self.provider.id
        self.medication1_id = self.medication1.id
        self.medication2_id = self.medication2.id
        
        db.close()
    
    def test_get_medication_request_by_id(self):
        """Test retrieving a single medication request by ID"""
        response = client.get(f"/fhir/R4/MedicationRequest/{self.medication1_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "MedicationRequest"
        assert data["id"] == self.medication1_id
        assert data["medicationCodeableConcept"]["coding"][0]["display"] == "Lisinopril"
        assert data["status"] == "active"
    
    def test_search_medication_by_patient(self):
        """Test searching medications by patient"""
        response = client.get(f"/fhir/R4/MedicationRequest?subject={self.patient_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 2
    
    def test_search_medication_by_status(self):
        """Test searching medications by status"""
        response = client.get("/fhir/R4/MedicationRequest?status=active")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["medicationCodeableConcept"]["coding"][0]["display"] == "Lisinopril"


class TestFHIRCapabilityStatement:
    """Test FHIR Capability Statement"""
    
    def test_metadata_endpoint(self):
        """Test the metadata endpoint returns capability statement"""
        response = client.get("/fhir/R4/metadata")
        assert response.status_code == 200
        
        data = response.json()
        assert data["resourceType"] == "CapabilityStatement"
        assert data["fhirVersion"] == "4.0.1"
        assert data["format"] == ["json"]
        
        # Check that all resources are listed
        resource_types = {r["type"] for r in data["rest"][0]["resource"]}
        expected_types = {"Patient", "Encounter", "Observation", "Condition", 
                         "MedicationRequest", "Practitioner", "Organization", "Location"}
        assert expected_types.issubset(resource_types)


class TestFHIRBulkExport:
    """Test FHIR Bulk Export operations"""
    
    def test_system_export_initiation(self):
        """Test initiating a system-wide bulk export"""
        response = client.get("/fhir/R4/$export")
        assert response.status_code == 202
        assert "Content-Location" in response.headers
        
        # Extract export ID from Content-Location header
        export_id = response.headers["Content-Location"].split("/")[-1]
        assert export_id is not None
    
    def test_patient_export_initiation(self):
        """Test initiating a patient bulk export"""
        response = client.get("/fhir/R4/Patient/$export")
        assert response.status_code == 202
        assert "Content-Location" in response.headers
    
    def test_export_status_check(self):
        """Test checking bulk export status"""
        # First initiate an export
        response = client.get("/fhir/R4/$export")
        export_id = response.headers["Content-Location"].split("/")[-1]
        
        # Check status
        response = client.get(f"/fhir/R4/$export-status/{export_id}")
        # Since it's a mock implementation, it should return completed
        assert response.status_code in [200, 202]
        
        if response.status_code == 200:
            data = response.json()
            assert "transactionTime" in data
            assert "output" in data


class TestFHIRSearchModifiers:
    """Test FHIR search modifiers and advanced search features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear existing data
        db.query(Patient).delete()
        db.commit()
        
        # Create test data for modifier testing
        patient = Patient(
            id="test-mod-patient",
            first_name="TestExact",
            last_name="ModifierTest",
            date_of_birth=datetime(1980, 1, 1).date(),
            gender="M"
        )
        db.add(patient)
        db.commit()
        db.close()
    
    def test_exact_modifier(self):
        """Test :exact modifier for exact string matching"""
        # Should match
        response = client.get("/fhir/R4/Patient?family:exact=ModifierTest")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) == 1
        
        # Should not match (case sensitive)
        response = client.get("/fhir/R4/Patient?family:exact=modifiertest")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) == 0
    
    def test_contains_modifier(self):
        """Test :contains modifier for partial string matching"""
        response = client.get("/fhir/R4/Patient?family:contains=Modifier")
        assert response.status_code == 200
        data = response.json()
        assert len(data["entry"]) == 1


class TestFHIRChainedQueries:
    """Test FHIR chained search queries"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Clear and create test data
        db.query(Observation).delete()
        db.query(Encounter).delete()
        db.query(Patient).delete()
        db.commit()
        
        # Create patients
        patient1 = Patient(
            id="chain-patient-1",
            first_name="Chain",
            last_name="TestOne",
            date_of_birth=datetime(1970, 1, 1).date(),
            gender="M"
        )
        
        patient2 = Patient(
            id="chain-patient-2",
            first_name="Chain",
            last_name="TestTwo",
            date_of_birth=datetime(1980, 1, 1).date(),
            gender="F"
        )
        
        # Create encounters
        encounter1 = Encounter(
            id="chain-encounter-1",
            patient_id=patient1.id,
            encounter_date=datetime.now(),
            encounter_type="ambulatory",
            status="finished"
        )
        
        # Create observations
        obs1 = Observation(
            id="chain-obs-1",
            patient_id=patient1.id,
            encounter_id=encounter1.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="1234-5",
            display="Test Lab",
            value="10",
            value_quantity=10.0,
            status="final"
        )
        
        obs2 = Observation(
            id="chain-obs-2",
            patient_id=patient2.id,
            observation_date=datetime.now(),
            observation_type="laboratory",
            loinc_code="1234-5",
            display="Test Lab",
            value="20",
            value_quantity=20.0,
            status="final"
        )
        
        db.add_all([patient1, patient2, encounter1, obs1, obs2])
        db.commit()
        db.close()
    
    def test_observation_patient_name_chain(self):
        """Test chained query: Find observations for patients with specific last name"""
        response = client.get("/fhir/R4/Observation?subject.family=TestOne")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == "chain-obs-1"
    
    def test_encounter_patient_name_chain(self):
        """Test chained query: Find encounters for patients with specific name"""
        response = client.get("/fhir/R4/Encounter?subject.family=TestOne")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) == 1
        assert data["entry"][0]["resource"]["id"] == "chain-encounter-1"


class TestFHIRErrorHandling:
    """Test FHIR API error handling"""
    
    def test_invalid_resource_type(self):
        """Test requesting an invalid resource type"""
        response = client.get("/fhir/R4/InvalidResource")
        assert response.status_code == 404
        assert "Resource type InvalidResource not supported" in response.json()["detail"]
    
    def test_resource_not_found(self):
        """Test requesting a non-existent resource"""
        response = client.get("/fhir/R4/Patient/non-existent-id")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]
    
    def test_invalid_search_parameter(self):
        """Test using an invalid search parameter"""
        response = client.get("/fhir/R4/Patient?invalidparam=value")
        assert response.status_code == 200  # Should ignore unknown params
        
    def test_malformed_date_parameter(self):
        """Test using a malformed date parameter"""
        response = client.get("/fhir/R4/Patient?birthdate=invalid-date")
        assert response.status_code == 200  # Should handle gracefully
        data = response.json()
        # Should return empty results rather than error
        assert data["resourceType"] == "Bundle"
        assert len(data["entry"]) == 0


class TestFHIRComplexQueries:
    """Test complex FHIR queries with multiple parameters and modifiers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        db = TestingSessionLocal()
        # Create diverse test data
        db.query(Observation).delete()
        db.query(Patient).delete()
        db.commit()
        
        # Create multiple patients
        for i in range(5):
            patient = Patient(
                id=f"complex-patient-{i}",
                first_name=f"Test{i}",
                last_name="Complex",
                date_of_birth=datetime(1970 + i*10, 1, 1).date(),
                gender="M" if i % 2 == 0 else "F"
            )
            db.add(patient)
            
            # Create multiple observations per patient
            for j in range(3):
                obs = Observation(
                    id=f"complex-obs-{i}-{j}",
                    patient_id=patient.id,
                    observation_date=datetime.now() - timedelta(days=j*10),
                    observation_type="laboratory" if j < 2 else "vital-signs",
                    loinc_code=f"100{j}-5",
                    display=f"Test {j}",
                    value=str(50 + i*10 + j*5),
                    value_quantity=float(50 + i*10 + j*5),
                    status="final"
                )
                db.add(obs)
        
        db.commit()
        db.close()
    
    def test_complex_multi_parameter_search(self):
        """Test search with multiple parameters and conditions"""
        # Find lab observations for female patients with values > 60
        response = client.get("/fhir/R4/Observation?category=laboratory&value-quantity=gt60")
        assert response.status_code == 200
        
        data = response.json()
        # Should find observations with value > 60 that are labs
        assert len(data["entry"]) > 0
        for entry in data["entry"]:
            assert entry["resource"]["valueQuantity"]["value"] > 60
            assert any(cat["coding"][0]["code"] == "laboratory" 
                      for cat in entry["resource"]["category"])
    
    def test_pagination_with_complex_search(self):
        """Test pagination with complex search criteria"""
        # First page
        response = client.get("/fhir/R4/Observation?category=laboratory&_count=5&_offset=0")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["entry"]) <= 5
        
        # Check for next link
        next_link = next((link for link in data["link"] if link["relation"] == "next"), None)
        if data["total"] > 5:
            assert next_link is not None


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])