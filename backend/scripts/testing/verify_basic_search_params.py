#!/usr/bin/env python3
"""
Comprehensive verification of basic search parameters for all resource types.
Tests against real Synthea data in the database.
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text
from fhir.core.storage import FHIRStorageEngine
from fhir.core.search.basic import SearchParameterHandler


class BasicSearchVerifier:
    """Verifies basic search parameters work correctly with real data."""
    
    def __init__(self):
        self.results = []
        self.stats = {
            'total': 0,
            'passed': 0,
            'failed': 0,
            'by_resource': {}
        }
    
    async def verify_all_searches(self):
        """Run all basic search parameter tests."""
        async with get_db_context() as db:
            self.storage = FHIRStorageEngine(db)
            self.search_handler = SearchParameterHandler(self.storage._get_search_parameter_definitions())
            
            print("🔍 Verifying Basic Search Parameters\n")
            print("="*60)
            
            # Test each resource type
            await self.test_patient_searches(db)
            await self.test_observation_searches(db)
            await self.test_condition_searches(db)
            await self.test_medication_request_searches(db)
            await self.test_encounter_searches(db)
            await self.test_procedure_searches(db)
            
            # Print summary
            self.print_summary()
    
    async def test_patient_searches(self, db):
        """Test Patient search parameters."""
        print("\n📋 Testing Patient searches...")
        
        # Get sample data for testing
        result = await db.execute(text("""
            SELECT 
                resource->>'id' as id,
                resource->'name'->0->>'family' as family,
                resource->>'gender' as gender,
                resource->>'birthDate' as birthdate
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            LIMIT 5
        """))
        patients = result.fetchall()
        
        if patients:
            # Test _id search
            await self.test_search('Patient', '_id', patients[0].id, 
                                 expected_min=1, description="Search by _id")
            
            # Test name search
            if patients[0].family:
                await self.test_search('Patient', 'family', patients[0].family,
                                     expected_min=1, description="Search by family name")
            
            # Test gender search
            await self.test_search('Patient', 'gender', 'male',
                                 expected_min=1, description="Search by gender=male")
            await self.test_search('Patient', 'gender', 'female',
                                 expected_min=1, description="Search by gender=female")
            
            # Test birthdate search
            if patients[0].birthdate:
                await self.test_search('Patient', 'birthdate', f"ge{patients[0].birthdate}",
                                     expected_min=1, description="Search by birthdate range")
    
    async def test_observation_searches(self, db):
        """Test Observation search parameters."""
        print("\n🔬 Testing Observation searches...")
        
        # Get common observation codes
        result = await db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code
            ORDER BY count DESC
            LIMIT 5
        """))
        codes = result.fetchall()
        
        # Test code searches
        for code_row in codes:
            await self.test_search('Observation', 'code', code_row.code,
                                 expected_min=1, expected_max=code_row.count,
                                 description=f"Search by code={code_row.code}")
        
        # Test patient search
        result = await db.execute(text("""
            SELECT 
                resource->'subject'->>'reference' as patient_ref,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'subject'->>'reference' IS NOT NULL
            GROUP BY patient_ref
            ORDER BY count DESC
            LIMIT 1
        """))
        top_patient = result.fetchone()
        if top_patient:
            # Extract patient ID from reference
            patient_id = top_patient.patient_ref.split('/')[-1]
            await self.test_search('Observation', 'patient', patient_id,
                                 expected_min=1, description="Search by patient reference")
    
    async def test_condition_searches(self, db):
        """Test Condition search parameters."""
        print("\n🏥 Testing Condition searches...")
        
        # Test clinical-status
        await self.test_search('Condition', 'clinical-status', 'active',
                             expected_min=1, description="Search by clinical-status=active")
        await self.test_search('Condition', 'clinical-status', 'resolved',
                             expected_min=1, description="Search by clinical-status=resolved")
        
        # Test verification-status
        await self.test_search('Condition', 'verification-status', 'confirmed',
                             expected_min=1, description="Search by verification-status=confirmed")
    
    async def test_medication_request_searches(self, db):
        """Test MedicationRequest search parameters."""
        print("\n💊 Testing MedicationRequest searches...")
        
        # Test status
        await self.test_search('MedicationRequest', 'status', 'active',
                             expected_min=0, description="Search by status=active")
        await self.test_search('MedicationRequest', 'status', 'completed',
                             expected_min=0, description="Search by status=completed")
    
    async def test_encounter_searches(self, db):
        """Test Encounter search parameters."""
        print("\n🏨 Testing Encounter searches...")
        
        # Test status
        await self.test_search('Encounter', 'status', 'finished',
                             expected_min=1, description="Search by status=finished")
        
        # Test class
        await self.test_search('Encounter', 'class', 'ambulatory',
                             expected_min=0, description="Search by class=ambulatory")
    
    async def test_procedure_searches(self, db):
        """Test Procedure search parameters."""
        print("\n🔧 Testing Procedure searches...")
        
        # Test status
        await self.test_search('Procedure', 'status', 'completed',
                             expected_min=1, description="Search by status=completed")
    
    async def test_search(self, resource_type: str, param_name: str, param_value: str,
                         expected_min: int = 0, expected_max: int = None, description: str = None):
        """Test a single search parameter."""
        try:
            # Parse search parameters
            parsed_params, _ = self.search_handler.parse_search_params(
                resource_type, {param_name: param_value}
            )
            
            # Execute search
            resources, total = await self.storage.search_resources(resource_type, parsed_params)
            
            # Check results
            success = total >= expected_min
            if expected_max is not None:
                success = success and total <= expected_max
            
            # Record result
            result = {
                'resource_type': resource_type,
                'param_name': param_name,
                'param_value': param_value,
                'total': total,
                'expected_min': expected_min,
                'expected_max': expected_max,
                'success': success,
                'description': description or f"{resource_type}?{param_name}={param_value}"
            }
            
            self.results.append(result)
            self.stats['total'] += 1
            
            if success:
                self.stats['passed'] += 1
                print(f"  ✅ {result['description']}: {total} results")
            else:
                self.stats['failed'] += 1
                print(f"  ❌ {result['description']}: {total} results (expected: {expected_min}-{expected_max or '∞'})")
            
            # Update per-resource stats
            if resource_type not in self.stats['by_resource']:
                self.stats['by_resource'][resource_type] = {'total': 0, 'passed': 0, 'failed': 0}
            
            self.stats['by_resource'][resource_type]['total'] += 1
            if success:
                self.stats['by_resource'][resource_type]['passed'] += 1
            else:
                self.stats['by_resource'][resource_type]['failed'] += 1
                
        except Exception as e:
            print(f"  ❌ {description or f'{resource_type}?{param_name}={param_value}'}: ERROR - {str(e)}")
            self.stats['total'] += 1
            self.stats['failed'] += 1
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        
        print(f"\nOverall Results:")
        print(f"  Total Tests: {self.stats['total']}")
        print(f"  Passed: {self.stats['passed']} ({self.stats['passed']/self.stats['total']*100:.1f}%)")
        print(f"  Failed: {self.stats['failed']} ({self.stats['failed']/self.stats['total']*100:.1f}%)")
        
        print(f"\nResults by Resource Type:")
        for resource_type, stats in self.stats['by_resource'].items():
            print(f"  {resource_type}:")
            print(f"    - Tests: {stats['total']}")
            print(f"    - Passed: {stats['passed']} ({stats['passed']/stats['total']*100:.1f}%)")
            print(f"    - Failed: {stats['failed']}")
        
        if self.stats['failed'] > 0:
            print(f"\n❌ Failed Tests:")
            for result in self.results:
                if not result['success']:
                    print(f"  - {result['description']}: got {result['total']}, expected {result['expected_min']}-{result['expected_max'] or '∞'}")


async def main():
    verifier = BasicSearchVerifier()
    await verifier.verify_all_searches()


if __name__ == "__main__":
    asyncio.run(main())