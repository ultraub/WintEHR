#!/usr/bin/env python3
"""
Reset resource versions to match their history entries.
This ensures updates can proceed without conflicts.
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


async def reset_versions():
    """Reset resource versions to be one higher than max history version."""
    engine = create_async_engine(
        DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
        echo=False
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        logging.info("🔧 Resetting resource versions to fix update issues...")
        
        # Temporarily disable the trigger
        await session.execute(text("ALTER TABLE fhir.resources DISABLE TRIGGER resource_history_trigger"))
        
        # Update all resources to have version = max_history_version + 1
        await session.execute(text("""
            UPDATE fhir.resources r
            SET version_id = subq.next_version,
                resource = jsonb_set(
                    resource,
                    '{meta,versionId}',
                    to_jsonb(subq.next_version::text)
                )
            FROM (
                SELECT 
                    r.id,
                    COALESCE(MAX(h.version_id), 0) + 1 as next_version
                FROM fhir.resources r
                LEFT JOIN fhir.resource_history h ON r.id = h.resource_id
                WHERE r.deleted = false
                GROUP BY r.id
            ) subq
            WHERE r.id = subq.id
            AND r.resource ? 'meta'
        """))
        
        # For resources without meta, just update version_id
        await session.execute(text("""
            UPDATE fhir.resources r
            SET version_id = subq.next_version
            FROM (
                SELECT 
                    r.id,
                    COALESCE(MAX(h.version_id), 0) + 1 as next_version
                FROM fhir.resources r
                LEFT JOIN fhir.resource_history h ON r.id = h.resource_id
                WHERE r.deleted = false
                GROUP BY r.id
            ) subq
            WHERE r.id = subq.id
            AND NOT (r.resource ? 'meta')
        """))
        
        # Re-enable the trigger
        await session.execute(text("ALTER TABLE fhir.resources ENABLE TRIGGER resource_history_trigger"))
        
        # Verify the fix
        result = await session.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT r.id
                FROM fhir.resources r
                JOIN fhir.resource_history h ON r.id = h.resource_id
                WHERE r.deleted = false
                AND r.version_id = h.version_id
            ) AS conflicts
        """))
        
        conflict_count = result.scalar()
        if conflict_count == 0:
            logging.info("✅ All version conflicts resolved!")
        else:
            logging.warning(f"⚠️  Still {conflict_count} version conflicts")
        
        await session.commit()
        logging.info("✅ Version reset completed!")
        
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_versions())