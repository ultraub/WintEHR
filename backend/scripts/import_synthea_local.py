#!/usr/bin/env python3
"""
Import Synthea-generated FHIR bundles into MedGenEMR - LOCAL DEVELOPMENT VERSION
Handles proper resource ordering and validation for local development
"""

import os
import sys
import json
import glob
import asyncio
import httpx
from pathlib import Path
from typing import Dict, List, Any

# Configuration for local development
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

# Resource loading order (dependencies first)
RESOURCE_ORDER = [
    "Organization",
    "Location", 
    "Practitioner",
    "PractitionerRole",
    "Patient",
    "Encounter",
    "Condition",
    "Procedure",
    "Observation",
    "DiagnosticReport",
    "MedicationRequest",
    "MedicationStatement",
    "Immunization",
    "AllergyIntolerance",
    "CarePlan",
    "Goal",
    "DocumentReference",
    "Device",
    "Claim",
    "ExplanationOfBenefit"
]

async def load_bundle(client: httpx.AsyncClient, bundle_path: str) -> Dict[str, Any]:
    """Load a single patient bundle"""
    print(f"\nLoading bundle: {os.path.basename(bundle_path)}")
    
    with open(bundle_path, 'r') as f:
        bundle = json.load(f)
    
    if bundle.get('resourceType') != 'Bundle':
        print(f"⚠️  Warning: {bundle_path} is not a Bundle resource")
        return {'success': False, 'error': 'Not a Bundle'}
    
    # Group resources by type
    resources_by_type = {}
    total_resources = 0
    
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        
        if resource_type:
            if resource_type not in resources_by_type:
                resources_by_type[resource_type] = []
            resources_by_type[resource_type].append(resource)
            total_resources += 1
    
    print(f"  Found {total_resources} resources across {len(resources_by_type)} types")
    
    # Load resources in dependency order
    loaded = 0
    errors = []
    
    for resource_type in RESOURCE_ORDER:
        if resource_type in resources_by_type:
            resources = resources_by_type[resource_type]
            print(f"  Loading {len(resources)} {resource_type} resources...")
            
            for resource in resources:
                try:
                    # POST to FHIR server
                    response = await client.post(
                        f"{FHIR_BASE_URL}/{resource_type}",
                        json=resource,
                        timeout=30.0
                    )
                    
                    if response.status_code in [200, 201]:
                        loaded += 1
                    else:
                        error_msg = f"{resource_type}/{resource.get('id', 'unknown')}: {response.status_code}"
                        errors.append(error_msg)
                        if response.status_code != 409:  # Don't log duplicates
                            print(f"    ❌ Error: {error_msg}")
                
                except Exception as e:
                    error_msg = f"{resource_type}/{resource.get('id', 'unknown')}: {str(e)}"
                    errors.append(error_msg)
                    print(f"    ❌ Exception: {error_msg}")
    
    # Handle any remaining resource types not in our order
    remaining_types = set(resources_by_type.keys()) - set(RESOURCE_ORDER)
    for resource_type in remaining_types:
        resources = resources_by_type[resource_type]
        print(f"  Loading {len(resources)} {resource_type} resources (unordered)...")
        
        for resource in resources:
            try:
                response = await client.post(
                    f"{FHIR_BASE_URL}/{resource_type}",
                    json=resource,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    loaded += 1
                else:
                    error_msg = f"{resource_type}/{resource.get('id', 'unknown')}: {response.status_code}"
                    errors.append(error_msg)
                    if response.status_code != 409:
                        print(f"    ❌ Error: {error_msg}")
            
            except Exception as e:
                error_msg = f"{resource_type}/{resource.get('id', 'unknown')}: {str(e)}"
                errors.append(error_msg)
                print(f"    ❌ Exception: {error_msg}")
    
    success_rate = (loaded / total_resources) * 100 if total_resources > 0 else 0
    print(f"  ✅ Loaded {loaded}/{total_resources} resources ({success_rate:.1f}%)")
    
    return {
        'success': True,
        'total': total_resources,
        'loaded': loaded,
        'errors': errors,
        'bundle_path': bundle_path
    }

async def main():
    """Main import function"""
    print("🧬 Importing Synthea FHIR data into MedGenEMR")
    print("=" * 50)
    
    # Check if FHIR server is running
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{FHIR_BASE_URL}/metadata", timeout=10.0)
            if response.status_code != 200:
                print(f"❌ FHIR server not responding correctly: {response.status_code}")
                return False
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
    
    print(f"📁 Found {len(patient_bundles)} patient bundles to import")
    
    # Import each bundle
    total_loaded = 0
    total_resources = 0
    all_errors = []
    
    async with httpx.AsyncClient() as client:
        for bundle_path in sorted(patient_bundles):
            result = await load_bundle(client, bundle_path)
            
            if result['success']:
                total_loaded += result['loaded']
                total_resources += result['total']
                all_errors.extend(result['errors'])
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Import Summary")
    print("=" * 50)
    print(f"Total bundles processed: {len(patient_bundles)}")
    print(f"Total resources found: {total_resources}")
    print(f"Resources successfully loaded: {total_loaded}")
    print(f"Success rate: {(total_loaded / total_resources) * 100:.1f}%" if total_resources > 0 else "0%")
    
    if all_errors:
        print(f"\n⚠️  {len(all_errors)} errors encountered:")
        for error in all_errors[:10]:  # Show first 10 errors
            print(f"   {error}")
        if len(all_errors) > 10:
            print(f"   ... and {len(all_errors) - 10} more errors")
    
    print(f"\n✅ Import complete! You now have {total_loaded} FHIR resources in your database")
    print("🌐 Access your EMR at: http://localhost:3000")
    
    return total_loaded > 0

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)