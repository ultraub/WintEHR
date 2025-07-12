#!/usr/bin/env python3
"""
Fix resource history versioning conflicts and patient name cleaning.
This script addresses:
1. Duplicate version_id entries in resource_history table
2. Cleans Synthea-generated patient names (removes numbers)
"""

import asyncio
import sys
import re
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import logging

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
from database import DATABASE_URL

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


class VersioningFixer:
    def __init__(self):
        self.engine = None
        self.issues_fixed = 0
        
    async def connect(self):
        """Create database connection."""
        self.engine = create_async_engine(
            DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
            echo=False
        )
        return sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
    
    async def fix_duplicate_history_entries(self, session):
        """Remove duplicate resource_history entries keeping only the latest."""
        logging.info("🔧 Fixing duplicate resource_history entries...")
        
        # Find duplicates
        result = await session.execute(text("""
            SELECT resource_id, version_id, COUNT(*) as cnt
            FROM fhir.resource_history
            GROUP BY resource_id, version_id
            HAVING COUNT(*) > 1
        """))
        
        duplicates = result.fetchall()
        
        if not duplicates:
            logging.info("✅ No duplicate history entries found")
            return
        
        logging.info(f"Found {len(duplicates)} duplicate history entries")
        
        for resource_id, version_id, count in duplicates:
            # Keep the latest entry, delete others
            await session.execute(text("""
                DELETE FROM fhir.resource_history
                WHERE resource_id = :resource_id 
                AND version_id = :version_id
                AND id NOT IN (
                    SELECT MAX(id)
                    FROM fhir.resource_history
                    WHERE resource_id = :resource_id 
                    AND version_id = :version_id
                )
            """), {
                'resource_id': resource_id,
                'version_id': version_id
            })
            self.issues_fixed += count - 1
        
        logging.info(f"✅ Removed {self.issues_fixed} duplicate history entries")
    
    async def fix_history_constraint(self, session):
        """Ensure the unique constraint exists on resource_history table."""
        logging.info("🔧 Checking resource_history constraints...")
        
        # Check if constraint exists
        result = await session.execute(text("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'fhir'
            AND table_name = 'resource_history'
            AND constraint_type = 'UNIQUE'
            AND constraint_name = 'resource_history_unique'
        """))
        
        if not result.fetchone():
            logging.info("Creating unique constraint on resource_history...")
            try:
                await session.execute(text("""
                    ALTER TABLE fhir.resource_history
                    ADD CONSTRAINT resource_history_unique UNIQUE (resource_id, version_id)
                """))
                logging.info("✅ Created unique constraint")
            except Exception as e:
                logging.warning(f"Could not create constraint: {e}")
        else:
            logging.info("✅ Unique constraint already exists")
    
    async def clean_patient_names(self, session):
        """Clean Synthea-generated patient names by removing numbers."""
        logging.info("🧹 Cleaning patient names...")
        
        # Get all patients
        result = await session.execute(text("""
            SELECT id, fhir_id, resource
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
        """))
        
        patients = result.fetchall()
        cleaned_count = 0
        
        for db_id, fhir_id, resource_data in patients:
            if isinstance(resource_data, str):
                import json
                resource_data = json.loads(resource_data)
            
            modified = False
            
            # Clean name array
            if 'name' in resource_data and isinstance(resource_data['name'], list):
                for name in resource_data['name']:
                    # Clean given names
                    if 'given' in name and isinstance(name['given'], list):
                        cleaned_given = []
                        for given_name in name['given']:
                            # Remove trailing numbers (e.g., "John123" becomes "John")
                            cleaned = re.sub(r'\d+$', '', given_name)
                            if cleaned != given_name:
                                modified = True
                            cleaned_given.append(cleaned)
                        name['given'] = cleaned_given
                    
                    # Clean family name
                    if 'family' in name:
                        cleaned_family = re.sub(r'\d+$', '', name['family'])
                        if cleaned_family != name['family']:
                            modified = True
                            name['family'] = cleaned_family
            
            if modified:
                # Update the resource
                import json
                await session.execute(text("""
                    UPDATE fhir.resources
                    SET resource = :resource
                    WHERE id = :id
                """), {
                    'id': db_id,
                    'resource': json.dumps(resource_data)
                })
                cleaned_count += 1
                logging.info(f"  Cleaned patient {fhir_id}")
        
        logging.info(f"✅ Cleaned {cleaned_count} patient names")
    
    async def fix_version_sync_on_update(self, session):
        """Fix the storage.py logic to prevent version conflicts."""
        logging.info("🔧 Fixing version increment logic...")
        
        # Check current max versions to ensure consistency
        result = await session.execute(text("""
            SELECT r.id, r.fhir_id, r.version_id, 
                   COALESCE(MAX(h.version_id), 0) as max_history_version
            FROM fhir.resources r
            LEFT JOIN fhir.resource_history h ON r.id = h.resource_id
            WHERE r.deleted = false
            GROUP BY r.id, r.fhir_id, r.version_id
            HAVING r.version_id <= COALESCE(MAX(h.version_id), 0)
        """))
        
        mismatched = result.fetchall()
        if mismatched:
            logging.info(f"Found {len(mismatched)} resources with version mismatches")
            for resource_id, fhir_id, current_version, max_history_version in mismatched:
                new_version = max_history_version + 1
                await session.execute(text("""
                    UPDATE fhir.resources
                    SET version_id = :version_id
                    WHERE id = :id
                """), {
                    'id': resource_id,
                    'version_id': new_version
                })
                logging.info(f"  Updated {fhir_id} version from {current_version} to {new_version}")
        else:
            logging.info("✅ All resource versions are in sync")
    
    async def run(self):
        """Run all fixes."""
        logging.info("🚀 Starting Versioning and Name Fixes")
        logging.info("=" * 60)
        
        async_session = await self.connect()
        
        try:
            async with async_session() as session:
                # Fix duplicate history entries first
                await self.fix_duplicate_history_entries(session)
                
                # Ensure constraint exists
                await self.fix_history_constraint(session)
                
                # Fix version synchronization
                await self.fix_version_sync_on_update(session)
                
                # Clean patient names
                await self.clean_patient_names(session)
                
                await session.commit()
                
            logging.info("\n✅ All fixes completed successfully!")
            
        except Exception as e:
            logging.error(f"❌ Error during fixes: {e}")
            await session.rollback()
            raise
        finally:
            if self.engine:
                await self.engine.dispose()


async def main():
    fixer = VersioningFixer()
    await fixer.run()


if __name__ == "__main__":
    asyncio.run(main())