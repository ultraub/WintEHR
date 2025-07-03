#!/usr/bin/env python3
"""
Import Synthea FHIR bundles with complete validation support.

This script uses the enhanced SyntheaFHIRValidator to properly handle
all Synthea-specific formats and successfully import ALL resource types.
"""

import asyncio
import json
import glob
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Dict, Any, List, Tuple
import httpx

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.fhir.synthea_validator import SyntheaFHIRValidator

FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

class CompleteSyntheaImporter:
    def __init__(self):
        self.validator = SyntheaFHIRValidator()
        self.imported_counts = defaultdict(int)
        self.error_counts = defaultdict(int)
        self.reference_map = {}  # Maps Synthea UUIDs to FHIR IDs
        self.validation_errors = defaultdict(list)
        
    async def import_all_bundles(self):
        """Import all Synthea bundles with full validation."""
        print("🏥 Complete Synthea FHIR Import with Enhanced Validation")
        print("=" * 60)
        
        # Check server
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{FHIR_BASE_URL}/metadata", timeout=10.0)
                if response.status_code != 200:
                    print("❌ FHIR server not responding")
                    return
                print("✅ FHIR server is running")
            except Exception as e:
                print(f"❌ Cannot connect to FHIR server: {e}")
                return
        
        # Process bundles in order
        bundle_files = glob.glob(os.path.join(SYNTHEA_OUTPUT_DIR, "*.json"))
        
        # 1. First import practitioner and hospital information
        special_bundles = []
        patient_bundles = []
        
        for bundle_file in bundle_files:
            if bundle_file.endswith('practitionerInformation.json'):
                special_bundles.insert(0, bundle_file)  # Process first
            elif bundle_file.endswith('hospitalInformation.json'):
                special_bundles.append(bundle_file)
            else:
                patient_bundles.append(bundle_file)
        
        # Import special bundles first
        print("\n📋 Importing Practitioner and Organization data...")
        async with httpx.AsyncClient(timeout=30.0) as client:
            for bundle_path in special_bundles:
                await self.import_bundle(client, bundle_path)
        
        # Import patient bundles
        print("\n👥 Importing Patient data...")
        async with httpx.AsyncClient(timeout=30.0) as client:
            for i, bundle_path in enumerate(patient_bundles):
                print(f"\nProcessing bundle {i+1}/{len(patient_bundles)}: {os.path.basename(bundle_path)}")
                await self.import_bundle(client, bundle_path)
        
        # Print final summary
        self.print_summary()
    
    async def import_bundle(self, client: httpx.AsyncClient, bundle_path: str):
        """Import a single bundle with enhanced validation."""
        with open(bundle_path, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            return
        
        entries = bundle.get('entry', [])
        print(f"  Processing {len(entries)} entries...")
        
        # Group entries by resource type
        entries_by_type = defaultdict(list)
        for entry in entries:
            resource = entry.get('resource', {})
            resource_type = resource.get('resourceType')
            if resource_type:
                entries_by_type[resource_type].append(entry)
        
        # Process in dependency order
        resource_order = [
            'Organization', 'Location', 'Practitioner', 'PractitionerRole',
            'Patient', 'Device', 'Medication',
            'Encounter', 'Condition', 'Observation', 'Procedure',
            'MedicationRequest', 'MedicationAdministration',
            'DiagnosticReport', 'ImagingStudy', 'Immunization',
            'AllergyIntolerance', 'CarePlan', 'Goal', 'CareTeam',
            'Claim', 'Coverage', 'ExplanationOfBenefit',
            'DocumentReference', 'Composition', 'Communication'
        ]
        
        # Process resources in order
        for resource_type in resource_order:
            if resource_type in entries_by_type:
                print(f"    Importing {len(entries_by_type[resource_type])} {resource_type} resources...")
                for entry in entries_by_type[resource_type]:
                    await self.import_resource(client, entry)
        
        # Process any remaining resource types
        for resource_type, entries in entries_by_type.items():
            if resource_type not in resource_order:
                print(f"    Importing {len(entries)} {resource_type} resources...")
                for entry in entries:
                    await self.import_resource(client, entry)
    
    async def import_resource(self, client: httpx.AsyncClient, entry: Dict[str, Any]):
        """Import a single resource with validation."""
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        original_id = resource.get('id')
        
        if not resource_type:
            return
        
        try:
            # Validate with enhanced validator
            validation_result = self.validator.validate_resource(
                resource_type,
                resource
            )
            
            # Check for validation errors
            has_errors = False
            for issue in validation_result.issue:
                if issue.severity in ["error", "fatal"]:
                    has_errors = True
                    self.validation_errors[resource_type].append({
                        'id': original_id,
                        'severity': issue.severity,
                        'code': issue.code,
                        'details': issue.details.get('text') if issue.details else 'No details',
                        'expression': issue.expression
                    })
            
            if has_errors:
                self.error_counts[resource_type] += 1
                return
            
            # Update reference map if needed
            if original_id and original_id.startswith('urn:uuid:'):
                # Generate a proper FHIR ID
                fhir_id = original_id.replace('urn:uuid:', '').replace('-', '')[:64]
                resource['id'] = fhir_id
                self.reference_map[original_id] = f"{resource_type}/{fhir_id}"
            
            # Update references in the resource
            self._update_references(resource)
            
            # Create the resource
            response = await client.post(
                f"{FHIR_BASE_URL}/{resource_type}",
                json=resource
            )
            
            if response.status_code in [200, 201]:
                self.imported_counts[resource_type] += 1
                location = response.headers.get('Location')
                if location and original_id:
                    self.reference_map[original_id] = location
            else:
                self.error_counts[resource_type] += 1
                if response.status_code == 400:
                    error_data = response.json()
                    if 'issue' in error_data:
                        for issue in error_data['issue']:
                            self.validation_errors[resource_type].append({
                                'id': original_id,
                                'severity': issue.get('severity', 'error'),
                                'code': issue.get('code', 'unknown'),
                                'details': issue.get('details', {}).get('text', 'No details'),
                                'expression': issue.get('expression', [])
                            })
                
        except Exception as e:
            self.error_counts[resource_type] += 1
            self.validation_errors[resource_type].append({
                'id': original_id,
                'exception': str(e)
            })
    
    def _update_references(self, resource: Dict[str, Any], path: str = ""):
        """Update Synthea UUID references to FHIR references."""
        if isinstance(resource, dict):
            for key, value in list(resource.items()):
                if key == 'reference' and isinstance(value, str):
                    # Check if it's a UUID reference we've seen
                    if value in self.reference_map:
                        resource[key] = self.reference_map[value]
                    elif value.startswith('urn:uuid:'):
                        # Try to resolve it
                        uuid_part = value.replace('urn:uuid:', '')
                        # Look for partial matches
                        for orig_id, fhir_ref in self.reference_map.items():
                            if uuid_part in orig_id:
                                resource[key] = fhir_ref
                                break
                elif isinstance(value, dict):
                    self._update_references(value, f"{path}.{key}")
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict):
                            self._update_references(item, f"{path}.{key}[]")
    
    def print_summary(self):
        """Print import summary."""
        print("\n" + "=" * 60)
        print("📊 IMPORT SUMMARY")
        print("=" * 60)
        
        # Successful imports
        print("\n✅ Successfully Imported:")
        total_imported = 0
        for resource_type in sorted(self.imported_counts.keys()):
            count = self.imported_counts[resource_type]
            print(f"  {resource_type}: {count}")
            total_imported += count
        
        if not self.imported_counts:
            print("  None")
        else:
            print(f"\n  Total: {total_imported} resources")
        
        # Errors
        print("\n❌ Import Errors:")
        total_errors = 0
        for resource_type in sorted(self.error_counts.keys()):
            count = self.error_counts[resource_type]
            print(f"  {resource_type}: {count}")
            total_errors += count
        
        if not self.error_counts:
            print("  None")
        else:
            print(f"\n  Total: {total_errors} errors")
        
        # Validation error details
        if self.validation_errors:
            print("\n🔍 Validation Error Details:")
            for resource_type, errors in sorted(self.validation_errors.items()):
                if errors:
                    print(f"\n  {resource_type}:")
                    # Group by error type
                    error_groups = defaultdict(list)
                    for error in errors[:5]:  # Show first 5
                        key = f"{error.get('code', 'unknown')}|{error.get('details', 'No details')}"
                        error_groups[key].append(error)
                    
                    for error_key, error_list in error_groups.items():
                        code, details = error_key.split('|', 1)
                        print(f"    - {code}: {details} ({len(error_list)} occurrences)")
        
        # Success rate
        if total_imported + total_errors > 0:
            success_rate = (total_imported / (total_imported + total_errors)) * 100
            print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        # Reference resolution
        print(f"\n🔗 References Resolved: {len(self.reference_map)}")

async def main():
    """Main import function."""
    importer = CompleteSyntheaImporter()
    await importer.import_all_bundles()

if __name__ == "__main__":
    asyncio.run(main())