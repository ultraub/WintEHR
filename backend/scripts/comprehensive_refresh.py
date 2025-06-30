#!/usr/bin/env python3
"""
Comprehensive Database Refresh Script
Ensures unified models, fresh data import, and system consistency
"""

import os
import sys
import logging
from pathlib import Path
from datetime import datetime
import random

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal, engine, Base
from models.models import *  # Import all unified models
from models.session import PatientProviderAssignment, UserSession

# Import the optimized synthea importer
from scripts.optimized_synthea_import import OptimizedSyntheaImporter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def clean_database():
    """Remove existing database and create fresh schema"""
    logger.info("🗑️  Cleaning database...")
    
    # Remove existing database
    db_path = Path("data/emr.db")
    if db_path.exists():
        db_path.unlink()
        logger.info("Removed existing database")
    
    # Ensure data directory exists
    db_path.parent.mkdir(exist_ok=True)
    
    # Create all tables with unified models
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Created fresh database with unified schema")

def import_synthea_data():
    """Import all Synthea FHIR data using optimized importer"""
    logger.info("📊 Importing Synthea data with optimized importer...")
    
    # Try multiple possible data directories
    possible_dirs = [
        Path("output/fhir"),
        Path("data/synthea_output/fhir"),
        Path("synthea/output/fhir")
    ]
    
    fhir_dir = None
    for dir_path in possible_dirs:
        if dir_path.exists():
            fhir_dir = dir_path
            break
    
    if not fhir_dir:
        logger.error("No FHIR output directory found")
        return False
    
    logger.info(f"Using FHIR directory: {fhir_dir}")
    
    try:
        # Use optimized importer with appropriate batch size
        importer = OptimizedSyntheaImporter(batch_size=50)
        success = importer.import_directory(fhir_dir)
        
        if success:
            logger.info("✅ Successfully imported Synthea data")
        else:
            logger.error("❌ Import failed")
            
        return success
        
    except Exception as e:
        logger.error(f"Error during import: {e}")
        raise

def assign_patients_to_providers():
    """Assign all patients to providers"""
    logger.info("👥 Assigning patients to providers...")
    
    random.seed(42)  # For reproducible assignments
    
    db = SessionLocal()
    try:
        # Get all patients and providers
        patients = db.query(Patient).all()
        providers = db.query(Provider).filter(Provider.active == True).all()
        
        logger.info(f"Found {len(patients)} patients and {len(providers)} providers")
        
        # Create assignments
        assignments = []
        for patient in patients:
            provider = random.choice(providers)
            assignment = PatientProviderAssignment(
                patient_id=patient.id,
                provider_id=provider.id,
                start_date=datetime.now(),
                is_active=True,
                assignment_type='primary'
            )
            assignments.append(assignment)
        
        # Bulk insert
        db.add_all(assignments)
        db.commit()
        
        logger.info(f"✅ Created {len(assignments)} patient-provider assignments")
        
    except Exception as e:
        logger.error(f"Error creating assignments: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def verify_data_integrity():
    """Verify imported data integrity"""
    logger.info("🔍 Verifying data integrity...")
    
    db = SessionLocal()
    try:
        # Check key tables
        patient_count = db.query(Patient).count()
        provider_count = db.query(Provider).count()
        encounter_count = db.query(Encounter).count()
        observation_count = db.query(Observation).count()
        condition_count = db.query(Condition).count()
        medication_count = db.query(Medication).count()
        assignment_count = db.query(PatientProviderAssignment).count()
        
        logger.info(f"Data Summary:")
        logger.info(f"  Patients: {patient_count:,}")
        logger.info(f"  Providers: {provider_count:,}")
        logger.info(f"  Encounters: {encounter_count:,}")
        logger.info(f"  Observations: {observation_count:,}")
        logger.info(f"  Conditions: {condition_count:,}")
        logger.info(f"  Medications: {medication_count:,}")
        logger.info(f"  Assignments: {assignment_count:,}")
        
        # Check blood pressure data specifically
        bp_obs = db.query(Observation).filter(
            Observation.loinc_code == '85354-9',
            Observation.value.isnot(None)
        ).count()
        
        logger.info(f"  Blood Pressure (with values): {bp_obs:,}")
        
        # Check PRAPARE data
        prapare_obs = db.query(Observation).filter(
            Observation.loinc_code == '93025-5'
        ).count()
        
        logger.info(f"  PRAPARE Questionnaires: {prapare_obs:,}")
        
        # Verify no orphaned data
        patients_without_assignments = db.query(Patient).outerjoin(PatientProviderAssignment).filter(
            PatientProviderAssignment.patient_id.is_(None)
        ).count()
        
        if patients_without_assignments > 0:
            logger.warning(f"⚠️  {patients_without_assignments} patients without provider assignments")
        else:
            logger.info("✅ All patients have provider assignments")
            
    except Exception as e:
        logger.error(f"Error during verification: {e}")
        raise
    finally:
        db.close()

def main():
    """Run comprehensive database refresh"""
    logger.info("🏥 Starting Comprehensive Database Refresh")
    logger.info("=" * 60)
    
    try:
        # Step 1: Clean database
        clean_database()
        
        # Step 2: Import Synthea data
        import_synthea_data()
        
        # Step 3: Assign patients to providers
        assign_patients_to_providers()
        
        # Step 4: Verify data integrity
        verify_data_integrity()
        
        logger.info("=" * 60)
        logger.info("🎉 Comprehensive refresh completed successfully!")
        logger.info("All systems should now have consistent, unified data.")
        
        return 0
        
    except Exception as e:
        logger.error(f"❌ Refresh failed: {e}")
        return 1

if __name__ == "__main__":
    exit(main())