#!/usr/bin/env python3
"""
Test direct FHIR validation to understand the exact requirements.
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fhir.resources.encounter import Encounter
from fhir.resources.period import Period
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.reference import Reference
from pydantic import ValidationError
import json

def test_encounter_structure():
    """Test what Encounter structure the library expects."""
    
    print("🧪 Testing FHIR Encounter Structure Requirements")
    print("=" * 60)
    
    # Test 1: Minimal valid encounter
    print("\n1️⃣ Testing minimal Encounter:")
    try:
        encounter = Encounter(
            status="finished",
            class_fhir=[{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "AMB"
                }]
            }]
        )
        print("   ✅ Minimal Encounter is valid!")
        print(f"   class_fhir type: {type(encounter.class_fhir)}")
        print(f"   class_fhir[0] type: {type(encounter.class_fhir[0])}")
    except ValidationError as e:
        print(f"   ❌ Validation failed: {e}")
    
    # Test 2: Period structure
    print("\n2️⃣ Testing Period structure:")
    try:
        period = Period(
            start="2024-01-01T10:00:00Z",
            end="2024-01-01T11:00:00Z"
        )
        print("   ✅ Period is valid!")
        print(f"   Period dict: {period.dict()}")
    except ValidationError as e:
        print(f"   ❌ Period validation failed: {e}")
    
    # Test 3: Full encounter with participant
    print("\n3️⃣ Testing Encounter with participant:")
    try:
        encounter_data = {
            "resourceType": "Encounter",
            "status": "finished",
            "class": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "AMB"
                }]
            }],
            "period": {
                "start": "2024-01-01T10:00:00Z",
                "end": "2024-01-01T11:00:00Z"
            },
            "participant": [{
                "individual": {
                    "reference": "Practitioner/123",
                    "display": "Dr. Test"
                }
            }],
            "subject": {
                "reference": "Patient/123"
            }
        }
        
        encounter = Encounter(**encounter_data)
        print("   ✅ Full Encounter is valid!")
        
        # Check what fields the participant has
        if encounter.participant:
            print(f"   Participant fields: {encounter.participant[0].dict().keys()}")
            if encounter.participant[0].individual:
                print(f"   Individual fields: {encounter.participant[0].individual.dict().keys()}")
        
    except ValidationError as e:
        print(f"   ❌ Validation failed:")
        for error in e.errors():
            print(f"      - {error['loc']}: {error['msg']}")
    
    # Test 4: Check exact field requirements
    print("\n4️⃣ Checking Encounter.participant structure:")
    from fhir.resources.encounter import EncounterParticipant
    try:
        participant = EncounterParticipant(
            individual={
                "reference": "Practitioner/123"
            }
        )
        print("   ✅ Participant is valid!")
        print(f"   Allowed fields: {participant.dict().keys()}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    test_encounter_structure()