#!/usr/bin/env python3
"""
Fix missing patient/subject search parameters for clinical resources.
Directly extracts and adds patient references from existing resources.
"""

import asyncio
import json
import logging
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Database configuration
DB_HOST = 'postgres'
DB_PORT = '5432'
DB_NAME = 'emr_db'
DB_USER = 'emr_user'
DB_PASSWORD = 'emr_password'

# Connection string
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

async def main():
    """Main function to fix missing patient references."""
    engine = create_engine(DATABASE_URL, poolclass=NullPool)
    
    logging.info("Starting patient reference fix...")
    
    # Resource types that should have patient references
    resource_types = [
        'Condition', 'Observation', 'MedicationRequest', 
        'Procedure', 'AllergyIntolerance', 'Immunization',
        'DiagnosticReport', 'DocumentReference', 'Encounter',
        'CarePlan', 'CareTeam'
    ]
    
    total_fixed = 0
    
    with engine.connect() as conn:
        for resource_type in resource_types:
            logging.info(f"\nProcessing {resource_type} resources...")
            
            # Get resources without patient/subject search params
            query = text("""
                SELECT r.id, r.resource_type, r.resource::json as resource_data
                FROM fhir.resources r
                WHERE r.resource_type = :resource_type
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp
                    WHERE sp.resource_id = r.id
                    AND sp.param_name IN ('patient', 'subject')
                )
            """)
            
            result = conn.execute(query, {'resource_type': resource_type})
            resources = result.fetchall()
            
            if not resources:
                logging.info(f"  No {resource_type} resources need fixing")
                continue
                
            logging.info(f"  Found {len(resources)} {resource_type} resources to fix")
            
            fixed_count = 0
            for resource in resources:
                resource_id = resource[0]  # id
                resource_type_db = resource[1]  # resource_type
                resource_data = resource[2]  # resource_data
                
                # Extract patient reference
                patient_ref = None
                
                # Check subject field
                if 'subject' in resource_data and isinstance(resource_data['subject'], dict):
                    ref = resource_data['subject'].get('reference', '')
                    if ref:
                        patient_ref = ref
                
                # Check patient field (for some resources like AllergyIntolerance)
                elif 'patient' in resource_data and isinstance(resource_data['patient'], dict):
                    ref = resource_data['patient'].get('reference', '')
                    if ref:
                        patient_ref = ref
                
                if patient_ref:
                    # Add subject search parameter
                    insert_query = text("""
                        INSERT INTO fhir.search_params 
                        (resource_id, resource_type, param_name, param_type, value_reference)
                        VALUES (:resource_id, :resource_type, :param_name, 'reference', :value_reference)
                    """)
                    
                    # Add subject parameter
                    conn.execute(insert_query, {
                        'resource_id': resource_id,
                        'resource_type': resource_type,
                        'param_name': 'subject',
                        'value_reference': patient_ref
                    })
                    
                    # Add patient parameter if it's a patient reference
                    if patient_ref.startswith('Patient/') or patient_ref.startswith('urn:uuid:'):
                        conn.execute(insert_query, {
                            'resource_id': resource_id,
                            'resource_type': resource_type,
                            'param_name': 'patient',
                            'value_reference': patient_ref
                        })
                    
                    fixed_count += 1
                    
                    if fixed_count % 100 == 0:
                        logging.info(f"    Fixed {fixed_count} resources...")
                        conn.commit()
            
            conn.commit()
            logging.info(f"  Fixed {fixed_count} {resource_type} resources")
            total_fixed += fixed_count
    
    logging.info(f"\nTotal resources fixed: {total_fixed}")
    
    # Verify the fix
    logging.info("\nVerifying fix...")
    with engine.connect() as conn:
        verify_query = text("""
            SELECT 
                resource_type,
                COUNT(DISTINCT resource_id) as resources_with_patient_ref
            FROM fhir.search_params
            WHERE param_name IN ('patient', 'subject')
            GROUP BY resource_type
            ORDER BY resource_type
        """)
        
        result = conn.execute(verify_query)
        logging.info("\nResources with patient references:")
        for row in result:
            logging.info(f"  {row[0]}: {row[1]}")

if __name__ == "__main__":
    asyncio.run(main())