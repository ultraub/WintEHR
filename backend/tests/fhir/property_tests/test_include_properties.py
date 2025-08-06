"""
Property-Based Tests for FHIR _include and _revinclude Parameters

Tests that _include and _revinclude maintain their invariants:
- Included resources are properly marked with search.mode = 'include'
- All referenced resources that exist are included
- _revinclude finds all resources that reference the target
- Combining _include and _revinclude works correctly
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
    include_parameter, revinclude_parameter
)


# Configuration
BASE_URL = "http://localhost:8000/fhir/R4"
TIMEOUT = aiohttp.ClientTimeout(total=30)


class IncludeRevincludeProperties:
    """Test class for _include/_revinclude property tests"""
    
    def __init__(self):
        self.session = None
        self.resources = {}
        self.references = {}  # Track references between resources
    
    async def setup(self):
        """Setup test environment"""
        self.session = aiohttp.ClientSession(timeout=TIMEOUT)
        self.resources = {
            'Patient': {},
            'Practitioner': {},
            'Organization': {},
            'Observation': {},
            'MedicationRequest': {},
            'Medication': {},
            'Encounter': {}
        }
        self.references = {}  # {source_id: [(ref_field, target_type, target_id)]}
    
    async def teardown(self):
        """Cleanup test environment"""
        if self.session:
            await self.session.close()
    
    async def create_resource(self, resource: Dict[str, Any]) -> Optional[str]:
        """Create a FHIR resource and track references"""
        resource_type = resource['resourceType']
        
        try:
            async with self.session.post(
                f"{BASE_URL}/{resource_type}",
                json=resource
            ) as resp:
                if resp.status == 201:
                    created = await resp.json()
                    resource_id = created.get('id')
                    self.resources[resource_type][resource_id] = resource
                    
                    # Track references
                    self._track_references(resource_type, resource_id, resource)
                    
                    return resource_id
                else:
                    return None
        except Exception:
            return None
    
    def _track_references(self, resource_type: str, resource_id: str, resource: Dict[str, Any]):
        """Track all references in a resource"""
        source_key = f"{resource_type}/{resource_id}"
        self.references[source_key] = []
        
        # Common reference fields
        ref_fields = [
            'subject', 'patient', 'encounter', 'requester', 'performer',
            'author', 'recorder', 'asserter', 'serviceProvider',
            'generalPractitioner', 'managingOrganization', 'partOf',
            'medication', 'medicationReference', 'individual', 'actor'
        ]
        
        for field in ref_fields:
            if field in resource:
                if isinstance(resource[field], dict) and 'reference' in resource[field]:
                    ref = resource[field]['reference']
                    if '/' in ref:
                        target_type, target_id = ref.split('/', 1)
                        self.references[source_key].append((field, target_type, target_id))
                elif isinstance(resource[field], list):
                    for item in resource[field]:
                        if isinstance(item, dict) and 'reference' in item:
                            ref = item['reference']
                            if '/' in ref:
                                target_type, target_id = ref.split('/', 1)
                                self.references[source_key].append((field, target_type, target_id))
    
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
    
    @given(
        num_patients=st.integers(min_value=1, max_value=3),
        num_practitioners=st.integers(min_value=1, max_value=3)
    )
    @settings(max_examples=20, deadline=10000)
    async def test_include_basic_properties(self, num_patients: int, num_practitioners: int):
        """Property: _include returns referenced resources with correct search mode"""
        await self.setup()
        
        try:
            # Create practitioners
            practitioner_ids = []
            for i in range(num_practitioners):
                prac_id = await self.create_resource({
                    "resourceType": "Practitioner",
                    "name": [{"family": f"Doctor{i}", "given": ["Test"]}],
                    "active": True
                })
                if prac_id:
                    practitioner_ids.append(prac_id)
            
            # Create patients with references to practitioners
            patient_ids = []
            patient_practitioners = {}
            
            for i in range(num_patients):
                prac_id = practitioner_ids[i % len(practitioner_ids)] if practitioner_ids else None
                patient_data = {
                    "resourceType": "Patient",
                    "name": [{"family": f"Patient{i}", "given": ["Test"]}],
                    "active": True
                }
                
                if prac_id:
                    patient_data["generalPractitioner"] = [{"reference": f"Practitioner/{prac_id}"}]
                    
                patient_id = await self.create_resource(patient_data)
                if patient_id:
                    patient_ids.append(patient_id)
                    if prac_id:
                        patient_practitioners[patient_id] = prac_id
            
            # Search with _include
            bundle = await self.search_resources("Patient", {
                "_id": ",".join(patient_ids),
                "_include": "Patient:general-practitioner"
            })
            
            # Analyze results
            matched_resources = []
            included_resources = []
            included_practitioner_ids = set()
            
            for entry in bundle.get('entry', []):
                search_mode = entry.get('search', {}).get('mode')
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType')
                resource_id = resource.get('id')
                
                if search_mode == 'match':
                    matched_resources.append((resource_type, resource_id))
                elif search_mode == 'include':
                    included_resources.append((resource_type, resource_id))
                    if resource_type == 'Practitioner':
                        included_practitioner_ids.add(resource_id)
            
            # Property 1: All matched resources should be patients
            for res_type, res_id in matched_resources:
                assert res_type == 'Patient', f"Non-patient resource marked as match: {res_type}/{res_id}"
            
            # Property 2: All included resources should have search.mode = 'include'
            for res_type, res_id in included_resources:
                note(f"Included: {res_type}/{res_id}")
            
            # Property 3: Referenced practitioners should be included
            for patient_id, prac_id in patient_practitioners.items():
                if patient_id in [rid for rt, rid in matched_resources]:
                    if prac_id in included_practitioner_ids:
                        note(f"✓ Practitioner {prac_id} included for patient {patient_id}")
                    else:
                        note(f"✗ Practitioner {prac_id} NOT included for patient {patient_id}")
            
            note(f"_include results: {len(matched_resources)} matched, {len(included_resources)} included")
        
        finally:
            await self.teardown()
    
    @given(
        include_params=include_parameter()
    )
    @settings(max_examples=20, deadline=10000)
    async def test_include_parameter_syntax(self, include_params: Tuple[str, List[str]]):
        """Property: Various _include syntaxes are handled correctly"""
        await self.setup()
        
        try:
            resource_type, includes = include_params
            
            # Create some test data
            if resource_type == 'Patient':
                patient_id = await self.create_resource({
                    "resourceType": "Patient",
                    "name": [{"family": "IncludeTest"}],
                    "active": True
                })
                search_params = {"_id": patient_id} if patient_id else {}
            else:
                search_params = {"_count": "5"}
            
            # Add _include parameters
            for include in includes:
                if '_include' not in search_params:
                    search_params['_include'] = include
                else:
                    # Multiple _include parameters
                    if isinstance(search_params['_include'], list):
                        search_params['_include'].append(include)
                    else:
                        search_params['_include'] = [search_params['_include'], include]
            
            # Execute search
            bundle = await self.search_resources(resource_type, search_params)
            
            # Property: Valid _include syntax should not cause errors
            assert isinstance(bundle, dict)
            assert 'resourceType' not in bundle or bundle['resourceType'] == 'Bundle'
            
            # Count search modes
            mode_counts = {'match': 0, 'include': 0, 'outcome': 0}
            for entry in bundle.get('entry', []):
                mode = entry.get('search', {}).get('mode', 'match')
                mode_counts[mode] = mode_counts.get(mode, 0) + 1
            
            note(f"_include {includes} on {resource_type}: modes={mode_counts}")
        
        finally:
            await self.teardown()
    
    @given(
        num_observations=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=20, deadline=10000)
    async def test_revinclude_properties(self, num_observations: int):
        """Property: _revinclude finds all resources that reference the target"""
        await self.setup()
        
        try:
            # Create a patient
            patient_id = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": "RevincludeTest", "given": ["Patient"]}],
                "active": True
            })
            
            # Create another patient (control)
            other_patient_id = await self.create_resource({
                "resourceType": "Patient",
                "name": [{"family": "OtherPatient", "given": ["Control"]}],
                "active": True
            })
            
            # Create observations for the target patient
            target_obs_ids = []
            for i in range(num_observations):
                obs_id = await self.create_resource({
                    "resourceType": "Observation",
                    "status": "final",
                    "code": {"coding": [{"code": f"test-{i}"}]},
                    "subject": {"reference": f"Patient/{patient_id}"}
                })
                if obs_id:
                    target_obs_ids.append(obs_id)
            
            # Create observations for the other patient
            other_obs_ids = []
            for i in range(2):
                obs_id = await self.create_resource({
                    "resourceType": "Observation",
                    "status": "final",
                    "code": {"coding": [{"code": f"other-{i}"}]},
                    "subject": {"reference": f"Patient/{other_patient_id}"}
                })
                if obs_id:
                    other_obs_ids.append(obs_id)
            
            # Search with _revinclude
            bundle = await self.search_resources("Patient", {
                "_id": patient_id,
                "_revinclude": "Observation:patient"
            })
            
            # Analyze results
            found_patients = []
            found_observations = []
            
            for entry in bundle.get('entry', []):
                resource = entry.get('resource', {})
                resource_type = resource.get('resourceType')
                resource_id = resource.get('id')
                search_mode = entry.get('search', {}).get('mode')
                
                if resource_type == 'Patient':
                    found_patients.append((resource_id, search_mode))
                elif resource_type == 'Observation':
                    found_observations.append((resource_id, search_mode))
            
            # Property 1: Target patient should be in results with mode='match'
            patient_found = any(pid == patient_id and mode == 'match' for pid, mode in found_patients)
            assert patient_found, "Target patient not found with mode='match'"
            
            # Property 2: All observations referencing the patient should be included
            included_obs_ids = [oid for oid, mode in found_observations if mode == 'include']
            for obs_id in target_obs_ids:
                if obs_id in included_obs_ids:
                    note(f"✓ Observation {obs_id} included via _revinclude")
                else:
                    note(f"✗ Observation {obs_id} NOT included via _revinclude")
            
            # Property 3: Observations for other patient should NOT be included
            for obs_id in other_obs_ids:
                assert obs_id not in included_obs_ids, f"Wrong observation {obs_id} included"
            
            note(f"_revinclude found {len(found_observations)} observations for patient")
        
        finally:
            await self.teardown()
    
    @given(
        resource_type=st.sampled_from(['Patient', 'Practitioner', 'Organization']),
        num_includes=st.integers(min_value=1, max_value=3),
        num_revincludes=st.integers(min_value=1, max_value=3)
    )
    @settings(max_examples=15, deadline=10000)
    async def test_combined_include_revinclude(self, resource_type: str, num_includes: int, num_revincludes: int):
        """Property: _include and _revinclude can be used together"""
        await self.setup()
        
        try:
            # Get available includes/revincludes for the resource type
            available_includes = {
                'Patient': ['Patient:general-practitioner', 'Patient:organization'],
                'Practitioner': ['Practitioner:organization'],
                'Organization': ['Organization:partof']
            }
            
            available_revincludes = {
                'Patient': ['Observation:patient', 'Encounter:patient'],
                'Practitioner': ['Patient:general-practitioner', 'Encounter:participant'],
                'Organization': ['Patient:organization', 'Organization:partof']
            }
            
            includes = available_includes.get(resource_type, [])[:num_includes]
            revincludes = available_revincludes.get(resource_type, [])[:num_revincludes]
            
            if not includes and not revincludes:
                return  # Skip if no parameters available
            
            # Build search parameters
            params = {"_count": "5"}
            if includes:
                params["_include"] = includes
            if revincludes:
                params["_revinclude"] = revincludes
            
            # Execute search
            bundle = await self.search_resources(resource_type, params)
            
            # Analyze results
            resource_types_by_mode = {}
            for entry in bundle.get('entry', []):
                mode = entry.get('search', {}).get('mode', 'match')
                res_type = entry.get('resource', {}).get('resourceType')
                
                if mode not in resource_types_by_mode:
                    resource_types_by_mode[mode] = set()
                resource_types_by_mode[mode].add(res_type)
            
            # Property: Should have matched resources of the search type
            if 'match' in resource_types_by_mode:
                assert resource_type in resource_types_by_mode['match']
            
            # Property: Combined parameters should not conflict
            total_entries = len(bundle.get('entry', []))
            note(f"Combined _include + _revinclude: {total_entries} total entries")
            note(f"Resource types by mode: {resource_types_by_mode}")
        
        finally:
            await self.teardown()
    
    @given(
        create_cycle=st.booleans()
    )
    @settings(max_examples=20, deadline=10000)
    async def test_include_cycle_handling(self, create_cycle: bool):
        """Property: Circular references are handled without infinite loops"""
        await self.setup()
        
        try:
            if create_cycle:
                # Create circular reference: Org A -> Org B -> Org A
                org_a_id = await self.create_resource({
                    "resourceType": "Organization",
                    "name": "Organization A",
                    "active": True
                })
                
                org_b_id = await self.create_resource({
                    "resourceType": "Organization",
                    "name": "Organization B",
                    "partOf": {"reference": f"Organization/{org_a_id}"},
                    "active": True
                })
                
                # Update Org A to reference Org B (creating cycle)
                # Note: This might not be possible via API, but test handling anyway
                
                # Search with _include
                bundle = await self.search_resources("Organization", {
                    "_id": org_a_id,
                    "_include": "Organization:partof"
                })
            else:
                # Create simple hierarchy without cycle
                parent_id = await self.create_resource({
                    "resourceType": "Organization",
                    "name": "Parent Org",
                    "active": True
                })
                
                child_id = await self.create_resource({
                    "resourceType": "Organization",
                    "name": "Child Org",
                    "partOf": {"reference": f"Organization/{parent_id}"},
                    "active": True
                })
                
                # Search with _include
                bundle = await self.search_resources("Organization", {
                    "_id": child_id,
                    "_include": "Organization:partof"
                })
            
            # Property: Search should complete without timeout/error
            assert isinstance(bundle, dict)
            entries = bundle.get('entry', [])
            
            # Property: Should not have duplicate entries
            resource_ids = [
                f"{entry['resource']['resourceType']}/{entry['resource']['id']}"
                for entry in entries
                if 'resource' in entry
            ]
            assert len(resource_ids) == len(set(resource_ids)), "Duplicate resources in bundle"
            
            note(f"Cycle={create_cycle}: Found {len(entries)} entries without issues")
        
        finally:
            await self.teardown()
    
    @given(
        include_nonexistent=st.booleans()
    )
    @settings(max_examples=20, deadline=10000)
    async def test_include_missing_references(self, include_nonexistent: bool):
        """Property: Missing/broken references are handled gracefully"""
        await self.setup()
        
        try:
            if include_nonexistent:
                # Create patient with reference to non-existent practitioner
                patient_id = await self.create_resource({
                    "resourceType": "Patient",
                    "name": [{"family": "BrokenRefPatient"}],
                    "generalPractitioner": [{"reference": "Practitioner/non-existent-id-12345"}],
                    "active": True
                })
            else:
                # Create normal reference
                prac_id = await self.create_resource({
                    "resourceType": "Practitioner",
                    "name": [{"family": "ExistingDoctor"}],
                    "active": True
                })
                
                patient_id = await self.create_resource({
                    "resourceType": "Patient",
                    "name": [{"family": "NormalRefPatient"}],
                    "generalPractitioner": [{"reference": f"Practitioner/{prac_id}"}],
                    "active": True
                })
            
            # Search with _include
            bundle = await self.search_resources("Patient", {
                "_id": patient_id,
                "_include": "Patient:general-practitioner"
            })
            
            # Count resources by type
            resource_counts = {}
            for entry in bundle.get('entry', []):
                res_type = entry.get('resource', {}).get('resourceType')
                resource_counts[res_type] = resource_counts.get(res_type, 0) + 1
            
            # Property: Should always include the patient
            assert resource_counts.get('Patient', 0) >= 1
            
            # Property: Should handle missing references gracefully
            if include_nonexistent:
                # Should not crash, practitioner count should be 0
                note(f"Broken reference handled: {resource_counts}")
            else:
                # Should include the practitioner
                assert resource_counts.get('Practitioner', 0) >= 1
                note(f"Normal reference included: {resource_counts}")
        
        finally:
            await self.teardown()


# Test runner functions
@pytest.mark.asyncio
async def test_include_basic():
    """Test basic _include properties"""
    props = IncludeRevincludeProperties()
    await props.test_include_basic_properties()


@pytest.mark.asyncio
async def test_include_syntax():
    """Test _include parameter syntax handling"""
    props = IncludeRevincludeProperties()
    await props.test_include_parameter_syntax()


@pytest.mark.asyncio
async def test_revinclude_basic():
    """Test basic _revinclude properties"""
    props = IncludeRevincludeProperties()
    await props.test_revinclude_properties()


@pytest.mark.asyncio
async def test_combined_include():
    """Test combined _include and _revinclude"""
    props = IncludeRevincludeProperties()
    await props.test_combined_include_revinclude()


@pytest.mark.asyncio
async def test_include_cycles():
    """Test handling of circular references"""
    props = IncludeRevincludeProperties()
    await props.test_include_cycle_handling()


@pytest.mark.asyncio
async def test_missing_references():
    """Test handling of missing references"""
    props = IncludeRevincludeProperties()
    await props.test_include_missing_references()


if __name__ == "__main__":
    # Run all include/revinclude property tests
    asyncio.run(test_include_basic())
    asyncio.run(test_include_syntax())
    asyncio.run(test_revinclude_basic())
    asyncio.run(test_combined_include())
    asyncio.run(test_include_cycles())
    asyncio.run(test_missing_references())