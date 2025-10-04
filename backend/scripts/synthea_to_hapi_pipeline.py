#!/usr/bin/env python3
"""
Production-Ready Synthea to HAPI FHIR Data Pipeline

This script:
1. Generates Synthea FHIR data
2. Converts bundles to HAPI FHIR compatible format
3. Loads data into HAPI FHIR server

Based on research findings:
- Synthea uses "collection" bundles, HAPI needs "transaction"
- Conditional creates need proper ifNoneExist format
- Organization/Practitioner resources should be uploaded first
"""

import json
import os
import sys
import subprocess
import requests
from pathlib import Path
from typing import List, Dict, Optional
import time

# Configuration
SYNTHEA_JAR = Path(__file__).parent / "synthea" / "synthea.jar"
SYNTHEA_OUTPUT = Path(__file__).parent / "synthea" / "output" / "fhir"
HAPI_FHIR_BASE = os.getenv('HAPI_FHIR_URL', 'http://localhost:8888/fhir')

def run_synthea(num_patients: int = 10, state: str = "Massachusetts"):
    """Generate Synthea FHIR data"""
    print("=" * 70)
    print("STEP 1: Generating Synthea Data")
    print("=" * 70)
    print(f"Patients: {num_patients}")
    print(f"State: {state}")
    print(f"Synthea JAR: {SYNTHEA_JAR}")
    print()

    if not SYNTHEA_JAR.exists():
        raise FileNotFoundError(f"Synthea JAR not found: {SYNTHEA_JAR}")

    # Clear previous output
    if SYNTHEA_OUTPUT.exists():
        import shutil
        shutil.rmtree(SYNTHEA_OUTPUT)

    # Run Synthea
    cmd = [
        "java", "-jar", str(SYNTHEA_JAR),
        "-p", str(num_patients),
        state,
        "--exporter.fhir.export=true",
        "--exporter.hospital.fhir.export=true",
        "--exporter.practitioner.fhir.export=true"
    ]

    print(f"Running: {' '.join(cmd)}\n")
    result = subprocess.run(cmd, cwd=SYNTHEA_JAR.parent, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Synthea generation failed:")
        print(result.stderr)
        sys.exit(1)

    print(f"✓ Synthea data generated in {SYNTHEA_OUTPUT}")
    return SYNTHEA_OUTPUT


def fix_bundle_for_hapi(bundle: Dict) -> Dict:
    """
    Fix Synthea bundle for HAPI FHIR compatibility

    Key fixes:
    1. Convert "collection" to "transaction" type
    2. Add proper request methods
    3. Fix conditional create format for shared resources
    """
    # Convert bundle type
    if bundle.get('type') == 'collection':
        bundle['type'] = 'transaction'

    # Fix each entry
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        resource_id = resource.get('id')

        if not resource_type:
            continue

        # Determine if this is a shared resource that needs conditional create
        is_shared_resource = resource_type in ['Organization', 'Practitioner', 'Location']

        if is_shared_resource and 'identifier' in resource:
            # Use conditional create for shared resources
            # Format: identifier=system|value (NOT Practitioner?identifier=...)
            identifiers = resource.get('identifier', [])
            if identifiers:
                first_id = identifiers[0]
                system = first_id.get('system', '')
                value = first_id.get('value', '')

                entry['request'] = {
                    'method': 'POST',
                    'url': resource_type,  # Just the resource type
                    'ifNoneExist': f"identifier={system}|{value}"  # Search params only
                }
        elif resource_id:
            # Use PUT for resources with IDs
            entry['request'] = {
                'method': 'PUT',
                'url': f"{resource_type}/{resource_id}"
            }
        else:
            # Use POST for new resources
            entry['request'] = {
                'method': 'POST',
                'url': resource_type
            }

    return bundle


def upload_bundle_to_hapi(bundle: Dict, bundle_name: str = "bundle") -> bool:
    """Upload a single bundle to HAPI FHIR"""
    try:
        response = requests.post(
            HAPI_FHIR_BASE,
            json=bundle,
            headers={'Content-Type': 'application/fhir+json'},
            timeout=60
        )

        if response.status_code in [200, 201]:
            print(f"  ✓ {bundle_name}: Success")
            return True
        else:
            print(f"  ✗ {bundle_name}: Failed ({response.status_code})")
            print(f"    Error: {response.text[:200]}")
            return False

    except Exception as e:
        print(f"  ✗ {bundle_name}: Exception - {e}")
        return False


def load_bundles_to_hapi(output_dir: Path):
    """Load all Synthea bundles to HAPI FHIR with proper ordering"""
    print("\n" + "=" * 70)
    print("STEP 2: Loading Data to HAPI FHIR")
    print("=" * 70)
    print(f"HAPI FHIR: {HAPI_FHIR_BASE}")
    print()

    # Find all JSON files
    json_files = list(output_dir.glob("*.json"))

    if not json_files:
        print("✗ No FHIR bundles found!")
        return

    print(f"Found {len(json_files)} bundle files\n")

    # Separate files by type
    hospital_files = [f for f in json_files if 'hospital' in f.name.lower()]
    practitioner_files = [f for f in json_files if 'practitioner' in f.name.lower()]
    patient_files = [f for f in json_files if f not in hospital_files and f not in practitioner_files]

    # Upload in order: hospitals → practitioners → patients
    upload_order = [
        ("Hospital Information", hospital_files),
        ("Practitioner Information", practitioner_files),
        ("Patient Records", patient_files)
    ]

    success_count = 0
    total_count = 0

    for category, files in upload_order:
        if not files:
            continue

        print(f"{category} ({len(files)} files):")

        for json_file in files:
            total_count += 1

            try:
                with open(json_file, 'r') as f:
                    bundle = json.load(f)

                # Fix bundle format
                fixed_bundle = fix_bundle_for_hapi(bundle)

                # Upload
                if upload_bundle_to_hapi(fixed_bundle, json_file.name):
                    success_count += 1

            except Exception as e:
                print(f"  ✗ {json_file.name}: Error loading - {e}")

        print()

    # Summary
    print("=" * 70)
    print("UPLOAD SUMMARY")
    print("=" * 70)
    print(f"Total bundles: {total_count}")
    print(f"Successful: {success_count}")
    print(f"Failed: {total_count - success_count}")
    print()


def verify_data():
    """Verify data in HAPI FHIR"""
    print("=" * 70)
    print("STEP 3: Verifying Data")
    print("=" * 70)

    resource_types = ["Patient", "Condition", "Observation", "Encounter",
                     "Organization", "Practitioner", "MedicationRequest"]

    for resource_type in resource_types:
        try:
            response = requests.get(
                f"{HAPI_FHIR_BASE}/{resource_type}?_summary=count",
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                total = data.get('total', 0)
                print(f"  {resource_type:20} {total:>6} resources")
            else:
                print(f"  {resource_type:20} Error checking")

        except Exception as e:
            print(f"  {resource_type:20} Error: {e}")

    print()


def wait_for_hapi(max_retries=30, delay=2):
    """Wait for HAPI FHIR to be ready"""
    print("Waiting for HAPI FHIR server...")

    for i in range(max_retries):
        try:
            response = requests.get(f"{HAPI_FHIR_BASE}/metadata", timeout=5)
            if response.status_code == 200:
                print("✓ HAPI FHIR server is ready!\n")
                return True
        except requests.exceptions.RequestException:
            pass

        if i < max_retries - 1:
            time.sleep(delay)

    print("✗ HAPI FHIR server not available")
    return False


def main():
    """Main pipeline execution"""
    print("\n" + "=" * 70)
    print("SYNTHEA → HAPI FHIR DATA PIPELINE")
    print("=" * 70)
    print()

    # Parse arguments
    num_patients = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    state = sys.argv[2] if len(sys.argv) > 2 else "Massachusetts"

    # Check HAPI FHIR availability
    if not wait_for_hapi():
        sys.exit(1)

    try:
        # Step 1: Generate Synthea data
        output_dir = run_synthea(num_patients, state)

        # Step 2: Load to HAPI FHIR
        load_bundles_to_hapi(output_dir)

        # Step 3: Verify
        verify_data()

        print("=" * 70)
        print("✓ PIPELINE COMPLETE")
        print("=" * 70)
        print()

    except Exception as e:
        print(f"\n✗ Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
