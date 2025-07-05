#!/usr/bin/env python3
"""
Initialize all database tables for the MedGenEMR system.
This script creates all necessary tables based on the SQLAlchemy models.
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv()

def create_all_tables():
    """Create all database tables."""
    # Get database URL and create sync engine
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@localhost:5432/emr_db')
    sync_url = DATABASE_URL.replace('+asyncpg', '')
    sync_engine = create_engine(sync_url, echo=False)
    
    try:
        print("🏥 Initializing MedGenEMR Database Tables")
        print("=" * 60)
        
        # Import all base classes to ensure models are registered
        from database import Base as DatabaseBase
        
        # Import all model modules to register their tables
        print("Importing model definitions...")
        
        # Core models
        from models import synthea_models
        from models.session import UserSession, PatientProviderAssignment
        from models import dicom_models
        
        # Try to import clinical models if they exist
        try:
            from models.clinical import notes, orders, tasks, catalogs
            print("✓ Clinical models imported")
        except ImportError as e:
            print(f"! Clinical models not found (may not be needed): {e}")
        
        # Create all tables from the Base metadata
        print("\nCreating database tables...")
        
        # Create tables from each Base class
        bases_to_create = [
            (DatabaseBase, "Core"),
            (synthea_models.Base, "Synthea"),
        ]
        
        # Add other bases if they exist
        try:
            from models import dicom_models
            bases_to_create.append((dicom_models.Base, "DICOM"))
        except ImportError:
            pass
            
        for base, name in bases_to_create:
            print(f"\nCreating {name} tables...")
            base.metadata.create_all(bind=sync_engine, checkfirst=True)
            print(f"✓ {name} tables created")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(sync_engine)
        tables = inspector.get_table_names()
        
        print(f"\n✅ Successfully created {len(tables)} tables:")
        
        # Group tables by category
        synthea_tables = ['patients', 'providers', 'organizations', 'locations', 'encounters', 
                         'conditions', 'medications', 'observations', 'procedures', 'immunizations',
                         'allergies', 'careplans', 'claims', 'payers', 'coverage', 'devices',
                         'document_references', 'service_requests', 'specimens']
        
        dicom_tables = ['dicom_studies', 'dicom_series', 'dicom_instances', 'imaging_results']
        
        session_tables = ['user_sessions', 'patient_provider_assignments']
        
        print("\nSynthea/FHIR Tables:")
        for table in sorted(tables):
            if table in synthea_tables:
                print(f"  ✓ {table}")
                
        print("\nDICOM Tables:")
        for table in sorted(tables):
            if table in dicom_tables:
                print(f"  ✓ {table}")
                
        print("\nSession Tables:")
        for table in sorted(tables):
            if table in session_tables:
                print(f"  ✓ {table}")
                
        print("\nOther Tables:")
        for table in sorted(tables):
            if table not in synthea_tables + dicom_tables + session_tables:
                print(f"  ✓ {table}")
        
        # Verify critical tables exist
        critical_tables = ['patients', 'observations', 'encounters', 'devices']
        missing_tables = [t for t in critical_tables if t not in tables]
        
        if missing_tables:
            print(f"\n⚠️  Warning: Some critical tables are missing: {missing_tables}")
        else:
            print(f"\n✅ All critical tables verified!")
            
    except Exception as e:
        print(f"\n❌ Error creating tables: {e}")
        import traceback
        traceback.print_exc()
    finally:
        sync_engine.dispose()
        
if __name__ == "__main__":
    create_all_tables()