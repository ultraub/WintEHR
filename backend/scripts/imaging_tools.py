#!/usr/bin/env python3
"""
Consolidated Imaging and DICOM Tools

Provides functionality for:
- Generating DICOM files for existing imaging studies
- Creating generic DICOM files for testing
- Adding imaging studies to patients
- Managing DICOM metadata

This script consolidates functionality from multiple imaging-related scripts.
"""

import argparse
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
import random
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import logging


# Load environment
load_dotenv()


class ImagingToolkit:
    """Comprehensive imaging and DICOM management toolkit."""
    
    def __init__(self):
        # Setup database connection
        DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@localhost:5432/emr_db')
        self.engine = create_engine(DATABASE_URL.replace('+asyncpg', ''))
        
        # DICOM storage path
        self.dicom_dir = Path(__file__).parent.parent / "data" / "dicom_uploads"
        self.dicom_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_dicom_for_studies(self, patient_id=None):
        """Generate DICOM files for existing imaging studies."""
        logging.info("🏥 Generating DICOM files for imaging studies...")
        with Session(self.engine) as session:
            # Find imaging studies
            query = "SELECT id, patient_id, modality_list, description FROM imaging_studies"
            params = {}
            if patient_id:
                query += " WHERE patient_id = :patient_id"
                params['patient_id'] = patient_id
                
            result = session.execute(text(query), params)
            studies = result.fetchall()
            
            logging.info(f"Found {len(studies)} imaging studies")
            for study in studies:
                self._create_dicom_for_study(study)
                
        logging.info("✅ DICOM generation complete")
    def create_generic_dicoms(self, count=5):
        """Create generic DICOM files for testing."""
        logging.info(f"Creating {count} generic DICOM files...")
        modalities = ['CT', 'MR', 'XR', 'US', 'DX']
        body_parts = ['HEAD', 'CHEST', 'ABDOMEN', 'EXTREMITY', 'SPINE']
        
        for i in range(count):
            modality = random.choice(modalities)
            body_part = random.choice(body_parts)
            
            # Create DICOM dataset
            ds = self._create_base_dicom_dataset()
            
            # Set specific attributes
            ds.Modality = modality
            ds.StudyDescription = f"Test {body_part} {modality}"
            ds.SeriesDescription = f"{body_part} {modality} Series"
            ds.BodyPartExamined = body_part
            
            # Generate test image
            if modality in ['CT', 'MR']:
                pixel_array = self._generate_cross_section_image(body_part)
            else:
                pixel_array = self._generate_projection_image(body_part)
                
            ds.PixelData = pixel_array.tobytes()
            ds.Rows, ds.Columns = pixel_array.shape
            
            # Save file
            filename = f"generic_{modality.lower()}_{body_part.lower()}_{i:03d}.dcm"
            filepath = self.dicom_dir / "generic" / filename
            filepath.parent.mkdir(exist_ok=True)
            
            ds.save_as(filepath, write_like_original=False)
            logging.info(f"✅ Created {filename}")
    def add_imaging_to_patients(self, count_per_patient=1):
        """Add imaging studies to patients who don't have any."""
        logging.info("Adding imaging studies to patients...")
        with Session(self.engine) as session:
            # Find patients without imaging
            query = """
                SELECT p.id, p.first_name, p.last_name 
                FROM patients p
                LEFT JOIN imaging_studies i ON p.id = i.patient_id
                WHERE i.id IS NULL
                LIMIT 10
            """
            result = session.execute(text(query))
            patients = result.fetchall()
            
            logging.info(f"Found {len(patients)} patients without imaging")
            modalities = ['CT', 'MR', 'XR', 'US']
            procedures = {
                'CT': ['Head CT', 'Chest CT', 'Abdomen CT'],
                'MR': ['Brain MRI', 'Spine MRI', 'Knee MRI'],
                'XR': ['Chest X-Ray', 'Hand X-Ray', 'Spine X-Ray'],
                'US': ['Abdominal US', 'Cardiac US', 'Thyroid US']
            }
            
            for patient in patients:
                for _ in range(count_per_patient):
                    modality = random.choice(modalities)
                    procedure = random.choice(procedures[modality])
                    
                    # Create ImagingStudy resource
                    study_data = {
                        "resourceType": "ImagingStudy",
                        "id": str(uuid.uuid4()),
                        "status": "available",
                        "subject": {
                            "reference": f"Patient/{patient.id}",
                            "display": f"{patient.first_name} {patient.last_name}"
                        },
                        "started": datetime.utcnow().isoformat() + "Z",
                        "modality": [{
                            "system": "http://dicom.nema.org/resources/ontology/DCM",
                            "code": modality
                        }],
                        "description": procedure,
                        "numberOfSeries": 1,
                        "numberOfInstances": random.randint(1, 5)
                    }
                    
                    # Save using FHIR API
                    import requests
                    try:
                        response = requests.post(
                            "http://localhost:8000/fhir/R4/ImagingStudy",
                            json=study_data
                        )
                        if response.status_code == 201:
                            logging.info(f"✅ Added {procedure} for {patient.first_name} {patient.last_name}")
                    except:
                        pass
                        
    def _create_base_dicom_dataset(self):
        """Create a base DICOM dataset with common attributes."""
        # Create file meta
        file_meta = Dataset()
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.2'  # CT Image Storage
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.ImplementationClassUID = '1.2.3.4'
        file_meta.TransferSyntaxUID = '1.2.840.10008.1.2'  # Implicit VR Little Endian
        
        # Create dataset
        ds = FileDataset(None, {}, file_meta=file_meta, preamble=b"\\0" * 128)
        
        # Patient info
        ds.PatientName = "Test^Patient"
        ds.PatientID = str(uuid.uuid4())[:8]
        ds.PatientBirthDate = "19800101"
        ds.PatientSex = "M"
        
        # Study info
        ds.StudyInstanceUID = generate_uid()
        ds.StudyDate = datetime.now().strftime("%Y%m%d")
        ds.StudyTime = datetime.now().strftime("%H%M%S")
        ds.AccessionNumber = str(random.randint(1000000, 9999999))
        
        # Series info
        ds.SeriesInstanceUID = generate_uid()
        ds.SeriesNumber = "1"
        
        # Instance info
        ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.InstanceNumber = "1"
        
        # Image info
        ds.ImageType = ['ORIGINAL', 'PRIMARY', 'AXIAL']
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 1
        
        return ds
        
    def _generate_cross_section_image(self, body_part, size=(512, 512)):
        """Generate a cross-sectional image (CT/MR style)."""
        arr = np.zeros(size, dtype=np.uint16)
        
        # Add circular anatomy
        center = (size[0] // 2, size[1] // 2)
        radius = size[0] // 3
        
        y, x = np.ogrid[:size[0], :size[1]]
        mask = (x - center[0])**2 + (y - center[1])**2 <= radius**2
        arr[mask] = 1000 + np.random.randint(0, 500, size=mask.sum())
        
        # Add some internal structures
        for _ in range(random.randint(3, 8)):
            small_radius = random.randint(10, 50)
            offset_x = random.randint(-radius//2, radius//2)
            offset_y = random.randint(-radius//2, radius//2)
            
            small_mask = (x - center[0] - offset_x)**2 + (y - center[1] - offset_y)**2 <= small_radius**2
            arr[small_mask] = 1500 + np.random.randint(0, 500)
            
        return arr
        
    def _generate_projection_image(self, body_part, size=(512, 512)):
        """Generate a projection image (X-ray style)."""
        arr = np.ones(size, dtype=np.uint16) * 2000
        
        # Add some anatomical shapes
        if body_part == "CHEST":
            # Add lung fields
            for offset in [-100, 100]:
                center = (size[0] // 2 + offset, size[1] // 2)
                y, x = np.ogrid[:size[0], :size[1]]
                mask = ((x - center[0])/80)**2 + ((y - center[1])/120)**2 <= 1
                arr[mask] = 500 + np.random.randint(0, 200, size=mask.sum())
                
        elif body_part == "EXTREMITY":
            # Add bone-like structures
            for i in range(2, 5):
                x_start = size[1] // 6 * i
                x_end = x_start + 30
                y_start = 50
                y_end = size[0] - 50
                arr[y_start:y_end, x_start:x_end] = 3000 + np.random.randint(0, 500)
                
        return arr
        
    def _create_dicom_for_study(self, study):
        """Create DICOM file(s) for a specific imaging study."""
        study_uid = generate_uid()
        
        # Create study directory
        study_dir = self.dicom_dir / study_uid
        study_dir.mkdir(exist_ok=True)
        
        # Create series directory
        series_uid = generate_uid()
        series_dir = study_dir / series_uid
        series_dir.mkdir(exist_ok=True)
        
        # Generate 1-5 instances
        num_instances = random.randint(1, 5)
        
        for i in range(num_instances):
            ds = self._create_base_dicom_dataset()
            ds.StudyInstanceUID = study_uid
            ds.SeriesInstanceUID = series_uid
            ds.InstanceNumber = str(i + 1)
            ds.StudyDescription = study.description or "Generated Study"
            
            # Generate image
            pixel_array = self._generate_cross_section_image("GENERIC")
            ds.PixelData = pixel_array.tobytes()
            ds.Rows, ds.Columns = pixel_array.shape
            
            # Save file
            filename = f"{generate_uid()}.dcm"
            filepath = series_dir / filename
            ds.save_as(filepath, write_like_original=False)
            
        logging.info(f"✅ Created {num_instances} DICOM files for study {study.id}")
def main():
    parser = argparse.ArgumentParser(description="Imaging and DICOM tools for MedGenEMR")
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Generate DICOM for studies
    gen_parser = subparsers.add_parser('generate', help='Generate DICOM files for imaging studies')
    gen_parser.add_argument('--patient', help='Generate for specific patient ID')
    
    # Create generic DICOMs
    generic_parser = subparsers.add_parser('generic', help='Create generic DICOM test files')
    generic_parser.add_argument('--count', type=int, default=5, help='Number of files to create')
    
    # Add imaging to patients
    add_parser = subparsers.add_parser('add', help='Add imaging studies to patients')
    add_parser.add_argument('--count', type=int, default=1, help='Studies per patient')
    
    args = parser.parse_args()
    
    toolkit = ImagingToolkit()
    
    if args.command == 'generate':
        toolkit.generate_dicom_for_studies(args.patient)
    elif args.command == 'generic':
        toolkit.create_generic_dicoms(args.count)
    elif args.command == 'add':
        toolkit.add_imaging_to_patients(args.count)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()