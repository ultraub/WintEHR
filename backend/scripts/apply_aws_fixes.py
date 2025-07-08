#!/usr/bin/env python3
"""
Apply all AWS deployment fixes discovered during troubleshooting.
This script should be run on the AWS server after deployment.

Usage:
    python apply_aws_fixes.py [--check-only]
"""

import asyncio
import sys
import json
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))
from database import DATABASE_URL
import logging


class AWSFixes:
    def __init__(self, check_only=False):
        self.check_only = check_only
        self.engine = None
        self.issues_found = []
        self.fixes_applied = []
    
    async def connect(self):
        """Create database connection."""
        self.engine = create_async_engine(
            DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
            echo=False
        )
        return sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
    
    async def check_database_schema(self, session):
        """Check and fix database schema issues."""
        logging.info("🔍 Checking database schema...")
        # Check if all required tables exist
        required_tables = {
            'fhir.resources': True,
            'fhir.search_params': True,
            'fhir.resource_history': True,
            'fhir.references': True,
            'cds_hooks.hook_configurations': False  # Optional
        }
        
        for table, is_required in required_tables.items():
            schema, table_name = table.split('.')
            result = await session.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = '{schema}' 
                    AND table_name = '{table_name}'
                )
            """))
            exists = result.scalar()
            
            if not exists:
                if is_required:
                    self.issues_found.append(f"Missing required table: {table}")
                    if not self.check_only:
                        await self.create_missing_table(session, schema, table_name)
                else:
                    logging.info(f"  ⚠️  Optional table missing: {table}")
        # Check column types
        await self.check_column_types(session)
    
    async def check_column_types(self, session):
        """Check and fix column type issues."""
        # Check references.source_id type
        result = await session.execute(text("""
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'references' 
            AND column_name = 'source_id'
        """))
        row = result.fetchone()
        
        if row and row[0] == 'integer':
            self.issues_found.append("references.source_id is INTEGER, should be VARCHAR(64)")
            if not self.check_only:
                await session.execute(text(
                    "ALTER TABLE fhir.references ALTER COLUMN source_id TYPE VARCHAR(64)"
                ))
                self.fixes_applied.append("Fixed references.source_id type")
        
        # Check for missing columns
        result = await session.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'fhir' 
            AND table_name = 'search_params'
        """))
        columns = [row[0] for row in result]
        
        if 'resource_type' not in columns:
            self.issues_found.append("Missing search_params.resource_type column")
            if not self.check_only:
                await session.execute(text(
                    "ALTER TABLE fhir.search_params ADD COLUMN resource_type VARCHAR(50)"
                ))
                self.fixes_applied.append("Added search_params.resource_type column")
    
    async def create_missing_table(self, session, schema, table_name):
        """Create missing tables."""
        if schema == 'fhir' and table_name == 'resource_history':
            await session.execute(text("""
                CREATE TABLE fhir.resource_history (
                    id SERIAL PRIMARY KEY,
                    resource_id INTEGER NOT NULL,
                    version_id INTEGER NOT NULL,
                    operation VARCHAR(20) NOT NULL,
                    resource JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    
                    CONSTRAINT fk_resource_history_resource 
                        FOREIGN KEY (resource_id) 
                        REFERENCES fhir.resources(id) 
                        ON DELETE CASCADE,
                    
                    CONSTRAINT idx_resource_history_unique 
                        UNIQUE (resource_id, version_id)
                )
            """))
            self.fixes_applied.append("Created fhir.resource_history table")
        
        elif schema == 'fhir' and table_name == 'references':
            await session.execute(text("""
                CREATE TABLE fhir.references (
                    id SERIAL PRIMARY KEY,
                    source_id VARCHAR(64) NOT NULL,
                    source_type VARCHAR(50) NOT NULL,
                    target_id VARCHAR(64) NOT NULL,
                    target_type VARCHAR(50) NOT NULL,
                    path VARCHAR(200) NOT NULL,
                    
                    CONSTRAINT unique_reference UNIQUE (source_id, target_id, path)
                )
            """))
            
            # Create indexes
            await session.execute(text(
                "CREATE INDEX idx_references_source ON fhir.references(source_id)"
            ))
            await session.execute(text(
                "CREATE INDEX idx_references_target ON fhir.references(target_id)"
            ))
            await session.execute(text(
                "CREATE INDEX idx_references_types ON fhir.references(source_type, target_type)"
            ))
            self.fixes_applied.append("Created fhir.references table with indexes")
    
    async def fix_meta_version_sync(self, session):
        """Sync meta.versionId with database version_id."""
        logging.info("🔧 Checking meta version sync...")
        # Check if any resources have mismatched versions
        result = await session.execute(text("""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE resource->'meta'->>'versionId' != version_id::text
            AND resource->'meta' IS NOT NULL
        """))
        count = result.scalar()
        
        if count > 0:
            self.issues_found.append(f"{count} resources have mismatched meta.versionId")
            if not self.check_only:
                await session.execute(text("""
                    UPDATE fhir.resources 
                    SET resource = jsonb_set(
                        jsonb_set(
                            resource, 
                            '{meta,versionId}', 
                            to_jsonb(version_id::text)
                        ),
                        '{meta,lastUpdated}',
                        to_jsonb(to_char(last_updated, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
                    )
                    WHERE resource->'meta' IS NOT NULL
                """))
                self.fixes_applied.append(f"Fixed meta.versionId for {count} resources")
    
    async def check_storage_file(self):
        """Check and fix storage.py issues."""
        logging.info("📄 Checking storage.py...")
        storage_path = Path('/app/core/fhir/storage.py')
        
        if not storage_path.exists():
            logging.info("  ⚠️  storage.py not found at expected location")
            return
        
        content = storage_path.read_text()
        issues = []
        
        # Check for reference_path (should be path)
        if 'reference_path' in content:
            issues.append("storage.py uses 'reference_path' instead of 'path'")
            if not self.check_only:
                content = content.replace('reference_path', 'path')
        
        # Check for reference_value
        if 'reference_value' in content and 'INSERT INTO fhir.references' in content:
            issues.append("storage.py tries to insert non-existent 'reference_value'")
            if not self.check_only:
                # Remove reference_value from INSERT
                content = content.replace(
                    'source_id, source_type, target_type, target_id, path, reference_value',
                    'source_id, source_type, target_type, target_id, path'
                )
                content = content.replace(
                    ':source_id, :source_type, :target_type, :target_id, :path, :reference_value',
                    ':source_id, :source_type, :target_type, :target_id, :path'
                )
        
        # Check FHIRJSONEncoder for bytes handling
        if 'isinstance(obj, bytes)' not in content:
            issues.append("FHIRJSONEncoder doesn't handle bytes (base64 data)")
            if not self.check_only:
                # Add bytes handling to FHIRJSONEncoder
                encoder_fix = '''        # Handle bytes (base64 encoded data)
        if isinstance(obj, bytes):
            import base64
            return base64.b64encode(obj).decode('utf-8')'''
                
                # Insert before the final return statement
                content = content.replace(
                    '        return super().default(obj)',
                    f'{encoder_fix}\n        return super().default(obj)'
                )
        
        if issues:
            self.issues_found.extend(issues)
            if not self.check_only:
                storage_path.write_text(content)
                self.fixes_applied.append("Fixed storage.py issues")
    
    async def check_nginx_config(self):
        """Check nginx configuration."""
        logging.info("🌐 Checking nginx configuration...")
        nginx_path = Path('/etc/nginx/conf.d/default.conf')
        
        # This would need to be run inside the frontend container
        logging.info("  ℹ️  Note: nginx checks should be run in the frontend container")
        # Check if CDS Hooks location exists
        # Would need: docker exec emr-frontend grep '/cds-hooks' /etc/nginx/conf.d/default.conf
    
    async def run(self):
        """Run all checks and fixes."""
        logging.info("🚀 AWS Deployment Fixes")
        logging.info("=" * 60)
        async_session = await self.connect()
        
        try:
            async with async_session() as session:
                # Database checks
                await self.check_database_schema(session)
                await self.fix_meta_version_sync(session)
                
                if not self.check_only:
                    await session.commit()
            
            # File checks
            await self.check_storage_file()
            await self.check_nginx_config()
            
            # Summary
            logging.info("\n📊 Summary")
            logging.info("=" * 60)
            if self.issues_found:
                logging.info(f"\n❌ Issues found ({len(self.issues_found)}):")
                for issue in self.issues_found:
                    logging.info(f"  - {issue}")
            else:
                logging.info("\n✅ No issues found!")
            if self.fixes_applied:
                logging.info(f"\n✅ Fixes applied ({len(self.fixes_applied)}):")
                for fix in self.fixes_applied:
                    logging.info(f"  - {fix}")
            if self.check_only and self.issues_found:
                logging.info("\n💡 Run without --check-only to apply fixes")
        finally:
            if self.engine:
                await self.engine.dispose()


async def main():
    check_only = '--check-only' in sys.argv
    fixer = AWSFixes(check_only=check_only)
    await fixer.run()


if __name__ == "__main__":
    logging.info("Note: This script should be run on the AWS server")
    logging.info("Example: docker exec emr-backend python scripts/apply_aws_fixes.py")
    asyncio.run(main())