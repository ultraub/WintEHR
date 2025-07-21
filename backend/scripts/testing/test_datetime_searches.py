#!/usr/bin/env python3
"""
Test date/time search parameters with actual temporal data ranges.
Tests various date formats, operators, and edge cases.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import httpx

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class DateTimeSearchTester:
    """Tests date/time search parameters with real data."""
    
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
        """Run all date/time search tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("🕒 Testing Date/Time Search Parameters\n")
                print("="*60)
                
                # Test each resource type
                await self.test_patient_dates()
                await self.test_observation_dates()
                await self.test_encounter_dates()
                await self.test_condition_dates()
                await self.test_procedure_dates()
                
                # Test edge cases
                await self.test_date_formats()
                await self.test_date_operators()
                await self.test_timezone_handling()
                
                # Print summary
                self.print_summary()
    
    async def test_patient_dates(self):
        """Test Patient date searches (birthDate, death-date)."""
        print("\n📋 Testing Patient date searches...")
        
        # Get date ranges from actual data
        result = await self.db.execute(text("""
            SELECT 
                MIN(resource->>'birthDate') as min_birth,
                MAX(resource->>'birthDate') as max_birth,
                COUNT(*) as total,
                COUNT(CASE WHEN resource->>'deceasedDateTime' IS NOT NULL THEN 1 END) as deceased_count,
                MIN(resource->>'deceasedDateTime') as min_death,
                MAX(resource->>'deceasedDateTime') as max_death
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """))
        stats = result.fetchone()
        
        if stats.min_birth and stats.max_birth:
            # Test exact birthdate
            await self.test_search('Patient', 'birthdate', stats.min_birth,
                                 expected_min=1, description="Exact birthdate match")
            
            # Test birthdate ranges
            mid_date = stats.min_birth[:4] + "-01-01"  # Use year only
            await self.test_search('Patient', 'birthdate', f"ge{mid_date}",
                                 expected_min=1, description="Birthdate >= year")
            await self.test_search('Patient', 'birthdate', f"le{mid_date}",
                                 expected_min=1, description="Birthdate <= year")
            
            # Test birthdate between two dates
            start_year = int(stats.min_birth[:4])
            end_year = int(stats.max_birth[:4])
            mid_year = start_year + (end_year - start_year) // 2
            await self.test_search('Patient', 'birthdate', [f"ge{mid_year}-01-01", f"le{mid_year}-12-31"],
                                 expected_min=1, description=f"Birthdate in year {mid_year}")
        
        if stats.deceased_count > 0 and stats.min_death:
            # Test death-date searches
            await self.test_search('Patient', 'death-date', f"ge{stats.min_death[:10]}",
                                 expected_min=1, expected_max=stats.deceased_count,
                                 description="Death date >= min")
    
    async def test_observation_dates(self):
        """Test Observation date searches (date, effective)."""
        print("\n🔬 Testing Observation date searches...")
        
        # Get observation date ranges
        result = await self.db.execute(text("""
            SELECT 
                MIN(resource->>'effectiveDateTime') as min_date,
                MAX(resource->>'effectiveDateTime') as max_date,
                COUNT(*) as total
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->>'effectiveDateTime' IS NOT NULL
        """))
        stats = result.fetchone()
        
        if stats.min_date and stats.max_date:
            # Test date parameter (synonym for effective)
            await self.test_search('Observation', 'date', f"ge{stats.max_date[:7]}-01",
                                 expected_min=1, description="Observations in last month of data")
            
            # Test specific date
            await self.test_search('Observation', 'date', stats.max_date[:10],
                                 expected_min=1, description="Observations on specific date")
            
            # Test date range
            last_year = str(int(stats.max_date[:4]) - 1)
            await self.test_search('Observation', 'date', f"ge{last_year}-01-01",
                                 expected_min=1, description="Observations in last 2 years")
    
    async def test_encounter_dates(self):
        """Test Encounter date searches (date, period)."""
        print("\n🏨 Testing Encounter date searches...")
        
        # Get encounter period data
        result = await self.db.execute(text("""
            SELECT 
                MIN(resource->'period'->>'start') as min_start,
                MAX(resource->'period'->>'end') as max_end,
                COUNT(*) as total,
                COUNT(CASE WHEN resource->'period'->>'end' IS NULL THEN 1 END) as ongoing
            FROM fhir.resources
            WHERE resource_type = 'Encounter'
            AND deleted = false
            AND resource->'period'->>'start' IS NOT NULL
        """))
        stats = result.fetchone()
        
        if stats.min_start:
            # Test encounter date (checks period)
            await self.test_search('Encounter', 'date', f"ge{stats.min_start[:10]}",
                                 expected_exact=stats.total,
                                 description="All encounters (date >= min start)")
            
            # Test specific year
            year = stats.max_end[:4] if stats.max_end else stats.min_start[:4]
            await self.test_search('Encounter', 'date', f"ge{year}-01-01",
                                 expected_min=1, description=f"Encounters in/after {year}")
    
    async def test_condition_dates(self):
        """Test Condition date searches (onset-date, recorded-date)."""
        print("\n🏥 Testing Condition date searches...")
        
        # Get condition date data
        result = await self.db.execute(text("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN resource->>'onsetDateTime' IS NOT NULL THEN 1 END) as with_onset,
                MIN(resource->>'onsetDateTime') as min_onset,
                MAX(resource->>'onsetDateTime') as max_onset,
                COUNT(CASE WHEN resource->>'recordedDate' IS NOT NULL THEN 1 END) as with_recorded,
                MIN(resource->>'recordedDate') as min_recorded,
                MAX(resource->>'recordedDate') as max_recorded
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND deleted = false
        """))
        stats = result.fetchone()
        
        if stats.with_onset > 0 and stats.min_onset:
            # Test onset-date
            await self.test_search('Condition', 'onset-date', f"ge{stats.min_onset[:10]}",
                                 expected_exact=stats.with_onset,
                                 description="All conditions with onset date")
        
        if stats.with_recorded > 0 and stats.min_recorded:
            # Test recorded-date
            await self.test_search('Condition', 'recorded-date', f"ge{stats.min_recorded[:10]}",
                                 expected_exact=stats.with_recorded,
                                 description="All conditions with recorded date")
    
    async def test_procedure_dates(self):
        """Test Procedure date searches (date, performed)."""
        print("\n🔧 Testing Procedure date searches...")
        
        # Get procedure date data
        result = await self.db.execute(text("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN resource->>'performedDateTime' IS NOT NULL THEN 1 END) as with_datetime,
                MIN(resource->>'performedDateTime') as min_date,
                MAX(resource->>'performedDateTime') as max_date,
                COUNT(CASE WHEN resource->'performedPeriod' IS NOT NULL THEN 1 END) as with_period
            FROM fhir.resources
            WHERE resource_type = 'Procedure'
            AND deleted = false
        """))
        stats = result.fetchone()
        
        if stats.with_datetime > 0 and stats.min_date:
            # Test date parameter
            await self.test_search('Procedure', 'date', f"ge{stats.min_date[:10]}",
                                 expected_min=stats.with_datetime,
                                 description="All procedures with performed date")
    
    async def test_date_formats(self):
        """Test various date format support."""
        print("\n📅 Testing date format variations...")
        
        # Get a sample patient with birthdate
        result = await self.db.execute(text("""
            SELECT resource->>'birthDate' as birthdate
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'birthDate' IS NOT NULL
            LIMIT 1
        """))
        sample = result.fetchone()
        
        if sample and sample.birthdate:
            date = sample.birthdate
            
            # Test different precision levels
            formats = [
                (date[:4], "Year only (YYYY)"),
                (date[:7], "Year-month (YYYY-MM)"),
                (date[:10], "Full date (YYYY-MM-DD)")
            ]
            
            for format_date, desc in formats:
                await self.test_search('Patient', 'birthdate', format_date,
                                     expected_min=1, description=desc)
    
    async def test_date_operators(self):
        """Test all date comparison operators."""
        print("\n🔍 Testing date comparison operators...")
        
        # Get date range for testing
        result = await self.db.execute(text("""
            SELECT 
                resource->>'birthDate' as birthdate
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            AND resource->>'birthDate' IS NOT NULL
            ORDER BY resource->>'birthDate'
            LIMIT 1 OFFSET 5  -- Get 6th patient to ensure we have some before and after
        """))
        sample = result.fetchone()
        
        if sample and sample.birthdate:
            test_date = sample.birthdate[:10]
            
            # Test all operators
            operators = [
                ('eq', test_date, "Equal to (eq)"),
                ('ne', test_date, "Not equal to (ne)"),
                ('lt', test_date, "Less than (lt)"),
                ('le', test_date, "Less than or equal (le)"),
                ('gt', test_date, "Greater than (gt)"),
                ('ge', test_date, "Greater than or equal (ge)")
            ]
            
            for op, value, desc in operators:
                await self.test_search('Patient', 'birthdate', f"{op}{value}",
                                     expected_min=1, description=desc)
    
    async def test_timezone_handling(self):
        """Test timezone handling in date searches."""
        print("\n🌍 Testing timezone handling...")
        
        # Check if we have any timestamps with timezone info
        result = await self.db.execute(text("""
            SELECT 
                resource->>'effectiveDateTime' as datetime
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->>'effectiveDateTime' LIKE '%T%'
            LIMIT 5
        """))
        samples = result.fetchall()
        
        if samples:
            # Test with and without timezone
            for sample in samples:
                if sample.datetime and 'T' in sample.datetime:
                    # Test date portion only
                    date_only = sample.datetime[:10]
                    await self.test_search('Observation', 'date', date_only,
                                         expected_min=1, 
                                         description=f"Date search ignoring time: {date_only}")
                    break
    
    async def test_search(self, resource_type: str, param_name: str, param_value,
                         expected_min: int = 0, expected_max: int = None, 
                         expected_exact: int = None, description: str = None):
        """Test a single search parameter."""
        try:
            # Build query
            if isinstance(param_value, list):
                # Multiple parameters (AND)
                query_parts = [f"{param_name}={v}" for v in param_value]
                query = f"/{resource_type}?{'&'.join(query_parts)}"
            else:
                query = f"/{resource_type}?{param_name}={param_value}"
            
            # Execute search
            response = await self.client.get(query)
            
            if response.status_code != 200:
                self.record_result(False, description or query, 
                                 f"HTTP {response.status_code}: {response.text[:100]}")
                return
            
            bundle = response.json()
            total = bundle.get('total', 0)
            
            # Check expectations
            success = True
            error_msg = None
            
            if expected_exact is not None and total != expected_exact:
                success = False
                error_msg = f"Expected exactly {expected_exact}, got {total}"
            elif expected_min is not None and total < expected_min:
                success = False
                error_msg = f"Expected at least {expected_min}, got {total}"
            elif expected_max is not None and total > expected_max:
                success = False
                error_msg = f"Expected at most {expected_max}, got {total}"
            
            self.record_result(success, description or query, error_msg, total)
            
        except Exception as e:
            self.record_result(False, description or query, f"Exception: {str(e)}")
    
    def record_result(self, success: bool, description: str, error: str = None, count: int = None):
        """Record test result."""
        self.stats['total'] += 1
        
        if success:
            self.stats['passed'] += 1
            count_str = f" ({count} results)" if count is not None else ""
            print(f"  ✅ {description}{count_str}")
        else:
            self.stats['failed'] += 1
            self.stats['errors'].append({'test': description, 'error': error})
            print(f"  ❌ {description}: {error}")
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 DATE/TIME SEARCH SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/self.stats['total']*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/self.stats['total']*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")


async def main():
    """Run date/time search tests."""
    tester = DateTimeSearchTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())