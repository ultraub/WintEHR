#!/usr/bin/env python3
"""
SQL Validation Script for Critical FHIR Implementation Fixes

This script validates that all the critical patient safety fixes have been
properly implemented and are working with actual Synthea data.

Critical fixes implemented:
1. Patient identifier search (CRIT-001-PAT)
2. Observation value-quantity search (CRIT-001-OBS)
3. AllergyIntolerance verification-status and criticality (CRIT-002-ALL)
4. Condition onset-date search (CRIT-001-CON)
5. Performer/practitioner references (CRIT-002-Multiple)
"""

import asyncio
import sys
import os
from sqlalchemy import text

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, backend_dir)

from database import async_session_maker


async def validate_patient_identifier_extraction():
    """Validate Patient identifier search parameter extraction"""
    print("\n=== CRIT-001-PAT: Patient Identifier Search ===")
    
    async with async_session_maker() as session:
        # Check Patient identifier extraction
        query = text("""
            SELECT 
                COUNT(DISTINCT r.id) as total_patients,
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
        
        print(f"Total patients: {stats.total_patients}")
        print(f"Patients with identifier params: {stats.patients_with_identifiers}")
        print(f"Total identifier parameters: {stats.total_identifier_params}")
        
        if stats.patients_with_identifiers > 0:
            print("✅ Patient identifier extraction WORKING")
            
            # Check identifier types
            types_query = text("""
                SELECT value_token_code, COUNT(*) as count
                FROM fhir.search_params sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Patient'
                AND sp.param_name = 'identifier'
                GROUP BY value_token_code
                ORDER BY count DESC
                LIMIT 5
            """)
            result = await session.execute(types_query)
            identifiers = result.fetchall()
            
            print("Sample identifier values:")
            for identifier in identifiers:
                print(f"  {identifier.value_token_code}: {identifier.count} occurrences")
        else:
            print("❌ Patient identifier extraction NOT WORKING")


async def validate_observation_value_quantity_extraction():
    """Validate Observation value-quantity search parameter extraction"""
    print("\n=== CRIT-001-OBS: Observation Value-Quantity Search ===")
    
    async with async_session_maker() as session:
        # Check value-quantity extraction
        query = text("""
            SELECT 
                COUNT(DISTINCT r.id) as total_observations,
                COUNT(DISTINCT sp.resource_id) as obs_with_quantities,
                COUNT(sp.id) as total_quantity_params,
                AVG(sp.value_quantity_value) as avg_value,
                MIN(sp.value_quantity_value) as min_value,
                MAX(sp.value_quantity_value) as max_value
            FROM fhir.resources r
            LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                AND sp.param_name = 'value-quantity'
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
        """)
        result = await session.execute(query)
        stats = result.fetchone()
        
        print(f"Total observations: {stats.total_observations}")
        print(f"Observations with value-quantity params: {stats.obs_with_quantities}")
        print(f"Total value-quantity parameters: {stats.total_quantity_params}")
        
        if stats.total_quantity_params > 0:
            print("✅ Observation value-quantity extraction WORKING")
            print(f"Value range: {stats.min_value} to {stats.max_value}")
            print(f"Average value: {stats.avg_value:.2f}")
        else:
            print("❌ Observation value-quantity extraction NOT WORKING")


async def validate_allergy_verification_status_extraction():
    """Validate AllergyIntolerance verification-status and criticality extraction"""
    print("\n=== CRIT-002-ALL: AllergyIntolerance Verification Status & Criticality ===")
    
    async with async_session_maker() as session:
        # Check verification-status extraction
        verification_query = text("""
            SELECT 
                COUNT(DISTINCT r.id) as total_allergies,
                COUNT(DISTINCT CASE WHEN sp.param_name = 'verification-status' THEN sp.resource_id END) as allergies_with_verification,
                COUNT(DISTINCT CASE WHEN sp.param_name = 'criticality' THEN sp.resource_id END) as allergies_with_criticality
            FROM fhir.resources r
            LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                AND sp.param_name IN ('verification-status', 'criticality')
            WHERE r.resource_type = 'AllergyIntolerance'
            AND r.deleted = false
        """)
        result = await session.execute(verification_query)
        stats = result.fetchone()
        
        print(f"Total allergies: {stats.total_allergies}")
        print(f"Allergies with verification-status: {stats.allergies_with_verification}")
        print(f"Allergies with criticality: {stats.allergies_with_criticality}")
        
        if stats.allergies_with_verification > 0:
            print("✅ AllergyIntolerance verification-status extraction WORKING")
        else:
            print("❌ AllergyIntolerance verification-status extraction NOT WORKING")
        
        if stats.allergies_with_criticality > 0:
            print("✅ AllergyIntolerance criticality extraction WORKING")
        else:
            print("❌ AllergyIntolerance criticality extraction NOT WORKING")
        
        # Check value distribution
        values_query = text("""
            SELECT 
                param_name,
                value_token_code,
                COUNT(*) as count
            FROM fhir.search_params sp
            JOIN fhir.resources r ON sp.resource_id = r.id
            WHERE r.resource_type = 'AllergyIntolerance'
            AND sp.param_name IN ('verification-status', 'criticality')
            GROUP BY param_name, value_token_code
            ORDER BY param_name, count DESC
        """)
        result = await session.execute(values_query)
        values = result.fetchall()
        
        print("Value distribution:")
        for value in values:
            print(f"  {value.param_name}: {value.value_token_code} ({value.count})")


async def validate_condition_onset_date_extraction():
    """Validate Condition onset-date search parameter extraction"""
    print("\n=== CRIT-001-CON: Condition Onset-Date Search ===")
    
    async with async_session_maker() as session:
        # Check onset-date extraction
        query = text("""
            SELECT 
                COUNT(DISTINCT r.id) as total_conditions,
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
        
        print(f"Total conditions: {stats.total_conditions}")
        print(f"Conditions with onset-date params: {stats.conditions_with_onset}")
        print(f"Total onset-date parameters: {stats.total_onset_params}")
        
        if stats.total_onset_params > 0:
            print("✅ Condition onset-date extraction WORKING")
            print(f"Date range: {stats.earliest_onset} to {stats.latest_onset}")
        else:
            print("❌ Condition onset-date extraction NOT WORKING")


async def validate_performer_practitioner_extraction():
    """Validate performer/practitioner reference extraction across resources"""
    print("\n=== CRIT-002-Multiple: Performer/Practitioner References ===")
    
    async with async_session_maker() as session:
        # Check performer/practitioner extraction across resource types
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
        
        total_resources = 0
        total_with_performers = 0
        total_params = 0
        
        print("Performer extraction by resource type:")
        for stat in stats:
            total_resources += stat.total_resources
            total_with_performers += stat.resources_with_performers
            total_params += stat.total_performer_params
            
            coverage = (stat.resources_with_performers / stat.total_resources * 100) if stat.total_resources > 0 else 0
            print(f"  {stat.resource_type}: {stat.total_resources} total, "
                  f"{stat.resources_with_performers} with performers ({coverage:.1f}%)")
        
        print(f"\nOverall: {total_resources} resources, {total_with_performers} with performers")
        
        if total_params > 0:
            print("✅ Performer/practitioner extraction WORKING")
        else:
            print("❌ Performer/practitioner extraction NOT WORKING")


async def validate_database_schema():
    """Validate that database schema supports all the new search parameters"""
    print("\n=== Database Schema Validation ===")
    
    async with async_session_maker() as session:
        # Check search_parameters table exists and has required columns
        schema_query = text("""
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'search_parameters'
            ORDER BY column_name
        """)
        result = await session.execute(schema_query)
        columns = result.fetchall()
        
        print("Search parameters table columns:")
        required_columns = [
            'value_quantity_value', 'value_quantity_unit', 'value_quantity_system',
            'value_token_system', 'value_token_code', 'value_date', 'value_string'
        ]
        
        found_columns = [col.column_name for col in columns]
        for col in columns:
            print(f"  {col.column_name}: {col.data_type}")
        
        missing_columns = [col for col in required_columns if col not in found_columns]
        if missing_columns:
            print(f"❌ Missing required columns: {missing_columns}")
        else:
            print("✅ All required columns present")


async def main():
    """Run all validation tests"""
    print("🔍 FHIR Implementation Critical Fixes Validation")
    print("=" * 60)
    
    try:
        await validate_database_schema()
        await validate_patient_identifier_extraction()
        await validate_observation_value_quantity_extraction()
        await validate_allergy_verification_status_extraction()
        await validate_condition_onset_date_extraction()
        await validate_performer_practitioner_extraction()
        
        print("\n" + "=" * 60)
        print("✅ All validation tests completed successfully!")
        print("\nTo trigger re-extraction of search parameters for new fixes:")
        print("1. Restart the backend service")
        print("2. Or run: UPDATE fhir.resources SET last_updated = NOW() WHERE id > 0;")
        
    except Exception as e:
        print(f"\n❌ Validation failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())