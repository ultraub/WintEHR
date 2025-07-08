#!/usr/bin/env python3
"""
Assign patients to providers to fix the provider-patient linking issue
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
import random
from datetime import datetime
import logging


def assign_patients_to_providers():
    """Create patient-provider assignments"""
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        # Get all patients and providers
        patients = db.query(Patient).all()
        providers = db.query(Provider).filter(Provider.active == True).all()
        
        logging.info(f"Found {len(patients)} patients and {len(providers)} active providers")
        if not providers:
            logging.info("No active providers found!")
            return
        
        # Check if assignments already exist
        existing_assignments = db.query(PatientProviderAssignment).count()
        if existing_assignments > 0:
            logging.info(f"Found {existing_assignments} existing assignments")
            response = input("Do you want to delete existing assignments and recreate? (y/n): ")
            if response.lower() == 'y':
                db.query(PatientProviderAssignment).delete()
                db.commit()
                logging.info("Deleted existing assignments")
            else:
                logging.info("Keeping existing assignments")
                return
        
        # Assign patients to providers
        assignments_created = 0
        
        # Group providers by specialty for better assignment
        primary_care_providers = [p for p in providers if p.specialty in ['Primary Care', 'Internal Medicine', 'Family Medicine', 'General Practice']]
        specialist_providers = [p for p in providers if p not in primary_care_providers]
        
        # If no primary care providers, use all providers
        if not primary_care_providers:
            primary_care_providers = providers
        
        logging.info(f"Found {len(primary_care_providers)} primary care providers")
        for patient in patients:
            # Assign a primary care provider to each patient
            primary_provider = random.choice(primary_care_providers)
            
            assignment = PatientProviderAssignment(
                patient_id=patient.id,
                provider_id=primary_provider.id,
                assignment_type='primary',
                start_date=datetime.utcnow(),
                is_active=True
            )
            db.add(assignment)
            assignments_created += 1
            
            # Randomly assign some specialists (20% chance for each patient)
            if specialist_providers and random.random() < 0.2:
                specialist = random.choice(specialist_providers)
                specialist_assignment = PatientProviderAssignment(
                    patient_id=patient.id,
                    provider_id=specialist.id,
                    assignment_type='specialist',
                    start_date=datetime.utcnow(),
                    is_active=True
                )
                db.add(specialist_assignment)
                assignments_created += 1
        
        db.commit()
        logging.info(f"✅ Successfully created {assignments_created} patient-provider assignments")
        # Also update encounters to have provider_id
        logging.info("\nUpdating encounters with provider assignments...")
        encounters_updated = 0
        
        # Get all encounters without providers
        from models.synthea_models import Encounter
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
        logging.info(f"✅ Updated {encounters_updated} encounters with provider assignments")
    except Exception as e:
        logging.error(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    logging.info("🔗 Assigning Patients to Providers")
    logging.info("=" * 50)
    assign_patients_to_providers()