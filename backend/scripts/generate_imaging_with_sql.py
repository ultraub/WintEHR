#!/usr/bin/env python3
"""
Generate additional imaging studies using raw SQL to avoid ORM issues
"""

import os
import sys
import random
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import engine
from generate_dicom_for_synthea import (
    MODALITY_CONFIG, 
    generate_dicom_pixel_data,
    create_dicom_file
)

# Common imaging study types
IMAGING_STUDIES = [
    # Chest imaging
    {"description": "Chest X-Ray PA and Lateral", "modality": "XR", "body_part": "CHEST", "probability": 0.3},
    {"description": "CT Chest with Contrast", "modality": "CT", "body_part": "CHEST", "probability": 0.1},
    
    # Abdominal imaging
    {"description": "CT Abdomen and Pelvis with Contrast", "modality": "CT", "body_part": "ABDOMEN", "probability": 0.15},
    {"description": "Abdominal Ultrasound", "modality": "US", "body_part": "ABDOMEN", "probability": 0.1},
    
    # Head imaging
    {"description": "CT Head without Contrast", "modality": "CT", "body_part": "HEAD", "probability": 0.15},
    {"description": "MRI Brain without Contrast", "modality": "MR", "body_part": "BRAIN", "probability": 0.05},
    
    # Musculoskeletal
    {"description": "X-Ray Knee 3 Views", "modality": "XR", "body_part": "KNEE", "probability": 0.15},
    {"description": "MRI Lumbar Spine without Contrast", "modality": "MR", "body_part": "SPINE", "probability": 0.05},
]


def create_dicom_files_for_study(patient_info, study_info, dicom_upload_dir):
    """Create DICOM files for a study using raw SQL"""
    
    # Generate UIDs
    study_uid = generate_uid()
    series_uid = generate_uid()
    
    # Create directories
    study_dir = os.path.join(dicom_upload_dir, study_uid)
    series_dir = os.path.join(study_dir, series_uid)
    os.makedirs(series_dir, exist_ok=True)
    
    # Determine number of instances based on modality
    config = MODALITY_CONFIG.get(study_info['modality'], MODALITY_CONFIG['CT'])
    num_slices = config['slices']
    
    # Insert DICOM study
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Insert DICOM study
            result = conn.execute(text("""
                INSERT INTO dicom_studies (
                    study_instance_uid, patient_id, imaging_study_id,
                    study_date, study_description, modality,
                    patient_name, patient_birth_date, patient_sex,
                    number_of_series, number_of_instances, study_size_mb,
                    storage_path, upload_status, created_at, updated_at
                ) VALUES (
                    :study_uid, :patient_id, :imaging_study_id,
                    :study_date, :description, :modality,
                    :patient_name, :birth_date, :sex,
                    1, :num_instances, 0.0,
                    :storage_path, 'complete', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
            """), {
                'study_uid': study_uid,
                'patient_id': patient_info['id'],
                'imaging_study_id': study_info['imaging_study_id'],
                'study_date': study_info['study_date'],
                'description': study_info['description'],
                'modality': study_info['modality'],
                'patient_name': f"{patient_info['last_name']}^{patient_info['first_name']}",
                'birth_date': patient_info['birth_date'],
                'sex': patient_info['gender'][0].upper() if patient_info['gender'] else 'O',
                'num_instances': num_slices,
                'storage_path': study_dir
            })
            
            dicom_study_id = result.lastrowid
            
            # Insert DICOM series
            result = conn.execute(text("""
                INSERT INTO dicom_series (
                    series_instance_uid, study_id, series_number,
                    series_date, series_description, modality,
                    body_part_examined, number_of_instances, series_size_mb,
                    storage_path
                ) VALUES (
                    :series_uid, :study_id, 1,
                    :series_date, :description, :modality,
                    :body_part, :num_instances, 0.0,
                    :storage_path
                )
            """), {
                'series_uid': series_uid,
                'study_id': dicom_study_id,
                'series_date': study_info['study_date'],
                'description': study_info['description'],
                'modality': study_info['modality'],
                'body_part': study_info.get('body_part', ''),
                'num_instances': num_slices,
                'storage_path': series_dir
            })
            
            dicom_series_id = result.lastrowid
            
            # Generate DICOM files
            total_size = 0
            for i in range(num_slices):
                instance_uid = generate_uid()
                filename = f"{instance_uid}.dcm"
                filepath = os.path.join(series_dir, filename)
                
                # Create DICOM file
                study_dict = {
                    'study_instance_uid': study_uid,
                    'study_date': study_info['study_date'],
                    'description': study_info['description'],
                    'id': dicom_study_id,
                    'accession_number': f"ACC{dicom_study_id:06d}"
                }
                
                series_dict = {
                    'series_instance_uid': series_uid,
                    'series_number': 1,
                    'series_description': study_info['description'],
                    'modality': study_info['modality'],
                    'body_part': study_info.get('body_part', '')
                }
                
                instance_dict = {
                    'sop_instance_uid': instance_uid,
                    'instance_number': i + 1
                }
                
                file_size = create_dicom_file(
                    patient_info, study_dict, series_dict, instance_dict, filepath
                )
                
                # Insert DICOM instance
                conn.execute(text("""
                    INSERT INTO dicom_instances (
                        sop_instance_uid, series_id, instance_number,
                        acquisition_date, rows, columns,
                        window_center, window_width, file_path, file_size,
                        created_at
                    ) VALUES (
                        :sop_uid, :series_id, :instance_num,
                        :acq_date, :rows, :cols,
                        :window_center, :window_width, :file_path, :file_size,
                        CURRENT_TIMESTAMP
                    )
                """), {
                    'sop_uid': instance_uid,
                    'series_id': dicom_series_id,
                    'instance_num': i + 1,
                    'acq_date': study_info['study_date'],
                    'rows': config['rows'],
                    'cols': config['columns'],
                    'window_center': config['window_center'],
                    'window_width': config['window_width'],
                    'file_path': filepath,
                    'file_size': file_size
                })
                
                total_size += file_size
            
            # Update sizes
            total_size_mb = total_size / (1024 * 1024)
            conn.execute(text("""
                UPDATE dicom_series 
                SET series_size_mb = :size 
                WHERE id = :id
            """), {'size': total_size_mb, 'id': dicom_series_id})
            
            conn.execute(text("""
                UPDATE dicom_studies 
                SET study_size_mb = :size 
                WHERE id = :id
            """), {'size': total_size_mb, 'id': dicom_study_id})
            
            trans.commit()
            return True
            
        except Exception as e:
            trans.rollback()
            print(f"Error creating DICOM study: {e}")
            return False


def main():
    """Generate additional imaging studies"""
    
    dicom_upload_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'data', 
        'dicom_uploads'
    )
    os.makedirs(dicom_upload_dir, exist_ok=True)
    
    print("=== Generating Additional Imaging Studies ===\n")
    
    with engine.connect() as conn:
        # Get all patients
        result = conn.execute(text("""
            SELECT id, first_name, last_name, date_of_birth, gender
            FROM patients
        """))
        patients = result.fetchall()
        print(f"Found {len(patients)} patients")
        
        # Count existing studies
        result = conn.execute(text("SELECT COUNT(*) FROM imaging_studies"))
        existing_count = result.scalar()
        print(f"Existing imaging studies: {existing_count}")
        
        new_studies = 0
        new_dicom = 0
        
        for patient in patients:
            # Create patient info dict
            patient_info = {
                'id': patient[0],
                'first_name': patient[1],
                'last_name': patient[2],
                'birth_date': patient[3],
                'gender': patient[4]
            }
            
            # Randomly select 1-3 studies for this patient
            num_studies = random.randint(1, 3)
            
            for _ in range(num_studies):
                # Select a random study type
                study_type = random.choice(IMAGING_STUDIES)
                
                # Generate random study date in last 2 years
                days_ago = random.randint(1, 730)
                study_date = datetime.now() - timedelta(days=days_ago)
                
                # Create imaging study record
                imaging_study_id = str(uuid.uuid4())
                
                result = conn.execute(text("""
                    INSERT INTO imaging_studies (
                        id, patient_id, study_date, description,
                        modality, body_part, status,
                        number_of_series, number_of_instances
                    ) VALUES (
                        :id, :patient_id, :study_date, :description,
                        :modality, :body_part, 'available',
                        1, :num_instances
                    )
                """), {
                    'id': imaging_study_id,
                    'patient_id': patient_info['id'],
                    'study_date': study_date,
                    'description': study_type['description'],
                    'modality': study_type['modality'],
                    'body_part': study_type['body_part'],
                    'num_instances': MODALITY_CONFIG[study_type['modality']]['slices']
                })
                
                new_studies += 1
                
                # Create DICOM files
                study_info = {
                    'imaging_study_id': imaging_study_id,
                    'study_date': study_date,
                    'description': study_type['description'],
                    'modality': study_type['modality'],
                    'body_part': study_type['body_part']
                }
                
                if create_dicom_files_for_study(patient_info, study_info, dicom_upload_dir):
                    new_dicom += 1
                    print(f"  Created {study_type['description']} for {patient_info['first_name']} {patient_info['last_name']}")
        
        # Final counts
        result = conn.execute(text("SELECT COUNT(*) FROM imaging_studies"))
        total_studies = result.scalar()
        
        result = conn.execute(text("SELECT COUNT(*) FROM dicom_studies"))
        total_dicom = result.scalar()
        
        print(f"\n✅ Generated {new_studies} new imaging studies")
        print(f"✅ Created {new_dicom} DICOM studies with images")
        print(f"\nTotal imaging studies: {total_studies}")
        print(f"Total DICOM studies: {total_dicom}")
        print(f"Studies per patient: {total_studies/len(patients):.2f}")


if __name__ == "__main__":
    main()