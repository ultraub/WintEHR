#!/usr/bin/env python3
"""
Validate frontend authentication and context loading
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def validate_auth_flow():
    """Validate the complete authentication flow"""
    
    print("=" * 80)
    print("Frontend Authentication Validation")
    print("=" * 80)
    
    # Step 1: Test without auth
    print("\n1. Testing API access without authentication...")
    response = requests.get(f"{BASE_URL}/api/patients?limit=1")
    if response.status_code == 200:
        print("✓ API allows unauthenticated access (development mode)")
    else:
        print(f"❌ API requires authentication: {response.status_code}")
    
    # Step 2: Get a provider and login
    print("\n2. Testing login flow...")
    providers_response = requests.get(f"{BASE_URL}/api/auth/providers")
    providers = providers_response.json()
    
    if not providers:
        print("❌ No providers available")
        return
    
    # Login as first provider
    provider = providers[0]
    print(f"   Provider: {provider['full_name']} ({provider['specialty']})")
    
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"provider_id": provider['id']}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    auth_data = login_response.json()
    token = auth_data['session_token']
    provider_data = auth_data['provider']
    
    print(f"✓ Login successful")
    print(f"   Token: {token[:20]}...")
    print(f"   Provider ID: {provider_data['id']}")
    print(f"   Display Name: {provider_data.get('display_name', 'N/A')}")
    
    # Step 3: Test authenticated endpoints
    print("\n3. Testing authenticated API access...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test /api/auth/me endpoint
    me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    if me_response.status_code == 200:
        me_data = me_response.json()
        print("✓ /api/auth/me endpoint working")
        print(f"   Returns: {list(me_data.keys())}")
    else:
        print(f"❌ /api/auth/me failed: {me_response.status_code}")
    
    # Test patient access
    patients_response = requests.get(f"{BASE_URL}/api/patients?limit=5", headers=headers)
    if patients_response.status_code == 200:
        patients = patients_response.json()
        print(f"✓ Can access patients: {len(patients)} found")
    else:
        print(f"❌ Cannot access patients: {patients_response.status_code}")
    
    # Step 4: Browser setup instructions
    print("\n" + "=" * 80)
    print("Browser Setup Instructions")
    print("=" * 80)
    print(f"\n1. Open browser and navigate to: http://localhost:3000")
    print(f"2. Open Developer Console (F12)")
    print(f"3. Run these commands:")
    print(f"\n   // Clear any existing session")
    print(f"   localStorage.clear();")
    print(f"\n   // Set the auth token")
    print(f"   localStorage.setItem('auth_token', '{token}');")
    print(f"\n   // Reload the page")
    print(f"   window.location.reload();")
    
    print(f"\n4. Verify these elements:")
    print(f"   ✓ Navigation bar shows: {provider_data.get('display_name', provider_data.get('full_name'))}")
    print(f"   ✓ No redirect to login page")
    print(f"   ✓ Patient list loads")
    print(f"   ✓ Can navigate to patient details")
    
    # Step 5: Test URLs
    if patients:
        patient = patients[0]
        print(f"\n5. Test these URLs after setting token:")
        print(f"   - Dashboard: http://localhost:3000/dashboard")
        print(f"   - Patients: http://localhost:3000/patients")
        print(f"   - Patient View: http://localhost:3000/patients/{patient['id']}")
        print(f"   - Clinical Workspace: http://localhost:3000/clinical-workspace/{patient['id']}")
    
    print("\n" + "=" * 80)
    print("Context Verification Points")
    print("=" * 80)
    print("\n1. AuthContext (useAuth hook):")
    print("   - user object should contain provider data")
    print("   - isAuthenticated should be true")
    print("\n2. ClinicalContext:")
    print("   - Should maintain currentPatient when navigating")
    print("   - Should handle encounter context from URL")
    print("\n3. Layout Component:")
    print(f"   - Should display: {provider_data.get('display_name', 'Provider Name')}")
    print("   - Logout should clear token and redirect to login")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    validate_auth_flow()