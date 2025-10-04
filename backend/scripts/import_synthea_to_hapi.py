#!/usr/bin/env python3
"""
Import Synthea FHIR bundles to HAPI FHIR server

This script loads Synthea-generated FHIR R4 bundles and posts them
to the HAPI FHIR server via transaction bundles.
"""

import json
import os
import sys
from pathlib import Path
import requests
from typing import List, Dict
import time

# HAPI FHIR server endpoint (updated to match FHIR router configuration)
HAPI_FHIR_BASE = os.getenv('HAPI_FHIR_URL', 'http://localhost:8888/fhir')

def load_synthea_bundles(synthea_dir: str) -> List[Dict]:
    """Load all FHIR bundles from Synthea output directory"""
    bundles = []
    synthea_path = Path(synthea_dir)

    if not synthea_path.exists():
        print(f"Error: Synthea directory not found: {synthea_dir}")
        return bundles

    # Look for FHIR bundle JSON files
    for json_file in synthea_path.glob('*.json'):
        try:
            with open(json_file, 'r') as f:
                bundle = json.load(f)
                if bundle.get('resourceType') == 'Bundle':
                    bundles.append(bundle)
                    print(f"✓ Loaded bundle: {json_file.name}")
        except Exception as e:
            print(f"✗ Error loading {json_file}: {e}")

    return bundles


def post_bundle_to_hapi(bundle: Dict) -> bool:
    """Post a FHIR bundle to HAPI FHIR server"""
    try:
        # Convert collection bundle to transaction bundle
        if bundle.get('type') == 'collection':
            bundle['type'] = 'transaction'
            # Add request method to each entry
            for entry in bundle.get('entry', []):
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType')
                resource_id = resource.get('id')

                if resource_type and resource_id:
                    entry['request'] = {
                        'method': 'PUT',
                        'url': f"{resource_type}/{resource_id}"
                    }

        # Post bundle to HAPI FHIR
        response = requests.post(
            HAPI_FHIR_BASE,
            json=bundle,
            headers={'Content-Type': 'application/fhir+json'}
        )

        if response.status_code in [200, 201]:
            return True
        else:
            print(f"✗ Error posting bundle: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"✗ Exception posting bundle: {e}")
        return False


def wait_for_hapi_fhir(max_retries=30, delay=2):
    """Wait for HAPI FHIR server to be ready"""
    print(f"Waiting for HAPI FHIR server at {HAPI_FHIR_BASE}...")

    for i in range(max_retries):
        try:
            response = requests.get(f"{HAPI_FHIR_BASE}/metadata", timeout=5)
            if response.status_code == 200:
                print("✓ HAPI FHIR server is ready!")
                return True
        except requests.exceptions.RequestException:
            pass

        if i < max_retries - 1:
            print(f"  Retry {i+1}/{max_retries}...")
            time.sleep(delay)

    print("✗ HAPI FHIR server not available")
    return False


def main():
    """Main import process"""
    print("=" * 60)
    print("Synthea → HAPI FHIR Data Import")
    print("=" * 60)

    # Get Synthea directory from command line or use default
    synthea_dir = sys.argv[1] if len(sys.argv) > 1 else './data/synthea_fhir'

    print(f"\nSynthea directory: {synthea_dir}")
    print(f"HAPI FHIR endpoint: {HAPI_FHIR_BASE}\n")

    # Wait for HAPI FHIR to be ready
    if not wait_for_hapi_fhir():
        sys.exit(1)

    # Load Synthea bundles
    print("\n" + "-" * 60)
    print("Loading Synthea FHIR bundles...")
    print("-" * 60)
    bundles = load_synthea_bundles(synthea_dir)

    if not bundles:
        print("\n✗ No FHIR bundles found!")
        sys.exit(1)

    print(f"\n✓ Loaded {len(bundles)} bundles")

    # Post bundles to HAPI FHIR
    print("\n" + "-" * 60)
    print("Importing to HAPI FHIR...")
    print("-" * 60)

    success_count = 0
    for i, bundle in enumerate(bundles, 1):
        print(f"\n[{i}/{len(bundles)}] Posting bundle...")
        if post_bundle_to_hapi(bundle):
            success_count += 1
            print(f"  ✓ Success ({success_count}/{i})")
        else:
            print(f"  ✗ Failed")

    # Summary
    print("\n" + "=" * 60)
    print("Import Complete")
    print("=" * 60)
    print(f"Total bundles: {len(bundles)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {len(bundles) - success_count}")

    # Verify import
    print("\n" + "-" * 60)
    print("Verifying import...")
    print("-" * 60)

    try:
        # Check patient count
        response = requests.get(f"{HAPI_FHIR_BASE}/Patient?_summary=count")
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            print(f"✓ Patients in HAPI FHIR: {total}")
        else:
            print(f"✗ Could not verify patient count")
    except Exception as e:
        print(f"✗ Verification error: {e}")

    print("\n" + "=" * 60)


if __name__ == '__main__':
    main()
