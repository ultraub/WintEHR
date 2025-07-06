#!/usr/bin/env python3
"""
Inspect the Encounter.class field definition
"""

import inspect
from fhir.resources.encounter import Encounter
from pydantic.v1 import fields

print("Inspecting Encounter.class_fhir field:")
print("="*60)

# Get the field info
field_info = Encounter.__fields__['class_fhir']

print(f"Field name: {field_info.name}")
print(f"Field alias: {field_info.alias}")
print(f"Field type: {field_info.type_}")
print(f"Outer type: {field_info.outer_type_}")
print(f"Required: {field_info.required}")
print(f"Allow mutation: {field_info.allow_mutation}")
print(f"Description: {field_info.field_info.description}")

# Check if it's a list type
import typing
if hasattr(typing, 'get_origin'):
    origin = typing.get_origin(field_info.type_)
    args = typing.get_args(field_info.type_)
    print(f"\nType origin: {origin}")
    print(f"Type args: {args}")

# Try to understand what it expects
print("\n" + "="*60)
print("Trying different values:")

# Test with a list of CodeableConcepts
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.coding import Coding

test_values = [
    ("Single CodeableConcept", CodeableConcept(coding=[Coding(system="test", code="test")])),
    ("List of CodeableConcepts", [CodeableConcept(coding=[Coding(system="test", code="test")])]),
    ("Single Coding", Coding(system="test", code="test")),
    ("List of Codings", [Coding(system="test", code="test")]),
    ("Dict CodeableConcept", {"coding": [{"system": "test", "code": "test"}]}),
    ("List of Dict CodeableConcepts", [{"coding": [{"system": "test", "code": "test"}]}])
]

for desc, value in test_values:
    try:
        # Try to validate just the field
        print(f"\n{desc}: ", end="")
        # Create minimal encounter
        enc = Encounter(status="finished", class_fhir=value)
        print("✅ SUCCESS")
    except Exception as e:
        print(f"❌ FAILED - {str(e)[:100]}")