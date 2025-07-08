#!/usr/bin/env python3
"""
Comprehensive database setup script for EMR system
Includes:
1. Database schema creation
2. Sample provider creation 
3. Clinical catalog population
4. Sample Synthea data import
"""
import sys
import os
import subprocess
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import engine
from models import synthea_models
from models.session import UserSession, PatientProviderAssignment
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, ImagingStudyCatalog, ClinicalOrderSet
from models.clinical.notes import ClinicalNote, NoteTemplate
from models.clinical.orders import Order, OrderSet as OrderSetModel
from models.clinical.tasks import ClinicalTask, InboxItem
import logging



def create_all_tables():
    """Create all database tables"""
    logging.info("Creating database tables...")
    # Create sync engine from async engine URL
    import os
    from sqlalchemy import create_engine
    from dotenv import load_dotenv
    
    load_dotenv()
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@localhost:5432/emr_db')
    sync_url = DATABASE_URL.replace('+asyncpg', '')
    sync_engine = create_engine(sync_url)
    
    try:
        # Import all models to ensure they're registered
        from database import Base as DatabaseBase
        DatabaseBase.metadata.create_all(bind=sync_engine)
        synthea_models.Base.metadata.create_all(bind=sync_engine)
        
        # Import clinical models
        from models.clinical import notes, orders, tasks, catalogs
        notes.Base.metadata.create_all(bind=sync_engine)
        orders.Base.metadata.create_all(bind=sync_engine)
        tasks.Base.metadata.create_all(bind=sync_engine)
        catalogs.Base.metadata.create_all(bind=sync_engine)
        
        # Import DICOM models
        from models import dicom_models
        dicom_models.Base.metadata.create_all(bind=sync_engine)
        
        logging.info("✓ Database tables created successfully")
    finally:
        sync_engine.dispose()


def run_script(script_path, description, args=None):
    """Run a Python script and handle errors"""
    try:
        logging.info(f"\n{description}...")
        cmd = [sys.executable, script_path]
        if args:
            cmd.extend(args)
        result = subprocess.run(cmd, 
                              capture_output=True, text=True, check=True)
        logging.info(f"✓ {description} completed successfully")
        if result.stdout:
            logging.info(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        logging.info(f"✗ {description} failed:")
        logging.error(f"Error: {e.stderr}")
        return False
    except FileNotFoundError:
        logging.info(f"✗ Script not found: {script_path}")
        return False


def run_synthea_generation(num_patients=100):
    """Generate synthetic patients using Synthea"""
    logging.info(f"\nGenerating {num_patients} synthetic patients with Synthea...")
    # Find Synthea JAR file
    script_dir = Path(__file__).parent
    synthea_jar = script_dir / "synthea-with-dependencies.jar"
    
    if not synthea_jar.exists():
        synthea_jar = script_dir / "synthea" / "synthea-with-dependencies.jar"
    
    if not synthea_jar.exists():
        logging.info("✗ Synthea JAR file not found. Please ensure synthea-with-dependencies.jar is available.")
        return False
    
    try:
        # Create output directory
        output_dir = script_dir / "synthea_output"
        output_dir.mkdir(exist_ok=True)
        
        # Run Synthea
        cmd = [
            "java", "-jar", str(synthea_jar),
            "-p", str(num_patients),
            "--exporter.fhir.export", "true",
            "--exporter.hospital.fhir.export", "false",
            "--exporter.practitioner.fhir.export", "false",
            str(output_dir)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logging.info(f"✓ Generated {num_patients} synthetic patients")
        return True
        
    except subprocess.CalledProcessError as e:
        logging.info(f"✗ Synthea generation failed: {e.stderr}")
        return False
    except Exception as e:
        logging.error(f"✗ Error running Synthea: {e}")
        return False


def main():
    """Main setup function"""
    parser = argparse.ArgumentParser(description="Comprehensive EMR Database Setup")
    parser.add_argument("--skip-synthea", action="store_true", 
                       help="Skip Synthea data generation")
    parser.add_argument("--patients", type=int, default=100,
                       help="Number of patients to generate (default: 100)")
    parser.add_argument("--quick", action="store_true",
                       help="Quick setup - minimal data")
    
    args = parser.parse_args()
    
    logging.info("=== EMR System Database Setup ===")
    logging.info(f"Quick mode: {args.quick}")
    logging.info(f"Patients to generate: {args.patients}")
    script_dir = Path(__file__).parent
    success_count = 0
    total_steps = 4 if not args.skip_synthea else 3
    
    # Step 1: Create database tables
    try:
        create_all_tables()
        success_count += 1
    except Exception as e:
        logging.info(f"✗ Database creation failed: {e}")
        return 1
    
    # Step 2: Create sample providers
    provider_script = script_dir / "create_sample_providers.py"
    if run_script(provider_script, "Creating sample providers"):
        success_count += 1
    
    # Step 3: Populate clinical catalogs
    catalog_script = script_dir / "populate_clinical_catalogs.py"
    if run_script(catalog_script, "Populating clinical catalogs"):
        success_count += 1
    
    # Step 4: Generate and import Synthea data (optional)
    if not args.skip_synthea:
        if args.quick:
            patients = min(args.patients, 20)  # Limit patients in quick mode
        else:
            patients = args.patients
            
        if run_synthea_generation(patients):
            # Import the generated data using optimized importer
            import_script = script_dir / "optimized_synthea_import.py"
            output_dir = script_dir.parent / "data" / "synthea_output" / "fhir"
            if run_script(import_script, "Importing Synthea data with optimized importer", 
                         ["--input-dir", str(output_dir), "--batch-size", "50"]):
                success_count += 1
    
    # Summary
    logging.info(f"\n=== Setup Complete ===")
    logging.info(f"Successfully completed {success_count}/{total_steps} setup steps")
    if success_count == total_steps:
        logging.info("✓ EMR system is ready for use!")
        logging.info("\nNext steps:")
        logging.info("1. Start the backend server: python main.py")
        logging.info("2. Start the frontend: npm start")
        logging.info("3. Access the application at http://localhost:3000")
        logging.info("4. Login with one of the sample providers")
        return 0
    else:
        logging.info("⚠ Setup completed with some issues. Check the logs above.")
        return 1


if __name__ == "__main__":
    exit(main())