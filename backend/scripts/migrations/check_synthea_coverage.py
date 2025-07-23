#!/usr/bin/env python3
"""
Check if Synthea actually generates Coverage resources
"""

import json
from pathlib import Path
from collections import defaultdict


def check_synthea_bundles():
    """Check Synthea bundles for Coverage resources."""
    
    # Find a backup directory
    backup_base = Path(__file__).parent.parent / "data/synthea_backups"
    
    if not backup_base.exists():
        print("No backup directory found")
        return
    
    # Get latest backup
    backups = sorted([d for d in backup_base.iterdir() if d.is_dir()])
    if not backups:
        print("No backup directories found")
        return
    
    latest_backup = backups[-1]
    print(f"Checking backup: {latest_backup.name}\n")
    
    # Count resource types
    resource_counts = defaultdict(int)
    coverage_found = []
    total_bundles = 0
    
    # Process patient bundles
    for json_file in latest_backup.glob("*.json"):
        if any(skip in json_file.name for skip in ['hospitalInformation', 'practitionerInformation']):
            continue
        
        total_bundles += 1
        
        try:
            with open(json_file, 'r') as f:
                bundle = json.load(f)
            
            if bundle.get('resourceType') == 'Bundle':
                for entry in bundle.get('entry', []):
                    resource = entry.get('resource', {})
                    resource_type = resource.get('resourceType')
                    if resource_type:
                        resource_counts[resource_type] += 1
                        
                        if resource_type == 'Coverage':
                            coverage_found.append({
                                'file': json_file.name,
                                'id': resource.get('id'),
                                'status': resource.get('status'),
                                'beneficiary': resource.get('beneficiary', {}).get('reference')
                            })
        except Exception as e:
            print(f"Error reading {json_file.name}: {e}")
    
    print(f"Total patient bundles checked: {total_bundles}")
    print(f"\nResource type counts:")
    for rtype, count in sorted(resource_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {rtype:<30} {count:>6}")
    
    print(f"\nCoverage resources found: {len(coverage_found)}")
    if coverage_found:
        print("\nSample Coverage resources:")
        for cov in coverage_found[:5]:
            print(f"  File: {cov['file']}")
            print(f"    ID: {cov['id']}")
            print(f"    Status: {cov['status']}")
            print(f"    Beneficiary: {cov['beneficiary']}")
    else:
        print("\n⚠️  NO Coverage resources found in Synthea output!")
        print("This explains why Coverage is missing from the database.")
        
        # Check for insurance-related resources
        print("\nChecking for insurance-related resources:")
        insurance_types = ['Claim', 'ExplanationOfBenefit']
        for rtype in insurance_types:
            if rtype in resource_counts:
                print(f"  {rtype}: {resource_counts[rtype]}")
        
        print("\nSynthea may be generating Claims and ExplanationOfBenefit")
        print("but not Coverage resources in this version.")


if __name__ == "__main__":
    check_synthea_bundles()