#!/usr/bin/env python3
"""Test what's in the component spec"""

import json

# Test component spec
component = {
    'id': 'test-stat',
    'type': 'stat',
    'props': {
        'title': 'Vital Signs',
        'metrics': ['Heart Rate', 'Blood Pressure']
    },
    'dataBinding': {
        'resourceType': 'Observation'
    }
}

# Check if 'code' is somehow in the data
print("Component:", json.dumps(component, indent=2))
print("\nChecking for 'code' in component data...")
component_str = str(component)
if 'code' in component_str:
    print(f"Found 'code' in component: {component_str}")
else:
    print("No 'code' found in component data")

# Test the actual operations
print(f"\ncomponent.get('type'): {component.get('type')}")
print(f"json.dumps(component.get('props', {{}})): {json.dumps(component.get('props', {}))}")
print(f"json.dumps(component.get('dataBinding', {{}})): {json.dumps(component.get('dataBinding', {}))}")

# Check if the issue is with f-string itself
try:
    test = f"""Test: {component.get('type')}"""
    print("\nF-string test passed")
except Exception as e:
    print(f"\nF-string test failed: {e}")