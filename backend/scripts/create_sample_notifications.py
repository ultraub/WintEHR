#!/usr/bin/env python3
"""Create sample FHIR Communication resources for testing notifications."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import uuid
from datetime import datetime, timedelta
import random
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
import json

# Database configuration
DATABASE_URL = "postgresql://medgenemr:medgenemr123@localhost/medgenemr"

# Sample notification templates
NOTIFICATION_TEMPLATES = [
    {
        "subject": "Lab Results Available",
        "message": "New lab results are available for patient {patient_name}. HbA1c: 7.2%",
        "priority": "routine",
        "category": "notification",
        "patient_related": True
    },
    {
        "subject": "Critical Lab Value",
        "message": "CRITICAL: Potassium level 6.8 mEq/L (High) for patient {patient_name}. Immediate action required.",
        "priority": "stat",
        "category": "alert",
        "patient_related": True
    },
    {
        "subject": "Medication Refill Request",
        "message": "Patient {patient_name} has requested a refill for Metformin 1000mg.",
        "priority": "routine",
        "category": "notification",
        "patient_related": True
    },
    {
        "subject": "Appointment Reminder",
        "message": "Reminder: Patient {patient_name} has an appointment tomorrow at 2:00 PM.",
        "priority": "routine",
        "category": "reminder",
        "patient_related": True
    },
    {
        "subject": "Task Assignment",
        "message": "You have been assigned a new task: Review imaging results for patient {patient_name}.",
        "priority": "asap",
        "category": "notification",
        "patient_related": True
    },
    {
        "subject": "System Maintenance",
        "message": "The EMR system will undergo scheduled maintenance on Sunday from 2:00 AM to 4:00 AM.",
        "priority": "routine",
        "category": "notification",
        "patient_related": False
    },
    {
        "subject": "New Clinical Guidelines",
        "message": "Updated diabetes management guidelines are now available in the clinical resources section.",
        "priority": "routine",
        "category": "notification",
        "patient_related": False
    },
    {
        "subject": "Abnormal Vital Signs",
        "message": "Alert: Blood pressure reading 180/110 mmHg for patient {patient_name}. Please review.",
        "priority": "urgent",
        "category": "alert",
        "patient_related": True
    }
]

def create_communication_resource(
    sender_id: str,
    recipient_id: str,
    subject: str,
    message: str,
    priority: str = "routine",
    category: str = "notification",
    patient_id: str = None,
    sent_time: datetime = None,
    is_read: bool = False
):
    """Create a FHIR Communication resource."""
    communication_id = str(uuid.uuid4())
    
    if sent_time is None:
        sent_time = datetime.utcnow()
    
    sent_time_str = sent_time.isoformat() + "Z"
    
    communication = {
        "resourceType": "Communication",
        "id": communication_id,
        "meta": {
            "lastUpdated": sent_time_str
        },
        "status": "completed",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                "code": category,
                "display": category.title()
            }]
        }],
        "priority": priority,
        "sent": sent_time_str,
        "received": sent_time_str if is_read else None,
        "recipient": [{
            "reference": f"Practitioner/{recipient_id}",
            "display": "Recipient"
        }],
        "sender": {
            "reference": f"Practitioner/{sender_id}" if sender_id != "system" else "Device/system",
            "display": "Sender"
        },
        "payload": [{
            "contentString": message
        }],
        "note": [{
            "text": subject
        }],
        "extension": [{
            "url": "http://medgenemr.com/fhir/StructureDefinition/notification-read",
            "valueBoolean": is_read
        }]
    }
    
    # Add patient reference if provided
    if patient_id:
        communication["subject"] = {
            "reference": f"Patient/{patient_id}",
            "display": "Patient"
        }
    
    return communication

def main():
    """Create sample notifications."""
    print("Creating sample notifications...")
    
    # Create database engine
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as db:
        # Get some providers to use as recipients
        providers_query = text("""
            SELECT id, first_name, last_name 
            FROM provider 
            WHERE active = true 
            LIMIT 10
        """)
        providers = db.execute(providers_query).fetchall()
        
        if not providers:
            print("No active providers found. Please run provider setup first.")
            return
        
        # Get some patients for patient-related notifications
        patients_query = text("""
            SELECT id, first_name, last_name 
            FROM patient 
            WHERE is_active = true 
            LIMIT 20
        """)
        patients = db.execute(patients_query).fetchall()
        
        if not patients:
            print("No active patients found. Please run patient setup first.")
            return
        
        # Create fhir schema and resources table if they don't exist
        db.execute(text("""
            CREATE SCHEMA IF NOT EXISTS fhir;
            
            CREATE TABLE IF NOT EXISTS fhir.resources (
                id UUID PRIMARY KEY,
                resource_type VARCHAR(50) NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_resources_type ON fhir.resources(resource_type);
            CREATE INDEX IF NOT EXISTS idx_resources_data ON fhir.resources USING GIN(data);
        """))
        db.commit()
        
        # Create notifications for each provider
        notifications_created = 0
        
        for provider in providers:
            provider_id = str(provider.id)
            provider_name = f"Dr. {provider.first_name} {provider.last_name}"
            
            # Create 3-8 notifications per provider
            num_notifications = random.randint(3, 8)
            
            for i in range(num_notifications):
                template = random.choice(NOTIFICATION_TEMPLATES)
                
                # Randomly select if this is from another provider or system
                if random.random() < 0.3:
                    sender_id = "system"
                else:
                    other_providers = [p for p in providers if str(p.id) != provider_id]
                    if other_providers:
                        sender = random.choice(other_providers)
                        sender_id = str(sender.id)
                    else:
                        sender_id = "system"
                
                # Prepare notification details
                subject = template["subject"]
                message = template["message"]
                
                # Add patient info if needed
                patient_id = None
                if template["patient_related"] and patients:
                    patient = random.choice(patients)
                    patient_id = str(patient.id)
                    patient_name = f"{patient.first_name} {patient.last_name}"
                    message = message.format(patient_name=patient_name)
                
                # Random time in the last 7 days
                hours_ago = random.randint(0, 168)
                sent_time = datetime.utcnow() - timedelta(hours=hours_ago)
                
                # 70% chance of being read if older than 24 hours
                is_read = False
                if hours_ago > 24:
                    is_read = random.random() < 0.7
                
                # Create the Communication resource
                communication = create_communication_resource(
                    sender_id=sender_id,
                    recipient_id=provider_id,
                    subject=subject,
                    message=message,
                    priority=template["priority"],
                    category=template["category"],
                    patient_id=patient_id,
                    sent_time=sent_time,
                    is_read=is_read
                )
                
                # Insert into database
                insert_query = text("""
                    INSERT INTO fhir.resources (id, resource_type, data, created_at, updated_at)
                    VALUES (:id, :resource_type, :data, :created_at, :updated_at)
                """)
                
                db.execute(insert_query, {
                    "id": uuid.UUID(communication["id"]),
                    "resource_type": "Communication",
                    "data": json.dumps(communication),
                    "created_at": sent_time,
                    "updated_at": sent_time
                })
                
                notifications_created += 1
        
        db.commit()
        print(f"Created {notifications_created} sample notifications")
        
        # Show summary
        summary_query = text("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE data->'extension' @> '[{"url": "http://medgenemr.com/fhir/StructureDefinition/notification-read", "valueBoolean": false}]') as unread
            FROM fhir.resources
            WHERE resource_type = 'Communication'
        """)
        
        result = db.execute(summary_query).fetchone()
        print(f"\nNotification Summary:")
        print(f"Total notifications: {result.total}")
        print(f"Unread notifications: {result.unread}")
        print(f"Read notifications: {result.total - result.unread}")

if __name__ == "__main__":
    main()