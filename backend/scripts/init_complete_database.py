#!/usr/bin/env python3
"""
Complete database initialization with all required tables and data cleaning
Run this after data import to ensure all tables exist and names are cleaned
"""

import asyncio
import asyncpg
import logging
import sys
import os
import re
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# Database connection string
# Convert SQLAlchemy URL to asyncpg format
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://emr_user:emr_password@postgres:5432/emr_db')
if DATABASE_URL.startswith('postgresql+asyncpg://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')

async def create_missing_tables(conn):
    """Create any missing database tables"""
    logger.info("Creating missing database tables...")
    
    # Create resource history table (often missing)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS fhir.resource_history (
            id SERIAL PRIMARY KEY,
            resource_id INTEGER NOT NULL,
            version_id INTEGER NOT NULL,
            operation VARCHAR(50) NOT NULL,
            resource JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
        CREATE INDEX IF NOT EXISTS idx_resource_history_version ON fhir.resource_history(resource_id, version_id);
    """)
    
    # Create references table if missing
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS fhir.references (
            id SERIAL PRIMARY KEY,
            source_resource_id INTEGER NOT NULL,
            source_path VARCHAR(255) NOT NULL,
            target_resource_type VARCHAR(255),
            target_resource_id VARCHAR(255),
            target_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_references_source ON fhir.references(source_resource_id);
        CREATE INDEX IF NOT EXISTS idx_references_target ON fhir.references(target_resource_type, target_resource_id);
    """)
    
    # Create compartments table if missing
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS fhir.compartments (
            id SERIAL PRIMARY KEY,
            compartment_type VARCHAR(50) NOT NULL,
            compartment_id VARCHAR(255) NOT NULL,
            resource_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_compartments_type_id ON fhir.compartments(compartment_type, compartment_id);
        CREATE INDEX IF NOT EXISTS idx_compartments_resource ON fhir.compartments(resource_id);
    """)
    
    # Create audit log table if missing
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS fhir.audit_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            action VARCHAR(50) NOT NULL,
            resource_type VARCHAR(255),
            resource_id VARCHAR(255),
            details JSONB,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON fhir.audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON fhir.audit_logs(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON fhir.audit_logs(created_at);
    """)
    
    logger.info("✅ All tables created/verified")

async def clean_patient_names(conn):
    """Clean numeric suffixes from patient names"""
    logger.info("Cleaning patient names...")
    
    # Get all patients
    patients = await conn.fetch("""
        SELECT id, resource
        FROM fhir.resources
        WHERE resource_type = 'Patient'
        AND deleted = false
    """)
    
    cleaned_count = 0
    
    for patient in patients:
        resource = patient['resource']
        # Parse JSON if it's stored as string in database
        if isinstance(resource, str):
            resource = json.loads(resource)
        modified = False
        
        if 'name' in resource:
            for name in resource['name']:
                # Clean given names
                if 'given' in name:
                    cleaned_given = []
                    for given_name in name['given']:
                        # Remove numeric suffix
                        cleaned = re.sub(r'\d+$', '', given_name).strip()
                        if cleaned:
                            cleaned_given.append(cleaned)
                        else:
                            # Keep original if empty after cleaning
                            cleaned_given.append(given_name)
                    
                    if cleaned_given != name['given']:
                        name['given'] = cleaned_given
                        modified = True
                
                # Clean family name
                if 'family' in name:
                    original = name['family']
                    # Remove numeric suffix
                    cleaned = re.sub(r'\d+$', '', original).strip()
                    
                    if cleaned and cleaned != original:
                        name['family'] = cleaned
                        modified = True
        
        # Update if modified
        if modified:
            # Convert resource back to JSON string for storage
            resource_json = json.dumps(resource) if not isinstance(resource, str) else resource
            await conn.execute("""
                UPDATE fhir.resources
                SET resource = $1,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = $2
            """, resource_json, patient['id'])
            
            cleaned_count += 1
    
    logger.info(f"✅ Cleaned names for {cleaned_count} patients")
    
    # Show sample of cleaned names
    sample = await conn.fetch("""
        SELECT 
            resource->'name'->0->'given'->0 as first_name,
            resource->'name'->0->>'family' as last_name
        FROM fhir.resources
        WHERE resource_type = 'Patient'
        AND deleted = false
        LIMIT 5
    """)
    
    logger.info("Sample of cleaned patient names:")
    for row in sample:
        logger.info(f"  {json.loads(row['first_name'])} {row['last_name']}")

async def clean_practitioner_names(conn):
    """Clean numeric suffixes from practitioner names"""
    logger.info("Cleaning practitioner names...")
    
    # Get all practitioners
    practitioners = await conn.fetch("""
        SELECT id, resource
        FROM fhir.resources
        WHERE resource_type = 'Practitioner'
        AND deleted = false
    """)
    
    cleaned_count = 0
    
    for practitioner in practitioners:
        resource = practitioner['resource']
        # Parse JSON if it's stored as string in database
        if isinstance(resource, str):
            resource = json.loads(resource)
        modified = False
        
        if 'name' in resource:
            for name in resource['name']:
                # Clean given names
                if 'given' in name:
                    cleaned_given = []
                    for given_name in name['given']:
                        # Remove numeric suffix
                        cleaned = re.sub(r'\d+$', '', given_name).strip()
                        if cleaned:
                            cleaned_given.append(cleaned)
                        else:
                            # Keep original if empty after cleaning
                            cleaned_given.append(given_name)
                    
                    if cleaned_given != name['given']:
                        name['given'] = cleaned_given
                        modified = True
                
                # Clean family name
                if 'family' in name:
                    original = name['family']
                    # Remove numeric suffix
                    cleaned = re.sub(r'\d+$', '', original).strip()
                    
                    if cleaned and cleaned != original:
                        name['family'] = cleaned
                        modified = True
        
        # Update if modified
        if modified:
            # Convert resource back to JSON string for storage
            resource_json = json.dumps(resource) if not isinstance(resource, str) else resource
            await conn.execute("""
                UPDATE fhir.resources
                SET resource = $1,
                    version_id = version_id + 1,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = $2
            """, resource_json, practitioner['id'])
            
            cleaned_count += 1
    
    logger.info(f"✅ Cleaned names for {cleaned_count} practitioners")
    
    # Show sample of cleaned names
    sample = await conn.fetch("""
        SELECT 
            resource->'name'->0->'given'->0 as first_name,
            resource->'name'->0->>'family' as last_name
        FROM fhir.resources
        WHERE resource_type = 'Practitioner'
        AND deleted = false
        LIMIT 5
    """)
    
    if sample:
        logger.info("Sample of cleaned practitioner names:")
        for row in sample:
            if row['first_name'] and row['last_name']:
                logger.info(f"  Dr. {json.loads(row['first_name'])} {row['last_name']}")

async def fix_urn_references(conn):
    """Convert urn:uuid references to proper FHIR references"""
    logger.info("Fixing URN references...")
    
    # Get resources with URN references
    resources_with_urns = await conn.fetch("""
        SELECT id, resource_type, resource
        FROM fhir.resources
        WHERE resource::text LIKE '%urn:uuid:%'
        AND deleted = false
    """)
    
    fixed_count = 0
    
    for row in resources_with_urns:
        resource = row['resource']
        # Handle if resource is already a string
        if isinstance(resource, str):
            resource_str = resource
            original_str = resource_str
        else:
            resource_str = json.dumps(resource)
            original_str = resource_str
        
        # Find all urn:uuid references and convert them
        # Pattern: "reference": "urn:uuid:XXXX"
        pattern = r'"reference"\s*:\s*"urn:uuid:([^"]+)"'
        
        def replace_urn(match):
            uuid = match.group(1)
            # Try to find the resource type for this UUID
            return f'"reference": "Patient/{uuid}"'  # Default to Patient for now
        
        # Replace all URN references
        updated_str = re.sub(pattern, replace_urn, resource_str)
        
        if updated_str != original_str:
            try:
                # Keep as string for database storage
                await conn.execute("""
                    UPDATE fhir.resources
                    SET resource = $1,
                        version_id = version_id + 1,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE id = $2
                """, updated_str, row['id'])
                fixed_count += 1
            except json.JSONDecodeError:
                logger.error(f"Failed to parse updated resource for {row['resource_type']}/{row['id']}")
    
    logger.info(f"✅ Fixed {fixed_count} resources with URN references")

async def show_summary(conn):
    """Show database summary"""
    logger.info("\n📊 Database Summary:")
    
    # Total resources
    total = await conn.fetchval(
        "SELECT COUNT(*) FROM fhir.resources WHERE deleted = false"
    )
    logger.info(f"  Total resources: {total:,}")
    
    # Count by type
    type_counts = await conn.fetch("""
        SELECT resource_type, COUNT(*) as count
        FROM fhir.resources
        WHERE deleted = false
        GROUP BY resource_type
        ORDER BY count DESC
        LIMIT 15
    """)
    
    logger.info("\n  Resource types:")
    for row in type_counts:
        logger.info(f"    {row['resource_type']}: {row['count']:,}")
    
    # Check for vital signs
    vital_signs = await conn.fetchval("""
        SELECT COUNT(*)
        FROM fhir.resources
        WHERE resource_type = 'Observation'
        AND resource->'category' @> '[{"coding":[{"code":"vital-signs"}]}]'
    """)
    logger.info(f"\n  Vital signs observations: {vital_signs:,}")
    
    # Check for lab results
    lab_results = await conn.fetchval("""
        SELECT COUNT(*)
        FROM fhir.resources
        WHERE resource_type = 'Observation'
        AND resource->'category' @> '[{"coding":[{"code":"laboratory"}]}]'
    """)
    logger.info(f"  Laboratory observations: {lab_results:,}")

async def main():
    """Main initialization function"""
    logger.info("🚀 Starting complete database initialization...")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Create missing tables
        await create_missing_tables(conn)
        
        # Clean names
        await clean_patient_names(conn)
        await clean_practitioner_names(conn)
        
        # Fix URN references
        await fix_urn_references(conn)
        
        # Show summary
        await show_summary(conn)
        
        await conn.close()
        logger.info("\n✅ Database initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())