#!/usr/bin/env python3
"""
Import Synthea data into PostgreSQL-backed FHIR server
Handles all resource types with proper validation fixes
"""

import os
import json
import glob
import asyncio
import httpx
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict, OrderedDict
from datetime import datetime
import re

# Configuration
FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

# Resource import order - based on dependencies
RESOURCE_ORDER = [
    # Infrastructure resources first
    "Organization",
    "Location", 
    "Practitioner",
    "PractitionerRole",
    
    # Patient and related
    "Patient",
    "Device",
    
    # Clinical resources
    "Encounter",
    "Condition",
    "Observation",
    "Procedure",
    "DiagnosticReport",
    "ImagingStudy",
    "Specimen",
    
    # Medications
    "Medication",
    "MedicationRequest",
    "MedicationStatement",
    "MedicationAdministration",
    
    # Other clinical
    "Immunization",
    "AllergyIntolerance",
    
    # Care management
    "CareTeam",
    "CarePlan",
    "Goal",
    "ServiceRequest",
    
    # Documentation
    "DocumentReference",
    "Composition",
    
    # Financial
    "Coverage",
    "Claim",
    "ExplanationOfBenefit",
    
    # Other
    "SupplyDelivery",
    "Communication",
    "CommunicationRequest",
    "Media",
    "Provenance"
]

class SyntheaImporter:
    def __init__(self):
        self.resource_counts = defaultdict(int)
        self.failed_resources = defaultdict(list)
        self.reference_map = {}  # Maps urn:uuid to actual IDs
        self.infrastructure_refs = {}  # Maps queries to actual references
        
    def fix_resource(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Apply all necessary fixes to make Synthea resources valid"""
        resource_type = resource.get('resourceType')
        fixed = json.loads(json.dumps(resource))  # Deep copy
        
        # Fix all references first
        self._fix_references_recursive(fixed)
        
        # Remove or simplify problematic text.div content
        if 'text' in fixed and 'div' in fixed['text']:
            fixed['text']['div'] = '<div xmlns="http://www.w3.org/1999/xhtml">Imported from Synthea</div>'
        
        # Resource-specific fixes
        if resource_type == 'Encounter':
            # Fix class field
            if 'class' in fixed and isinstance(fixed['class'], dict):
                # Already correct format
                pass
            
            # Fix period - only keep start and end
            if 'period' in fixed:
                fixed['period'] = {
                    k: v for k, v in fixed['period'].items() 
                    if k in ['start', 'end']
                }
            
            # Fix participant
            if 'participant' in fixed:
                for participant in fixed['participant']:
                    if 'individual' in participant:
                        ref = participant['individual'].get('reference', '')
                        participant['individual'] = {'reference': self._resolve_reference(ref)}
            
            # Fix location
            if 'location' in fixed:
                for loc in fixed['location']:
                    if 'location' in loc:
                        ref = loc['location'].get('reference', '')
                        loc['location'] = {'reference': self._resolve_reference(ref)}
            
            # Fix serviceProvider
            if 'serviceProvider' in fixed:
                ref = fixed['serviceProvider'].get('reference', '')
                fixed['serviceProvider'] = {'reference': self._resolve_reference(ref)}
        
        elif resource_type == 'Observation':
            # Fix performer references
            if 'performer' in fixed:
                fixed['performer'] = [
                    {'reference': self._resolve_reference(p.get('reference', ''))}
                    for p in fixed['performer']
                ]
        
        elif resource_type == 'Procedure':
            # Fix performedPeriod
            if 'performedPeriod' in fixed:
                fixed['performedPeriod'] = {
                    k: v for k, v in fixed['performedPeriod'].items()
                    if k in ['start', 'end']
                }
            
            # Fix performer
            if 'performer' in fixed:
                for performer in fixed['performer']:
                    if 'actor' in performer:
                        ref = performer['actor'].get('reference', '')
                        performer['actor'] = {'reference': self._resolve_reference(ref)}
        
        elif resource_type == 'MedicationRequest':
            # Fix dosageInstruction
            if 'dosageInstruction' in fixed:
                for dosage in fixed['dosageInstruction']:
                    if 'timing' in dosage and 'repeat' in dosage['timing']:
                        # Remove extra fields
                        allowed = ['frequency', 'period', 'periodUnit', 'boundsPeriod',
                                 'count', 'countMax', 'duration', 'durationUnit',
                                 'timeOfDay', 'when', 'offset']
                        dosage['timing']['repeat'] = {
                            k: v for k, v in dosage['timing']['repeat'].items()
                            if k in allowed
                        }
            
            # Fix requester
            if 'requester' in fixed:
                ref = fixed['requester'].get('reference', '')
                fixed['requester'] = {'reference': self._resolve_reference(ref)}
        
        elif resource_type == 'DiagnosticReport':
            # Fix performer
            if 'performer' in fixed:
                fixed['performer'] = [
                    {'reference': self._resolve_reference(p.get('reference', ''))}
                    for p in fixed['performer']
                ]
        
        elif resource_type == 'Claim':
            # Fix provider
            if 'provider' in fixed:
                ref = fixed['provider'].get('reference', '')
                fixed['provider'] = {'reference': self._resolve_reference(ref)}
            
            # Fix item encounters
            if 'item' in fixed:
                for item in fixed['item']:
                    if 'encounter' in item and isinstance(item['encounter'], list):
                        item['encounter'] = [
                            {'reference': self._resolve_reference(e.get('reference', ''))}
                            for e in item['encounter'][:1]  # Keep only first
                        ]
        
        elif resource_type == 'ExplanationOfBenefit':
            # Similar to Claim
            if 'provider' in fixed:
                ref = fixed['provider'].get('reference', '')
                fixed['provider'] = {'reference': self._resolve_reference(ref)}
            
            # Fix item encounters
            if 'item' in fixed:
                for item in fixed['item']:
                    if 'encounter' in item and isinstance(item['encounter'], list):
                        item['encounter'] = [
                            {'reference': self._resolve_reference(e.get('reference', ''))}
                            for e in item['encounter'][:1]
                        ]
        
        return fixed
    
    def _fix_references_recursive(self, obj: Any, path: str = "") -> None:
        """Recursively fix all references in the resource"""
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key == 'reference' and isinstance(value, str):
                    obj[key] = self._resolve_reference(value)
                else:
                    self._fix_references_recursive(value, f"{path}.{key}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                self._fix_references_recursive(item, f"{path}[{i}]")
    
    def _resolve_reference(self, ref: str) -> str:
        """Resolve various reference formats to standard FHIR references"""
        if not ref:
            return ref
            
        # Handle urn:uuid references
        if ref.startswith('urn:uuid:'):
            uuid = ref.replace('urn:uuid:', '')
            if uuid in self.reference_map:
                return self.reference_map[uuid]
            # Default to patient if unknown
            return f"Patient/{uuid}"
        
        # Handle query-based references
        if '?' in ref and not ref.startswith('http'):
            # Check cache first
            if ref in self.infrastructure_refs:
                return self.infrastructure_refs[ref]
            
            # Parse and create placeholder
            resource_type = ref.split('?')[0]
            if resource_type == 'Organization':
                return "Organization/synthea-org"
            elif resource_type == 'Location':
                return "Location/synthea-loc"
            elif resource_type == 'Practitioner':
                # Extract NPI if present
                npi_match = re.search(r'identifier=.*\|(\d+)', ref)
                if npi_match:
                    return f"Practitioner/npi-{npi_match.group(1)}"
                return "Practitioner/synthea-prac"
        
        return ref
    
    async def import_infrastructure(self, client: httpx.AsyncClient) -> None:
        """Import organization, location, and practitioner resources first"""
        print("\n📋 Importing infrastructure resources...")
        
        # Look for infrastructure files
        for filename in ['hospitalInformation', 'practitionerInformation']:
            pattern = os.path.join(SYNTHEA_OUTPUT_DIR, f"{filename}*.json")
            files = glob.glob(pattern)
            
            for file_path in files:
                print(f"\n   Processing {os.path.basename(file_path)}...")
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                if data.get('resourceType') != 'Bundle':
                    continue
                
                # Group by type
                by_type = defaultdict(list)
                for entry in data.get('entry', []):
                    resource = entry.get('resource', {})
                    if resource:
                        by_type[resource.get('resourceType')].append(resource)
                
                # Import in order
                for resource_type in ['Organization', 'Location', 'Practitioner', 'PractitionerRole']:
                    if resource_type in by_type:
                        print(f"      Importing {len(by_type[resource_type])} {resource_type} resources...")
                        for resource in by_type[resource_type]:
                            await self._import_single_resource(client, resource)
    
    async def import_bundle(self, client: httpx.AsyncClient, bundle_path: str) -> None:
        """Import all resources from a patient bundle"""
        print(f"\n📦 Processing bundle: {os.path.basename(bundle_path)}")
        
        with open(bundle_path, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            return
        
        # Count resources
        by_type = defaultdict(list)
        for entry in bundle.get('entry', []):
            resource = entry.get('resource', {})
            if resource:
                resource_type = resource.get('resourceType')
                resource_id = resource.get('id')
                if resource_type and resource_id:
                    by_type[resource_type].append(resource)
                    # Map UUID for future reference resolution
                    self.reference_map[resource_id] = f"{resource_type}/{resource_id}"
        
        print(f"   Found {sum(len(v) for v in by_type.values())} resources")
        
        # Import in dependency order
        for resource_type in RESOURCE_ORDER:
            if resource_type in by_type:
                resources = by_type[resource_type]
                print(f"   📋 Importing {len(resources)} {resource_type} resources...")
                
                success = 0
                failed = 0
                
                for resource in resources:
                    if await self._import_single_resource(client, resource):
                        success += 1
                    else:
                        failed += 1
                
                if success > 0:
                    print(f"      ✅ {success} imported")
                if failed > 0:
                    print(f"      ❌ {failed} failed")
    
    async def _import_single_resource(self, client: httpx.AsyncClient, resource: Dict[str, Any]) -> bool:
        """Import a single resource"""
        resource_type = resource.get('resourceType')
        resource_id = resource.get('id')
        
        try:
            # Fix the resource
            fixed_resource = self.fix_resource(resource)
            
            # Check if already exists
            if resource_id:
                try:
                    check_response = await client.get(
                        f"{FHIR_BASE_URL}/{resource_type}/{resource_id}",
                        timeout=10.0
                    )
                    if check_response.status_code == 200:
                        self.resource_counts[resource_type] += 1
                        return True  # Already exists
                except:
                    pass
            
            # Create resource
            response = await client.post(
                f"{FHIR_BASE_URL}/{resource_type}",
                json=fixed_resource,
                timeout=30.0
            )
            
            if response.status_code in [200, 201]:
                self.resource_counts[resource_type] += 1
                
                # Store special infrastructure references
                if resource_type == 'Organization' and resource_id:
                    self.infrastructure_refs[f"Organization?identifier=https://github.com/synthetichealth/synthea|{resource_id}"] = f"Organization/{resource_id}"
                elif resource_type == 'Location' and resource_id:
                    self.infrastructure_refs[f"Location?identifier=https://github.com/synthetichealth/synthea|{resource_id}"] = f"Location/{resource_id}"
                elif resource_type == 'Practitioner':
                    # Extract NPI if present
                    for identifier in resource.get('identifier', []):
                        if identifier.get('system') == 'http://hl7.org/fhir/sid/us-npi':
                            npi = identifier.get('value')
                            if npi:
                                self.infrastructure_refs[f"Practitioner?identifier=http://hl7.org/fhir/sid/us-npi|{npi}"] = f"Practitioner/{resource_id}"
                
                return True
            
            elif response.status_code == 500:
                # Check if duplicate
                if 'already exists' in response.text.lower():
                    self.resource_counts[resource_type] += 1
                    return True
                else:
                    self.failed_resources[resource_type].append({
                        'id': resource_id,
                        'error': f"Server error: {response.text[:100]}"
                    })
                    return False
            
            else:
                # Log first few validation errors
                if len(self.failed_resources[resource_type]) < 3:
                    try:
                        error_data = response.json()
                        if 'issue' in error_data:
                            issues = []
                            for issue in error_data['issue'][:2]:
                                severity = issue.get('severity', 'unknown')
                                details = issue.get('details', {}).get('text', 'No details')
                                issues.append(f"{severity}: {details[:100]}")
                            
                            self.failed_resources[resource_type].append({
                                'id': resource_id,
                                'error': '; '.join(issues)
                            })
                            
                            # Print first error for each type
                            if len(self.failed_resources[resource_type]) == 1:
                                print(f"         First {resource_type} error: {issues[0][:150]}...")
                    except:
                        self.failed_resources[resource_type].append({
                            'id': resource_id,
                            'error': f"HTTP {response.status_code}"
                        })
                else:
                    self.failed_resources[resource_type].append({
                        'id': resource_id,
                        'error': f"HTTP {response.status_code}"
                    })
                
                return False
                
        except Exception as e:
            self.failed_resources[resource_type].append({
                'id': resource_id,
                'error': str(e)[:100]
            })
            return False
    
    def print_summary(self):
        """Print import summary"""
        print("\n" + "="*60)
        print("📊 Synthea Import Summary (PostgreSQL)")
        print("="*60)
        
        total_imported = sum(self.resource_counts.values())
        total_failed = sum(len(failures) for failures in self.failed_resources.values())
        
        print(f"\nTotal resources imported: {total_imported}")
        print(f"Total resources failed: {total_failed}")
        
        if self.resource_counts:
            print(f"\n✅ Successfully imported by type:")
            for resource_type in RESOURCE_ORDER:
                if resource_type in self.resource_counts:
                    count = self.resource_counts[resource_type]
                    print(f"   {resource_type}: {count}")
        
        if self.failed_resources:
            print(f"\n❌ Failed imports by type:")
            for resource_type, failures in self.failed_resources.items():
                print(f"   {resource_type}: {len(failures)} failed")
                if failures and len(failures) <= 2:
                    for failure in failures:
                        print(f"      - {failure['id']}: {failure['error'][:100]}...")

async def main():
    """Main import function"""
    print("🏥 MedGenEMR Synthea Import (PostgreSQL)")
    print("="*60)
    
    # Check server
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{FHIR_BASE_URL}/metadata", timeout=10.0)
            if response.status_code != 200:
                print(f"❌ FHIR server not responding correctly")
                return False
            print("✅ FHIR server is running on PostgreSQL")
        except Exception as e:
            print(f"❌ Cannot connect to FHIR server at {FHIR_BASE_URL}")
            print(f"   Error: {e}")
            return False
    
    # Check Synthea output
    if not os.path.exists(SYNTHEA_OUTPUT_DIR):
        print(f"❌ Synthea output directory not found: {SYNTHEA_OUTPUT_DIR}")
        return False
    
    importer = SyntheaImporter()
    
    async with httpx.AsyncClient() as client:
        # Import infrastructure first
        await importer.import_infrastructure(client)
        
        # Import patient bundles
        patient_files = glob.glob(os.path.join(SYNTHEA_OUTPUT_DIR, "*.json"))
        patient_bundles = [f for f in patient_files if 
                         not f.endswith('hospitalInformation.json') and 
                         not f.endswith('practitionerInformation.json')]
        
        print(f"\n📁 Found {len(patient_bundles)} patient bundles to import")
        
        for bundle_path in sorted(patient_bundles):
            await importer.import_bundle(client, bundle_path)
    
    # Print summary
    importer.print_summary()
    
    print(f"\n🌐 Your complete EMR data is available at: http://localhost:3000")
    print(f"   PostgreSQL database: emr_db")
    
    return sum(importer.resource_counts.values()) > 0

if __name__ == "__main__":
    success = asyncio.run(main())
    if success:
        print("\n🎉 Synthea import to PostgreSQL completed successfully!")
    else:
        print("\n❌ Synthea import failed")
        exit(1)