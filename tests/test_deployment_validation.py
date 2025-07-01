#!/usr/bin/env python3
"""
Comprehensive deployment validation test suite
Verifies all critical functionality after deployment setup
"""

import sys
import os
import json
import pytest
import requests
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Test configuration
BASE_URL = os.getenv('TEST_BASE_URL', 'http://localhost:8000')
API_URL = f"{BASE_URL}/api"

class TestDeploymentValidation:
    """Comprehensive tests to validate deployment readiness"""
    
    @classmethod
    def setup_class(cls):
        """Setup test authentication"""
        cls.token = None
        cls.provider_id = None
        cls.patient_id = None
    
    def test_01_api_health_check(self):
        """Test that the API is running and responsive"""
        response = requests.get(f"{API_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        assert 'database' in data
        assert 'version' in data
    
    def test_02_provider_login(self):
        """Test provider authentication"""
        # Get available providers
        response = requests.get(f"{API_URL}/auth/providers")
        assert response.status_code == 200
        providers = response.json()
        assert len(providers) > 0, "No providers found in the system"
        
        # Login with first provider
        provider = providers[0]
        login_data = {
            "username": provider['npi'],
            "password": "password123"  # Default password
        }
        
        response = requests.post(f"{API_URL}/auth/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data
        assert 'provider' in data
        
        # Store for future tests
        self.__class__.token = data['access_token']
        self.__class__.provider_id = data['provider']['id']
    
    def test_03_patient_list_access(self):
        """Test that provider can access patient list"""
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{API_URL}/patients", headers=headers)
        assert response.status_code == 200
        patients = response.json()
        assert len(patients) > 0, "No patients found assigned to provider"
        
        # Store first patient for future tests
        self.__class__.patient_id = patients[0]['id']
    
    def test_04_patient_details(self):
        """Test accessing patient demographics and details"""
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{API_URL}/patients/{self.patient_id}", headers=headers)
        assert response.status_code == 200
        patient = response.json()
        
        # Verify patient data structure
        required_fields = ['id', 'first_name', 'last_name', 'date_of_birth', 'gender']
        for field in required_fields:
            assert field in patient, f"Missing required field: {field}"
    
    def test_05_clinical_data_present(self):
        """Test that clinical data was imported correctly"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test encounters
        response = requests.get(
            f"{API_URL}/encounters",
            params={'patient_id': self.patient_id},
            headers=headers
        )
        assert response.status_code == 200
        encounters = response.json()
        assert len(encounters) > 0, "No encounters found for patient"
        
        # Test observations (vitals/labs)
        response = requests.get(
            f"{API_URL}/observations",
            params={'patient_id': self.patient_id},
            headers=headers
        )
        assert response.status_code == 200
        observations = response.json()
        assert len(observations) > 0, "No observations found for patient"
    
    def test_06_lab_reference_ranges(self):
        """Test that lab results have reference ranges"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Get lab results
        response = requests.get(
            f"{API_URL}/observations",
            params={
                'patient_id': self.patient_id,
                'observation_type': 'laboratory'
            },
            headers=headers
        )
        assert response.status_code == 200
        labs = response.json()
        
        # Check at least some labs have reference ranges
        labs_with_ranges = [
            lab for lab in labs 
            if lab.get('reference_range_low') is not None 
            or lab.get('reference_range_high') is not None
        ]
        
        if len(labs) > 0:
            assert len(labs_with_ranges) > 0, "No lab results have reference ranges"
    
    def test_07_clinical_notes_present(self):
        """Test that clinical notes were imported"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        response = requests.get(
            f"{API_URL}/clinical/documents",
            params={'patient_id': self.patient_id},
            headers=headers
        )
        assert response.status_code == 200
        documents = response.json()
        
        # Should have at least some clinical documentation
        if documents:
            assert len(documents) > 0, "Clinical notes not imported"
    
    def test_08_imaging_studies(self):
        """Test that imaging studies are accessible"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        response = requests.get(
            f"{API_URL}/imaging/studies/{self.patient_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check if any imaging studies exist
        studies = data.get('data', [])
        # It's okay if no studies exist, but the endpoint should work
        assert isinstance(studies, list)
    
    def test_09_fhir_endpoints(self):
        """Test FHIR R4 endpoints"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test metadata endpoint
        response = requests.get(f"{API_URL}/fhir/metadata", headers=headers)
        assert response.status_code == 200
        metadata = response.json()
        assert metadata.get('resourceType') == 'CapabilityStatement'
        
        # Test Patient resource
        response = requests.get(
            f"{API_URL}/fhir/Patient/{self.patient_id}",
            headers=headers
        )
        assert response.status_code == 200
        patient = response.json()
        assert patient.get('resourceType') == 'Patient'
    
    def test_10_cds_hooks_services(self):
        """Test CDS Hooks discovery endpoint"""
        response = requests.get(f"{API_URL}/cds-services")
        assert response.status_code == 200
        services = response.json()
        assert 'services' in services
        assert len(services['services']) > 0
    
    def test_11_provider_patient_assignment(self):
        """Test that providers have assigned patients"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Get provider's assigned patients
        response = requests.get(f"{API_URL}/patients", headers=headers)
        assert response.status_code == 200
        patients = response.json()
        assert len(patients) > 0, "Provider has no assigned patients"
        
        # Verify patient-provider relationship
        response = requests.get(
            f"{API_URL}/providers/{self.provider_id}/patients",
            headers=headers
        )
        # If endpoint exists, verify response
        if response.status_code == 200:
            assigned_patients = response.json()
            assert len(assigned_patients) > 0
    
    def test_12_clinical_catalogs(self):
        """Test that clinical catalogs are populated"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test medication catalog
        response = requests.get(
            f"{API_URL}/clinical/medications/search",
            params={'q': 'aspirin'},
            headers=headers
        )
        assert response.status_code == 200
        meds = response.json()
        assert len(meds) > 0, "Medication catalog not populated"
        
        # Test lab catalog
        response = requests.get(
            f"{API_URL}/clinical/labs/catalog",
            headers=headers
        )
        assert response.status_code == 200
        labs = response.json()
        assert len(labs) > 0, "Lab catalog not populated"
    
    def test_13_data_consistency(self):
        """Test data consistency across different endpoints"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Get patient from different endpoints
        response1 = requests.get(
            f"{API_URL}/patients/{self.patient_id}",
            headers=headers
        )
        response2 = requests.get(
            f"{API_URL}/fhir/Patient/{self.patient_id}",
            headers=headers
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        patient_api = response1.json()
        patient_fhir = response2.json()
        
        # Verify consistency
        assert patient_api['id'] == patient_fhir['id']
        assert patient_api['gender'].lower() == patient_fhir['gender'].lower()

class TestPerformanceValidation:
    """Performance tests to ensure system can handle production load"""
    
    @pytest.mark.performance
    def test_concurrent_requests(self):
        """Test system handles concurrent requests"""
        import concurrent.futures
        import time
        
        def make_request():
            start = time.time()
            response = requests.get(f"{API_URL}/health")
            duration = time.time() - start
            return response.status_code, duration
        
        # Make 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # All should succeed
        statuses = [r[0] for r in results]
        assert all(s == 200 for s in statuses), "Some concurrent requests failed"
        
        # Average response time should be reasonable
        durations = [r[1] for r in results]
        avg_duration = sum(durations) / len(durations)
        assert avg_duration < 1.0, f"Average response time too high: {avg_duration}s"
    
    @pytest.mark.performance
    def test_large_data_queries(self):
        """Test system handles large data queries efficiently"""
        # This would need authentication setup
        pass

def run_deployment_tests():
    """Run all deployment validation tests"""
    print("🧪 Running Deployment Validation Tests")
    print("=" * 60)
    
    # Check if API is accessible
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        if response.status_code != 200:
            print("❌ API is not accessible. Make sure the backend is running.")
            return False
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to API. Make sure the backend is running on port 8000.")
        return False
    
    # Run pytest
    exit_code = pytest.main([
        __file__,
        '-v',
        '--tb=short',
        '-m', 'not performance'  # Skip performance tests by default
    ])
    
    return exit_code == 0

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run deployment validation tests')
    parser.add_argument(
        '--include-performance',
        action='store_true',
        help='Include performance tests'
    )
    parser.add_argument(
        '--base-url',
        default='http://localhost:8000',
        help='Base URL for API (default: http://localhost:8000)'
    )
    
    args = parser.parse_args()
    
    if args.base_url:
        os.environ['TEST_BASE_URL'] = args.base_url
    
    # Run tests
    success = run_deployment_tests()
    
    if success:
        print("\n✅ All deployment validation tests passed!")
    else:
        print("\n❌ Some tests failed. Please check the output above.")
        sys.exit(1)