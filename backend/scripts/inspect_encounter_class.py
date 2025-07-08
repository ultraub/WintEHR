#!/usr/bin/env python3
"""
Inspect the Encounter.class field definition
"""

import inspect
from fhir.resources.encounter import Encounter
from pydantic.v1 import fields

logging.info("Inspecting Encounter.class_fhir field:")
logging.info("="*60)
# Get the field info
field_info = Encounter.__fields__['class_fhir']

logging.info(f"Field name: {field_info.name}")
logging.info(f"Field alias: {field_info.alias}")
logging.info(f"Field type: {field_info.type_}")
logging.info(f"Outer type: {field_info.outer_type_}")
logging.info(f"Required: {field_info.required}")
logging.info(f"Allow mutation: {field_info.allow_mutation}")
logging.info(f"Description: {field_info.field_info.description}")
# Check if it's a list type
import typing
if hasattr(typing, 'get_origin'):
    origin = typing.get_origin(field_info.type_)
    args = typing.get_args(field_info.type_)
    logging.info(f"\nType origin: {origin}")
    logging.info(f"Type args: {args}")
# Try to understand what it expects
logging.info("\n" + "="*60)
logging.info("Trying different values:")
# Test with a list of CodeableConcepts
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.coding import Coding
import logging


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
        logging.info(f"\n{desc}: ", end="")
        # Create minimal encounter
        enc = Encounter(status="finished", class_fhir=value)
        logging.info("✅ SUCCESS")
    except Exception as e:
        logging.info(f"❌ FAILED - {str(e)[:100]}")