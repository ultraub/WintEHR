#!/usr/bin/env python3
"""
Create generic DICOM files for upload testing
These files have minimal patient info and can be uploaded to any patient
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
from datetime import datetime

def create_generic_dicom(filename, modality="CT", body_part="HEAD", instance_number=1):
    """Create a generic DICOM file with minimal patient information"""
    
    # Create basic DICOM dataset
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.ImplementationClassUID = "1.2.826.0.1.3680043.8.498.1"
    file_meta.TransferSyntaxUID = "1.2.840.10008.1.2"  # Implicit VR Little Endian
    
    # Create main dataset
    ds = FileDataset("", {}, file_meta=file_meta, preamble=b"\0" * 128)
    
    # Minimal patient information (will be overridden by upload process)
    ds.PatientName = "TEST^PATIENT"
    ds.PatientID = "TEST123"
    ds.PatientBirthDate = "19900101"
    ds.PatientSex = "O"  # Other/Unknown
    
    # Study information
    ds.StudyInstanceUID = generate_uid()
    ds.StudyDate = datetime.now().strftime('%Y%m%d')
    ds.StudyTime = datetime.now().strftime('%H%M%S')
    ds.AccessionNumber = f"TEST{instance_number:03d}"
    
    # Series information
    ds.SeriesInstanceUID = generate_uid()
    ds.SeriesNumber = 1
    ds.SeriesDate = ds.StudyDate
    ds.SeriesTime = ds.StudyTime
    
    # Instance information
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"
    ds.InstanceNumber = instance_number
    
    # Modality-specific information
    ds.Modality = modality
    if body_part == "HEAD":
        ds.StudyDescription = f"Generic {modality} Head"
        ds.SeriesDescription = f"Generic {modality} Head"
        ds.BodyPartExamined = "HEAD"
        rows, cols = 512, 512
        if modality == "CT":
            ds.WindowCenter = "40"
            ds.WindowWidth = "400"
        else:
            ds.WindowCenter = "128"
            ds.WindowWidth = "256"
    elif body_part == "CHEST":
        ds.StudyDescription = f"Generic {modality} Chest"
        ds.SeriesDescription = f"Generic {modality} Chest" 
        ds.BodyPartExamined = "CHEST"
        rows, cols = 1024, 1024 if modality == "XR" else 512
        ds.WindowCenter = "128"
        ds.WindowWidth = "256"
    
    # Image data
    ds.Rows = rows
    ds.Columns = cols
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.SamplesPerPixel = 1
    ds.SliceLocation = float(instance_number * 5)  # 5mm spacing
    
    # Generate simple test pattern
    if body_part == "HEAD":
        # Create a simple circular pattern
        center_x, center_y = cols // 2, rows // 2
        y, x = np.ogrid[:rows, :cols]
        
        # Create circular pattern
        circle_mask = (x - center_x)**2 + (y - center_y)**2 < (min(rows, cols) * 0.3)**2
        pixel_array = np.zeros((rows, cols), dtype=np.uint16)
        pixel_array[circle_mask] = 1000 + np.random.normal(0, 100, np.sum(circle_mask))
        
        # Add center dot
        center_mask = (x - center_x)**2 + (y - center_y)**2 < (min(rows, cols) * 0.05)**2
        pixel_array[center_mask] = 2000
        
    else:  # CHEST
        # Create a simple chest-like pattern
        pixel_array = np.random.normal(500, 100, (rows, cols)).astype(np.uint16)
        
        # Add symmetric "lung" areas
        lung_mask = np.zeros((rows, cols), dtype=bool)
        lung_mask[rows//4:3*rows//4, cols//6:2*cols//5] = True  # Left lung
        lung_mask[rows//4:3*rows//4, 3*cols//5:5*cols//6] = True  # Right lung
        pixel_array[lung_mask] = np.random.normal(100, 50, np.sum(lung_mask))
    
    # Ensure values are in valid range
    pixel_array = np.clip(pixel_array, 0, 4095).astype(np.uint16)
    ds.PixelData = pixel_array.tobytes()
    
    return ds

def main():
    """Create generic DICOM files for testing"""
    
    # Create output directory
    output_dir = "./data/generic_dicoms"
    os.makedirs(output_dir, exist_ok=True)
    
    print("=== Creating Generic DICOM Files for Upload Testing ===")
    
    # Create different types of generic files
    test_files = [
        ("generic_ct_head_001.dcm", "CT", "HEAD", 1),
        ("generic_ct_head_002.dcm", "CT", "HEAD", 2),
        ("generic_ct_head_003.dcm", "CT", "HEAD", 3),
        ("generic_ct_chest_001.dcm", "CT", "CHEST", 1),
        ("generic_xr_chest_001.dcm", "XR", "CHEST", 1),
    ]
    
    for filename, modality, body_part, instance_num in test_files:
        filepath = os.path.join(output_dir, filename)
        
        # Create DICOM dataset
        ds = create_generic_dicom(filename, modality, body_part, instance_num)
        
        # Save file
        ds.save_as(filepath)
        
        print(f"✅ Created: {filename} ({modality} {body_part})")
    
    print(f"\n✅ Created {len(test_files)} generic DICOM files in: {output_dir}")
    print("\nThese files can be uploaded to ANY patient - they contain generic patient info")
    print("that will be overridden during the upload process.")
    
    # Show usage instructions
    print("\n=== Usage Instructions ===")
    print("1. Select any patient in the frontend")
    print("2. Navigate to Results > Imaging tab")
    print("3. Click 'Upload DICOM'")
    print("4. Select files from: backend/data/generic_dicoms/")
    print("5. The uploaded study will be assigned to the selected patient")

if __name__ == "__main__":
    main()