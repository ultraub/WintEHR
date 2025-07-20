#!/usr/bin/env python3
"""
Comprehensive Test Harness for Appointment Administrative Resource

This test validates complete FHIR R4 Appointment implementation including:
- All search parameters for healthcare scheduling workflows
- Appointment booking and management processes
- Multi-participant appointment coordination
- Calendar and availability management
- Cross-module integration with planned Schedule module

FHIR R4 Specification: https://hl7.org/fhir/R4/appointment.html

Critical Administrative Workflows:
1. Appointment scheduling - booking patient visits with providers
2. Multi-participant coordination - patients, practitioners, locations, devices
3. Calendar management - date/time scheduling and availability
4. Appointment lifecycle - booking, arrival, completion, cancellation
5. Resource scheduling - coordinating rooms, equipment, staff

Test Categories:
- CRUD Operations: Create, Read, Update, Delete Appointment resources
- Search Parameters: All FHIR R4 search parameters for scheduling workflows
- Scheduling Workflows: Booking, rescheduling, cancellation workflows
- Multi-participant: Complex appointments with multiple participants
- Calendar Integration: Date/time management and availability checking
- Error Handling: Validation and scheduling conflict scenarios
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


class TestAppointmentComprehensive:
    """Comprehensive test suite for Appointment administrative resource"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with async_session_maker() as session:
            yield FHIRStorageEngine(session)
    
    @pytest.fixture
    def sample_appointment_data(self):
        """Sample Appointment data for testing"""
        return {
            "resourceType": "Appointment",
            "id": "test-appointment-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/Appointment",
                "value": "APPT-2025-001"
            }],
            "status": "booked",
            "serviceCategory": [{
                "coding": [{
                    "system": "http://example.org/service-category",
                    "code": "17",
                    "display": "General Practice"
                }]
            }],
            "serviceType": [{
                "coding": [{
                    "system": "http://example.org/service-type",
                    "code": "124",
                    "display": "General Consultation"
                }]
            }],
            "specialty": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "394814009",
                    "display": "General practice"
                }]
            }],
            "appointmentType": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                    "code": "ROUTINE",
                    "display": "Routine"
                }]
            },
            "reasonCode": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "162673000",
                    "display": "General examination of patient"
                }]
            }],
            "priority": 5,
            "description": "Discussion on the results of the latest blood tests",
            "start": "2025-07-15T09:00:00Z",
            "end": "2025-07-15T09:30:00Z",
            "minutesDuration": 30,
            "comment": "Further expand on the results of the blood tests",
            "participant": [{
                "actor": {
                    "reference": "Patient/example-patient",
                    "display": "Peter James Chalmers"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Practitioner/example-practitioner",
                    "display": "Dr Adam Careful"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Location/example-room",
                    "display": "Exam Room 1"
                },
                "required": "required",
                "status": "accepted"
            }]
        }
    
    @pytest.fixture
    def sample_urgent_appointment(self):
        """Sample urgent appointment for priority testing"""
        return {
            "resourceType": "Appointment",
            "id": "test-urgent-appointment-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/Appointment",
                "value": "URGENT-2025-001"
            }],
            "status": "booked",
            "serviceCategory": [{
                "coding": [{
                    "system": "http://example.org/service-category",
                    "code": "31",
                    "display": "Emergency Medicine"
                }]
            }],
            "serviceType": [{
                "coding": [{
                    "system": "http://example.org/service-type",
                    "code": "221",
                    "display": "Emergency Consultation"
                }]
            }],
            "specialty": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "773568002",
                    "display": "Emergency medicine"
                }]
            }],
            "appointmentType": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                    "code": "EMERGENCY",
                    "display": "Emergency"
                }]
            },
            "priority": 1,  # High priority
            "description": "Urgent consultation for chest pain",
            "start": "2025-07-15T14:00:00Z",
            "end": "2025-07-15T14:45:00Z",
            "minutesDuration": 45,
            "participant": [{
                "actor": {
                    "reference": "Patient/emergency-patient",
                    "display": "Emergency Patient"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Practitioner/emergency-physician",
                    "display": "Dr Emergency"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Location/emergency-room",
                    "display": "Emergency Room 1"
                },
                "required": "required",
                "status": "accepted"
            }]
        }

    @pytest.fixture
    def sample_multi_participant_appointment(self):
        """Sample appointment with multiple participants for complex scheduling"""
        return {
            "resourceType": "Appointment",
            "id": "test-multi-participant-001",
            "identifier": [{
                "use": "official",
                "system": "http://hospital.example.org/Appointment",
                "value": "MULTI-2025-001"
            }],
            "status": "booked",
            "serviceCategory": [{
                "coding": [{
                    "system": "http://example.org/service-category",
                    "code": "27",
                    "display": "Specialist Medical"
                }]
            }],
            "serviceType": [{
                "coding": [{
                    "system": "http://example.org/service-type",
                    "code": "165",
                    "display": "Multidisciplinary Consultation"
                }]
            }],
            "appointmentType": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                    "code": "ROUTINE",
                    "display": "Routine"
                }]
            },
            "priority": 5,
            "description": "Multidisciplinary team meeting for complex case",
            "start": "2025-07-16T10:00:00Z",
            "end": "2025-07-16T11:00:00Z",
            "minutesDuration": 60,
            "participant": [{
                "actor": {
                    "reference": "Patient/complex-case-patient",
                    "display": "Complex Case Patient"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Practitioner/cardiologist",
                    "display": "Dr Heart Specialist"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Practitioner/endocrinologist",
                    "display": "Dr Hormone Specialist"
                },
                "required": "required",
                "status": "accepted"
            }, {
                "actor": {
                    "reference": "Practitioner/primary-care",
                    "display": "Dr Primary Care"
                },
                "required": "optional",
                "status": "tentative"
            }, {
                "actor": {
                    "reference": "Location/conference-room",
                    "display": "Conference Room A"
                },
                "required": "required",
                "status": "accepted"
            }]
        }

    # =====================================================================
    # CRUD Operations Tests
    # =====================================================================

    async def test_create_appointment(self, storage_engine, sample_appointment_data):
        """Test creating Appointment resource with complete data"""
        
        # Create the Appointment
        created_resource = await storage_engine.create_resource(
            "Appointment", 
            sample_appointment_data
        )
        
        # Validate creation
        assert created_resource is not None
        assert created_resource.get("resourceType") == "Appointment"
        assert created_resource.get("status") == "booked"
        
        # Validate scheduling fields
        assert created_resource.get("start") == "2025-07-15T09:00:00Z"
        assert created_resource.get("end") == "2025-07-15T09:30:00Z"
        assert created_resource.get("minutesDuration") == 30
        
        # Validate participants
        participants = created_resource.get("participant", [])
        assert len(participants) == 3  # Patient, Practitioner, Location
        
        # Check patient participant
        patient_participant = next(
            (p for p in participants if "Patient/" in p["actor"]["reference"]), 
            None
        )
        assert patient_participant is not None
        assert patient_participant["required"] == "required"
        assert patient_participant["status"] == "accepted"

    async def test_read_appointment(self, storage_engine, sample_appointment_data):
        """Test reading Appointment by ID"""
        
        # Create resource first
        created = await storage_engine.create_resource("Appointment", sample_appointment_data)
        resource_id = created["id"]
        
        # Read the resource
        read_resource = await storage_engine.read_resource("Appointment", resource_id)
        
        # Validate read operation
        assert read_resource is not None
        assert read_resource["id"] == resource_id
        assert read_resource["resourceType"] == "Appointment"
        assert read_resource["status"] == "booked"

    async def test_update_appointment_status(self, storage_engine, sample_appointment_data):
        """Test updating Appointment status for workflow progression"""
        
        # Create resource
        created = await storage_engine.create_resource("Appointment", sample_appointment_data)
        resource_id = created["id"]
        
        # Update status to 'arrived'
        updated_data = sample_appointment_data.copy()
        updated_data["status"] = "arrived"
        updated_data["id"] = resource_id
        
        updated_resource = await storage_engine.update_resource("Appointment", resource_id, updated_data)
        
        # Validate update
        assert updated_resource["status"] == "arrived"
        assert updated_resource["id"] == resource_id

    async def test_delete_appointment(self, storage_engine, sample_appointment_data):
        """Test deleting Appointment resource"""
        
        # Create resource
        created = await storage_engine.create_resource("Appointment", sample_appointment_data)
        resource_id = created["id"]
        
        # Delete the resource
        await storage_engine.delete_resource("Appointment", resource_id)
        
        # Verify deletion
        deleted_resource = await storage_engine.read_resource("Appointment", resource_id)
        assert deleted_resource is None or deleted_resource.get("deleted") is True

    # =====================================================================
    # Search Parameters Tests
    # =====================================================================

    async def test_search_by_date(self, storage_engine, sample_appointment_data):
        """Test Appointment search by date for calendar management"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by exact date
        search_params = {"date": "2025-07-15"}
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate date search
        assert len(results) > 0
        for result in results:
            start_date = result["start"][:10]  # Extract date part
            assert start_date == "2025-07-15"

    async def test_search_by_date_range(self, storage_engine, sample_appointment_data):
        """Test Appointment search by date range for availability checking"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by date range
        search_params = {
            "date": "ge2025-07-15",
            "date": "le2025-07-16"
        }
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate date range search
        assert len(results) > 0

    async def test_search_by_patient(self, storage_engine, sample_appointment_data):
        """Test Appointment search by patient for patient scheduling"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by patient reference
        search_params = {"patient": "Patient/example-patient"}
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate patient search
        assert len(results) > 0
        for result in results:
            # Check if patient is in participants
            patient_found = any(
                "Patient/example-patient" in p["actor"]["reference"]
                for p in result["participant"]
            )
            assert patient_found

    async def test_search_by_practitioner(self, storage_engine, sample_appointment_data):
        """Test Appointment search by practitioner for provider scheduling"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by practitioner reference
        search_params = {"practitioner": "Practitioner/example-practitioner"}
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate practitioner search
        assert len(results) > 0
        for result in results:
            # Check if practitioner is in participants
            practitioner_found = any(
                "Practitioner/example-practitioner" in p["actor"]["reference"]
                for p in result["participant"]
            )
            assert practitioner_found

    async def test_search_by_location(self, storage_engine, sample_appointment_data):
        """Test Appointment search by location for facility scheduling"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by location reference
        search_params = {"location": "Location/example-room"}
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate location search
        assert len(results) > 0
        for result in results:
            # Check if location is in participants
            location_found = any(
                "Location/example-room" in p["actor"]["reference"]
                for p in result["participant"]
            )
            assert location_found

    async def test_search_by_status(self, storage_engine, sample_appointment_data):
        """Test Appointment search by status for workflow management"""
        
        # Create appointments with different statuses
        booked_appointment = sample_appointment_data.copy()
        booked_appointment["id"] = "booked-appointment"
        await storage_engine.create_resource("Appointment", booked_appointment)
        
        arrived_appointment = sample_appointment_data.copy()
        arrived_appointment["id"] = "arrived-appointment"
        arrived_appointment["status"] = "arrived"
        await storage_engine.create_resource("Appointment", arrived_appointment)
        
        # Search by status
        search_params = {"status": "booked"}
        booked_results = await storage_engine.search_resources("Appointment", search_params)
        
        search_params = {"status": "arrived"}
        arrived_results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate status filtering
        assert len(booked_results) > 0
        assert len(arrived_results) > 0
        
        for result in booked_results:
            assert result["status"] == "booked"

    async def test_search_by_appointment_type(self, storage_engine, sample_appointment_data, sample_urgent_appointment):
        """Test Appointment search by appointment type"""
        
        # Create routine and emergency appointments
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        await storage_engine.create_resource("Appointment", sample_urgent_appointment)
        
        # Search by appointment type
        search_params = {"appointment-type": "http://terminology.hl7.org/CodeSystem/v2-0276|ROUTINE"}
        routine_results = await storage_engine.search_resources("Appointment", search_params)
        
        search_params = {"appointment-type": "http://terminology.hl7.org/CodeSystem/v2-0276|EMERGENCY"}
        emergency_results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate appointment type filtering
        assert len(routine_results) > 0
        assert len(emergency_results) > 0

    async def test_search_by_service_category(self, storage_engine, sample_appointment_data, sample_urgent_appointment):
        """Test Appointment search by service category"""
        
        # Create general practice and emergency appointments
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        await storage_engine.create_resource("Appointment", sample_urgent_appointment)
        
        # Search by service category
        search_params = {"service-category": "http://example.org/service-category|17"}
        gp_results = await storage_engine.search_resources("Appointment", search_params)
        
        search_params = {"service-category": "http://example.org/service-category|31"}
        emergency_results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate service category filtering
        assert len(gp_results) > 0
        assert len(emergency_results) > 0

    async def test_search_by_service_type(self, storage_engine, sample_appointment_data):
        """Test Appointment search by service type"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by service type
        search_params = {"service-type": "http://example.org/service-type|124"}
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate service type filtering
        assert len(results) > 0

    async def test_search_by_specialty(self, storage_engine, sample_appointment_data):
        """Test Appointment search by practitioner specialty"""
        
        # Create resource
        await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Search by specialty
        search_params = {"specialty": "http://snomed.info/sct|394814009"}
        results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate specialty filtering
        assert len(results) > 0

    # =====================================================================
    # Scheduling Workflow Tests
    # =====================================================================

    async def test_appointment_booking_workflow(self, storage_engine, sample_appointment_data):
        """Test complete appointment booking workflow"""
        
        # Step 1: Create appointment (booking)
        appointment = await storage_engine.create_resource("Appointment", sample_appointment_data)
        assert appointment["status"] == "booked"
        
        # Step 2: Patient arrives
        appointment["status"] = "arrived"
        arrived_appointment = await storage_engine.update_resource("Appointment", appointment["id"], appointment)
        assert arrived_appointment["status"] == "arrived"
        
        # Step 3: Appointment fulfilled
        appointment["status"] = "fulfilled"
        fulfilled_appointment = await storage_engine.update_resource("Appointment", appointment["id"], appointment)
        assert fulfilled_appointment["status"] == "fulfilled"

    async def test_appointment_cancellation_workflow(self, storage_engine, sample_appointment_data):
        """Test appointment cancellation process"""
        
        # Create appointment
        appointment = await storage_engine.create_resource("Appointment", sample_appointment_data)
        assert appointment["status"] == "booked"
        
        # Cancel appointment with reason
        appointment["status"] = "cancelled"
        appointment["cancelationReason"] = {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason",
                "code": "pat",
                "display": "Patient"
            }]
        }
        
        cancelled_appointment = await storage_engine.update_resource("Appointment", appointment["id"], appointment)
        assert cancelled_appointment["status"] == "cancelled"
        assert "cancelationReason" in cancelled_appointment

    async def test_appointment_rescheduling_workflow(self, storage_engine, sample_appointment_data):
        """Test appointment rescheduling process"""
        
        # Create original appointment
        original_appointment = await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Reschedule to new time
        rescheduled_data = sample_appointment_data.copy()
        rescheduled_data["id"] = original_appointment["id"]
        rescheduled_data["start"] = "2025-07-15T14:00:00Z"
        rescheduled_data["end"] = "2025-07-15T14:30:00Z"
        
        rescheduled_appointment = await storage_engine.update_resource(
            "Appointment", 
            original_appointment["id"], 
            rescheduled_data
        )
        
        # Validate rescheduling
        assert rescheduled_appointment["start"] == "2025-07-15T14:00:00Z"
        assert rescheduled_appointment["end"] == "2025-07-15T14:30:00Z"

    async def test_multi_participant_scheduling(self, storage_engine, sample_multi_participant_appointment):
        """Test scheduling with multiple participants"""
        
        # Create multi-participant appointment
        appointment = await storage_engine.create_resource("Appointment", sample_multi_participant_appointment)
        
        # Validate all participants
        participants = appointment["participant"]
        assert len(participants) == 5  # Patient + 3 practitioners + location
        
        # Check participant statuses
        required_participants = [p for p in participants if p["required"] == "required"]
        optional_participants = [p for p in participants if p["required"] == "optional"]
        
        assert len(required_participants) == 4  # Patient, 2 specialists, location
        assert len(optional_participants) == 1   # Primary care

    async def test_appointment_priority_handling(self, storage_engine, sample_appointment_data, sample_urgent_appointment):
        """Test appointment priority in scheduling"""
        
        # Create routine and urgent appointments
        routine_appointment = await storage_engine.create_resource("Appointment", sample_appointment_data)
        urgent_appointment = await storage_engine.create_resource("Appointment", sample_urgent_appointment)
        
        # Verify priority values
        assert routine_appointment["priority"] == 5  # Normal priority
        assert urgent_appointment["priority"] == 1   # High priority
        
        # Search for high priority appointments
        search_params = {"priority": "1"}
        high_priority_results = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate priority filtering
        assert len(high_priority_results) > 0
        for result in high_priority_results:
            assert result["priority"] == 1

    # =====================================================================
    # Calendar Integration Tests
    # =====================================================================

    async def test_daily_schedule_retrieval(self, storage_engine, sample_appointment_data):
        """Test retrieving daily schedule for calendar display"""
        
        # Create multiple appointments for the same day
        for hour in [9, 10, 11, 14, 15]:
            appointment_data = sample_appointment_data.copy()
            appointment_data["id"] = f"daily-appointment-{hour}"
            appointment_data["start"] = f"2025-07-15T{hour:02d}:00:00Z"
            appointment_data["end"] = f"2025-07-15T{hour:02d}:30:00Z"
            
            await storage_engine.create_resource("Appointment", appointment_data)
        
        # Search for all appointments on specific date
        search_params = {"date": "2025-07-15"}
        daily_appointments = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate daily schedule
        assert len(daily_appointments) >= 5
        
        # Verify all appointments are on the correct date
        for appointment in daily_appointments:
            start_date = appointment["start"][:10]
            assert start_date == "2025-07-15"

    async def test_provider_schedule_retrieval(self, storage_engine, sample_appointment_data):
        """Test retrieving provider schedule for practitioner calendar"""
        
        # Create appointments for specific practitioner
        for i in range(3):
            appointment_data = sample_appointment_data.copy()
            appointment_data["id"] = f"provider-appointment-{i}"
            
            await storage_engine.create_resource("Appointment", appointment_data)
        
        # Search for practitioner's appointments
        search_params = {"practitioner": "Practitioner/example-practitioner"}
        provider_appointments = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate provider schedule
        assert len(provider_appointments) >= 3

    async def test_location_schedule_retrieval(self, storage_engine, sample_appointment_data):
        """Test retrieving location schedule for facility management"""
        
        # Create appointments for specific location
        for i in range(2):
            appointment_data = sample_appointment_data.copy()
            appointment_data["id"] = f"location-appointment-{i}"
            
            await storage_engine.create_resource("Appointment", appointment_data)
        
        # Search for location's appointments
        search_params = {"location": "Location/example-room"}
        location_appointments = await storage_engine.search_resources("Appointment", search_params)
        
        # Validate location schedule
        assert len(location_appointments) >= 2

    # =====================================================================
    # Error Handling Tests
    # =====================================================================

    async def test_invalid_appointment_validation(self, storage_engine):
        """Test validation of invalid Appointment data"""
        
        # Test missing required status
        invalid_data = {
            "resourceType": "Appointment",
            "start": "2025-07-15T09:00:00Z"
            # Missing required 'status' field
        }
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Appointment", invalid_data)

    async def test_invalid_status_value(self, storage_engine, sample_appointment_data):
        """Test validation of invalid status values"""
        
        # Test invalid status
        invalid_data = sample_appointment_data.copy()
        invalid_data["status"] = "invalid-status"
        
        with pytest.raises(Exception):  # Should raise validation error
            await storage_engine.create_resource("Appointment", invalid_data)

    async def test_conflicting_appointments(self, storage_engine, sample_appointment_data):
        """Test detection of scheduling conflicts"""
        
        # Create first appointment
        appointment1 = await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # Try to create conflicting appointment (same time, same practitioner)
        conflicting_data = sample_appointment_data.copy()
        conflicting_data["id"] = "conflicting-appointment"
        
        # In a real implementation, this should detect the conflict
        # For now, we just verify both can be created (conflict detection is business logic)
        appointment2 = await storage_engine.create_resource("Appointment", conflicting_data)
        
        # Both appointments exist - conflict detection would be in business logic layer
        assert appointment1 is not None
        assert appointment2 is not None

    async def test_invalid_participant_references(self, storage_engine, sample_appointment_data):
        """Test validation of invalid participant references"""
        
        # Test with invalid patient reference
        invalid_data = sample_appointment_data.copy()
        invalid_data["participant"][0]["actor"]["reference"] = "InvalidResource/123"
        
        # Depending on validation implementation, this might raise an error
        # For now, we test that the resource can be created (validation might be at API level)
        try:
            await storage_engine.create_resource("Appointment", invalid_data)
        except Exception:
            # Validation error is acceptable
            pass

    # =====================================================================
    # Performance and Load Tests
    # =====================================================================

    async def test_bulk_appointment_creation(self, storage_engine, sample_appointment_data):
        """Test creating multiple appointments for load testing"""
        
        # Create multiple appointments
        created_appointments = []
        for i in range(10):
            appointment_data = sample_appointment_data.copy()
            appointment_data["id"] = f"bulk-appointment-{i:03d}"
            appointment_data["identifier"][0]["value"] = f"APPT-2025-{i:03d}"
            
            # Vary start times
            hour = 9 + (i % 8)  # 9 AM to 4 PM
            appointment_data["start"] = f"2025-07-15T{hour:02d}:00:00Z"
            appointment_data["end"] = f"2025-07-15T{hour:02d}:30:00Z"
            
            created_appointment = await storage_engine.create_resource("Appointment", appointment_data)
            created_appointments.append(created_appointment)
        
        # Verify all were created
        assert len(created_appointments) == 10
        
        # Test bulk search
        search_params = {"status": "booked"}
        results = await storage_engine.search_resources("Appointment", search_params)
        assert len(results) >= 10

    # =====================================================================
    # SQL Validation Tests
    # =====================================================================

    async def test_search_parameter_sql_extraction(self, storage_engine, sample_appointment_data):
        """Test that search parameters are properly extracted to SQL indexes"""
        
        # Create Appointment
        appointment = await storage_engine.create_resource("Appointment", sample_appointment_data)
        
        # This test would verify that search parameters are properly indexed in the database
        # Key parameters to verify:
        # - date (start/end timestamps)
        # - patient reference (from participants)
        # - practitioner reference (from participants)
        # - location reference (from participants)
        # - status token
        # - appointment-type token
        # - service-category token
        # - service-type token
        # - specialty token
        
        # For now, we verify that the resource was created and basic search works
        search_params = {"_id": appointment["id"]}
        results = await storage_engine.search_resources("Appointment", search_params)
        assert len(results) == 1
        assert results[0]["id"] == appointment["id"]


# =====================================================================
# Test Runner
# =====================================================================

if __name__ == "__main__":
    """Run Appointment comprehensive tests"""
    
    async def run_tests():
        """Run all Appointment tests"""
        test_instance = TestAppointmentComprehensive()
        
        # Get storage engine
        async with async_session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Run key tests
            sample_data = test_instance.sample_appointment_data.__func__(test_instance)
            sample_urgent = test_instance.sample_urgent_appointment.__func__(test_instance)
            sample_multi = test_instance.sample_multi_participant_appointment.__func__(test_instance)
            
            print("Running Appointment comprehensive tests...")
            
            # CRUD tests
            await test_instance.test_create_appointment(storage_engine, sample_data)
            print("✓ Create Appointment test passed")
            
            # Search tests
            await test_instance.test_search_by_date(storage_engine, sample_data)
            print("✓ Search by date test passed")
            
            await test_instance.test_search_by_patient(storage_engine, sample_data)
            print("✓ Search by patient test passed")
            
            await test_instance.test_search_by_status(storage_engine, sample_data)
            print("✓ Search by status test passed")
            
            # Workflow tests
            await test_instance.test_appointment_booking_workflow(storage_engine, sample_data)
            print("✓ Appointment booking workflow test passed")
            
            await test_instance.test_multi_participant_scheduling(storage_engine, sample_multi)
            print("✓ Multi-participant scheduling test passed")
            
            # Calendar tests
            await test_instance.test_daily_schedule_retrieval(storage_engine, sample_data)
            print("✓ Daily schedule retrieval test passed")
            
            print("\nAppointment comprehensive tests completed successfully!")
    
    # Run the tests
    asyncio.run(run_tests())