#!/usr/bin/env python3
"""
Generate realistic demo DICOM images for imaging studies
Creates multi-slice DICOM series with proper metadata
"""

import os
import uuid
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import pydicom
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
import random

# DICOM data directory
DICOM_DIR = Path(__file__).parent.parent / "data" / "generated_dicoms"

# Study types and their characteristics
STUDY_TYPES = {
    "CT_CHEST": {
        "modality": "CT",
        "body_part": "CHEST",
        "description": "CT Chest without contrast",
        "slices": 64,
        "slice_thickness": 1.25,
        "pixel_spacing": [0.625, 0.625],
        "image_size": (512, 512),
        "window_center": 40,
        "window_width": 400
    },
    "CT_HEAD": {
        "modality": "CT", 
        "body_part": "HEAD",
        "description": "CT Head without contrast",
        "slices": 32,
        "slice_thickness": 2.5,
        "pixel_spacing": [0.5, 0.5],
        "image_size": (512, 512),
        "window_center": 40,
        "window_width": 80
    },
    "MR_BRAIN": {
        "modality": "MR",
        "body_part": "BRAIN",
        "description": "MRI Brain T1 weighted",
        "slices": 176,
        "slice_thickness": 1.0,
        "pixel_spacing": [1.0, 1.0],
        "image_size": (256, 256),
        "window_center": 300,
        "window_width": 600
    },
    "XR_CHEST": {
        "modality": "CR",
        "body_part": "CHEST",
        "description": "Chest X-ray PA view",
        "slices": 1,
        "slice_thickness": 1.0,
        "pixel_spacing": [0.168, 0.168],
        "image_size": (2048, 2048),
        "window_center": 500,
        "window_width": 1000
    },
    "US_ABDOMEN": {
        "modality": "US",
        "body_part": "ABDOMEN",
        "description": "Ultrasound Abdomen",
        "slices": 1,
        "slice_thickness": 1.0,
        "pixel_spacing": [0.1, 0.1],
        "image_size": (640, 480),
        "window_center": 128,
        "window_width": 256
    }
}

def generate_study_uid():
    """Generate a unique Study Instance UID"""
    return generate_uid()

def generate_series_uid():
    """Generate a unique Series Instance UID"""
    return generate_uid()

def generate_sop_instance_uid():
    """Generate a unique SOP Instance UID"""
    return generate_uid()

def create_synthetic_image_data(image_size, modality, body_part, slice_num=0, total_slices=1):
    """Create synthetic medical image data"""
    rows, cols = image_size
    
    # Base image with noise
    image = np.random.normal(50, 20, (rows, cols)).astype(np.uint16)
    
    # Add anatomical structures based on modality and body part
    if modality == "CT":
        if body_part == "CHEST":
            # Add lung fields (dark areas)
            lung_mask = create_lung_mask(rows, cols)
            image[lung_mask] = np.random.normal(30, 10, np.sum(lung_mask)).astype(np.uint16)
            
            # Add ribs (bright lines)
            add_ribs(image, rows, cols)
            
            # Add heart shadow
            add_heart_shadow(image, rows, cols)
            
        elif body_part == "HEAD":
            # Add brain tissue
            brain_mask = create_brain_mask(rows, cols)
            image[brain_mask] = np.random.normal(40, 15, np.sum(brain_mask)).astype(np.uint16)
            
            # Add skull (bright ring)
            add_skull(image, rows, cols)
            
    elif modality == "MR":
        if body_part == "BRAIN":
            # Add brain structures for MRI
            brain_mask = create_brain_mask(rows, cols)
            image[brain_mask] = np.random.normal(200, 50, np.sum(brain_mask)).astype(np.uint16)
            
            # Add ventricles (dark areas)
            add_ventricles(image, rows, cols)
            
    elif modality in ["CR", "DR"]:  # X-ray
        if body_part == "CHEST":
            # X-ray appearance (inverted from CT)
            lung_mask = create_lung_mask(rows, cols)
            image[lung_mask] = np.random.normal(800, 100, np.sum(lung_mask)).astype(np.uint16)
            
            # Dense structures appear white
            add_ribs_xray(image, rows, cols)
            add_heart_shadow_xray(image, rows, cols)
            
    elif modality == "US":
        # Ultrasound appearance
        image = np.random.normal(100, 30, (rows, cols)).astype(np.uint16)
        add_ultrasound_artifacts(image, rows, cols)
    
    # Ensure values are in valid range
    image = np.clip(image, 0, 4095)
    
    return image

def create_lung_mask(rows, cols):
    """Create a mask for lung fields"""
    y, x = np.ogrid[:rows, :cols]
    center_y, center_x = rows // 2, cols // 2
    
    # Two lung fields
    left_lung = ((y - center_y + 50)**2 / (80**2) + (x - center_x + 80)**2 / (60**2)) < 1
    right_lung = ((y - center_y + 50)**2 / (80**2) + (x - center_x - 80)**2 / (60**2)) < 1
    
    return left_lung | right_lung

def create_brain_mask(rows, cols):
    """Create a mask for brain tissue"""
    y, x = np.ogrid[:rows, :cols]
    center_y, center_x = rows // 2, cols // 2
    
    # Elliptical brain shape
    brain = ((y - center_y)**2 / (100**2) + (x - center_x)**2 / (80**2)) < 1
    return brain

def add_ribs(image, rows, cols):
    """Add rib structures to CT chest"""
    for i in range(6):  # 6 ribs on each side
        y_pos = rows // 4 + i * 20
        for x in range(cols // 4, 3 * cols // 4):
            if 0 <= y_pos < rows:
                curve = int(20 * np.sin(0.02 * (x - cols // 2)))
                if 0 <= y_pos + curve < rows:
                    image[y_pos + curve, x] = min(4095, image[y_pos + curve, x] + 200)

def add_ribs_xray(image, rows, cols):
    """Add rib structures to chest X-ray"""
    for i in range(8):  # More ribs visible on X-ray
        y_pos = rows // 6 + i * 25
        for x in range(cols // 6, 5 * cols // 6):
            if 0 <= y_pos < rows:
                curve = int(30 * np.sin(0.015 * (x - cols // 2)))
                if 0 <= y_pos + curve < rows:
                    image[y_pos + curve, x] = min(4095, image[y_pos + curve, x] + 300)

def add_heart_shadow(image, rows, cols):
    """Add heart shadow to CT chest"""
    y, x = np.ogrid[:rows, :cols]
    center_y, center_x = rows // 2 + 20, cols // 2 - 30
    
    heart = ((y - center_y)**2 / (60**2) + (x - center_x)**2 / (40**2)) < 1
    image[heart] = np.minimum(4095, image[heart] + 150)

def add_heart_shadow_xray(image, rows, cols):
    """Add heart shadow to chest X-ray"""
    y, x = np.ogrid[:rows, :cols]
    center_y, center_x = rows // 2 + 30, cols // 2 - 50
    
    heart = ((y - center_y)**2 / (80**2) + (x - center_x)**2 / (60**2)) < 1
    image[heart] = np.minimum(4095, image[heart] + 400)

def add_skull(image, rows, cols):
    """Add skull outline to CT head"""
    y, x = np.ogrid[:rows, :cols]
    center_y, center_x = rows // 2, cols // 2
    
    # Outer skull
    outer_skull = ((y - center_y)**2 / (120**2) + (x - center_x)**2 / (100**2)) < 1
    inner_skull = ((y - center_y)**2 / (110**2) + (x - center_x)**2 / (90**2)) < 1
    
    skull_bone = outer_skull & ~inner_skull
    image[skull_bone] = 4095  # Bone is very bright on CT

def add_ventricles(image, rows, cols):
    """Add brain ventricles to MRI"""
    y, x = np.ogrid[:rows, :cols]
    center_y, center_x = rows // 2, cols // 2
    
    # Lateral ventricles
    left_ventricle = ((y - center_y)**2 / (20**2) + (x - center_x + 25)**2 / (15**2)) < 1
    right_ventricle = ((y - center_y)**2 / (20**2) + (x - center_x - 25)**2 / (15**2)) < 1
    
    ventricles = left_ventricle | right_ventricle
    image[ventricles] = 50  # CSF is dark on T1

def add_ultrasound_artifacts(image, rows, cols):
    """Add typical ultrasound artifacts"""
    # Add some hypoechoic and hyperechoic areas
    for _ in range(5):
        center_y = random.randint(rows // 4, 3 * rows // 4)
        center_x = random.randint(cols // 4, 3 * cols // 4)
        radius = random.randint(10, 30)
        
        y, x = np.ogrid[:rows, :cols]
        circle = ((y - center_y)**2 + (x - center_x)**2) < radius**2
        
        if random.choice([True, False]):
            image[circle] = np.minimum(255, image[circle] + 50)  # Hyperechoic
        else:
            image[circle] = np.maximum(0, image[circle] - 30)   # Hypoechoic

def create_dicom_dataset(image_data, study_config, study_uid, series_uid, instance_number, 
                        patient_id="DEMO_PATIENT", patient_name="Demo^Patient"):
    """Create a DICOM dataset with proper metadata"""
    
    # File meta information
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
    file_meta.MediaStorageSOPInstanceUID = generate_sop_instance_uid()
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = "1.2.826.0.1.3680043.8.498.1"
    file_meta.ImplementationVersionName = "MedGenEMR_DEMO"
    
    # Main dataset
    ds = Dataset()
    ds.file_meta = file_meta
    
    # Patient information
    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.PatientBirthDate = "19800101"
    ds.PatientSex = "M"
    
    # Study information
    ds.StudyInstanceUID = study_uid
    ds.StudyID = "1"
    ds.StudyDate = datetime.now().strftime("%Y%m%d")
    ds.StudyTime = datetime.now().strftime("%H%M%S")
    ds.StudyDescription = study_config["description"]
    ds.AccessionNumber = f"ACC{random.randint(100000, 999999)}"
    
    # Series information
    ds.SeriesInstanceUID = series_uid
    ds.SeriesNumber = "1"
    ds.SeriesDate = ds.StudyDate
    ds.SeriesTime = ds.StudyTime
    ds.SeriesDescription = study_config["description"]
    ds.Modality = study_config["modality"]
    ds.BodyPartExamined = study_config["body_part"]
    
    # Instance information
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
    ds.InstanceNumber = str(instance_number)
    
    # Image information
    ds.ImageType = ["ORIGINAL", "PRIMARY", "AXIAL"]
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.Rows = study_config["image_size"][0]
    ds.Columns = study_config["image_size"][1]
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    
    # Spacing and position
    ds.PixelSpacing = study_config["pixel_spacing"]
    ds.SliceThickness = str(study_config["slice_thickness"])
    ds.ImagePositionPatient = [0, 0, instance_number * study_config["slice_thickness"]]
    ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    
    # Window/Level for display
    ds.WindowCenter = str(study_config["window_center"])
    ds.WindowWidth = str(study_config["window_width"])
    
    # Pixel data
    ds.PixelData = image_data.tobytes()
    
    return ds

def generate_imaging_study(study_type, patient_id="DEMO_PATIENT", patient_name="Demo^Patient"):
    """Generate a complete imaging study with multiple slices"""
    
    if study_type not in STUDY_TYPES:
        raise ValueError(f"Unknown study type: {study_type}")
    
    config = STUDY_TYPES[study_type]
    study_uid = generate_study_uid()
    series_uid = generate_series_uid()
    
    # Create study directory
    study_dir = DICOM_DIR / f"{study_type}_{study_uid.split('.')[-1]}"
    study_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Generating {study_type} study with {config['slices']} slices...")
    
    dicom_files = []
    
    for slice_num in range(config["slices"]):
        # Generate image data
        image_data = create_synthetic_image_data(
            config["image_size"],
            config["modality"],
            config["body_part"],
            slice_num,
            config["slices"]
        )
        
        # Create DICOM dataset
        ds = create_dicom_dataset(
            image_data,
            config,
            study_uid,
            series_uid,
            slice_num + 1,
            patient_id,
            patient_name
        )
        
        # Save DICOM file
        filename = f"{study_type}_{slice_num + 1:03d}.dcm"
        filepath = study_dir / filename
        ds.save_as(str(filepath))
        dicom_files.append(str(filepath))
        
        if (slice_num + 1) % 10 == 0:
            print(f"  Generated {slice_num + 1}/{config['slices']} slices")
    
    print(f"✅ Study saved to: {study_dir}")
    
    return {
        "study_uid": study_uid,
        "series_uid": series_uid,
        "study_type": study_type,
        "modality": config["modality"],
        "description": config["description"],
        "slices": config["slices"],
        "directory": str(study_dir),
        "files": dicom_files
    }

def generate_patient_imaging_studies(patient_id, patient_name="Demo^Patient"):
    """Generate a comprehensive set of imaging studies for a patient"""
    
    print(f"Generating imaging studies for patient: {patient_id}")
    
    # Generate common study types
    study_types_to_generate = [
        "CT_CHEST",
        "CT_HEAD", 
        "XR_CHEST",
        "US_ABDOMEN"
    ]
    
    # Optionally add MR_BRAIN (takes longer to generate)
    if random.choice([True, False]):
        study_types_to_generate.append("MR_BRAIN")
    
    generated_studies = []
    
    for study_type in study_types_to_generate:
        try:
            study_info = generate_imaging_study(study_type, patient_id, patient_name)
            generated_studies.append(study_info)
        except Exception as e:
            print(f"❌ Failed to generate {study_type}: {e}")
    
    return generated_studies

def main():
    """Main function to generate demo DICOM studies"""
    
    print("=== DICOM Demo Generator ===")
    print("Generating realistic DICOM images for demonstration...")
    
    # Ensure DICOM directory exists
    DICOM_DIR.mkdir(parents=True, exist_ok=True)
    
    # Generate studies for our test patient
    patient_id = "92675303-ca5b-136a-169b-e764c5753f06"
    patient_name = "Test^Patient^Demo"
    
    studies = generate_patient_imaging_studies(patient_id, patient_name)
    
    print(f"\n✅ Generated {len(studies)} imaging studies:")
    for study in studies:
        print(f"  - {study['study_type']}: {study['slices']} slices ({study['modality']})")
        print(f"    Study UID: {study['study_uid']}")
        print(f"    Directory: {study['directory']}")
    
    print(f"\nDICOM files saved to: {DICOM_DIR}")
    print("Studies are ready for import into the EMR system.")

if __name__ == "__main__":
    main()