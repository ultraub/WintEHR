#!/usr/bin/env python3
"""
Fix missing search parameters for Immunization and AllergyIntolerance resources.
Simplified version that matches the actual table schema.
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

async def insert_search_param(conn, resource_id, resource_type, param_name, param_type, value_string=None, value_reference=None, value_token_system=None, value_token_code=None, value_date=None):
    """Insert a single search parameter."""
    await conn.execute("""
        INSERT INTO fhir.search_params 
        (resource_id, resource_type, param_name, param_type, value_string, value_reference, value_token_system, value_token_code, value_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
    """, resource_id, resource_type, param_name, param_type, value_string, value_reference, value_token_system, value_token_code, value_date)

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
        
        fixed_count = 0
        for record in immunizations:
            resource_id = record['id']
            resource_data = record['resource']
            
            # Parse JSON if needed
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            
            # Extract patient reference
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                patient_ref = resource_data['patient']['reference']
                await insert_search_param(conn, resource_id, 'Immunization', 'patient', 'reference', value_reference=patient_ref)
                fixed_count += 1
        
        logger.info(f"✅ Fixed {fixed_count} Immunization resources")
        
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
        
        fixed_count = 0
        for record in allergies:
            resource_id = record['id']
            resource_data = record['resource']
            
            # Parse JSON if needed
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            
            # Extract patient reference
            if 'patient' in resource_data and 'reference' in resource_data['patient']:
                patient_ref = resource_data['patient']['reference']
                await insert_search_param(conn, resource_id, 'AllergyIntolerance', 'patient', 'reference', value_reference=patient_ref)
                fixed_count += 1
        
        logger.info(f"✅ Fixed {fixed_count} AllergyIntolerance resources")
        
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
        
        # Show some statistics
        stats = await conn.fetch("""
            SELECT resource_type, param_name, COUNT(*) as count
            FROM fhir.search_params
            WHERE resource_type IN ('Immunization', 'AllergyIntolerance')
            GROUP BY resource_type, param_name
            ORDER BY resource_type, param_name
        """)
        
        logger.info("\nSearch parameter statistics:")
        for stat in stats:
            logger.info(f"  {stat['resource_type']}.{stat['param_name']}: {stat['count']} parameters")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_missing_search_params())