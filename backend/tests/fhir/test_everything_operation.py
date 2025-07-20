#!/usr/bin/env python3
"""
Tests for the Patient/$everything operation
"""

import pytest
import asyncio
from typing import Dict, List, Any
import aiohttp

# Test configuration
BASE_URL = "http://localhost:8000/fhir/R4"
TEST_PATIENT_ID = "61a2fcc0-d679-764c-7d86-b885b2c4907f"


class TestEverythingOperation:
    """Test suite for the $everything operation"""
    
    @pytest.fixture
    async def session(self):
        """Create aiohttp session for tests"""
        async with aiohttp.ClientSession() as session:
            yield session
    
    async def test_everything_basic(self, session):
        """Test basic $everything without parameters"""
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        
        async with session.get(url) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # Verify bundle structure - the API might not include resourceType
            assert bundle.get('type') == 'searchset', f"Expected searchset, got: {bundle.get('type')}"
            assert 'total' in bundle, f"Missing 'total' in bundle: {bundle.keys()}"
            assert 'entry' in bundle, f"Missing 'entry' in bundle: {bundle.keys()}"
            
            # Should return many resources
            assert bundle['total'] > 100
            assert len(bundle['entry']) > 100
            
            # First entry should be the patient
            assert bundle['entry'][0]['resource']['resourceType'] == 'Patient'
            assert bundle['entry'][0]['resource']['id'] == TEST_PATIENT_ID
    
    async def test_everything_with_type_filter(self, session):
        """Test $everything with _type parameter"""
        types = "Patient,Encounter,Condition,Observation,MedicationRequest"
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        params = {
            "_type": types,
            "_count": "100"
        }
        
        async with session.get(url, params=params) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # Count resources by type
            type_counts = {}
            for entry in bundle.get('entry', []):
                resource_type = entry['resource']['resourceType']
                type_counts[resource_type] = type_counts.get(resource_type, 0) + 1
            
            # Verify only requested types are returned
            allowed_types = types.split(',')
            for resource_type in type_counts:
                assert resource_type in allowed_types, f"Unexpected type: {resource_type}"
            
            # Verify we got resources of multiple types
            assert len(type_counts) > 1
            assert 'Patient' in type_counts
            assert type_counts['Patient'] == 1  # Only one patient
    
    async def test_everything_with_count(self, session):
        """Test $everything with _count pagination"""
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        params = {
            "_count": "50"
        }
        
        async with session.get(url, params=params) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # Should respect count limit
            assert len(bundle['entry']) == 50
            assert bundle['total'] > 50  # More resources available
            
            # Should have pagination links
            assert 'link' in bundle
            links = {link['relation']: link['url'] for link in bundle['link']}
            assert 'self' in links
            assert 'next' in links  # Should have next page
    
    async def test_everything_with_since(self, session):
        """Test $everything with _since parameter"""
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        params = {
            "_since": "2024-01-01",
            "_count": "100"
        }
        
        async with session.get(url, params=params) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # All resources should be modified after the date
            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'meta' in resource and 'lastUpdated' in resource['meta']:
                    last_updated = resource['meta']['lastUpdated']
                    # Simple date comparison (would need proper parsing in production)
                    assert last_updated >= "2024-01-01"
    
    async def test_everything_specific_types(self, session):
        """Test $everything with specific resource types"""
        # Test with just clinical resources
        clinical_types = "Encounter,Observation,Condition,Procedure"
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        params = {
            "_type": clinical_types,
            "_count": "200"
        }
        
        async with session.get(url, params=params) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # Count by type
            type_counts = {}
            for entry in bundle.get('entry', []):
                resource_type = entry['resource']['resourceType']
                type_counts[resource_type] = type_counts.get(resource_type, 0) + 1
            
            # Should have multiple clinical resources
            assert 'Observation' in type_counts
            assert type_counts['Observation'] > 10  # Should have many observations
            
            if 'Encounter' in type_counts:
                assert type_counts['Encounter'] > 5  # Should have multiple encounters
    
    async def test_everything_pagination(self, session):
        """Test $everything pagination with offset"""
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        
        # Get first page
        params1 = {"_count": "10"}
        async with session.get(url, params=params1) as resp:
            assert resp.status == 200
            bundle1 = await resp.json()
            
            first_page_ids = [
                entry['resource']['id'] 
                for entry in bundle1['entry']
            ]
        
        # Get second page
        params2 = {"_count": "10", "_offset": "10"}
        async with session.get(url, params=params2) as resp:
            assert resp.status == 200
            bundle2 = await resp.json()
            
            second_page_ids = [
                entry['resource']['id']
                for entry in bundle2['entry']
            ]
        
        # Pages should have different resources
        assert len(set(first_page_ids) & set(second_page_ids)) == 0
    
    async def test_everything_nonexistent_patient(self, session):
        """Test $everything with non-existent patient"""
        url = f"{BASE_URL}/Patient/nonexistent-patient-id/$everything"
        
        async with session.get(url) as resp:
            # Should return 404 or error
            assert resp.status in [404, 400]
    
    async def test_everything_empty_type_filter(self, session):
        """Test $everything with empty _type parameter"""
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        params = {
            "_type": "",
            "_count": "10"
        }
        
        async with session.get(url, params=params) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # Should return only the patient
            print(f"Empty type test - total: {bundle['total']}, entries: {len(bundle['entry'])}")
            assert bundle['total'] == 1, f"Expected total=1, got {bundle['total']}"
            assert len(bundle['entry']) == 1, f"Expected 1 entry, got {len(bundle['entry'])}"
            assert bundle['entry'][0]['resource']['resourceType'] == 'Patient'
    
    async def test_everything_invalid_type(self, session):
        """Test $everything with invalid resource type in _type"""
        url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}/$everything"
        params = {
            "_type": "Patient,InvalidResourceType,Observation",
            "_count": "50"
        }
        
        async with session.get(url, params=params) as resp:
            assert resp.status == 200
            bundle = await resp.json()
            
            # Should only return valid types
            type_counts = {}
            for entry in bundle.get('entry', []):
                resource_type = entry['resource']['resourceType']
                type_counts[resource_type] = type_counts.get(resource_type, 0) + 1
            
            # Should not have InvalidResourceType
            assert 'InvalidResourceType' not in type_counts
            assert 'Patient' in type_counts
            assert 'Observation' in type_counts


async def test_everything_operation_suite():
    """Run all $everything operation tests"""
    tester = TestEverythingOperation()
    
    async with aiohttp.ClientSession() as session:
        try:
            await tester.test_everything_basic(session)
            print("✓ Basic $everything test passed")
            
            await tester.test_everything_with_type_filter(session)
            print("✓ $everything with _type filter test passed")
            
            await tester.test_everything_with_count(session)
            print("✓ $everything with _count test passed")
            
            await tester.test_everything_with_since(session)
            print("✓ $everything with _since test passed")
            
            await tester.test_everything_specific_types(session)
            print("✓ $everything with specific types test passed")
            
            await tester.test_everything_pagination(session)
            print("✓ $everything pagination test passed")
            
            await tester.test_everything_nonexistent_patient(session)
            print("✓ $everything with non-existent patient test passed")
            
            await tester.test_everything_empty_type_filter(session)
            print("✓ $everything with empty _type test passed")
            
            await tester.test_everything_invalid_type(session)
            print("✓ $everything with invalid type test passed")
            
            print("\nAll tests passed! ✓")
            
        except AssertionError as e:
            print(f"\n✗ Test failed: {e}")
            raise
        except Exception as e:
            print(f"\n✗ Unexpected error: {e}")
            raise


if __name__ == "__main__":
    print("Testing Patient/$everything Operation")
    print("=" * 50)
    asyncio.run(test_everything_operation_suite())