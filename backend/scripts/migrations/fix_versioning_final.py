#!/usr/bin/env python3
"""
Final comprehensive fix for resource history versioning conflicts.
This script ensures proper versioning synchronization between resources and history.
"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
from database import DATABASE_URL

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


async def fix_versioning_once_and_for_all():
    """Complete versioning fix."""
    engine = create_async_engine(
        DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
        echo=False
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        logging.info("🔧 Starting comprehensive versioning fix...")
        
        # Step 1: Get all resources with their current version and max history version
        result = await session.execute(text("""
            SELECT 
                r.id,
                r.fhir_id,
                r.resource_type,
                r.version_id as current_version,
                COALESCE(MAX(h.version_id), 0) as max_history_version
            FROM fhir.resources r
            LEFT JOIN fhir.resource_history h ON r.id = h.resource_id
            WHERE r.deleted = false
            GROUP BY r.id, r.fhir_id, r.resource_type, r.version_id
            ORDER BY r.id
        """))
        
        resources = result.fetchall()
        logging.info(f"Found {len(resources)} resources to check")
        
        # Step 2: Temporarily drop the unique constraint
        logging.info("Dropping unique constraint temporarily...")
        try:
            await session.execute(text("""
                ALTER TABLE fhir.resource_history 
                DROP CONSTRAINT IF EXISTS resource_history_unique
            """))
        except Exception as e:
            logging.warning(f"Could not drop constraint: {e}")
        
        # Step 3: Fix each resource
        fixed_count = 0
        for resource_id, fhir_id, resource_type, current_version, max_history_version in resources:
            if current_version <= max_history_version:
                # Resource version needs to be updated
                new_version = max_history_version + 1
                
                # Update resource version
                await session.execute(text("""
                    UPDATE fhir.resources
                    SET version_id = :new_version
                    WHERE id = :resource_id
                """), {
                    'resource_id': resource_id,
                    'new_version': new_version
                })
                
                # Also update the meta.versionId in the JSON
                await session.execute(text(f"""
                    UPDATE fhir.resources
                    SET resource = jsonb_set(
                        resource,
                        '{{meta,versionId}}',
                        '"{new_version}"'
                    )
                    WHERE id = {resource_id}
                    AND resource ? 'meta'
                """))
                
                fixed_count += 1
                if fixed_count % 100 == 0:
                    logging.info(f"  Fixed {fixed_count} resources...")
        
        logging.info(f"✅ Fixed {fixed_count} resources")
        
        # Step 4: Clean up any duplicate history entries
        logging.info("Cleaning duplicate history entries...")
        await session.execute(text("""
            DELETE FROM fhir.resource_history
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (PARTITION BY resource_id, version_id ORDER BY created_at DESC) as rn
                    FROM fhir.resource_history
                ) t
                WHERE t.rn > 1
            )
        """))
        
        # Step 5: Recreate the unique constraint
        logging.info("Recreating unique constraint...")
        await session.execute(text("""
            ALTER TABLE fhir.resource_history
            ADD CONSTRAINT resource_history_unique UNIQUE (resource_id, version_id)
        """))
        
        # Step 6: Verify the fix
        result = await session.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT r.id
                FROM fhir.resources r
                LEFT JOIN (
                    SELECT resource_id, MAX(version_id) as max_version
                    FROM fhir.resource_history
                    GROUP BY resource_id
                ) h ON r.id = h.resource_id
                WHERE r.deleted = false
                AND r.version_id <= COALESCE(h.max_version, 0)
            ) AS conflicts
        """))
        
        conflict_count = result.scalar()
        if conflict_count == 0:
            logging.info("✅ All versioning conflicts resolved!")
        else:
            logging.warning(f"⚠️  Still {conflict_count} conflicts remaining")
        
        await session.commit()
        logging.info("✅ Versioning fix completed successfully!")
        
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_versioning_once_and_for_all())