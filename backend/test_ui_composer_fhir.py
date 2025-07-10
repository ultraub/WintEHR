#!/usr/bin/env python3
"""
Test UI Composer FHIR Integration
Tests that the UI Composer correctly uses real FHIR data
"""

import asyncio
import httpx
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJudXJzZS13aWxzb24iLCJleHAiOjE3Njg2NzAwNDl9.U6pCETO2hCHHZw4r1Qgd8SqFGFvH54b_2soNkMcgcf0"

async def test_fhir_integration():
    """Test that UI Composer uses real FHIR data"""
    
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Test requests that should trigger FHIR data usage
    test_requests = [
        {
            "name": "Patient Vitals Dashboard",
            "request": "Create a dashboard showing patient vitals trends for the last 6 months with blood pressure, heart rate, and temperature",
            "expected_resources": ["Observation"],
            "expected_codes": ["85354-9", "8867-4", "8310-5"]  # BP, HR, Temp
        },
        {
            "name": "Lab Results Summary",
            "request": "Show me recent lab results for patient including glucose, creatinine, and hemoglobin A1c with trends",
            "expected_resources": ["Observation", "DiagnosticReport"],
            "expected_codes": ["2339-0", "2160-0", "4548-4"]  # Glucose, Creatinine, HbA1c
        },
        {
            "name": "Medication Timeline",
            "request": "Display current medications with dosages and a timeline showing when each medication was started",
            "expected_resources": ["MedicationRequest", "MedicationStatement"],
            "expected_fields": ["medicationCodeableConcept", "dosageInstruction", "authoredOn"]
        }
    ]
    
    async with httpx.AsyncClient() as client:
        print("🧪 Testing UI Composer FHIR Integration\n")
        
        for test in test_requests:
            print(f"📋 Test: {test['name']}")
            print(f"   Request: {test['request']}")
            
            # Step 1: Analyze the request
            analyze_payload = {
                "request": test['request'],
                "context": {
                    "patientId": "2add8cb0-9ec4-15de-4e5b-e812509a5068",  # Using a real patient
                    "userRole": "clinician"
                },
                "method": "development"  # Use development mode for testing
            }
            
            resp = await client.post(
                f"{BASE_URL}/api/ui-composer/analyze",
                json=analyze_payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    print(f"   ❌ Analysis failed: {resp.status}")
                    continue
                    
                result = await resp.json()
                
                if not result.get("success"):
                    print(f"   ❌ Analysis error: {result.get('error')}")
                    continue
                
                analysis = result.get("analysis", {})
                print(f"   ✅ Analysis successful")
                
                # Check if FHIR resources were identified
                required_data = analysis.get("requiredData", [])
                print(f"   📊 Required FHIR resources: {required_data}")
                
                # Verify expected resources
                for expected in test.get("expected_resources", []):
                    if expected in required_data:
                        print(f"   ✅ Found expected resource: {expected}")
                    else:
                        print(f"   ⚠️  Missing expected resource: {expected}")
                
                # Check if specification includes data binding
                components = analysis.get("components", [])
                has_data_binding = any(comp.get("dataBinding") for comp in components)
                print(f"   {'✅' if has_data_binding else '❌'} Components have data binding")
                
                # Step 2: Generate components
                if result.get("specification"):
                    generate_payload = {
                        "specification": result["specification"],
                        "session_id": result.get("session_id"),
                        "method": "development"
                    }
                    
                    resp = await client.post(
                        f"{BASE_URL}/api/ui-composer/generate",
                        json=generate_payload,
                        headers=headers
                    ) as gen_resp:
                        if gen_resp.status != 200:
                            print(f"   ❌ Generation failed: {gen_resp.status}")
                            continue
                            
                        gen_result = await gen_resp.json()
                        
                        if not gen_result.get("success"):
                            print(f"   ❌ Generation error: {gen_result.get('error')}")
                            continue
                        
                        components_code = gen_result.get("components", {})
                        
                        # Analyze generated code
                        all_code = "\n".join(components_code.values())
                        
                        # Check for FHIR hooks usage
                        fhir_checks = {
                            "usePatientResources": "usePatientResources" in all_code,
                            "useFHIRClient": "useFHIRClient" in all_code,
                            "fhirService": "fhirService" in all_code,
                            "Real resource queries": any(code in all_code for code in test.get("expected_codes", [])),
                            "No mock data": not any(mock in all_code for mock in ["John Doe", "Jane Smith", "mockData", "testData"])
                        }
                        
                        print("   🔍 Code Analysis:")
                        for check, passed in fhir_checks.items():
                            print(f"      {'✅' if passed else '❌'} {check}")
                        
                        # Show sample of generated code
                        if components_code:
                            first_comp = list(components_code.values())[0]
                            preview = first_comp[:500] + "..." if len(first_comp) > 500 else first_comp
                            print(f"   📝 Code preview:\n{preview}\n")
            
            print("-" * 80 + "\n")

if __name__ == "__main__":
    asyncio.run(test_fhir_integration())