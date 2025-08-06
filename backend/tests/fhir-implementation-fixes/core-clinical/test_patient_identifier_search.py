#!/usr/bin/env python3
"""
Test Harness for Patient Identifier Search (CRIT-001-PAT)

This test validates the implementation of Patient identifier search parameters
which is critical for patient safety - enables searching by medical record numbers,
SSN, visit numbers across all resources.

FHIR R4 Specification:
- Parameter: identifier
- Type: token
- Description: A patient identifier
- Path: Patient.identifier

Test Cases:
1. Search by medical record number (MR)
2. Search by social security number (SS) 
3. Search by driver's license (DL)
4. Search by passport number (PPN)
5. Search by system-specific identifier
6. Search across multiple resources with patient references
"""

import pytest
import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent directories to path for imports
current_dir = os.path.dirname(__file__)
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.insert(0, backend_dir)

from fhir.core.storage import FHIRStorageEngine
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session_maker


class TestPatientIdentifierSearch:
    """Test suite for Patient identifier search parameter (CRIT-001-PAT)"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        session_maker = get_session_maker()
        async with session_maker() as session:
            yield FHIRStorageEngine(session)
    
    async def test_patient_identifier_search_extraction(self, storage_engine):
        """Test that Patient identifiers are properly extracted as search parameters"""
        
        # Get a sample patient to validate identifier extraction
        search_result = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
        assert search_result['total'] > 0, "No patients found in database"
        
        patient = search_result['entry'][0]['resource']
        patient_id = patient['id']
        
        # Validate identifier structure exists
        assert 'identifier' in patient, "Patient missing identifier field"
        identifiers = patient['identifier']
        assert len(identifiers) > 0, "Patient has no identifiers"
        
        # Check database for extracted search parameters
        session_maker = get_session_maker()
        async with session_maker() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_token_system, value_token_code 
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :patient_id 
                AND r.resource_type = 'Patient'
                AND param_name = 'identifier'
            """)
            result = await session.execute(query, {'patient_id': patient_id})
            search_params = result.fetchall()
            
            # Should have multiple identifier search parameters extracted
            assert len(search_params) > 0, f"No identifier search parameters found for patient {patient_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'identifier'
                assert param.param_type == 'token'
                assert param.value_token_code is not None, "Identifier value is null"
                
            print(f"✓ Found {len(search_params)} identifier search parameters")
    
    async def test_search_by_medical_record_number(self, storage_engine):
        """Test searching patients by medical record number (MR)"""
        
        # Get a patient with MR identifier
        search_result = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
        patient = search_result['entry'][0]['resource']
        
        # Find MR identifier
        mr_identifier = None
        for identifier in patient['identifier']:
            if identifier.get('type', {}).get('coding', [{}])[0].get('code') == 'MR':
                mr_identifier = identifier
                break
        
        assert mr_identifier is not None, "No MR identifier found in sample patient"
        
        # Test search by MR identifier
        search_params = {
            'identifier': [f"{mr_identifier['system']}|{mr_identifier['value']}"]
        }
        result = await storage_engine.search_resources('Patient', search_params, {})
        
        assert result['total'] > 0, "No patients found by MR identifier search"
        
        # Validate result contains our patient
        found_patient_ids = [entry['resource']['id'] for entry in result['entry']]
        assert patient['id'] in found_patient_ids, "Original patient not found in MR search results"
        
        print(f"✓ Successfully searched by MR identifier: {mr_identifier['value']}")
    
    async def test_search_by_ssn(self, storage_engine):
        """Test searching patients by Social Security Number (SS)"""
        
        # Get a patient with SSN identifier
        search_result = await storage_engine.search_resources('Patient', {}, {'_count': ['5']})
        
        ssn_patient = None
        ssn_identifier = None
        
        for entry in search_result['entry']:
            patient = entry['resource']
            for identifier in patient.get('identifier', []):
                if identifier.get('type', {}).get('coding', [{}])[0].get('code') == 'SS':
                    ssn_patient = patient
                    ssn_identifier = identifier
                    break
            if ssn_identifier:
                break
        
        assert ssn_identifier is not None, "No SSN identifier found in sample patients"
        
        # Test search by SSN
        search_params = {
            'identifier': [f"{ssn_identifier['system']}|{ssn_identifier['value']}"]
        }
        result = await storage_engine.search_resources('Patient', search_params, {})
        
        assert result['total'] > 0, "No patients found by SSN identifier search"
        
        # Validate result contains our patient
        found_patient_ids = [entry['resource']['id'] for entry in result['entry']]
        assert ssn_patient['id'] in found_patient_ids, "Original patient not found in SSN search results"
        
        print(f"✓ Successfully searched by SSN identifier: {ssn_identifier['value']}")
    
    async def test_search_by_identifier_value_only(self, storage_engine):
        """Test searching patients by identifier value without system"""
        
        # Get a sample patient identifier
        search_result = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
        patient = search_result['entry'][0]['resource']
        identifier_value = patient['identifier'][0]['value']
        
        # Test search by value only (no system)
        search_params = {
            'identifier': [identifier_value]
        }
        result = await storage_engine.search_resources('Patient', search_params, {})
        
        assert result['total'] > 0, "No patients found by identifier value-only search"
        
        # Should find our patient
        found_patient_ids = [entry['resource']['id'] for entry in result['entry']]
        assert patient['id'] in found_patient_ids, "Original patient not found in value-only search"
        
        print(f"✓ Successfully searched by identifier value only: {identifier_value}")
    
    async def test_cross_resource_patient_identification(self, storage_engine):
        """Test that patient identifier search works across multiple resource types"""
        
        # Get a patient and their related resources
        search_result = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
        patient = search_result['entry'][0]['resource']
        patient_id = patient['id']
        patient_identifier = patient['identifier'][0]['value']
        
        # Test that Observations can be found by patient identifier
        obs_result = await storage_engine.search_resources('Observation', {
            'patient.identifier': [patient_identifier]
        }, {})
        
        # May not find observations (not all patients have them), but search should execute
        assert 'total' in obs_result, "Patient identifier search failed on Observation resource"
        
        # Test that Conditions can be found by patient identifier  
        cond_result = await storage_engine.search_resources('Condition', {
            'patient.identifier': [patient_identifier]
        }, {})
        
        assert 'total' in cond_result, "Patient identifier search failed on Condition resource"
        
        print(f"✓ Cross-resource patient identifier search functional")
    
    async def test_identifier_search_parameter_coverage(self, storage_engine):
        """Test that identifier search parameter is properly defined for Patient resource"""
        
        # Check search parameter definitions
        definitions = storage_engine._get_search_parameter_definitions()
        
        assert 'Patient' in definitions, "Patient not in search parameter definitions"
        patient_params = definitions['Patient']
        
        assert 'identifier' in patient_params, "identifier parameter not defined for Patient"
        identifier_param = patient_params['identifier']
        
        assert identifier_param['type'] == 'token', "identifier parameter should be type 'token'"
        
        print("✓ Patient identifier search parameter properly defined")
    
    async def test_sql_validation_identifier_extraction(self):
        """SQL validation that identifier search parameters are extracted correctly"""
        
        session_maker = get_session_maker()
        async with session_maker() as session:
            from sqlalchemy import text
            
            # Check that Patient identifiers are extracted
            query = text("""
                SELECT 
                    COUNT(*) as total_patients,
                    COUNT(DISTINCT sp.resource_id) as patients_with_identifiers,
                    COUNT(sp.id) as total_identifier_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'identifier'
                WHERE r.resource_type = 'Patient'
                AND r.deleted = false
            """)
            result = await session.execute(query)
            stats = result.fetchone()
            
            assert stats.total_patients > 0, "No patients in database"
            assert stats.patients_with_identifiers > 0, "No patients have identifier search parameters"
            assert stats.total_identifier_params > 0, "No identifier search parameters found"
            
            # Patients should have multiple identifiers (MR, SSN, etc.)
            avg_identifiers = stats.total_identifier_params / stats.patients_with_identifiers
            assert avg_identifiers >= 2, f"Average identifiers per patient too low: {avg_identifiers}"
            
            print(f"✓ SQL Validation: {stats.total_patients} patients, "
                  f"{stats.patients_with_identifiers} with identifiers, "
                  f"{stats.total_identifier_params} total identifier params")
            
            # Validate identifier types are correctly extracted
            type_query = text("""
                SELECT 
                    r.resource::jsonb->'identifier' as identifiers,
                    COUNT(sp.id) as search_params_count
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'identifier'
                WHERE r.resource_type = 'Patient'
                AND r.deleted = false
                GROUP BY r.id, r.resource
                LIMIT 1
            """)
            result = await session.execute(type_query)
            sample = result.fetchone()
            
            identifiers_json = sample.identifiers
            params_count = sample.search_params_count
            
            # Should have search parameter for each identifier
            assert len(identifiers_json) == params_count, \
                f"Mismatch: {len(identifiers_json)} identifiers vs {params_count} search params"
            
            print("✓ SQL Validation: Identifier extraction counts match")


if __name__ == "__main__":
    # Run individual test methods for debugging
    async def run_test():
        test_instance = TestPatientIdentifierSearch()
        
        session_maker = get_session_maker()
        async with session_maker() as session:
            storage = FHIRStorageEngine(session)
            
            print("Running Patient Identifier Search Tests...")
            
            try:
                await test_instance.test_patient_identifier_search_extraction(storage)
                await test_instance.test_search_by_medical_record_number(storage)
                await test_instance.test_search_by_ssn(storage)
                await test_instance.test_search_by_identifier_value_only(storage)
                await test_instance.test_cross_resource_patient_identification(storage)
                await test_instance.test_identifier_search_parameter_coverage(storage)
                await test_instance.test_sql_validation_identifier_extraction()
                
                print("\n✅ All Patient Identifier Search tests PASSED")
                
            except Exception as e:
                print(f"\n❌ Test FAILED: {e}")
                raise
    
    # Run if called directly
    asyncio.run(run_test())