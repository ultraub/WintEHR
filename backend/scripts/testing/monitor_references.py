#!/usr/bin/env python3
"""
Monitor and maintain FHIR references table health.

This script checks for:
- Resources without references
- Orphaned references
- Reference consistency
- Provides auto-fix capabilities

Similar to monitor_search_params.py but for references.
"""

import asyncio
import argparse
from datetime import datetime
from pathlib import Path
import sys
from typing import List, Dict, Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from database import DATABASE_URL

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ReferenceMonitor:
    """Monitor and fix FHIR reference integrity."""
    
    def __init__(self):
        self.engine = create_async_engine(
            DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
            echo=False
        )
        self.issues = []
        self.stats = {
            'total_resources': 0,
            'total_references': 0,
            'resources_without_refs': 0,
            'orphaned_refs': 0,
            'invalid_targets': 0,
            'fixed_count': 0
        }
    
    async def analyze(self):
        """Analyze reference health."""
        async with self.engine.connect() as conn:
            # Get total counts
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE deleted = FALSE OR deleted IS NULL
            """))
            self.stats['total_resources'] = result.scalar()
            
            result = await conn.execute(text("SELECT COUNT(*) FROM fhir.references"))
            self.stats['total_references'] = result.scalar()
            
            # Find resources that should have references but don't
            await self._find_resources_without_refs(conn)
            
            # Find orphaned references
            await self._find_orphaned_refs(conn)
            
            # Find references with invalid targets
            await self._find_invalid_targets(conn)
            
            # Check reference distribution
            await self._check_reference_distribution(conn)
    
    async def _find_resources_without_refs(self, conn):
        """Find resources that typically have references but don't."""
        # Resource types that typically have references
        ref_types = [
            'Observation', 'Condition', 'MedicationRequest', 'Procedure',
            'DiagnosticReport', 'Encounter', 'AllergyIntolerance',
            'CarePlan', 'Immunization', 'DocumentReference'
        ]
        
        for resource_type in ref_types:
            result = await conn.execute(text("""
                SELECT COUNT(*) 
                FROM fhir.resources r
                WHERE r.resource_type = :type
                AND (r.deleted = FALSE OR r.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.references ref 
                    WHERE ref.source_id = r.id
                )
            """), {'type': resource_type})
            
            count = result.scalar()
            if count > 0:
                self.issues.append({
                    'type': 'missing_references',
                    'resource_type': resource_type,
                    'count': count,
                    'severity': 'warning'
                })
                self.stats['resources_without_refs'] += count
    
    async def _find_orphaned_refs(self, conn):
        """Find references pointing to non-existent resources."""
        result = await conn.execute(text("""
            SELECT ref.id, ref.source_type, ref.target_type, ref.target_id
            FROM fhir.references ref
            WHERE NOT EXISTS (
                SELECT 1 FROM fhir.resources r 
                WHERE r.id = ref.source_id 
                AND (r.deleted = FALSE OR r.deleted IS NULL)
            )
            LIMIT 100
        """))
        
        orphaned = []
        for row in result:
            orphaned.append({
                'ref_id': row.id,
                'source_type': row.source_type,
                'target_type': row.target_type,
                'target_id': row.target_id
            })
        
        if orphaned:
            self.issues.append({
                'type': 'orphaned_references',
                'refs': orphaned,
                'count': len(orphaned),
                'severity': 'error'
            })
            self.stats['orphaned_refs'] = len(orphaned)
    
    async def _find_invalid_targets(self, conn):
        """Find references with invalid target resources."""
        result = await conn.execute(text("""
            SELECT ref.id, ref.source_type, ref.target_type, ref.target_id
            FROM fhir.references ref
            WHERE ref.target_type != 'Location?identifier=https:'
            AND ref.target_type != 'Organization?identifier=https:'
            AND ref.target_type != 'Practitioner?identifier=http:'
            AND NOT EXISTS (
                SELECT 1 FROM fhir.resources r 
                WHERE r.resource_type = ref.target_type 
                AND r.fhir_id = ref.target_id
                AND (r.deleted = FALSE OR r.deleted IS NULL)
            )
            LIMIT 100
        """))
        
        invalid = []
        for row in result:
            invalid.append({
                'ref_id': row.id,
                'source_type': row.source_type,
                'target_type': row.target_type,
                'target_id': row.target_id
            })
        
        if invalid:
            self.issues.append({
                'type': 'invalid_targets',
                'refs': invalid,
                'count': len(invalid),
                'severity': 'warning'
            })
            self.stats['invalid_targets'] = len(invalid)
    
    async def _check_reference_distribution(self, conn):
        """Check reference distribution across resource types."""
        result = await conn.execute(text("""
            SELECT source_type, COUNT(*) as ref_count,
                   COUNT(DISTINCT source_id) as resource_count
            FROM fhir.references
            GROUP BY source_type
            ORDER BY ref_count DESC
        """))
        
        distribution = []
        for row in result:
            avg_refs = row.ref_count / row.resource_count if row.resource_count > 0 else 0
            distribution.append({
                'resource_type': row.source_type,
                'total_refs': row.ref_count,
                'resource_count': row.resource_count,
                'avg_refs_per_resource': round(avg_refs, 2)
            })
        
        self.stats['distribution'] = distribution
    
    async def fix_issues(self):
        """Fix identified issues."""
        if not self.issues:
            logger.info("No issues to fix")
            return
        
        async with self.engine.begin() as conn:
            fixed_count = 0
            
            # Fix orphaned references
            orphaned_issues = [i for i in self.issues if i['type'] == 'orphaned_references']
            if orphaned_issues:
                logger.info("Removing orphaned references...")
                result = await conn.execute(text("""
                    DELETE FROM fhir.references ref
                    WHERE NOT EXISTS (
                        SELECT 1 FROM fhir.resources r 
                        WHERE r.id = ref.source_id 
                        AND (r.deleted = FALSE OR r.deleted IS NULL)
                    )
                """))
                fixed_count += result.rowcount
                logger.info(f"Removed {result.rowcount} orphaned references")
            
            # Fix missing references by re-extracting
            missing_ref_issues = [i for i in self.issues if i['type'] == 'missing_references']
            if missing_ref_issues:
                logger.info("Re-extracting missing references...")
                # This would require running the populate_references script
                # For now, just log the recommendation
                for issue in missing_ref_issues:
                    logger.warning(
                        f"{issue['resource_type']} has {issue['count']} resources without references. "
                        f"Run populate_references_urn_uuid.py to fix."
                    )
            
            self.stats['fixed_count'] = fixed_count
    
    def print_report(self):
        """Print detailed report."""
        print("\n" + "="*60)
        print("FHIR References Health Report")
        print("="*60)
        print(f"Generated: {datetime.now().isoformat()}")
        print()
        
        # Overall statistics
        print("📊 Overall Statistics:")
        print(f"  Total Resources: {self.stats['total_resources']:,}")
        print(f"  Total References: {self.stats['total_references']:,}")
        if self.stats['total_resources'] > 0:
            avg_refs = self.stats['total_references'] / self.stats['total_resources']
            print(f"  Average References per Resource: {avg_refs:.2f}")
        print()
        
        # Issues summary
        if self.issues:
            print("⚠️  Issues Found:")
            for issue in self.issues:
                if issue['type'] == 'missing_references':
                    print(f"  - {issue['resource_type']}: {issue['count']} resources without references")
                elif issue['type'] == 'orphaned_references':
                    print(f"  - Orphaned References: {issue['count']}")
                elif issue['type'] == 'invalid_targets':
                    print(f"  - Invalid Target References: {issue['count']}")
            print()
        else:
            print("✅ No issues found!")
            print()
        
        # Distribution
        if 'distribution' in self.stats and self.stats['distribution']:
            print("📈 Reference Distribution (Top 10):")
            for item in self.stats['distribution'][:10]:
                print(f"  {item['resource_type']:25} "
                      f"Refs: {item['total_refs']:6,} "
                      f"Resources: {item['resource_count']:6,} "
                      f"Avg: {item['avg_refs_per_resource']:5.1f}")
        
        print("\n" + "="*60)
        
        # Recommendations
        if self.stats['resources_without_refs'] > 0:
            print("\n💡 Recommendations:")
            print("  1. Run populate_references_urn_uuid.py to extract missing references")
            print("  2. Check if import process includes reference extraction")
            print("  3. Verify FHIRStorageEngine.create_resource() is being used")
        
        if self.stats['fixed_count'] > 0:
            print(f"\n✅ Fixed {self.stats['fixed_count']} issues")
    
    async def cleanup(self):
        """Clean up resources."""
        await self.engine.dispose()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Monitor and fix FHIR reference integrity"
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Automatically fix issues (removes orphaned refs)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )
    
    args = parser.parse_args()
    
    monitor = ReferenceMonitor()
    
    try:
        # Analyze
        logger.info("Analyzing FHIR references...")
        await monitor.analyze()
        
        # Fix if requested
        if args.fix:
            logger.info("Fixing issues...")
            await monitor.fix_issues()
        
        # Report
        if args.json:
            import json
            print(json.dumps({
                'stats': monitor.stats,
                'issues': monitor.issues
            }, indent=2))
        else:
            monitor.print_report()
    
    finally:
        await monitor.cleanup()


if __name__ == "__main__":
    asyncio.run(main())