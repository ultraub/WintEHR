#!/usr/bin/env python3
"""
Generate real Synthea patients and load them into the FHIR database
"""

import os
import sys
import json
import glob
import asyncio
import subprocess
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/medgenemr")
FHIR_API_BASE = "http://localhost:8000/fhir/R4"
SYNTHEA_PATH = "/app/synthea"

async def setup_synthea():
    """Setup Synthea if not already installed"""
    print("Setting up Synthea...")
    
    # Run setup script
    setup_script = Path(__file__).parent / "setup_synthea.sh"
    if setup_script.exists():
        subprocess.run(["bash", str(setup_script)], check=True)
    else:
        print("Setup script not found, assuming Synthea is already installed")

async def generate_patients(count=5):
    """Generate Synthea patients"""
    print(f"Generating {count} Synthea patients...")
    
    # Clear previous output
    output_dir = Path(SYNTHEA_PATH) / "output" / "fhir"
    if output_dir.exists():
        import shutil
        shutil.rmtree(output_dir)
    
    # Run Synthea
    cmd = [
        "java", "-jar", f"{SYNTHEA_PATH}/build/libs/synthea-with-dependencies.jar",
        "-p", str(count),
        "-s", str(int(datetime.now().timestamp())),  # Random seed
        "Massachusetts"
    ]
    
    try:
        subprocess.run(cmd, cwd=SYNTHEA_PATH, check=True)
        print(f"Successfully generated {count} patients")
    except subprocess.CalledProcessError as e:
        print(f"Error generating patients: {e}")
        raise

async def load_patient_bundle(bundle_path: str):
    """Load a single patient bundle via FHIR API"""
    print(f"Loading bundle: {os.path.basename(bundle_path)}")
    
    with open(bundle_path, 'r') as f:
        bundle = json.load(f)
    
    # Process resources in order
    resources_by_type = {}
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        if resource_type:
            if resource_type not in resources_by_type:
                resources_by_type[resource_type] = []
            resources_by_type[resource_type].append(resource)
    
    # Load in dependency order
    load_order = [
        'Organization',
        'Practitioner', 
        'Location',
        'Patient',
        'Encounter',
        'Condition',
        'Procedure',
        'Observation',
        'MedicationRequest',
        'Immunization',
        'AllergyIntolerance',
        'CarePlan',
        'Goal',
        'DiagnosticReport',
        'DocumentReference'
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for resource_type in load_order:
            if resource_type in resources_by_type:
                for resource in resources_by_type[resource_type]:
                    # Remove ID to let server generate new one
                    resource.pop('id', None)
                    
                    # Add Synthea tag
                    if 'meta' not in resource:
                        resource['meta'] = {}
                    if 'tag' not in resource['meta']:
                        resource['meta']['tag'] = []
                    resource['meta']['tag'].append({
                        'system': 'http://medgenemr.com/tags',
                        'code': 'synthea',
                        'display': 'Synthea Generated'
                    })
                    
                    try:
                        response = await client.post(
                            f"{FHIR_API_BASE}/{resource_type}",
                            json=resource
                        )
                        if response.status_code != 201:
                            print(f"Failed to create {resource_type}: {response.status_code} - {response.text}")
                    except Exception as e:
                        print(f"Error creating {resource_type}: {e}")

async def main():
    """Main function"""
    print("=== Synthea Patient Generation and Loading ===")
    
    # Check if running in Docker
    in_docker = os.path.exists('/.dockerenv')
    
    if in_docker:
        # Setup Synthea in container
        await setup_synthea()
        
        # Generate patients
        await generate_patients(5)
        
        # Find generated bundles
        bundle_files = glob.glob(f"{SYNTHEA_PATH}/output/fhir/*.json")
        print(f"Found {len(bundle_files)} patient bundles")
        
        # Load each bundle
        for bundle_file in bundle_files:
            try:
                await load_patient_bundle(bundle_file)
            except Exception as e:
                print(f"Error loading bundle {bundle_file}: {e}")
    else:
        print("Not running in Docker. Please run this script inside the backend container:")
        print("docker exec emr-backend python /app/scripts/generate_and_load_synthea.py")
        sys.exit(1)
    
    # Summary
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        patient_count = conn.execute(
            text("SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient'")
        ).scalar()
        total_count = conn.execute(
            text("SELECT COUNT(*) FROM fhir.resources")
        ).scalar()
        
        print(f"\n=== Summary ===")
        print(f"Total patients in database: {patient_count}")
        print(f"Total FHIR resources: {total_count}")

if __name__ == "__main__":
    asyncio.run(main())