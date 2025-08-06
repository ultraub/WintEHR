"""
Test Suite for Phase 1 FHIR R4 Search Parameter Implementations
Tests critical patient safety features:
1. MedicationDispense lot-number and expiration-date search
2. Observation and DiagnosticReport based-on parameter
3. Condition category search
4. Provenance search implementation
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from fhir.models.resource import FHIRResource
from models.synthea_models import Observation, DiagnosticReport
from fhir.models.extended import Provenance


class TestMedicationDispenseLotTracking:
    """Test medication lot tracking for patient safety"""
    
    def test_search_by_lot_number(self, client: TestClient, db: Session):
        """Test searching MedicationDispense by lot-number"""
        # Create test MedicationDispense with lot number
        med_dispense = FHIRResource(
            resource_type="MedicationDispense",
            fhir_id="test-dispense-1",
            resource={
                "resourceType": "MedicationDispense",
                "id": "test-dispense-1",
                "status": "completed",
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "1234",
                        "display": "Test Medication"
                    }]
                },
                "subject": {"reference": "Patient/123"},
                "batch": {
                    "lotNumber": "LOT12345",
                    "expirationDate": "2024-12-31"
                }
            }
        )
        db.add(med_dispense)
        db.commit()
        
        # Search by lot number
        response = client.get("/fhir/R4/MedicationDispense?lot-number=LOT12345")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["resourceType"] == "Bundle"
        assert bundle["total"] == 1
        assert bundle["entry"][0]["resource"]["id"] == "test-dispense-1"
        assert bundle["entry"][0]["resource"]["batch"]["lotNumber"] == "LOT12345"
    
    def test_search_by_expiration_date(self, client: TestClient, db: Session):
        """Test searching MedicationDispense by expiration-date"""
        # Create test data with different expiration dates
        base_date = datetime.now()
        for i in range(3):
            days_offset = i * 30  # 0, 30, 60 days from now
            expiration = (base_date + timedelta(days=days_offset)).strftime("%Y-%m-%d")
            
            med_dispense = FHIRResource(
                resource_type="MedicationDispense",
                fhir_id=f"test-dispense-exp-{i}",
                resource={
                    "resourceType": "MedicationDispense",
                    "id": f"test-dispense-exp-{i}",
                    "status": "completed",
                    "subject": {"reference": "Patient/123"},
                    "batch": {
                        "lotNumber": f"LOT-EXP-{i}",
                        "expirationDate": expiration
                    }
                }
            )
            db.add(med_dispense)
        db.commit()
        
        # Search for medications expiring before 45 days from now
        search_date = (base_date + timedelta(days=45)).strftime("%Y-%m-%d")
        response = client.get(f"/fhir/R4/MedicationDispense?expiration-date=lt{search_date}")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["total"] == 2  # Should find the ones expiring in 0 and 30 days
    
    def test_medication_recall_scenario(self, client: TestClient, db: Session):
        """Test real-world medication recall scenario"""
        # Create multiple dispenses with same lot number (recall scenario)
        recalled_lot = "RECALL-LOT-001"
        patient_ids = ["patient-1", "patient-2", "patient-3"]
        
        for pid in patient_ids:
            med_dispense = FHIRResource(
                resource_type="MedicationDispense",
                fhir_id=f"dispense-{pid}",
                resource={
                    "resourceType": "MedicationDispense",
                    "id": f"dispense-{pid}",
                    "status": "completed",
                    "subject": {"reference": f"Patient/{pid}"},
                    "batch": {"lotNumber": recalled_lot}
                }
            )
            db.add(med_dispense)
        db.commit()
        
        # Search for all dispenses with recalled lot
        response = client.get(f"/fhir/R4/MedicationDispense?lot-number={recalled_lot}")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["total"] == 3
        
        # Verify we can identify all affected patients
        affected_patients = set()
        for entry in bundle["entry"]:
            patient_ref = entry["resource"]["subject"]["reference"]
            affected_patients.add(patient_ref.split("/")[1])
        
        assert affected_patients == set(patient_ids)


class TestOrderToResultTracking:
    """Test order-to-result workflow with based-on parameter"""
    
    def test_observation_based_on_service_request(self, client: TestClient, db: Session):
        """Test linking observations to service requests"""
        # Create test observation with based-on reference
        observation = Observation(
            id="obs-1",
            patient_id="patient-123",
            loinc_code="1234-5",
            display="Test Result",
            value="10.5",
            units="mg/dL",
            date="2024-01-15",
            based_on=[{"reference": "ServiceRequest/order-123"}]
        )
        db.add(observation)
        db.commit()
        
        # Search by based-on with full reference
        response = client.get("/fhir/R4/Observation?based-on=ServiceRequest/order-123")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["total"] == 1
        assert bundle["entry"][0]["resource"]["id"] == "obs-1"
        
        # Search by based-on with just ID
        response = client.get("/fhir/R4/Observation?based-on=order-123")
        assert response.status_code == 200
        assert response.json()["total"] == 1
    
    def test_diagnostic_report_based_on_service_request(self, client: TestClient, db: Session):
        """Test linking diagnostic reports to service requests"""
        # Create test diagnostic report
        report = DiagnosticReport(
            id="report-1",
            patient_id="patient-123",
            loinc_code="5678-9",
            description="Complete Blood Count",
            report_date=datetime.now(),
            based_on=[{"reference": "ServiceRequest/cbc-order-456"}]
        )
        db.add(report)
        db.commit()
        
        # Search by based-on
        response = client.get("/fhir/R4/DiagnosticReport?based-on=ServiceRequest/cbc-order-456")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["total"] == 1
        assert bundle["entry"][0]["resource"]["id"] == "report-1"
    
    def test_order_fulfillment_workflow(self, client: TestClient, db: Session):
        """Test complete order-to-result workflow"""
        order_id = "lab-order-789"
        
        # Create multiple observations for the same order
        test_results = [
            ("2708-6", "Oxygen saturation", "98", "%"),
            ("8310-5", "Body temperature", "37.2", "Cel"),
            ("8867-4", "Heart rate", "72", "/min")
        ]
        
        for i, (code, display, value, unit) in enumerate(test_results):
            obs = Observation(
                id=f"obs-order-{i}",
                patient_id="patient-123",
                loinc_code=code,
                display=display,
                value=value,
                units=unit,
                date=datetime.now().isoformat(),
                based_on=[{"reference": f"ServiceRequest/{order_id}"}]
            )
            db.add(obs)
        
        # Create diagnostic report summarizing all results
        report = DiagnosticReport(
            id="report-summary-1",
            patient_id="patient-123",
            loinc_code="panel-001",
            description="Vital Signs Panel",
            report_date=datetime.now(),
            based_on=[{"reference": f"ServiceRequest/{order_id}"}],
            result=[
                {"reference": f"Observation/obs-order-{i}"}
                for i in range(len(test_results))
            ]
        )
        db.add(report)
        db.commit()
        
        # Search all resources fulfilling this order
        obs_response = client.get(f"/fhir/R4/Observation?based-on={order_id}")
        report_response = client.get(f"/fhir/R4/DiagnosticReport?based-on={order_id}")
        
        assert obs_response.json()["total"] == 3
        assert report_response.json()["total"] == 1


class TestConditionCategorization:
    """Test condition category search for problem list management"""
    
    def test_search_problem_list_items(self, client: TestClient, db: Session):
        """Test searching for problem list items"""
        # Create conditions with different categories
        conditions = [
            {
                "id": "condition-prob-1",
                "category": [{"coding": [{"code": "problem-list-item"}]}],
                "code": {"text": "Hypertension"}
            },
            {
                "id": "condition-prob-2", 
                "category": [{"coding": [{"code": "problem-list-item"}]}],
                "code": {"text": "Diabetes Type 2"}
            },
            {
                "id": "condition-enc-1",
                "category": [{"coding": [{"code": "encounter-diagnosis"}]}],
                "code": {"text": "Acute bronchitis"}
            }
        ]
        
        for cond_data in conditions:
            condition = FHIRResource(
                resource_type="Condition",
                fhir_id=cond_data["id"],
                resource={
                    "resourceType": "Condition",
                    "id": cond_data["id"],
                    "subject": {"reference": "Patient/123"},
                    **cond_data
                }
            )
            db.add(condition)
        db.commit()
        
        # Search for problem list items only
        response = client.get("/fhir/R4/Condition?category=problem-list-item")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["total"] == 2
        
        # Verify only problem list items returned
        for entry in bundle["entry"]:
            categories = entry["resource"]["category"]
            assert any(
                coding["code"] == "problem-list-item"
                for cat in categories
                for coding in cat.get("coding", [])
            )
    
    def test_search_encounter_diagnoses(self, client: TestClient, db: Session):
        """Test searching for encounter diagnoses"""
        # Create encounter diagnosis
        condition = FHIRResource(
            resource_type="Condition",
            fhir_id="encounter-dx-1",
            resource={
                "resourceType": "Condition",
                "id": "encounter-dx-1",
                "subject": {"reference": "Patient/123"},
                "encounter": {"reference": "Encounter/visit-123"},
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                        "code": "encounter-diagnosis",
                        "display": "Encounter Diagnosis"
                    }]
                }],
                "code": {"text": "Upper respiratory infection"}
            }
        )
        db.add(condition)
        db.commit()
        
        # Search with system and code
        response = client.get(
            "/fhir/R4/Condition?"
            "category=http://terminology.hl7.org/CodeSystem/condition-category|encounter-diagnosis"
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1


class TestProvenanceSearch:
    """Test provenance search implementation for data integrity"""
    
    def test_search_by_target(self, client: TestClient, db: Session):
        """Test searching provenance by target resource"""
        # Create provenance record
        provenance = Provenance(
            id="prov-1",
            target=[
                {"reference": "Observation/obs-123"},
                {"reference": "Patient/patient-123"}
            ],
            recorded=datetime.now(),
            agent=[{
                "type": {"coding": [{"code": "author"}]},
                "who": {"reference": "Practitioner/dr-smith"}
            }],
            activity={"coding": [{"code": "CREATE"}]}
        )
        db.add(provenance)
        db.commit()
        
        # Search by target
        response = client.get("/fhir/R4/Provenance?target=Observation/obs-123")
        assert response.status_code == 200
        assert response.json()["total"] == 1
        
        # Search by target ID only
        response = client.get("/fhir/R4/Provenance?target=obs-123")
        assert response.status_code == 200
        assert response.json()["total"] == 1
    
    def test_search_by_agent(self, client: TestClient, db: Session):
        """Test searching provenance by agent"""
        # Create provenance with multiple agents
        provenance = Provenance(
            id="prov-2",
            target=[{"reference": "MedicationRequest/rx-456"}],
            recorded=datetime.now(),
            agent=[
                {
                    "type": {"coding": [{"code": "author"}]},
                    "who": {"reference": "Practitioner/dr-jones"}
                },
                {
                    "type": {"coding": [{"code": "verifier"}]},
                    "who": {"reference": "Practitioner/pharmacist-smith"}
                }
            ]
        )
        db.add(provenance)
        db.commit()
        
        # Search by agent
        response = client.get("/fhir/R4/Provenance?agent=Practitioner/dr-jones")
        assert response.status_code == 200
        assert response.json()["total"] == 1
    
    def test_search_by_activity(self, client: TestClient, db: Session):
        """Test searching provenance by activity"""
        activities = [
            ("CREATE", "prov-create"),
            ("UPDATE", "prov-update"),
            ("DELETE", "prov-delete")
        ]
        
        for activity_code, prov_id in activities:
            prov = Provenance(
                id=prov_id,
                target=[{"reference": f"Resource/{prov_id}"}],
                recorded=datetime.now(),
                agent=[{"who": {"reference": "Practitioner/admin"}}],
                activity={
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-DataOperation",
                        "code": activity_code
                    }]
                }
            )
            db.add(prov)
        db.commit()
        
        # Search by activity code
        response = client.get("/fhir/R4/Provenance?activity=UPDATE")
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert response.json()["entry"][0]["resource"]["id"] == "prov-update"
    
    def test_search_by_recorded_date(self, client: TestClient, db: Session):
        """Test searching provenance by recorded date"""
        base_date = datetime.now()
        
        # Create provenance records with different dates
        for i in range(5):
            recorded_date = base_date - timedelta(days=i)
            prov = Provenance(
                id=f"prov-date-{i}",
                target=[{"reference": f"Resource/res-{i}"}],
                recorded=recorded_date,
                agent=[{"who": {"reference": "Practitioner/system"}}]
            )
            db.add(prov)
        db.commit()
        
        # Search for records from last 3 days
        search_date = (base_date - timedelta(days=3)).strftime("%Y-%m-%d")
        response = client.get(f"/fhir/R4/Provenance?recorded=ge{search_date}")
        assert response.status_code == 200
        assert response.json()["total"] == 4  # Today and last 3 days
    
    def test_audit_trail_scenario(self, client: TestClient, db: Session):
        """Test complete audit trail scenario"""
        resource_id = "MedicationRequest/critical-rx-999"
        
        # Create audit trail for medication request lifecycle
        events = [
            ("CREATE", "dr-prescriber", datetime.now() - timedelta(hours=4)),
            ("UPDATE", "pharmacist-reviewer", datetime.now() - timedelta(hours=3)),
            ("VERIFY", "pharmacist-reviewer", datetime.now() - timedelta(hours=2)),
            ("DISPENSE", "pharmacist-dispenser", datetime.now() - timedelta(hours=1))
        ]
        
        for i, (activity, agent, timestamp) in enumerate(events):
            prov = Provenance(
                id=f"audit-{i}",
                target=[{"reference": resource_id}],
                recorded=timestamp,
                agent=[{
                    "type": {"coding": [{"code": activity.lower()}]},
                    "who": {"reference": f"Practitioner/{agent}"}
                }],
                activity={"coding": [{"code": activity}]}
            )
            db.add(prov)
        db.commit()
        
        # Get complete audit trail for the resource
        response = client.get(f"/fhir/R4/Provenance?target={resource_id}&_sort=recorded")
        assert response.status_code == 200
        
        bundle = response.json()
        assert bundle["total"] == 4
        
        # Verify chronological order
        activities = [
            entry["resource"]["activity"]["coding"][0]["code"]
            for entry in bundle["entry"]
        ]
        assert activities == ["CREATE", "UPDATE", "VERIFY", "DISPENSE"]


class TestIntegrationScenarios:
    """Test integrated scenarios using multiple parameters"""
    
    def test_medication_safety_workflow(self, client: TestClient, db: Session):
        """Test complete medication safety workflow"""
        # Scenario: Recalled medication lot with expiring batches
        
        # Create medication dispenses
        recalled_lot = "UNSAFE-LOT-2024"
        safe_lot = "SAFE-LOT-2024"
        
        dispenses = [
            ("disp-1", "patient-1", recalled_lot, "2024-06-30"),  # Recalled and expired
            ("disp-2", "patient-2", recalled_lot, "2025-12-31"),  # Recalled but not expired
            ("disp-3", "patient-3", safe_lot, "2024-06-30"),      # Not recalled but expired
            ("disp-4", "patient-4", safe_lot, "2025-12-31")       # Safe
        ]
        
        for disp_id, patient, lot, exp_date in dispenses:
            med_dispense = FHIRResource(
                resource_type="MedicationDispense",
                fhir_id=disp_id,
                resource={
                    "resourceType": "MedicationDispense",
                    "id": disp_id,
                    "status": "completed",
                    "subject": {"reference": f"Patient/{patient}"},
                    "batch": {
                        "lotNumber": lot,
                        "expirationDate": exp_date
                    }
                }
            )
            db.add(med_dispense)
            
            # Add provenance for traceability
            prov = Provenance(
                id=f"prov-{disp_id}",
                target=[{"reference": f"MedicationDispense/{disp_id}"}],
                recorded=datetime.now(),
                agent=[{"who": {"reference": "Practitioner/pharmacist-001"}}],
                activity={"coding": [{"code": "DISPENSE"}]}
            )
            db.add(prov)
        db.commit()
        
        # Find all recalled medications
        response = client.get(f"/fhir/R4/MedicationDispense?lot-number={recalled_lot}")
        assert response.json()["total"] == 2
        
        # Find all expired medications (as of 2024-07-01)
        response = client.get("/fhir/R4/MedicationDispense?expiration-date=lt2024-07-01")
        assert response.json()["total"] == 2
        
        # Find provenance for recalled lot
        provenance_response = client.get(f"/fhir/R4/Provenance?target=MedicationDispense/disp-1")
        assert provenance_response.json()["total"] == 1
    
    def test_clinical_decision_support_workflow(self, client: TestClient, db: Session):
        """Test using search parameters for clinical decision support"""
        patient_id = "patient-cds-test"
        
        # Create patient with diabetes on problem list
        diabetes_condition = FHIRResource(
            resource_type="Condition",
            fhir_id="diabetes-prob",
            resource={
                "resourceType": "Condition",
                "id": "diabetes-prob",
                "subject": {"reference": f"Patient/{patient_id}"},
                "category": [{"coding": [{"code": "problem-list-item"}]}],
                "code": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "44054006",
                        "display": "Diabetes mellitus type 2"
                    }]
                },
                "clinicalStatus": {
                    "coding": [{"code": "active"}]
                }
            }
        )
        db.add(diabetes_condition)
        
        # Create recent A1C observation
        a1c_obs = Observation(
            id="a1c-recent",
            patient_id=patient_id,
            loinc_code="4548-4",
            display="Hemoglobin A1c",
            value="8.5",
            units="%",
            date=(datetime.now() - timedelta(days=30)).isoformat(),
            based_on=[{"reference": "ServiceRequest/a1c-order"}]
        )
        db.add(a1c_obs)
        db.commit()
        
        # CDS Check: Find active problem list conditions
        cond_response = client.get(
            f"/fhir/R4/Condition?patient={patient_id}&category=problem-list-item"
        )
        assert cond_response.json()["total"] == 1
        
        # CDS Check: Find recent A1C results
        obs_response = client.get(
            f"/fhir/R4/Observation?patient={patient_id}&code=4548-4"
        )
        assert obs_response.json()["total"] == 1
        
        # Verify A1C value for alerting
        a1c_value = float(obs_response.json()["entry"][0]["resource"]["valueQuantity"]["value"])
        assert a1c_value > 7.0  # Alert threshold


# Pytest fixtures and configuration
@pytest.fixture
def client():
    """Create test client"""
    from main import app
    return TestClient(app)


@pytest.fixture
def db():
    """Create test database session"""
    from database import SessionLocal
    session = SessionLocal()
    yield session
    session.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])