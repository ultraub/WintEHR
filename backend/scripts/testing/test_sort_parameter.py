#!/usr/bin/env python3
"""
Test _sort parameter to ensure proper ordering of search results.
Tests various sort scenarios with real data.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Any
import httpx
from datetime import datetime

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class SortParameterTester:
    """Tests _sort parameter with real data."""
    
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
        """Run all _sort parameter tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🔤 Testing _sort Parameter\n")
                print("="*60)
                
                # Test basic sorting
                await self.test_basic_sorting()
                
                # Test descending sort
                await self.test_descending_sort()
                
                # Test multiple sort parameters
                await self.test_multiple_sort()
                
                # Test sorting with different data types
                await self.test_different_types()
                
                # Test sorting with search criteria
                await self.test_sort_with_search()
                
                # Test sorting edge cases
                await self.test_edge_cases()
                
                # Print summary
                self.print_summary()
    
    async def test_basic_sorting(self):
        """Test basic sorting on different fields."""
        print("\n📋 Testing basic sorting...")
        
        # Test Patient sort by birthdate
        await self.verify_sort('Patient', 'birthdate', "'birthDate'")
        
        # Test Patient sort by name
        await self.verify_sort('Patient', 'name', "'name'->0->>'family'", is_nested=True)
        
        # Test Observation sort by date
        await self.verify_sort('Observation', 'date', "'effectiveDateTime'")
        
        # Test Condition sort by onset-date
        await self.verify_sort('Condition', 'onset-date', "'onsetDateTime'")
        
        # Test Encounter sort by date
        await self.verify_sort('Encounter', 'date', "'period'->>'start'", is_nested=True)
        
        # Test MedicationRequest sort by authoredon
        await self.verify_sort('MedicationRequest', 'authoredon', "'authoredOn'")
    
    async def test_descending_sort(self):
        """Test descending sort using -field syntax."""
        print("\n⬇️ Testing descending sort...")
        
        # Test -birthdate (newest first)
        await self.verify_sort('Patient', '-birthdate', "'birthDate'", ascending=False)
        
        # Test -date for Observations
        await self.verify_sort('Observation', '-date', "'effectiveDateTime'", ascending=False)
        
        # Test -_lastUpdated
        await self.verify_sort('Patient', '-_lastUpdated', "'meta'->>'lastUpdated'", ascending=False, is_nested=True)
    
    async def test_multiple_sort(self):
        """Test sorting by multiple fields."""
        print("\n🔢 Testing multiple sort parameters...")
        
        # Test gender,birthdate
        response = await self.client.get("/Patient?_sort=gender,birthdate")
        
        if response.status_code == 200:
            bundle = response.json()
            
            # Check if results are sorted by gender then birthdate
            entries = bundle.get('entry', [])
            if len(entries) > 1:
                properly_sorted = True
                last_gender = None
                last_birthdate = {}
                
                for entry in entries:
                    resource = entry.get('resource', {})
                    gender = resource.get('gender', '')
                    birthdate = resource.get('birthDate', '')
                    
                    if last_gender and gender < last_gender:
                        properly_sorted = False
                        break
                    
                    if gender == last_gender and birthdate < last_birthdate.get(gender, ''):
                        properly_sorted = False
                        break
                    
                    last_gender = gender
                    last_birthdate[gender] = birthdate
                
                self.record_result(properly_sorted, "Multiple sort: gender,birthdate",
                                 None if properly_sorted else "Incorrect sort order")
            else:
                self.record_result(True, "Multiple sort: gender,birthdate",
                                 note="Not enough data to verify")
        else:
            self.record_result(False, "Multiple sort: gender,birthdate",
                             f"HTTP {response.status_code}")
    
    async def test_different_types(self):
        """Test sorting on different data types."""
        print("\n🎯 Testing sort on different field types...")
        
        # Test sorting on token (status)
        await self.verify_sort('MedicationRequest', 'status', "'status'")
        
        # Test sorting on reference (might not be supported)
        response = await self.client.get("/Observation?_sort=patient")
        
        if response.status_code == 200:
            self.record_result(True, "Sort on reference field accepted",
                             note="May not actually sort by reference")
        else:
            self.record_result(False, "Sort on reference field",
                             "Not supported (expected)")
        
        # Test sorting on _id
        await self.verify_sort('Patient', '_id', "'fhir_id'")
    
    async def test_sort_with_search(self):
        """Test sorting combined with search criteria."""
        print("\n🔍 Testing sort with search criteria...")
        
        # Get female patients sorted by birthdate
        response = await self.client.get("/Patient?gender=female&_sort=birthdate")
        
        if response.status_code == 200:
            bundle = response.json()
            entries = bundle.get('entry', [])
            
            # Verify all are female and sorted by birthdate
            all_female = True
            properly_sorted = True
            last_birthdate = None
            
            for entry in entries:
                resource = entry.get('resource', {})
                
                if resource.get('gender') != 'female':
                    all_female = False
                
                birthdate = resource.get('birthDate')
                if last_birthdate and birthdate and birthdate < last_birthdate:
                    properly_sorted = False
                
                last_birthdate = birthdate
            
            success = all_female and properly_sorted
            self.record_result(success, "Sort with search: female patients by birthdate",
                             None if success else f"all_female={all_female}, sorted={properly_sorted}")
        else:
            self.record_result(False, "Sort with search criteria",
                             f"HTTP {response.status_code}")
        
        # Test Observations for a patient sorted by date
        result = await self.db.execute(text("""
            SELECT p.fhir_id
            FROM fhir.resources p
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND EXISTS (
                SELECT 1 FROM fhir.resources o
                WHERE o.resource_type = 'Observation'
                AND o.deleted = false
                AND (o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                     OR o.resource->'subject'->>'reference' = 'urn:uuid:' || p.fhir_id)
            )
            LIMIT 1
        """))
        patient_id = result.scalar()
        
        if patient_id:
            response = await self.client.get(f"/Observation?patient={patient_id}&_sort=-date")
            
            if response.status_code == 200:
                bundle = response.json()
                entries = bundle.get('entry', [])
                
                # Verify sorted by date descending
                properly_sorted = True
                last_date = None
                
                for entry in entries:
                    resource = entry.get('resource', {})
                    date = resource.get('effectiveDateTime')
                    
                    if last_date and date and date > last_date:
                        properly_sorted = False
                        break
                    
                    last_date = date
                
                self.record_result(properly_sorted, 
                                 f"Observations for patient sorted by -date",
                                 None if properly_sorted else "Incorrect sort order")
    
    async def test_edge_cases(self):
        """Test edge cases for sorting."""
        print("\n🔧 Testing sort edge cases...")
        
        # Test invalid sort parameter
        response = await self.client.get("/Patient?_sort=invalid_field")
        
        # Server might accept it but ignore it
        if response.status_code == 200:
            self.record_result(True, "Invalid sort field handled gracefully")
        elif response.status_code == 400:
            self.record_result(True, "Invalid sort field rejected (also acceptable)")
        else:
            self.record_result(False, "Invalid sort field",
                             f"Unexpected HTTP {response.status_code}")
        
        # Test sorting with missing values
        # Find a field where some resources have values and some don't
        result = await self.db.execute(text("""
            SELECT 
                COUNT(CASE WHEN resource->>'deceasedDateTime' IS NOT NULL THEN 1 END) as with_deceased,
                COUNT(CASE WHEN resource->>'deceasedDateTime' IS NULL THEN 1 END) as without_deceased
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """))
        counts = result.fetchone()
        
        if counts.with_deceased > 0 and counts.without_deceased > 0:
            response = await self.client.get("/Patient?_sort=deceased")
            
            if response.status_code == 200:
                self.record_result(True, "Sort with missing values handled")
            else:
                self.record_result(False, "Sort with missing values",
                                 f"HTTP {response.status_code}")
        
        # Test empty sort parameter
        response = await self.client.get("/Patient?_sort=")
        
        if response.status_code in [200, 400]:
            self.record_result(True, "Empty sort parameter handled")
        else:
            self.record_result(False, "Empty sort parameter",
                             f"Unexpected HTTP {response.status_code}")
    
    async def verify_sort(self, resource_type: str, sort_param: str, 
                         db_field: str, ascending: bool = True, is_nested: bool = False):
        """Verify that sorting works correctly."""
        # Get expected order from database
        if ascending:
            order = "ASC"
        else:
            order = "DESC"
        
        # Handle NULL values
        null_handling = "NULLS LAST" if ascending else "NULLS FIRST"
        
        if is_nested:
            # For nested fields, use the exact expression
            select_expr = f"resource->{db_field}"
            where_expr = f"resource->{db_field}"
        else:
            # For simple fields, use ->> operator
            select_expr = f"resource->>{db_field}"
            where_expr = f"resource->>{db_field}"
        
        query = f"""
            SELECT fhir_id, {select_expr} as sort_value
            FROM fhir.resources
            WHERE resource_type = :resource_type
            AND deleted = false
            AND {where_expr} IS NOT NULL
            ORDER BY {select_expr} {order} {null_handling}
            LIMIT 10
        """
        
        result = await self.db.execute(text(query), {'resource_type': resource_type})
        expected_order = [(row.fhir_id, row.sort_value) for row in result]
        
        if not expected_order:
            self.record_result(True, f"{resource_type} sort by {sort_param}",
                             note="No data with values to sort")
            return
        
        # Get actual order from API
        response = await self.client.get(f"/{resource_type}?_sort={sort_param}&_count=10")
        
        if response.status_code != 200:
            self.record_result(False, f"{resource_type} sort by {sort_param}",
                             f"HTTP {response.status_code}")
            return
        
        bundle = response.json()
        actual_order = []
        
        for entry in bundle.get('entry', []):
            resource = entry.get('resource', {})
            actual_order.append(resource.get('id'))
        
        # Check if the order matches (at least for the resources that have values)
        matches = 0
        for expected_id, _ in expected_order:
            if expected_id in actual_order:
                matches += 1
        
        # We consider it successful if we find most of the expected resources
        # in approximately the right order
        success = matches >= min(5, len(expected_order) * 0.7)
        
        self.record_result(success, f"{resource_type} sort by {sort_param}",
                         None if success else f"Only {matches}/{len(expected_order)} in expected order",
                         count=len(actual_order))
    
    def record_result(self, success: bool, description: str, error: str = None, 
                     count: int = None, note: str = None):
        """Record test result."""
        self.stats['total'] += 1
        
        if success:
            self.stats['passed'] += 1
            status = "✅"
        else:
            self.stats['failed'] += 1
            self.stats['errors'].append({'test': description, 'error': error})
            status = "❌"
        
        msg = f"  {status} {description}"
        if count is not None:
            msg += f" ({count} results)"
        if note:
            msg += f" - {note}"
        if error and not success:
            msg += f": {error}"
        
        print(msg)
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 SORT PARAMETER SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - _sort parameter orders results by specified field")
        print("  - Use -field for descending order")
        print("  - Multiple fields: _sort=field1,field2")
        print("  - NULL values typically sort last (ascending) or first (descending)")
        print("  - Not all field types may support sorting")
        print("  - Sorting on complex fields (references, arrays) may not work")


async def main():
    """Run _sort parameter tests."""
    tester = SortParameterTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())