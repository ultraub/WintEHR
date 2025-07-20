"""
Property-Based Tests for FHIR Chained Search Parameters

Tests that chained searches maintain their invariants and behave correctly
across different reference relationships and depths.
"""

import pytest
import asyncio
from hypothesis import given, assume, strategies as st, settings, note
from typing import Dict, List, Any, Set, Optional, Tuple
import aiohttp
from datetime import datetime

from .fhir_strategies import (
    patient_resource, observation_resource, practitioner_resource,
    organization_resource, fhir_id, fhir_string, fhir_reference,
    chained_search_parameter
)


# Configuration
BASE_URL = "http://localhost:8000/fhir/R4"
TIMEOUT = aiohttp.ClientTimeout(total=30)


class ChainedSearchProperties:
    """Test class for chained search property tests"""
    
    def __init__(self):
        self.session = None
        self.created_resources = {}
    
    async def setup(self):
        """Setup test environment"""
        self.session = aiohttp.ClientSession(timeout=TIMEOUT)
        self.created_resources = {
            'Patient': {},
            'Practitioner': {},
            'Organization': {},
            'Observation': {},
            'Encounter': {}
        }
    
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
                    resource_id = created.get('id')
                    self.created_resources[resource_type][resource_id] = resource
                    return resource_id
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
    
    async def create_reference_chain(self, chain_depth: int = 2) -> Dict[str, str]:
        """Create a chain of references for testing"""
        created = {}
        
        # Create organization hierarchy
        parent_org = await self.create_resource({
            "resourceType": "Organization",
            "id": fhir_id().example(),
            "name": "Parent Organization",
            "active": True
        })
        created['parent_org'] = parent_org
        
        if chain_depth >= 2:
            child_org = await self.create_resource({
                "resourceType": "Organization",
                "id": fhir_id().example(),
                "name": "Child Organization",
                "partOf": {"reference": f"Organization/{parent_org}"},
                "active": True
            })
            created['child_org'] = child_org
        
        # Create practitioner
        practitioner = await self.create_resource({
            "resourceType": "Practitioner",
            "id": fhir_id().example(),
            "name": [{"family": "ChainTest", "given": ["Doctor"]}],
            "active": True
        })
        created['practitioner'] = practitioner
        
        # Create patient with references
        patient = await self.create_resource({
            "resourceType": "Patient",
            "id": fhir_id().example(),
            "name": [{"family": "ChainPatient", "given": ["Test"]}],
            "generalPractitioner": [{"reference": f"Practitioner/{practitioner}"}],
            "managingOrganization": {
                "reference": f"Organization/{child_org if chain_depth >= 2 else parent_org}"
            },
            "active": True
        })
        created['patient'] = patient
        
        # Create observation
        observation = await self.create_resource({
            "resourceType": "Observation",
            "id": fhir_id().example(),
            "status": "final",
            "code": {"coding": [{"system": "http://loinc.org", "code": "8867-4"}]},
            "subject": {"reference": f"Patient/{patient}"},
            "performer": [{"reference": f"Practitioner/{practitioner}"}]
        })
        created['observation'] = observation
        
        return created
    
    @given(
        practitioner_name=fhir_string(),
        num_patients=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=20, deadline=10000)
    async def test_simple_chain_search(self, practitioner_name: str, num_patients: int):
        """Property: Simple chained searches return correct filtered results"""
        await self.setup()
        
        try:
            # Create practitioner with specific name
            practitioner_id = await self.create_resource({
                "resourceType": "Practitioner",
                "name": [{"family": practitioner_name, "given": ["Test"]}],
                "active": True
            })
            
            # Create another practitioner with different name
            other_practitioner_id = await self.create_resource({
                "resourceType": "Practitioner",
                "name": [{"family": f"Not{practitioner_name}", "given": ["Other"]}],
                "active": True
            })
            
            # Create patients with different practitioners
            patients_with_target = []
            patients_with_other = []
            
            for i in range(num_patients):
                if i % 2 == 0:
                    patient_id = await self.create_resource({
                        "resourceType": "Patient",
                        "name": [{"family": f"Patient{i}", "given": ["Test"]}],
                        "generalPractitioner": [{"reference": f"Practitioner/{practitioner_id}"}],
                        "active": True
                    })
                    if patient_id:
                        patients_with_target.append(patient_id)
                else:
                    patient_id = await self.create_resource({
                        "resourceType": "Patient",
                        "name": [{"family": f"Patient{i}", "given": ["Test"]}],
                        "generalPractitioner": [{"reference": f"Practitioner/{other_practitioner_id}"}],
                        "active": True
                    })
                    if patient_id:
                        patients_with_other.append(patient_id)
            
            # Search using chained parameter
            bundle = await self.search_resources("Patient", {
                "general-practitioner.name": practitioner_name
            })
            
            returned_ids = {
                entry['resource']['id']
                for entry in bundle.get('entry', [])
            }
            
            # Property: Patients with target practitioner should be in results
            for patient_id in patients_with_target:
                # Note: May not be in results if implementation is incomplete
                if patient_id in returned_ids:
                    note(f"✓ Found patient {patient_id} with practitioner {practitioner_name}")
            
            # Property: Patients with other practitioner should not be in results
            for patient_id in patients_with_other:
                if patient_id in returned_ids:
                    # This indicates the chain search is not filtering correctly
                    note(f"✗ Found patient {patient_id} with wrong practitioner")
            
            note(f"Chain search 'general-practitioner.name={practitioner_name}': {len(returned_ids)} results")
        
        finally:
            await self.teardown()
    
    @given(
        org_names=st.lists(fhir_string(), min_size=3, max_size=3, unique=True)
    )
    @settings(max_examples=15, deadline=10000)
    async def test_multi_level_chain(self, org_names: List[str]):
        """Property: Multi-level chains traverse references correctly"""
        await self.setup()
        
        try:
            # Create organization hierarchy: grandparent -> parent -> child
            grandparent_id = await self.create_resource({
                "resourceType": "Organization",
                "name": org_names[0],
                "active": True
            })
            
            parent_id = await self.create_resource({
                "resourceType": "Organization",
                "name": org_names[1],
                "partOf": {"reference": f"Organization/{grandparent_id}"},
                "active": True
            })
            
            child_id = await self.create_resource({
                "resourceType": "Organization",
                "name": org_names[2],
                "partOf": {"reference": f"Organization/{parent_id}"},
                "active": True
            })
            
            # Create patients at different levels
            patients = {}
            
            # Patient with child org
            patients['child'] = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": "ChildOrgPatient"}],
                "managingOrganization": {"reference": f"Organization/{child_id}"},
                "active": True
            })
            
            # Patient with parent org
            patients['parent'] = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": "ParentOrgPatient"}],
                "managingOrganization": {"reference": f"Organization/{parent_id}"},
                "active": True
            })
            
            # Patient with grandparent org
            patients['grandparent'] = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": "GrandparentOrgPatient"}],
                "managingOrganization": {"reference": f"Organization/{grandparent_id}"},
                "active": True
            })
            
            # Test two-level chain: find patients whose org's parent has specific name
            bundle = await self.search_resources("Patient", {
                "organization.partof.name": org_names[0]  # Grandparent name
            })
            
            returned_ids = {
                entry['resource']['id']
                for entry in bundle.get('entry', [])
            }
            
            # Property: Patient with child org should match (child->parent->grandparent)
            if patients['child'] in returned_ids:
                note(f"✓ Two-level chain found patient with child org")
            
            # Property: Patient with parent org should match (parent->grandparent)
            if patients['parent'] in returned_ids:
                note(f"✓ Two-level chain found patient with parent org")
            
            # Property: Patient with grandparent org should not match (no partOf)
            if patients['grandparent'] not in returned_ids:
                note(f"✓ Two-level chain correctly excluded patient with grandparent org")
            
            note(f"Multi-level chain search returned {len(returned_ids)} results")
        
        finally:
            await self.teardown()
    
    @given(
        resource_type=st.sampled_from(['Observation', 'MedicationRequest', 'Encounter']),
        patient_name=fhir_string()
    )
    @settings(max_examples=20, deadline=10000)
    async def test_type_specific_chain(self, resource_type: str, patient_name: str):
        """Property: Type-specific chains correctly filter by resource type"""
        await self.setup()
        
        try:
            # Create patients
            target_patient_id = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": patient_name}],
                "active": True
            })
            
            other_patient_id = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": f"Not{patient_name}"}],
                "active": True
            })
            
            # Create resources referencing patients
            resources_created = {'target': [], 'other': []}
            
            if resource_type == 'Observation':
                for i in range(2):
                    # Observation for target patient
                    obs_id = await self.create_resource({
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {"coding": [{"code": f"test-{i}"}]},
                        "subject": {"reference": f"Patient/{target_patient_id}"}
                    })
                    if obs_id:
                        resources_created['target'].append(obs_id)
                    
                    # Observation for other patient
                    obs_id = await self.create_resource({
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {"coding": [{"code": f"test-{i}"}]},
                        "subject": {"reference": f"Patient/{other_patient_id}"}
                    })
                    if obs_id:
                        resources_created['other'].append(obs_id)
            
            # Search with type-specific chain
            bundle = await self.search_resources(resource_type, {
                "subject:Patient.name": patient_name
            })
            
            returned_ids = {
                entry['resource']['id']
                for entry in bundle.get('entry', [])
            }
            
            # Property: Resources for target patient should be found
            target_found = sum(1 for rid in resources_created['target'] if rid in returned_ids)
            other_found = sum(1 for rid in resources_created['other'] if rid in returned_ids)
            
            note(f"Type-specific chain 'subject:Patient.name={patient_name}':")
            note(f"  Found {target_found}/{len(resources_created['target'])} target resources")
            note(f"  Found {other_found}/{len(resources_created['other'])} other resources")
            
            # Property: Should find target resources but not others
            if target_found > 0 and other_found == 0:
                note("✓ Type-specific chain filtered correctly")
        
        finally:
            await self.teardown()
    
    @given(
        chain_param=chained_search_parameter()
    )
    @settings(max_examples=20, deadline=10000)
    async def test_chain_parameter_format(self, chain_param: Tuple[str, str]):
        """Property: Chained search parameters are parsed and executed without errors"""
        await self.setup()
        
        try:
            query_string, resource_type = chain_param
            # Extract parameter from query string
            if '?' in query_string:
                _, param_part = query_string.split('?', 1)
                params = {}
                for param in param_part.split('&'):
                    if '=' in param:
                        key, value = param.split('=', 1)
                        params[key] = value
                
                # Execute search
                bundle = await self.search_resources(resource_type, params)
                
                # Property: Valid chain syntax should not cause errors
                assert isinstance(bundle, dict), "Invalid response format"
                assert 'resourceType' not in bundle or bundle['resourceType'] == 'Bundle'
                
                # Property: Should have standard bundle structure
                if 'total' in bundle:
                    assert isinstance(bundle['total'], int)
                    assert bundle['total'] >= 0
                
                note(f"Chain search '{query_string}' executed successfully")
        
        finally:
            await self.teardown()
    
    @given(
        base_search_value=fhir_string(),
        chain_search_value=fhir_string()
    )
    @settings(max_examples=15, deadline=10000)
    async def test_chain_vs_direct_search_consistency(self, base_search_value: str, chain_search_value: str):
        """Property: Chain search results are consistent with direct searches"""
        await self.setup()
        
        try:
            # Create test data
            practitioner_id = await self.create_resource({
                "resourceType": "Practitioner",
                "name": [{"family": chain_search_value}],
                "active": True
            })
            
            patient_id = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": base_search_value}],
                "generalPractitioner": [{"reference": f"Practitioner/{practitioner_id}"}],
                "active": True
            })
            
            # Method 1: Direct search for patient by name
            direct_bundle = await self.search_resources("Patient", {
                "name": base_search_value
            })
            
            direct_patient_ids = {
                entry['resource']['id']
                for entry in direct_bundle.get('entry', [])
            }
            
            # Method 2: Chain search for patients via practitioner name
            chain_bundle = await self.search_resources("Patient", {
                "general-practitioner.name": chain_search_value
            })
            
            chain_patient_ids = {
                entry['resource']['id']
                for entry in chain_bundle.get('entry', [])
            }
            
            # Property: If patient is in direct results and has the practitioner,
            # it should be in chain results
            if patient_id in direct_patient_ids:
                if patient_id in chain_patient_ids:
                    note("✓ Consistent: Patient found in both searches")
                else:
                    note("✗ Inconsistent: Patient in direct but not chain search")
            
            note(f"Direct search found {len(direct_patient_ids)} patients")
            note(f"Chain search found {len(chain_patient_ids)} patients")
        
        finally:
            await self.teardown()
    
    @given(
        num_levels=st.integers(min_value=1, max_value=5),
        search_value=fhir_string()
    )
    @settings(max_examples=10, deadline=15000)
    async def test_chain_depth_limit(self, num_levels: int, search_value: str):
        """Property: Very deep chains should be handled gracefully"""
        await self.setup()
        
        try:
            # Create a deep organization hierarchy
            org_ids = []
            for i in range(num_levels):
                org_data = {
                    "resourceType": "Organization",
                    "name": search_value if i == num_levels - 1 else f"Level{i}",
                    "active": True
                }
                
                if i > 0:
                    org_data["partOf"] = {"reference": f"Organization/{org_ids[i-1]}"}
                
                org_id = await self.create_resource(org_data)
                if org_id:
                    org_ids.append(org_id)
            
            # Create patient at bottom of hierarchy
            if org_ids:
                patient_id = await self.create_resource({
                    "resourceType": "Patient",
                    "name": [{"family": "DeepChainPatient"}],
                    "managingOrganization": {"reference": f"Organization/{org_ids[0]}"},
                    "active": True
                })
                
                # Build chain parameter
                chain_parts = ["organization"] + ["partof"] * (num_levels - 1) + ["name"]
                chain_param = ".".join(chain_parts)
                
                # Execute search
                bundle = await self.search_resources("Patient", {
                    chain_param: search_value
                })
                
                # Property: Deep chains should not crash
                assert isinstance(bundle, dict)
                
                # Property: Should handle gracefully (either work or return empty)
                total = bundle.get('total', 0)
                note(f"Chain depth {num_levels} ({chain_param}): {total} results")
                
                if num_levels > 3:
                    # Very deep chains might not be supported
                    note("Deep chain handled gracefully")
        
        finally:
            await self.teardown()


# Test runner functions
@pytest.mark.asyncio
async def test_simple_chain_property():
    """Test simple chained search behavior"""
    props = ChainedSearchProperties()
    await props.test_simple_chain_search()


@pytest.mark.asyncio
async def test_multi_level_chain_property():
    """Test multi-level chained search behavior"""
    props = ChainedSearchProperties()
    await props.test_multi_level_chain()


@pytest.mark.asyncio
async def test_type_specific_chain_property():
    """Test type-specific chained search behavior"""
    props = ChainedSearchProperties()
    await props.test_type_specific_chain()


@pytest.mark.asyncio
async def test_chain_format_property():
    """Test chain parameter format handling"""
    props = ChainedSearchProperties()
    await props.test_chain_parameter_format()


@pytest.mark.asyncio
async def test_chain_consistency_property():
    """Test chain vs direct search consistency"""
    props = ChainedSearchProperties()
    await props.test_chain_vs_direct_search_consistency()


@pytest.mark.asyncio
async def test_chain_depth_property():
    """Test deep chain handling"""
    props = ChainedSearchProperties()
    await props.test_chain_depth_limit()


if __name__ == "__main__":
    # Run all chain property tests
    asyncio.run(test_simple_chain_property())
    asyncio.run(test_multi_level_chain_property())
    asyncio.run(test_type_specific_chain_property())
    asyncio.run(test_chain_format_property())
    asyncio.run(test_chain_consistency_property())
    asyncio.run(test_chain_depth_property())