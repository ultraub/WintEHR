#!/usr/bin/env python3
"""
Create sample providers script
Creates realistic healthcare providers for the EMR system
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine
from models.models import Provider, Organization
import uuid

def create_sample_providers():
    """Create sample healthcare providers"""
    print("🏥 Creating Sample Healthcare Providers")
    print("=" * 50)
    
    with SessionLocal() as session:
        # Create main organization
        main_org = Organization(
            name="General Hospital",
            type="Hospital",
            address="123 Medical Center Drive",
            city="Boston",
            state="MA",
            zip_code="02101",
            phone="(617) 555-0100"
        )
        session.add(main_org)
        session.flush()
        
        # Create clinic organization
        clinic_org = Organization(
            name="Family Medicine Clinic",
            type="Clinic",
            address="456 Health Street",
            city="Boston",
            state="MA", 
            zip_code="02102",
            phone="(617) 555-0200"
        )
        session.add(clinic_org)
        session.flush()
        
        # Provider data
        providers_data = [
            # Primary Care
            {"first": "John", "last": "Smith", "specialty": "Family Medicine", "org": main_org.id},
            {"first": "Sarah", "last": "Johnson", "specialty": "Internal Medicine", "org": main_org.id},
            {"first": "Michael", "last": "Brown", "specialty": "Family Medicine", "org": clinic_org.id},
            {"first": "Emily", "last": "Davis", "specialty": "Internal Medicine", "org": clinic_org.id},
            {"first": "David", "last": "Wilson", "specialty": "Family Medicine", "org": main_org.id},
            
            # Specialists
            {"first": "Lisa", "last": "Anderson", "specialty": "Cardiology", "org": main_org.id},
            {"first": "Robert", "last": "Taylor", "specialty": "Endocrinology", "org": main_org.id},
            {"first": "Jennifer", "last": "Miller", "specialty": "Dermatology", "org": main_org.id},
            {"first": "Christopher", "last": "Garcia", "specialty": "Neurology", "org": main_org.id},
            {"first": "Amanda", "last": "Martinez", "specialty": "Pulmonology", "org": main_org.id},
            
            # Emergency and Hospital
            {"first": "Mark", "last": "Rodriguez", "specialty": "Emergency Medicine", "org": main_org.id},
            {"first": "Jessica", "last": "Lopez", "specialty": "Emergency Medicine", "org": main_org.id},
            {"first": "Daniel", "last": "Gonzalez", "specialty": "Hospitalist", "org": main_org.id},
            {"first": "Ashley", "last": "Hernandez", "specialty": "Hospitalist", "org": main_org.id},
            {"first": "James", "last": "Young", "specialty": "Critical Care", "org": main_org.id},
            
            # Surgical
            {"first": "Michelle", "last": "King", "specialty": "General Surgery", "org": main_org.id},
            {"first": "Kevin", "last": "Wright", "specialty": "Orthopedic Surgery", "org": main_org.id},
            {"first": "Nicole", "last": "Hill", "specialty": "Obstetrics and Gynecology", "org": main_org.id},
            {"first": "Ryan", "last": "Green", "specialty": "Urology", "org": main_org.id},
            {"first": "Rachel", "last": "Adams", "specialty": "Ophthalmology", "org": main_org.id},
        ]
        
        providers_created = 0
        
        for i, provider_data in enumerate(providers_data):
            # Generate NPI (10-digit number)
            npi = f"123456{i:04d}"
            
            provider = Provider(
                npi=npi,
                first_name=provider_data["first"],
                last_name=provider_data["last"],
                specialty=provider_data["specialty"],
                organization_id=provider_data["org"],
                phone=f"(617) 555-{1000 + i:04d}",
                email=f"{provider_data['first'].lower()}.{provider_data['last'].lower()}@hospital.org",
                active=True
            )
            
            session.add(provider)
            providers_created += 1
        
        session.commit()
        print(f"✓ Created {providers_created} sample providers")
        print(f"✓ Created 2 healthcare organizations")
        print("✓ Sample provider creation completed successfully")

if __name__ == "__main__":
    create_sample_providers()