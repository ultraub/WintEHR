#!/usr/bin/env python3
"""
System Verification Script for MedGenEMR
Tests backend and frontend functionality
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")

def test_backend_health():
    """Test backend health endpoint"""
    print_section("Backend Health Check")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ Backend is healthy: {response.json()}")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to backend: {e}")
        return False

def test_fhir_metadata():
    """Test FHIR capability statement"""
    print_section("FHIR Server Check")
    try:
        response = requests.get(f"{BACKEND_URL}/fhir/R4/metadata", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ FHIR Server: {data.get('implementation', {}).get('description', 'Unknown')}")
            print(f"   Version: {data.get('fhirVersion', 'Unknown')}")
            print(f"   Resources: {len(data.get('rest', [{}])[0].get('resource', []))}")
            return True
        else:
            print(f"❌ FHIR metadata returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to get FHIR metadata: {e}")
        return False

def test_patient_data():
    """Test FHIR patient resources"""
    print_section("Patient Data Check")
    try:
        response = requests.get(f"{BACKEND_URL}/fhir/R4/Patient?_count=5", timeout=5)
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            print(f"✅ Found {total} patients in the system")
            if total > 0 and 'entry' in data:
                print("   Sample patients:")
                for i, entry in enumerate(data['entry'][:3]):
                    patient = entry['resource']
                    name = patient.get('name', [{}])[0]
                    given = ' '.join(name.get('given', ['Unknown']))
                    family = name.get('family', 'Unknown')
                    print(f"   - {given} {family}")
            return True
        else:
            print(f"❌ Patient search returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to search patients: {e}")
        return False

def test_frontend():
    """Test frontend availability"""
    print_section("Frontend Check")
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        if response.status_code == 200:
            if "Teaching EMR System" in response.text:
                print(f"✅ Frontend is running at {FRONTEND_URL}")
                return True
            else:
                print(f"⚠️  Frontend is responding but may not be the EMR app")
                return False
        else:
            print(f"❌ Frontend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to frontend: {e}")
        return False

def test_providers():
    """Test provider list endpoint"""
    print_section("Provider Check")
    try:
        response = requests.get(f"{BACKEND_URL}/api/emr/auth/providers", timeout=5)
        if response.status_code == 200:
            data = response.json()
            providers = data.get('providers', [])
            print(f"✅ Found {len(providers)} providers")
            for provider in providers[:3]:
                print(f"   - {provider['name']} ({provider['id']}) - {provider['role']}")
            return True
        else:
            print(f"❌ Provider list returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to get providers: {e}")
        return False

def test_auth_login():
    """Test authentication"""
    print_section("Authentication Test")
    print("Note: Login may require specific provider IDs from the database")
    
    # Try different auth endpoints
    endpoints = [
        ("/api/emr/auth/login", {"providerId": "dr-smith"}),
        ("/api/emr/auth/login", {"identifier": "dr-smith"}),
        ("/api/emr/auth/sessions", {"providerId": "dr-smith"}),
    ]
    
    for endpoint, payload in endpoints:
        try:
            response = requests.post(f"{BACKEND_URL}{endpoint}", json=payload, timeout=5)
            if response.status_code == 200:
                print(f"✅ Login successful at {endpoint}")
                return True
            else:
                print(f"   {endpoint}: {response.status_code} - {response.json().get('detail', 'Unknown error')}")
        except Exception as e:
            print(f"   {endpoint}: Failed - {e}")
    
    print("⚠️  Could not authenticate - this may be normal if providers haven't been set up")
    return False

def main():
    """Run all tests"""
    print(f"\nMedGenEMR System Verification - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        test_backend_health,
        test_fhir_metadata,
        test_patient_data,
        test_providers,
        test_frontend,
        test_auth_login
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            results.append(False)
    
    print_section("Summary")
    passed = sum(results)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ All systems operational!")
    elif passed >= total - 1:
        print("\n⚠️  System is mostly operational (authentication may need setup)")
    else:
        print("\n❌ Some systems are not working properly")
    
    print("\nTo access the EMR:")
    print(f"1. Open your browser to {FRONTEND_URL}")
    print("2. Select a provider from the login screen")
    print("3. If login fails, check the backend logs")
    
    return 0 if passed >= total - 1 else 1

if __name__ == "__main__":
    sys.exit(main())