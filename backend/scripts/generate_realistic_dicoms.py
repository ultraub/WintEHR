#!/usr/bin/env python3
"""Generate DICOM files for existing ImagingStudy resources."""

import asyncio
import asyncpg
import json
import os
import sys
from pathlib import Path
import random
import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
from datetime import datetime
import uuid
from PIL import Image, ImageDraw, ImageFont

async def generate_dicom_for_studies():
    # Connect to database
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    try:
        # Get all imaging studies with their patient references
        studies = await conn.fetch("""
            SELECT 
                r.id, 
                r.resource,
                p.resource as patient_resource
            FROM fhir.resources r
            JOIN fhir.search_params sp ON r.id = sp.resource_id
            JOIN fhir.resources p ON (
                sp.value_reference = 'Patient/' || p.fhir_id 
                OR sp.value_reference = p.fhir_id
            )
            WHERE r.resource_type = 'ImagingStudy'
            AND p.resource_type = 'Patient'
            AND r.deleted = false
            AND sp.param_name = 'patient'
            ORDER BY r.last_updated DESC
        """)
        
        print(f"Found {len(studies)} imaging studies to generate DICOM for")
        
        # Base directory for DICOM files
        dicom_base = Path("/app/data/generated_dicoms")
        dicom_base.mkdir(parents=True, exist_ok=True)
        
        generated_count = 0
        
        for study_row in studies:
            study_resource = json.loads(study_row['resource'])
            patient_resource = json.loads(study_row['patient_resource'])
            
            # Extract study information
            study_id = study_resource.get('id')
            study_uid = study_resource.get('identifier', [{}])[0].get('value', generate_uid())
            study_date = study_resource.get('started', datetime.now().isoformat())
            study_description = study_resource.get('description', 'Unknown Study')
            
            # Extract patient information
            patient_name = 'Unknown'
            if 'name' in patient_resource and patient_resource['name']:
                name = patient_resource['name'][0]
                patient_name = f"{name.get('family', '')}, {' '.join(name.get('given', []))}"
            patient_id = patient_resource.get('id', 'unknown')
            
            # Determine study type and parameters
            modality_code = 'CT'  # Default
            if 'modality' in study_resource and study_resource['modality']:
                modality_code = study_resource['modality'][0].get('code', 'CT')
            
            # Determine study type from description
            study_type = determine_study_type(study_description, modality_code)
            
            # Generate unique directory name based on study ID
            dir_name = f"{study_type}_{study_id.replace('-', '')}"
            study_dir = dicom_base / dir_name
            
            # Skip if already exists
            if study_dir.exists():
                print(f"DICOM directory already exists for {study_id}: {dir_name}")
                continue
            
            study_dir.mkdir(parents=True, exist_ok=True)
            
            # Get series information from the study
            series_list = study_resource.get('series', [])
            if not series_list:
                # Create default series
                series_list = [{
                    'uid': generate_uid(),
                    'number': 1,
                    'modality': {'code': modality_code},
                    'numberOfInstances': get_instance_count(study_type),
                    'description': study_description
                }]
            
            # Generate DICOM files for each series
            for series in series_list:
                series_uid = series.get('uid', generate_uid())
                series_number = series.get('number', 1)
                num_instances = series.get('numberOfInstances', get_instance_count(study_type))
                
                print(f"Generating {num_instances} DICOM files for study {study_id}, series {series_number}")
                
                for instance_num in range(1, num_instances + 1):
                    # Create DICOM dataset
                    ds = create_dicom_dataset(
                        patient_id=patient_id,
                        patient_name=patient_name,
                        study_uid=study_uid,
                        study_date=study_date,
                        study_description=study_description,
                        series_uid=series_uid,
                        series_number=series_number,
                        instance_number=instance_num,
                        modality=modality_code,
                        study_type=study_type
                    )
                    
                    # Save DICOM file
                    filename = f"{series_number:03d}_{instance_num:04d}.dcm"
                    filepath = study_dir / filename
                    ds.save_as(str(filepath))
            
            # Update the ImagingStudy resource with the DICOM directory
            if 'extension' not in study_resource:
                study_resource['extension'] = []
            
            # Remove any existing dicom directory extension
            study_resource['extension'] = [ext for ext in study_resource['extension'] 
                                         if not (ext.get('url') == 'http://example.org/fhir/StructureDefinition/dicom-directory')]
            
            # Add new extension
            study_resource['extension'].append({
                'url': 'http://example.org/fhir/StructureDefinition/dicom-directory',
                'valueString': dir_name
            })
            
            # Update the resource
            await conn.execute("""
                UPDATE fhir.resources
                SET resource = $1,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = $2
            """, json.dumps(study_resource), study_row['id'])
            
            generated_count += 1
            print(f"Generated DICOM files for study {study_id} in {dir_name}")
        
        print(f"\nSuccessfully generated DICOM files for {generated_count} imaging studies")
        
    finally:
        await conn.close()


def determine_study_type(description, modality):
    """Determine study type from description and modality."""
    desc_lower = description.lower()
    
    if modality == 'CT':
        if 'chest' in desc_lower:
            return 'CT_CHEST'
        elif 'head' in desc_lower or 'brain' in desc_lower:
            return 'CT_HEAD'
        else:
            return 'CT_CHEST'  # Default CT
    elif modality == 'MR':
        if 'brain' in desc_lower:
            return 'MR_BRAIN'
        elif 'spine' in desc_lower:
            return 'MR_SPINE'
        else:
            return 'MR_BRAIN'  # Default MR
    elif modality in ['CR', 'DX']:
        return 'XR_CHEST'
    elif modality == 'US':
        return 'US_ABDOMEN'
    else:
        return 'CT_CHEST'  # Default fallback


def get_instance_count(study_type):
    """Get appropriate instance count for study type."""
    counts = {
        'CT_CHEST': 64,
        'CT_HEAD': 32,
        'MR_BRAIN': 176,
        'MR_SPINE': 120,
        'XR_CHEST': 2,
        'US_ABDOMEN': 30
    }
    return counts.get(study_type, 30)


def create_dicom_dataset(patient_id, patient_name, study_uid, study_date, 
                        study_description, series_uid, series_number, 
                        instance_number, modality, study_type):
    """Create a DICOM dataset with realistic metadata and simple test pattern image."""
    
    # File meta info
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.2'  # CT Image Storage
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.ImplementationClassUID = generate_uid()
    file_meta.TransferSyntaxUID = '1.2.840.10008.1.2.1'  # Explicit VR Little Endian
    
    # Main dataset
    ds = FileDataset(None, {}, file_meta=file_meta, preamble=b"\0" * 128)
    
    # Patient info
    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.PatientBirthDate = '19700101'
    ds.PatientSex = 'U'
    
    # Study info
    ds.StudyInstanceUID = study_uid
    ds.StudyDate = datetime.fromisoformat(study_date.replace('Z', '+00:00')).strftime('%Y%m%d')
    ds.StudyTime = datetime.fromisoformat(study_date.replace('Z', '+00:00')).strftime('%H%M%S')
    ds.StudyDescription = study_description
    ds.AccessionNumber = str(uuid.uuid4())[:16]
    
    # Series info
    ds.SeriesInstanceUID = series_uid
    ds.SeriesNumber = series_number
    ds.SeriesDescription = f"{study_description} - Series {series_number}"
    
    # Instance info
    ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
    ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
    ds.InstanceNumber = instance_number
    
    # Equipment info
    ds.Modality = modality
    ds.Manufacturer = 'MedGenEMR'
    ds.InstitutionName = 'MedGenEMR Teaching Hospital'
    ds.StationName = 'EMR001'
    
    # Image info
    image_size = 512
    ds.Rows = image_size
    ds.Columns = image_size
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = 'MONOCHROME2'
    
    # Image-specific parameters
    if modality == 'CT':
        ds.RescaleIntercept = -1024
        ds.RescaleSlope = 1
        ds.WindowCenter = 40
        ds.WindowWidth = 400
        ds.PixelSpacing = [0.7, 0.7]
        ds.SliceThickness = 5.0
    elif modality == 'MR':
        ds.WindowCenter = 600
        ds.WindowWidth = 1200
        ds.PixelSpacing = [0.5, 0.5]
        ds.SliceThickness = 3.0
    else:
        ds.WindowCenter = 128
        ds.WindowWidth = 256
        ds.PixelSpacing = [1.0, 1.0]
    
    # Generate test pattern image
    pixel_array = generate_test_pattern(image_size, modality, instance_number, study_type)
    
    # Convert to appropriate data type
    if ds.BitsAllocated == 16:
        pixel_array = pixel_array.astype(np.uint16)
    else:
        pixel_array = pixel_array.astype(np.uint8)
    
    ds.PixelData = pixel_array.tobytes()
    
    # Fix the meta info
    ds.is_little_endian = True
    ds.is_implicit_VR = False
    
    return ds


def generate_test_pattern(size, modality, slice_num, study_type):
    """Generate a test pattern image appropriate for the modality."""
    # Create base image
    image = np.zeros((size, size), dtype=np.float32)
    
    # Add modality-specific patterns
    if modality == 'CT':
        # Create circular phantom with different density regions
        center_x, center_y = size // 2, size // 2
        
        # Outer circle (soft tissue)
        for i in range(size):
            for j in range(size):
                dist = np.sqrt((i - center_x)**2 + (j - center_y)**2)
                if dist < size * 0.4:
                    image[i, j] = 1000 + 100 * np.sin(dist / 10)
        
        # Inner structures
        if 'CHEST' in study_type:
            # Simulate lungs (low density)
            image[center_x-80:center_x+80, center_y-120:center_y-20] = 500
            image[center_x-80:center_x+80, center_y+20:center_y+120] = 500
            # Simulate spine (high density)
            image[center_x-20:center_x+20, center_y-10:center_y+10] = 2000
        elif 'HEAD' in study_type:
            # Simulate skull (high density ring)
            for i in range(size):
                for j in range(size):
                    dist = np.sqrt((i - center_x)**2 + (j - center_y)**2)
                    if size * 0.35 < dist < size * 0.4:
                        image[i, j] = 2500
                    elif dist < size * 0.35:
                        image[i, j] = 1000 + 50 * np.sin(slice_num / 5)
    
    elif modality == 'MR':
        # Create gradient pattern with tissue contrast
        for i in range(size):
            for j in range(size):
                dist = np.sqrt((i - center_x)**2 + (j - center_y)**2)
                if dist < size * 0.4:
                    # Vary intensity based on "tissue type"
                    angle = np.arctan2(j - center_y, i - center_x)
                    image[i, j] = 2000 + 1000 * np.sin(angle * 3 + slice_num / 10)
    
    elif modality in ['CR', 'DX']:
        # Simple chest X-ray pattern
        image[:, :] = 500  # Background
        # Simulate ribcage
        for i in range(5):
            y = int(size * 0.2 + i * size * 0.1)
            image[y-5:y+5, int(size*0.2):int(size*0.8)] = 2000
        # Simulate lungs
        image[int(size*0.3):int(size*0.7), int(size*0.2):int(size*0.4)] = 100
        image[int(size*0.3):int(size*0.7), int(size*0.6):int(size*0.8)] = 100
    
    elif modality == 'US':
        # Ultrasound speckle pattern
        speckle = np.random.randn(size, size) * 100 + 1000
        # Add cone shape for ultrasound sector
        for i in range(size):
            for j in range(size):
                if j < size * 0.1 or abs(i - size/2) > j * 0.4:
                    image[i, j] = 0
                else:
                    image[i, j] = speckle[i, j] * (1 - j / size)
    
    # Add slice number text - skip for now to avoid conversion issues
    # Will add text overlay in post-processing if needed
    
    return image


if __name__ == '__main__':
    asyncio.run(generate_dicom_for_studies())