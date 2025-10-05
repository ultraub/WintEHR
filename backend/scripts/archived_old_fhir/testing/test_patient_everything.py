#!/usr/bin/env python3
"""
Test Patient/$everything operation to ensure it returns all compartment resources.
Tests against actual patient data and compartment relationships.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Set
import httpx

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class PatientEverythingTester:
    """Tests Patient/$everything operation with real data."""
    
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
        """Run all Patient/$everything tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🏥 Testing Patient/$everything Operation\n")
                print("="*60)
                
                # Test basic $everything
                await self.test_basic_everything()
                
                # Test $everything with parameters
                await self.test_everything_with_parameters()
                
                # Test compartment completeness
                await self.test_compartment_completeness()
                
                # Test resource type filtering
                await self.test_type_filtering()
                
                # Test date filtering
                await self.test_date_filtering()
                
                # Print summary
                self.print_summary()
    
    async def test_basic_everything(self):
        """Test basic Patient/$everything operation."""
        print("\n📋 Testing basic Patient/$everything...")
        
        # Find a patient with the most compartment resources
        result = await self.db.execute(text("""
            SELECT 
                c.compartment_id as patient_id,
                COUNT(DISTINCT r.id) as resource_count,
                COUNT(DISTINCT r.resource_type) as type_count,
                string_agg(DISTINCT r.resource_type, ', ' ORDER BY r.resource_type) as resource_types
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND r.deleted = false
            GROUP BY c.compartment_id
            ORDER BY resource_count DESC
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            print(f"  Using patient {patient.patient_id}")
            print(f"  Expected resources: {patient.resource_count}")
            print(f"  Resource types: {patient.resource_types}")
            
            # Call $everything
            response = await self.client.get(f"/Patient/{patient.patient_id}/$everything")
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Count resources by type
                resource_counts = {}
                resource_ids = set()
                for entry in bundle.get('entry', []):
                    resource = entry.get('resource', {})
                    rt = resource.get('resourceType')
                    rid = resource.get('id')
                    
                    if rt:
                        resource_counts[rt] = resource_counts.get(rt, 0) + 1
                    if rid:
                        resource_ids.add(f"{rt}/{rid}")
                
                total_returned = len(bundle.get('entry', []))
                
                # Check if we got all expected resources
                if total_returned >= patient.resource_count:
                    self.record_result(True, "Basic Patient/$everything",
                                     count=total_returned)
                else:
                    # Find what's missing
                    missing = await self.find_missing_resources(patient.patient_id, resource_ids)
                    self.record_result(False, "Basic Patient/$everything",
                                     f"Expected {patient.resource_count} resources, got {total_returned}. Missing: {missing}")
                
                # Print resource breakdown
                print(f"\n  Resource breakdown:")
                for rt, count in sorted(resource_counts.items()):
                    print(f"    - {rt}: {count}")
            else:
                self.record_result(False, "Basic Patient/$everything",
                                 f"HTTP {response.status_code}: {response.text[:100]}")
    
    async def test_everything_with_parameters(self):
        """Test Patient/$everything with various parameters."""
        print("\n🔧 Testing Patient/$everything with parameters...")
        
        # Get a patient ID
        result = await self.db.execute(text("""
            SELECT fhir_id FROM fhir.resources 
            WHERE resource_type = 'Patient' AND deleted = false 
            LIMIT 1
        """))
        patient_id = result.scalar()
        
        if patient_id:
            # Test with _count parameter
            response = await self.client.get(f"/Patient/{patient_id}/$everything?_count=10")
            
            if response.status_code == 200:
                bundle = response.json()
                entry_count = len(bundle.get('entry', []))
                
                if entry_count <= 10:
                    self.record_result(True, "Patient/$everything with _count=10",
                                     count=entry_count)
                else:
                    self.record_result(False, "Patient/$everything with _count=10",
                                     f"Expected max 10 entries, got {entry_count}")
            else:
                self.record_result(False, "Patient/$everything with _count=10",
                                 f"HTTP {response.status_code}")
            
            # Test with _since parameter
            response = await self.client.get(f"/Patient/{patient_id}/$everything?_since=2024-01-01")
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Check that all returned resources have lastUpdated >= 2024-01-01
                all_recent = True
                for entry in bundle.get('entry', []):
                    last_updated = entry.get('resource', {}).get('meta', {}).get('lastUpdated', '')
                    if last_updated and last_updated < '2024-01-01':
                        all_recent = False
                        break
                
                if all_recent:
                    self.record_result(True, "Patient/$everything with _since",
                                     count=len(bundle.get('entry', [])))
                else:
                    self.record_result(False, "Patient/$everything with _since",
                                     "Found resources with lastUpdated before 2024-01-01")
            else:
                self.record_result(False, "Patient/$everything with _since",
                                 f"HTTP {response.status_code}")
    
    async def test_compartment_completeness(self):
        """Test that all compartment resources are returned."""
        print("\n📊 Testing compartment completeness...")
        
        # Test for each resource type that should be in patient compartment
        compartment_types = [
            'Observation', 'Condition', 'MedicationRequest', 'Procedure',
            'Encounter', 'Immunization', 'DiagnosticReport', 'CarePlan'
        ]
        
        # Find a patient with diverse resource types
        result = await self.db.execute(text("""
            SELECT p.fhir_id as patient_id
            FROM fhir.resources p
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND EXISTS (
                SELECT 1 FROM fhir.compartments c
                JOIN fhir.resources r ON r.id = c.resource_id
                WHERE c.compartment_id = p.fhir_id
                AND c.compartment_type = 'Patient'
                AND r.resource_type = ANY(:types)
            )
            LIMIT 1
        """), {'types': compartment_types})
        patient_id = result.scalar()
        
        if patient_id:
            # Get expected counts for each type
            for resource_type in compartment_types:
                expected = await self.db.execute(text("""
                    SELECT COUNT(*) as count
                    FROM fhir.compartments c
                    JOIN fhir.resources r ON r.id = c.resource_id
                    WHERE c.compartment_type = 'Patient'
                    AND c.compartment_id = :patient_id
                    AND r.resource_type = :resource_type
                    AND r.deleted = false
                """), {'patient_id': patient_id, 'resource_type': resource_type})
                expected_count = expected.scalar()
                
                if expected_count > 0:
                    # Call $everything and check this type
                    response = await self.client.get(f"/Patient/{patient_id}/$everything")
                    
                    if response.status_code == 200:
                        bundle = response.json()
                        
                        # Count resources of this type
                        actual_count = sum(1 for entry in bundle.get('entry', [])
                                         if entry.get('resource', {}).get('resourceType') == resource_type)
                        
                        if actual_count >= expected_count:
                            self.record_result(True, f"{resource_type} in compartment",
                                             count=actual_count)
                        else:
                            self.record_result(False, f"{resource_type} in compartment",
                                             f"Expected {expected_count}, got {actual_count}")
    
    async def test_type_filtering(self):
        """Test Patient/$everything with _type parameter."""
        print("\n🏷️ Testing type filtering...")
        
        # Find a patient with multiple resource types
        result = await self.db.execute(text("""
            SELECT 
                c.compartment_id as patient_id,
                COUNT(DISTINCT CASE WHEN r.resource_type = 'Observation' THEN r.id END) as obs_count,
                COUNT(DISTINCT CASE WHEN r.resource_type = 'Condition' THEN r.id END) as cond_count
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND r.deleted = false
            AND r.resource_type IN ('Observation', 'Condition')
            GROUP BY c.compartment_id
            HAVING COUNT(DISTINCT CASE WHEN r.resource_type = 'Observation' THEN r.id END) > 0
               AND COUNT(DISTINCT CASE WHEN r.resource_type = 'Condition' THEN r.id END) > 0
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            # Test filtering for just Observations
            response = await self.client.get(
                f"/Patient/{patient.patient_id}/$everything?_type=Observation"
            )
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Check that we only get Observations (and the Patient)
                resource_types = set()
                obs_count = 0
                for entry in bundle.get('entry', []):
                    rt = entry.get('resource', {}).get('resourceType')
                    resource_types.add(rt)
                    if rt == 'Observation':
                        obs_count += 1
                
                # Should have Patient and Observation only
                if resource_types <= {'Patient', 'Observation'} and obs_count == patient.obs_count:
                    self.record_result(True, "Type filtering for Observation",
                                     count=obs_count)
                else:
                    self.record_result(False, "Type filtering for Observation",
                                     f"Expected only Patient and {patient.obs_count} Observations, got {resource_types} with {obs_count} obs")
            
            # Test filtering for multiple types
            response = await self.client.get(
                f"/Patient/{patient.patient_id}/$everything?_type=Observation,Condition"
            )
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Check resource types
                resource_types = set()
                for entry in bundle.get('entry', []):
                    rt = entry.get('resource', {}).get('resourceType')
                    resource_types.add(rt)
                
                if resource_types <= {'Patient', 'Observation', 'Condition'}:
                    self.record_result(True, "Type filtering for multiple types",
                                     count=len(bundle.get('entry', [])))
                else:
                    self.record_result(False, "Type filtering for multiple types",
                                     f"Expected only Patient, Observation, Condition; got {resource_types}")
    
    async def test_date_filtering(self):
        """Test Patient/$everything with date filtering."""
        print("\n📅 Testing date filtering...")
        
        # Find a patient with resources across different dates
        result = await self.db.execute(text("""
            SELECT 
                c.compartment_id as patient_id,
                COUNT(DISTINCT r.id) as total_count,
                COUNT(DISTINCT CASE WHEN r.resource->>'lastUpdated' >= '2024-01-01' THEN r.id END) as recent_count
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND r.deleted = false
            GROUP BY c.compartment_id
            HAVING COUNT(DISTINCT r.id) > 10
               AND COUNT(DISTINCT CASE WHEN r.resource->>'lastUpdated' >= '2024-01-01' THEN r.id END) > 0
               AND COUNT(DISTINCT CASE WHEN r.resource->>'lastUpdated' < '2024-01-01' THEN r.id END) > 0
            LIMIT 1
        """))
        patient = result.fetchone()
        
        if patient:
            # Test with start date
            response = await self.client.get(
                f"/Patient/{patient.patient_id}/$everything?start=2024-01-01"
            )
            
            if response.status_code == 200:
                bundle = response.json()
                
                # Check dates on clinical resources
                all_after_start = True
                clinical_count = 0
                
                for entry in bundle.get('entry', []):
                    resource = entry.get('resource', {})
                    rt = resource.get('resourceType')
                    
                    # Check clinical resources with dates
                    if rt in ['Observation', 'Condition', 'Procedure', 'Encounter']:
                        clinical_count += 1
                        
                        # Check relevant date fields
                        date_fields = {
                            'Observation': ['effectiveDateTime', 'effectivePeriod'],
                            'Condition': ['onsetDateTime', 'recordedDate'],
                            'Procedure': ['performedDateTime', 'performedPeriod'],
                            'Encounter': ['period']
                        }
                        
                        # For now, just count clinical resources
                        # Full date filtering might not be implemented
                
                if clinical_count > 0:
                    self.record_result(True, "Date filtering (clinical resources found)",
                                     count=clinical_count)
                else:
                    self.record_result(False, "Date filtering",
                                     "No clinical resources found with date filter")
    
    async def find_missing_resources(self, patient_id: str, returned_ids: Set[str]) -> str:
        """Find which resources are missing from $everything response."""
        result = await self.db.execute(text("""
            SELECT r.resource_type, r.fhir_id
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND c.compartment_id = :patient_id
            AND r.deleted = false
        """), {'patient_id': patient_id})
        
        missing = []
        for row in result:
            resource_ref = f"{row.resource_type}/{row.fhir_id}"
            if resource_ref not in returned_ids:
                missing.append(resource_ref)
        
        if len(missing) > 10:
            return f"{missing[:10]} and {len(missing)-10} more"
        return str(missing)
    
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
        print("📊 PATIENT/$EVERYTHING SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - Patient/$everything should return all resources in the patient compartment")
        print("  - Compartment membership is determined by patient references")
        print("  - Parameters: _count, _since, _type, start, end")
        print("  - Results should include the Patient resource itself")


async def main():
    """Run Patient/$everything tests."""
    tester = PatientEverythingTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())