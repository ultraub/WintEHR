#!/usr/bin/env python3
"""
Migration script to re-index all existing resources with comprehensive search parameters
"""

import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL

# Import the improved synthea_master to get the new search parameter extraction
from scripts.synthea_master import SyntheaMaster


class SearchParamMigrator:
    """Migrate existing resources to use comprehensive search parameters."""
    
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.engine = None
        self.stats = defaultdict(int)
        self.synthea_master = SyntheaMaster()
    
    async def migrate(self):
        """Run the migration."""
        print("=== SEARCH PARAMETER MIGRATION ===\n")
        print("This will re-index all existing resources with comprehensive search parameters.")
        print("This may take several minutes depending on the number of resources.\n")
        
        self.engine = create_async_engine(DATABASE_URL, echo=False)
        
        try:
            # Get resource types to migrate
            resource_types = await self._get_resource_types()
            
            print(f"Found {len(resource_types)} resource types to migrate:\n")
            for rtype, count in resource_types:
                print(f"  {rtype:<30} {count:>8} resources")
            
            print("\nStarting migration...\n")
            
            # Migrate each resource type
            for resource_type, total_count in resource_types:
                await self._migrate_resource_type(resource_type, total_count)
            
            # Print summary
            self._print_summary()
            
            # Check improvements
            await self._check_improvements()
            
        finally:
            if self.engine:
                await self.engine.dispose()
    
    async def _get_resource_types(self):
        """Get all resource types and counts."""
        async with AsyncSession(self.engine) as session:
            result = await session.execute(text("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources
                WHERE deleted = FALSE OR deleted IS NULL
                GROUP BY resource_type
                ORDER BY count DESC
            """))
            
            return [(row.resource_type, row.count) for row in result]
    
    async def _migrate_resource_type(self, resource_type: str, total_count: int):
        """Migrate all resources of a given type."""
        print(f"Migrating {resource_type} ({total_count} resources)...")
        
        migrated = 0
        errors = 0
        
        # Process in batches
        for offset in range(0, total_count, self.batch_size):
            async with AsyncSession(self.engine) as session:
                # Get batch of resources
                result = await session.execute(text("""
                    SELECT id, fhir_id, resource
                    FROM fhir.resources
                    WHERE resource_type = :resource_type
                    AND (deleted = FALSE OR deleted IS NULL)
                    ORDER BY id
                    LIMIT :limit OFFSET :offset
                """), {
                    'resource_type': resource_type,
                    'limit': self.batch_size,
                    'offset': offset
                })
                
                resources = result.fetchall()
                
                for row in resources:
                    try:
                        # Delete existing search params for this resource
                        await session.execute(text("""
                            DELETE FROM fhir.search_params
                            WHERE resource_id = :resource_id
                        """), {'resource_id': row.id})
                        
                        # Extract new search params using improved method
                        await self.synthea_master._extract_search_params(
                            session, row.id, resource_type, row.resource
                        )
                        
                        migrated += 1
                        self.stats[f'{resource_type}_migrated'] += 1
                        
                    except Exception as e:
                        errors += 1
                        self.stats[f'{resource_type}_errors'] += 1
                        if errors <= 5:  # Log first few errors
                            print(f"  Error migrating {resource_type}/{row.fhir_id}: {e}")
                
                await session.commit()
                
                # Progress update
                progress = min(offset + len(resources), total_count)
                pct = (progress / total_count) * 100
                print(f"  Progress: {progress}/{total_count} ({pct:.1f}%)")
        
        print(f"  ✓ Completed: {migrated} migrated, {errors} errors\n")
    
    def _print_summary(self):
        """Print migration summary."""
        print("\n=== MIGRATION SUMMARY ===\n")
        
        total_migrated = 0
        total_errors = 0
        
        for key, value in sorted(self.stats.items()):
            if key.endswith('_migrated'):
                resource_type = key.replace('_migrated', '')
                errors = self.stats.get(f'{resource_type}_errors', 0)
                print(f"{resource_type:<30} Migrated: {value:>8}  Errors: {errors:>5}")
                total_migrated += value
                total_errors += errors
        
        print("-" * 60)
        print(f"{'TOTAL':<30} Migrated: {total_migrated:>8}  Errors: {total_errors:>5}")
        
        if total_errors > 0:
            print("\n⚠️  Some resources failed to migrate. Check logs for details.")
        else:
            print("\n✅ Migration completed successfully!")
    
    async def _check_improvements(self):
        """Check if key resources are now properly indexed."""
        async with AsyncSession(self.engine) as session:
            # Check ServiceRequest indexing
            result = await session.execute(text("""
                SELECT COUNT(DISTINCT resource_id) 
                FROM fhir.search_params
                WHERE resource_type = 'ServiceRequest'
                AND param_name = 'patient'
            """))
            sr_count = result.scalar()
            
            # Check total ServiceRequests
            result = await session.execute(text("""
                SELECT COUNT(*) 
                FROM fhir.resources
                WHERE resource_type = 'ServiceRequest'
            """))
            sr_total = result.scalar()
            
            print(f"ServiceRequest patient index: {sr_count}/{sr_total} ({sr_count/sr_total*100:.1f}% indexed)")
            
            # Check other key parameters
            checks = [
                ('ServiceRequest', 'status'),
                ('ServiceRequest', 'code'),
                ('CarePlan', 'patient'),
                ('CareTeam', 'patient'),
                ('DocumentReference', 'patient'),
                ('Organization', 'name'),
                ('Practitioner', 'name')
            ]
            
            for resource_type, param_name in checks:
                result = await session.execute(text("""
                    SELECT COUNT(DISTINCT resource_id) 
                    FROM fhir.search_params
                    WHERE resource_type = :rtype
                    AND param_name = :pname
                """), {'rtype': resource_type, 'pname': param_name})
                
                count = result.scalar()
                if count > 0:
                    print(f"  ✓ {resource_type}.{param_name}: {count} indexed")


async def main():
    """Run the migration with confirmation."""
    print("Search Parameter Migration Tool")
    print("==============================\n")
    print("This will re-index all FHIR resources with comprehensive search parameters.")
    print("This is necessary to enable searching on ServiceRequest, Coverage, and other resources.\n")
    
    # Get confirmation
    response = input("Do you want to proceed? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration cancelled.")
        return
    
    migrator = SearchParamMigrator()
    await migrator.migrate()


if __name__ == "__main__":
    asyncio.run(main())