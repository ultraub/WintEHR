#!/usr/bin/env python3
"""
Analyze validation errors for Synthea resources to understand exactly what needs fixing
"""

import json
import glob
import os
import asyncio
import httpx
from collections import defaultdict
from typing import Dict, Any

FHIR_BASE_URL = "http://localhost:8000/fhir/R4"
SYNTHEA_OUTPUT_DIR = "synthea/output/fhir"

class ValidationAnalyzer:
    def __init__(self):
        self.errors_by_type = defaultdict(list)
        self.sample_resources = {}
        
    async def analyze_resource(self, client: httpx.AsyncClient, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Send resource to server and capture validation errors"""
        resource_type = resource.get('resourceType')
        resource_id = resource.get('id')
        
        try:
            response = await client.post(
                f"{FHIR_BASE_URL}/{resource_type}",
                json=resource,
                timeout=30.0
            )
            
            if response.status_code == 400:
                error_data = response.json()
                if 'issue' in error_data:
                    return {
                        'resource_type': resource_type,
                        'resource_id': resource_id,
                        'status_code': response.status_code,
                        'issues': error_data['issue']
                    }
            elif response.status_code not in [200, 201]:
                return {
                    'resource_type': resource_type,
                    'resource_id': resource_id,
                    'status_code': response.status_code,
                    'error': response.text[:500]
                }
                
        except Exception as e:
            return {
                'resource_type': resource_type,
                'resource_id': resource_id,
                'exception': str(e)
            }
        
        return None
    
    async def analyze_bundle(self, client: httpx.AsyncClient, bundle_path: str):
        """Analyze all resources in a bundle"""
        print(f"\nAnalyzing {os.path.basename(bundle_path)}...")
        
        with open(bundle_path, 'r') as f:
            bundle = json.load(f)
        
        if bundle.get('resourceType') != 'Bundle':
            return
        
        # Focus on problematic resource types
        target_types = ['Encounter', 'Procedure', 'MedicationRequest', 'Organization', 'Location']
        
        for entry in bundle.get('entry', []):
            resource = entry.get('resource', {})
            resource_type = resource.get('resourceType')
            
            if resource_type in target_types:
                # Store a sample resource for each type
                if resource_type not in self.sample_resources:
                    self.sample_resources[resource_type] = resource
                
                # Analyze validation errors
                error = await self.analyze_resource(client, resource)
                if error:
                    self.errors_by_type[resource_type].append(error)
                    
                    # Only analyze first few of each type
                    if len(self.errors_by_type[resource_type]) >= 3:
                        continue
    
    def print_analysis(self):
        """Print detailed analysis of validation errors"""
        print("\n" + "="*60)
        print("VALIDATION ERROR ANALYSIS")
        print("="*60)
        
        for resource_type, errors in self.errors_by_type.items():
            print(f"\n### {resource_type} ({len(errors)} errors analyzed)")
            print("-" * 40)
            
            # Group errors by issue type
            issue_groups = defaultdict(list)
            for error in errors:
                if 'issues' in error:
                    for issue in error['issues']:
                        severity = issue.get('severity', 'unknown')
                        code = issue.get('code', 'unknown')
                        details = issue.get('details', {}).get('text', 'No details')
                        expression = ', '.join(issue.get('expression', []))
                        
                        key = f"{severity}|{code}|{details}"
                        issue_groups[key].append(expression)
            
            # Print grouped issues
            for issue_key, expressions in issue_groups.items():
                severity, code, details = issue_key.split('|', 2)
                print(f"\n  Issue: {severity} - {code}")
                print(f"  Details: {details}")
                if expressions[0]:
                    print(f"  Affected fields: {', '.join(set(expressions))}")
                print(f"  Occurrences: {len(expressions)}")
            
            # Print sample resource structure for debugging
            if resource_type in self.sample_resources:
                print(f"\n  Sample {resource_type} structure:")
                sample = self.sample_resources[resource_type]
                
                # Print relevant fields based on resource type
                if resource_type == 'Encounter':
                    print(f"    class: {json.dumps(sample.get('class'), indent=6)}")
                    print(f"    period: {json.dumps(sample.get('period'), indent=6)}")
                    if 'participant' in sample and sample['participant']:
                        print(f"    participant[0]: {json.dumps(sample['participant'][0], indent=6)}")
                
                elif resource_type == 'Procedure':
                    if 'performedPeriod' in sample:
                        print(f"    performedPeriod: {json.dumps(sample.get('performedPeriod'), indent=6)}")
                    elif 'performedDateTime' in sample:
                        print(f"    performedDateTime: {sample.get('performedDateTime')}")
                
                elif resource_type == 'MedicationRequest':
                    if 'dosageInstruction' in sample and sample['dosageInstruction']:
                        print(f"    dosageInstruction[0]: {json.dumps(sample['dosageInstruction'][0], indent=6)}")

async def main():
    """Main analysis function"""
    print("🔍 Synthea Validation Error Analysis")
    print("="*60)
    
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
    
    analyzer = ValidationAnalyzer()
    
    # Analyze bundles
    async with httpx.AsyncClient() as client:
        bundle_files = glob.glob(os.path.join(SYNTHEA_OUTPUT_DIR, "*.json"))
        
        # Analyze first few patient bundles
        patient_bundles = [f for f in bundle_files if 
                         not f.endswith('hospitalInformation.json') and 
                         not f.endswith('practitionerInformation.json')][:2]
        
        for bundle_path in patient_bundles:
            await analyzer.analyze_bundle(client, bundle_path)
    
    # Print analysis
    analyzer.print_analysis()

if __name__ == "__main__":
    asyncio.run(main())