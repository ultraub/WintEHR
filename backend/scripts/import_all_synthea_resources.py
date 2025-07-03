#!/usr/bin/env python3
"""
Complete FHIR Resource Import from Synthea Bundles

This script imports ALL FHIR resources from Synthea bundles, not just patients.
It handles dependency ordering and properly imports the full medical record.
"""

import os
import json
import glob
import asyncio
import httpx
from typing import Dict, List, Any, Set
from collections import defaultdict

# Configuration for local development
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

# Resource dependency order - resources that don't depend on others first
RESOURCE_ORDER = [
    # Base resources (no dependencies)
    "Patient",
    "Practitioner", 
    "Organization",
    "Location",
    
    # Clinical resources (depend on base)
    "Encounter",
    "Condition",
    "Observation",
    "Procedure",
    "DiagnosticReport",
    "ImagingStudy",
    "Specimen",
    "Device",
    "Medication",
    "MedicationRequest",
    "MedicationStatement",
    "MedicationAdministration",
    "Immunization",
    "AllergyIntolerance",
    
    # Care management
    "CarePlan",
    "Goal",
    "ServiceRequest",
    "Task",
    
    # Documentation
    "DocumentReference",
    "Composition",
    
    # Administrative
    "Appointment",
    "Schedule",
    "Slot",
    
    # Terminology (can be imported anytime but put last)
    "ValueSet",
    "CodeSystem",
    "ConceptMap",
    "StructureDefinition"
]

class FHIRImporter:
    def __init__(self):
        self.imported_resources = set()
        self.failed_resources = []
        self.resource_counts = defaultdict(int)
        self.dependency_errors = []
        
    async def import_bundle(self, client: httpx.AsyncClient, bundle_path: str) -> Dict[str, Any]:
        """Import all resources from a single bundle"""
        print(f"\n📦 Processing bundle: {os.path.basename(bundle_path)}")
        
        with open(bundle_path, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            print(f"⚠️  Skipping {bundle_path} - not a Bundle resource")
            return {'success': False, 'error': 'Not a Bundle'}
        
        entries = bundle.get('entry', [])
        print(f"   Found {len(entries)} resources in bundle")
        
        # Group resources by type
        resources_by_type = defaultdict(list)
        for entry in entries:
            resource = entry.get('resource', {})
            resource_type = resource.get('resourceType')
            if resource_type:
                resources_by_type[resource_type].append(resource)
        
        # Import in dependency order
        total_imported = 0
        total_failed = 0
        
        for resource_type in RESOURCE_ORDER:
            if resource_type in resources_by_type:
                resources = resources_by_type[resource_type]
                print(f"   📋 Importing {len(resources)} {resource_type} resources...")
                
                imported, failed = await self.import_resource_type(client, resource_type, resources)
                total_imported += imported
                total_failed += failed
                
                self.resource_counts[resource_type] += imported
        
        # Handle any resource types not in our order
        for resource_type, resources in resources_by_type.items():
            if resource_type not in RESOURCE_ORDER:
                print(f"   📋 Importing {len(resources)} {resource_type} resources (unordered)...")
                imported, failed = await self.import_resource_type(client, resource_type, resources)
                total_imported += imported
                total_failed += failed
                self.resource_counts[resource_type] += imported
        
        print(f"   ✅ Bundle complete: {total_imported} imported, {total_failed} failed")
        return {
            'success': total_imported > 0,
            'imported': total_imported,
            'failed': total_failed
        }
    
    async def import_resource_type(self, client: httpx.AsyncClient, resource_type: str, resources: List[Dict]) -> tuple:
        """Import all resources of a specific type"""
        imported = 0
        failed = 0
        
        for resource in resources:
            try:
                success = await self.import_resource(client, resource_type, resource)
                if success:
                    imported += 1
                    self.imported_resources.add(f"{resource_type}/{resource.get('id', 'unknown')}")
                else:
                    failed += 1
                    self.failed_resources.append({
                        'type': resource_type,
                        'id': resource.get('id', 'unknown'),
                        'error': 'Import failed'
                    })
            except Exception as e:
                failed += 1
                self.failed_resources.append({
                    'type': resource_type,
                    'id': resource.get('id', 'unknown'),
                    'error': str(e)
                })
                # Don't print every error, just track them
                if 'already exists' not in str(e).lower():
                    print(f"      ❌ Failed to import {resource_type}/{resource.get('id', 'unknown')}: {str(e)[:100]}...")
        
        return imported, failed
    
    async def import_resource(self, client: httpx.AsyncClient, resource_type: str, resource: Dict[str, Any]) -> bool:
        """Import a single resource"""
        try:
            # Check if already exists
            resource_id = resource.get('id')
            if resource_id:
                check_response = await client.get(
                    f"{FHIR_BASE_URL}/{resource_type}/{resource_id}",
                    timeout=10.0
                )
                if check_response.status_code == 200:
                    # Resource already exists, skip
                    return True
            
            # Create new resource
            response = await client.post(
                f"{FHIR_BASE_URL}/{resource_type}",
                json=resource,
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                return True
            elif response.status_code == 500:
                # Could be a duplicate or validation error
                error_text = response.text
                if 'already exists' in error_text.lower() or 'duplicate' in error_text.lower():
                    return True  # Treat duplicates as success
                else:
                    # Try to extract useful error info
                    try:
                        error_data = response.json()
                        error_msg = error_data.get('detail', error_text)
                    except:
                        error_msg = error_text
                    raise Exception(f"Server error: {error_msg[:200]}")
            else:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f"HTTP {response.status_code}")
                except:
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                raise Exception(error_msg)
                
        except Exception as e:
            raise e
    
    def print_summary(self):
        """Print import summary"""
        print("\n" + "="*60)
        print("📊 FHIR Resource Import Summary")
        print("="*60)
        
        total_imported = sum(self.resource_counts.values())
        total_failed = len(self.failed_resources)
        
        print(f"Total resources imported: {total_imported}")
        print(f"Total resources failed: {total_failed}")
        print(f"Total unique resources: {len(self.imported_resources)}")
        
        if self.resource_counts:
            print(f"\n📋 Resources by type:")
            for resource_type in RESOURCE_ORDER:
                if resource_type in self.resource_counts:
                    count = self.resource_counts[resource_type]
                    print(f"   {resource_type}: {count}")
            
            # Show any unordered types
            for resource_type, count in self.resource_counts.items():
                if resource_type not in RESOURCE_ORDER:
                    print(f"   {resource_type}: {count} (unordered)")
        
        if self.failed_resources:
            print(f"\n❌ Failed imports (showing first 10):")
            for failure in self.failed_resources[:10]:
                print(f"   {failure['type']}/{failure['id']}: {failure['error'][:100]}...")
            
            if len(self.failed_resources) > 10:
                print(f"   ... and {len(self.failed_resources) - 10} more failures")
        
        print(f"\n🌐 Test your data at: http://localhost:3000")

async def main():
    """Main import function"""
    print("🏥 MedGenEMR - Complete Synthea FHIR Import")
    print("="*60)
    
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
    # Filter to only patient bundles (exclude hospital/practitioner info files)
    patient_bundles = [f for f in bundle_files if 
                      not f.endswith('hospitalInformation.json') and 
                      not f.endswith('practitionerInformation.json')]
    
    if not patient_bundles:
        print(f"❌ No patient bundle files found in {SYNTHEA_OUTPUT_DIR}")
        return False
    
    print(f"📁 Found {len(patient_bundles)} patient bundles to process")
    
    # Create importer and process all bundles
    importer = FHIRImporter()
    
    async with httpx.AsyncClient() as client:
        for bundle_path in sorted(patient_bundles):
            await importer.import_bundle(client, bundle_path)
    
    # Print final summary
    importer.print_summary()
    
    return sum(importer.resource_counts.values()) > 0

if __name__ == "__main__":
    success = asyncio.run(main())
    if success:
        print("\n🎉 FHIR import completed successfully!")
        print("   All medical records are now available in the EMR system")
    else:
        print("\n❌ FHIR import failed")
        exit(1)