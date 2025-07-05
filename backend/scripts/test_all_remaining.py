#!/usr/bin/env python3
"""
Test all remaining validation issues
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.fhir.profile_transformer import ProfileAwareFHIRTransformer
from fhir.resources.allergyintolerance import AllergyIntolerance
from fhir.resources.procedure import Procedure
from fhir.resources.medicationrequest import MedicationRequest
from fhir.resources.careteam import CareTeam
from fhir.resources.careplan import CarePlan

def test_allergy_intolerance():
    """Test AllergyIntolerance transformation."""
    allergy = {
        "resourceType": "AllergyIntolerance",
        "id": "test-123",
        "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
        "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "confirmed"}]},
        "type": "allergy",
        "category": ["environment"],
        "criticality": "low",
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "264287008", "display": "Animal dander"}]},
        "patient": {"reference": "Patient/123"},
        "reaction": [{
            "manifestation": [{
                "coding": [{"system": "http://snomed.info/sct", "code": "271807003", "display": "Skin rash"}],
                "text": "Skin rash"
            }]
        }]
    }
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(allergy)
    
    try:
        AllergyIntolerance(**transformed)
        print("✅ AllergyIntolerance: PASSED")
    except Exception as e:
        print(f"❌ AllergyIntolerance: FAILED - {str(e)}")

def test_procedure():
    """Test Procedure transformation."""
    procedure = {
        "resourceType": "Procedure",
        "id": "test-123",
        "status": "completed",
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "103697008"}]},
        "subject": {"reference": "Patient/123"},
        "performedDateTime": "2023-01-01",
        "reasonReference": [{"reference": "Condition/123"}]
    }
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(procedure)
    
    try:
        Procedure(**transformed)
        print("✅ Procedure: PASSED")
    except Exception as e:
        print(f"❌ Procedure: FAILED - {str(e)}")

def test_medication_request():
    """Test MedicationRequest transformation."""
    med_request = {
        "resourceType": "MedicationRequest",
        "id": "test-123",
        "status": "completed",
        "intent": "order",
        "medication": {"concept": {"coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "314422"}]}},
        "subject": {"reference": "Patient/123"},
        "requester": {"reference": "Practitioner/123"},
        "reasonReference": [{"reference": "Condition/123"}]
    }
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(med_request)
    
    try:
        MedicationRequest(**transformed)
        print("✅ MedicationRequest: PASSED")
    except Exception as e:
        print(f"❌ MedicationRequest: FAILED - {str(e)}")

def test_care_team():
    """Test CareTeam transformation."""
    care_team = {
        "resourceType": "CareTeam",
        "id": "test-123",
        "status": "active",
        "subject": {"reference": "Patient/123"},
        "participant": [{"role": [{"coding": [{"system": "http://snomed.info/sct", "code": "17561000"}]}]}],
        "reasonCode": [{"coding": [{"system": "http://snomed.info/sct", "code": "161891005"}]}]
    }
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(care_team)
    
    try:
        CareTeam(**transformed)
        print("✅ CareTeam: PASSED")
    except Exception as e:
        print(f"❌ CareTeam: FAILED - {str(e)}")

def test_care_plan():
    """Test CarePlan transformation."""
    care_plan = {
        "resourceType": "CarePlan",
        "id": "test-123",
        "status": "active",
        "intent": "plan",
        "subject": {"reference": "Patient/123"},
        "addresses": [{"reference": "Condition/diabetes"}]
    }
    
    transformer = ProfileAwareFHIRTransformer()
    transformed = transformer.transform_resource(care_plan)
    
    print("\nCarePlan transformed addresses:")
    print(json.dumps(transformed.get('addresses', []), indent=2))
    
    try:
        CarePlan(**transformed)
        print("✅ CarePlan: PASSED")
    except Exception as e:
        print(f"❌ CarePlan: FAILED - {str(e)}")

if __name__ == "__main__":
    print("Testing remaining validation issues...")
    print("=" * 50)
    test_allergy_intolerance()
    test_procedure()
    test_medication_request()
    test_care_team()
    test_care_plan()
    print("=" * 50)