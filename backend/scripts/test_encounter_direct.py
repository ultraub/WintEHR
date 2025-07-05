#!/usr/bin/env python3
"""
Direct test of Encounter class field
"""

from fhir.resources.encounter import Encounter
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.coding import Coding

# Test 1: Create Encounter with class as CodeableConcept
print("Test 1: Direct creation with CodeableConcept")
try:
    enc1 = Encounter(
        status="finished",
        class_fhir=CodeableConcept(
            coding=[
                Coding(
                    system="http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    code="AMB",
                    display="ambulatory"
                )
            ]
        )
    )
    print("✅ Success with class_fhir field")
    print(f"   Type: {type(enc1.class_fhir)}")
except Exception as e:
    print(f"❌ Failed: {e}")

# Test 2: Create from dict with 'class' field
print("\nTest 2: From dict with 'class' field")
try:
    enc2_data = {
        "resourceType": "Encounter",
        "status": "finished",
        "class": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory"
            }]
        }
    }
    enc2 = Encounter(**enc2_data)
    print("✅ Success with 'class' alias")
    print(f"   Type: {type(enc2.class_fhir)}")
except Exception as e:
    print(f"❌ Failed: {e}")

# Test 3: What does to_dict produce?
print("\nTest 3: What does to_dict() produce?")
enc3 = Encounter(
    status="finished",
    class_fhir=CodeableConcept(
        coding=[
            Coding(
                system="http://terminology.hl7.org/CodeSystem/v3-ActCode",
                code="IMP"
            )
        ]
    )
)
enc3_dict = enc3.dict(by_alias=True, exclude_unset=True)
print(f"Dict keys: {list(enc3_dict.keys())}")
print(f"Class field in dict: {enc3_dict.get('class', 'NOT FOUND')}")