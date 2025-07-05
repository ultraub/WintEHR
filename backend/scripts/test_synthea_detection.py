#!/usr/bin/env python3
"""
Test why Synthea resources aren't being detected
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import SyntheaProfileHandler, USCoreProfileHandler

def test_synthea_detection():
    """Test Synthea detection logic."""
    
    # Load a real Synthea bundle
    synthea_dir = Path(__file__).parent.parent / "synthea" / "output" / "fhir"
    test_file = synthea_dir / "Beatriz277_Ana_María762_Muro989_c0219ca9-576f-f7c2-9c44-de030e94969b.json"
    
    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        return
    
    with open(test_file, 'r') as f:
        bundle = json.load(f)
    
    synthea_handler = SyntheaProfileHandler()
    uscore_handler = USCoreProfileHandler()
    
    # Test bundle itself
    print("Testing Bundle detection:")
    print(f"Bundle - Synthea handler: {synthea_handler.can_handle(bundle)}")
    print(f"Bundle - US Core handler: {uscore_handler.can_handle(bundle)}")
    
    # Test individual resources
    print("\nTesting individual resources:")
    resource_counts = {}
    
    for entry in bundle.get('entry', [])[:10]:  # Test first 10
        resource = entry.get('resource', {})
        resource_type = resource.get('resourceType')
        
        if resource_type:
            synthea_can_handle = synthea_handler.can_handle(resource)
            uscore_can_handle = uscore_handler.can_handle(resource)
            resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1
            
            print(f"\n{resource_type} #{resource_counts[resource_type]}:")
            print(f"  Synthea handler: {synthea_can_handle}")
            print(f"  US Core handler: {uscore_can_handle}")
            
            # Check what might identify it as Synthea
            meta = resource.get('meta', {})
            profiles = meta.get('profile', [])
            print(f"  profiles: {profiles}")
            
            identifiers = resource.get('identifier', [])
            for i, identifier in enumerate(identifiers[:2]):  # First 2 identifiers
                if isinstance(identifier, dict):
                    print(f"  identifier[{i}].system: {identifier.get('system', 'N/A')}")
            
            # Check for urn:uuid references
            resource_str = json.dumps(resource)
            if 'urn:uuid:' in resource_str:
                print("  Has urn:uuid references: YES")
            else:
                print("  Has urn:uuid references: NO")

if __name__ == "__main__":
    test_synthea_detection()