#!/usr/bin/env python3
"""
Simple test to verify UI Composer FHIR integration
"""

import requests
import json

BASE_URL = "http://localhost:8000"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJudXJzZS13aWxzb24iLCJleHAiOjE3Njg2NzAwNDl9.U6pCETO2hCHHZw4r1Qgd8SqFGFvH54b_2soNkMcgcf0"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

# Test 1: Analyze request for patient vitals
print("🧪 Testing UI Composer FHIR Integration\n")
print("📋 Test 1: Patient Vitals Dashboard")

analyze_payload = {
    "request": "Create a dashboard showing patient vitals trends including blood pressure, heart rate, and temperature for the last 6 months",
    "context": {
        "patientId": "2add8cb0-9ec4-15de-4e5b-e812509a5068",
        "userRole": "clinician"
    },
    "method": "cli"  # Test with CLI to see if it uses real FHIR hooks
}

# Step 1: Analyze
resp = requests.post(f"{BASE_URL}/api/ui-composer/analyze", json=analyze_payload, headers=headers)
if resp.status_code != 200:
    print(f"❌ Analysis failed: {resp.status_code}")
    print(resp.text)
    exit(1)

result = resp.json()
print(f"✅ Analysis successful")
print(f"📊 Required FHIR resources: {result.get('analysis', {}).get('requiredData', [])}")

# Step 2: Generate
if result.get("specification"):
    print("\n📋 Generating components...")
    generate_payload = {
        "specification": result["specification"],
        "session_id": result.get("session_id"),
        "method": "cli"  # Test with CLI to see if it uses real FHIR hooks
    }
    
    gen_resp = requests.post(f"{BASE_URL}/api/ui-composer/generate", json=generate_payload, headers=headers)
    if gen_resp.status_code != 200:
        print(f"❌ Generation failed: {gen_resp.status_code}")
        exit(1)
    
    gen_result = gen_resp.json()
    components = gen_result.get("components", {})
    
    # Check generated code
    all_code = "\n".join(components.values())
    
    print("\n🔍 Code Analysis:")
    checks = {
        "Uses usePatientResources": "usePatientResources" in all_code,
        "Uses real patient ID": "2add8cb0-9ec4-15de-4e5b-e812509a5068" in all_code or "patientId" in all_code,
        "Queries Observations": "Observation" in all_code,
        "No mock data": not any(mock in all_code for mock in ["John Doe", "Jane Smith", "mockData"]),
        "Has FHIR service calls": "fhirService" in all_code or "useFHIRClient" in all_code
    }
    
    for check, passed in checks.items():
        print(f"  {'✅' if passed else '❌'} {check}")
    
    # Show code preview
    if components:
        first_code = list(components.values())[0]
        print(f"\n📝 Generated code preview:")
        print("=" * 80)
        print(first_code[:800] + "..." if len(first_code) > 800 else first_code)
        print("=" * 80)

print("\n✨ Test complete!")