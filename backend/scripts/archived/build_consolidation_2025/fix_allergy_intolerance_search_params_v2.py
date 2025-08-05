#!/usr/bin/env python3
"""
Fix AllergyIntolerance search parameters for URN format patient references.

This script addresses the issue where AllergyIntolerance resources use URN format
patient references (e.g., urn:uuid:patient-uuid) but need to reference the actual
patient resource ID for search to work properly.
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
        
        # Create a mapping of patient UUIDs to resource IDs
        print("Building patient UUID to ID mapping...")
        uuid_mapping_query = """
            SELECT r.id::text as resource_id, 
                   jsonb_array_elements(r.resource->'identifier')->>'value' as uuid
            FROM fhir.resources r
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND r.resource->'identifier' IS NOT NULL
        """
        
        mappings = await conn.fetch(uuid_mapping_query)
        uuid_to_id = {}
        for row in mappings:
            if row['uuid'] and '-' in row['uuid'] and len(row['uuid']) == 36:  # Looks like a UUID
                uuid_to_id[row['uuid']] = row['resource_id']
        
        print(f"Found {len(uuid_to_id)} patient UUID mappings")
        
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
        not_found_count = 0
        
        for row in resources:
            resource_id = row['id']
            resource = json.loads(row['resource']) if isinstance(row['resource'], str) else row['resource']
            
            # Extract patient reference
            patient_ref = resource.get('patient', {}).get('reference')
            if not patient_ref:
                print(f"  Warning: AllergyIntolerance {resource_id} has no patient reference")
                continue
            
            # Delete existing patient/subject search parameters
            await conn.execute("""
                DELETE FROM fhir.search_params
                WHERE resource_id = $1 AND param_name IN ('patient', 'subject')
            """, resource_id)
            
            # Handle URN UUID references
            if patient_ref.startswith('urn:uuid:'):
                # Extract the UUID
                patient_uuid = patient_ref[9:]  # Remove 'urn:uuid:' prefix
                
                # Look up the actual patient resource ID
                actual_patient_id = uuid_to_id.get(patient_uuid)
                
                if actual_patient_id:
                    print(f"  Fixed AllergyIntolerance {resource_id}: UUID {patient_uuid} -> Patient/{actual_patient_id}")
                    
                    # Add search parameters with the actual patient ID
                    for param_name in ['patient', 'subject']:
                        # Store the actual patient ID as reference
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_reference, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                        """, resource_id, 'AllergyIntolerance', param_name, actual_patient_id)
                        
                        # Also store as full reference format
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_reference, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, 'reference', $4, NULL, NULL, NULL, NULL, NULL)
                        """, resource_id, 'AllergyIntolerance', param_name, f"Patient/{actual_patient_id}")
                    
                    fixed_count += 1
                else:
                    print(f"  Warning: Could not find patient for UUID {patient_uuid}")
                    not_found_count += 1
                    
            elif '/' in patient_ref:
                # Standard reference format - already correct
                parts = patient_ref.split('/', 1)
                if len(parts) == 2:
                    patient_id = parts[1]
                    
                    for param_name in ['patient', 'subject']:
                        # Store just the ID
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_reference, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                        """, resource_id, 'AllergyIntolerance', param_name, patient_id)
                        
                        # Store full reference
                        await conn.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, resource_type, param_name, param_type,
                                value_string, value_reference, value_number, value_date,
                                value_token_system, value_token_code
                            ) VALUES ($1, $2, $3, 'reference', $4, NULL, NULL, NULL, NULL, NULL)
                        """, resource_id, 'AllergyIntolerance', param_name, patient_ref)
                    
                    fixed_count += 1
                    
        print(f"\nFixed {fixed_count} AllergyIntolerance resources")
        if not_found_count > 0:
            print(f"Could not fix {not_found_count} resources (patient not found)")
        
        # Also fix other resource types with URN references
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
                    r.resource->'patient'->>'reference' LIKE 'urn:uuid:%'
                    OR r.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
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
                        r.resource->'patient'->>'reference' LIKE 'urn:uuid:%'
                        OR r.resource->'subject'->>'reference' LIKE 'urn:uuid:%'
                    )
                """
                
                resources = await conn.fetch(resources_query, resource_type)
                type_fixed = 0
                
                for row in resources:
                    resource_id = row['id']
                    resource = json.loads(row['resource']) if isinstance(row['resource'], str) else row['resource']
                    
                    # Get reference (check both patient and subject)
                    ref = resource.get('patient', {}).get('reference') or resource.get('subject', {}).get('reference')
                    if ref and ref.startswith('urn:uuid:'):
                        patient_uuid = ref[9:]  # Extract UUID
                        actual_patient_id = uuid_to_id.get(patient_uuid)
                        
                        if actual_patient_id:
                            # Delete existing search params
                            await conn.execute("""
                                DELETE FROM fhir.search_params
                                WHERE resource_id = $1 AND param_name IN ('patient', 'subject')
                            """, resource_id)
                            
                            # Add fixed search params
                            for param_name in ['patient', 'subject']:
                                # Store actual patient ID
                                await conn.execute("""
                                    INSERT INTO fhir.search_params (
                                        resource_id, resource_type, param_name, param_type,
                                        value_string, value_reference, value_number, value_date,
                                        value_token_system, value_token_code
                                    ) VALUES ($1, $2, $3, 'reference', NULL, $4, NULL, NULL, NULL, NULL)
                                """, resource_id, resource_type, param_name, actual_patient_id)
                                
                                # Store full reference
                                await conn.execute("""
                                    INSERT INTO fhir.search_params (
                                        resource_id, resource_type, param_name, param_type,
                                        value_string, value_reference, value_number, value_date,
                                        value_token_system, value_token_code
                                    ) VALUES ($1, $2, $3, 'reference', $4, NULL, NULL, NULL, NULL, NULL)
                                """, resource_id, resource_type, param_name, f"Patient/{actual_patient_id}")
                            
                            type_fixed += 1
                
                print(f"    Fixed {type_fixed} {resource_type} resources")
        
        # Verify the fix
        print("\nVerifying search parameters...")
        
        # Test a specific patient search
        test_query = """
            SELECT p.id, p.resource->'name'->0->>'family' as family_name,
                   COUNT(DISTINCT a.id) as allergy_count
            FROM fhir.resources p
            LEFT JOIN fhir.search_params sp ON sp.param_name = 'patient' 
                AND (sp.value_reference = p.id::text OR sp.value_string = CONCAT('Patient/', p.id::text))
            LEFT JOIN fhir.resources a ON a.id = sp.resource_id AND a.resource_type = 'AllergyIntolerance'
            WHERE p.resource_type = 'Patient'
            AND p.deleted = false
            GROUP BY p.id, family_name
            HAVING COUNT(DISTINCT a.id) > 0
            ORDER BY allergy_count DESC
            LIMIT 10
        """
        
        results = await conn.fetch(test_query)
        print(f"\nTop patients with AllergyIntolerance records:")
        for row in results:
            print(f"  - Patient {row['id']} ({row['family_name']}): {row['allergy_count']} allergies")
        
        # Count total fixed search params
        count_query = """
            SELECT resource_type, COUNT(DISTINCT resource_id) as count
            FROM fhir.search_params
            WHERE param_name = 'patient'
            AND resource_type IN ('AllergyIntolerance', 'Condition', 'Observation', 'MedicationRequest', 'Procedure', 'Immunization')
            GROUP BY resource_type
            ORDER BY resource_type
        """
        
        counts = await conn.fetch(count_query)
        print(f"\nResources with patient search parameter:")
        for row in counts:
            print(f"  - {row['resource_type']}: {row['count']}")
        
        # Test actual FHIR search
        print("\nTesting FHIR search for AllergyIntolerance by patient...")
        search_test = """
            SELECT COUNT(DISTINCT r.id) as count
            FROM fhir.resources r
            JOIN fhir.search_params sp ON sp.resource_id = r.id
            WHERE r.resource_type = 'AllergyIntolerance'
            AND r.deleted = false
            AND sp.param_name = 'patient'
            AND sp.value_reference = '35195'  -- A known patient ID
        """
        
        test_count = await conn.fetchval(search_test)
        print(f"AllergyIntolerance resources for patient 35195: {test_count}")
        
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(fix_allergy_intolerance_search_params())