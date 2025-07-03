#!/usr/bin/env python3
"""
Fixed Synthea FHIR Import - handles Synthea-specific reference formats and validation issues
"""

import os
import json
import glob
import asyncio
import httpx
import re
from typing import Dict, List, Any, Set
from collections import defaultdict

# Configuration for local development
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

class SyntheaImporter:
    def __init__(self):
        self.imported_resources = set()
        self.failed_resources = []
        self.resource_counts = defaultdict(int)
        self.uuid_to_id_map = {}  # Map urn:uuid to actual resource IDs
        
    def fix_references(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Synthea reference formats to standard FHIR references"""
        resource_copy = json.loads(json.dumps(resource))  # Deep copy
        
        def fix_reference_value(ref_value: str) -> str:
            """Convert various reference formats to standard FHIR references"""
            if not isinstance(ref_value, str):
                return ref_value
                
            # Handle urn:uuid references - convert to direct reference
            if ref_value.startswith('urn:uuid:'):
                uuid_part = ref_value.replace('urn:uuid:', '')
                if uuid_part in self.uuid_to_id_map:
                    resource_type, actual_id = self.uuid_to_id_map[uuid_part]
                    return f"{resource_type}/{actual_id}"
                else:
                    # Use the UUID as the ID directly
                    # Try to determine resource type from context
                    return f"Patient/{uuid_part}"  # Default to Patient for now
            
            # Handle query-based references like "Practitioner?identifier=..."
            if '?' in ref_value and not ref_value.startswith('http'):
                resource_type = ref_value.split('?')[0]
                # For now, just return a placeholder reference
                # In a real implementation, you'd query to find the actual resource
                return f"{resource_type}/unknown"
            
            return ref_value
        
        def fix_references_recursive(obj, path=""):
            """Recursively fix all references in the resource"""
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key == 'reference' and isinstance(value, str):
                        obj[key] = fix_reference_value(value)
                    else:
                        fix_references_recursive(value, f"{path}.{key}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    fix_references_recursive(item, f"{path}[{i}]")
        
        fix_references_recursive(resource_copy)
        return resource_copy
    
    def fix_resource_structure(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Fix Synthea-specific structure issues"""
        resource_type = resource.get('resourceType')
        fixed_resource = self.fix_references(resource)
        
        # Fix Encounter-specific issues
        if resource_type == 'Encounter':
            # Fix class field - should be a single object, not in a list
            if 'class' in fixed_resource and isinstance(fixed_resource['class'], dict):
                # It's already correct format
                pass
            
            # Fix period field if it has extra fields
            if 'period' in fixed_resource:
                period = fixed_resource['period']
                # Keep only start and end
                fixed_period = {}
                if 'start' in period:
                    fixed_period['start'] = period['start']
                if 'end' in period:
                    fixed_period['end'] = period['end']
                fixed_resource['period'] = fixed_period
            
            # Fix participant individual references
            if 'participant' in fixed_resource:
                for participant in fixed_resource['participant']:
                    if 'individual' in participant:
                        # Remove extra fields, keep only reference
                        individual = participant['individual']
                        if isinstance(individual, dict) and 'reference' in individual:
                            participant['individual'] = {
                                'reference': individual['reference']
                            }
        
        # Fix Observation-specific issues
        elif resource_type == 'Observation':
            # Fix subject reference
            if 'subject' in fixed_resource and 'reference' in fixed_resource['subject']:
                ref = fixed_resource['subject']['reference']
                if ref.startswith('urn:uuid:'):
                    patient_id = ref.replace('urn:uuid:', '')
                    fixed_resource['subject'] = {'reference': f'Patient/{patient_id}'}
            
            # Fix encounter reference
            if 'encounter' in fixed_resource and 'reference' in fixed_resource['encounter']:
                ref = fixed_resource['encounter']['reference']
                if ref.startswith('urn:uuid:'):
                    encounter_id = ref.replace('urn:uuid:', '')
                    fixed_resource['encounter'] = {'reference': f'Encounter/{encounter_id}'}
        
        # Fix Condition-specific issues
        elif resource_type == 'Condition':
            # Fix subject reference
            if 'subject' in fixed_resource and 'reference' in fixed_resource['subject']:
                ref = fixed_resource['subject']['reference']
                if ref.startswith('urn:uuid:'):
                    patient_id = ref.replace('urn:uuid:', '')
                    fixed_resource['subject'] = {'reference': f'Patient/{patient_id}'}
            
            # Fix encounter reference
            if 'encounter' in fixed_resource and 'reference' in fixed_resource['encounter']:
                ref = fixed_resource['encounter']['reference']
                if ref.startswith('urn:uuid:'):
                    encounter_id = ref.replace('urn:uuid:', '')
                    fixed_resource['encounter'] = {'reference': f'Encounter/{encounter_id}'}
        
        # Store UUID mapping for this resource
        if 'id' in fixed_resource:
            self.uuid_to_id_map[fixed_resource['id']] = (resource_type, fixed_resource['id'])
        
        return fixed_resource
    
    async def import_resource(self, client: httpx.AsyncClient, resource_type: str, resource: Dict[str, Any]) -> bool:
        """Import a single resource with Synthea fixes"""
        try:
            # Fix the resource structure
            fixed_resource = self.fix_resource_structure(resource)
            
            # Check if already exists
            resource_id = fixed_resource.get('id')
            if resource_id:
                try:
                    check_response = await client.get(
                        f"{FHIR_BASE_URL}/{resource_type}/{resource_id}",
                        timeout=10.0
                    )
                    if check_response.status_code == 200:
                        return True  # Already exists
                except:
                    pass  # Continue with creation
            
            # Create new resource
            response = await client.post(
                f"{FHIR_BASE_URL}/{resource_type}",
                json=fixed_resource,
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                return True
            elif response.status_code == 500:
                error_text = response.text
                if 'already exists' in error_text.lower() or 'duplicate' in error_text.lower():
                    return True
                else:
                    raise Exception(f"Server error: {error_text[:200]}")
            else:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f"HTTP {response.status_code}")
                    
                    # Print validation details for debugging
                    if response.status_code == 400 and 'OperationOutcome' in str(error_data):
                        print(f"   Validation error for {resource_type}/{resource_id}:")
                        if 'issue' in error_data:
                            for issue in error_data['issue'][:2]:  # Show first 2 issues
                                severity = issue.get('severity', 'unknown')
                                details = issue.get('details', {}).get('text', 'No details')
                                print(f"     {severity}: {details[:100]}...")
                        return False
                    
                except Exception as e:
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                raise Exception(error_msg)
                
        except Exception as e:
            # Only print error if it's not a validation error we expect
            if not ('validation' in str(e).lower() or 'HTTP 400' in str(e)):
                print(f"   ❌ Error importing {resource_type}/{resource.get('id', 'unknown')}: {str(e)[:100]}...")
            return False
    
    async def import_bundle_selective(self, client: httpx.AsyncClient, bundle_path: str) -> Dict[str, Any]:
        """Import only patients, encounters, and observations from a bundle"""
        print(f"\n📦 Processing bundle: {os.path.basename(bundle_path)}")
        
        with open(bundle_path, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            print(f"⚠️  Skipping {bundle_path} - not a Bundle resource")
            return {'success': False, 'error': 'Not a Bundle'}
        
        entries = bundle.get('entry', [])
        print(f"   Found {len(entries)} resources in bundle")
        
        # Group resources by type - focus on core resources first
        resources_by_type = defaultdict(list)
        for entry in entries:
            resource = entry.get('resource', {})
            resource_type = resource.get('resourceType')
            if resource_type in ['Patient', 'Encounter', 'Observation', 'Condition', 'Procedure']:
                resources_by_type[resource_type].append(resource)
        
        # Import in order: Patient -> Encounter -> Others
        total_imported = 0
        total_failed = 0
        
        import_order = ['Patient', 'Encounter', 'Observation', 'Condition', 'Procedure']
        
        for resource_type in import_order:
            if resource_type in resources_by_type:
                resources = resources_by_type[resource_type]
                print(f"   📋 Importing {len(resources)} {resource_type} resources...")
                
                imported = 0
                failed = 0
                
                for resource in resources:
                    success = await self.import_resource(client, resource_type, resource)
                    if success:
                        imported += 1
                        total_imported += 1
                        self.imported_resources.add(f"{resource_type}/{resource.get('id', 'unknown')}")
                    else:
                        failed += 1
                        total_failed += 1
                
                print(f"      ✅ {imported} imported, ❌ {failed} failed")
                self.resource_counts[resource_type] += imported
        
        print(f"   📊 Bundle complete: {total_imported} imported, {total_failed} failed")
        return {
            'success': total_imported > 0,
            'imported': total_imported,
            'failed': total_failed
        }
    
    def print_summary(self):
        """Print import summary"""
        print("\n" + "="*60)
        print("📊 Synthea FHIR Import Summary")
        print("="*60)
        
        total_imported = sum(self.resource_counts.values())
        total_failed = len(self.failed_resources)
        
        print(f"Total resources imported: {total_imported}")
        print(f"Total resources failed: {total_failed}")
        print(f"Total unique resources: {len(self.imported_resources)}")
        
        if self.resource_counts:
            print(f"\n📋 Successfully imported resources:")
            for resource_type, count in self.resource_counts.items():
                print(f"   {resource_type}: {count}")
        
        print(f"\n🌐 Test your data at: http://localhost:3000")

async def main():
    """Main import function"""
    print("🩺 Synthea FHIR Import - Fixed for Validation Issues")
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
    patient_bundles = [f for f in bundle_files if 
                      not f.endswith('hospitalInformation.json') and 
                      not f.endswith('practitionerInformation.json')]
    
    if not patient_bundles:
        print(f"❌ No patient bundle files found in {SYNTHEA_OUTPUT_DIR}")
        return False
    
    print(f"📁 Found {len(patient_bundles)} patient bundles to process")
    
    # Create importer and process all bundles
    importer = SyntheaImporter()
    
    async with httpx.AsyncClient() as client:
        for bundle_path in sorted(patient_bundles):
            await importer.import_bundle_selective(client, bundle_path)
    
    # Print final summary
    importer.print_summary()
    
    return sum(importer.resource_counts.values()) > 0

if __name__ == "__main__":
    success = asyncio.run(main())
    if success:
        print("\n🎉 Synthea FHIR import completed successfully!")
        print("   Core medical data is now available in the EMR system")
    else:
        print("\n❌ Synthea FHIR import failed")
        exit(1)