#!/usr/bin/env python3
"""
Test Harness for Performer/Practitioner References Search (CRIT-002-Multiple)

This test validates the implementation of performer/practitioner reference search parameters
across multiple resource types which is critical for patient safety - enables searching 
by attending physician, ordering provider, surgeon, radiologist across all resources.

FHIR R4 Specification:
Resources Affected: Encounter, Observation, Procedure, DiagnosticReport, ImagingStudy, Immunization

- Parameter: performer (for most resources)
- Parameter: participant (for Encounter)
- Type: reference
- Description: Who performed the action/service
- Paths vary by resource

Test Cases:
1. Encounter participant/practitioner references
2. Observation performer references
3. Procedure performer references
4. DiagnosticReport performer references
5. ImagingStudy performer references
6. Immunization performer references
7. Cross-resource performer searches
8. Validation of extracted search parameters
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


class TestPerformerPractitionerReferences:
    """Test suite for performer/practitioner reference search parameters (CRIT-002-Multiple)"""
    
    @pytest.fixture
    async def storage_engine(self):
        """Get storage engine with database session"""
        async with get_async_session() as session:
            yield FHIRStorageEngine(session)
    
    async def test_encounter_participant_extraction(self, storage_engine):
        """Test that Encounter participant references are properly extracted as search parameters"""
        
        # Get encounters with participants
        search_result = await storage_engine.search_resources('Encounter', {}, {'_count': ['10']})
        assert search_result['total'] > 0, "No encounters found in database"
        
        # Find encounter with participant
        participant_encounter = None
        for entry in search_result['entry']:
            encounter = entry['resource']
            if 'participant' in encounter and len(encounter['participant']) > 0:
                participant_encounter = encounter
                break
        
        assert participant_encounter is not None, "No encounters with participants found"
        encounter_id = participant_encounter['id']
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_string
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :encounter_id 
                AND r.resource_type = 'Encounter'
                AND param_name IN ('participant', 'practitioner')
            """)
            result = await session.execute(query, {'encounter_id': encounter_id})
            search_params = result.fetchall()
            
            # Should have participant/practitioner search parameters extracted
            assert len(search_params) > 0, f"No participant/practitioner search parameters found for encounter {encounter_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name in ['participant', 'practitioner']
                assert param.param_type == 'reference'
                assert param.value_string is not None, "Participant reference is null"
                
            print(f"✓ Found {len(search_params)} participant/practitioner search parameters for Encounter")
    
    async def test_observation_performer_extraction(self, storage_engine):
        """Test that Observation performer references are properly extracted as search parameters"""
        
        # Get observations with performers
        search_result = await storage_engine.search_resources('Observation', {}, {'_count': ['10']})
        assert search_result['total'] > 0, "No observations found in database"
        
        # Find observation with performer
        performer_observation = None
        for entry in search_result['entry']:
            observation = entry['resource']
            if 'performer' in observation and len(observation['performer']) > 0:
                performer_observation = observation
                break
        
        if performer_observation is None:
            print("ℹ️ No observations with performers found - skipping test")
            return
        
        observation_id = performer_observation['id']
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_string
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :observation_id 
                AND r.resource_type = 'Observation'
                AND param_name = 'performer'
            """)
            result = await session.execute(query, {'observation_id': observation_id})
            search_params = result.fetchall()
            
            # Should have performer search parameters extracted
            assert len(search_params) > 0, f"No performer search parameters found for observation {observation_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'performer'
                assert param.param_type == 'reference'
                assert param.value_string is not None, "Performer reference is null"
                
            print(f"✓ Found {len(search_params)} performer search parameters for Observation")
    
    async def test_procedure_performer_extraction(self, storage_engine):
        """Test that Procedure performer references are properly extracted as search parameters"""
        
        # Get procedures with performers
        search_result = await storage_engine.search_resources('Procedure', {}, {'_count': ['10']})
        assert search_result['total'] > 0, "No procedures found in database"
        
        # Find procedure with performer
        performer_procedure = None
        for entry in search_result['entry']:
            procedure = entry['resource']
            if 'performer' in procedure and len(procedure['performer']) > 0:
                performer_procedure = procedure
                break
        
        if performer_procedure is None:
            print("ℹ️ No procedures with performers found - skipping test")
            return
        
        procedure_id = performer_procedure['id']
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_string
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :procedure_id 
                AND r.resource_type = 'Procedure'
                AND param_name = 'performer'
            """)
            result = await session.execute(query, {'procedure_id': procedure_id})
            search_params = result.fetchall()
            
            # Should have performer search parameters extracted
            assert len(search_params) > 0, f"No performer search parameters found for procedure {procedure_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'performer'
                assert param.param_type == 'reference'
                assert param.value_string is not None, "Performer reference is null"
                
            print(f"✓ Found {len(search_params)} performer search parameters for Procedure")
    
    async def test_diagnostic_report_performer_extraction(self, storage_engine):
        """Test that DiagnosticReport performer references are properly extracted as search parameters"""
        
        # Get diagnostic reports with performers
        search_result = await storage_engine.search_resources('DiagnosticReport', {}, {'_count': ['10']})
        assert search_result['total'] > 0, "No diagnostic reports found in database"
        
        # Find diagnostic report with performer
        performer_report = None
        for entry in search_result['entry']:
            report = entry['resource']
            if 'performer' in report and len(report['performer']) > 0:
                performer_report = report
                break
        
        if performer_report is None:
            print("ℹ️ No diagnostic reports with performers found - skipping test")
            return
        
        report_id = performer_report['id']
        
        # Check database for extracted search parameters
        async with get_async_session() as session:
            from sqlalchemy import text
            query = text("""
                SELECT param_name, param_type, value_string
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :report_id 
                AND r.resource_type = 'DiagnosticReport'
                AND param_name = 'performer'
            """)
            result = await session.execute(query, {'report_id': report_id})
            search_params = result.fetchall()
            
            # Should have performer search parameters extracted
            assert len(search_params) > 0, f"No performer search parameters found for diagnostic report {report_id}"
            
            # Validate parameter structure
            for param in search_params:
                assert param.param_name == 'performer'
                assert param.param_type == 'reference'
                assert param.value_string is not None, "Performer reference is null"
                
            print(f"✓ Found {len(search_params)} performer search parameters for DiagnosticReport")
    
    async def test_search_by_practitioner_reference(self, storage_engine):
        """Test searching resources by practitioner reference"""
        
        # Get a practitioner ID from encounters
        search_result = await storage_engine.search_resources('Encounter', {}, {'_count': ['10']})
        
        practitioner_ref = None
        for entry in search_result['entry']:
            encounter = entry['resource']
            if 'participant' in encounter:
                for participant in encounter['participant']:
                    if 'individual' in participant and 'reference' in participant['individual']:
                        ref = participant['individual']['reference']
                        if 'Practitioner/' in ref:
                            practitioner_ref = ref
                            break
                if practitioner_ref:
                    break
        
        if practitioner_ref is None:
            print("ℹ️ No practitioner references found in encounters - skipping test")
            return
        
        # Test search by practitioner reference across multiple resource types
        resource_types = ['Encounter', 'Observation', 'Procedure', 'DiagnosticReport']
        
        for resource_type in resource_types:
            search_params = {
                'practitioner': [practitioner_ref]
            }
            result = await storage_engine.search_resources(resource_type, search_params, {})
            
            print(f"✓ Practitioner search on {resource_type}: {result['total']} found")
            
            # Validate that returned resources reference the practitioner
            for entry in result['entry']:
                resource = entry['resource']
                found_practitioner = False
                
                # Check different fields depending on resource type
                if resource_type == 'Encounter' and 'participant' in resource:
                    for participant in resource['participant']:
                        if 'individual' in participant and participant['individual'].get('reference') == practitioner_ref:
                            found_practitioner = True
                            break
                elif 'performer' in resource:
                    for performer in resource['performer']:
                        if performer.get('reference') == practitioner_ref:
                            found_practitioner = True
                            break
                
                if result['total'] > 0:  # Only validate if we found results
                    assert found_practitioner, f"{resource_type} {resource['id']} doesn't reference practitioner {practitioner_ref}"
    
    async def test_cross_resource_performer_search(self, storage_engine):
        """Test that performer search works across multiple resource types"""
        
        # Get all practitioner IDs
        practitioner_result = await storage_engine.search_resources('Practitioner', {}, {'_count': ['5']})
        
        if practitioner_result['total'] == 0:
            print("ℹ️ No practitioners found - skipping cross-resource test")
            return
        
        practitioner_id = practitioner_result['entry'][0]['resource']['id']
        practitioner_ref = f"Practitioner/{practitioner_id}"
        
        # Search across all resource types that should have performer references
        resource_types = ['Encounter', 'Observation', 'Procedure', 'DiagnosticReport', 'ImagingStudy', 'Immunization']
        total_found = 0
        
        for resource_type in resource_types:
            search_params = {
                'performer': [practitioner_ref]
            }
            result = await storage_engine.search_resources(resource_type, search_params, {})
            total_found += result['total']
            print(f"  {resource_type}: {result['total']} resources")
        
        print(f"✓ Cross-resource performer search: {total_found} total resources found")
    
    async def test_performer_search_parameter_coverage(self, storage_engine):
        """Test that performer search parameters are properly defined for all applicable resources"""
        
        # Check search parameter definitions
        definitions = storage_engine._get_search_parameter_definitions()
        
        applicable_resources = ['Encounter', 'Observation', 'Procedure', 'DiagnosticReport', 'ImagingStudy', 'Immunization']
        
        for resource_type in applicable_resources:
            assert resource_type in definitions, f"{resource_type} not in search parameter definitions"
            resource_params = definitions[resource_type]
            
            # Different resources may use different parameter names
            has_performer_param = (
                'performer' in resource_params or 
                'participant' in resource_params or
                'practitioner' in resource_params
            )
            
            assert has_performer_param, f"No performer/practitioner parameter defined for {resource_type}"
        
        print("✓ All applicable resources have performer/practitioner search parameters defined")
    
    async def test_sql_validation_performer_extraction(self):
        """SQL validation that performer/practitioner search parameters are extracted correctly"""
        
        async with get_async_session() as session:
            from sqlalchemy import text
            
            # Check performer/practitioner extraction across all resource types
            query = text("""
                SELECT 
                    r.resource_type,
                    COUNT(DISTINCT r.id) as total_resources,
                    COUNT(DISTINCT sp.resource_id) as resources_with_performers,
                    COUNT(sp.id) as total_performer_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name IN ('performer', 'participant', 'practitioner')
                WHERE r.resource_type IN ('Encounter', 'Observation', 'Procedure', 'DiagnosticReport', 'ImagingStudy', 'Immunization')
                AND r.deleted = false
                GROUP BY r.resource_type
                ORDER BY r.resource_type
            """)
            result = await session.execute(query)
            stats = result.fetchall()
            
            print("✓ SQL Validation - Performer/Practitioner extraction by resource type:")
            total_resources = 0
            total_with_performers = 0
            total_params = 0
            
            for stat in stats:
                total_resources += stat.total_resources
                total_with_performers += stat.resources_with_performers
                total_params += stat.total_performer_params
                
                coverage = (stat.resources_with_performers / stat.total_resources * 100) if stat.total_resources > 0 else 0
                print(f"  {stat.resource_type}: {stat.total_resources} total, "
                      f"{stat.resources_with_performers} with performers ({coverage:.1f}%), "
                      f"{stat.total_performer_params} params")
            
            print(f"✓ Overall: {total_resources} resources, {total_with_performers} with performers, {total_params} total params")
            
            # Check reference format validation
            reference_query = text("""
                SELECT 
                    value_string,
                    COUNT(*) as count
                FROM fhir.search_parameters 
                WHERE param_name IN ('performer', 'participant', 'practitioner')
                AND param_type = 'reference'
                AND value_string IS NOT NULL
                GROUP BY value_string
                ORDER BY count DESC
                LIMIT 10
            """)
            result = await session.execute(reference_query)
            references = result.fetchall()
            
            print("✓ Top performer references:")
            for ref in references:
                print(f"  {ref.value_string}: {ref.count} occurrences")
            
            # Validate reference formats
            for ref in references:
                ref_value = ref.value_string
                assert ('Practitioner/' in ref_value or 
                       'Organization/' in ref_value or 
                       'urn:uuid:' in ref_value), f"Invalid reference format: {ref_value}"


if __name__ == "__main__":
    # Run individual test methods for debugging
    async def run_test():
        test_instance = TestPerformerPractitionerReferences()
        
        async with get_async_session() as session:
            storage = FHIRStorageEngine(session)
            
            print("Running Performer/Practitioner References Search Tests...")
            
            try:
                await test_instance.test_encounter_participant_extraction(storage)
                await test_instance.test_observation_performer_extraction(storage)
                await test_instance.test_procedure_performer_extraction(storage)
                await test_instance.test_diagnostic_report_performer_extraction(storage)
                await test_instance.test_search_by_practitioner_reference(storage)
                await test_instance.test_cross_resource_performer_search(storage)
                await test_instance.test_performer_search_parameter_coverage(storage)
                await test_instance.test_sql_validation_performer_extraction()
                
                print("\n✅ All Performer/Practitioner References Search tests PASSED")
                
            except Exception as e:
                print(f"\n❌ Test FAILED: {e}")
                raise
    
    # Run if called directly
    asyncio.run(run_test())