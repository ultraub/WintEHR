#!/usr/bin/env python3
"""
Drop and recreate DICOM tables in the database
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import engine
from models import dicom_models
from sqlalchemy import text

def recreate_dicom_tables():
    """Drop and recreate DICOM database tables"""
    print("Dropping existing DICOM tables...")
    
    # Drop tables in reverse order of dependencies
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS imaging_results"))
        conn.execute(text("DROP TABLE IF EXISTS dicom_instances"))
        conn.execute(text("DROP TABLE IF EXISTS dicom_series"))
        conn.execute(text("DROP TABLE IF EXISTS dicom_studies"))
        conn.commit()
    
    print("✓ Old DICOM tables dropped")
    
    print("Creating new DICOM database tables...")
    
    # Create all tables defined in dicom_models
    dicom_models.Base.metadata.create_all(bind=engine)
    
    print("✓ DICOM database tables created successfully")

if __name__ == "__main__":
    recreate_dicom_tables()