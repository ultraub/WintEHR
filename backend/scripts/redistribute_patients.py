#!/usr/bin/env python3
"""
Redistribute patients evenly among providers
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.database import DATABASE_URL
from models.synthea_models import Provider
from models.session import PatientProviderAssignment
from models.models import Patient
from datetime import datetime

def redistribute_patients():
    """Redistribute patients evenly among providers"""
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        # Get all patients and active providers
        patients = db.query(Patient).all()
        providers = db.query(Provider).filter(Provider.active == True).all()
        
        print(f"Found {len(patients)} patients and {len(providers)} active providers")
        
        if not providers:
            print("No active providers found!")
            return
        
        # Clear existing assignments
        existing_count = db.query(PatientProviderAssignment).count()
        if existing_count > 0:
            print(f"Clearing {existing_count} existing assignments...")
            db.query(PatientProviderAssignment).delete()
            db.commit()
        
        # Calculate patients per provider
        patients_per_provider = len(patients) // len(providers)
        remainder = len(patients) % len(providers)
        
        print(f"Each provider will get approximately {patients_per_provider} patients")
        
        # Sort providers by specialty - prioritize primary care
        primary_care_specialties = ['Primary Care', 'Internal Medicine', 'Family Medicine', 'General Practice']
        primary_providers = [p for p in providers if p.specialty in primary_care_specialties]
        other_providers = [p for p in providers if p not in primary_providers]
        
        # If no primary care providers, use all
        if not primary_providers:
            primary_providers = providers
            other_providers = []
        
        # Combine lists with primary care first
        sorted_providers = primary_providers + other_providers
        
        # Distribute patients
        patient_index = 0
        assignments_created = 0
        
        for i, provider in enumerate(sorted_providers):
            # Calculate how many patients this provider gets
            num_patients = patients_per_provider
            if i < remainder:
                num_patients += 1
            
            # Assign patients to this provider
            for j in range(num_patients):
                if patient_index < len(patients):
                    patient = patients[patient_index]
                    
                    assignment = PatientProviderAssignment(
                        patient_id=patient.id,
                        provider_id=provider.id,
                        assignment_type='primary',
                        start_date=datetime.utcnow(),
                        is_active=True
                    )
                    db.add(assignment)
                    assignments_created += 1
                    patient_index += 1
            
            if num_patients > 0:
                print(f"  Assigned {num_patients} patients to {provider.first_name} {provider.last_name} ({provider.specialty or 'No specialty'})")
        
        db.commit()
        print(f"\n✅ Successfully created {assignments_created} patient-provider assignments")
        
        # Show summary
        print("\nProvider assignment summary:")
        summary = db.execute("""
            SELECT p.first_name || ' ' || p.last_name as provider_name, 
                   p.specialty,
                   COUNT(ppa.patient_id) as patient_count 
            FROM providers p 
            LEFT JOIN patient_provider_assignments ppa ON p.id = ppa.provider_id AND ppa.is_active = 1 
            WHERE p.active = 1
            GROUP BY p.id, p.first_name, p.last_name, p.specialty
            ORDER BY patient_count DESC, provider_name
            LIMIT 10
        """).fetchall()
        
        for provider_name, specialty, count in summary:
            print(f"  {provider_name} ({specialty or 'No specialty'}): {count} patients")
        
        # Update encounters with provider assignments
        print("\nUpdating encounters with provider assignments...")
        from models.synthea_models import Encounter
        
        encounters_updated = 0
        encounters = db.query(Encounter).filter(Encounter.provider_id == None).all()
        
        for encounter in encounters:
            # Find the patient's primary provider
            assignment = db.query(PatientProviderAssignment).filter(
                PatientProviderAssignment.patient_id == encounter.patient_id,
                PatientProviderAssignment.assignment_type == 'primary',
                PatientProviderAssignment.is_active == True
            ).first()
            
            if assignment:
                encounter.provider_id = assignment.provider_id
                encounters_updated += 1
        
        db.commit()
        print(f"✅ Updated {encounters_updated} encounters with provider assignments")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 Redistributing Patients Among Providers")
    print("=" * 50)
    
    response = input("This will reassign ALL patients. Continue? (y/n): ")
    if response.lower() == 'y':
        redistribute_patients()
    else:
        print("Cancelled.")