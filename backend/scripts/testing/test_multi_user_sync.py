#!/usr/bin/env python3
"""
Test Multi-User WebSocket Synchronization

This script tests that real-time updates work across multiple users viewing the same patient.
It simulates two users connecting to the same patient and verifies updates are synchronized.

Usage:
    python test_multi_user_sync.py [patient_id]
"""

import asyncio
import json
import sys
import uuid
from datetime import datetime
import websockets
import httpx

# Configuration
BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/api/ws"
USERNAME1 = "nurse"
USERNAME2 = "demo"
PASSWORD = "password"

# Test patient ID (can be overridden via command line)
TEST_PATIENT_ID = sys.argv[1] if len(sys.argv) > 1 else None


async def login(username: str, password: str) -> str:
    """Login and get JWT token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": username, "password": password}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            raise Exception(f"Login failed for {username}: {response.text}")


async def get_first_patient() -> str:
    """Get the first available patient ID."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/api/fhir/R4/Patient?_count=1")
        if response.status_code == 200:
            bundle = response.json()
            if bundle.get("entry"):
                return bundle["entry"][0]["resource"]["id"]
    raise Exception("No patients found in the system")


async def simulate_user(user_id: str, username: str, token: str, patient_id: str, is_updater: bool):
    """Simulate a user connecting to WebSocket and subscribing to a patient."""
    uri = f"{WS_URL}?token={token}" if token else WS_URL
    
    async with websockets.connect(uri) as websocket:
        print(f"[{user_id}] Connected as {username}")
        
        # Subscribe to patient room
        subscription_id = f"sub-{user_id}-{uuid.uuid4().hex[:8]}"
        subscribe_message = {
            "type": "subscription",
            "data": {
                "subscription_id": subscription_id,
                "patient_ids": [patient_id],
                "resource_types": ["Condition", "MedicationRequest", "AllergyIntolerance"]
            }
        }
        
        await websocket.send(json.dumps(subscribe_message))
        print(f"[{user_id}] Subscribed to patient {patient_id}")
        
        # If this is the updater, create a condition after a delay
        if is_updater:
            await asyncio.sleep(2)  # Wait for other user to be ready
            
            # Create a test condition via API
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                
                condition_data = {
                    "resourceType": "Condition",
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "clinicalStatus": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                            "code": "active"
                        }]
                    },
                    "code": {
                        "coding": [{
                            "system": "http://snomed.info/sct",
                            "code": "84114007",
                            "display": "Heart failure"
                        }],
                        "text": "Test Condition - Multi-User Sync Test"
                    },
                    "onsetDateTime": datetime.utcnow().isoformat() + "Z",
                    "recordedDate": datetime.utcnow().isoformat() + "Z"
                }
                
                response = await client.post(
                    f"{BASE_URL}/api/fhir/R4/Condition",
                    json=condition_data,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    created_condition = response.json()
                    print(f"\n[{user_id}] Created condition: {created_condition['id']}")
                    print(f"[{user_id}] Other user should receive this update...")
                else:
                    print(f"[{user_id}] Failed to create condition: {response.text}")
        
        # Listen for updates
        update_received = False
        try:
            while True:
                message = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                data = json.loads(message)
                
                if data.get("type") == "update":
                    update_data = data.get("data", {})
                    print(f"\n[{user_id}] 🎉 Received update!")
                    print(f"[{user_id}] Action: {update_data.get('action')}")
                    print(f"[{user_id}] Resource Type: {update_data.get('resource_type')}")
                    print(f"[{user_id}] Resource ID: {update_data.get('resource_id')}")
                    print(f"[{user_id}] Patient ID: {update_data.get('patient_id')}")
                    
                    if update_data.get("resource"):
                        resource = update_data["resource"]
                        print(f"[{user_id}] Resource Text: {resource.get('code', {}).get('text', 'N/A')}")
                    
                    update_received = True
                    
                elif data.get("type") == "subscription":
                    print(f"[{user_id}] Subscription confirmed")
                    
        except asyncio.TimeoutError:
            if not is_updater and not update_received:
                print(f"\n[{user_id}] ⚠️  No update received within timeout!")
            elif is_updater:
                print(f"\n[{user_id}] Finished sending update")


async def main():
    """Run the multi-user synchronization test."""
    print("=== Multi-User WebSocket Synchronization Test ===\n")
    
    # Get patient ID
    patient_id = TEST_PATIENT_ID
    if not patient_id:
        print("No patient ID provided, fetching first available patient...")
        patient_id = await get_first_patient()
    
    print(f"Testing with patient ID: {patient_id}\n")
    
    # Login both users (handle development mode)
    try:
        token1 = await login(USERNAME1, PASSWORD)
        token2 = await login(USERNAME2, PASSWORD)
        print("JWT authentication enabled")
    except:
        print("JWT authentication disabled (development mode)")
        token1 = None
        token2 = None
    
    # Simulate both users
    user1_task = asyncio.create_task(
        simulate_user("User1", USERNAME1, token1, patient_id, is_updater=False)
    )
    user2_task = asyncio.create_task(
        simulate_user("User2", USERNAME2, token2, patient_id, is_updater=True)
    )
    
    # Wait for both to complete
    await asyncio.gather(user1_task, user2_task)
    
    print("\n=== Test Complete ===")
    print("\nExpected behavior:")
    print("- User1 subscribes to patient room and waits for updates")
    print("- User2 subscribes and creates a new condition")
    print("- User1 should receive the update automatically")
    print("\nIf User1 received the update, multi-user sync is working! 🎉")


if __name__ == "__main__":
    asyncio.run(main())