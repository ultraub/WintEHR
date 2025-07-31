#!/usr/bin/env python3
"""
Fix missing search parameters for Immunization and AllergyIntolerance resources.
"""

import asyncio
import asyncpg
import os
import sys
import json
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

async def extract_search_params_immunization(resource_data):
    """Extract search parameters from Immunization resource."""
    params = []
    
    # Extract patient reference
    if 'patient' in resource_data:
        patient_ref = resource_data['patient'].get('reference', '')
        if patient_ref:
            params.append(('patient', 'reference', None, None, None, None, None, patient_ref))
    
    # Extract status
    if 'status' in resource_data:
        params.append(('status', 'token', None, resource_data['status'], None, None, None, None))
    
    # Extract vaccine code
    if 'vaccineCode' in resource_data and 'coding' in resource_data['vaccineCode']:
        for coding in resource_data['vaccineCode']['coding']:
            if 'system' in coding and 'code' in coding:
                params.append(('vaccine-code', 'token', coding['system'], coding['code'], None, None, None, None))
    
    # Extract date (occurrenceDateTime or occurrenceString)
    if 'occurrenceDateTime' in resource_data:
        params.append(('date', 'date', None, None, resource_data['occurrenceDateTime'], None, None, None))
    
    return params

async def extract_search_params_allergy(resource_data):
    """Extract search parameters from AllergyIntolerance resource."""
    params = []
    
    # Extract patient reference
    if 'patient' in resource_data:
        patient_ref = resource_data['patient'].get('reference', '')
        if patient_ref:
            params.append(('patient', 'reference', None, None, None, None, None, patient_ref))
    
    # Extract clinical status
    if 'clinicalStatus' in resource_data and 'coding' in resource_data['clinicalStatus']:
        for coding in resource_data['clinicalStatus']['coding']:
            if 'code' in coding:
                params.append(('clinical-status', 'token', coding.get('system'), coding['code'], None, None, None, None))
    
    # Extract verification status
    if 'verificationStatus' in resource_data and 'coding' in resource_data['verificationStatus']:
        for coding in resource_data['verificationStatus']['coding']:
            if 'code' in coding:
                params.append(('verification-status', 'token', coding.get('system'), coding['code'], None, None, None, None))
    
    # Extract code
    if 'code' in resource_data and 'coding' in resource_data['code']:
        for coding in resource_data['code']['coding']:
            if 'system' in coding and 'code' in coding:
                params.append(('code', 'token', coding['system'], coding['code'], None, None, None, None))
    
    # Extract type
    if 'type' in resource_data:
        params.append(('type', 'token', None, None, None, None, resource_data['type'], None))
    
    # Extract category
    if 'category' in resource_data:
        for category in resource_data['category']:
            params.append(('category', 'token', None, None, None, None, category, None))
    
    return params

async def fix_missing_search_params():
    """Fix missing search parameters."""
    
    # Database connection
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@postgres:5432/emr_db')
    
    # Convert to asyncpg format
    if 'postgresql://' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    if '+asyncpg' in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace('+asyncpg', '')
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Fix Immunization resources
        logger.info("Fixing Immunization resources...")
        immunizations = await conn.fetch("""
            SELECT r.id, r.resource 
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id AND sp.param_name IN ('patient', 'subject')
            WHERE r.resource_type = 'Immunization' 
            AND r.deleted = false
            AND sp.id IS NULL
        """)
        
        logger.info(f"Found {len(immunizations)} Immunization resources missing search parameters")
        
        for record in immunizations:
            resource_id = record['id']
            resource_data = record['resource']
            
            # Parse JSON if needed
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            
            # Extract search parameters
            params = await extract_search_params_immunization(resource_data)
            
            # Insert search parameters
            for param in params:
                await conn.execute("""
                    INSERT INTO fhir.search_params 
                    (resource_id, resource_type, param_name, param_type, value_token_system, value_token_code, value_date, value_string, value_reference)
                    VALUES ($1, 'Immunization', $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT DO NOTHING
                """, resource_id, param[0], param[1], param[2], param[3], param[4], param[5], param[7])
        
        logger.info(f"✅ Fixed {len(immunizations)} Immunization resources")
        
        # Fix AllergyIntolerance resources
        logger.info("Fixing AllergyIntolerance resources...")
        allergies = await conn.fetch("""
            SELECT r.id, r.resource 
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id AND sp.param_name IN ('patient', 'subject')
            WHERE r.resource_type = 'AllergyIntolerance' 
            AND r.deleted = false
            AND sp.id IS NULL
        """)
        
        logger.info(f"Found {len(allergies)} AllergyIntolerance resources missing search parameters")
        
        for record in allergies:
            resource_id = record['id']
            resource_data = record['resource']
            
            # Parse JSON if needed
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            
            # Extract search parameters
            params = await extract_search_params_allergy(resource_data)
            
            # Insert search parameters
            for param in params:
                await conn.execute("""
                    INSERT INTO fhir.search_params 
                    (resource_id, resource_type, param_name, param_type, value_token_system, value_token_code, value_date, value_string, value_reference)
                    VALUES ($1, 'AllergyIntolerance', $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT DO NOTHING
                """, resource_id, param[0], param[1], param[2], param[3], param[4], param[5], param[7])
        
        logger.info(f"✅ Fixed {len(allergies)} AllergyIntolerance resources")
        
        # Verify fixes
        logger.info("\nVerifying fixes...")
        
        # Check Immunization
        imm_check = await conn.fetchval("""
            SELECT COUNT(DISTINCT r.id)
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id AND sp.param_name IN ('patient', 'subject')
            WHERE r.resource_type = 'Immunization' 
            AND r.deleted = false
            AND sp.id IS NULL
        """)
        
        # Check AllergyIntolerance
        allergy_check = await conn.fetchval("""
            SELECT COUNT(DISTINCT r.id)
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id AND sp.param_name IN ('patient', 'subject')
            WHERE r.resource_type = 'AllergyIntolerance' 
            AND r.deleted = false
            AND sp.id IS NULL
        """)
        
        if imm_check == 0 and allergy_check == 0:
            logger.info("✅ All search parameters successfully fixed!")
        else:
            logger.error(f"❌ Still missing parameters: Immunization={imm_check}, AllergyIntolerance={allergy_check}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_missing_search_params())