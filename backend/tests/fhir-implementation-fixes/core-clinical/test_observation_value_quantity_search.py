#!/usr/bin/env python3
"""
Test Harness for Observation Value Quantity Search (CRIT-001-OBS)

This test validates the implementation of Observation value-quantity search parameters
which is critical for patient safety - enables searching lab results by numeric values
(glucose > 200, etc.) with quantity operators.

FHIR R4 Specification:
- Parameter: value-quantity
- Type: quantity
- Description: The value or component value of the observation, if the value is a Quantity
- Path: Observation.value[x]:Quantity
- Operators: eq, ne, gt, ge, lt, le, sa, eb

Test Cases:
1. Search by exact quantity value (eq)
2. Search with greater than operator (gt)
3. Search with less than operator (lt)
4. Search with range operators (ge/le)
5. Search with unit considerations
6. Search with system-specific units
"""

import pytest
import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fhir.core.storage import FHIRStorageEngine
from database import get_async_session


class TestObservationValueQuantitySearch:
    """Test suite for Observation value-quantity search parameter (CRIT-001-OBS)"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with get_async_session() as session:
            yield FHIRStorageEngine(session)
    
    async def test_observation_value_quantity_extraction(self, storage_engine):
        """Test that Observation value quantities are properly extracted as search parameters"""
        
        # Get a sample observation with value quantity
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['10']})
        assert search_result['total'] > 0, "No observations found in database"
        
        # Find observation with valueQuantity
        value_quantity_obs = None
        for entry in search_result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs:
                value_quantity_obs = obs
                break
        
        assert value_quantity_obs is not None, "No observations with valueQuantity found"
        obs_id = value_quantity_obs['id']
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_quantity_value, value_quantity_unit, value_quantity_system
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :obs_id 
                AND r.resource_type = 'Observation'
                AND param_name = 'value-quantity'
            """)
            result = await session.execute(query, {'obs_id': obs_id})
            search_params = result.fetchall()
            
            # Should have value-quantity search parameters extracted
            assert len(search_params) > 0, f"No value-quantity search parameters found for observation {obs_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'value-quantity'
                assert param.param_type == 'quantity'
                assert param.value_quantity_value is not None, "Quantity value is null"
                
            print(f"✓ Found {len(search_params)} value-quantity search parameters")
    
    async def test_search_by_exact_quantity(self, storage_engine):
        """Test searching observations by exact quantity value (eq operator)"""
        
        # Get an observation with valueQuantity
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['10']})
        
        value_quantity_obs = None
        for entry in search_result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs:
                value_quantity_obs = obs
                break
        
        assert value_quantity_obs is not None, "No observations with valueQuantity found"
        
        value_quantity = value_quantity_obs['valueQuantity']
        value = value_quantity['value']
        unit = value_quantity.get('unit', '')
        
        # Test search by exact value (implicit eq operator)
        search_params = {
            'value-quantity': [f"{value}"]
        }
        result = await storage_engine.search_resources('Observation', search_params, {})
        
        assert result['total'] > 0, f"No observations found by exact quantity search: {value}"
        
        # Validate result contains observations with matching values
        found_obs_ids = [entry['resource']['id'] for entry in result['entry']]
        assert value_quantity_obs['id'] in found_obs_ids, "Original observation not found in exact quantity search"
        
        print(f"✓ Successfully searched by exact quantity: {value} {unit}")
    
    async def test_search_with_greater_than_operator(self, storage_engine):
        """Test searching observations with greater than operator (gt)"""
        
        # Get multiple observations to find a good test value
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['20']})
        
        # Collect all numeric values
        numeric_values = []
        for entry in search_result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs and 'value' in obs['valueQuantity']:
                numeric_values.append(float(obs['valueQuantity']['value']))
        
        assert len(numeric_values) > 0, "No numeric observations found"
        
        # Use median value for gt search
        numeric_values.sort()
        median_value = numeric_values[len(numeric_values) // 2]
        
        # Test search with gt operator
        search_params = {
            'value-quantity': [f"gt{median_value}"]
        }
        result = await storage_engine.search_resources('Observation', search_params, {})
        
        # Should find some observations (depending on data distribution)
        print(f"✓ Greater than search (gt{median_value}) found {result['total']} observations")
        
        # Validate that returned observations actually have values > median
        if result['total'] > 0:
            for entry in result['entry']:
                obs = entry['resource']
                if 'valueQuantity' in obs and 'value' in obs['valueQuantity']:
                    obs_value = float(obs['valueQuantity']['value'])
                    assert obs_value > median_value, f"Observation value {obs_value} not > {median_value}"
    
    async def test_search_with_less_than_operator(self, storage_engine):
        """Test searching observations with less than operator (lt)"""
        
        # Get observations to find a suitable test value
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['20']})
        
        # Find max value for lt search
        max_value = 0
        for entry in search_result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs and 'value' in obs['valueQuantity']:
                value = float(obs['valueQuantity']['value'])
                max_value = max(max_value, value)
        
        assert max_value > 0, "No numeric observations found"
        
        # Test search with lt operator (use value slightly above max)
        search_value = max_value + 1
        search_params = {
            'value-quantity': [f"lt{search_value}"]
        }
        result = await storage_engine.search_resources('Observation', search_params, {})
        
        # Should find observations
        assert result['total'] > 0, f"No observations found with lt{search_value}"
        
        print(f"✓ Less than search (lt{search_value}) found {result['total']} observations")
        
        # Validate that returned observations actually have values < search_value
        for entry in result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs and 'value' in obs['valueQuantity']:
                obs_value = float(obs['valueQuantity']['value'])
                assert obs_value < search_value, f"Observation value {obs_value} not < {search_value}"
    
    async def test_search_with_range_operators(self, storage_engine):
        """Test searching observations with range operators (ge/le)"""
        
        # Get observations to determine value range
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['20']})
        
        numeric_values = []
        for entry in search_result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs and 'value' in obs['valueQuantity']:
                numeric_values.append(float(obs['valueQuantity']['value']))
        
        assert len(numeric_values) > 0, "No numeric observations found"
        
        numeric_values.sort()
        q1_value = numeric_values[len(numeric_values) // 4]
        q3_value = numeric_values[3 * len(numeric_values) // 4]
        
        # Test range search (between Q1 and Q3)
        search_params = {
            'value-quantity': [f"ge{q1_value}", f"le{q3_value}"]
        }
        result = await storage_engine.search_resources('Observation', search_params, {})
        
        # Should find observations in range
        assert result['total'] > 0, f"No observations found in range {q1_value}-{q3_value}"
        
        print(f"✓ Range search (ge{q1_value}&le{q3_value}) found {result['total']} observations")
        
        # Validate that returned observations are within range
        for entry in result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs and 'value' in obs['valueQuantity']:
                obs_value = float(obs['valueQuantity']['value'])
                assert q1_value <= obs_value <= q3_value, \
                    f"Observation value {obs_value} not in range {q1_value}-{q3_value}"
    
    async def test_search_with_unit_consideration(self, storage_engine):
        """Test searching observations with unit-specific values"""
        
        # Get observations with different units
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['20']})
        
        unit_values = {}
        for entry in search_result['entry']:
            obs = entry['resource']
            if 'valueQuantity' in obs:
                vq = obs['valueQuantity']
                if 'value' in vq and 'unit' in vq:
                    unit = vq['unit']
                    value = vq['value']
                    if unit not in unit_values:
                        unit_values[unit] = []
                    unit_values[unit].append((value, obs['id']))
        
        assert len(unit_values) > 0, "No observations with units found"
        
        # Test search with unit-specific value
        test_unit = list(unit_values.keys())[0]
        test_value = unit_values[test_unit][0][0]
        
        search_params = {
            'value-quantity': [f"{test_value}||{test_unit}"]
        }
        result = await storage_engine.search_resources('Observation', search_params, {})
        
        print(f"✓ Unit-specific search ({test_value} {test_unit}) found {result['total']} observations")
        
        # Validate that returned observations have the correct unit
        if result['total'] > 0:
            for entry in result['entry']:
                obs = entry['resource']
                if 'valueQuantity' in obs and 'unit' in obs['valueQuantity']:
                    obs_unit = obs['valueQuantity']['unit']
                    assert obs_unit == test_unit, f"Observation unit {obs_unit} != {test_unit}"
    
    async def test_value_quantity_search_parameter_coverage(self, storage_engine):
        """Test that value-quantity search parameter is properly defined for Observation resource"""
        
        # Check search parameter definitions
        definitions = storage_engine._get_search_parameter_definitions()
        
        assert 'Observation' in definitions, "Observation not in search parameter definitions"
        obs_params = definitions['Observation']
        
        assert 'value-quantity' in obs_params, "value-quantity parameter not defined for Observation"
        value_quantity_param = obs_params['value-quantity']
        
        assert value_quantity_param['type'] == 'quantity', "value-quantity parameter should be type 'quantity'"
        
        print("✓ Observation value-quantity search parameter properly defined")
    
    async def test_sql_validation_value_quantity_extraction(self):
        """SQL validation that value-quantity search parameters are extracted correctly"""
        
        async with get_async_session() as session:
            from sqlalchemy import text
            
            # Check that Observation value quantities are extracted
            query = text("""
                SELECT 
                    COUNT(*) as total_observations,
                    COUNT(DISTINCT sp.resource_id) as obs_with_quantities,
                    COUNT(sp.id) as total_quantity_params,
                    AVG(sp.value_quantity_value) as avg_quantity_value,
                    MIN(sp.value_quantity_value) as min_quantity_value,
                    MAX(sp.value_quantity_value) as max_quantity_value
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'value-quantity'
                WHERE r.resource_type = 'Observation'
                AND r.deleted = false
            """)
            result = await session.execute(query)
            stats = result.fetchone()
            
            assert stats.total_observations > 0, "No observations in database"
            assert stats.obs_with_quantities > 0, "No observations have value-quantity search parameters"
            assert stats.total_quantity_params > 0, "No value-quantity search parameters found"
            
            print(f"✓ SQL Validation: {stats.total_observations} observations, "
                  f"{stats.obs_with_quantities} with quantities, "
                  f"{stats.total_quantity_params} quantity params")
            print(f"  Value range: {stats.min_quantity_value} - {stats.max_quantity_value}")
            print(f"  Average value: {stats.avg_quantity_value}")
            
            # Check for proper data types and non-null values
            validation_query = text("""
                SELECT 
                    COUNT(*) as total_params,
                    COUNT(value_quantity_value) as non_null_values,
                    COUNT(value_quantity_unit) as with_units,
                    COUNT(value_quantity_system) as with_systems
                FROM fhir.search_parameters 
                WHERE param_name = 'value-quantity'
                AND param_type = 'quantity'
            """)
            result = await session.execute(validation_query)
            validation = result.fetchone()
            
            assert validation.total_params > 0, "No value-quantity parameters found"
            assert validation.non_null_values == validation.total_params, \
                "Some value-quantity parameters have null values"
            
            print(f"✓ SQL Validation: {validation.with_units} params with units, "
                  f"{validation.with_systems} with systems")


if __name__ == "__main__":
    # Run individual test methods for debugging
    async def run_test():
        test_instance = TestObservationValueQuantitySearch()
        
        async with get_async_session() as session:
            storage = FHIRStorageEngine(session)
            
            print("Running Observation Value Quantity Search Tests...")
            
            try:
                await test_instance.test_observation_value_quantity_extraction(storage)
                await test_instance.test_search_by_exact_quantity(storage)
                await test_instance.test_search_with_greater_than_operator(storage)
                await test_instance.test_search_with_less_than_operator(storage)
                await test_instance.test_search_with_range_operators(storage)
                await test_instance.test_search_with_unit_consideration(storage)
                await test_instance.test_value_quantity_search_parameter_coverage(storage)
                await test_instance.test_sql_validation_value_quantity_extraction()
                
                print("\n✅ All Observation Value Quantity Search tests PASSED")
                
            except Exception as e:
                print(f"\n❌ Test FAILED: {e}")
                raise
    
    # Run if called directly
    asyncio.run(run_test())