#!/usr/bin/env python3
"""
Consolidated Sample Data Creation Script

Creates various types of sample data for testing and development:
- Sample patients (without Synthea)
- Sample providers
- Sample communications and notifications
- Other test data

This script consolidates functionality from multiple separate scripts.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import random
import uuid

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import logging


# Load environment
load_dotenv()

class SampleDataGenerator:
    """Generate various types of sample data."""
    
    def __init__(self):
        # Setup database connection
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@localhost:5432/emr_db')
        self.engine = create_engine(DATABASE_URL.replace('+asyncpg', ''))
        
    def create_sample_patients(self, count=5):
        """Create sample patients without using Synthea."""
        logging.info(f"Creating {count} sample patients...")
        # Sample data
        first_names = ["John", "Jane", "Michael", "Sarah", "David", "Emily", "Robert", "Lisa"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
        
        patients = []
        for i in range(count):
            patient_data = {
                "resourceType": "Patient",
                "id": str(uuid.uuid4()),
                "identifier": [{
                    "system": "http://hospital.example.org/mrn",
                    "value": f"MRN{1000 + i}"
                }],
                "name": [{
                    "family": random.choice(last_names),
                    "given": [random.choice(first_names)]
                }],
                "gender": random.choice(["male", "female"]),
                "birthDate": f"{random.randint(1940, 2020)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
            }
            patients.append(patient_data)
            
        # Save using FHIR API
        import requests
        base_url = "http://localhost:8000/fhir/R4"
        
        created = 0
        for patient in patients:
            try:
                response = requests.post(f"{base_url}/Patient", json=patient)
                if response.status_code == 201:
                    created += 1
            except:
                pass
                
        logging.info(f"✅ Created {created} sample patients")
    def create_sample_providers(self, count=10):
        """Create sample healthcare providers."""
        logging.info(f"Creating {count} sample providers...")
        specialties = [
            "Internal Medicine", "Cardiology", "Pediatrics", "Emergency Medicine",
            "Family Medicine", "Psychiatry", "Surgery", "Obstetrics and Gynecology",
            "Orthopedics", "Neurology"
        ]
        
        first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
        
        providers = []
        for i in range(count):
            provider_data = {
                "resourceType": "Practitioner",
                "id": str(uuid.uuid4()),
                "identifier": [{
                    "system": "http://hl7.org/fhir/sid/us-npi",
                    "value": f"{1000000000 + i}"
                }],
                "name": [{
                    "family": random.choice(last_names),
                    "given": [random.choice(first_names)],
                    "prefix": ["Dr."]
                }],
                "qualification": [{
                    "code": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v3-SpecialtyType",
                            "code": random.choice(specialties).lower().replace(" ", "_"),
                            "display": random.choice(specialties)
                        }]
                    }
                }]
            }
            providers.append(provider_data)
            
        # Save using FHIR API
        import requests
        base_url = "http://localhost:8000/fhir/R4"
        
        created = 0
        for provider in providers:
            try:
                response = requests.post(f"{base_url}/Practitioner", json=provider)
                if response.status_code == 201:
                    created += 1
            except:
                pass
                
        logging.info(f"✅ Created {created} sample providers")
    def create_sample_communications(self, count=5):
        """Create sample communications for testing inbox functionality."""
        logging.info(f"Creating {count} sample communications...")
        topics = [
            "Lab results available",
            "Prescription refill request",
            "Appointment reminder",
            "Test results review",
            "Follow-up needed"
        ]
        
        communications = []
        for i in range(count):
            comm_data = {
                "resourceType": "Communication",
                "id": str(uuid.uuid4()),
                "status": random.choice(["preparation", "in-progress", "completed"]),
                "category": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/communication-category",
                        "code": "notification",
                        "display": "Notification"
                    }]
                }],
                "subject": {
                    "reference": "Patient/example",
                    "display": "Example Patient"
                },
                "topic": {
                    "text": random.choice(topics)
                },
                "sent": datetime.utcnow().isoformat() + "Z"
            }
            communications.append(comm_data)
            
        # Save using FHIR API
        import requests
        base_url = "http://localhost:8000/fhir/R4"
        
        created = 0
        for comm in communications:
            try:
                response = requests.post(f"{base_url}/Communication", json=comm)
                if response.status_code == 201:
                    created += 1
            except:
                pass
                
        logging.info(f"✅ Created {created} sample communications")
def main():
    parser = argparse.ArgumentParser(description="Generate sample data for MedGenEMR")
    parser.add_argument('--patients', type=int, default=0, help='Number of sample patients to create')
    parser.add_argument('--providers', type=int, default=0, help='Number of sample providers to create')
    parser.add_argument('--communications', type=int, default=0, help='Number of sample communications to create')
    parser.add_argument('--all', action='store_true', help='Create all types of sample data')
    
    args = parser.parse_args()
    
    generator = SampleDataGenerator()
    
    if args.all:
        generator.create_sample_patients(5)
        generator.create_sample_providers(10)
        generator.create_sample_communications(5)
    else:
        if args.patients > 0:
            generator.create_sample_patients(args.patients)
        if args.providers > 0:
            generator.create_sample_providers(args.providers)
        if args.communications > 0:
            generator.create_sample_communications(args.communications)
            
    if not any([args.all, args.patients, args.providers, args.communications]):
        logging.info("No data type specified. Use --help for options.")
if __name__ == "__main__":
    main()