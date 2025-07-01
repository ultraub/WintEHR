#!/usr/bin/env python3
"""
Generate DICOM files for Synthea imaging studies
Creates realistic DICOM images based on study metadata
"""

import os
import sys
import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
from datetime import datetime
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from PIL import Image, ImageDraw, ImageFont
import random

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import engine
from models.models import Patient, ImagingStudy
from models.dicom_models import DICOMStudy, DICOMSeries, DICOMInstance

# Create session
Session = sessionmaker(bind=engine)

# DICOM modality configurations
MODALITY_CONFIG = {
    'CT': {
        'rows': 512,
        'columns': 512,
        'slices': 5,
        'window_center': 40,
        'window_width': 400,
        'rescale_intercept': -1024,
        'rescale_slope': 1,
        'photometric_interpretation': 'MONOCHROME2',
        'bits_allocated': 16,
        'bits_stored': 12,
        'high_bit': 11,
        'pixel_representation': 0
    },
    'MR': {
        'rows': 256,
        'columns': 256,
        'slices': 3,
        'window_center': 128,
        'window_width': 256,
        'rescale_intercept': 0,
        'rescale_slope': 1,
        'photometric_interpretation': 'MONOCHROME2',
        'bits_allocated': 16,
        'bits_stored': 12,
        'high_bit': 11,
        'pixel_representation': 0
    },
    'US': {
        'rows': 480,
        'columns': 640,
        'slices': 1,
        'window_center': 128,
        'window_width': 256,
        'rescale_intercept': 0,
        'rescale_slope': 1,
        'photometric_interpretation': 'RGB',
        'bits_allocated': 8,
        'bits_stored': 8,
        'high_bit': 7,
        'pixel_representation': 0
    },
    'XR': {
        'rows': 1024,
        'columns': 1024,
        'slices': 1,
        'window_center': 128,
        'window_width': 256,
        'rescale_intercept': 0,
        'rescale_slope': 1,
        'photometric_interpretation': 'MONOCHROME2',
        'bits_allocated': 16,
        'bits_stored': 12,
        'high_bit': 11,
        'pixel_representation': 0
    }
}

# Body part specific patterns
BODY_PART_PATTERNS = {
    'HEAD': lambda img, config: add_circular_pattern(img, 0.5, 0.5, 0.4, intensity=0.7),
    'CHEST': lambda img, config: add_chest_pattern(img),
    'ABDOMEN': lambda img, config: add_abdominal_pattern(img),
    'SPINE': lambda img, config: add_spine_pattern(img),
    'KNEE': lambda img, config: add_joint_pattern(img, 0.5, 0.5),
    'BRAIN': lambda img, config: add_brain_pattern(img),
    'LUNG': lambda img, config: add_lung_pattern(img),
    'HEART': lambda img, config: add_heart_pattern(img)
}


def add_circular_pattern(img, cx, cy, radius, intensity=0.5):
    """Add a circular pattern to simulate anatomical structures"""
    h, w = img.shape
    y, x = np.ogrid[:h, :w]
    mask = ((x - cx * w) ** 2 + (y - cy * h) ** 2) <= (radius * min(h, w)) ** 2
    img[mask] = img[mask] * intensity
    return img


def add_chest_pattern(img):
    """Add chest-like pattern with lungs and heart"""
    h, w = img.shape
    # Left lung
    add_circular_pattern(img, 0.3, 0.5, 0.25, intensity=0.3)
    # Right lung
    add_circular_pattern(img, 0.7, 0.5, 0.25, intensity=0.3)
    # Heart
    add_circular_pattern(img, 0.5, 0.6, 0.15, intensity=0.8)
    # Add some ribs
    for i in range(5):
        y = int(0.3 * h + i * 0.1 * h)
        img[y:y+5, :] *= 0.9
    return img


def add_abdominal_pattern(img):
    """Add abdominal organs pattern"""
    h, w = img.shape
    # Liver (right side)
    add_circular_pattern(img, 0.3, 0.4, 0.2, intensity=0.6)
    # Stomach (left side)
    add_circular_pattern(img, 0.7, 0.4, 0.15, intensity=0.5)
    # Kidneys
    add_circular_pattern(img, 0.25, 0.6, 0.08, intensity=0.7)
    add_circular_pattern(img, 0.75, 0.6, 0.08, intensity=0.7)
    return img


def add_spine_pattern(img):
    """Add spine pattern"""
    h, w = img.shape
    # Vertebrae
    for i in range(5):
        y = int(0.2 * h + i * 0.15 * h)
        add_circular_pattern(img, 0.5, y/h, 0.05, intensity=0.9)
    # Spinal canal
    img[int(0.2*h):int(0.8*h), int(0.48*w):int(0.52*w)] *= 0.3
    return img


def add_joint_pattern(img, cx, cy):
    """Add joint pattern (knee, elbow, etc)"""
    h, w = img.shape
    # Bone ends
    add_circular_pattern(img, cx, cy - 0.15, 0.1, intensity=0.9)
    add_circular_pattern(img, cx, cy + 0.15, 0.1, intensity=0.9)
    # Joint space
    img[int((cy-0.02)*h):int((cy+0.02)*h), :] *= 0.2
    return img


def add_brain_pattern(img):
    """Add brain pattern"""
    h, w = img.shape
    # Brain outline
    add_circular_pattern(img, 0.5, 0.5, 0.4, intensity=0.6)
    # Ventricles
    add_circular_pattern(img, 0.5, 0.5, 0.1, intensity=0.2)
    # Add some texture
    noise = np.random.normal(0, 10, (h, w))
    img = img + noise
    return img


def add_lung_pattern(img):
    """Add detailed lung pattern"""
    h, w = img.shape
    # Lung fields
    add_circular_pattern(img, 0.3, 0.5, 0.3, intensity=0.2)
    add_circular_pattern(img, 0.7, 0.5, 0.3, intensity=0.2)
    # Bronchi
    img[int(0.4*h):int(0.6*h), int(0.45*w):int(0.55*w)] *= 0.7
    return img


def add_heart_pattern(img):
    """Add heart pattern"""
    h, w = img.shape
    # Heart chambers
    add_circular_pattern(img, 0.45, 0.45, 0.1, intensity=0.5)
    add_circular_pattern(img, 0.55, 0.45, 0.1, intensity=0.5)
    add_circular_pattern(img, 0.45, 0.55, 0.1, intensity=0.6)
    add_circular_pattern(img, 0.55, 0.55, 0.1, intensity=0.6)
    return img


def generate_dicom_pixel_data(modality, body_part, rows, columns):
    """Generate realistic pixel data based on modality and body part"""
    
    if modality == 'US':  # Ultrasound is RGB
        # Create RGB ultrasound-like image
        img = np.zeros((rows, columns, 3), dtype=np.uint8)
        # Add some ultrasound-like patterns
        for i in range(10):
            cx = random.random()
            cy = random.random()
            radius = random.uniform(0.05, 0.2)
            color = (random.randint(0, 100), random.randint(0, 100), random.randint(50, 150))
            y, x = np.ogrid[:rows, :columns]
            mask = ((x - cx * columns) ** 2 + (y - cy * rows) ** 2) <= (radius * min(rows, columns)) ** 2
            for c in range(3):
                img[mask, c] = color[c]
        return img
    else:
        # Grayscale image
        # Start with base noise pattern
        img = np.random.normal(128, 30, (rows, columns))
        
        # Apply body part specific pattern
        body_part_upper = body_part.upper() if body_part else 'CHEST'
        for key in BODY_PART_PATTERNS:
            if key in body_part_upper:
                img = BODY_PART_PATTERNS[key](img, MODALITY_CONFIG.get(modality, MODALITY_CONFIG['CT']))
                break
        else:
            # Default pattern if no specific match
            img = add_circular_pattern(img, 0.5, 0.5, 0.3, intensity=0.6)
        
        # Apply modality-specific adjustments
        if modality == 'CT':
            # CT has wider range, add Hounsfield unit simulation
            img = img * 10 - 1000  # Approximate HU scale
        elif modality == 'MR':
            # MR has good soft tissue contrast
            img = np.clip(img, 0, 255)
        elif modality == 'XR':
            # X-ray has high contrast
            img = np.clip(img * 2, 0, 255)
        
        # Ensure proper data type
        if MODALITY_CONFIG.get(modality, {}).get('bits_allocated', 16) == 16:
            img = img.astype(np.uint16)
        else:
            img = img.astype(np.uint8)
            
        return img


def create_dicom_file(patient, study_info, series_info, instance_info, output_path):
    """Create a DICOM file with proper metadata"""
    
    # Create file meta information
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.2'  # CT Image Storage
    file_meta.MediaStorageSOPInstanceUID = instance_info['sop_instance_uid']
    file_meta.ImplementationClassUID = '1.2.3.4'
    file_meta.TransferSyntaxUID = '1.2.840.10008.1.2.1'  # Explicit VR Little Endian
    
    # Create main dataset
    ds = FileDataset(output_path, {}, file_meta=file_meta, preamble=b"\0" * 128)
    
    # Patient information
    ds.PatientName = f"{patient.last_name}^{patient.first_name}^{patient.middle_name or ''}"
    ds.PatientID = patient.mrn or patient.id
    ds.PatientBirthDate = patient.date_of_birth.strftime('%Y%m%d') if patient.date_of_birth else ''
    ds.PatientSex = patient.gender[0].upper() if patient.gender else 'O'
    
    # Study information
    ds.StudyInstanceUID = study_info['study_instance_uid']
    ds.StudyDate = study_info['study_date'].strftime('%Y%m%d')
    ds.StudyTime = study_info['study_date'].strftime('%H%M%S')
    ds.StudyDescription = study_info['description']
    ds.StudyID = str(study_info['id'])
    ds.AccessionNumber = study_info.get('accession_number', '')
    
    # Series information
    ds.SeriesInstanceUID = series_info['series_instance_uid']
    ds.SeriesNumber = series_info['series_number']
    ds.SeriesDescription = series_info.get('series_description', study_info['description'])
    ds.Modality = series_info['modality']
    ds.BodyPartExamined = series_info.get('body_part', '')
    
    # Instance information
    ds.SOPClassUID = '1.2.840.10008.5.1.4.1.1.2'  # CT Image Storage
    ds.SOPInstanceUID = instance_info['sop_instance_uid']
    ds.InstanceNumber = instance_info['instance_number']
    
    # Image information
    config = MODALITY_CONFIG.get(series_info['modality'], MODALITY_CONFIG['CT'])
    ds.Rows = config['rows']
    ds.Columns = config['columns']
    ds.PixelSpacing = [1.0, 1.0]
    ds.SliceThickness = 5.0
    ds.PhotometricInterpretation = config['photometric_interpretation']
    ds.SamplesPerPixel = 3 if config['photometric_interpretation'] == 'RGB' else 1
    ds.BitsAllocated = config['bits_allocated']
    ds.BitsStored = config['bits_stored']
    ds.HighBit = config['high_bit']
    ds.PixelRepresentation = config['pixel_representation']
    
    # Window settings
    ds.WindowCenter = config['window_center']
    ds.WindowWidth = config['window_width']
    ds.RescaleIntercept = config['rescale_intercept']
    ds.RescaleSlope = config['rescale_slope']
    
    # Generate pixel data
    pixel_data = generate_dicom_pixel_data(
        series_info['modality'],
        series_info.get('body_part', ''),
        config['rows'],
        config['columns']
    )
    
    if config['photometric_interpretation'] == 'RGB':
        ds.PlanarConfiguration = 0  # R1G1B1R2G2B2...
        pixel_data = pixel_data.tobytes()
    else:
        pixel_data = pixel_data.tobytes()
    
    ds.PixelData = pixel_data
    
    # Save the file
    ds.save_as(output_path, write_like_original=False)
    
    return os.path.getsize(output_path)


def process_imaging_study(session, imaging_study, upload_dir):
    """Process a single imaging study and generate DICOM files"""
    
    patient = imaging_study.patient
    
    # Determine modality from description
    modality = 'CT'  # Default
    description_lower = imaging_study.description.lower()
    if 'mri' in description_lower or 'mr ' in description_lower:
        modality = 'MR'
    elif 'ultrasound' in description_lower or 'us ' in description_lower:
        modality = 'US'
    elif 'x-ray' in description_lower or 'xr ' in description_lower:
        modality = 'XR'
    
    # Extract body part from description
    body_part = ''
    body_parts = ['head', 'brain', 'chest', 'abdomen', 'spine', 'knee', 'lung', 'heart']
    for part in body_parts:
        if part in description_lower:
            body_part = part.upper()
            break
    
    # Create DICOM study
    study_uid = generate_uid()
    dicom_study = DICOMStudy(
        study_instance_uid=study_uid,
        patient_id=patient.id,
        imaging_study_id=imaging_study.id,
        study_date=imaging_study.study_date,
        study_description=imaging_study.description,
        modality=modality,
        patient_name=f"{patient.last_name}^{patient.first_name}",
        patient_birth_date=patient.date_of_birth,
        patient_sex=patient.gender[0].upper() if patient.gender else 'O',
        number_of_series=1,
        number_of_instances=0,
        upload_status='complete'
    )
    
    # Create storage directory
    study_dir = os.path.join(upload_dir, study_uid)
    os.makedirs(study_dir, exist_ok=True)
    dicom_study.storage_path = study_dir
    
    session.add(dicom_study)
    session.flush()
    
    # Create series
    series_uid = generate_uid()
    dicom_series = DICOMSeries(
        series_instance_uid=series_uid,
        study_id=dicom_study.id,
        series_number=1,
        series_date=imaging_study.study_date,
        series_description=imaging_study.description,
        modality=modality,
        body_part_examined=body_part,
        number_of_instances=0
    )
    
    series_dir = os.path.join(study_dir, series_uid)
    os.makedirs(series_dir, exist_ok=True)
    dicom_series.storage_path = series_dir
    
    session.add(dicom_series)
    session.flush()
    
    # Generate instances (slices)
    config = MODALITY_CONFIG.get(modality, MODALITY_CONFIG['CT'])
    num_slices = config['slices']
    total_size = 0
    
    for i in range(num_slices):
        instance_uid = generate_uid()
        
        # Generate DICOM file
        filename = f"{instance_uid}.dcm"
        filepath = os.path.join(series_dir, filename)
        
        # Create instance record
        dicom_instance = DICOMInstance(
            sop_instance_uid=instance_uid,
            series_id=dicom_series.id,
            instance_number=i + 1,
            rows=config['rows'],
            columns=config['columns'],
            window_center=str(config['window_center']),
            window_width=str(config['window_width']),
            bits_allocated=config.get('bits_allocated', 16),
            bits_stored=config.get('bits_stored', 12),
            photometric_interpretation=config.get('photometric_interpretation', 'MONOCHROME2'),
            file_path=str(filepath),
            file_size_kb=0  # Will be updated after saving
        )
        
        study_info = {
            'study_instance_uid': study_uid,
            'study_date': imaging_study.study_date,
            'description': imaging_study.description,
            'id': dicom_study.id,
            'accession_number': f"ACC{dicom_study.id:06d}"
        }
        
        series_info = {
            'series_instance_uid': series_uid,
            'series_number': 1,
            'series_description': imaging_study.description,
            'modality': modality,
            'body_part': body_part
        }
        
        instance_info = {
            'sop_instance_uid': instance_uid,
            'instance_number': i + 1
        }
        
        file_size = create_dicom_file(patient, study_info, series_info, instance_info, filepath)
        
        dicom_instance.file_path = filepath
        dicom_instance.file_size_kb = file_size / 1024.0
        total_size += file_size
        
        session.add(dicom_instance)
    
    # Update counts
    dicom_series.number_of_instances = num_slices
    dicom_series.series_size_mb = total_size / (1024 * 1024)
    dicom_study.number_of_instances = num_slices
    dicom_study.study_size_mb = total_size / (1024 * 1024)
    
    session.commit()
    
    return dicom_study


def main():
    """Generate DICOM files for all Synthea imaging studies"""
    
    session = Session()
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'dicom_uploads')
    os.makedirs(upload_dir, exist_ok=True)
    
    print("=== Synthea DICOM Generation ===")
    print()
    
    # Get imaging studies without DICOM data
    imaging_studies = session.query(ImagingStudy).filter(
        ImagingStudy.dicom_study == None
    ).all()
    
    print(f"Found {len(imaging_studies)} imaging studies without DICOM files")
    print()
    
    # Process each study
    for i, study in enumerate(imaging_studies):
        print(f"Processing {i+1}/{len(imaging_studies)}: {study.description} for {study.patient.first_name} {study.patient.last_name}")
        
        try:
            dicom_study = process_imaging_study(session, study, upload_dir)
            print(f"  ✓ Created DICOM study with {dicom_study.number_of_instances} images")
        except Exception as e:
            print(f"  ✗ Error: {e}")
            session.rollback()
            continue
    
    print()
    print("✅ DICOM generation complete!")
    
    # Summary
    total_studies = session.query(DICOMStudy).count()
    total_images = session.query(DICOMInstance).count()
    print(f"\nTotal DICOM studies: {total_studies}")
    print(f"Total DICOM images: {total_images}")
    
    session.close()


if __name__ == "__main__":
    main()