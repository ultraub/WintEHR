#!/usr/bin/env python3
"""
Create FHIR Endpoint Resources for Generated DICOM Files

This script:
1. Scans /app/data/generated_dicoms/ for existing DICOM study directories
2. Creates FHIR Endpoint resources in HAPI FHIR for each study
3. Updates ImagingStudy resources with endpoint references
4. Enables the frontend imaging tab to display DICOM images

Usage:
    python scripts/active/create_dicom_endpoints.py
    python scripts/active/create_dicom_endpoints.py --dry-run
"""

import os
import sys
import argparse
import logging
from pathlib import Path
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DicomEndpointCreator:
    """Create FHIR Endpoint resources for DICOM files"""

    def __init__(self, hapi_url=None, dicom_base=None, dry_run=False):
        self.hapi_url = hapi_url or os.getenv('HAPI_FHIR_URL', 'http://hapi-fhir:8080/fhir')
        self.dicom_base = Path(dicom_base or '/app/data/generated_dicoms')
        self.dry_run = dry_run

        self.client = httpx.Client(base_url=self.hapi_url, timeout=30.0)

    def find_dicom_studies(self):
        """Find all DICOM study directories"""
        if not self.dicom_base.exists():
            logger.error(f"❌ DICOM directory not found: {self.dicom_base}")
            return []

        study_dirs = [d for d in self.dicom_base.iterdir() if d.is_dir() and d.name.startswith('study_')]
        logger.info(f"📁 Found {len(study_dirs)} DICOM study directories")
        return study_dirs

    def get_imaging_study(self, study_id):
        """Fetch ImagingStudy resource from HAPI FHIR"""
        try:
            response = self.client.get(f'/ImagingStudy/{study_id}')
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"  ⚠️  ImagingStudy/{study_id} not found in HAPI FHIR")
                return None
            raise
        except httpx.HTTPError as e:
            logger.error(f"  ❌ Failed to fetch ImagingStudy/{study_id}: {e}")
            return None

    def create_endpoint(self, study_id, study_dir):
        """Create FHIR Endpoint resource for DICOM study"""

        # Count DICOM files in study
        dcm_files = list(study_dir.glob('**/*.dcm'))
        if not dcm_files:
            logger.warning(f"  ⚠️  No DICOM files found in {study_dir.name}")
            return None

        # Create Endpoint resource
        endpoint = {
            "resourceType": "Endpoint",
            "status": "active",
            "connectionType": {
                "system": "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
                "code": "dicom-wado-rs"
            },
            "name": f"DICOM Endpoint for Study {study_id}",
            "managingOrganization": {
                "display": "WintEHR DICOM Storage"
            },
            "payloadType": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/endpoint-payload-type",
                    "code": "DICOM",
                    "display": "DICOM"
                }]
            }],
            "address": f"file://{study_dir.absolute()}",
            "header": [
                f"X-Study-ID: {study_id}",
                f"X-File-Count: {len(dcm_files)}"
            ]
        }

        if self.dry_run:
            logger.info(f"  [DRY RUN] Would create Endpoint for study {study_id}")
            return {"id": f"endpoint-{study_id}-dry-run"}

        try:
            response = self.client.post('/Endpoint', json=endpoint)
            response.raise_for_status()
            created_endpoint = response.json()
            logger.info(f"  ✅ Created Endpoint/{created_endpoint['id']} ({len(dcm_files)} DICOM files)")
            return created_endpoint
        except httpx.HTTPError as e:
            logger.error(f"  ❌ Failed to create Endpoint: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"     Response: {e.response.text[:200]}")
            return None

    def update_imaging_study_endpoint(self, study_id, endpoint_id):
        """Update ImagingStudy with endpoint reference"""

        # Fetch current ImagingStudy
        study = self.get_imaging_study(study_id)
        if not study:
            return False

        # Add endpoint reference
        study['endpoint'] = [{
            "reference": f"Endpoint/{endpoint_id}"
        }]

        if self.dry_run:
            logger.info(f"  [DRY RUN] Would update ImagingStudy/{study_id} with Endpoint/{endpoint_id}")
            return True

        try:
            response = self.client.put(f'/ImagingStudy/{study_id}', json=study)
            response.raise_for_status()
            logger.info(f"  ✅ Updated ImagingStudy/{study_id} with endpoint reference")
            return True
        except httpx.HTTPError as e:
            logger.error(f"  ❌ Failed to update ImagingStudy/{study_id}: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"     Response: {e.response.text[:200]}")
            return False

    def process_study(self, study_dir):
        """Process a single DICOM study directory"""

        # Extract study ID from directory name (study_abc123 -> abc123)
        study_id = study_dir.name.replace('study_', '')
        logger.info(f"\n📦 Processing study: {study_id}")

        # Check if ImagingStudy exists
        study = self.get_imaging_study(study_id)
        if not study:
            logger.warning(f"  ⚠️  Skipping - no matching ImagingStudy in HAPI FHIR")
            return False

        # Check if endpoint already exists
        if study.get('endpoint'):
            logger.info(f"  ℹ️  Endpoint already exists - skipping")
            return True

        # Create Endpoint resource
        endpoint = self.create_endpoint(study_id, study_dir)
        if not endpoint:
            return False

        # Update ImagingStudy with endpoint reference
        success = self.update_imaging_study_endpoint(study_id, endpoint['id'])
        return success

    def run(self):
        """Main execution"""
        logger.info("=" * 70)
        logger.info("DICOM ENDPOINT CREATION")
        if self.dry_run:
            logger.info("[DRY RUN MODE - No changes will be made]")
        logger.info("=" * 70)

        # Find DICOM study directories
        study_dirs = self.find_dicom_studies()
        if not study_dirs:
            logger.warning("⚠️  No DICOM study directories found")
            return False

        # Process each study
        logger.info(f"\n🔧 Processing {len(study_dirs)} studies...")
        success_count = 0
        skipped_count = 0

        for study_dir in study_dirs:
            result = self.process_study(study_dir)
            if result:
                success_count += 1
            else:
                skipped_count += 1

        # Summary
        logger.info("\n" + "=" * 70)
        logger.info(f"✅ ENDPOINT CREATION COMPLETE")
        logger.info(f"   Successfully processed: {success_count}/{len(study_dirs)} studies")
        logger.info(f"   Skipped: {skipped_count} studies")
        logger.info(f"   DICOM base directory: {self.dicom_base}")
        logger.info("=" * 70)

        return success_count > 0


def main():
    parser = argparse.ArgumentParser(
        description='Create FHIR Endpoint resources for generated DICOM files'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying HAPI FHIR'
    )
    parser.add_argument(
        '--hapi-url',
        help='HAPI FHIR server URL (default: http://hapi-fhir:8080/fhir)'
    )
    parser.add_argument(
        '--dicom-dir',
        help='DICOM base directory (default: /app/data/generated_dicoms)'
    )

    args = parser.parse_args()

    creator = DicomEndpointCreator(
        hapi_url=args.hapi_url,
        dicom_base=args.dicom_dir,
        dry_run=args.dry_run
    )

    success = creator.run()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
