#!/usr/bin/env python3
"""
Automated patient-provider assignment script for deployment
Ensures all patients have at least one provider and distributes workload evenly
"""

import sys
import os
import argparse
import logging
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.database import DATABASE_URL
from models.synthea_models import Provider, Encounter
from models.session import PatientProviderAssignment
from models.models import Patient
import random
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_balanced_provider_assignment(providers, assignments_count):
    """
    Select a provider with the fewest current assignments for balanced distribution.
    """
    # Find provider with minimum assignments
    min_count = min(assignments_count.values())
    candidates = [p for p in providers if assignments_count[p.id] == min_count]
    
    # Randomly select from candidates with minimum assignments
    return random.choice(candidates)

def assign_patients_to_providers(force_reassign=False, ensure_coverage=True):
    """
    Create patient-provider assignments with balanced distribution.
    
    Args:
        force_reassign: If True, delete existing assignments and recreate
        ensure_coverage: If True, ensure every provider has at least one patient
    """
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        # Get all patients and providers
        patients = db.query(Patient).all()
        providers = db.query(Provider).filter(Provider.active == True).all()
        
        logger.info(f"Found {len(patients)} patients and {len(providers)} active providers")
        
        if not providers:
            logger.error("No active providers found!")
            return False
        
        if not patients:
            logger.error("No patients found!")
            return False
        
        # Check existing assignments
        existing_assignments = db.query(PatientProviderAssignment).count()
        if existing_assignments > 0:
            if force_reassign:
                logger.info(f"Force reassign enabled. Deleting {existing_assignments} existing assignments")
                db.query(PatientProviderAssignment).delete()
                db.commit()
            else:
                logger.info(f"Found {existing_assignments} existing assignments. Skipping reassignment.")
                return True
        
        # Group providers by specialty
        primary_care_specialties = [
            'Primary Care', 'Internal Medicine', 'Family Medicine', 
            'General Practice', 'Pediatrics'
        ]
        
        primary_care_providers = [
            p for p in providers 
            if any(spec in p.specialty for spec in primary_care_specialties)
        ]
        
        specialist_providers = [p for p in providers if p not in primary_care_providers]
        
        # If no primary care providers, use all providers as primary
        if not primary_care_providers:
            logger.warning("No primary care providers found. Using all providers for primary assignment.")
            primary_care_providers = providers
            specialist_providers = []
        
        logger.info(f"Provider distribution: {len(primary_care_providers)} primary care, {len(specialist_providers)} specialists")
        
        # Track assignments per provider for balanced distribution
        primary_assignments_count = defaultdict(int)
        specialist_assignments_count = defaultdict(int)
        
        # Initialize counts
        for p in primary_care_providers:
            primary_assignments_count[p.id] = 0
        for p in specialist_providers:
            specialist_assignments_count[p.id] = 0
        
        assignments_created = 0
        
        # Phase 1: Assign primary care providers to all patients
        for patient in patients:
            # Get provider with fewest assignments for balance
            primary_provider = get_balanced_provider_assignment(
                primary_care_providers, primary_assignments_count
            )
            
            assignment = PatientProviderAssignment(
                patient_id=patient.id,
                provider_id=primary_provider.id,
                assignment_type='primary',
                start_date=datetime.utcnow(),
                is_active=True
            )
            db.add(assignment)
            primary_assignments_count[primary_provider.id] += 1
            assignments_created += 1
        
        # Phase 2: Assign specialists to some patients
        if specialist_providers:
            # Determine how many specialist assignments to create
            # Aim for 30% of patients to have a specialist
            num_specialist_assignments = int(len(patients) * 0.3)
            
            # Shuffle patients for random selection
            patient_sample = random.sample(patients, min(num_specialist_assignments, len(patients)))
            
            for patient in patient_sample:
                # Get specialist with fewest assignments
                specialist = get_balanced_provider_assignment(
                    specialist_providers, specialist_assignments_count
                )
                
                specialist_assignment = PatientProviderAssignment(
                    patient_id=patient.id,
                    provider_id=specialist.id,
                    assignment_type='specialist',
                    start_date=datetime.utcnow(),
                    is_active=True
                )
                db.add(specialist_assignment)
                specialist_assignments_count[specialist.id] += 1
                assignments_created += 1
        
        # Phase 3: Ensure every provider has at least one patient (if requested)
        if ensure_coverage:
            # Check which providers have no assignments
            all_assignments_count = defaultdict(int)
            all_assignments_count.update(primary_assignments_count)
            all_assignments_count.update(specialist_assignments_count)
            
            unassigned_providers = [
                p for p in providers 
                if all_assignments_count.get(p.id, 0) == 0
            ]
            
            if unassigned_providers and patients:
                logger.info(f"Ensuring {len(unassigned_providers)} providers have at least one patient")
                
                for provider in unassigned_providers:
                    # Assign a random patient
                    patient = random.choice(patients)
                    
                    # Check if this patient already has this provider
                    existing = db.query(PatientProviderAssignment).filter(
                        PatientProviderAssignment.patient_id == patient.id,
                        PatientProviderAssignment.provider_id == provider.id
                    ).first()
                    
                    if not existing:
                        assignment_type = 'specialist' if provider in specialist_providers else 'primary'
                        
                        assignment = PatientProviderAssignment(
                            patient_id=patient.id,
                            provider_id=provider.id,
                            assignment_type=assignment_type,
                            start_date=datetime.utcnow(),
                            is_active=True
                        )
                        db.add(assignment)
                        assignments_created += 1
        
        db.commit()
        logger.info(f"Successfully created {assignments_created} patient-provider assignments")
        
        # Print distribution summary
        logger.info("\nProvider workload distribution:")
        for provider in providers:
            count = primary_assignments_count.get(provider.id, 0) + specialist_assignments_count.get(provider.id, 0)
            if count > 0:
                logger.info(f"  Dr. {provider.first_name} {provider.last_name} ({provider.specialty}): {count} patients")
        
        # Update encounters with provider assignments
        logger.info("\nUpdating encounters with provider assignments...")
        encounters_updated = 0
        
        # Get all encounters without providers
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
        logger.info(f"Updated {encounters_updated} encounters with provider assignments")
        
        return True
        
    except Exception as e:
        logger.error(f"Error during assignment: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description='Assign patients to providers')
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force reassignment by deleting existing assignments'
    )
    parser.add_argument(
        '--no-ensure-coverage',
        action='store_true',
        help='Do not ensure every provider has at least one patient'
    )
    
    args = parser.parse_args()
    
    logger.info("Starting patient-provider assignment")
    logger.info("=" * 50)
    
    success = assign_patients_to_providers(
        force_reassign=args.force,
        ensure_coverage=not args.no_ensure_coverage
    )
    
    if success:
        logger.info("✅ Patient-provider assignment completed successfully")
    else:
        logger.error("❌ Patient-provider assignment failed")
        sys.exit(1)

if __name__ == "__main__":
    main()