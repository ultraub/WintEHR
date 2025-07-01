#!/usr/bin/env python3
"""
Generate additional imaging studies for existing patients
Creates realistic imaging studies with appropriate modalities and DICOM files
"""

import os
import sys
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import engine
from models.synthea_models import Patient, ImagingStudy
from models.dicom_models import DICOMStudy, DICOMSeries, DICOMInstance
from generate_dicom_for_synthea import process_imaging_study

# Create session
Session = sessionmaker(bind=engine)

# Common imaging study types
IMAGING_STUDIES = [
    # Chest imaging
    {"description": "Chest X-Ray PA and Lateral", "modality": "XR", "body_part": "CHEST", "probability": 0.3},
    {"description": "CT Chest with Contrast", "modality": "CT", "body_part": "CHEST", "probability": 0.1},
    {"description": "CT Chest without Contrast", "modality": "CT", "body_part": "CHEST", "probability": 0.1},
    
    # Abdominal imaging
    {"description": "CT Abdomen and Pelvis with Contrast", "modality": "CT", "body_part": "ABDOMEN", "probability": 0.15},
    {"description": "Abdominal Ultrasound", "modality": "US", "body_part": "ABDOMEN", "probability": 0.1},
    
    # Head imaging
    {"description": "CT Head without Contrast", "modality": "CT", "body_part": "HEAD", "probability": 0.15},
    {"description": "MRI Brain with and without Contrast", "modality": "MR", "body_part": "BRAIN", "probability": 0.05},
    
    # Musculoskeletal
    {"description": "X-Ray Right Knee 3 Views", "modality": "XR", "body_part": "KNEE", "probability": 0.1},
    {"description": "X-Ray Left Knee 3 Views", "modality": "XR", "body_part": "KNEE", "probability": 0.1},
    {"description": "MRI Lumbar Spine without Contrast", "modality": "MR", "body_part": "SPINE", "probability": 0.05},
    {"description": "X-Ray Lumbar Spine AP and Lateral", "modality": "XR", "body_part": "SPINE", "probability": 0.1},
    
    # Cardiac
    {"description": "Echocardiogram", "modality": "US", "body_part": "HEART", "probability": 0.05},
    {"description": "CT Cardiac Angiography", "modality": "CT", "body_part": "HEART", "probability": 0.02},
    
    # Other
    {"description": "X-Ray Right Hand 3 Views", "modality": "XR", "body_part": "HAND", "probability": 0.05},
    {"description": "X-Ray Left Shoulder 2 Views", "modality": "XR", "body_part": "SHOULDER", "probability": 0.05},
    {"description": "Thyroid Ultrasound", "modality": "US", "body_part": "NECK", "probability": 0.03},
    {"description": "Renal Ultrasound", "modality": "US", "body_part": "KIDNEY", "probability": 0.05},
]


def select_imaging_studies_for_patient(patient_age, num_studies=1):
    """Select appropriate imaging studies based on patient age"""
    selected_studies = []
    
    # Adjust probabilities based on age
    age_adjusted_studies = []
    for study in IMAGING_STUDIES:
        adjusted_study = study.copy()
        
        # Increase chest X-ray probability for older patients
        if study["body_part"] == "CHEST" and patient_age > 50:
            adjusted_study["probability"] *= 1.5
        
        # Increase musculoskeletal imaging for middle-aged and elderly
        if study["body_part"] in ["KNEE", "SPINE"] and patient_age > 40:
            adjusted_study["probability"] *= 1.3
            
        # Increase cardiac imaging for older patients
        if study["body_part"] == "HEART" and patient_age > 60:
            adjusted_study["probability"] *= 2.0
            
        # Decrease certain studies for young patients
        if patient_age < 30 and study["modality"] == "CT":
            adjusted_study["probability"] *= 0.5
            
        age_adjusted_studies.append(adjusted_study)
    
    # Normalize probabilities
    total_prob = sum(s["probability"] for s in age_adjusted_studies)
    for study in age_adjusted_studies:
        study["probability"] /= total_prob
    
    # Select studies
    for _ in range(num_studies):
        r = random.random()
        cumulative = 0
        for study in age_adjusted_studies:
            cumulative += study["probability"]
            if r <= cumulative:
                selected_studies.append(study)
                break
    
    return selected_studies


def generate_imaging_studies(num_studies_per_patient_range=(0, 3), dicom_upload_dir=None):
    """Generate additional imaging studies for existing patients"""
    
    if not dicom_upload_dir:
        dicom_upload_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'data', 
            'dicom_uploads'
        )
    os.makedirs(dicom_upload_dir, exist_ok=True)
    
    session = Session()
    
    print("=== Generating Additional Imaging Studies ===\n")
    
    # Get all patients
    patients = session.query(Patient).all()
    print(f"Found {len(patients)} patients")
    
    # Count existing imaging studies
    existing_count = session.query(ImagingStudy).count()
    print(f"Existing imaging studies: {existing_count}")
    
    new_studies_count = 0
    new_dicom_count = 0
    
    for patient in patients:
        # Calculate patient age
        if patient.date_of_birth:
            today = datetime.now().date()
            age = (today - patient.date_of_birth).days // 365
        else:
            age = random.randint(20, 80)
        
        # Determine number of studies for this patient
        num_studies = random.randint(*num_studies_per_patient_range)
        
        if num_studies == 0:
            continue
            
        # Select appropriate studies
        selected_studies = select_imaging_studies_for_patient(age, num_studies)
        
        for study_info in selected_studies:
            # Generate a random date within the last 2 years
            days_ago = random.randint(1, 730)
            study_date = datetime.now() - timedelta(days=days_ago)
            
            # Create imaging study
            imaging_study = ImagingStudy(
                patient_id=patient.id,
                study_date=study_date,
                description=study_info["description"],
                modality=study_info["modality"],
                body_part=study_info["body_part"],
                status='available'
            )
            
            # Set appropriate series and instance counts based on modality
            if study_info["modality"] == "XR":
                imaging_study.number_of_series = 1
                imaging_study.number_of_instances = random.randint(2, 4)  # Multiple views
            elif study_info["modality"] == "CT":
                imaging_study.number_of_series = random.randint(1, 3)
                imaging_study.number_of_instances = random.randint(50, 200)  # Many slices
            elif study_info["modality"] == "MR":
                imaging_study.number_of_series = random.randint(3, 8)  # Multiple sequences
                imaging_study.number_of_instances = random.randint(100, 400)
            elif study_info["modality"] == "US":
                imaging_study.number_of_series = 1
                imaging_study.number_of_instances = random.randint(10, 30)  # Multiple images/clips
            
            session.add(imaging_study)
            session.flush()  # Get the ID
            
            new_studies_count += 1
            
            # Generate DICOM files
            try:
                dicom_study = process_imaging_study(session, imaging_study, dicom_upload_dir)
                new_dicom_count += 1
                print(f"  Created {study_info['description']} for {patient.first_name} {patient.last_name}")
            except Exception as e:
                print(f"  Error creating DICOM for {study_info['description']}: {e}")
                session.rollback()
                continue
    
    session.commit()
    
    print(f"\n✅ Generated {new_studies_count} new imaging studies")
    print(f"✅ Created {new_dicom_count} DICOM studies with images")
    
    # Final counts
    total_studies = session.query(ImagingStudy).count()
    total_dicom = session.query(DICOMStudy).count()
    print(f"\nTotal imaging studies: {total_studies}")
    print(f"Total DICOM studies: {total_dicom}")
    print(f"Studies per patient: {total_studies/len(patients):.2f}")
    
    session.close()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate additional imaging studies')
    parser.add_argument('--min-studies', type=int, default=0,
                       help='Minimum studies per patient (default: 0)')
    parser.add_argument('--max-studies', type=int, default=3,
                       help='Maximum studies per patient (default: 3)')
    
    args = parser.parse_args()
    
    generate_imaging_studies(
        num_studies_per_patient_range=(args.min_studies, args.max_studies)
    )


if __name__ == "__main__":
    main()