#!/usr/bin/env python3
"""
Administrative Workflow Integration Test Harness

This test validates end-to-end administrative workflows that span multiple FHIR R4 resources.
It demonstrates the complete integration of administrative resources for healthcare operations:

- Order-to-Result Workflow: ServiceRequest → Observation/DiagnosticReport
- Appointment-to-Encounter Workflow: Appointment → Encounter → Clinical Documentation
- Insurance-to-Billing Workflow: Coverage → Claim → ExplanationOfBenefit
- Device-Patient Assignment Workflow: Device → Patient → Location tracking
- Goal-Care Planning Workflow: Goal → CarePlan → Patient outcomes
- Audit-Security Workflow: AuditEvent → Resource access tracking

These workflows represent real-world healthcare administrative processes that must work
seamlessly together to support clinical operations, revenue cycle management,
and regulatory compliance.
"""

import pytest
import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent directories to path for imports
current_dir = os.path.dirname(__file__)
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.insert(0, backend_dir)

from fhir.core.storage import FHIRStorageEngine
from database import async_session_maker


class TestAdministrativeWorkflowIntegration:
    """Test suite for administrative workflow integration"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with async_session_maker() as session:
            yield FHIRStorageEngine(session)

    # =====================================================================
    # Order-to-Result Workflow Integration
    # =====================================================================

    async def test_complete_laboratory_order_workflow(self, storage_engine):
        """Test complete laboratory ordering workflow from order to result"""
        
        # Step 1: Create ServiceRequest (laboratory order)
        lab_order_data = {
            "resourceType": "ServiceRequest",
            "id": "lab-order-workflow-001",
            "status": "active",
            "intent": "order",
            "priority": "routine",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "108252007",
                    "display": "Laboratory procedure"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "58410-2",
                    "display": "Complete blood count (CBC) panel"
                }]
            },
            "subject": {
                "reference": "Patient/workflow-patient-001",
                "display": "Workflow Test Patient"
            },
            "encounter": {
                "reference": "Encounter/workflow-encounter-001",
                "display": "Hospital visit"
            },
            "authoredOn": "2025-07-15T09:00:00Z",
            "requester": {
                "reference": "Practitioner/workflow-practitioner-001",
                "display": "Dr. Workflow Test"
            },
            "performer": [{
                "reference": "Organization/central-lab",
                "display": "Central Laboratory"
            }]
        }
        
        service_request = await storage_engine.create_resource("ServiceRequest", lab_order_data)
        assert service_request["status"] == "active"
        assert service_request["intent"] == "order"
        
        # Step 2: Create linked Observation (lab result)
        lab_result_data = {
            "resourceType": "Observation",
            "id": "lab-result-workflow-001",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "laboratory"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "58410-2",
                    "display": "Complete blood count (CBC) panel"
                }]
            },
            "subject": {
                "reference": "Patient/workflow-patient-001"
            },
            "encounter": {
                "reference": "Encounter/workflow-encounter-001"
            },
            "basedOn": [{
                "reference": f"ServiceRequest/{service_request['id']}"
            }],
            "effectiveDateTime": "2025-07-15T14:30:00Z",
            "valueQuantity": {
                "value": 4.5,
                "unit": "10*6/uL",
                "system": "http://unitsofmeasure.org"
            },
            "performer": [{
                "reference": "Organization/central-lab"
            }]
        }
        
        observation = await storage_engine.create_resource("Observation", lab_result_data)
        assert observation["status"] == "final"
        assert observation["basedOn"][0]["reference"] == f"ServiceRequest/{service_request['id']}"
        
        # Step 3: Update ServiceRequest status to completed
        service_request["status"] = "completed"
        completed_order = await storage_engine.update_resource("ServiceRequest", service_request["id"], service_request)
        assert completed_order["status"] == "completed"
        
        # Step 4: Verify workflow integration via search
        # Search for results linked to this order
        search_params = {"based-on": f"ServiceRequest/{service_request['id']}"}
        linked_results = await storage_engine.search_resources("Observation", search_params)
        assert len(linked_results) > 0
        assert linked_results[0]["id"] == observation["id"]
        
        # Search for orders by patient
        search_params = {"patient": "Patient/workflow-patient-001", "status": "completed"}
        patient_orders = await storage_engine.search_resources("ServiceRequest", search_params)
        assert len(patient_orders) > 0
        
        print("✓ Laboratory order-to-result workflow completed successfully")

    async def test_imaging_order_workflow(self, storage_engine):
        """Test imaging order workflow from order to study to report"""
        
        # Step 1: Create ServiceRequest (imaging order)
        imaging_order_data = {
            "resourceType": "ServiceRequest",
            "id": "imaging-order-workflow-001",
            "status": "active",
            "intent": "order",
            "priority": "stat",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "363679005",
                    "display": "Imaging procedure"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "36643-5",
                    "display": "Chest X-ray"
                }]
            },
            "subject": {
                "reference": "Patient/workflow-patient-002"
            },
            "authoredOn": "2025-07-15T10:00:00Z",
            "requester": {
                "reference": "Practitioner/emergency-physician"
            }
        }
        
        imaging_order = await storage_engine.create_resource("ServiceRequest", imaging_order_data)
        
        # Step 2: Create ImagingStudy
        imaging_study_data = {
            "resourceType": "ImagingStudy",
            "id": "imaging-study-workflow-001",
            "status": "available",
            "subject": {
                "reference": "Patient/workflow-patient-002"
            },
            "basedOn": [{
                "reference": f"ServiceRequest/{imaging_order['id']}"
            }],
            "started": "2025-07-15T11:00:00Z",
            "modality": [{
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "DX",
                "display": "Digital Radiography"
            }],
            "numberOfSeries": 1,
            "numberOfInstances": 2
        }
        
        imaging_study = await storage_engine.create_resource("ImagingStudy", imaging_study_data)
        
        # Step 3: Create DiagnosticReport
        diagnostic_report_data = {
            "resourceType": "DiagnosticReport",
            "id": "diagnostic-report-workflow-001",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                    "code": "RAD",
                    "display": "Radiology"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "36643-5",
                    "display": "Chest X-ray"
                }]
            },
            "subject": {
                "reference": "Patient/workflow-patient-002"
            },
            "basedOn": [{
                "reference": f"ServiceRequest/{imaging_order['id']}"
            }],
            "imagingStudy": [{
                "reference": f"ImagingStudy/{imaging_study['id']}"
            }],
            "effectiveDateTime": "2025-07-15T11:30:00Z",
            "conclusion": "Normal chest X-ray. No acute cardiopulmonary abnormalities."
        }
        
        diagnostic_report = await storage_engine.create_resource("DiagnosticReport", diagnostic_report_data)
        
        # Step 4: Complete the imaging order
        imaging_order["status"] = "completed"
        completed_order = await storage_engine.update_resource("ServiceRequest", imaging_order["id"], imaging_order)
        
        # Verify workflow integration
        assert completed_order["status"] == "completed"
        assert diagnostic_report["basedOn"][0]["reference"] == f"ServiceRequest/{imaging_order['id']}"
        assert diagnostic_report["imagingStudy"][0]["reference"] == f"ImagingStudy/{imaging_study['id']}"
        
        print("✓ Imaging order workflow completed successfully")

    # =====================================================================
    # Appointment-to-Encounter Workflow Integration
    # =====================================================================

    async def test_appointment_to_encounter_workflow(self, storage_engine):
        """Test appointment scheduling to encounter completion workflow"""
        
        # Step 1: Create Appointment
        appointment_data = {
            "resourceType": "Appointment",
            "id": "appointment-workflow-001",
            "status": "booked",
            "serviceType": [{
                "coding": [{
                    "system": "http://example.org/service-type",
                    "code": "124",
                    "display": "General Consultation"
                }]
            }],
            "start": "2025-07-15T14:00:00Z",
            "end": "2025-07-15T14:30:00Z",
            "participant": [{
                "actor": {
                    "reference": "Patient/workflow-patient-003",
                    "display": "Appointment Patient"
                },
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Practitioner/primary-care-physician",
                    "display": "Dr. Primary Care"
                },
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Location/clinic-room-a",
                    "display": "Clinic Room A"
                },
                "status": "accepted"
            }]
        }
        
        appointment = await storage_engine.create_resource("Appointment", appointment_data)
        assert appointment["status"] == "booked"
        
        # Step 2: Patient arrives - update appointment status
        appointment["status"] = "arrived"
        arrived_appointment = await storage_engine.update_resource("Appointment", appointment["id"], appointment)
        assert arrived_appointment["status"] == "arrived"
        
        # Step 3: Create Encounter when appointment starts
        encounter_data = {
            "resourceType": "Encounter",
            "id": "encounter-workflow-001",
            "status": "in-progress",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory"
            },
            "type": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "185349003",
                    "display": "Encounter for check up"
                }]
            }],
            "subject": {
                "reference": "Patient/workflow-patient-003"
            },
            "participant": [{
                "individual": {
                    "reference": "Practitioner/primary-care-physician"
                }
            }],
            "appointment": [{
                "reference": f"Appointment/{appointment['id']}"
            }],
            "period": {
                "start": "2025-07-15T14:00:00Z"
            },
            "location": [{
                "location": {
                    "reference": "Location/clinic-room-a"
                }
            }]
        }
        
        encounter = await storage_engine.create_resource("Encounter", encounter_data)
        assert encounter["status"] == "in-progress"
        assert encounter["appointment"][0]["reference"] == f"Appointment/{appointment['id']}"
        
        # Step 4: Complete encounter
        encounter["status"] = "finished"
        encounter["period"]["end"] = "2025-07-15T14:30:00Z"
        finished_encounter = await storage_engine.update_resource("Encounter", encounter["id"], encounter)
        
        # Step 5: Mark appointment as fulfilled
        appointment["status"] = "fulfilled"
        fulfilled_appointment = await storage_engine.update_resource("Appointment", appointment["id"], appointment)
        
        # Verify workflow integration
        assert finished_encounter["status"] == "finished"
        assert fulfilled_appointment["status"] == "fulfilled"
        
        # Search for patient's appointments
        search_params = {"patient": "Patient/workflow-patient-003", "status": "fulfilled"}
        patient_appointments = await storage_engine.search_resources("Appointment", search_params)
        assert len(patient_appointments) > 0
        
        print("✓ Appointment-to-encounter workflow completed successfully")

    # =====================================================================
    # Insurance-to-Billing Workflow Integration
    # =====================================================================

    async def test_complete_revenue_cycle_workflow(self, storage_engine):
        """Test complete revenue cycle from insurance verification to payment"""
        
        # Step 1: Create Coverage (insurance verification)
        coverage_data = {
            "resourceType": "Coverage",
            "id": "coverage-workflow-001",
            "status": "active",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "EHCPOL",
                    "display": "Extended healthcare"
                }]
            },
            "beneficiary": {
                "reference": "Patient/workflow-patient-004"
            },
            "payor": [{
                "reference": "Organization/insurance-company-workflow",
                "display": "Workflow Insurance Co"
            }],
            "period": {
                "start": "2025-01-01",
                "end": "2025-12-31"
            }
        }
        
        coverage = await storage_engine.create_resource("Coverage", coverage_data)
        assert coverage["status"] == "active"
        
        # Step 2: Create Claim (billing submission)
        claim_data = {
            "resourceType": "Claim",
            "id": "claim-workflow-001",
            "status": "active",
            "use": "claim",
            "patient": {
                "reference": "Patient/workflow-patient-004"
            },
            "created": "2025-07-15T10:00:00Z",
            "insurer": {
                "reference": "Organization/insurance-company-workflow"
            },
            "provider": {
                "reference": "Practitioner/billing-practitioner"
            },
            "priority": {
                "coding": [{
                    "code": "normal"
                }]
            },
            "insurance": [{
                "sequence": 1,
                "focal": True,
                "coverage": {
                    "reference": f"Coverage/{coverage['id']}"
                }
            }],
            "item": [{
                "sequence": 1,
                "productOrService": {
                    "coding": [{
                        "system": "http://example.org/fhir/CodeSystem/ex-serviceproduct",
                        "code": "exam",
                        "display": "Exam"
                    }]
                },
                "unitPrice": {
                    "value": 125.00,
                    "currency": "USD"
                },
                "net": {
                    "value": 125.00,
                    "currency": "USD"
                }
            }],
            "total": {
                "value": 125.00,
                "currency": "USD"
            }
        }
        
        claim = await storage_engine.create_resource("Claim", claim_data)
        assert claim["status"] == "active"
        assert claim["insurance"][0]["coverage"]["reference"] == f"Coverage/{coverage['id']}"
        
        # Step 3: Create ExplanationOfBenefit (payment processing)
        eob_data = {
            "resourceType": "ExplanationOfBenefit",
            "id": "eob-workflow-001",
            "status": "active",
            "use": "claim",
            "patient": {
                "reference": "Patient/workflow-patient-004"
            },
            "created": "2025-07-16T09:00:00Z",
            "insurer": {
                "reference": "Organization/insurance-company-workflow"
            },
            "provider": {
                "reference": "Practitioner/billing-practitioner"
            },
            "claim": {
                "reference": f"Claim/{claim['id']}"
            },
            "outcome": "complete",
            "disposition": "Claim settled as per contract.",
            "insurance": [{
                "focal": True,
                "coverage": {
                    "reference": f"Coverage/{coverage['id']}"
                }
            }],
            "item": [{
                "sequence": 1,
                "productOrService": {
                    "coding": [{
                        "system": "http://example.org/fhir/CodeSystem/ex-serviceproduct",
                        "code": "exam",
                        "display": "Exam"
                    }]
                },
                "unitPrice": {
                    "value": 125.00,
                    "currency": "USD"
                },
                "net": {
                    "value": 125.00,
                    "currency": "USD"
                },
                "adjudication": [{
                    "category": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/adjudication",
                            "code": "benefit"
                        }]
                    },
                    "amount": {
                        "value": 105.00,
                        "currency": "USD"
                    }
                }]
            }],
            "payment": {
                "amount": {
                    "value": 105.00,
                    "currency": "USD"
                },
                "date": "2025-07-20"
            }
        }
        
        eob = await storage_engine.create_resource("ExplanationOfBenefit", eob_data)
        assert eob["status"] == "active"
        assert eob["claim"]["reference"] == f"Claim/{claim['id']}"
        assert eob["outcome"] == "complete"
        
        # Verify complete revenue cycle workflow
        assert coverage["id"] == "coverage-workflow-001"
        assert claim["insurance"][0]["coverage"]["reference"] == f"Coverage/{coverage['id']}"
        assert eob["claim"]["reference"] == f"Claim/{claim['id']}"
        assert eob["insurance"][0]["coverage"]["reference"] == f"Coverage/{coverage['id']}"
        
        # Search for patient's financial resources
        search_params = {"beneficiary": "Patient/workflow-patient-004"}
        patient_coverage = await storage_engine.search_resources("Coverage", search_params)
        assert len(patient_coverage) > 0
        
        search_params = {"patient": "Patient/workflow-patient-004"}
        patient_claims = await storage_engine.search_resources("Claim", search_params)
        assert len(patient_claims) > 0
        
        patient_eobs = await storage_engine.search_resources("ExplanationOfBenefit", search_params)
        assert len(patient_eobs) > 0
        
        print("✓ Complete revenue cycle workflow completed successfully")

    # =====================================================================
    # Device-Patient Assignment Workflow
    # =====================================================================

    async def test_device_patient_assignment_workflow(self, storage_engine):
        """Test device assignment and tracking workflow"""
        
        # Step 1: Create Device
        device_data = {
            "resourceType": "Device",
            "id": "device-workflow-001",
            "status": "active",
            "type": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "25062003",
                    "display": "Infusion pump"
                }]
            },
            "manufacturer": "Medical Devices Inc",
            "modelNumber": "MP-2025",
            "serialNumber": "SN123456789",
            "patient": {
                "reference": "Patient/workflow-patient-005"
            },
            "owner": {
                "reference": "Organization/hospital-biomedical"
            },
            "location": {
                "reference": "Location/icu-room-5"
            }
        }
        
        device = await storage_engine.create_resource("Device", device_data)
        assert device["status"] == "active"
        assert device["patient"]["reference"] == "Patient/workflow-patient-005"
        
        # Step 2: Create AuditEvent for device assignment
        audit_data = {
            "resourceType": "AuditEvent",
            "id": "audit-device-assignment-001",
            "type": {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "110112",
                "display": "Query"
            },
            "action": "C",
            "recorded": "2025-07-15T10:00:00Z",
            "outcome": "0",
            "agent": [{
                "who": {
                    "reference": "Practitioner/biomedical-technician",
                    "display": "Biomedical Technician"
                },
                "requestor": True
            }],
            "source": {
                "observer": {
                    "reference": "Device/audit-server"
                }
            },
            "entity": [{
                "what": {
                    "reference": f"Device/{device['id']}"
                },
                "type": {
                    "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                    "code": "2",
                    "display": "System Object"
                },
                "name": "Device Assignment",
                "description": f"Device {device['serialNumber']} assigned to patient"
            }, {
                "what": {
                    "reference": "Patient/workflow-patient-005"
                },
                "type": {
                    "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                    "code": "1",
                    "display": "Person"
                },
                "role": {
                    "system": "http://terminology.hl7.org/CodeSystem/object-role",
                    "code": "1",
                    "display": "Patient"
                }
            }]
        }
        
        audit_event = await storage_engine.create_resource("AuditEvent", audit_data)
        assert audit_event["outcome"] == "0"
        
        # Step 3: Move device to different location
        device["location"]["reference"] = "Location/icu-room-6"
        updated_device = await storage_engine.update_resource("Device", device["id"], device)
        assert updated_device["location"]["reference"] == "Location/icu-room-6"
        
        # Step 4: Search workflows
        # Find devices assigned to patient
        search_params = {"patient": "Patient/workflow-patient-005"}
        patient_devices = await storage_engine.search_resources("Device", search_params)
        assert len(patient_devices) > 0
        
        # Find devices in location
        search_params = {"location": "Location/icu-room-6"}
        location_devices = await storage_engine.search_resources("Device", search_params)
        assert len(location_devices) > 0
        
        # Find audit events for device
        search_params = {"entity": f"Device/{device['id']}"}
        device_audits = await storage_engine.search_resources("AuditEvent", search_params)
        assert len(device_audits) > 0
        
        print("✓ Device-patient assignment workflow completed successfully")

    # =====================================================================
    # Goal-Care Planning Workflow
    # =====================================================================

    async def test_goal_care_planning_workflow(self, storage_engine):
        """Test goal setting and care planning workflow"""
        
        # Step 1: Create Goal
        goal_data = {
            "resourceType": "Goal",
            "id": "goal-workflow-001",
            "lifecycleStatus": "active",
            "achievementStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/goal-achievement",
                    "code": "in-progress",
                    "display": "In Progress"
                }]
            },
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/goal-category",
                    "code": "physiotherapy",
                    "display": "Physiotherapy"
                }]
            }],
            "description": {
                "text": "Patient will demonstrate improved mobility within 4 weeks"
            },
            "subject": {
                "reference": "Patient/workflow-patient-006"
            },
            "startDate": "2025-07-15",
            "target": [{
                "measure": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "LA11832-8",
                        "display": "Ability to perform activities of daily living"
                    }]
                },
                "detailQuantity": {
                    "value": 80,
                    "unit": "%",
                    "system": "http://unitsofmeasure.org",
                    "code": "%"
                },
                "dueDate": "2025-08-15"
            }]
        }
        
        goal = await storage_engine.create_resource("Goal", goal_data)
        assert goal["lifecycleStatus"] == "active"
        assert goal["achievementStatus"]["coding"][0]["code"] == "in-progress"
        
        # Step 2: Create CarePlan that addresses the goal
        careplan_data = {
            "resourceType": "CarePlan",
            "id": "careplan-workflow-001",
            "status": "active",
            "intent": "plan",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "182840001",
                    "display": "Drug treatment"
                }]
            }],
            "subject": {
                "reference": "Patient/workflow-patient-006"
            },
            "period": {
                "start": "2025-07-15",
                "end": "2025-08-15"
            },
            "goal": [{
                "reference": f"Goal/{goal['id']}"
            }],
            "activity": [{
                "detail": {
                    "status": "in-progress",
                    "description": "Physical therapy exercises 3x weekly",
                    "scheduledTiming": {
                        "repeat": {
                            "frequency": 3,
                            "period": 1,
                            "periodUnit": "wk"
                        }
                    }
                }
            }]
        }
        
        careplan = await storage_engine.create_resource("CarePlan", careplan_data)
        assert careplan["status"] == "active"
        assert careplan["goal"][0]["reference"] == f"Goal/{goal['id']}"
        
        # Step 3: Create Observation to track progress
        progress_observation_data = {
            "resourceType": "Observation",
            "id": "progress-observation-001",
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "survey"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "LA11832-8",
                    "display": "Ability to perform activities of daily living"
                }]
            },
            "subject": {
                "reference": "Patient/workflow-patient-006"
            },
            "effectiveDateTime": "2025-07-29T10:00:00Z",
            "valueQuantity": {
                "value": 75,
                "unit": "%",
                "system": "http://unitsofmeasure.org",
                "code": "%"
            },
            "derivedFrom": [{
                "reference": f"Goal/{goal['id']}"
            }]
        }
        
        progress_observation = await storage_engine.create_resource("Observation", progress_observation_data)
        
        # Step 4: Update goal achievement status
        goal["achievementStatus"]["coding"][0]["code"] = "improving"
        updated_goal = await storage_engine.update_resource("Goal", goal["id"], goal)
        assert updated_goal["achievementStatus"]["coding"][0]["code"] == "improving"
        
        # Verify workflow integration
        search_params = {"patient": "Patient/workflow-patient-006", "lifecycle-status": "active"}
        patient_goals = await storage_engine.search_resources("Goal", search_params)
        assert len(patient_goals) > 0
        
        search_params = {"subject": "Patient/workflow-patient-006", "status": "active"}
        patient_careplans = await storage_engine.search_resources("CarePlan", search_params)
        assert len(patient_careplans) > 0
        
        print("✓ Goal-care planning workflow completed successfully")

    # =====================================================================
    # Cross-Workflow Integration Tests
    # =====================================================================

    async def test_integrated_patient_workflow(self, storage_engine):
        """Test complete integrated patient workflow across all administrative resources"""
        
        patient_id = "Patient/integrated-workflow-patient"
        
        # Step 1: Schedule appointment
        appointment = await storage_engine.create_resource("Appointment", {
            "resourceType": "Appointment",
            "id": "integrated-appointment-001",
            "status": "booked",
            "start": "2025-07-15T09:00:00Z",
            "end": "2025-07-15T09:30:00Z",
            "participant": [{
                "actor": {"reference": patient_id},
                "status": "accepted"
            }]
        })
        
        # Step 2: Create encounter
        encounter = await storage_engine.create_resource("Encounter", {
            "resourceType": "Encounter",
            "id": "integrated-encounter-001",
            "status": "finished",
            "subject": {"reference": patient_id},
            "appointment": [{"reference": f"Appointment/{appointment['id']}"}],
            "period": {
                "start": "2025-07-15T09:00:00Z",
                "end": "2025-07-15T09:30:00Z"
            }
        })
        
        # Step 3: Create service request during encounter
        service_request = await storage_engine.create_resource("ServiceRequest", {
            "resourceType": "ServiceRequest",
            "id": "integrated-service-request-001",
            "status": "completed",
            "intent": "order",
            "subject": {"reference": patient_id},
            "encounter": {"reference": f"Encounter/{encounter['id']}"},
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "58410-2",
                    "display": "Complete blood count"
                }]
            }
        })
        
        # Step 4: Create goal based on encounter
        goal = await storage_engine.create_resource("Goal", {
            "resourceType": "Goal",
            "id": "integrated-goal-001",
            "lifecycleStatus": "active",
            "subject": {"reference": patient_id},
            "description": {"text": "Improve overall health"},
            "startDate": "2025-07-15"
        })
        
        # Step 5: Assign device to patient
        device = await storage_engine.create_resource("Device", {
            "resourceType": "Device",
            "id": "integrated-device-001",
            "status": "active",
            "patient": {"reference": patient_id},
            "type": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "25062003",
                    "display": "Infusion pump"
                }]
            }
        })
        
        # Step 6: Create audit trail
        audit = await storage_engine.create_resource("AuditEvent", {
            "resourceType": "AuditEvent",
            "id": "integrated-audit-001",
            "type": {"code": "110112"},
            "action": "R",
            "recorded": "2025-07-15T10:00:00Z",
            "outcome": "0",
            "agent": [{
                "who": {"reference": "Practitioner/integrated-practitioner"},
                "requestor": True
            }],
            "entity": [{
                "what": {"reference": patient_id},
                "type": {"code": "1"}
            }]
        })
        
        # Verify all resources are linked to the patient
        search_params = {"patient": patient_id.split('/')[1]}
        
        # Search across all administrative resource types
        appointments = await storage_engine.search_resources("Appointment", search_params)
        service_requests = await storage_engine.search_resources("ServiceRequest", search_params)
        goals = await storage_engine.search_resources("Goal", search_params)
        devices = await storage_engine.search_resources("Device", search_params)
        
        assert len(appointments) > 0
        assert len(service_requests) > 0
        assert len(goals) > 0
        assert len(devices) > 0
        
        # Search for audit events involving the patient
        search_params = {"entity": patient_id}
        audits = await storage_engine.search_resources("AuditEvent", search_params)
        assert len(audits) > 0
        
        print("✓ Integrated patient workflow completed successfully")

    # =====================================================================
    # Performance and Load Testing
    # =====================================================================

    async def test_bulk_administrative_workflow(self, storage_engine):
        """Test bulk administrative resource creation and workflow performance"""
        
        # Create multiple workflows in parallel
        workflows_count = 5
        created_resources = {
            "appointments": [],
            "service_requests": [],
            "coverage": [],
            "goals": [],
            "devices": []
        }
        
        for i in range(workflows_count):
            patient_ref = f"Patient/bulk-workflow-patient-{i:03d}"
            
            # Create appointment
            appointment = await storage_engine.create_resource("Appointment", {
                "resourceType": "Appointment",
                "id": f"bulk-appointment-{i:03d}",
                "status": "booked",
                "start": f"2025-07-{15+i:02d}T09:00:00Z",
                "end": f"2025-07-{15+i:02d}T09:30:00Z",
                "participant": [{"actor": {"reference": patient_ref}, "status": "accepted"}]
            })
            created_resources["appointments"].append(appointment)
            
            # Create service request
            service_request = await storage_engine.create_resource("ServiceRequest", {
                "resourceType": "ServiceRequest",
                "id": f"bulk-service-request-{i:03d}",
                "status": "active",
                "intent": "order",
                "subject": {"reference": patient_ref},
                "code": {"coding": [{"system": "http://loinc.org", "code": "58410-2"}]}
            })
            created_resources["service_requests"].append(service_request)
            
            # Create coverage
            coverage = await storage_engine.create_resource("Coverage", {
                "resourceType": "Coverage",
                "id": f"bulk-coverage-{i:03d}",
                "status": "active",
                "beneficiary": {"reference": patient_ref},
                "payor": [{"reference": "Organization/bulk-insurer"}]
            })
            created_resources["coverage"].append(coverage)
            
            # Create goal
            goal = await storage_engine.create_resource("Goal", {
                "resourceType": "Goal",
                "id": f"bulk-goal-{i:03d}",
                "lifecycleStatus": "active",
                "subject": {"reference": patient_ref},
                "description": {"text": f"Health goal {i}"}
            })
            created_resources["goals"].append(goal)
            
            # Create device
            device = await storage_engine.create_resource("Device", {
                "resourceType": "Device",
                "id": f"bulk-device-{i:03d}",
                "status": "active",
                "patient": {"reference": patient_ref},
                "type": {"coding": [{"system": "http://snomed.info/sct", "code": "25062003"}]}
            })
            created_resources["devices"].append(device)
        
        # Verify all resources were created
        for resource_type, resources in created_resources.items():
            assert len(resources) == workflows_count
        
        # Test bulk search performance
        search_params = {"status": "active"}
        
        # Search across all resource types
        appointments = await storage_engine.search_resources("Appointment", {"status": "booked"})
        service_requests = await storage_engine.search_resources("ServiceRequest", search_params)
        coverage_list = await storage_engine.search_resources("Coverage", search_params)
        goals = await storage_engine.search_resources("Goal", {"lifecycle-status": "active"})
        devices = await storage_engine.search_resources("Device", search_params)
        
        assert len(appointments) >= workflows_count
        assert len(service_requests) >= workflows_count
        assert len(coverage_list) >= workflows_count
        assert len(goals) >= workflows_count
        assert len(devices) >= workflows_count
        
        print(f"✓ Bulk administrative workflow with {workflows_count} resources completed successfully")


# =====================================================================
# Test Runner
# =====================================================================

if __name__ == "__main__":
    """Run Administrative Workflow Integration tests"""
    
    async def run_integration_tests():
        """Run all administrative workflow integration tests"""
        test_instance = TestAdministrativeWorkflowIntegration()
        
        # Get storage engine
        async with async_session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            print("Running Administrative Workflow Integration tests...")
            print("=" * 60)
            
            # Order-to-Result Workflows
            await test_instance.test_complete_laboratory_order_workflow(storage_engine)
            await test_instance.test_imaging_order_workflow(storage_engine)
            
            # Appointment-to-Encounter Workflow
            await test_instance.test_appointment_to_encounter_workflow(storage_engine)
            
            # Insurance-to-Billing Workflow
            await test_instance.test_complete_revenue_cycle_workflow(storage_engine)
            
            # Device-Patient Assignment Workflow
            await test_instance.test_device_patient_assignment_workflow(storage_engine)
            
            # Goal-Care Planning Workflow
            await test_instance.test_goal_care_planning_workflow(storage_engine)
            
            # Cross-Workflow Integration
            await test_instance.test_integrated_patient_workflow(storage_engine)
            
            # Performance Testing
            await test_instance.test_bulk_administrative_workflow(storage_engine)
            
            print("=" * 60)
            print("✅ All Administrative Workflow Integration tests completed successfully!")
            print("\nWorkflows Tested:")
            print("• Laboratory Order → Result Workflow")
            print("• Imaging Order → Study → Report Workflow")
            print("• Appointment → Encounter → Documentation Workflow")
            print("• Insurance → Claim → Payment Workflow")
            print("• Device Assignment → Patient → Location Tracking")
            print("• Goal Setting → Care Planning → Progress Tracking")
            print("• Cross-Resource Patient Workflow Integration")
            print("• Bulk Administrative Resource Performance")
    
    # Run the integration tests
    asyncio.run(run_integration_tests())