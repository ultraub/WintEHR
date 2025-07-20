#!/usr/bin/env python3
"""
Comprehensive Test Harness for Supporting Administrative Resources

This test validates complete FHIR R4 supporting administrative resource implementation including:
- Device: Medical devices and equipment management
- Goal: Patient care goals and care planning
- Media: Multimedia content and imaging attachments
- AuditEvent: Security audit trails and compliance tracking

FHIR R4 Specifications:
- Device: https://hl7.org/fhir/R4/device.html
- Goal: https://hl7.org/fhir/R4/goal.html
- Media: https://hl7.org/fhir/R4/media.html
- AuditEvent: https://hl7.org/fhir/R4/auditevent.html

Critical Administrative Support Workflows:
1. Device management - Medical equipment tracking and maintenance
2. Care planning - Goal setting and achievement tracking
3. Media management - Clinical images and multimedia content
4. Audit compliance - Security logging and regulatory compliance
5. Cross-resource integration - Supporting clinical and administrative workflows

Test Categories:
- CRUD Operations: Create, Read, Update, Delete supporting resources
- Search Parameters: All FHIR R4 search parameters for administrative support
- Administrative Workflows: Device tracking, goal management, media handling, audit logging
- Integration: Cross-resource support for clinical and administrative processes
- Compliance: Audit trail and regulatory compliance scenarios
- Error Handling: Validation and workflow error scenarios
"""

import pytest
import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
import base64

# Add parent directories to path for imports
current_dir = os.path.dirname(__file__)
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.insert(0, backend_dir)

from fhir.core.storage import FHIRStorageEngine
from database import async_session_maker


class TestSupportingResourcesComprehensive:
    """Comprehensive test suite for supporting administrative resources"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with async_session_maker() as session:
            yield FHIRStorageEngine(session)
    
    @pytest.fixture
    def sample_device_data(self):
        """Sample Device data for testing"""
        return {
            "resourceType": "Device",
            "id": "test-device-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/devices",
                "value": "DEV-2025-001"
            }],
            "definition": {
                "reference": "DeviceDefinition/infusion-pump-model-x"
            },
            "udiCarrier": [{
                "deviceIdentifier": "09504000059118",
                "issuer": "http://hl7.org/fhir/NamingSystem/gs1-di",
                "jurisdiction": "http://hl7.org/fhir/NamingSystem/fda-udi",
                "carrierAIDC": "MTAwNDAwMDA1OTExOA==",
                "carrierHRF": "(01)09504000059118(17)141120(10)7654321D(21)10987654d321"
            }],
            "status": "active",
            "statusReason": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/device-status-reason",
                    "code": "online",
                    "display": "Online"
                }]
            }],
            "distinctIdentifier": "12345",
            "manufacturer": "ACME Medical Devices",
            "manufactureDate": "2025-01-15",
            "expirationDate": "2030-01-15",
            "lotNumber": "LOT123456",
            "serialNumber": "SN789012",
            "deviceName": [{
                "name": "Infusion Pump Model X",
                "type": "manufacturer-name"
            }],
            "modelNumber": "IP-X-2025",
            "partNumber": "PN-IP-X-001",
            "type": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "25062003",
                    "display": "Infusion pump"
                }]
            },
            "specialization": [{
                "systemType": {
                    "coding": [{
                        "system": "http://snomed.info/sct",
                        "code": "182796009",
                        "display": "High-precision pump"
                    }]
                },
                "version": "2.1"
            }],
            "version": [{
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/device-version-type",
                        "code": "firmware",
                        "display": "Firmware"
                    }]
                },
                "value": "1.2.3"
            }],
            "property": [{
                "type": {
                    "coding": [{
                        "system": "http://example.org/device-properties",
                        "code": "flow-rate-max",
                        "display": "Maximum Flow Rate"
                    }]
                },
                "valueQuantity": [{
                    "value": 1000,
                    "unit": "mL/h",
                    "system": "http://unitsofmeasure.org",
                    "code": "mL/h"
                }]
            }],
            "patient": {
                "reference": "Patient/example-patient"
            },
            "owner": {
                "reference": "Organization/hospital-biomedical"
            },
            "location": {
                "reference": "Location/icu-room-1"
            },
            "safety": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/device-safety",
                    "code": "mri-safe",
                    "display": "MRI Safe"
                }]
            }]
        }
    
    @pytest.fixture
    def sample_goal_data(self):
        """Sample Goal data for testing"""
        return {
            "resourceType": "Goal",
            "id": "test-goal-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/goals",
                "value": "GOAL-2025-001"
            }],
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
            "priority": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/goal-priority",
                    "code": "medium-priority",
                    "display": "Medium Priority"
                }]
            },
            "description": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "182840001",
                    "display": "Drug treatment stopped - medical advice"
                }],
                "text": "Patient will demonstrate independence in self-care activities within 4 weeks"
            },
            "subject": {
                "reference": "Patient/example-patient",
                "display": "John Doe"
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
            }],
            "statusDate": "2025-07-15",
            "statusReason": "Patient is motivated and progressing well",
            "expressedBy": {
                "reference": "Patient/example-patient",
                "display": "John Doe"
            },
            "addresses": [{
                "reference": "Condition/mobility-limitation",
                "display": "Mobility limitation following hip surgery"
            }],
            "note": [{
                "authorReference": {
                    "reference": "Practitioner/physical-therapist",
                    "display": "Sarah Jones, PT"
                },
                "time": "2025-07-15T10:00:00Z",
                "text": "Patient demonstrates good understanding of exercises and is compliant with therapy"
            }],
            "outcomeCode": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "385669000",
                    "display": "Successful"
                }]
            }],
            "outcomeReference": [{
                "reference": "Observation/mobility-assessment-001",
                "display": "Mobility assessment showing 70% improvement"
            }]
        }
    
    @pytest.fixture
    def sample_media_data(self):
        """Sample Media data for testing"""
        # Create a small sample image data (base64 encoded)
        sample_image = base64.b64encode(b"Sample image data for testing").decode('utf-8')
        
        return {
            "resourceType": "Media",
            "id": "test-media-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/media",
                "value": "MED-2025-001"
            }],
            "basedOn": [{
                "reference": "ServiceRequest/imaging-request-001",
                "display": "Chest X-ray order"
            }],
            "partOf": [{
                "reference": "ImagingStudy/chest-xray-study-001",
                "display": "Chest X-ray study"
            }],
            "status": "completed",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/media-type",
                    "code": "image",
                    "display": "Image"
                }]
            },
            "modality": {
                "coding": [{
                    "system": "http://dicom.nema.org/resources/ontology/DCM",
                    "code": "DX",
                    "display": "Digital Radiography"
                }]
            },
            "view": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "399067008",
                    "display": "Lateral view"
                }]
            },
            "subject": {
                "reference": "Patient/example-patient",
                "display": "John Doe"
            },
            "encounter": {
                "reference": "Encounter/example-encounter",
                "display": "Hospital visit"
            },
            "createdDateTime": "2025-07-15T14:30:00Z",
            "issued": "2025-07-15T14:35:00Z",
            "operator": {
                "reference": "Practitioner/radiologic-technologist",
                "display": "Mike Wilson, RT"
            },
            "reasonCode": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "267036007",
                    "display": "Dyspnea"
                }]
            }],
            "bodySite": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "51185008",
                    "display": "Thoracic structure"
                }]
            },
            "deviceName": "Siemens Ysio Max",
            "device": {
                "reference": "Device/xray-machine-001",
                "display": "X-ray Machine Unit 1"
            },
            "height": 1024,
            "width": 768,
            "frames": 1,
            "duration": 0,
            "content": {
                "contentType": "image/jpeg",
                "data": sample_image,
                "title": "Chest X-ray - Lateral view",
                "creation": "2025-07-15T14:30:00Z"
            },
            "note": [{
                "authorReference": {
                    "reference": "Practitioner/radiologic-technologist",
                    "display": "Mike Wilson, RT"
                },
                "time": "2025-07-15T14:35:00Z",
                "text": "Good quality image with adequate penetration and positioning"
            }]
        }
    
    @pytest.fixture
    def sample_audit_event_data(self):
        """Sample AuditEvent data for testing"""
        return {
            "resourceType": "AuditEvent",
            "id": "test-audit-001",
            "type": {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "110112",
                "display": "Query"
            },
            "subtype": [{
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": "110120",
                "display": "Application Start"
            }],
            "action": "R",
            "period": {
                "start": "2025-07-15T09:00:00Z",
                "end": "2025-07-15T09:01:00Z"
            },
            "recorded": "2025-07-15T09:00:30Z",
            "outcome": "0",
            "outcomeDesc": "Success",
            "purposeOfEvent": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
                    "code": "HTEST",
                    "display": "test health data"
                }]
            }],
            "agent": [{
                "type": {
                    "coding": [{
                        "system": "http://dicom.nema.org/resources/ontology/DCM",
                        "code": "110153",
                        "display": "Source Role ID"
                    }]
                },
                "who": {
                    "reference": "Practitioner/example-practitioner",
                    "display": "Dr. Smith"
                },
                "altId": "user123",
                "name": "Dr. John Smith",
                "requestor": True,
                "location": {
                    "reference": "Location/emergency-department"
                },
                "policy": ["http://hospital.example.org/policies/access-control"],
                "media": {
                    "system": "http://dicom.nema.org/resources/ontology/DCM",
                    "code": "110030",
                    "display": "USB Disk Emulation"
                },
                "network": {
                    "address": "192.168.1.100",
                    "type": "2"
                },
                "purposeOfUse": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActReason",
                        "code": "TREAT",
                        "display": "Treatment"
                    }]
                }]
            }],
            "source": {
                "site": "Hospital Main Campus",
                "observer": {
                    "reference": "Device/audit-server-001",
                    "display": "Hospital Audit Server"
                },
                "type": [{
                    "system": "http://terminology.hl7.org/CodeSystem/security-source-type",
                    "code": "4",
                    "display": "Application Server"
                }]
            },
            "entity": [{
                "what": {
                    "reference": "Patient/example-patient",
                    "display": "John Doe"
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
                },
                "lifecycle": {
                    "system": "http://terminology.hl7.org/CodeSystem/dicom-audit-lifecycle",
                    "code": "6",
                    "display": "Access / Use"
                },
                "securityLabel": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                    "code": "N",
                    "display": "Normal"
                }],
                "name": "Patient Medical Record",
                "description": "Access to patient medical record for treatment purposes",
                "query": base64.b64encode(b"SELECT * FROM patient_records WHERE patient_id='example-patient'").decode('utf-8'),
                "detail": [{
                    "type": "User ID",
                    "valueString": "user123"
                }, {
                    "type": "Session ID",
                    "valueString": "session456"
                }]
            }]
        }

    # =====================================================================
    # Device Resource Tests
    # =====================================================================

    async def test_create_device(self, storage_engine, sample_device_data):
        """Test creating Device resource for medical equipment management"""
        
        # Create the Device
        created_resource = await storage_engine.create_resource(
            "Device", 
            sample_device_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "Device"
        assert created_resource.get("status") == "active"
        
        # Validate device identification
        assert created_resource.get("manufacturer") == "ACME Medical Devices"
        assert created_resource.get("modelNumber") == "IP-X-2025"
        assert created_resource.get("serialNumber") == "SN789012"
        
        # Validate device assignment
        assert created_resource.get("patient", {}).get("reference") == "Patient/example-patient"
        assert created_resource.get("owner", {}).get("reference") == "Organization/hospital-biomedical"
        assert created_resource.get("location", {}).get("reference") == "Location/icu-room-1"
        
        # Validate UDI information
        udi = created_resource.get("udiCarrier", [{}])[0]
        assert udi.get("deviceIdentifier") == "09504000059118"

    async def test_search_device_by_patient(self, storage_engine, sample_device_data):
        """Test Device search by patient for patient device tracking"""
        
        # Create resource
        await storage_engine.create_resource("Device", sample_device_data)
        
        # Search by patient
        search_params = {"patient": "Patient/example-patient"}
        results = await storage_engine.search_resources("Device", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["patient"]["reference"] == "Patient/example-patient"

    async def test_search_device_by_location(self, storage_engine, sample_device_data):
        """Test Device search by location for facility equipment management"""
        
        # Create resource
        await storage_engine.create_resource("Device", sample_device_data)
        
        # Search by location
        search_params = {"location": "Location/icu-room-1"}
        results = await storage_engine.search_resources("Device", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["location"]["reference"] == "Location/icu-room-1"

    async def test_search_device_by_type(self, storage_engine, sample_device_data):
        """Test Device search by type for equipment categorization"""
        
        # Create resource
        await storage_engine.create_resource("Device", sample_device_data)
        
        # Search by device type
        search_params = {"type": "http://snomed.info/sct|25062003"}
        results = await storage_engine.search_resources("Device", search_params)
        
        # Validate search results
        assert len(results) > 0

    async def test_search_device_by_status(self, storage_engine, sample_device_data):
        """Test Device search by status for maintenance management"""
        
        # Create active and inactive devices
        active_device = sample_device_data.copy()
        active_device["id"] = "active-device"
        await storage_engine.create_resource("Device", active_device)
        
        inactive_device = sample_device_data.copy()
        inactive_device["id"] = "inactive-device"
        inactive_device["status"] = "inactive"
        await storage_engine.create_resource("Device", inactive_device)
        
        # Search by status
        search_params = {"status": "active"}
        active_results = await storage_engine.search_resources("Device", search_params)
        
        # Validate status filtering
        assert len(active_results) > 0
        for result in active_results:
            assert result["status"] == "active"

    # =====================================================================
    # Goal Resource Tests  
    # =====================================================================

    async def test_create_goal(self, storage_engine, sample_goal_data):
        """Test creating Goal resource for care planning"""
        
        # Create the Goal
        created_resource = await storage_engine.create_resource(
            "Goal", 
            sample_goal_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "Goal"
        assert created_resource.get("lifecycleStatus") == "active"
        
        # Validate goal details
        assert created_resource.get("subject", {}).get("reference") == "Patient/example-patient"
        assert created_resource.get("startDate") == "2025-07-15"
        
        # Validate targets
        targets = created_resource.get("target", [])
        assert len(targets) > 0
        assert targets[0]["dueDate"] == "2025-08-15"
        assert targets[0]["detailQuantity"]["value"] == 80

    async def test_search_goal_by_patient(self, storage_engine, sample_goal_data):
        """Test Goal search by patient for care plan management"""
        
        # Create resource
        await storage_engine.create_resource("Goal", sample_goal_data)
        
        # Search by patient
        search_params = {"patient": "Patient/example-patient"}
        results = await storage_engine.search_resources("Goal", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["subject"]["reference"] == "Patient/example-patient"

    async def test_search_goal_by_lifecycle_status(self, storage_engine, sample_goal_data):
        """Test Goal search by lifecycle status for goal tracking"""
        
        # Create goals with different statuses
        active_goal = sample_goal_data.copy()
        active_goal["id"] = "active-goal"
        await storage_engine.create_resource("Goal", active_goal)
        
        completed_goal = sample_goal_data.copy()
        completed_goal["id"] = "completed-goal"
        completed_goal["lifecycleStatus"] = "completed"
        await storage_engine.create_resource("Goal", completed_goal)
        
        # Search by lifecycle status
        search_params = {"lifecycle-status": "active"}
        active_results = await storage_engine.search_resources("Goal", search_params)
        
        # Validate status filtering
        assert len(active_results) > 0
        for result in active_results:
            assert result["lifecycleStatus"] == "active"

    async def test_search_goal_by_category(self, storage_engine, sample_goal_data):
        """Test Goal search by category for goal type filtering"""
        
        # Create resource
        await storage_engine.create_resource("Goal", sample_goal_data)
        
        # Search by category
        search_params = {"category": "http://terminology.hl7.org/CodeSystem/goal-category|physiotherapy"}
        results = await storage_engine.search_resources("Goal", search_params)
        
        # Validate search results
        assert len(results) > 0

    # =====================================================================
    # Media Resource Tests
    # =====================================================================

    async def test_create_media(self, storage_engine, sample_media_data):
        """Test creating Media resource for multimedia content management"""
        
        # Create the Media
        created_resource = await storage_engine.create_resource(
            "Media", 
            sample_media_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "Media"
        assert created_resource.get("status") == "completed"
        
        # Validate media details
        assert created_resource.get("subject", {}).get("reference") == "Patient/example-patient"
        assert created_resource.get("type", {}).get("coding", [{}])[0].get("code") == "image"
        
        # Validate content
        content = created_resource.get("content", {})
        assert content.get("contentType") == "image/jpeg"
        assert content.get("title") == "Chest X-ray - Lateral view"
        
        # Validate dimensions
        assert created_resource.get("height") == 1024
        assert created_resource.get("width") == 768

    async def test_search_media_by_patient(self, storage_engine, sample_media_data):
        """Test Media search by patient for patient media tracking"""
        
        # Create resource
        await storage_engine.create_resource("Media", sample_media_data)
        
        # Search by patient
        search_params = {"patient": "Patient/example-patient"}
        results = await storage_engine.search_resources("Media", search_params)
        
        # Validate search results
        assert len(results) > 0
        for result in results:
            assert result["subject"]["reference"] == "Patient/example-patient"

    async def test_search_media_by_type(self, storage_engine, sample_media_data):
        """Test Media search by type for media categorization"""
        
        # Create resource
        await storage_engine.create_resource("Media", sample_media_data)
        
        # Search by media type
        search_params = {"type": "http://terminology.hl7.org/CodeSystem/media-type|image"}
        results = await storage_engine.search_resources("Media", search_params)
        
        # Validate search results
        assert len(results) > 0

    async def test_search_media_by_modality(self, storage_engine, sample_media_data):
        """Test Media search by modality for imaging workflow"""
        
        # Create resource
        await storage_engine.create_resource("Media", sample_media_data)
        
        # Search by modality
        search_params = {"modality": "http://dicom.nema.org/resources/ontology/DCM|DX"}
        results = await storage_engine.search_resources("Media", search_params)
        
        # Validate search results
        assert len(results) > 0

    # =====================================================================
    # AuditEvent Resource Tests
    # =====================================================================

    async def test_create_audit_event(self, storage_engine, sample_audit_event_data):
        """Test creating AuditEvent resource for compliance tracking"""
        
        # Create the AuditEvent
        created_resource = await storage_engine.create_resource(
            "AuditEvent", 
            sample_audit_event_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "AuditEvent"
        assert created_resource.get("action") == "R"
        assert created_resource.get("outcome") == "0"
        
        # Validate audit details
        assert created_resource.get("recorded") == "2025-07-15T09:00:30Z"
        assert created_resource.get("outcomeDesc") == "Success"
        
        # Validate agents
        agents = created_resource.get("agent", [])
        assert len(agents) > 0
        assert agents[0]["who"]["reference"] == "Practitioner/example-practitioner"
        assert agents[0]["requestor"] is True
        
        # Validate entities
        entities = created_resource.get("entity", [])
        assert len(entities) > 0
        assert entities[0]["what"]["reference"] == "Patient/example-patient"

    async def test_search_audit_event_by_agent(self, storage_engine, sample_audit_event_data):
        """Test AuditEvent search by agent for user activity tracking"""
        
        # Create resource
        await storage_engine.create_resource("AuditEvent", sample_audit_event_data)
        
        # Search by agent
        search_params = {"agent": "Practitioner/example-practitioner"}
        results = await storage_engine.search_resources("AuditEvent", search_params)
        
        # Validate search results
        assert len(results) > 0

    async def test_search_audit_event_by_date(self, storage_engine, sample_audit_event_data):
        """Test AuditEvent search by date for audit log filtering"""
        
        # Create resource
        await storage_engine.create_resource("AuditEvent", sample_audit_event_data)
        
        # Search by date
        search_params = {"date": "2025-07-15"}
        results = await storage_engine.search_resources("AuditEvent", search_params)
        
        # Validate search results
        assert len(results) > 0

    async def test_search_audit_event_by_outcome(self, storage_engine, sample_audit_event_data):
        """Test AuditEvent search by outcome for security monitoring"""
        
        # Create successful and failed audit events
        success_audit = sample_audit_event_data.copy()
        success_audit["id"] = "success-audit"
        await storage_engine.create_resource("AuditEvent", success_audit)
        
        failed_audit = sample_audit_event_data.copy()
        failed_audit["id"] = "failed-audit"
        failed_audit["outcome"] = "4"
        failed_audit["outcomeDesc"] = "Minor failure"
        await storage_engine.create_resource("AuditEvent", failed_audit)
        
        # Search by outcome
        search_params = {"outcome": "0"}
        success_results = await storage_engine.search_resources("AuditEvent", search_params)
        
        # Validate outcome filtering
        assert len(success_results) > 0
        for result in success_results:
            assert result["outcome"] == "0"

    # =====================================================================
    # Cross-Resource Integration Tests
    # =====================================================================

    async def test_device_patient_integration(self, storage_engine, sample_device_data):
        """Test Device integration with Patient for equipment assignment"""
        
        # Create device assigned to patient
        device = await storage_engine.create_resource("Device", sample_device_data)
        
        # Validate patient assignment
        assert device["patient"]["reference"] == "Patient/example-patient"
        
        # Search for patient's devices
        search_params = {"patient": "Patient/example-patient"}
        patient_devices = await storage_engine.search_resources("Device", search_params)
        
        assert len(patient_devices) > 0
        device_found = any(d["id"] == device["id"] for d in patient_devices)
        assert device_found

    async def test_goal_condition_integration(self, storage_engine, sample_goal_data):
        """Test Goal integration with Condition for care planning"""
        
        # Create goal that addresses a condition
        goal = await storage_engine.create_resource("Goal", sample_goal_data)
        
        # Validate condition reference
        addresses = goal.get("addresses", [])
        assert len(addresses) > 0
        assert addresses[0]["reference"] == "Condition/mobility-limitation"

    async def test_media_imaging_integration(self, storage_engine, sample_media_data):
        """Test Media integration with imaging workflow"""
        
        # Create media that's part of imaging study
        media = await storage_engine.create_resource("Media", sample_media_data)
        
        # Validate imaging workflow integration
        based_on = media.get("basedOn", [])
        part_of = media.get("partOf", [])
        
        assert len(based_on) > 0
        assert based_on[0]["reference"] == "ServiceRequest/imaging-request-001"
        
        assert len(part_of) > 0
        assert part_of[0]["reference"] == "ImagingStudy/chest-xray-study-001"

    async def test_audit_security_workflow(self, storage_engine, sample_audit_event_data):
        """Test AuditEvent for security and compliance workflow"""
        
        # Create audit event for patient access
        audit = await storage_engine.create_resource("AuditEvent", sample_audit_event_data)
        
        # Validate security audit components
        assert audit["action"] == "R"  # Read action
        assert audit["outcome"] == "0"  # Success
        
        # Validate agent (user) information
        agent = audit["agent"][0]
        assert agent["who"]["reference"] == "Practitioner/example-practitioner"
        assert agent["requestor"] is True
        
        # Validate entity (patient) information
        entity = audit["entity"][0]
        assert entity["what"]["reference"] == "Patient/example-patient"
        assert entity["type"]["code"] == "1"  # Person type

    # =====================================================================
    # Workflow Integration Tests
    # =====================================================================

    async def test_device_maintenance_workflow(self, storage_engine, sample_device_data):
        """Test device maintenance and lifecycle workflow"""
        
        # Create active device
        device = await storage_engine.create_resource("Device", sample_device_data)
        assert device["status"] == "active"
        
        # Update device status for maintenance
        device["status"] = "inactive"
        device["statusReason"] = [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/device-status-reason",
                "code": "maintenance",
                "display": "Maintenance"
            }]
        }]
        
        updated_device = await storage_engine.update_resource("Device", device["id"], device)
        assert updated_device["status"] == "inactive"

    async def test_goal_achievement_workflow(self, storage_engine, sample_goal_data):
        """Test goal achievement tracking workflow"""
        
        # Create goal in progress
        goal = await storage_engine.create_resource("Goal", sample_goal_data)
        assert goal["achievementStatus"]["coding"][0]["code"] == "in-progress"
        
        # Update goal to achieved
        goal["achievementStatus"]["coding"][0]["code"] = "achieved"
        goal["lifecycleStatus"] = "completed"
        
        updated_goal = await storage_engine.update_resource("Goal", goal["id"], goal)
        assert updated_goal["achievementStatus"]["coding"][0]["code"] == "achieved"
        assert updated_goal["lifecycleStatus"] == "completed"

    # =====================================================================
    # Error Handling Tests
    # =====================================================================

    async def test_invalid_device_validation(self, storage_engine):
        """Test validation of invalid Device data"""
        
        # Test missing required status
        invalid_data = {
            "resourceType": "Device",
            "manufacturer": "ACME"
            # Missing required 'status' field
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Device", invalid_data)

    async def test_invalid_goal_validation(self, storage_engine):
        """Test validation of invalid Goal data"""
        
        # Test missing required fields
        invalid_data = {
            "resourceType": "Goal",
            "description": {"text": "Some goal"}
            # Missing required 'lifecycleStatus' and 'subject' fields
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Goal", invalid_data)

    async def test_invalid_media_validation(self, storage_engine):
        """Test validation of invalid Media data"""
        
        # Test missing required fields
        invalid_data = {
            "resourceType": "Media",
            "type": {"coding": [{"code": "image"}]}
            # Missing required 'status' and 'content' fields
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Media", invalid_data)

    # =====================================================================
    # SQL Validation Tests
    # =====================================================================

    async def test_supporting_resource_search_extraction(self, storage_engine, sample_device_data, 
                                                        sample_goal_data, sample_media_data, sample_audit_event_data):
        """Test that supporting resource search parameters are properly extracted"""
        
        # Create all supporting resources
        device = await storage_engine.create_resource("Device", sample_device_data)
        goal = await storage_engine.create_resource("Goal", sample_goal_data)
        media = await storage_engine.create_resource("Media", sample_media_data)
        audit = await storage_engine.create_resource("AuditEvent", sample_audit_event_data)
        
        # Test basic ID searches for all resources
        resources = [
            ("Device", device),
            ("Goal", goal), 
            ("Media", media),
            ("AuditEvent", audit)
        ]
        
        for resource_type, resource in resources:
            search_params = {"_id": resource["id"]}
            results = await storage_engine.search_resources(resource_type, search_params)
            assert len(results) == 1
            assert results[0]["id"] == resource["id"]


# =====================================================================
# Test Runner
# =====================================================================

if __name__ == "__main__":
    """Run Supporting Resources comprehensive tests"""
    
    async def run_tests():
        """Run all Supporting Resources tests"""
        test_instance = TestSupportingResourcesComprehensive()
        
        # Get storage engine
        async with async_session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Run key tests
            sample_device = test_instance.sample_device_data.__func__(test_instance)
            sample_goal = test_instance.sample_goal_data.__func__(test_instance)
            sample_media = test_instance.sample_media_data.__func__(test_instance)
            sample_audit = test_instance.sample_audit_event_data.__func__(test_instance)
            
            print("Running Supporting Resources comprehensive tests...")
            
            # Device tests
            await test_instance.test_create_device(storage_engine, sample_device)
            print("✓ Create Device test passed")
            
            await test_instance.test_search_device_by_patient(storage_engine, sample_device)
            print("✓ Search Device by patient test passed")
            
            # Goal tests
            await test_instance.test_create_goal(storage_engine, sample_goal)
            print("✓ Create Goal test passed")
            
            await test_instance.test_search_goal_by_patient(storage_engine, sample_goal)
            print("✓ Search Goal by patient test passed")
            
            # Media tests
            await test_instance.test_create_media(storage_engine, sample_media)
            print("✓ Create Media test passed")
            
            await test_instance.test_search_media_by_patient(storage_engine, sample_media)
            print("✓ Search Media by patient test passed")
            
            # AuditEvent tests
            await test_instance.test_create_audit_event(storage_engine, sample_audit)
            print("✓ Create AuditEvent test passed")
            
            await test_instance.test_search_audit_event_by_agent(storage_engine, sample_audit)
            print("✓ Search AuditEvent by agent test passed")
            
            # Integration tests
            await test_instance.test_device_patient_integration(storage_engine, sample_device)
            print("✓ Device-Patient integration test passed")
            
            await test_instance.test_audit_security_workflow(storage_engine, sample_audit)
            print("✓ Audit security workflow test passed")
            
            print("\nSupporting Resources comprehensive tests completed successfully!")
    
    # Run the tests
    asyncio.run(run_tests())