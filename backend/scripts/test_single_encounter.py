#!/usr/bin/env python3
"""
Test importing a single Encounter resource with enhanced validation.
"""

import asyncio
import json
import sys
import os
import httpx

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.fhir.synthea_validator import SyntheaFHIRValidator

FHIR_BASE_URL = "http://localhost:8000/fhir/R4"

async def test_encounter():
    """Test a single encounter import."""
    
    # Sample Synthea encounter
    encounter = {
        "resourceType": "Encounter",
        "id": "urn:uuid:test-encounter-123",
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB"
        },
        "type": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "185345009",
                "display": "Encounter for symptom"
            }],
            "text": "Encounter for symptom"
        }],
        "subject": {
            "reference": "urn:uuid:patient-123",
            "display": "Test Patient"
        },
        "participant": [{
            "individual": {
                "reference": "urn:uuid:practitioner-456",
                "display": "Dr. Test"
            }
        }],
        "period": {
            "start": "2024-01-01T10:00:00-05:00",
            "end": "2024-01-01T10:30:00-05:00"
        },
        "serviceProvider": {
            "reference": "urn:uuid:organization-789",
            "display": "Test Hospital"
        }
    }
    
    print("🧪 Testing Encounter Import")
    print("=" * 60)
    
    # Validate with enhanced validator
    validator = SyntheaFHIRValidator()
    validation_result = validator.validate_resource("Encounter", encounter)
    
    print("\n1️⃣ Validation Result:")
    for issue in validation_result.issue:
        details_text = issue.details.text if hasattr(issue.details, 'text') else str(issue.details) if issue.details else 'No details'
        print(f"   {issue.severity}: {issue.code} - {details_text}")
    
    # Try to import
    async with httpx.AsyncClient() as client:
        # Update ID to proper format
        encounter['id'] = 'test-encounter-123'
        
        print("\n2️⃣ Attempting import...")
        response = await client.post(
            f"{FHIR_BASE_URL}/Encounter",
            json=encounter
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 400:
            error_data = response.json()
            print("\n3️⃣ Server validation errors:")
            if 'issue' in error_data:
                for issue in error_data['issue']:
                    print(f"   {issue.get('severity', 'error')}: {issue.get('code', 'unknown')}")
                    print(f"   Details: {issue.get('details', {}).get('text', 'No details')}")
                    if 'expression' in issue:
                        print(f"   Expression: {issue.get('expression', [])}")
        elif response.status_code in [200, 201]:
            print("   ✅ Successfully imported!")
            print(f"   Location: {response.headers.get('Location')}")
        else:
            print(f"   ❌ Error: {response.text[:200]}")

if __name__ == "__main__":
    asyncio.run(test_encounter())