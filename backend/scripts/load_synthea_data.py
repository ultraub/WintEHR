#!/usr/bin/env python3
"""
Load Synthea patient data via FHIR API
"""

import asyncio
import httpx
import json
import zipfile
import io
import random

# We'll download and extract from the official Synthea sample data
SYNTHEA_DATA_URL = "https://synthetichealth.github.io/synthea-sample-data/downloads/synthea_sample_data_fhir_r4_sep2019.zip"

# API base URL
API_BASE = "http://localhost:8000/fhir/R4"

async def download_synthea_data() -> list:
    """Download and extract Synthea sample data"""
    print("Downloading Synthea sample data...")
    async with httpx.AsyncClient() as client:
        response = await client.get(SYNTHEA_DATA_URL, timeout=120.0)
        response.raise_for_status()
        
        # Extract zip file in memory
        zip_data = io.BytesIO(response.content)
        bundles = []
        
        with zipfile.ZipFile(zip_data) as zf:
            # Get list of JSON files
            json_files = [f for f in zf.namelist() if f.endswith('.json')]
            print(f"Found {len(json_files)} patient bundles")
            
            # Randomly select 5 files
            selected_files = random.sample(json_files, min(5, len(json_files)))
            
            for filename in selected_files:
                with zf.open(filename) as f:
                    bundle = json.load(f)
                    bundles.append(bundle)
        
        return bundles

async def create_resource(resource_type: str, resource: dict) -> str:
    """Create a single FHIR resource"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE}/{resource_type}",
            json=resource,
            timeout=10.0
        )
        if response.status_code == 201:
            result = response.json()
            return result.get('id')
        else:
            print(f"Failed to create {resource_type}: {response.status_code} - {response.text}")
            return None

async def process_bundle(bundle: dict):
    """Process a FHIR bundle"""
    if bundle.get('resourceType') != 'Bundle':
        raise ValueError("Not a valid FHIR Bundle")
    
    entries = bundle.get('entry', [])
    print(f"Processing bundle with {len(entries)} entries")
    
    # Keep track of ID mappings
    id_map = {}
    
    # First pass - create Patients
    for entry in entries:
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'Patient':
            original_id = resource.get('id')
            # Remove the ID so a new one is generated
            resource.pop('id', None)
            
            # Add Synthea source tag
            if 'meta' not in resource:
                resource['meta'] = {}
            resource['meta']['source'] = 'synthea'
            
            name = resource.get('name', [{}])[0]
            print(f"Creating Patient: {name.get('family', 'Unknown')}, {name.get('given', ['Unknown'])[0]}")
            
            new_id = await create_resource('Patient', resource)
            if new_id and original_id:
                id_map[f"Patient/{original_id}"] = f"Patient/{new_id}"
    
    # Second pass - create other resources with updated references
    for entry in entries:
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        
        if resource_type and resource_type != 'Patient':
            # Remove the ID
            resource.pop('id', None)
            
            # Update references
            if resource_type in ['Encounter', 'Condition', 'Observation', 'MedicationRequest', 'Procedure']:
                # Update patient reference
                if 'subject' in resource and 'reference' in resource['subject']:
                    old_ref = resource['subject']['reference']
                    if old_ref in id_map:
                        resource['subject']['reference'] = id_map[old_ref]
                
                # Update encounter reference
                if 'encounter' in resource and 'reference' in resource['encounter']:
                    old_ref = resource['encounter']['reference']
                    new_ref = id_map.get(old_ref)
                    if new_ref:
                        resource['encounter']['reference'] = new_ref
            
            # Add Synthea source tag
            if 'meta' not in resource:
                resource['meta'] = {}
            resource['meta']['source'] = 'synthea'
            
            print(f"Creating {resource_type}")
            await create_resource(resource_type, resource)

async def main():
    """Main function"""
    print("Loading Synthea sample patients...")
    
    try:
        # Download and extract bundles
        bundles = await download_synthea_data()
        
        # Process each bundle
        for i, bundle in enumerate(bundles, 1):
            print(f"\n=== Processing patient {i}/{len(bundles)} ===")
            try:
                await process_bundle(bundle)
                print(f"Successfully imported patient {i}")
            except Exception as e:
                print(f"Failed to import patient {i}: {str(e)}")
        
        print("\nImport complete!")
    except Exception as e:
        print(f"Failed to download Synthea data: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())