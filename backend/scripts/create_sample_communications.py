#!/usr/bin/env python3
"""
Create sample FHIR Communication resources for testing inbox functionality.
"""

import asyncio
import json
from datetime import datetime, timedelta
import httpx
import random

FHIR_BASE_URL = "http://localhost:8000/fhir/R4"

# Sample communication templates
COMMUNICATION_TEMPLATES = [
    {
        "category": "alert",
        "priority": "urgent",
        "topic": "Abnormal Lab Result",
        "content": "Patient has critically high potassium level (6.2 mEq/L). Please review immediately.",
        "reason": "Lab result outside critical range"
    },
    {
        "category": "reminder",
        "priority": "routine",
        "topic": "Medication Refill Due",
        "content": "Patient's Lisinopril prescription expires in 7 days. Consider refill authorization.",
        "reason": "Medication refill reminder"
    },
    {
        "category": "notification",
        "priority": "routine",
        "topic": "Appointment Scheduled",
        "content": "Follow-up appointment scheduled for next Tuesday at 2:00 PM.",
        "reason": "Appointment notification"
    },
    {
        "category": "alert",
        "priority": "asap",
        "topic": "Prior Authorization Required",
        "content": "Insurance requires prior authorization for MRI. Form attached for completion.",
        "reason": "Insurance requirement"
    },
    {
        "category": "instruction",
        "priority": "routine",
        "topic": "Post-Procedure Instructions",
        "content": "Patient discharged after cardiac catheterization. Please review discharge instructions and follow-up plan.",
        "reason": "Post-procedure care"
    }
]

async def get_practitioners():
    """Get list of practitioners from FHIR server."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{FHIR_BASE_URL}/Practitioner")
        if response.status_code == 200:
            bundle = response.json()
            return [entry['resource'] for entry in bundle.get('entry', [])]
    return []

async def get_patients():
    """Get list of patients from FHIR server."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{FHIR_BASE_URL}/Patient?_count=10")
        if response.status_code == 200:
            bundle = response.json()
            return [entry['resource'] for entry in bundle.get('entry', [])]
    return []

async def create_communication(sender_id, recipient_id, patient_id, template, days_ago=0):
    """Create a single communication resource."""
    sent_time = datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
    
    communication = {
        "resourceType": "Communication",
        "status": "preparation" if days_ago < 2 else "completed",  # Recent messages are unread
        "priority": template["priority"],
        "category": [{
            "coding": [{
                "system": "http://medgenemr.com/communication-category",
                "code": template["category"],
                "display": template["category"].title()
            }]
        }],
        "subject": {
            "reference": f"Patient/{patient_id}"
        },
        "topic": {
            "text": template["topic"]
        },
        "sender": {
            "reference": f"Practitioner/{sender_id}"
        },
        "recipient": [{
            "reference": f"Practitioner/{recipient_id}"
        }],
        "sent": sent_time.isoformat() + "Z",
        "payload": [{
            "contentReference": {
                "display": template["content"]
            }
        }]
    }
    
    # If message is "read", add received timestamp
    if communication["status"] == "completed":
        communication["received"] = (sent_time + timedelta(hours=random.randint(1, 4))).isoformat() + "Z"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{FHIR_BASE_URL}/Communication",
            json=communication,
            headers={"Content-Type": "application/fhir+json"}
        )
        if response.status_code in [200, 201]:
            print(f"✅ Created {template['category']} communication: {template['topic']}")
            try:
                return response.json()
            except:
                return {"status": "created"}
        else:
            print(f"❌ Failed to create communication: {response.status_code}")
            print(response.text)
    return None

async def main():
    """Create sample communications."""
    print("🏥 Creating Sample FHIR Communications")
    print("=" * 60)
    
    # Get practitioners and patients
    practitioners = await get_practitioners()
    patients = await get_patients()
    
    if not practitioners:
        print("❌ No practitioners found. Please create some practitioners first.")
        return
    
    if not patients:
        print("❌ No patients found. Please import some patients first.")
        return
    
    print(f"Found {len(practitioners)} practitioners and {len(patients)} patients")
    
    # Create communications for each practitioner
    created_count = 0
    for practitioner in practitioners[:3]:  # Limit to first 3 practitioners
        recipient_id = practitioner['id']
        print(f"\nCreating messages for {practitioner.get('name', [{}])[0].get('text', 'Unknown')}...")
        
        # Create 5-10 messages per practitioner
        num_messages = random.randint(5, 10)
        for i in range(num_messages):
            # Pick random template, sender, and patient
            template = random.choice(COMMUNICATION_TEMPLATES)
            sender_id = random.choice([p['id'] for p in practitioners if p['id'] != recipient_id])
            patient_id = random.choice([p['id'] for p in patients])
            days_ago = random.randint(0, 7)
            
            result = await create_communication(
                sender_id, 
                recipient_id, 
                patient_id, 
                template, 
                days_ago
            )
            if result:
                created_count += 1
    
    print(f"\n✅ Created {created_count} sample communications")

if __name__ == "__main__":
    asyncio.run(main())