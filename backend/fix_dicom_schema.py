#!/usr/bin/env python3
"""Fix DICOM schema to match model definitions"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from database.database import engine

print("=== Fixing DICOM Schema ===")
print()

with engine.connect() as conn:
    # Start transaction
    trans = conn.begin()
    
    try:
        # 1. Drop the existing dicom tables
        print("1. Dropping existing DICOM tables...")
        conn.execute(text("DROP TABLE IF EXISTS dicom_instances"))
        conn.execute(text("DROP TABLE IF EXISTS dicom_series"))  
        conn.execute(text("DROP TABLE IF EXISTS dicom_studies"))
        conn.execute(text("DROP TABLE IF EXISTS imaging_results"))
        print("   Tables dropped.")
        
        # 2. Recreate with correct schema matching the models
        print("\n2. Creating new tables with correct schema...")
        
        # Create dicom_studies with String patient_id
        conn.execute(text("""
            CREATE TABLE dicom_studies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                study_instance_uid VARCHAR(64) UNIQUE,
                patient_id VARCHAR,
                imaging_study_id VARCHAR,
                study_date DATETIME,
                study_time VARCHAR(16),
                accession_number VARCHAR(16),
                study_description VARCHAR(64),
                modality VARCHAR(16),
                referring_physician VARCHAR(64),
                patient_name VARCHAR(64),
                patient_birth_date DATETIME,
                patient_sex VARCHAR(1),
                number_of_series INTEGER DEFAULT 0,
                number_of_instances INTEGER DEFAULT 0,
                study_size_mb FLOAT DEFAULT 0.0,
                storage_path VARCHAR(255),
                thumbnail_path VARCHAR(255),
                upload_status VARCHAR(20) DEFAULT 'pending',
                processing_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(patient_id) REFERENCES patients(id),
                FOREIGN KEY(imaging_study_id) REFERENCES imaging_studies(id)
            )
        """))
        
        # Create dicom_series with all columns from model
        conn.execute(text("""
            CREATE TABLE dicom_series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_instance_uid VARCHAR(64) UNIQUE,
                study_id INTEGER,
                series_number INTEGER,
                series_date DATETIME,
                series_time VARCHAR(16),
                series_description VARCHAR(64),
                modality VARCHAR(16),
                body_part_examined VARCHAR(16),
                protocol_name VARCHAR(64),
                slice_thickness FLOAT,
                spacing_between_slices FLOAT,
                pixel_spacing VARCHAR(32),
                rows INTEGER,
                columns INTEGER,
                number_of_instances INTEGER DEFAULT 0,
                series_size_mb FLOAT DEFAULT 0.0,
                storage_path VARCHAR(255),
                thumbnail_path VARCHAR(255),
                FOREIGN KEY(study_id) REFERENCES dicom_studies(id)
            )
        """))
        
        # Create dicom_instances  
        conn.execute(text("""
            CREATE TABLE dicom_instances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sop_instance_uid VARCHAR(64) UNIQUE,
                series_id INTEGER,
                instance_number INTEGER,
                acquisition_date DATETIME,
                acquisition_time VARCHAR(16),
                content_date DATETIME,
                content_time VARCHAR(16),
                slice_location FLOAT,
                slice_thickness FLOAT,
                pixel_spacing VARCHAR(32),
                rows INTEGER,
                columns INTEGER,
                window_center FLOAT,
                window_width FLOAT,
                file_path VARCHAR(255),
                file_size INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(series_id) REFERENCES dicom_series(id)
            )
        """))
        
        # Create imaging_results
        conn.execute(text("""
            CREATE TABLE imaging_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                imaging_study_id VARCHAR,
                dicom_study_id INTEGER,
                findings TEXT,
                impression TEXT,
                recommendations TEXT,
                status VARCHAR(20) DEFAULT 'preliminary',
                reported_by VARCHAR(64),
                reported_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(imaging_study_id) REFERENCES imaging_studies(id),
                FOREIGN KEY(dicom_study_id) REFERENCES dicom_studies(id)
            )
        """))
        
        # Create indexes
        print("\n3. Creating indexes...")
        conn.execute(text("CREATE INDEX idx_dicom_studies_patient_id ON dicom_studies(patient_id)"))
        conn.execute(text("CREATE INDEX idx_dicom_studies_study_date ON dicom_studies(study_date)"))
        conn.execute(text("CREATE INDEX idx_dicom_series_study_id ON dicom_series(study_id)"))
        conn.execute(text("CREATE INDEX idx_dicom_instances_series_id ON dicom_instances(series_id)"))
        
        trans.commit()
        print("   Indexes created.")
        print("\n✅ Schema fixed successfully!")
        
    except Exception as e:
        trans.rollback()
        print(f"\n❌ Error: {e}")
        raise