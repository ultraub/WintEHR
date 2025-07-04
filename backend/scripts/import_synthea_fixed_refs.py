#!/usr/bin/env python3
"""
Import Synthea data with fixed references and cleaned structures
"""

import os
import json
import glob
import asyncio
import httpx
from typing import Dict, List, Any
from collections import defaultdict

# Configuration
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

class SyntheaImporter:
    def __init__(self):
        self.resource_map = {}  # Map urn:uuid to actual IDs
        self.stats = defaultdict(lambda: {'imported': 0, 'failed': 0})
    
    def fix_reference(self, ref):
        """Fix urn:uuid references to actual resource references"""
        if isinstance(ref, dict) and 'reference' in ref:
            original_ref = ref['reference']
            if original_ref.startswith('urn:uuid:'):
                uuid = original_ref.replace('urn:uuid:', '')
                if uuid in self.resource_map:
                    ref['reference'] = self.resource_map[uuid]
            elif 'Practitioner?identifier=' in original_ref:
                # Fix practitioner references
                ref['reference'] = original_ref.replace('Practitioner?identifier=', 'Practitioner/')
        return ref
    
    def clean_encounter(self, encounter):
        """Clean encounter resource for our FHIR server"""
        # Fix subject reference
        if 'subject' in encounter:
            encounter['subject'] = self.fix_reference(encounter['subject'])
        
        # Fix participant references and remove period from participant
        if 'participant' in encounter:
            for participant in encounter['participant']:
                if 'individual' in participant:
                    participant['individual'] = self.fix_reference(participant['individual'])
                # Remove period from participant (not in our model)
                if 'period' in participant:
                    del participant['period']
        
        # Fix serviceProvider reference
        if 'serviceProvider' in encounter:
            encounter['serviceProvider'] = self.fix_reference(encounter['serviceProvider'])
        
        # Remove reasonReference if it has urn:uuid
        if 'reasonReference' in encounter:
            cleaned_refs = []
            for ref in encounter['reasonReference']:
                fixed_ref = self.fix_reference(ref)
                if not fixed_ref['reference'].startswith('urn:uuid:'):
                    cleaned_refs.append(fixed_ref)
            if cleaned_refs:
                encounter['reasonReference'] = cleaned_refs
            else:
                del encounter['reasonReference']
        
        return encounter
    
    def clean_resource(self, resource_type, resource):
        """Clean any resource type"""
        # Fix all reference fields
        for key, value in list(resource.items()):
            if key == 'subject' or key == 'patient' or key == 'encounter' or key == 'performer' or key == 'author':
                resource[key] = self.fix_reference(value) if isinstance(value, dict) else value
            elif key == 'reference' and isinstance(value, dict):
                resource[key] = self.fix_reference(value)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, dict) and 'reference' in item:
                        value[i] = self.fix_reference(item)
        
        # Special handling for different resource types
        if resource_type == 'Encounter':
            return self.clean_encounter(resource)
        elif resource_type == 'AllergyIntolerance':
            # Remove recorder if it's a urn:uuid
            if 'recorder' in resource and isinstance(resource['recorder'], dict):
                ref = resource['recorder'].get('reference', '')
                if ref.startswith('urn:uuid:'):
                    del resource['recorder']
        elif resource_type == 'MedicationRequest':
            # Fix requester
            if 'requester' in resource and isinstance(resource['requester'], dict):
                resource['requester'] = self.fix_reference(resource['requester'])
        elif resource_type == 'Procedure':
            # Fix performer references
            if 'performer' in resource:
                for performer in resource['performer']:
                    if 'actor' in performer:
                        performer['actor'] = self.fix_reference(performer['actor'])
        
        return resource
    
    async def import_bundle(self, bundle_path):
        """Import a single patient bundle"""
        print(f"\n📦 Processing: {os.path.basename(bundle_path)}")
        
        with open(bundle_path) as f:
            bundle = json.load(f)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First pass: Import base resources and build reference map
            for entry in bundle['entry']:
                resource = entry['resource']
                resource_type = resource['resourceType']
                
                if resource_type in ['Patient', 'Practitioner', 'Organization', 'Location']:
                    # Store original ID
                    original_id = resource.get('id')
                    
                    # Import resource
                    success = await self.import_resource(client, resource_type, resource)
                    
                    if success and original_id:
                        # Map urn:uuid to actual resource reference
                        self.resource_map[original_id] = f"{resource_type}/{original_id}"
            
            # Second pass: Import clinical resources with fixed references
            for entry in bundle['entry']:
                resource = entry['resource']
                resource_type = resource['resourceType']
                
                if resource_type not in ['Patient', 'Practitioner', 'Organization', 'Location']:
                    # Clean the resource
                    cleaned_resource = self.clean_resource(resource_type, resource)
                    
                    # Import resource
                    await self.import_resource(client, resource_type, cleaned_resource)
    
    async def import_resource(self, client, resource_type, resource):
        """Import a single resource"""
        try:
            # Check if exists
            resource_id = resource.get('id')
            if resource_id:
                check_response = await client.get(f"{FHIR_BASE_URL}/{resource_type}/{resource_id}")
                if check_response.status_code == 200:
                    self.stats[resource_type]['imported'] += 1
                    return True
            
            # Create resource
            response = await client.post(
                f"{FHIR_BASE_URL}/{resource_type}",
                json=resource
            )
            
            if response.status_code in [200, 201]:
                self.stats[resource_type]['imported'] += 1
                return True
            else:
                self.stats[resource_type]['failed'] += 1
                if self.stats[resource_type]['failed'] <= 3:  # Only show first 3 errors per type
                    print(f"  ❌ {resource_type}: {response.status_code} - {response.text[:100]}")
                return False
                
        except Exception as e:
            self.stats[resource_type]['failed'] += 1
            if self.stats[resource_type]['failed'] <= 3:
                print(f"  ❌ {resource_type}: {str(e)[:100]}")
            return False
    
    async def run(self):
        """Run the import process"""
        print("🏥 Synthea FHIR Import with Fixed References")
        print("=" * 60)
        
        # Find all patient bundles
        pattern = os.path.join(SYNTHEA_OUTPUT_DIR, "*_*.json")
        bundles = glob.glob(pattern)
        patient_bundles = [b for b in bundles if 'practitioner' not in b.lower() and 'hospital' not in b.lower()]
        
        print(f"📁 Found {len(patient_bundles)} patient bundles")
        
        # Process each bundle
        for bundle_path in patient_bundles:
            await self.import_bundle(bundle_path)
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 Import Summary:")
        for resource_type, stats in sorted(self.stats.items()):
            total = stats['imported'] + stats['failed']
            if total > 0:
                print(f"  {resource_type}: {stats['imported']} imported, {stats['failed']} failed")

async def main():
    importer = SyntheaImporter()
    await importer.run()

if __name__ == "__main__":
    asyncio.run(main())