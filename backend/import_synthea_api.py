#!/usr/bin/env python3
"""
Import Synthea data using the FHIR API endpoints
This approach uses the existing API infrastructure which handles validation properly.
"""

import json
import requests
from pathlib import Path
import sys
import time

def import_bundle_via_api(file_path, base_url="http://localhost:8000/fhir/R4"):
    """Import a FHIR bundle via the API."""
    print(f"📄 Importing {file_path.name}...")
    
    with open(file_path, 'r') as f:
        bundle = json.load(f)
    
    # Check if it's a transaction bundle
    if bundle.get('type') not in ['transaction', 'batch']:
        print(f"  ⚠️  Not a transaction/batch bundle: {bundle.get('type')}")
        return 0
    
    # Process entries individually to avoid R4/R5 validation issues
    success_count = 0
    error_count = 0
    
    for entry in bundle.get('entry', []):
        resource = entry.get('resource')
        if not resource:
            continue
        
        resource_type = resource.get('resourceType')
        resource_id = resource.get('id')
        
        if not resource_type:
            continue
        
        # Create or update the resource
        try:
            if resource_id:
                # PUT to update/create with specific ID
                url = f"{base_url}/{resource_type}/{resource_id}"
                response = requests.put(
                    url,
                    json=resource,
                    headers={'Content-Type': 'application/fhir+json'}
                )
            else:
                # POST to create with server-assigned ID
                url = f"{base_url}/{resource_type}"
                response = requests.post(
                    url,
                    json=resource,
                    headers={'Content-Type': 'application/fhir+json'}
                )
            
            if response.status_code in [200, 201]:
                success_count += 1
            else:
                error_count += 1
                if error_count <= 3:  # Only show first 3 errors
                    print(f"  ❌ {resource_type}/{resource_id}: {response.status_code}")
                    error_text = response.text[:200]
                    if error_text:
                        print(f"     {error_text}")
        
        except Exception as e:
            error_count += 1
            if error_count <= 3:
                print(f"  ❌ {resource_type}/{resource_id}: {str(e)}")
    
    print(f"  ✅ Imported {success_count} resources, {error_count} errors")
    return success_count

def main():
    """Main import function."""
    synthea_dir = Path("../synthea/output/fhir")
    
    if not synthea_dir.exists():
        print(f"❌ Synthea output directory not found: {synthea_dir}")
        sys.exit(1)
    
    # Find all JSON files
    json_files = list(synthea_dir.glob("*.json"))
    
    if not json_files:
        print("❌ No JSON files found to import")
        sys.exit(1)
    
    print(f"📥 Found {len(json_files)} files to import")
    
    # Sort files: practitioners first, then hospitals, then patients
    practitioner_files = [f for f in json_files if 'practitioner' in f.name.lower()]
    hospital_files = [f for f in json_files if 'hospital' in f.name.lower()]
    patient_files = [f for f in json_files if f not in practitioner_files and f not in hospital_files]
    
    total_imported = 0
    start_time = time.time()
    
    # Import in order
    for files, file_type in [(practitioner_files, "practitioner"),
                             (hospital_files, "hospital"),
                             (patient_files, "patient")]:
        if files:
            print(f"\n📁 Importing {file_type} files...")
            for file_path in files:
                imported = import_bundle_via_api(file_path)
                total_imported += imported
    
    elapsed = time.time() - start_time
    print(f"\n✅ Import completed in {elapsed:.1f} seconds")
    print(f"📊 Total resources imported: {total_imported}")
    
    # Verify import
    print("\n🔍 Verifying import...")
    response = requests.get("http://localhost:8000/fhir/R4/Patient?_summary=count")
    if response.status_code == 200:
        result = response.json()
        total = result.get('total', 0)
        print(f"✅ Total patients in database: {total}")

if __name__ == "__main__":
    main()