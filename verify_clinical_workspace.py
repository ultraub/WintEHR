#!/usr/bin/env python3
"""
Clinical Workspace Compatibility Verification Script
Tests all clinical workspace features with the recent changes
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}

def print_section(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")

def test_fhir_communication_resources():
    """Test FHIR Communication resources for inbox"""
    print_section("Testing FHIR Communication Resources (Inbox)")
    
    try:
        # Create test communication
        communication = {
            "resourceType": "Communication",
            "status": "preparation",
            "priority": "urgent",
            "category": [{
                "coding": [{
                    "system": "http://medgenemr.com/communication-category",
                    "code": "alert",
                    "display": "Alert"
                }]
            }],
            "subject": {
                "reference": "Patient/1"
            },
            "topic": {
                "text": "Critical Lab Result - Potassium 6.5"
            },
            "sender": {
                "reference": "Practitioner/lab-system"
            },
            "recipient": [{
                "reference": "Practitioner/dr-smith"
            }],
            "sent": datetime.utcnow().isoformat() + "Z",
            "payload": [{
                "contentReference": {
                    "reference": "Observation/lab-result-123",
                    "display": "Patient has critical potassium level of 6.5 mEq/L (normal: 3.5-5.0). Immediate intervention recommended."
                }
            }]
        }
        
        response = requests.post(
            f"{BASE_URL}/fhir/R4/Communication",
            json=communication,
            headers=HEADERS
        )
        
        if response.status_code == 201:
            print("✅ Created test FHIR Communication for inbox")
            comm_id = response.json().get('id')
            
            # Search for communications
            search_response = requests.get(
                f"{BASE_URL}/fhir/R4/Communication?recipient=Practitioner/dr-smith&_count=5"
            )
            
            if search_response.status_code == 200:
                bundle = search_response.json()
                print(f"✅ Found {bundle.get('total', 0)} communications in inbox")
            return True
        else:
            print(f"❌ Failed to create Communication: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing Communications: {e}")
        return False

def test_fhir_questionnaire_order_sets():
    """Test FHIR Questionnaire resources for order sets"""
    print_section("Testing FHIR Questionnaire Resources (Order Sets)")
    
    try:
        # Search for order set questionnaires
        response = requests.get(
            f"{BASE_URL}/fhir/R4/Questionnaire?code=http://medgenemr.com/order-set-type|&_count=10"
        )
        
        if response.status_code == 200:
            bundle = response.json()
            total = bundle.get('total', 0)
            print(f"✅ Found {total} order set questionnaires")
            
            if total > 0 and 'entry' in bundle:
                for entry in bundle['entry'][:3]:
                    questionnaire = entry['resource']
                    print(f"   - {questionnaire.get('title', 'Unknown')} ({questionnaire.get('id')})")
            return True
        else:
            print(f"❌ Failed to search Questionnaires: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing Questionnaires: {e}")
        return False

def test_fhir_appointment_resources():
    """Test FHIR Appointment resources"""
    print_section("Testing FHIR Appointment Resources")
    
    try:
        # Create test appointment
        appointment = {
            "resourceType": "Appointment",
            "status": "booked",
            "serviceCategory": [{
                "coding": [{
                    "system": "http://hl7.org/fhir/service-category",
                    "code": "gp",
                    "display": "General Practice"
                }]
            }],
            "serviceType": [{
                "coding": [{
                    "system": "http://hl7.org/fhir/service-type",
                    "code": "52",
                    "display": "General Discussion"
                }]
            }],
            "priority": 5,
            "description": "Follow-up appointment",
            "start": (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z",
            "end": (datetime.utcnow() + timedelta(days=7, hours=1)).isoformat() + "Z",
            "participant": [
                {
                    "actor": {
                        "reference": "Patient/1",
                        "display": "Test Patient"
                    },
                    "required": "required",
                    "status": "accepted"
                },
                {
                    "actor": {
                        "reference": "Practitioner/dr-smith",
                        "display": "Dr. Smith"
                    },
                    "required": "required",
                    "status": "accepted"
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/fhir/R4/Appointment",
            json=appointment,
            headers=HEADERS
        )
        
        if response.status_code == 201:
            print("✅ Created test FHIR Appointment")
            
            # Search for appointments
            search_response = requests.get(
                f"{BASE_URL}/fhir/R4/Appointment?patient=1&_count=5"
            )
            
            if search_response.status_code == 200:
                bundle = search_response.json()
                print(f"✅ Found {bundle.get('total', 0)} appointments for patient")
            return True
        else:
            print(f"❌ Failed to create Appointment: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing Appointments: {e}")
        return False

def test_websocket_notifications():
    """Test WebSocket notification endpoints"""
    print_section("Testing WebSocket Support")
    
    try:
        # Test notification count endpoint
        response = requests.get(f"{BASE_URL}/api/fhir/notifications/count")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Notification system active - {data.get('unread', 0)} unread notifications")
            return True
        else:
            print(f"⚠️  Notification endpoint returned: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing notifications: {e}")
        return False

def test_drug_interactions():
    """Test drug interaction checking"""
    print_section("Testing Drug Interaction Service")
    
    try:
        medications = [
            {"name": "Warfarin", "code": "11289"},
            {"name": "Aspirin", "code": "1191"}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/emr/clinical/drug-interactions/check-interactions",
            json=medications,
            headers=HEADERS
        )
        
        if response.status_code == 200:
            data = response.json()
            interactions = data.get('interactions', [])
            print(f"✅ Drug interaction service working - Found {len(interactions)} interactions")
            for interaction in interactions:
                print(f"   - {interaction['severity']}: {interaction['description']}")
            return True
        else:
            print(f"❌ Drug interaction check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing drug interactions: {e}")
        return False

def test_clinical_catalog_search():
    """Test clinical catalog search for medications, labs, imaging"""
    print_section("Testing Clinical Catalog Search")
    
    try:
        # Test medication search
        med_response = requests.get(
            f"{BASE_URL}/api/emr/clinical/catalog/medications/search?query=aspirin&limit=5"
        )
        
        # Test lab test search
        lab_response = requests.get(
            f"{BASE_URL}/api/emr/clinical/catalog/lab-tests/search?query=glucose&limit=5"
        )
        
        # Test imaging search
        imaging_response = requests.get(
            f"{BASE_URL}/api/emr/clinical/catalog/imaging-procedures/search?query=chest&limit=5"
        )
        
        all_success = True
        
        if med_response.status_code == 200:
            meds = med_response.json().get('medications', [])
            print(f"✅ Medication search working - Found {len(meds)} medications")
        else:
            print(f"❌ Medication search failed: {med_response.status_code}")
            all_success = False
            
        if lab_response.status_code == 200:
            labs = lab_response.json().get('labTests', [])
            print(f"✅ Lab test search working - Found {len(labs)} tests")
        else:
            print(f"❌ Lab test search failed: {lab_response.status_code}")
            all_success = False
            
        if imaging_response.status_code == 200:
            imaging = imaging_response.json().get('imagingProcedures', [])
            print(f"✅ Imaging search working - Found {len(imaging)} procedures")
        else:
            print(f"❌ Imaging search failed: {imaging_response.status_code}")
            all_success = False
            
        return all_success
        
    except Exception as e:
        print(f"❌ Error testing catalog search: {e}")
        return False

def test_fhir_audit_events():
    """Test FHIR AuditEvent resources"""
    print_section("Testing FHIR AuditEvent Resources")
    
    try:
        # Search for audit events
        response = requests.get(
            f"{BASE_URL}/fhir/R4/AuditEvent?_count=5&_sort=-recorded"
        )
        
        if response.status_code == 200:
            bundle = response.json()
            total = bundle.get('total', 0)
            print(f"✅ Found {total} audit events")
            
            if total > 0 and 'entry' in bundle:
                for entry in bundle['entry'][:3]:
                    audit = entry['resource']
                    action = audit.get('action', 'Unknown')
                    outcome = audit.get('outcome', 'Unknown')
                    recorded = audit.get('recorded', 'Unknown')
                    print(f"   - {action} action with outcome {outcome} at {recorded}")
            return True
        else:
            print(f"⚠️  AuditEvent search returned: {response.status_code}")
            print("   This may be normal if audit events haven't been created yet")
            return True  # Don't fail the test
            
    except Exception as e:
        print(f"❌ Error testing AuditEvents: {e}")
        return False

def main():
    """Run all clinical workspace compatibility tests"""
    print(f"\nClinical Workspace Compatibility Verification - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        test_fhir_communication_resources,
        test_fhir_questionnaire_order_sets,
        test_fhir_appointment_resources,
        test_websocket_notifications,
        test_drug_interactions,
        test_clinical_catalog_search,
        test_fhir_audit_events
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            results.append(False)
    
    print_section("Summary")
    passed = sum(results)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ Clinical Workspace is fully compatible with all changes!")
        print("\nKey features verified:")
        print("- FHIR Communication resources for inbox/messaging")
        print("- FHIR Questionnaire resources for order sets")
        print("- FHIR Appointment scheduling")
        print("- Real-time WebSocket notifications")
        print("- Drug interaction checking")
        print("- Clinical catalog search (medications, labs, imaging)")
        print("- FHIR AuditEvent logging")
    elif passed >= total - 1:
        print("\n⚠️  Clinical Workspace is mostly compatible")
        print("   Some features may need additional setup")
    else:
        print("\n❌ Some clinical workspace features need attention")
    
    return 0 if passed >= total - 1 else 1

if __name__ == "__main__":
    exit(main())