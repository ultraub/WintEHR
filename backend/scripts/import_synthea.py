#!/usr/bin/env python3
"""
Import Synthea-generated FHIR bundles into MedGenEMR
Handles proper resource ordering and validation
"""

import os
import sys
import json
import glob
import asyncio
import httpx
from pathlib import Path
from typing import Dict, List, Any

# Configuration
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "/app/synthea/output/fhir"

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
    
    # Extract resources by type
    resources_by_type = {}
    for entry in bundle.get('entry', []):
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        if resource_type:
            if resource_type not in resources_by_type:
                resources_by_type[resource_type] = []
            resources_by_type[resource_type].append(resource)
    
    results = {
        'total': 0,
        'success': 0,
        'failed': 0,
        'errors': []
    }
    
    # Process resources in dependency order
    for resource_type in RESOURCE_ORDER:
        if resource_type in resources_by_type:
            print(f"  Loading {len(resources_by_type[resource_type])} {resource_type} resources...")
            
            for resource in resources_by_type[resource_type]:
                results['total'] += 1
                
                try:
                    # Remove fullUrl if present (Synthea includes it)
                    resource.pop('fullUrl', None)
                    
                    # Create the resource
                    response = await client.post(
                        f"{FHIR_BASE_URL}/{resource_type}",
                        json=resource,
                        headers={"Content-Type": "application/fhir+json"}
                    )
                    
                    if response.status_code in [200, 201]:
                        results['success'] += 1
                        print(f"    ✓ Created {resource_type}/{resource.get('id', 'unknown')}")
                    else:
                        results['failed'] += 1
                        error_msg = f"Failed to create {resource_type}: {response.status_code}"
                        if response.text:
                            try:
                                error_data = response.json()
                                if 'issue' in error_data:
                                    details = error_data['issue'][0].get('diagnostics', '')
                                    error_msg += f" - {details}"
                            except:
                                error_msg += f" - {response.text[:200]}"
                        results['errors'].append(error_msg)
                        print(f"    ✗ {error_msg}")
                        
                except Exception as e:
                    results['failed'] += 1
                    error_msg = f"Exception creating {resource_type}: {str(e)}"
                    results['errors'].append(error_msg)
                    print(f"    ✗ {error_msg}")
    
    # Handle any remaining resource types not in our order
    for resource_type, resources in resources_by_type.items():
        if resource_type not in RESOURCE_ORDER:
            print(f"  Warning: Skipping unknown resource type: {resource_type}")
    
    return results

async def main():
    """Main import function"""
    print("=== Synthea FHIR Bundle Import ===")
    
    # Check if Synthea output exists
    if not os.path.exists(SYNTHEA_OUTPUT_DIR):
        print(f"Error: Synthea output directory not found: {SYNTHEA_OUTPUT_DIR}")
        print("Please run the Synthea generator first.")
        return
    
    # Find all patient bundles
    bundle_files = glob.glob(os.path.join(SYNTHEA_OUTPUT_DIR, "*.json"))
    
    if not bundle_files:
        print(f"No FHIR bundles found in {SYNTHEA_OUTPUT_DIR}")
        return
    
    print(f"Found {len(bundle_files)} patient bundles to import")
    
    # Create HTTP client
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test FHIR endpoint
        try:
            response = await client.get(f"{FHIR_BASE_URL}/metadata")
            if response.status_code != 200:
                print(f"Error: FHIR server not responding correctly: {response.status_code}")
                return
        except Exception as e:
            print(f"Error: Cannot connect to FHIR server: {e}")
            return
        
        # Process each bundle
        total_results = {
            'bundles': 0,
            'total': 0,
            'success': 0,
            'failed': 0,
            'errors': []
        }
        
        for bundle_file in bundle_files:
            results = await load_bundle(client, bundle_file)
            total_results['bundles'] += 1
            total_results['total'] += results['total']
            total_results['success'] += results['success']
            total_results['failed'] += results['failed']
            total_results['errors'].extend(results['errors'])
        
        # Print summary
        print("\n=== Import Summary ===")
        print(f"Bundles processed: {total_results['bundles']}")
        print(f"Total resources: {total_results['total']}")
        print(f"Successfully imported: {total_results['success']}")
        print(f"Failed: {total_results['failed']}")
        
        if total_results['errors']:
            print("\n=== Errors ===")
            # Group errors by type
            error_counts = {}
            for error in total_results['errors']:
                error_type = error.split(':')[0]
                error_counts[error_type] = error_counts.get(error_type, 0) + 1
            
            for error_type, count in error_counts.items():
                print(f"  {error_type}: {count} occurrences")

if __name__ == "__main__":
    asyncio.run(main())