#!/usr/bin/env python3
"""
WebSocket Real-time Updates Test Suite
Tests FHIR resource changes propagated through WebSocket
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import websockets

class WebSocketRealtimeTest:
    def __init__(self, base_url: str = "http://localhost:8000", ws_url: str = "ws://localhost:8000/api/ws"):
        self.base_url = base_url
        self.ws_url = ws_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.test_results: List[Dict] = []
        self.patient_id: Optional[str] = None
        self.auth_token: Optional[str] = None
        self.received_messages: List[Dict] = []
        
    async def setup(self):
        """Setup test session and authenticate"""
        self.session = aiohttp.ClientSession()
        
        # Login first
        try:
            auth_data = {
                "username": "demo",
                "password": "password"
            }
            async with self.session.post(
                f"{self.base_url}/api/auth/login",
                json=auth_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.auth_token = result.get("access_token")
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    print("✅ Authentication successful")
                else:
                    print(f"❌ Authentication failed: {response.status}")
                    return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
            
        # Get a test patient
        try:
            async with self.session.get(f"{self.base_url}/fhir/R4/Patient?_count=1") as response:
                if response.status == 200:
                    bundle = await response.json()
                    if bundle.get("entry"):
                        self.patient_id = bundle["entry"][0]["resource"]["id"]
                        patient_name = bundle["entry"][0]["resource"].get("name", [{}])[0]
                        display_name = f"{patient_name.get('given', [''])[0]} {patient_name.get('family', '')}"
                        print(f"✅ Using test patient: {display_name} (ID: {self.patient_id})")
                        return True
        except Exception as e:
            print(f"❌ Error getting test patient: {e}")
            
        return False
        
    async def connect_websocket(self):
        """Connect to WebSocket endpoint"""
        try:
            # Connect to WebSocket
            self.websocket = await websockets.connect(self.ws_url)
            
            # Send authentication
            auth_message = {
                "type": "authenticate",
                "token": self.auth_token
            }
            await self.websocket.send(json.dumps(auth_message))
            
            # Wait for auth response
            response = await self.websocket.recv()
            auth_response = json.loads(response)
            
            if auth_response.get("type") == "authenticated":
                print("✅ WebSocket authenticated")
                return True
            else:
                print(f"❌ WebSocket authentication failed: {auth_response}")
                return False
        except Exception as e:
            print(f"❌ WebSocket connection error: {e}")
            return False
            
    async def subscribe_to_patient(self):
        """Subscribe to patient-specific updates"""
        if not self.websocket:
            return False
            
        try:
            subscribe_message = {
                "type": "subscribe",
                "channel": "patient-updates",
                "resourceTypes": ["Condition", "MedicationRequest", "Observation", "ServiceRequest"],
                "patientIds": [self.patient_id]
            }
            await self.websocket.send(json.dumps(subscribe_message))
            print(f"✅ Subscribed to updates for patient {self.patient_id}")
            return True
        except Exception as e:
            print(f"❌ Subscription error: {e}")
            return False
            
    async def listen_for_messages(self, duration: int = 5):
        """Listen for WebSocket messages for specified duration"""
        if not self.websocket:
            return
            
        self.received_messages = []
        end_time = time.time() + duration
        
        try:
            while time.time() < end_time:
                try:
                    message = await asyncio.wait_for(
                        self.websocket.recv(),
                        timeout=1.0
                    )
                    data = json.loads(message)
                    self.received_messages.append(data)
                    print(f"📨 Received: {data.get('type', 'unknown')} - {data.get('action', '')}")
                except asyncio.TimeoutError:
                    continue
        except Exception as e:
            print(f"❌ Error listening for messages: {e}")
            
    async def teardown(self):
        """Cleanup test session and WebSocket"""
        if self.websocket:
            await self.websocket.close()
        if self.session:
            await self.session.close()
            
    def log_test(self, test_name: str, passed: bool, details: str = "", duration: float = 0):
        """Log test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "duration": duration
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name} ({duration:.3f}s)")
        if details:
            print(f"   {details}")
            
    async def test_resource_create_notification(self):
        """Test that creating a resource sends WebSocket notification"""
        print("\n📝 Testing Resource Create Notifications...")
        start_time = time.time()
        
        # Start listening in background
        listen_task = asyncio.create_task(self.listen_for_messages(duration=3))
        
        # Wait a moment for listener to start
        await asyncio.sleep(0.5)
        
        # Create a new condition
        condition_data = {
            "resourceType": "Condition",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "386661006",
                    "display": "Fever"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "onsetDateTime": datetime.utcnow().isoformat() + "Z"
        }
        
        created_id = None
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Condition",
                json=condition_data
            ) as response:
                if response.status == 201:
                    created_condition = await response.json()
                    created_id = created_condition.get("id")
                    print(f"   Created Condition ID: {created_id}")
        except Exception as e:
            print(f"   Error creating condition: {e}")
            
        # Wait for messages
        await listen_task
        
        # Check if we received a create notification
        create_messages = [
            msg for msg in self.received_messages 
            if msg.get("action") == "create" and 
               msg.get("resourceType") == "Condition"
        ]
        
        if create_messages:
            self.log_test(
                "Resource Create Notification",
                True,
                f"Received {len(create_messages)} create notification(s)",
                time.time() - start_time
            )
        else:
            self.log_test(
                "Resource Create Notification",
                False,
                "No create notification received",
                time.time() - start_time
            )
            
        # Cleanup - delete the created resource
        if created_id:
            try:
                await self.session.delete(f"{self.base_url}/fhir/R4/Condition/{created_id}")
            except:
                pass
                
    async def test_resource_update_notification(self):
        """Test that updating a resource sends WebSocket notification"""
        print("\n✏️ Testing Resource Update Notifications...")
        start_time = time.time()
        
        # First create a resource
        medication_request = {
            "resourceType": "MedicationRequest",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "coding": [{
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "1049683",
                    "display": "Acetaminophen 325 MG Oral Tablet"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "authoredOn": datetime.utcnow().isoformat() + "Z"
        }
        
        created_id = None
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/MedicationRequest",
                json=medication_request
            ) as response:
                if response.status == 201:
                    created_med = await response.json()
                    created_id = created_med.get("id")
                    
                    # Clear previous messages
                    self.received_messages = []
                    
                    # Start listening
                    listen_task = asyncio.create_task(self.listen_for_messages(duration=3))
                    await asyncio.sleep(0.5)
                    
                    # Update the resource
                    updated_med = created_med.copy()
                    updated_med["status"] = "completed"
                    
                    async with self.session.put(
                        f"{self.base_url}/fhir/R4/MedicationRequest/{created_id}",
                        json=updated_med
                    ) as update_response:
                        if update_response.status == 200:
                            print(f"   Updated MedicationRequest ID: {created_id}")
                            
                    # Wait for messages
                    await listen_task
                    
                    # Check for update notification
                    update_messages = [
                        msg for msg in self.received_messages 
                        if msg.get("action") == "update" and 
                           msg.get("resourceType") == "MedicationRequest"
                    ]
                    
                    if update_messages:
                        self.log_test(
                            "Resource Update Notification",
                            True,
                            f"Received {len(update_messages)} update notification(s)",
                            time.time() - start_time
                        )
                    else:
                        self.log_test(
                            "Resource Update Notification",
                            False,
                            "No update notification received",
                            time.time() - start_time
                        )
        except Exception as e:
            self.log_test(
                "Resource Update Notification",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
        # Cleanup
        if created_id:
            try:
                await self.session.delete(f"{self.base_url}/fhir/R4/MedicationRequest/{created_id}")
            except:
                pass
                
    async def test_resource_delete_notification(self):
        """Test that deleting a resource sends WebSocket notification"""
        print("\n🗑️ Testing Resource Delete Notifications...")
        start_time = time.time()
        
        # First create a resource
        observation_data = {
            "resourceType": "Observation",
            "status": "final",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "8310-5",
                    "display": "Body temperature"
                }]
            },
            "subject": {
                "reference": f"Patient/{self.patient_id}"
            },
            "effectiveDateTime": datetime.utcnow().isoformat() + "Z",
            "valueQuantity": {
                "value": 98.6,
                "unit": "degF",
                "system": "http://unitsofmeasure.org"
            }
        }
        
        created_id = None
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Observation",
                json=observation_data
            ) as response:
                if response.status == 201:
                    created_obs = await response.json()
                    created_id = created_obs.get("id")
                    
                    # Clear previous messages
                    self.received_messages = []
                    
                    # Start listening
                    listen_task = asyncio.create_task(self.listen_for_messages(duration=3))
                    await asyncio.sleep(0.5)
                    
                    # Delete the resource
                    async with self.session.delete(
                        f"{self.base_url}/fhir/R4/Observation/{created_id}"
                    ) as delete_response:
                        if delete_response.status == 204:
                            print(f"   Deleted Observation ID: {created_id}")
                            
                    # Wait for messages
                    await listen_task
                    
                    # Check for delete notification
                    delete_messages = [
                        msg for msg in self.received_messages 
                        if msg.get("action") == "delete" and 
                           msg.get("resourceType") == "Observation"
                    ]
                    
                    if delete_messages:
                        self.log_test(
                            "Resource Delete Notification",
                            True,
                            f"Received {len(delete_messages)} delete notification(s)",
                            time.time() - start_time
                        )
                    else:
                        self.log_test(
                            "Resource Delete Notification",
                            False,
                            "No delete notification received",
                            time.time() - start_time
                        )
        except Exception as e:
            self.log_test(
                "Resource Delete Notification",
                False,
                f"Error: {str(e)}",
                time.time() - start_time
            )
            
    async def test_cross_patient_isolation(self):
        """Test that notifications are properly isolated by patient"""
        print("\n🔒 Testing Cross-Patient Isolation...")
        start_time = time.time()
        
        # Get a different patient
        other_patient_id = None
        try:
            async with self.session.get(
                f"{self.base_url}/fhir/R4/Patient?_count=2"
            ) as response:
                if response.status == 200:
                    bundle = await response.json()
                    patients = [e["resource"]["id"] for e in bundle.get("entry", [])]
                    other_patients = [p for p in patients if p != self.patient_id]
                    if other_patients:
                        other_patient_id = other_patients[0]
                        print(f"   Using other patient ID: {other_patient_id}")
        except Exception as e:
            print(f"   Could not get other patient: {e}")
            
        if not other_patient_id:
            self.log_test(
                "Cross-Patient Isolation",
                False,
                "Could not find another patient for testing",
                time.time() - start_time
            )
            return
            
        # Clear messages and start listening
        self.received_messages = []
        listen_task = asyncio.create_task(self.listen_for_messages(duration=3))
        await asyncio.sleep(0.5)
        
        # Create resource for OTHER patient
        condition_data = {
            "resourceType": "Condition",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active"
                }]
            },
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "25064002",
                    "display": "Headache"
                }]
            },
            "subject": {
                "reference": f"Patient/{other_patient_id}"
            }
        }
        
        created_id = None
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Condition",
                json=condition_data
            ) as response:
                if response.status == 201:
                    created_condition = await response.json()
                    created_id = created_condition.get("id")
                    print(f"   Created condition for other patient")
        except Exception as e:
            print(f"   Error creating condition: {e}")
            
        # Wait for messages
        await listen_task
        
        # Check that we DID NOT receive notification for other patient
        other_patient_messages = [
            msg for msg in self.received_messages 
            if msg.get("resourceType") == "Condition" and
               msg.get("resource", {}).get("subject", {}).get("reference") == f"Patient/{other_patient_id}"
        ]
        
        if not other_patient_messages:
            self.log_test(
                "Cross-Patient Isolation",
                True,
                "No notifications received for other patient's resources",
                time.time() - start_time
            )
        else:
            self.log_test(
                "Cross-Patient Isolation",
                False,
                f"Received {len(other_patient_messages)} notification(s) for other patient",
                time.time() - start_time
            )
            
        # Cleanup
        if created_id:
            try:
                await self.session.delete(f"{self.base_url}/fhir/R4/Condition/{created_id}")
            except:
                pass
                
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 WEBSOCKET REAL-TIME TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["passed"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"   - {result['test']}: {result['details']}")
                    
        total_duration = sum(r["duration"] for r in self.test_results)
        avg_duration = total_duration / total_tests if total_tests > 0 else 0
        print(f"\nTotal Duration: {total_duration:.3f}s")
        print(f"Average Duration: {avg_duration:.3f}s per test")

async def main():
    """Run all WebSocket real-time tests"""
    print("🏥 MedGenEMR WebSocket Real-time Updates Testing")
    print("="*60)
    
    tester = WebSocketRealtimeTest()
    
    # Setup
    if not await tester.setup():
        print("❌ Failed to setup test environment")
        return
        
    # Connect WebSocket
    if not await tester.connect_websocket():
        print("❌ Failed to connect WebSocket")
        await tester.teardown()
        return
        
    # Subscribe to patient updates
    if not await tester.subscribe_to_patient():
        print("❌ Failed to subscribe to patient updates")
        await tester.teardown()
        return
        
    # Run all tests
    try:
        await tester.test_resource_create_notification()
        await tester.test_resource_update_notification()
        await tester.test_resource_delete_notification()
        await tester.test_cross_patient_isolation()
    finally:
        # Cleanup
        await tester.teardown()
        
    # Print summary
    tester.print_summary()

if __name__ == "__main__":
    asyncio.run(main())