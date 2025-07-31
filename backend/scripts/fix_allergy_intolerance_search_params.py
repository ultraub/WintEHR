#!/usr/bin/env python3
"""
Fix AllergyIntolerance search parameters for URN format patient references.

This script addresses the issue where AllergyIntolerance resources use URN format
patient references (e.g., urn:uuid:patient-id) but search parameters aren't being
indexed properly for patient searches.
"""

import asyncio
import asyncpg
import json
from datetime import datetime
import uuid
import os
import sys

async def fix_allergy_intolerance_search_params():
    """Fix search parameters for AllergyIntolerance resources with URN references."""
    
    # Connect to database
    db_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db')
    # Convert to asyncpg format
    if db_url.startswith('postgresql+asyncpg://'):
        db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    # For Docker environment
    if '--docker' in sys.argv:
        db_url = 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
    
    conn = await asyncpg.connect(db_url)
    
    try:
        print("Fixing AllergyIntolerance search parameters...")
        
        # Get all AllergyIntolerance resources
        query = """
            SELECT r.id, r.resource_type, r.resource
            FROM fhir.resources r
            WHERE r.resource_type = 'AllergyIntolerance'
            AND r.deleted = false
            ORDER BY r.id
        """
        
        resources = await conn.fetch(query)
        print(f"Found {len(resources)} AllergyIntolerance resources")
        
        fixed_count = 0
        for row in resources:
            resource_id = row['id']
            resource = json.loads(row['resource']) if isinstance(row['resource'], str) else row['resource']
            
            # Extract patient reference
            patient_ref = resource.get('patient', {}).get('reference')
            if not patient_ref:
                print(f"  Warning: AllergyIntolerance {resource_id} has no patient reference")
                continue
            
            print(f"  Processing AllergyIntolerance {resource_id} with patient reference: {patient_ref}")
            
            # Delete existing patient/subject search parameters
            await conn.execute("""
                DELETE FROM fhir.search_params
                WHERE resource_id = $1 AND param_name IN ('patient', 'subject')
            """, resource_id)
            
            # Handle different reference formats
            if patient_ref.startswith('urn:uuid:'):
                # Extract just the UUID part
                patient_id = patient_ref[9:]  # Remove 'urn:uuid:' prefix
                
                # Add both patient and subject search parameters
                # Store multiple formats to ensure search works
                for param_name in ['patient', 'subject']:
                    # Store the original URN format
                    await conn.execute("""
                        INSERT INTO fhir.search_params (
                            resource_id, resource_type, param_name, param_type,
                            value_string, value_reference, value_number, value_date,
                            value_token_system, value_token_code
                        ) VALUES ($1, $2, $3, 'reference', $4, NULL, NULL, NULL, NULL, NULL)
                    """, resource_id, 'AllergyIntolerance', param_name, patient_ref)
                    
                    # Also store just the ID for reference searches
                    await conn.execute("""
                        INSERT INTO fhir.search_params (
                            resource_id, resource_type, param_name, param_type,
                            value_string, value_reference, value_number, value_date,
                            value_token_system, value_token_code
                        ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                    """, resource_id, 'AllergyIntolerance', param_name, patient_id)
                    
                fixed_count += 1
                
            elif '/' in patient_ref:
                # Standard reference format (e.g., Patient/123)
                parts = patient_ref.split('/', 1)
                if len(parts) == 2:
                    patient_id = parts[1]
                    
                    for param_name in ['patient', 'subject']:
                        # Store the full reference
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_reference, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, 'reference', $4, NULL, NULL, NULL, NULL, NULL)
                        """, resource_id, 'AllergyIntolerance', param_name, patient_ref)
                        
                        # Also store just the ID
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_reference, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                        """, resource_id, 'AllergyIntolerance', param_name, patient_id)
                    
                    fixed_count += 1
            else:
                # Just an ID
                for param_name in ['patient', 'subject']:
                    await conn.execute("""
                        INSERT INTO fhir.search_params (
                            resource_id, resource_type, param_name, param_type,
                            value_string, value_reference, value_number, value_date,
                            value_token_system, value_token_code
                        ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                    """, resource_id, 'AllergyIntolerance', param_name, patient_ref)
                
                fixed_count += 1
        
        print(f"\nFixed {fixed_count} AllergyIntolerance resources")
        
        # Also check and fix any other clinical resource types that might have URN references
        print("\nChecking other resource types for URN references...")
        
        other_types = ['Condition', 'Observation', 'MedicationRequest', 'Procedure', 'Immunization']
        for resource_type in other_types:
            # Check if any resources of this type have URN references
            check_query = """
                SELECT COUNT(*) as count
                FROM fhir.resources r
                WHERE r.resource_type = $1
                AND r.deleted = false
                AND (
                    r.resource->>'patient' LIKE 'urn:uuid:%'
                    OR r.resource->>'subject' LIKE 'urn:uuid:%'
                )
            """
            
            count = await conn.fetchval(check_query, resource_type)
            if count > 0:
                print(f"  Found {count} {resource_type} resources with URN references - fixing...")
                
                # Get resources with URN references
                resources_query = """
                    SELECT r.id, r.resource
                    FROM fhir.resources r
                    WHERE r.resource_type = $1
                    AND r.deleted = false
                    AND (
                        r.resource->>'patient' LIKE 'urn:uuid:%'
                        OR r.resource->>'subject' LIKE 'urn:uuid:%'
                    )
                """
                
                resources = await conn.fetch(resources_query, resource_type)
                
                for row in resources:
                    resource_id = row['id']
                    resource = json.loads(row['resource']) if isinstance(row['resource'], str) else row['resource']
                    
                    # Get reference (check both patient and subject)
                    ref = resource.get('patient', {}).get('reference') or resource.get('subject', {}).get('reference')
                    if ref and ref.startswith('urn:uuid:'):
                        patient_id = ref[9:]  # Extract UUID
                        
                        # Delete existing search params
                        await conn.execute("""
                            DELETE FROM fhir.search_params
                            WHERE resource_id = $1 AND param_name IN ('patient', 'subject')
                        """, resource_id)
                        
                        # Add fixed search params
                        for param_name in ['patient', 'subject']:
                            # Store URN format
                            await conn.execute("""
                                INSERT INTO fhir.search_params (
                                    resource_id, resource_type, param_name, param_type,
                                    value_string, value_reference, value_number, value_date,
                                    value_token_system, value_token_code
                                ) VALUES ($1, $2, $3, 'reference', $4, NULL, NULL, NULL, NULL, NULL)
                            """, resource_id, resource_type, param_name, ref)
                            
                            # Store just ID
                            await conn.execute("""
                                INSERT INTO fhir.search_params (
                                    resource_id, resource_type, param_name, param_type,
                                    value_string, value_reference, value_number, value_date,
                                    value_token_system, value_token_code
                                ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                            """, resource_id, resource_type, param_name, patient_id)
        
        # Verify the fix
        print("\nVerifying search parameters...")
        
        # Test a search
        test_query = """
            SELECT DISTINCT p.id, p.resource->>'name' as name
            FROM fhir.resources p
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            AND EXISTS (
                SELECT 1 FROM fhir.search_params sp
                JOIN fhir.resources r ON r.id = sp.resource_id
                WHERE r.resource_type = 'AllergyIntolerance'
                AND sp.param_name = 'patient'
                AND (sp.value_reference = p.id::text OR sp.value_string = CONCAT('urn:uuid:', p.id::text))
            )
            LIMIT 5
        """
        
        patients = await conn.fetch(test_query)
        print(f"\nPatients with AllergyIntolerance records: {len(patients)}")
        for patient in patients:
            print(f"  - Patient {patient['id']}: {patient['name']}")
        
        # Count fixed AllergyIntolerance search params
        count_query = """
            SELECT COUNT(DISTINCT resource_id) as count
            FROM fhir.search_params
            WHERE resource_type = 'AllergyIntolerance'
            AND param_name = 'patient'
        """
        
        count = await conn.fetchval(count_query)
        print(f"\nTotal AllergyIntolerance resources with patient search parameter: {count}")
        
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(fix_allergy_intolerance_search_params())