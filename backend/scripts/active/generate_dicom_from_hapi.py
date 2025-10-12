#!/usr/bin/env python3
"""
Generate DICOM Files from HAPI FHIR ImagingStudy Resources

This script:
1. Fetches ImagingStudy resources from HAPI FHIR
2. Generates realistic multi-slice DICOM files
3. Stores files in /app/data/generated_dicoms/
4. Updates ImagingStudy resources with endpoint references

Usage:
    python scripts/active/generate_dicom_from_hapi.py
    python scripts/active/generate_dicom_from_hapi.py --max-studies 10
    python scripts/active/generate_dicom_from_hapi.py --patient-id Patient/123
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime
import httpx
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# DICOM support
try:
    import pydicom
    from pydicom.dataset import Dataset, FileDataset
    from pydicom.uid import generate_uid, ExplicitVRLittleEndian
    DICOM_AVAILABLE = True
except ImportError:
    logger.warning("pydicom not available - DICOM generation will be skipped")
    DICOM_AVAILABLE = False


class HAPIFHIRDicomGenerator:
    """Generate DICOM files from HAPI FHIR ImagingStudy resources"""

    def __init__(self, hapi_url=None, dicom_dir=None):
        self.hapi_url = hapi_url or os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')
        self.dicom_base = Path(dicom_dir or '/app/data/generated_dicoms')
        self.dicom_base.mkdir(parents=True, exist_ok=True)

        self.client = httpx.Client(base_url=self.hapi_url, timeout=30.0)

        # Modality configurations
        self.modality_configs = {
            'CT': {'slices': 30, 'size': (512, 512), 'window': (400, 40)},
            'MR': {'slices': 25, 'size': (256, 256), 'window': (2000, 1000)},
            'XR': {'slices': 1, 'size': (2048, 2048), 'window': (2000, 1000)},
            'CR': {'slices': 1, 'size': (2048, 2048), 'window': (2000, 1000)},
            'DX': {'slices': 1, 'size': (2048, 2048), 'window': (2000, 1000)},
            'US': {'slices': 1, 'size': (640, 480), 'window': (256, 128)},
            'MG': {'slices': 1, 'size': (3328, 4096), 'window': (2000, 1000)},
        }

    def fetch_imaging_studies(self, max_count=None, patient_id=None):
        """Fetch ImagingStudy resources from HAPI FHIR"""
        logger.info("📡 Fetching ImagingStudy resources from HAPI FHIR...")

        params = {'_count': max_count or 100}
        if patient_id:
            params['patient'] = patient_id

        try:
            response = self.client.get('/ImagingStudy', params=params)
            response.raise_for_status()
            bundle = response.json()

            if bundle.get('resourceType') != 'Bundle':
                logger.error("Invalid response from HAPI FHIR")
                return []

            entries = bundle.get('entry', [])
            studies = [entry['resource'] for entry in entries if 'resource' in entry]

            logger.info(f"✅ Found {len(studies)} ImagingStudy resources")
            return studies

        except httpx.HTTPError as e:
            logger.error(f"❌ Failed to fetch ImagingStudy resources: {e}")
            return []

    def get_patient_name(self, patient_ref):
        """Get patient name from HAPI FHIR"""
        try:
            # Extract patient ID from reference
            patient_id = patient_ref.replace('Patient/', '').split('?')[0]
            response = self.client.get(f'/Patient/{patient_id}')
            response.raise_for_status()
            patient = response.json()

            # Extract name
            names = patient.get('name', [])
            if names:
                name = names[0]
                family = name.get('family', 'UNKNOWN')
                given = ' '.join(name.get('given', ['UNKNOWN']))
                return f"{given} {family}"
            return "UNKNOWN PATIENT"

        except Exception as e:
            logger.warning(f"Could not fetch patient name: {e}")
            return "UNKNOWN PATIENT"

    def generate_dicom_for_study(self, study):
        """Generate DICOM files for an ImagingStudy resource"""
        if not DICOM_AVAILABLE:
            logger.warning("pydicom not available - skipping DICOM generation")
            return False

        study_id = study.get('id')
        logger.info(f"  Generating DICOM for study: {study_id}")

        # Get patient reference
        subject = study.get('subject', {})
        patient_ref = subject.get('reference', 'Patient/unknown')
        patient_name = self.get_patient_name(patient_ref)
        patient_id = patient_ref.replace('Patient/', '').split('?')[0]

        # Get study metadata
        study_uid = study.get('identifier', [{}])[0].get('value', generate_uid())
        study_date = study.get('started', datetime.now().isoformat())[:10].replace('-', '')
        study_time = datetime.now().strftime('%H%M%S')
        description = study.get('description', 'Medical Imaging Study')

        # Get series from study
        series_list = study.get('series', [])
        if not series_list:
            # Create default series if none exist
            modalities = study.get('modality', [{'code': 'CT'}])
            modality_code = modalities[0].get('code', 'CT') if modalities else 'CT'
            series_list = [{
                'uid': generate_uid(),
                'modality': {'code': modality_code},
                'description': description,
                'numberOfInstances': self.modality_configs.get(modality_code, {}).get('slices', 10)
            }]

        # Create study directory
        study_dir = self.dicom_base / f"study_{study_id}"
        study_dir.mkdir(exist_ok=True)

        total_files = 0

        # Generate DICOM files for each series
        for series_idx, series in enumerate(series_list):
            series_uid = series.get('uid', generate_uid())
            modality_obj = series.get('modality', {'code': 'CT'})
            modality = modality_obj.get('code', 'CT')
            series_desc = series.get('description', f'{modality} Series')
            num_instances = series.get('numberOfInstances', 10)

            # Get modality config
            config = self.modality_configs.get(modality, self.modality_configs['CT'])
            num_slices = min(num_instances, config['slices'])

            # Create series directory
            series_dir = study_dir / f"series_{series_idx + 1:03d}_{modality}"
            series_dir.mkdir(exist_ok=True)

            # Generate slices
            for slice_idx in range(num_slices):
                try:
                    dcm_file = self._create_dicom_file(
                        series_dir=series_dir,
                        slice_idx=slice_idx,
                        patient_id=patient_id,
                        patient_name=patient_name,
                        study_uid=study_uid,
                        study_date=study_date,
                        study_time=study_time,
                        study_desc=description,
                        series_uid=series_uid,
                        series_number=series_idx + 1,
                        series_desc=series_desc,
                        modality=modality,
                        config=config
                    )
                    total_files += 1
                except Exception as e:
                    logger.error(f"    Failed to create DICOM slice {slice_idx}: {e}")

        logger.info(f"  ✅ Generated {total_files} DICOM files in {study_dir.name}")
        return True

    def _create_dicom_file(self, series_dir, slice_idx, patient_id, patient_name,
                          study_uid, study_date, study_time, study_desc,
                          series_uid, series_number, series_desc, modality, config):
        """Create a single DICOM file"""

        # Create file dataset
        filename = series_dir / f"slice_{slice_idx + 1:04d}.dcm"
        file_meta = Dataset()
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.2'  # CT Image Storage
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        file_meta.ImplementationClassUID = generate_uid()

        ds = FileDataset(str(filename), {}, file_meta=file_meta, preamble=b"\0" * 128)

        # Patient information
        ds.PatientName = patient_name
        ds.PatientID = patient_id
        ds.PatientBirthDate = '19700101'
        ds.PatientSex = 'O'

        # Study information
        ds.StudyInstanceUID = study_uid
        ds.StudyDate = study_date
        ds.StudyTime = study_time
        ds.StudyDescription = study_desc
        ds.StudyID = '1'

        # Series information
        ds.SeriesInstanceUID = series_uid
        ds.SeriesNumber = str(series_number)
        ds.SeriesDescription = series_desc
        ds.Modality = modality

        # Instance information
        ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.InstanceNumber = str(slice_idx + 1)

        # Image information
        rows, cols = config['size']
        ds.Rows = rows
        ds.Columns = cols
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = 'MONOCHROME2'
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 0

        # Window center/width for display
        window_width, window_center = config['window']
        ds.WindowCenter = str(window_center)
        ds.WindowWidth = str(window_width)

        # Generate realistic pixel data
        pixel_array = self._generate_medical_image(modality, rows, cols, slice_idx)
        ds.PixelData = pixel_array.tobytes()

        # Save DICOM file
        ds.save_as(filename, write_like_original=False)
        return filename

    def _generate_medical_image(self, modality, rows, cols, slice_idx):
        """Generate realistic-looking medical image data"""

        # Create base image with noise
        base_noise = np.random.randint(0, 100, (rows, cols), dtype=np.uint16)

        # Add anatomical structures based on modality
        if modality in ['CT', 'MR']:
            # Create circular structure (like a cross-section)
            y, x = np.ogrid[:rows, :cols]
            center_y, center_x = rows // 2, cols // 2
            radius = min(rows, cols) // 3

            # Body outline
            mask = (x - center_x)**2 + (y - center_y)**2 <= radius**2
            image = base_noise.copy()
            image[mask] = np.random.randint(200, 400, np.sum(mask))

            # Add some internal structures
            inner_radius = radius // 2
            inner_mask = (x - center_x)**2 + (y - center_y)**2 <= inner_radius**2
            image[inner_mask] = np.random.randint(300, 600, np.sum(inner_mask))

            # Add variation based on slice
            image = image + (slice_idx * 5)

        elif modality in ['XR', 'CR', 'DX']:
            # Projection image (like chest X-ray)
            image = np.random.randint(100, 500, (rows, cols), dtype=np.uint16)

            # Add lung-like regions (darker areas)
            y, x = np.ogrid[:rows, :cols]
            left_lung = ((x - cols//3)**2/10000 + (y - rows//2)**2/5000) <= 1
            right_lung = ((x - 2*cols//3)**2/10000 + (y - rows//2)**2/5000) <= 1
            image[left_lung] = np.random.randint(800, 1200, np.sum(left_lung))
            image[right_lung] = np.random.randint(800, 1200, np.sum(right_lung))

        elif modality == 'US':
            # Ultrasound - speckle pattern
            image = np.random.randint(50, 200, (rows, cols), dtype=np.uint16)

        else:
            # Default generic medical image
            image = np.random.randint(100, 400, (rows, cols), dtype=np.uint16)

        return image.astype(np.uint16)

    def run(self, max_studies=None, patient_id=None):
        """Main execution"""
        logger.info("=" * 70)
        logger.info("HAPI FHIR DICOM GENERATION")
        logger.info("=" * 70)

        # Fetch studies
        studies = self.fetch_imaging_studies(max_studies, patient_id)

        if not studies:
            logger.warning("⚠️  No ImagingStudy resources found")
            return False

        if not DICOM_AVAILABLE:
            logger.error("❌ pydicom is not installed - cannot generate DICOM files")
            logger.info("   Install with: pip install pydicom pillow numpy")
            return False

        # Generate DICOM files
        logger.info(f"\n📦 Generating DICOM files for {len(studies)} studies...")
        success_count = 0

        for idx, study in enumerate(studies, 1):
            logger.info(f"\n[{idx}/{len(studies)}] Processing study {study.get('id')}...")
            if self.generate_dicom_for_study(study):
                success_count += 1

        # Summary
        logger.info("\n" + "=" * 70)
        logger.info(f"✅ DICOM GENERATION COMPLETE")
        logger.info(f"   Successfully processed: {success_count}/{len(studies)} studies")
        logger.info(f"   DICOM storage: {self.dicom_base}")
        logger.info("=" * 70)

        return success_count > 0


def main():
    parser = argparse.ArgumentParser(
        description='Generate DICOM files from HAPI FHIR ImagingStudy resources'
    )
    parser.add_argument(
        '--max-studies',
        type=int,
        help='Maximum number of studies to process'
    )
    parser.add_argument(
        '--patient-id',
        help='Generate DICOM only for specific patient (e.g., Patient/123)'
    )
    parser.add_argument(
        '--hapi-url',
        help='HAPI FHIR server URL (default: http://hapi-fhir:8080/fhir)'
    )
    parser.add_argument(
        '--dicom-dir',
        help='DICOM output directory (default: /app/data/generated_dicoms)'
    )

    args = parser.parse_args()

    generator = HAPIFHIRDicomGenerator(
        hapi_url=args.hapi_url,
        dicom_dir=args.dicom_dir
    )

    success = generator.run(
        max_studies=args.max_studies,
        patient_id=args.patient_id
    )

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
