#!/usr/bin/env python3
"""
Fix Observation search parameters to handle urn:uuid references.

This script re-extracts search parameters for Observations to ensure
patient references in urn:uuid format are properly indexed.
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


def fix_observation_search_params():
    """Re-extract search parameters for Observations with urn:uuid references."""
    
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
            # Find all Observations with urn:uuid subject references
            cur.execute("""
                SELECT id, fhir_id, resource
                FROM fhir.resources
                WHERE resource_type = 'Observation'
                AND resource->'subject'->>'reference' LIKE 'urn:uuid:%'
            """)
            
            observations = cur.fetchall()
            print(f"Found {len(observations)} Observations with urn:uuid references")
            
            fixed_count = 0
            
            for obs in observations:
                resource_id = obs['id']
                resource_data = json.loads(obs['resource']) if isinstance(obs['resource'], str) else obs['resource']
                
                # Check if subject reference exists
                if 'subject' in resource_data and 'reference' in resource_data['subject']:
                    ref = resource_data['subject']['reference']
                    
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
                        
                        if fixed_count % 10 == 0:
                            print(f"Fixed {fixed_count} Observations...")
            
            conn.commit()
            print(f"\nSuccessfully fixed {fixed_count} Observations")
            
            # Verify the fix
            cur.execute("""
                SELECT COUNT(DISTINCT r.id) 
                FROM fhir.resources r
                JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE r.resource_type = 'Observation'
                AND sp.param_name = 'patient'
                AND sp.value_string LIKE 'urn:uuid:%'
            """)
            
            urn_count = cur.fetchone()['count']
            print(f"Total Observations with urn:uuid patient search params: {urn_count}")
            
    finally:
        conn.close()


if __name__ == "__main__":
    fix_observation_search_params()