#!/usr/bin/env python3
"""
Fix search parameters for all resource types to handle urn:uuid references.

This script re-extracts search parameters for resources with urn:uuid patient/subject
references to ensure they are properly indexed.
"""

import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor
import json
import sys
import os

# Add parent directory to path so we can import from core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.fhir.reference_utils import ReferenceUtils


def fix_search_params_for_resource_type(resource_type, reference_field='subject'):
    """Fix search parameters for a specific resource type."""
    
    # Connect to database
    conn = psycopg2.connect(
        host='localhost',
        port=5432,
        database='emr_db',
        user='emr_user',
        password='emr_password'
    )
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find all resources with urn:uuid references
            query = f"""
                SELECT id, fhir_id, resource
                FROM fhir.resources
                WHERE resource_type = %s
                AND resource->'{reference_field}'->>'reference' LIKE 'urn:uuid:%%'
            """
            
            cur.execute(query, (resource_type,))
            
            resources = cur.fetchall()
            print(f"\nFound {len(resources)} {resource_type} resources with urn:uuid references")
            
            fixed_count = 0
            
            for res in resources:
                resource_id = res['id']
                resource_data = json.loads(res['resource']) if isinstance(res['resource'], str) else res['resource']
                
                # Check if reference exists
                if reference_field in resource_data and 'reference' in resource_data[reference_field]:
                    ref = resource_data[reference_field]['reference']
                    
                    # Check if we already have a patient search param for this resource
                    cur.execute("""
                        SELECT COUNT(*) FROM fhir.search_params
                        WHERE resource_id = %s AND param_name = 'patient'
                    """, (resource_id,))
                    
                    existing_count = cur.fetchone()['count']
                    
                    if existing_count == 0:
                        # Add patient search parameter
                        cur.execute("""
                            INSERT INTO fhir.search_params (
                                resource_id, param_name, param_type, value_string
                            ) VALUES (%s, %s, %s, %s)
                        """, (resource_id, 'patient', 'reference', ref))
                        
                        fixed_count += 1
                        
                        if fixed_count % 50 == 0:
                            print(f"  Fixed {fixed_count} {resource_type} resources...")
            
            conn.commit()
            print(f"  Successfully fixed {fixed_count} {resource_type} resources")
            
            return fixed_count
            
    except Exception as e:
        print(f"  Error fixing {resource_type}: {e}")
        conn.rollback()
        return 0
    finally:
        conn.close()


def main():
    """Fix search parameters for all relevant resource types."""
    
    # Resource types that commonly have patient references
    resource_configs = [
        ('Observation', 'subject'),
        ('Condition', 'subject'),
        ('Procedure', 'subject'),
        ('MedicationRequest', 'subject'),
        ('Encounter', 'subject'),
        ('AllergyIntolerance', 'patient'),  # Uses 'patient' not 'subject'
        ('Immunization', 'patient'),         # Uses 'patient' not 'subject'
        ('DiagnosticReport', 'subject'),
        ('CarePlan', 'subject'),
        ('Claim', 'patient'),                # Uses 'patient' not 'subject'
        ('ExplanationOfBenefit', 'patient'), # Uses 'patient' not 'subject'
    ]
    
    print("Fixing search parameters for all resource types...")
    total_fixed = 0
    
    for resource_type, reference_field in resource_configs:
        fixed = fix_search_params_for_resource_type(resource_type, reference_field)
        total_fixed += fixed
    
    print(f"\n=== SUMMARY ===")
    print(f"Total resources fixed: {total_fixed}")
    
    # Verify the fix by checking totals
    conn = psycopg2.connect(
        host='localhost',
        port=5432,
        database='emr_db',
        user='emr_user',
        password='emr_password'
    )
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Count resources with urn:uuid patient search params by type
            cur.execute("""
                SELECT r.resource_type, COUNT(DISTINCT r.id) as count
                FROM fhir.resources r
                JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE sp.param_name = 'patient'
                AND sp.value_string LIKE 'urn:uuid:%'
                GROUP BY r.resource_type
                ORDER BY r.resource_type
            """)
            
            print("\nResources with urn:uuid patient search params:")
            for row in cur.fetchall():
                print(f"  {row['resource_type']}: {row['count']}")
                
    finally:
        conn.close()


if __name__ == "__main__":
    main()