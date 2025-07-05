#!/usr/bin/env python3
"""
Check FHIR R4 specification for specific fields
"""

from fhir.resources.encounter import Encounter
from fhir.resources.procedure import Procedure
from fhir.resources.medicationrequest import MedicationRequest
import inspect

print("=== Checking FHIR R4 Field Types ===\n")

# Check Encounter.class
print("Encounter.class:")
encounter_fields = Encounter.__fields__
if 'class_fhir' in encounter_fields:
    field = encounter_fields['class_fhir']
    print(f"  Field name in model: class_fhir")
    print(f"  Type: {field.type_}")
    print(f"  Is List: {str(field.type_).startswith('typing.List')}")
    print(f"  Alias: {field.alias}")

# Check Procedure.performed[x]
print("\nProcedure.performed[x]:")
procedure_fields = Procedure.__fields__
for field_name, field in procedure_fields.items():
    if field_name.startswith('performed'):
        print(f"  {field_name}: {field.type_}")

# Check MedicationRequest.medication[x]
print("\nMedicationRequest.medication[x]:")
mr_fields = MedicationRequest.__fields__
for field_name, field in mr_fields.items():
    if field_name.startswith('medication'):
        print(f"  {field_name}: {field.type_}")
        if hasattr(field, 'alias'):
            print(f"    Alias: {field.alias}")