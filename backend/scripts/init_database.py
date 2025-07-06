#!/usr/bin/env python3
"""
Database Initialization Script

Ensures the database is properly initialized with:
1. Required schemas and tables
2. Search parameter indices
3. Missing search parameters (e.g., category for observations)
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def fix_urn_references(session: AsyncSession):
    """Fix URN references to use proper FHIR references."""
    logger.info("🔧 Checking for URN references...")
    
    # Check if we have URN references
    urn_check = text("""
        SELECT COUNT(*) 
        FROM fhir.resources 
        WHERE resource::text LIKE '%urn:uuid:%'
        LIMIT 1
    """)
    
    result = await session.execute(urn_check)
    urn_count = result.scalar()
    
    if urn_count == 0:
        logger.info("✅ No URN references found")
        return
    
    logger.info("📝 Fixing URN references...")
    
    # Fix reference fields for each resource type
    reference_fixes = [
        # (resource_type, field_path, target_type)
        ('Observation', 'subject', 'Patient'),
        ('Observation', 'encounter', 'Encounter'),
        ('Condition', 'subject', 'Patient'),
        ('Condition', 'encounter', 'Encounter'),
        ('MedicationRequest', 'subject', 'Patient'),
        ('MedicationRequest', 'encounter', 'Encounter'),
        ('Procedure', 'subject', 'Patient'),
        ('Procedure', 'encounter', 'Encounter'),
        ('Encounter', 'subject', 'Patient'),
        ('AllergyIntolerance', 'patient', 'Patient'),
        ('AllergyIntolerance', 'encounter', 'Encounter'),
        ('Immunization', 'patient', 'Patient'),
        ('Immunization', 'encounter', 'Encounter'),
        ('DiagnosticReport', 'subject', 'Patient'),
        ('DiagnosticReport', 'encounter', 'Encounter'),
        ('DocumentReference', 'subject', 'Patient'),
        ('CarePlan', 'subject', 'Patient'),
        ('CarePlan', 'encounter', 'Encounter'),
        ('ExplanationOfBenefit', 'patient', 'Patient'),
        ('Claim', 'patient', 'Patient'),
        ('ImagingStudy', 'subject', 'Patient'),
        ('ImagingStudy', 'encounter', 'Encounter'),
    ]
    
    total_fixed = 0
    for resource_type, field_path, target_type in reference_fixes:
        update_query = text(f"""
            UPDATE fhir.resources
            SET resource = jsonb_set(
                resource,
                '{{{field_path},reference}}',
                to_jsonb('{target_type}/' || substring(resource->'{field_path}'->>'reference' from 'urn:uuid:(.*)')::text)
            )
            WHERE resource_type = :resource_type
            AND resource->'{field_path}'->>'reference' LIKE 'urn:uuid:%'
        """)
        
        result = await session.execute(update_query, {"resource_type": resource_type})
        if result.rowcount > 0:
            logger.info(f"  Fixed {result.rowcount} {resource_type}.{field_path} references")
            total_fixed += result.rowcount
    
    await session.commit()
    logger.info(f"✅ Fixed {total_fixed} URN references")


async def ensure_search_parameters(session: AsyncSession):
    """Ensure all required search parameters are populated."""
    logger.info("🔍 Checking search parameters...")
    
    # First fix URN references if needed
    await fix_urn_references(session)
    
    # Check and add category search parameters for observations
    category_check = text("""
        SELECT COUNT(*) as missing_count
        FROM fhir.resources r
        WHERE r.resource_type = 'Observation'
        AND r.resource ? 'category'
        AND r.id NOT IN (
            SELECT resource_id 
            FROM fhir.search_params 
            WHERE param_name = 'category'
        )
    """)
    
    result = await session.execute(category_check)
    missing_count = result.scalar()
    
    if missing_count > 0:
        logger.info(f"📝 Adding {missing_count} missing category search parameters...")
        
        # Add missing category search parameters (handles multiple categories/codings)
        insert_query = text("""
            INSERT INTO fhir.search_params (
                resource_id, param_name, param_type, 
                value_token_system, value_token_code
            )
            SELECT DISTINCT
                o.id,
                'category',
                'token',
                cat_coding->>'system',
                cat_coding->>'code'
            FROM fhir.resources o,
                jsonb_array_elements(o.resource->'category') cat,
                jsonb_array_elements(cat->'coding') cat_coding
            WHERE o.resource_type = 'Observation'
            AND o.resource ? 'category'
            AND o.id NOT IN (
                SELECT resource_id 
                FROM fhir.search_params 
                WHERE param_name = 'category'
            )
            ON CONFLICT DO NOTHING
        """)
        
        await session.execute(insert_query)
        await session.commit()
        logger.info("✅ Category search parameters added successfully")
    else:
        logger.info("✅ All category search parameters are already present")
    
    # Check and add patient search parameters
    patient_params = [
        ('Observation', 'subject'),
        ('Condition', 'subject'),
        ('MedicationRequest', 'subject'),
        ('AllergyIntolerance', 'patient'),
        ('Procedure', 'subject'),
        ('Encounter', 'subject'),
        ('Immunization', 'patient'),
        ('DiagnosticReport', 'subject'),
        ('DocumentReference', 'subject'),
        ('CarePlan', 'subject'),
        ('Coverage', 'beneficiary'),
        ('ImagingStudy', 'subject')
    ]
    
    for resource_type, patient_field in patient_params:
        patient_check = text(f"""
            SELECT COUNT(*) as missing_count
            FROM fhir.resources r
            WHERE r.resource_type = :resource_type
            AND r.resource->'{patient_field}'->>'reference' LIKE 'Patient/%'
            AND r.id NOT IN (
                SELECT resource_id 
                FROM fhir.search_params 
                WHERE param_name = 'patient'
            )
        """)
        
        result = await session.execute(patient_check, {"resource_type": resource_type})
        missing_count = result.scalar()
        
        if missing_count > 0:
            logger.info(f"📝 Adding {missing_count} patient search params for {resource_type}...")
            
            insert_query = text(f"""
                INSERT INTO fhir.search_params (
                    resource_id, param_name, param_type, value_reference
                )
                SELECT 
                    r.id,
                    'patient',
                    'reference',
                    substring(r.resource->'{patient_field}'->>'reference' from 'Patient/(.+)')
                FROM fhir.resources r
                WHERE r.resource_type = :resource_type
                AND r.resource->'{patient_field}'->>'reference' LIKE 'Patient/%'
                AND r.id NOT IN (
                    SELECT resource_id 
                    FROM fhir.search_params 
                    WHERE param_name = 'patient'
                )
                ON CONFLICT DO NOTHING
            """)
            
            await session.execute(insert_query, {"resource_type": resource_type})
            await session.commit()
    
    # Report on search parameter statistics
    stats_query = text("""
        SELECT 
            param_name,
            COUNT(*) as count
        FROM fhir.search_params
        GROUP BY param_name
        ORDER BY count DESC
    """)
    
    result = await session.execute(stats_query)
    stats = result.fetchall()
    
    logger.info("📊 Search parameter statistics:")
    for row in stats:
        logger.info(f"  - {row.param_name}: {row.count}")


async def verify_database_schema(session: AsyncSession):
    """Verify the database schema is properly set up."""
    logger.info("🏗️  Verifying database schema...")
    
    # Check if fhir schema exists
    schema_query = text("""
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'fhir'
    """)
    
    result = await session.execute(schema_query)
    if not result.scalar():
        logger.error("❌ FHIR schema not found! Please run database migrations first.")
        return False
    
    # Check required tables
    required_tables = ['resources', 'search_params']
    tables_query = text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'fhir' 
        AND table_name = ANY(:tables)
    """)
    
    result = await session.execute(tables_query, {"tables": required_tables})
    existing_tables = {row[0] for row in result.fetchall()}
    
    missing_tables = set(required_tables) - existing_tables
    if missing_tables:
        logger.error(f"❌ Missing tables: {missing_tables}")
        return False
    
    logger.info("✅ Database schema verified successfully")
    return True


async def get_database_stats(session: AsyncSession):
    """Get current database statistics."""
    logger.info("📈 Database Statistics:")
    
    # Resource counts by type
    resource_query = text("""
        SELECT 
            resource_type,
            COUNT(*) as count,
            COUNT(CASE WHEN deleted = false THEN 1 END) as active_count
        FROM fhir.resources
        GROUP BY resource_type
        ORDER BY count DESC
    """)
    
    result = await session.execute(resource_query)
    resources = result.fetchall()
    
    logger.info("  Resource counts:")
    total_resources = 0
    for row in resources:
        logger.info(f"    - {row.resource_type}: {row.count} (active: {row.active_count})")
        total_resources += row.count
    
    logger.info(f"  Total resources: {total_resources}")
    
    # Vital signs specific check
    vital_signs_query = text("""
        SELECT COUNT(*) as count
        FROM fhir.resources r
        WHERE r.resource_type = 'Observation'
        AND r.resource->'category' @> '[{"coding":[{"code":"vital-signs"}]}]'
    """)
    
    result = await session.execute(vital_signs_query)
    vital_signs_count = result.scalar()
    logger.info(f"  Vital signs observations: {vital_signs_count}")


async def init_database():
    """Initialize the database with required data and fixes."""
    logger.info("🚀 Starting database initialization...")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    try:
        async with AsyncSession(engine) as session:
            # Verify schema
            if not await verify_database_schema(session):
                logger.error("❌ Database schema verification failed!")
                return False
            
            # Get current stats
            await get_database_stats(session)
            
            # Ensure search parameters
            await ensure_search_parameters(session)
            
            logger.info("✅ Database initialization completed successfully!")
            return True
            
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        return False
    finally:
        await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(init_database())
    sys.exit(0 if success else 1)