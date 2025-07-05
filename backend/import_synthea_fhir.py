#!/usr/bin/env python3

import json
import requests
from pathlib import Path
import sys

def import_fhir_bundle(file_path, base_url="http://localhost:8000/fhir/R4"):
    """Import a FHIR bundle file to the server."""
    print(f"📄 Importing {file_path.name}...")
    
    with open(file_path, 'r') as f:
        bundle = json.load(f)
    
    # Post the bundle as a transaction
    response = requests.post(
        base_url,
        json=bundle,
        headers={'Content-Type': 'application/fhir+json'}
    )
    
    if response.status_code in [200, 201]:
        result = response.json()
        # Count successful entries
        success_count = 0
        if 'entry' in result:
            for entry in result['entry']:
                if 'response' in entry and entry['response'].get('status', '').startswith('2'):
                    success_count += 1
        print(f"  ✅ Imported {success_count} resources successfully")
        return success_count
    else:
        print(f"  ❌ Failed: {response.status_code} - {response.text[:200]}")
        return 0

def main():
    # Import all FHIR bundles from Synthea output
    synthea_output = Path("../synthea/output/fhir")
    
    if not synthea_output.exists():
        print("❌ Synthea output directory not found")
        sys.exit(1)
    
    fhir_files = list(synthea_output.glob("*.json"))
    
    if not fhir_files:
        print("❌ No FHIR files found to import")
        sys.exit(1)
    
    print(f"📥 Importing {len(fhir_files)} FHIR bundles...")
    
    # Import practitioner and hospital files first
    practitioner_files = [f for f in fhir_files if 'practitioner' in f.name.lower()]
    hospital_files = [f for f in fhir_files if 'hospital' in f.name.lower()]
    patient_files = [f for f in fhir_files if f not in practitioner_files and f not in hospital_files]
    
    total_imported = 0
    
    # Import in order: practitioners, hospitals, then patients
    for files, file_type in [(practitioner_files, "practitioner"), 
                             (hospital_files, "hospital"), 
                             (patient_files, "patient")]:
        if files:
            print(f"\n📁 Importing {file_type} files...")
            for file_path in files:
                total_imported += import_fhir_bundle(file_path)
    
    print(f"\n✅ Import completed. Total resources imported: {total_imported}")
    
    # Verify by checking patient count
    print("\n🔍 Verifying import...")
    response = requests.get("http://localhost:8000/fhir/R4/Patient?_count=10")
    if response.status_code == 200:
        bundle = response.json()
        total = bundle.get('total', 0)
        print(f"✅ Total patients in database: {total}")
        
        if 'entry' in bundle:
            print("\n👥 Patients:")
            for i, entry in enumerate(bundle['entry'][:5]):
                patient = entry['resource']
                name = patient['name'][0] if 'name' in patient else {}
                given = ' '.join(name.get('given', ['']))
                family = name.get('family', '')
                print(f"  {i+1}. {given} {family} (ID: {patient['id']})")

if __name__ == "__main__":
    main()