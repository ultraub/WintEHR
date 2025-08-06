#!/usr/bin/env python3
"""
Test Harness for Condition Onset Date Search (CRIT-001-CON)

This test validates the implementation of Condition onset-date search parameters
which are critical for patient safety - enables searching conditions by when they
started to track disease progression timing.

FHIR R4 Specification:
- Parameter: onset-date
- Type: date
- Description: Date when the condition was first recorded
- Path: Condition.onsetDateTime | Condition.onsetPeriod
- Operators: eq, ne, gt, ge, lt, le, sa, eb

Test Cases:
1. Search by exact onset date (eq)
2. Search with date range operators (gt, ge, lt, le)
3. Search with before/after date periods
4. Search with date precision considerations
5. Validation of extracted search parameters
6. Cross-validation with actual resource data
"""

import pytest
import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fhir.core.storage import FHIRStorageEngine
from database import get_async_session


class TestConditionOnsetDateSearch:
    """Test suite for Condition onset-date search parameter (CRIT-001-CON)"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with get_async_session() as session:
            yield FHIRStorageEngine(session)
    
    async def test_condition_onset_date_extraction(self, storage_engine):
        """Test that Condition onset dates are properly extracted as search parameters"""
        
        # Get a sample condition with onset date
        search_result = await storage_engine.search_resources('Condition', {}, {'_count': ['10']})
        assert search_result['total'] > 0, "No conditions found in database"
        
        # Find condition with onsetDateTime
        onset_condition = None
        for entry in search_result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_condition = condition
                break
        
        assert onset_condition is not None, "No conditions with onsetDateTime found"
        condition_id = onset_condition['id']
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_date
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :condition_id 
                AND r.resource_type = 'Condition'
                AND param_name = 'onset-date'
            """)
            result = await session.execute(query, {'condition_id': condition_id})
            search_params = result.fetchall()
            
            # Should have onset-date search parameters extracted
            assert len(search_params) > 0, f"No onset-date search parameters found for condition {condition_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'onset-date'
                assert param.param_type == 'date'
                assert param.value_date is not None, "Onset date value is null"
                
            print(f"✓ Found {len(search_params)} onset-date search parameters")
    
    async def test_search_by_exact_onset_date(self, storage_engine):
        """Test searching conditions by exact onset date (eq operator)"""
        
        # Get conditions with onset dates
        search_result = await storage_engine.search_resources('Condition', {}, {'_count': ['10']})
        
        onset_condition = None
        for entry in search_result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_condition = condition
                break
        
        assert onset_condition is not None, "No conditions with onsetDateTime found"
        
        onset_datetime = onset_condition['onsetDateTime']
        # Extract just the date part (YYYY-MM-DD)
        onset_date = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
        
        # Test search by exact date (implicit eq operator)
        search_params = {
            'onset-date': [onset_date]
        }
        result = await storage_engine.search_resources('Condition', search_params, {})
        
        assert result['total'] > 0, f"No conditions found by exact onset date search: {onset_date}"
        
        # Validate result contains conditions with matching onset dates
        found_condition_ids = [entry['resource']['id'] for entry in result['entry']]
        assert onset_condition['id'] in found_condition_ids, "Original condition not found in exact date search"
        
        print(f"✓ Successfully searched by exact onset date: {onset_date}")
    
    async def test_search_with_greater_than_date(self, storage_engine):
        """Test searching conditions with greater than date operator (gt)"""
        
        # Get conditions to find a good test date
        search_result = await storage_engine.search_resources('Condition', {}, {'_count': ['20']})
        
        # Collect all onset dates
        onset_dates = []
        for entry in search_result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_datetime = condition['onsetDateTime']
                # Parse date portion
                date_part = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
                try:
                    onset_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    onset_dates.append(onset_date)
                except ValueError:
                    continue
        
        assert len(onset_dates) > 0, "No valid onset dates found"
        
        # Use median date for gt search
        onset_dates.sort()
        median_date = onset_dates[len(onset_dates) // 2]
        
        # Test search with gt operator
        search_params = {
            'onset-date': [f"gt{median_date}"]
        }
        result = await storage_engine.search_resources('Condition', search_params, {})
        
        print(f"✓ Greater than search (gt{median_date}) found {result['total']} conditions")
        
        # Validate that returned conditions actually have onset dates > median
        if result['total'] > 0:
            for entry in result['entry']:
                condition = entry['resource']
                if 'onsetDateTime' in condition:
                    onset_datetime = condition['onsetDateTime']
                    date_part = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
                    try:
                        condition_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                        assert condition_date > median_date, \
                            f"Condition onset date {condition_date} not > {median_date}"
                    except ValueError:
                        pass  # Skip invalid dates
    
    async def test_search_with_less_than_date(self, storage_engine):
        """Test searching conditions with less than date operator (lt)"""
        
        # Get conditions to find a suitable test date
        search_result = await storage_engine.search_resources('Condition', {}, {'_count': ['20']})
        
        # Find the latest onset date for lt search
        latest_date = None
        for entry in search_result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_datetime = condition['onsetDateTime']
                date_part = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
                try:
                    condition_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    if latest_date is None or condition_date > latest_date:
                        latest_date = condition_date
                except ValueError:
                    continue
        
        assert latest_date is not None, "No valid onset dates found"
        
        # Test search with lt operator (use date after latest)
        search_date = latest_date + timedelta(days=1)
        search_params = {
            'onset-date': [f"lt{search_date}"]
        }
        result = await storage_engine.search_resources('Condition', search_params, {})
        
        # Should find conditions
        assert result['total'] > 0, f"No conditions found with lt{search_date}"
        
        print(f"✓ Less than search (lt{search_date}) found {result['total']} conditions")
        
        # Validate that returned conditions actually have onset dates < search_date
        for entry in result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_datetime = condition['onsetDateTime']
                date_part = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
                try:
                    condition_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    assert condition_date < search_date, \
                        f"Condition onset date {condition_date} not < {search_date}"
                except ValueError:
                    pass  # Skip invalid dates
    
    async def test_search_with_date_range(self, storage_engine):
        """Test searching conditions with date range operators (ge/le)"""
        
        # Get conditions to determine date range
        search_result = await storage_engine.search_resources('Condition', {}, {'_count': ['20']})
        
        onset_dates = []
        for entry in search_result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_datetime = condition['onsetDateTime']
                date_part = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
                try:
                    condition_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    onset_dates.append(condition_date)
                except ValueError:
                    continue
        
        assert len(onset_dates) > 0, "No valid onset dates found"
        
        onset_dates.sort()
        start_date = onset_dates[len(onset_dates) // 4]  # Q1
        end_date = onset_dates[3 * len(onset_dates) // 4]  # Q3
        
        # Test range search (between Q1 and Q3)
        search_params = {
            'onset-date': [f"ge{start_date}", f"le{end_date}"]
        }
        result = await storage_engine.search_resources('Condition', search_params, {})
        
        # Should find conditions in range
        assert result['total'] > 0, f"No conditions found in date range {start_date} to {end_date}"
        
        print(f"✓ Date range search (ge{start_date}&le{end_date}) found {result['total']} conditions")
        
        # Validate that returned conditions are within range
        for entry in result['entry']:
            condition = entry['resource']
            if 'onsetDateTime' in condition:
                onset_datetime = condition['onsetDateTime']
                date_part = onset_datetime.split('T')[0] if 'T' in onset_datetime else onset_datetime
                try:
                    condition_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                    assert start_date <= condition_date <= end_date, \
                        f"Condition onset date {condition_date} not in range {start_date} to {end_date}"
                except ValueError:
                    pass  # Skip invalid dates
    
    async def test_search_with_year_precision(self, storage_engine):
        """Test searching conditions with year-only precision"""
        
        # Get a condition with onset date
        search_result = await storage_engine.search_resources('Condition', {}, {'_count': ['1']})
        condition = search_result['entry'][0]['resource']
        
        if 'onsetDateTime' in condition:
            onset_datetime = condition['onsetDateTime']
            # Extract year
            year = onset_datetime.split('-')[0]
            
            # Test search by year only
            search_params = {
                'onset-date': [year]
            }
            result = await storage_engine.search_resources('Condition', search_params, {})
            
            print(f"✓ Year precision search ({year}) found {result['total']} conditions")
            
            # Validate that returned conditions are from the correct year
            for entry in result['entry']:
                result_condition = entry['resource']
                if 'onsetDateTime' in result_condition:
                    result_onset = result_condition['onsetDateTime']
                    result_year = result_onset.split('-')[0]
                    assert result_year == year, \
                        f"Condition onset year {result_year} != {year}"
    
    async def test_onset_date_search_parameter_coverage(self, storage_engine):
        """Test that onset-date search parameter is properly defined for Condition resource"""
        
        # Check search parameter definitions
        definitions = storage_engine._get_search_parameter_definitions()
        
        assert 'Condition' in definitions, "Condition not in search parameter definitions"
        condition_params = definitions['Condition']
        
        assert 'onset-date' in condition_params, "onset-date parameter not defined for Condition"
        onset_date_param = condition_params['onset-date']
        
        assert onset_date_param['type'] == 'date', "onset-date parameter should be type 'date'"
        
        print("✓ Condition onset-date search parameter properly defined")
    
    async def test_sql_validation_onset_date_extraction(self):
        """SQL validation that onset-date search parameters are extracted correctly"""
        
        async with get_async_session() as session:
            from sqlalchemy import text
            
            # Check that Condition onset dates are extracted
            query = text("""
                SELECT 
                    COUNT(*) as total_conditions,
                    COUNT(DISTINCT sp.resource_id) as conditions_with_onset,
                    COUNT(sp.id) as total_onset_params,
                    MIN(sp.value_date) as earliest_onset,
                    MAX(sp.value_date) as latest_onset
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'onset-date'
                WHERE r.resource_type = 'Condition'
                AND r.deleted = false
            """)
            result = await session.execute(query)
            stats = result.fetchone()
            
            assert stats.total_conditions > 0, "No conditions in database"
            assert stats.conditions_with_onset > 0, "No conditions have onset-date search parameters"
            assert stats.total_onset_params > 0, "No onset-date search parameters found"
            
            print(f"✓ SQL Validation: {stats.total_conditions} conditions, "
                  f"{stats.conditions_with_onset} with onset dates, "
                  f"{stats.total_onset_params} onset params")
            print(f"  Date range: {stats.earliest_onset} to {stats.latest_onset}")
            
            # Check for proper data types and non-null values
            validation_query = text("""
                SELECT 
                    COUNT(*) as total_params,
                    COUNT(value_date) as non_null_dates
                FROM fhir.search_parameters 
                WHERE param_name = 'onset-date'
                AND param_type = 'date'
            """)
            result = await session.execute(validation_query)
            validation = result.fetchone()
            
            assert validation.total_params > 0, "No onset-date parameters found"
            assert validation.non_null_dates == validation.total_params, \
                "Some onset-date parameters have null values"
            
            print(f"✓ SQL Validation: All {validation.total_params} onset-date params have valid dates")
            
            # Check date distribution by year
            year_query = text("""
                SELECT 
                    EXTRACT(YEAR FROM value_date) as year,
                    COUNT(*) as count
                FROM fhir.search_parameters 
                WHERE param_name = 'onset-date'
                AND param_type = 'date'
                GROUP BY EXTRACT(YEAR FROM value_date)
                ORDER BY year
                LIMIT 10
            """)
            result = await session.execute(year_query)
            years = result.fetchall()
            
            print("✓ Year distribution:")
            for year in years:
                print(f"  {int(year.year)}: {year.count} conditions")


if __name__ == "__main__":
    # Run individual test methods for debugging
    async def run_test():
        test_instance = TestConditionOnsetDateSearch()
        
        async with get_async_session() as session:
            storage = FHIRStorageEngine(session)
            
            print("Running Condition Onset Date Search Tests...")
            
            try:
                await test_instance.test_condition_onset_date_extraction(storage)
                await test_instance.test_search_by_exact_onset_date(storage)
                await test_instance.test_search_with_greater_than_date(storage)
                await test_instance.test_search_with_less_than_date(storage)
                await test_instance.test_search_with_date_range(storage)
                await test_instance.test_search_with_year_precision(storage)
                await test_instance.test_onset_date_search_parameter_coverage(storage)
                await test_instance.test_sql_validation_onset_date_extraction()
                
                print("\n✅ All Condition Onset Date Search tests PASSED")
                
            except Exception as e:
                print(f"\n❌ Test FAILED: {e}")
                raise
    
    # Run if called directly
    asyncio.run(run_test())