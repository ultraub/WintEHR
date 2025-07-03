#!/usr/bin/env python3
"""
Import only Patient resources from Synthea bundles to get basic functionality working
"""

import os
import json
import glob
import asyncio
import httpx
from typing import Dict, List, Any

# Configuration for local development
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

async def load_patients_only(client: httpx.AsyncClient, bundle_path: str) -> Dict[str, Any]:
    """Load only the Patient resource from a bundle"""
    print(f"\nProcessing bundle: {os.path.basename(bundle_path)}")
    
    with open(bundle_path, 'r') as f:
        bundle = json.load(f)
    
    if bundle.get('resourceType') != 'Bundle':
        print(f"⚠️  Warning: {bundle_path} is not a Bundle resource")
        return {'success': False, 'error': 'Not a Bundle'}
    
    # Find the patient resource
    patient = None
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        if resource.get('resourceType') == 'Patient':
            patient = resource
            break
    
    if not patient:
        print(f"❌ No patient found in bundle")
        return {'success': False, 'error': 'No patient found'}
    
    print(f"  Found patient: {patient['name'][0]['given'][0]} {patient['name'][0]['family']}")
    print(f"  ID: {patient['id']}")
    print(f"  Birth Date: {patient['birthDate']}")
    print(f"  Gender: {patient['gender']}")
    
    # Try to post the patient
    try:
        response = await client.post(
            f"{FHIR_BASE_URL}/Patient",
            json=patient,
            timeout=30.0
        )
        
        if response.status_code in [200, 201]:
            print(f"  ✅ Patient created successfully!")
            location = response.headers.get('location', 'Unknown')
            print(f"     Location: {location}")
            return {'success': True, 'patient_id': patient['id'], 'location': location}
        elif response.status_code == 500:
            # Check if it's a duplicate ID issue
            try:
                # Try to get the existing patient
                check_response = await client.get(f"{FHIR_BASE_URL}/Patient/{patient['id']}")
                if check_response.status_code == 200:
                    print(f"  ℹ️  Patient already exists")
                    return {'success': True, 'patient_id': patient['id'], 'location': f"Patient/{patient['id']}", 'already_exists': True}
            except:
                pass
            
            print(f"  ❌ Error creating patient:")
            print(f"     Status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"     Error: {error_data}")
            except:
                print(f"     Error text: {response.text}")
                
        else:
            print(f"  ❌ Error creating patient:")
            print(f"     Status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"     Error: {error_data}")
            except:
                print(f"     Error text: {response.text}")
        
        return {'success': False, 'error': f'HTTP {response.status_code}'}
                
    except Exception as e:
        print(f"  ❌ Exception: {str(e)}")
        return {'success': False, 'error': str(e)}

async def main():
    """Main import function for patients only"""
    print("👥 Importing Synthea Patients into MedGenEMR")
    print("=" * 50)
    
    # Check if FHIR server is running
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{FHIR_BASE_URL}/metadata", timeout=10.0)
            if response.status_code != 200:
                print(f"❌ FHIR server not responding correctly: {response.status_code}")
                return False
            print("✅ FHIR server is running")
        except Exception as e:
            print(f"❌ Cannot connect to FHIR server at {FHIR_BASE_URL}")
            print(f"   Make sure the backend is running: uvicorn main:app --reload")
            return False
    
    # Find bundle files
    if not os.path.exists(SYNTHEA_OUTPUT_DIR):
        print(f"❌ Synthea output directory not found: {SYNTHEA_OUTPUT_DIR}")
        print("   Run ./run_synthea_local.sh first to generate patient data")
        return False
    
    bundle_files = glob.glob(os.path.join(SYNTHEA_OUTPUT_DIR, "*.json"))
    # Filter out hospital and practitioner info files
    patient_bundles = [f for f in bundle_files if 
                      not f.endswith('hospitalInformation.json') and 
                      not f.endswith('practitionerInformation.json')]
    
    if not patient_bundles:
        print(f"❌ No patient bundle files found in {SYNTHEA_OUTPUT_DIR}")
        return False
    
    print(f"📁 Found {len(patient_bundles)} patient bundles to process")
    
    # Import patients only
    patients_loaded = []
    
    async with httpx.AsyncClient() as client:
        for bundle_path in sorted(patient_bundles):
            result = await load_patients_only(client, bundle_path)
            
            if result['success']:
                patients_loaded.append(result)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Patient Import Summary")
    print("=" * 50)
    print(f"Total bundles processed: {len(patient_bundles)}")
    print(f"Patients successfully loaded: {len(patients_loaded)}")
    
    if patients_loaded:
        print(f"\n✅ Successfully imported {len(patients_loaded)} patients:")
        for patient in patients_loaded:
            status = " (already existed)" if patient.get('already_exists') else " (newly created)"
            print(f"   - {patient['patient_id']}{status}")
    
    print(f"\n🌐 Test your patients at: http://localhost:3000/patients")
    
    return len(patients_loaded) > 0

if __name__ == "__main__":
    success = asyncio.run(main())
    if success:
        print("\n🎉 Basic patient data is now available for frontend testing!")
    else:
        print("\n❌ No patients were imported")
        exit(1)