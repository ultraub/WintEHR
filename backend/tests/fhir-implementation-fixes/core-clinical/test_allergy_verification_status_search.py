#!/usr/bin/env python3
"""
Test Harness for AllergyIntolerance Verification Status Search (CRIT-002-ALL)

This test validates the implementation of AllergyIntolerance verification-status and 
criticality search parameters which are critical for patient safety - enables 
distinguishing confirmed vs suspected allergies and filtering by criticality level.

FHIR R4 Specification:
- Parameter: verification-status
- Type: token
- Description: unconfirmed | confirmed | refuted | entered-in-error
- Path: AllergyIntolerance.verificationStatus

- Parameter: criticality
- Type: token
- Description: low | high | unable-to-assess
- Path: AllergyIntolerance.criticality

Test Cases:
1. Search by verification status (confirmed, unconfirmed, etc.)
2. Search by criticality level (high, low, unable-to-assess)
3. Combined searches (confirmed AND high criticality)
4. Validation of extracted search parameters
5. Cross-validation with actual resource data
"""

import pytest
import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fhir.core.storage import FHIRStorageEngine
from database import get_async_session


class TestAllergyIntoleranceVerificationStatusSearch:
    """Test suite for AllergyIntolerance verification-status and criticality search parameters (CRIT-002-ALL)"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with get_async_session() as session:
            yield FHIRStorageEngine(session)
    
    async def test_allergy_verification_status_extraction(self, storage_engine):
        """Test that AllergyIntolerance verification status is properly extracted as search parameters"""
        
        # Get a sample allergy to validate extraction
        search_result = await storage_engine.search_resources('AllergyIntolerance', {}, {'_count': ['1']})
        assert search_result['total'] > 0, "No allergies found in database"
        
        allergy = search_result['entry'][0]['resource']
        allergy_id = allergy['id']
        
        # Validate verification status structure exists
        assert 'verificationStatus' in allergy, "AllergyIntolerance missing verificationStatus field"
        verification_status = allergy['verificationStatus']
        assert 'coding' in verification_status, "verificationStatus missing coding"
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_token_system, value_token_code 
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :allergy_id 
                AND r.resource_type = 'AllergyIntolerance'
                AND param_name = 'verification-status'
            """)
            result = await session.execute(query, {'allergy_id': allergy_id})
            search_params = result.fetchall()
            
            # Should have verification-status search parameters extracted
            assert len(search_params) > 0, f"No verification-status search parameters found for allergy {allergy_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'verification-status'
                assert param.param_type == 'token'
                assert param.value_token_code is not None, "Verification status code is null"
                
            print(f"✓ Found {len(search_params)} verification-status search parameters")
    
    async def test_allergy_criticality_extraction(self, storage_engine):
        """Test that AllergyIntolerance criticality is properly extracted as search parameters"""
        
        # Get a sample allergy with criticality
        search_result = await storage_engine.search_resources('AllergyIntolerance', {}, {'_count': ['5']})
        
        criticality_allergy = None
        for entry in search_result['entry']:
            allergy = entry['resource']
            if 'criticality' in allergy:
                criticality_allergy = allergy
                break
        
        assert criticality_allergy is not None, "No allergies with criticality found"
        allergy_id = criticality_allergy['id']
        
        # Check database for extracted criticality search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_token_code 
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :allergy_id 
                AND r.resource_type = 'AllergyIntolerance'
                AND param_name = 'criticality'
            """)
            result = await session.execute(query, {'allergy_id': allergy_id})
            search_params = result.fetchall()
            
            # Should have criticality search parameters extracted
            assert len(search_params) > 0, f"No criticality search parameters found for allergy {allergy_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'criticality'
                assert param.param_type == 'token'
                assert param.value_token_code is not None, "Criticality code is null"
                
            print(f"✓ Found {len(search_params)} criticality search parameters")
    
    async def test_search_by_confirmed_status(self, storage_engine):
        """Test searching allergies by confirmed verification status"""
        
        # Test search by confirmed status
        search_params = {
            'verification-status': ['confirmed']
        }
        result = await storage_engine.search_resources('AllergyIntolerance', search_params, {})
        
        assert result['total'] > 0, "No allergies found with confirmed verification status"
        
        # Validate all returned allergies are confirmed
        for entry in result['entry']:
            allergy = entry['resource']
            verification_status = allergy.get('verificationStatus', {})
            coding = verification_status.get('coding', [])
            
            confirmed = False
            for code in coding:
                if code.get('code') == 'confirmed':
                    confirmed = True
                    break
            
            assert confirmed, f"Allergy {allergy['id']} not confirmed but returned in confirmed search"
        
        print(f"✓ Successfully searched for confirmed allergies: {result['total']} found")
    
    async def test_search_by_unconfirmed_status(self, storage_engine):
        """Test searching allergies by unconfirmed verification status"""
        
        # Test search by unconfirmed status
        search_params = {
            'verification-status': ['unconfirmed']
        }
        result = await storage_engine.search_resources('AllergyIntolerance', search_params, {})
        
        # May not find unconfirmed allergies in sample data, but search should work
        print(f"✓ Unconfirmed allergies search executed: {result['total']} found")
        
        # If found, validate they are actually unconfirmed
        for entry in result['entry']:
            allergy = entry['resource']
            verification_status = allergy.get('verificationStatus', {})
            coding = verification_status.get('coding', [])
            
            unconfirmed = False
            for code in coding:
                if code.get('code') == 'unconfirmed':
                    unconfirmed = True
                    break
            
            assert unconfirmed, f"Allergy {allergy['id']} not unconfirmed but returned in unconfirmed search"
    
    async def test_search_by_high_criticality(self, storage_engine):
        """Test searching allergies by high criticality"""
        
        # Test search by high criticality
        search_params = {
            'criticality': ['high']
        }
        result = await storage_engine.search_resources('AllergyIntolerance', search_params, {})
        
        print(f"✓ High criticality allergies search executed: {result['total']} found")
        
        # Validate all returned allergies have high criticality
        for entry in result['entry']:
            allergy = entry['resource']
            criticality = allergy.get('criticality')
            
            if criticality is not None:
                assert criticality == 'high', f"Allergy {allergy['id']} criticality {criticality} != high"
    
    async def test_search_by_low_criticality(self, storage_engine):
        """Test searching allergies by low criticality"""
        
        # Test search by low criticality
        search_params = {
            'criticality': ['low']
        }
        result = await storage_engine.search_resources('AllergyIntolerance', search_params, {})
        
        print(f"✓ Low criticality allergies search executed: {result['total']} found")
        
        # Validate all returned allergies have low criticality
        for entry in result['entry']:
            allergy = entry['resource']
            criticality = allergy.get('criticality')
            
            if criticality is not None:
                assert criticality == 'low', f"Allergy {allergy['id']} criticality {criticality} != low"
    
    async def test_combined_search_confirmed_high_criticality(self, storage_engine):
        """Test combined search for confirmed allergies with high criticality"""
        
        # Test combined search
        search_params = {
            'verification-status': ['confirmed'],
            'criticality': ['high']
        }
        result = await storage_engine.search_resources('AllergyIntolerance', search_params, {})
        
        print(f"✓ Combined search (confirmed + high criticality): {result['total']} found")
        
        # Validate all returned allergies meet both criteria
        for entry in result['entry']:
            allergy = entry['resource']
            
            # Check verification status
            verification_status = allergy.get('verificationStatus', {})
            coding = verification_status.get('coding', [])
            confirmed = any(code.get('code') == 'confirmed' for code in coding)
            
            # Check criticality
            criticality = allergy.get('criticality')
            high_criticality = criticality == 'high'
            
            assert confirmed, f"Allergy {allergy['id']} not confirmed in combined search"
            assert high_criticality, f"Allergy {allergy['id']} not high criticality in combined search"
    
    async def test_verification_status_search_parameter_coverage(self, storage_engine):
        """Test that verification-status search parameter is properly defined for AllergyIntolerance resource"""
        
        # Check search parameter definitions
        definitions = storage_engine._get_search_parameter_definitions()
        
        assert 'AllergyIntolerance' in definitions, "AllergyIntolerance not in search parameter definitions"
        allergy_params = definitions['AllergyIntolerance']
        
        assert 'verification-status' in allergy_params, "verification-status parameter not defined for AllergyIntolerance"
        verification_param = allergy_params['verification-status']
        
        assert verification_param['type'] == 'token', "verification-status parameter should be type 'token'"
        
        print("✓ AllergyIntolerance verification-status search parameter properly defined")
    
    async def test_criticality_search_parameter_coverage(self, storage_engine):
        """Test that criticality search parameter is properly defined for AllergyIntolerance resource"""
        
        # Check search parameter definitions
        definitions = storage_engine._get_search_parameter_definitions()
        
        assert 'AllergyIntolerance' in definitions, "AllergyIntolerance not in search parameter definitions"
        allergy_params = definitions['AllergyIntolerance']
        
        assert 'criticality' in allergy_params, "criticality parameter not defined for AllergyIntolerance"
        criticality_param = allergy_params['criticality']
        
        assert criticality_param['type'] == 'token', "criticality parameter should be type 'token'"
        
        print("✓ AllergyIntolerance criticality search parameter properly defined")
    
    async def test_sql_validation_verification_criticality_extraction(self):
        """SQL validation that verification-status and criticality search parameters are extracted correctly"""
        
        async with get_async_session() as session:
            from sqlalchemy import text
            
            # Check verification-status extraction
            verification_query = text("""
                SELECT 
                    COUNT(*) as total_allergies,
                    COUNT(DISTINCT sp.resource_id) as allergies_with_verification,
                    COUNT(sp.id) as total_verification_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'verification-status'
                WHERE r.resource_type = 'AllergyIntolerance'
                AND r.deleted = false
            """)
            result = await session.execute(verification_query)
            verification_stats = result.fetchone()
            
            assert verification_stats.total_allergies > 0, "No allergies in database"
            assert verification_stats.allergies_with_verification > 0, "No allergies have verification-status search parameters"
            
            # Check criticality extraction
            criticality_query = text("""
                SELECT 
                    COUNT(DISTINCT sp.resource_id) as allergies_with_criticality,
                    COUNT(sp.id) as total_criticality_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'criticality'
                WHERE r.resource_type = 'AllergyIntolerance'
                AND r.deleted = false
            """)
            result = await session.execute(criticality_query)
            criticality_stats = result.fetchone()
            
            print(f"✓ SQL Validation: {verification_stats.total_allergies} allergies")
            print(f"  {verification_stats.allergies_with_verification} with verification-status params")
            print(f"  {criticality_stats.allergies_with_criticality} with criticality params")
            
            # Check value distribution
            values_query = text("""
                SELECT 
                    param_name,
                    value_token_code,
                    COUNT(*) as count
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'AllergyIntolerance'
                AND r.deleted = false
                AND param_name IN ('verification-status', 'criticality')
                GROUP BY param_name, value_token_code
                ORDER BY param_name, count DESC
            """)
            result = await session.execute(values_query)
            values = result.fetchall()
            
            print("✓ Value distribution:")
            for value in values:
                print(f"  {value.param_name}: {value.value_token_code} ({value.count})")
            
            # Validate expected values exist
            verification_codes = [v.value_token_code for v in values if v.param_name == 'verification-status']
            criticality_codes = [v.value_token_code for v in values if v.param_name == 'criticality']
            
            # Should have at least 'confirmed' for verification status
            assert 'confirmed' in verification_codes, "No 'confirmed' verification status found"
            
            # Should have criticality values if any allergies have criticality
            if criticality_stats.allergies_with_criticality > 0:
                assert len(criticality_codes) > 0, "No criticality codes found despite having criticality params"


if __name__ == "__main__":
    # Run individual test methods for debugging
    async def run_test():
        test_instance = TestAllergyIntoleranceVerificationStatusSearch()
        
        async with get_async_session() as session:
            storage = FHIRStorageEngine(session)
            
            print("Running AllergyIntolerance Verification Status and Criticality Search Tests...")
            
            try:
                await test_instance.test_allergy_verification_status_extraction(storage)
                await test_instance.test_allergy_criticality_extraction(storage)
                await test_instance.test_search_by_confirmed_status(storage)
                await test_instance.test_search_by_unconfirmed_status(storage)
                await test_instance.test_search_by_high_criticality(storage)
                await test_instance.test_search_by_low_criticality(storage)
                await test_instance.test_combined_search_confirmed_high_criticality(storage)
                await test_instance.test_verification_status_search_parameter_coverage(storage)
                await test_instance.test_criticality_search_parameter_coverage(storage)
                await test_instance.test_sql_validation_verification_criticality_extraction()
                
                print("\n✅ All AllergyIntolerance Verification Status and Criticality Search tests PASSED")
                
            except Exception as e:
                print(f"\n❌ Test FAILED: {e}")
                raise
    
    # Run if called directly
    asyncio.run(run_test())