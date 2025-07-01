#!/usr/bin/env python3
"""
Create additional imaging studies for patients without existing imaging
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import SessionLocal
from models.synthea_models import Patient, ImagingStudy
from models.dicom_models import DICOMStudy, DICOMSeries, DICOMInstance
from datetime import datetime, timedelta
import random
import uuid
import numpy as np
from PIL import Image
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
import tempfile
import shutil

# DICOM upload directory
UPLOAD_DIR = "./data/dicom_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def create_sample_dicom(study_uid, series_uid, instance_uid, instance_number, modality, body_part, patient_info):
    """Create a sample DICOM file with synthetic image data"""
    
    # Create basic DICOM dataset
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
    file_meta.MediaStorageSOPInstanceUID = instance_uid
    file_meta.ImplementationClassUID = "1.2.826.0.1.3680043.8.498.1"
    file_meta.TransferSyntaxUID = "1.2.840.10008.1.2"  # Implicit VR Little Endian
    
    # Create main dataset
    ds = FileDataset("", {}, file_meta=file_meta, preamble=b"\0" * 128)
    
    # Patient information
    ds.PatientName = f"{patient_info['first_name']}^{patient_info['last_name']}"
    ds.PatientID = patient_info['mrn']
    ds.PatientBirthDate = patient_info['dob'].strftime('%Y%m%d')
    ds.PatientSex = patient_info['gender'][0].upper()
    
    # Study information
    ds.StudyInstanceUID = study_uid
    ds.StudyDate = datetime.now().strftime('%Y%m%d')
    ds.StudyTime = datetime.now().strftime('%H%M%S')
    ds.AccessionNumber = f"ACC{random.randint(10000, 99999)}"
    
    # Series information
    ds.SeriesInstanceUID = series_uid
    ds.SeriesNumber = 1
    ds.SeriesDate = ds.StudyDate
    ds.SeriesTime = ds.StudyTime
    
    # Instance information
    ds.SOPInstanceUID = instance_uid
    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
    ds.InstanceNumber = instance_number
    
    # Modality-specific information
    ds.Modality = modality
    if body_part == "HEAD":
        ds.StudyDescription = f"{modality} Head"
        ds.SeriesDescription = f"{modality} Head"
        ds.BodyPartExamined = "HEAD"
    elif body_part == "CHEST":
        ds.StudyDescription = f"{modality} Chest"
        ds.SeriesDescription = f"{modality} Chest"
        ds.BodyPartExamined = "CHEST"
    elif body_part == "ABDOMEN":
        ds.StudyDescription = f"{modality} Abdomen"
        ds.SeriesDescription = f"{modality} Abdomen"
        ds.BodyPartExamined = "ABDOMEN"
    
    # Image data
    if modality == "CT":
        rows, cols = 512, 512
        ds.WindowCenter = "40"
        ds.WindowWidth = "400"
    elif modality == "MR":
        rows, cols = 256, 256
        ds.WindowCenter = "128"
        ds.WindowWidth = "256"
    else:  # X-ray
        rows, cols = 1024, 1024
        ds.WindowCenter = "128"
        ds.WindowWidth = "256"
    
    ds.Rows = rows
    ds.Columns = cols
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.SamplesPerPixel = 1
    
    # Generate synthetic image data
    if body_part == "HEAD":
        # Create a simple brain-like pattern
        center_x, center_y = cols // 2, rows // 2
        y, x = np.ogrid[:rows, :cols]
        
        # Create circular brain outline
        brain_mask = (x - center_x)**2 + (y - center_y)**2 < (min(rows, cols) * 0.4)**2
        
        # Add some internal structure
        pixel_array = np.zeros((rows, cols), dtype=np.uint16)
        pixel_array[brain_mask] = 1000 + np.random.normal(0, 200, np.sum(brain_mask))
        
        # Add some "ventricles"
        ventricle_mask = (x - center_x)**2 + (y - center_y)**2 < (min(rows, cols) * 0.1)**2
        pixel_array[ventricle_mask] = 200 + np.random.normal(0, 50, np.sum(ventricle_mask))
        
    elif body_part == "CHEST":
        # Create a chest-like pattern
        pixel_array = np.random.normal(800, 300, (rows, cols)).astype(np.uint16)
        
        # Add lung areas (darker)
        lung_left = (slice(rows//4, 3*rows//4), slice(cols//6, 2*cols//5))
        lung_right = (slice(rows//4, 3*rows//4), slice(3*cols//5, 5*cols//6))
        pixel_array[lung_left] = np.random.normal(200, 100, pixel_array[lung_left].shape)
        pixel_array[lung_right] = np.random.normal(200, 100, pixel_array[lung_right].shape)
        
        # Add heart shadow
        heart_area = (slice(rows//3, 2*rows//3), slice(2*cols//5, 3*cols//5))
        pixel_array[heart_area] = np.random.normal(1200, 200, pixel_array[heart_area].shape)
        
    else:  # ABDOMEN
        # Create an abdomen-like pattern
        pixel_array = np.random.normal(600, 200, (rows, cols)).astype(np.uint16)
        
        # Add some organ-like structures
        liver_area = (slice(rows//6, rows//2), slice(cols//2, 5*cols//6))
        pixel_array[liver_area] = np.random.normal(1000, 150, pixel_array[liver_area].shape)
        
        spine_area = (slice(rows//4, 3*rows//4), slice(2*cols//5, 3*cols//5))
        pixel_array[spine_area] = np.random.normal(1500, 200, pixel_array[spine_area].shape)
    
    # Ensure values are in valid range
    pixel_array = np.clip(pixel_array, 0, 4095).astype(np.uint16)
    ds.PixelData = pixel_array.tobytes()
    
    return ds

def create_imaging_study_with_dicom(patient, modality, body_part, num_slices=3):
    """Create a complete imaging study with DICOM files"""
    db = SessionLocal()
    
    try:
        # Generate UIDs
        study_uid = generate_uid()
        series_uid = generate_uid()
        
        # Create study directory
        study_dir = os.path.join(UPLOAD_DIR, study_uid)
        series_dir = os.path.join(study_dir, series_uid)
        os.makedirs(series_dir, exist_ok=True)
        
        # Prepare patient info
        patient_info = {
            'first_name': patient.first_name,
            'last_name': patient.last_name,
            'mrn': patient.mrn,
            'dob': patient.date_of_birth,
            'gender': patient.gender
        }
        
        # Create DICOM study record
        study_description = f"{modality} {body_part.title()}"
        dicom_study = DICOMStudy(
            study_instance_uid=study_uid,
            patient_id=patient.id,
            study_date=datetime.now(),
            study_description=study_description,
            modality=modality,
            patient_name=f"{patient.first_name}^{patient.last_name}",
            patient_birth_date=patient.date_of_birth,
            patient_sex=patient.gender[0].upper(),
            storage_path=study_dir,
            upload_status='complete',
            number_of_series=1,
            number_of_instances=num_slices
        )
        db.add(dicom_study)
        db.flush()
        
        # Create DICOM series record
        dicom_series = DICOMSeries(
            series_instance_uid=series_uid,
            study_id=dicom_study.id,
            series_number=1,
            series_description=study_description,
            modality=modality,
            body_part_examined=body_part,
            storage_path=series_dir,
            number_of_instances=num_slices
        )
        db.add(dicom_series)
        db.flush()
        
        # Create DICOM instances
        for i in range(num_slices):
            instance_uid = generate_uid()
            instance_number = i + 1
            
            # Create DICOM file
            ds = create_sample_dicom(study_uid, series_uid, instance_uid, instance_number, 
                                   modality, body_part, patient_info)
            
            # Save DICOM file
            dicom_filename = f"{instance_uid}.dcm"
            dicom_filepath = os.path.join(series_dir, dicom_filename)
            ds.save_as(dicom_filepath)
            
            # Create database record
            file_size_kb = os.path.getsize(dicom_filepath) / 1024
            dicom_instance = DICOMInstance(
                sop_instance_uid=instance_uid,
                series_id=dicom_series.id,
                instance_number=instance_number,
                sop_class_uid=ds.SOPClassUID,
                rows=int(ds.Rows),
                columns=int(ds.Columns),
                bits_allocated=int(ds.BitsAllocated),
                bits_stored=int(ds.BitsStored),
                photometric_interpretation=ds.PhotometricInterpretation,
                window_center=ds.WindowCenter,
                window_width=ds.WindowWidth,
                file_size_kb=file_size_kb,
                transfer_syntax_uid="1.2.840.10008.1.2",
                has_pixel_data=True,
                file_path=dicom_filepath
            )
            db.add(dicom_instance)
        
        db.commit()
        print(f"✅ Created {study_description} for {patient.first_name} {patient.last_name} ({num_slices} images)")
        return dicom_study
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating study for {patient.first_name} {patient.last_name}: {e}")
        return None
    finally:
        db.close()

def main():
    """Create additional imaging studies for patients"""
    db = SessionLocal()
    
    try:
        print("=== Creating Additional Imaging Studies ===")
        
        # Get patients without imaging studies
        patients_with_imaging = db.query(Patient.id).join(DICOMStudy).distinct().all()
        patients_with_imaging_ids = [p.id for p in patients_with_imaging]
        
        patients_without_imaging = db.query(Patient).filter(
            ~Patient.id.in_(patients_with_imaging_ids)
        ).limit(10).all()  # Get up to 10 patients
        
        print(f"Found {len(patients_without_imaging)} patients without imaging")
        
        # Define study templates
        study_templates = [
            ("CT", "HEAD", 5),
            ("CT", "CHEST", 3),
            ("CT", "ABDOMEN", 4),
            ("MR", "HEAD", 3),
            ("XR", "CHEST", 1),
        ]
        
        created_studies = 0
        
        for i, patient in enumerate(patients_without_imaging):
            if created_studies >= 15:  # Limit total studies created
                break
                
            # Randomly assign 1-2 studies per patient
            num_studies = random.randint(1, 2)
            selected_templates = random.sample(study_templates, min(num_studies, len(study_templates)))
            
            for modality, body_part, num_slices in selected_templates:
                study = create_imaging_study_with_dicom(patient, modality, body_part, num_slices)
                if study:
                    created_studies += 1
        
        print(f"\n✅ Created {created_studies} additional imaging studies")
        
        # Show summary
        total_studies = db.query(DICOMStudy).count()
        total_patients_with_imaging = db.query(Patient.id).join(DICOMStudy).distinct().count()
        
        print(f"\n=== Summary ===")
        print(f"Total DICOM studies: {total_studies}")
        print(f"Total patients with imaging: {total_patients_with_imaging}")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()