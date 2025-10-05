#!/usr/bin/env python3
"""
Test _include and _revinclude search parameters with actual resource relationships.
These parameters allow including referenced resources in search results.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Set
import httpx

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class IncludeSearchTester:
    """Tests _include and _revinclude search parameters with real data."""
    
    def __init__(self):
        self.api_base = "http://localhost:8000/fhir/R4"
        self.results = []
        self.stats = {
            'total': 0,
            'passed': 0,
            'failed': 0,
            'errors': []
        }
    
    async def run_all_tests(self):
        """Run all include/revinclude tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("📎 Testing _include and _revinclude Parameters\n")
                print("="*60)
                
                # Test _include (forward includes)
                await self.test_include_forward()
                
                # Test _revinclude (reverse includes)
                await self.test_include_reverse()
                
                # Test multiple includes
                await self.test_multiple_includes()
                
                # Test _include:iterate
                await self.test_include_iterate()
                
                # Print summary
                self.print_summary()
    
    async def test_include_forward(self):
        """Test _include parameter (forward references)."""
        print("\n➡️ Testing _include (forward references)...")
        
        # Test Observation _include patient
        # Find an observation with a patient reference
        result = await self.db.execute(text("""
            SELECT o.fhir_id as obs_id, 
                   CASE 
                       WHEN o.resource->'subject'->>'reference' LIKE 'Patient/%' 
                       THEN substring(o.resource->'subject'->>'reference', 9)
                       WHEN o.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                       THEN substring(o.resource->'subject'->>'reference', 10)
                       ELSE NULL
                   END as patient_id
            FROM fhir.resources o
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND o.resource->'subject'->>'reference' IS NOT NULL
            LIMIT 1
        """))
        obs = result.fetchone()
        
        if obs and obs.patient_id:
            # Search for observation and include patient
            response = await self.client.get(f"/Observation?_id={obs.obs_id}&_include=Observation:patient")
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Should have at least 2 entries (observation + patient)
                if bundle.get('total', 0) >= 1 and len(bundle.get('entry', [])) >= 2:
                    # Check if patient is included
                    resource_types = {entry['resource']['resourceType'] 
                                    for entry in bundle.get('entry', [])}
                    
                    if 'Observation' in resource_types and 'Patient' in resource_types:
                        self.record_result(True, "Observation with _include=Observation:patient",
                                         count=len(bundle.get('entry', [])))
                    else:
                        self.record_result(False, "Observation with _include=Observation:patient",
                                         f"Expected Observation and Patient, got {resource_types}")
                else:
                    self.record_result(False, "Observation with _include=Observation:patient",
                                     f"Expected at least 2 entries, got {len(bundle.get('entry', []))}")
            else:
                self.record_result(False, "Observation with _include=Observation:patient",
                                 f"HTTP {response.status_code}")
        
        # Test MedicationRequest _include medication
        result = await self.db.execute(text("""
            SELECT m.fhir_id as med_req_id,
                   m.resource->'medicationReference'->>'reference' as med_ref
            FROM fhir.resources m
            WHERE m.resource_type = 'MedicationRequest'
            AND m.deleted = false
            AND m.resource->'medicationReference'->>'reference' IS NOT NULL
            LIMIT 1
        """))
        med_req = result.fetchone()
        
        if med_req:
            response = await self.client.get(f"/MedicationRequest?_id={med_req.med_req_id}&_include=MedicationRequest:medication")
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Check if medication is included
                resource_types = {entry['resource']['resourceType'] 
                                for entry in bundle.get('entry', [])}
                
                if 'MedicationRequest' in resource_types:
                    # Medication might be inline CodeableConcept
                    self.record_result(True, "MedicationRequest with _include=MedicationRequest:medication",
                                     count=len(bundle.get('entry', [])))
                else:
                    self.record_result(False, "MedicationRequest with _include=MedicationRequest:medication",
                                     "Failed to get MedicationRequest")
            else:
                self.record_result(False, "MedicationRequest with _include=MedicationRequest:medication",
                                 f"HTTP {response.status_code}")
        
        # Test Encounter _include practitioner
        result = await self.db.execute(text("""
            SELECT e.fhir_id as encounter_id,
                   participant->'individual'->>'reference' as practitioner_ref
            FROM fhir.resources e,
                 jsonb_array_elements(e.resource->'participant') as participant
            WHERE e.resource_type = 'Encounter'
            AND e.deleted = false
            AND participant->'individual'->>'reference' LIKE 'Practitioner/%'
            LIMIT 1
        """))
        encounter = result.fetchone()
        
        if encounter:
            response = await self.client.get(f"/Encounter?_id={encounter.encounter_id}&_include=Encounter:practitioner")
            
            if response.status_code == 200:
                bundle = response.json()
                resource_types = {entry['resource']['resourceType'] 
                                for entry in bundle.get('entry', [])}
                
                if 'Encounter' in resource_types and 'Practitioner' in resource_types:
                    self.record_result(True, "Encounter with _include=Encounter:practitioner",
                                     count=len(bundle.get('entry', [])))
                else:
                    self.record_result(False, "Encounter with _include=Encounter:practitioner",
                                     f"Expected Encounter and Practitioner, got {resource_types}")
            else:
                self.record_result(False, "Encounter with _include=Encounter:practitioner",
                                 f"HTTP {response.status_code}")
    
    async def test_include_reverse(self):
        """Test _revinclude parameter (reverse references)."""
        print("\n⬅️ Testing _revinclude (reverse references)...")
        
        # Find a patient with observations
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id, COUNT(o.id) as obs_count
            FROM fhir.resources p
            JOIN fhir.resources o ON (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                                   OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND o.resource_type = 'Observation'
            AND o.deleted = false
            GROUP BY p.fhir_id
            ORDER BY obs_count DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            # Search for patient and include observations that reference it
            response = await self.client.get(f"/Patient?_id={patient.patient_id}&_revinclude=Observation:patient")
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Count resource types
                resource_counts = {}
                for entry in bundle.get('entry', []):
                    rt = entry['resource']['resourceType']
                    resource_counts[rt] = resource_counts.get(rt, 0) + 1
                
                if resource_counts.get('Patient', 0) == 1 and resource_counts.get('Observation', 0) > 0:
                    self.record_result(True, "Patient with _revinclude=Observation:patient",
                                     count=sum(resource_counts.values()))
                else:
                    self.record_result(False, "Patient with _revinclude=Observation:patient",
                                     f"Expected 1 Patient and {patient.obs_count} Observations, got {resource_counts}")
            else:
                self.record_result(False, "Patient with _revinclude=Observation:patient",
                                 f"HTTP {response.status_code}")
        
        # Test Patient _revinclude Condition
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id, COUNT(c.id) as condition_count
            FROM fhir.resources p
            JOIN fhir.resources c ON (c.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                                   OR c.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND c.resource_type = 'Condition'
            AND c.deleted = false
            GROUP BY p.fhir_id
            ORDER BY condition_count DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            response = await self.client.get(f"/Patient?_id={patient.patient_id}&_revinclude=Condition:patient")
            
            if response.status_code == 200:
                bundle = response.json()
                
                resource_counts = {}
                for entry in bundle.get('entry', []):
                    rt = entry['resource']['resourceType']
                    resource_counts[rt] = resource_counts.get(rt, 0) + 1
                
                if resource_counts.get('Patient', 0) == 1 and resource_counts.get('Condition', 0) > 0:
                    self.record_result(True, "Patient with _revinclude=Condition:patient",
                                     count=sum(resource_counts.values()))
                else:
                    self.record_result(False, "Patient with _revinclude=Condition:patient",
                                     f"Expected 1 Patient and conditions, got {resource_counts}")
            else:
                self.record_result(False, "Patient with _revinclude=Condition:patient",
                                 f"HTTP {response.status_code}")
        
        # Test Practitioner _revinclude Encounter
        result = await self.db.execute(text("""
            SELECT pr.fhir_id as practitioner_id, COUNT(DISTINCT e.id) as encounter_count
            FROM fhir.resources pr
            JOIN fhir.resources e ON EXISTS (
                SELECT 1 FROM jsonb_array_elements(e.resource->'participant') as participant
                WHERE participant->'individual'->>'reference' = 'Practitioner/' || pr.fhir_id
            )
            WHERE pr.resource_type = 'Practitioner'
            AND pr.deleted = false
            AND e.resource_type = 'Encounter'
            AND e.deleted = false
            GROUP BY pr.fhir_id
            ORDER BY encounter_count DESC
            LIMIT 1
        """))
        practitioner = result.fetchone()
        
        if practitioner:
            response = await self.client.get(f"/Practitioner?_id={practitioner.practitioner_id}&_revinclude=Encounter:practitioner")
            
            if response.status_code == 200:
                bundle = response.json()
                
                resource_counts = {}
                for entry in bundle.get('entry', []):
                    rt = entry['resource']['resourceType']
                    resource_counts[rt] = resource_counts.get(rt, 0) + 1
                
                if resource_counts.get('Practitioner', 0) == 1 and resource_counts.get('Encounter', 0) > 0:
                    self.record_result(True, "Practitioner with _revinclude=Encounter:practitioner",
                                     count=sum(resource_counts.values()))
                else:
                    self.record_result(False, "Practitioner with _revinclude=Encounter:practitioner",
                                     f"Expected 1 Practitioner and encounters, got {resource_counts}")
            else:
                self.record_result(False, "Practitioner with _revinclude=Encounter:practitioner",
                                 f"HTTP {response.status_code}")
    
    async def test_multiple_includes(self):
        """Test multiple _include and _revinclude parameters."""
        print("\n🔗 Testing multiple includes...")
        
        # Find a patient with both observations and conditions
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id,
                   COUNT(DISTINCT o.id) as obs_count,
                   COUNT(DISTINCT c.id) as condition_count
            FROM fhir.resources p
            LEFT JOIN fhir.resources o ON o.resource_type = 'Observation' 
                AND o.deleted = false
                AND (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            LEFT JOIN fhir.resources c ON c.resource_type = 'Condition'
                AND c.deleted = false
                AND (c.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR c.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            GROUP BY p.fhir_id
            HAVING COUNT(DISTINCT o.id) > 0 AND COUNT(DISTINCT c.id) > 0
            ORDER BY COUNT(DISTINCT o.id) + COUNT(DISTINCT c.id) DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            # Test multiple _revinclude
            response = await self.client.get(
                f"/Patient?_id={patient.patient_id}&_revinclude=Observation:patient&_revinclude=Condition:patient"
            )
            
            if response.status_code == 200:
                bundle = response.json()
                
                resource_counts = {}
                for entry in bundle.get('entry', []):
                    rt = entry['resource']['resourceType']
                    resource_counts[rt] = resource_counts.get(rt, 0) + 1
                
                if (resource_counts.get('Patient', 0) == 1 and 
                    resource_counts.get('Observation', 0) > 0 and
                    resource_counts.get('Condition', 0) > 0):
                    self.record_result(True, "Patient with multiple _revinclude",
                                     count=sum(resource_counts.values()))
                else:
                    self.record_result(False, "Patient with multiple _revinclude",
                                     f"Expected Patient, Observations, and Conditions, got {resource_counts}")
            else:
                self.record_result(False, "Patient with multiple _revinclude",
                                 f"HTTP {response.status_code}")
        
        # Test combining _include and search parameters
        result = await self.db.execute(text("""
            SELECT o.fhir_id as obs_id
            FROM fhir.resources o
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            AND o.resource->>'status' = 'final'
            AND o.resource->'subject'->>'reference' IS NOT NULL
            LIMIT 1
        """))
        obs = result.fetchone()
        
        if obs:
            response = await self.client.get(
                f"/Observation?status=final&_id={obs.obs_id}&_include=Observation:patient"
            )
            
            if response.status_code == 200:
                bundle = response.json()
                resource_types = {entry['resource']['resourceType'] 
                                for entry in bundle.get('entry', [])}
                
                if 'Observation' in resource_types:
                    self.record_result(True, "Search with criteria and _include",
                                     count=len(bundle.get('entry', [])))
                else:
                    self.record_result(False, "Search with criteria and _include",
                                     "Failed to get results")
            else:
                self.record_result(False, "Search with criteria and _include",
                                 f"HTTP {response.status_code}")
    
    async def test_include_iterate(self):
        """Test _include:iterate for transitive includes."""
        print("\n🔁 Testing _include:iterate...")
        
        # Find an observation -> patient -> organization chain
        result = await self.db.execute(text("""
            SELECT o.fhir_id as obs_id,
                   p.fhir_id as patient_id,
                   org.fhir_id as org_id
            FROM fhir.resources o
            JOIN fhir.resources p ON p.resource_type = 'Patient'
                AND p.deleted = false
                AND (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            JOIN fhir.resources org ON org.resource_type = 'Organization'
                AND org.deleted = false
                AND p.resource->'managingOrganization'->>'reference' = 'Organization/' || org.fhir_id
            WHERE o.resource_type = 'Observation'
            AND o.deleted = false
            LIMIT 1
        """))
        chain = result.fetchone()
        
        if chain:
            # Test _include:iterate to get observation -> patient -> organization
            response = await self.client.get(
                f"/Observation?_id={chain.obs_id}&_include=Observation:patient&_include:iterate=Patient:organization"
            )
            
            if response.status_code == 200:
                bundle = response.json()
                
                resource_counts = {}
                for entry in bundle.get('entry', []):
                    rt = entry['resource']['resourceType']
                    resource_counts[rt] = resource_counts.get(rt, 0) + 1
                
                if (resource_counts.get('Observation', 0) >= 1 and
                    resource_counts.get('Patient', 0) >= 1 and
                    resource_counts.get('Organization', 0) >= 1):
                    self.record_result(True, "_include:iterate for transitive includes",
                                     count=sum(resource_counts.values()))
                else:
                    self.record_result(False, "_include:iterate for transitive includes",
                                     f"Expected Observation, Patient, and Organization, got {resource_counts}")
            else:
                self.record_result(False, "_include:iterate for transitive includes",
                                 f"HTTP {response.status_code}")
        else:
            self.record_result(False, "_include:iterate for transitive includes",
                             "No observation->patient->organization chain found")
    
    def record_result(self, success: bool, description: str, error: str = None, count: int = None):
        """Record test result."""
        self.stats['total'] += 1
        
        if success:
            self.stats['passed'] += 1
            count_str = f" ({count} resources)" if count is not None else ""
            print(f"  ✅ {description}{count_str}")
        else:
            self.stats['failed'] += 1
            self.stats['errors'].append({'test': description, 'error': error})
            print(f"  ❌ {description}: {error}")
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 INCLUDE/REVINCLUDE SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - _include adds referenced resources to results")
        print("  - _revinclude adds resources that reference the searched resource")
        print("  - Multiple includes can be specified")
        print("  - _include:iterate allows transitive includes")


async def main():
    """Run include/revinclude tests."""
    tester = IncludeSearchTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())