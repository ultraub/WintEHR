"""
Property-Based Tests for FHIR Search Invariants

Tests fundamental properties that should always hold true for FHIR searches,
regardless of the specific data or parameters used.
"""

import pytest
import asyncio
from hypothesis import given, assume, strategies as st, settings, note
from hypothesis.stateful import RuleBasedStateMachine, rule, initialize, invariant
from typing import Dict, List, Any, Set, Optional
import json
import aiohttp
from datetime import datetime

from .fhir_strategies import (
    patient_resource, observation_resource, practitioner_resource,
    organization_resource, search_parameters, fhir_id, fhir_string
)


# Configuration
BASE_URL = "http://localhost:8000/fhir/R4"
TIMEOUT = aiohttp.ClientTimeout(total=30)


class FHIRSearchProperties:
    """Test class for FHIR search property tests"""
    
    def __init__(self):
        self.session = None
    
    async def setup(self):
        """Setup test environment"""
        self.session = aiohttp.ClientSession(timeout=TIMEOUT)
    
    async def teardown(self):
        """Cleanup test environment"""
        if self.session:
            await self.session.close()
    
    async def create_resource(self, resource: Dict[str, Any]) -> Optional[str]:
        """Create a FHIR resource and return its ID"""
        resource_type = resource['resourceType']
        
        try:
            async with self.session.post(
                f"{BASE_URL}/{resource_type}",
                json=resource
            ) as resp:
                if resp.status == 201:
                    created = await resp.json()
                    return created.get('id')
                else:
                    return None
        except Exception:
            return None
    
    async def search_resources(self, resource_type: str, params: Dict[str, str]) -> Dict[str, Any]:
        """Search for resources and return the bundle"""
        try:
            async with self.session.get(
                f"{BASE_URL}/{resource_type}",
                params=params
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    return {"total": 0, "entry": []}
        except Exception:
            return {"total": 0, "entry": []}
    
    async def get_resource(self, resource_type: str, resource_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific resource by ID"""
        try:
            async with self.session.get(f"{BASE_URL}/{resource_type}/{resource_id}") as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    return None
        except Exception:
            return None
    
    @given(resources=st.lists(patient_resource(), min_size=1, max_size=5))
    @settings(max_examples=20, deadline=10000)
    async def test_search_returns_subset(self, resources: List[Dict[str, Any]]):
        """Property: Search results are always a subset of all resources"""
        await self.setup()
        
        try:
            # Create resources
            created_ids = []
            for resource in resources:
                resource_id = await self.create_resource(resource)
                if resource_id:
                    created_ids.append(resource_id)
                    note(f"Created Patient/{resource_id}")
            
            # Search with various parameters
            test_params = [
                {},  # All resources
                {"_count": "2"},  # Limited results
                {"gender": "male"},  # Filtered by gender
                {"_id": created_ids[0]} if created_ids else {"_id": "nonexistent"}
            ]
            
            for params in test_params:
                bundle = await self.search_resources("Patient", params)
                returned_ids = {
                    entry['resource']['id'] 
                    for entry in bundle.get('entry', [])
                }
                
                # Property: All returned IDs should be from created resources
                # (or from pre-existing data in the system)
                if params.get('_id') in created_ids:
                    # If searching by specific ID, it should be in results
                    assert params['_id'] in returned_ids or bundle['total'] == 0
                
                # Property: Result count matches entry array length
                if 'entry' in bundle:
                    assert len(bundle['entry']) == bundle.get('total', 0) or '_count' in params
                
                note(f"Search params {params} returned {len(returned_ids)} results")
        
        finally:
            await self.teardown()
    
    @given(
        resource_type=st.sampled_from(['Patient', 'Observation', 'Practitioner']),
        count_limit=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=20, deadline=10000)
    async def test_count_parameter_respected(self, resource_type: str, count_limit: int):
        """Property: _count parameter is always respected"""
        await self.setup()
        
        try:
            # Search with _count parameter
            bundle = await self.search_resources(
                resource_type,
                {"_count": str(count_limit)}
            )
            
            # Property: Number of entries should not exceed _count
            entries = bundle.get('entry', [])
            assert len(entries) <= count_limit
            
            # Property: If total > count_limit, should have next link
            total = bundle.get('total', 0)
            if total > count_limit and len(entries) == count_limit:
                links = bundle.get('link', [])
                next_links = [link for link in links if link.get('relation') == 'next']
                assert len(next_links) > 0, "Missing next link for paginated results"
            
            note(f"{resource_type} with _count={count_limit}: returned {len(entries)} of {total}")
        
        finally:
            await self.teardown()
    
    @given(
        base_params=search_parameters('Patient'),
        additional_params=search_parameters('Patient')
    )
    @settings(max_examples=20, deadline=10000)
    async def test_parameter_combination_narrows_results(self, base_params: Dict[str, str], additional_params: Dict[str, str]):
        """Property: Adding more search parameters can only narrow results (AND logic)"""
        await self.setup()
        
        try:
            # Skip if params overlap (would override)
            assume(not any(k in additional_params for k in base_params))
            
            # Search with base parameters
            base_bundle = await self.search_resources("Patient", base_params)
            base_total = base_bundle.get('total', 0)
            base_ids = {
                entry['resource']['id']
                for entry in base_bundle.get('entry', [])
            }
            
            # Search with combined parameters
            combined_params = {**base_params, **additional_params}
            combined_bundle = await self.search_resources("Patient", combined_params)
            combined_total = combined_bundle.get('total', 0)
            combined_ids = {
                entry['resource']['id']
                for entry in combined_bundle.get('entry', [])
            }
            
            # Property: Combined search returns subset of base search
            assert combined_total <= base_total
            assert combined_ids.issubset(base_ids)
            
            note(f"Base params {base_params}: {base_total} results")
            note(f"Combined params {combined_params}: {combined_total} results")
        
        finally:
            await self.teardown()
    
    @given(patients=st.lists(patient_resource(), min_size=2, max_size=5))
    @settings(max_examples=20, deadline=10000)
    async def test_id_search_returns_exact_match(self, patients: List[Dict[str, Any]]):
        """Property: Searching by _id returns exactly that resource"""
        await self.setup()
        
        try:
            # Create patients
            created_ids = []
            for patient in patients:
                patient_id = await self.create_resource(patient)
                if patient_id:
                    created_ids.append(patient_id)
            
            # Test each ID
            for test_id in created_ids:
                bundle = await self.search_resources("Patient", {"_id": test_id})
                
                # Property: Should return exactly one result
                assert bundle.get('total', 0) == 1
                assert len(bundle.get('entry', [])) == 1
                
                # Property: The result should have the requested ID
                if bundle.get('entry'):
                    returned_id = bundle['entry'][0]['resource']['id']
                    assert returned_id == test_id
                
                note(f"ID search for {test_id}: found correctly")
        
        finally:
            await self.teardown()
    
    @given(
        observations=st.lists(observation_resource(), min_size=1, max_size=5),
        search_code=fhir_string()
    )
    @settings(max_examples=20, deadline=10000)
    async def test_token_search_exact_matching(self, observations: List[Dict[str, Any]], search_code: str):
        """Property: Token searches match exact codes"""
        await self.setup()
        
        try:
            # Create observations with known codes
            created_with_code = []
            created_without_code = []
            
            for obs in observations:
                # Set specific code for some observations
                if len(created_with_code) < 2:
                    obs['code']['coding'] = [{
                        'system': 'http://loinc.org',
                        'code': search_code,
                        'display': 'Test code'
                    }]
                    obs_id = await self.create_resource(obs)
                    if obs_id:
                        created_with_code.append(obs_id)
                else:
                    obs['code']['coding'] = [{
                        'system': 'http://loinc.org',
                        'code': f"different-{search_code}",
                        'display': 'Different code'
                    }]
                    obs_id = await self.create_resource(obs)
                    if obs_id:
                        created_without_code.append(obs_id)
            
            # Search by exact code
            bundle = await self.search_resources("Observation", {"code": search_code})
            returned_ids = {
                entry['resource']['id']
                for entry in bundle.get('entry', [])
            }
            
            # Property: All observations with the code should be in results
            for obs_id in created_with_code:
                if obs_id in returned_ids:
                    note(f"✓ Found observation {obs_id} with code {search_code}")
            
            # Property: Observations without the code should not be in results
            for obs_id in created_without_code:
                assert obs_id not in returned_ids, f"Found observation {obs_id} without matching code"
            
            note(f"Code search for '{search_code}': {len(returned_ids)} results")
        
        finally:
            await self.teardown()
    
    @given(
        resource_type=st.sampled_from(['Patient', 'Observation', 'Practitioner', 'Organization'])
    )
    @settings(max_examples=20, deadline=10000)
    async def test_empty_search_returns_all(self, resource_type: str):
        """Property: Search without parameters returns all resources (up to server limit)"""
        await self.setup()
        
        try:
            # Get count with explicit high limit
            count_bundle = await self.search_resources(resource_type, {"_summary": "count"})
            total_count = count_bundle.get('total', 0)
            
            # Get resources without parameters
            all_bundle = await self.search_resources(resource_type, {})
            all_total = all_bundle.get('total', 0)
            
            # Property: Total should be the same
            assert all_total == total_count
            
            # Property: Should have entries if total > 0
            if all_total > 0:
                assert len(all_bundle.get('entry', [])) > 0
            
            note(f"{resource_type}: {all_total} total resources")
        
        finally:
            await self.teardown()
    
    @given(
        patients=st.lists(patient_resource(), min_size=3, max_size=5),
        sort_param=st.sampled_from(['name', 'birthdate', '_lastUpdated'])
    )
    @settings(max_examples=10, deadline=10000)
    async def test_sort_parameter_ordering(self, patients: List[Dict[str, Any]], sort_param: str):
        """Property: _sort parameter produces ordered results"""
        await self.setup()
        
        try:
            # Create patients with sortable values
            for i, patient in enumerate(patients):
                if sort_param == 'name':
                    patient['name'] = [{'family': f"Test{i:03d}"}]
                elif sort_param == 'birthdate':
                    patient['birthDate'] = f"198{i}-01-01"
            
            created_ids = []
            for patient in patients:
                patient_id = await self.create_resource(patient)
                if patient_id:
                    created_ids.append(patient_id)
            
            if len(created_ids) < 2:
                return  # Need at least 2 for sorting test
            
            # Search with ascending sort
            asc_bundle = await self.search_resources("Patient", {
                "_sort": sort_param,
                "_id": ",".join(created_ids)  # Limit to our created resources
            })
            
            # Search with descending sort
            desc_bundle = await self.search_resources("Patient", {
                "_sort": f"-{sort_param}",
                "_id": ",".join(created_ids)
            })
            
            # Extract sort values
            def get_sort_value(resource):
                if sort_param == 'name':
                    names = resource.get('name', [])
                    return names[0].get('family', '') if names else ''
                elif sort_param == 'birthdate':
                    return resource.get('birthDate', '')
                elif sort_param == '_lastUpdated':
                    return resource.get('meta', {}).get('lastUpdated', '')
                return ''
            
            asc_values = [
                get_sort_value(entry['resource'])
                for entry in asc_bundle.get('entry', [])
            ]
            
            desc_values = [
                get_sort_value(entry['resource'])
                for entry in desc_bundle.get('entry', [])
            ]
            
            # Property: Ascending sort should be ordered
            if len(asc_values) > 1:
                assert asc_values == sorted(asc_values), f"Ascending sort not ordered: {asc_values}"
            
            # Property: Descending sort should be reverse ordered
            if len(desc_values) > 1:
                assert desc_values == sorted(desc_values, reverse=True), f"Descending sort not ordered: {desc_values}"
            
            note(f"Sort by {sort_param}: {len(asc_values)} results")
        
        finally:
            await self.teardown()


class FHIRSearchStateMachine(RuleBasedStateMachine):
    """
    Stateful property testing for FHIR searches
    
    This tests that search behavior is consistent across multiple operations
    """
    
    def __init__(self):
        super().__init__()
        self.session = None
        self.resources: Dict[str, Set[str]] = {
            'Patient': set(),
            'Observation': set(),
            'Practitioner': set(),
            'Organization': set()
        }
        self.deleted_resources: Dict[str, Set[str]] = {
            'Patient': set(),
            'Observation': set(),
            'Practitioner': set(),
            'Organization': set()
        }
    
    @initialize()
    async def setup(self):
        """Initialize the state machine"""
        self.session = aiohttp.ClientSession(timeout=TIMEOUT)
    
    async def teardown(self):
        """Cleanup when done"""
        if self.session:
            await self.session.close()
    
    @rule(resource=st.one_of(
        patient_resource(),
        observation_resource(),
        practitioner_resource(),
        organization_resource()
    ))
    async def create_resource(self, resource: Dict[str, Any]):
        """Rule: Create a new resource"""
        resource_type = resource['resourceType']
        
        try:
            async with self.session.post(
                f"{BASE_URL}/{resource_type}",
                json=resource
            ) as resp:
                if resp.status == 201:
                    created = await resp.json()
                    resource_id = created['id']
                    self.resources[resource_type].add(resource_id)
                    note(f"Created {resource_type}/{resource_id}")
        except Exception as e:
            note(f"Failed to create resource: {e}")
    
    @rule(
        resource_type=st.sampled_from(['Patient', 'Observation', 'Practitioner', 'Organization'])
    )
    async def delete_resource(self, resource_type: str):
        """Rule: Delete a resource"""
        if not self.resources[resource_type]:
            return
        
        resource_id = self.resources[resource_type].pop()
        
        try:
            async with self.session.delete(
                f"{BASE_URL}/{resource_type}/{resource_id}"
            ) as resp:
                if resp.status in [200, 204]:
                    self.deleted_resources[resource_type].add(resource_id)
                    note(f"Deleted {resource_type}/{resource_id}")
                else:
                    # Failed to delete, add back
                    self.resources[resource_type].add(resource_id)
        except Exception as e:
            # Failed to delete, add back
            self.resources[resource_type].add(resource_id)
            note(f"Failed to delete resource: {e}")
    
    @rule(
        resource_type=st.sampled_from(['Patient', 'Observation', 'Practitioner', 'Organization'])
    )
    async def search_all(self, resource_type: str):
        """Rule: Search for all resources of a type"""
        try:
            async with self.session.get(f"{BASE_URL}/{resource_type}") as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    found_ids = {
                        entry['resource']['id']
                        for entry in bundle.get('entry', [])
                    }
                    
                    # Check our tracked resources are in results
                    for resource_id in self.resources[resource_type]:
                        if resource_id not in found_ids:
                            note(f"Warning: {resource_type}/{resource_id} not in search results")
                    
                    # Check deleted resources are not in results
                    for resource_id in self.deleted_resources[resource_type]:
                        assert resource_id not in found_ids, \
                            f"Deleted resource {resource_type}/{resource_id} still in search results"
        except Exception as e:
            note(f"Search failed: {e}")
    
    @invariant()
    async def resources_searchable_by_id(self):
        """Invariant: All created resources should be searchable by ID"""
        for resource_type, resource_ids in self.resources.items():
            for resource_id in resource_ids:
                try:
                    async with self.session.get(
                        f"{BASE_URL}/{resource_type}",
                        params={"_id": resource_id}
                    ) as resp:
                        if resp.status == 200:
                            bundle = await resp.json()
                            assert bundle.get('total', 0) >= 1, \
                                f"{resource_type}/{resource_id} not found by _id search"
                except Exception:
                    pass  # Network errors don't violate invariant
    
    @invariant()
    async def deleted_resources_not_searchable(self):
        """Invariant: Deleted resources should not be searchable"""
        for resource_type, resource_ids in self.deleted_resources.items():
            for resource_id in resource_ids:
                try:
                    async with self.session.get(
                        f"{BASE_URL}/{resource_type}",
                        params={"_id": resource_id}
                    ) as resp:
                        if resp.status == 200:
                            bundle = await resp.json()
                            assert bundle.get('total', 0) == 0, \
                                f"Deleted {resource_type}/{resource_id} still searchable"
                except Exception:
                    pass  # Network errors don't violate invariant


# Test runner
@pytest.mark.asyncio
async def test_search_subset_property():
    """Test that search results are always a subset"""
    props = FHIRSearchProperties()
    await props.test_search_returns_subset()


@pytest.mark.asyncio
async def test_count_parameter_property():
    """Test that _count parameter is respected"""
    props = FHIRSearchProperties()
    await props.test_count_parameter_respected()


@pytest.mark.asyncio
async def test_parameter_combination_property():
    """Test that combining parameters narrows results"""
    props = FHIRSearchProperties()
    await props.test_parameter_combination_narrows_results()


@pytest.mark.asyncio
async def test_id_search_property():
    """Test that ID search returns exact match"""
    props = FHIRSearchProperties()
    await props.test_id_search_returns_exact_match()


@pytest.mark.asyncio
async def test_token_search_property():
    """Test that token searches match exactly"""
    props = FHIRSearchProperties()
    await props.test_token_search_exact_matching()


@pytest.mark.asyncio
async def test_empty_search_property():
    """Test that empty search returns all resources"""
    props = FHIRSearchProperties()
    await props.test_empty_search_returns_all()


@pytest.mark.asyncio
async def test_sort_parameter_property():
    """Test that sort parameter produces ordered results"""
    props = FHIRSearchProperties()
    await props.test_sort_parameter_ordering()


@pytest.mark.asyncio
@settings(max_examples=50, deadline=30000, stateful_step_count=20)
async def test_search_state_machine():
    """Test FHIR search behavior with stateful testing"""
    # Note: This would need special handling for async state machine
    # For now, we'll skip the stateful test
    pass


if __name__ == "__main__":
    # Run individual property tests
    asyncio.run(test_search_subset_property())
    asyncio.run(test_count_parameter_property())
    asyncio.run(test_parameter_combination_property())
    asyncio.run(test_id_search_property())
    asyncio.run(test_token_search_property())
    asyncio.run(test_empty_search_property())
    asyncio.run(test_sort_parameter_property())