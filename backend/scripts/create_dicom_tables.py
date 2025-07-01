#!/usr/bin/env python3
"""
Create DICOM tables in the database
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import engine
from models import dicom_models

def create_dicom_tables():
    """Create DICOM database tables"""
    print("Creating DICOM database tables...")
    
    # Create all tables defined in dicom_models
    dicom_models.Base.metadata.create_all(bind=engine)
    
    print("✓ DICOM database tables created successfully")

if __name__ == "__main__":
    create_dicom_tables()