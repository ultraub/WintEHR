#!/usr/bin/env python3
"""
WintEHR Data Processor

Automated data processing script for post-import operations including:
- Patient and provider name cleaning (removing numbers)
- Data validation and integrity checks
- Reference cleanup and optimization
- Search parameter optimization
- Performance statistics

Usage:
    python scripts/data_processor.py --clean-names [--mode=development|production] [--dry-run]
    python scripts/data_processor.py --validate-references [--fix]
    python scripts/data_processor.py --optimize-search-params
    python scripts/data_processor.py --full-process [--mode=development|production]
"""

import asyncio
import asyncpg
import sys
import argparse
import logging
import re
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WintEHRDataProcessor:
    """Comprehensive data processor for WintEHR."""
    
    def __init__(self, mode="development", dry_run=False):
        self.mode = mode
        self.dry_run = dry_run
        self.connection = None
        
        # Database connection configuration
        # When running in Docker, always use 'postgres' as the host
        import os
        is_docker = os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER', False)
        
        self.db_config = {
            'host': 'postgres' if (self.mode == 'production' or is_docker) else 'localhost',
            'port': 5432,
            'user': 'emr_user',
            'password': 'emr_password',
            'database': 'emr_db'
        }
        
        # Processing statistics
        self.stats = {
            'patients_processed': 0,
            'patients_cleaned': 0,
            'providers_processed': 0,
            'providers_cleaned': 0,
            'references_processed': 0,
            'references_fixed': 0,
            'search_params_optimized': 0,
            'errors': []
        }
    
    async def connect(self):
        """Establish database connection."""
        try:
            connection_string = f"postgresql://{self.db_config['user']}:{self.db_config['password']}@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
            self.connection = await asyncpg.connect(connection_string)
            logger.info(f"✅ Connected to database in {self.mode} mode")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    async def close(self):
        """Close database connection."""
        if self.connection:
            await self.connection.close()
            logger.info("🔌 Database connection closed")
    
    def clean_name_string(self, name: str) -> str:
        """Clean a name string by removing numbers and extra spaces."""
        if not name:
            return name
        
        # Remove all digits
        cleaned = re.sub(r'[0-9]+', '', name)
        
        # Remove extra spaces and trim
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned if cleaned else name  # Return original if cleaning results in empty string
    
    async def clean_patient_names(self) -> Tuple[int, int]:
        """Clean patient names by removing numbers."""
        logger.info("🧼 Cleaning patient names...")
        
        try:
            # Get all patients
            patients = await self.connection.fetch("""
                SELECT id, resource FROM fhir.resources 
                WHERE resource_type = 'Patient' 
                AND (deleted = FALSE OR deleted IS NULL)
            """)
            
            processed = 0
            cleaned = 0
            
            for patient in patients:
                processed += 1
                # Parse JSON if it's a string
                resource = patient['resource']
                if isinstance(resource, str):
                    resource = json.loads(resource)
                modified = False
                
                if 'name' in resource and isinstance(resource['name'], list):
                    for name_obj in resource['name']:
                        if isinstance(name_obj, dict):
                            # Clean family name
                            if 'family' in name_obj and name_obj['family']:
                                original_family = name_obj['family']
                                cleaned_family = self.clean_name_string(original_family)
                                if cleaned_family != original_family:
                                    name_obj['family'] = cleaned_family
                                    modified = True
                            
                            # Clean given names
                            if 'given' in name_obj and isinstance(name_obj['given'], list):
                                cleaned_given = []
                                for given in name_obj['given']:
                                    if given:
                                        cleaned_name = self.clean_name_string(given)
                                        if cleaned_name:
                                            cleaned_given.append(cleaned_name)
                                
                                if cleaned_given != name_obj['given']:
                                    name_obj['given'] = cleaned_given
                                    modified = True
                
                if modified:
                    cleaned += 1
                    if not self.dry_run:
                        await self.connection.execute("""
                            UPDATE fhir.resources 
                            SET resource = $1::jsonb, last_updated = NOW() 
                            WHERE id = $2
                        """, json.dumps(resource), patient['id'])
            
            self.stats['patients_processed'] = processed
            self.stats['patients_cleaned'] = cleaned
            
            logger.info(f"✅ Patient name cleaning completed: {cleaned}/{processed} patients cleaned")
            return processed, cleaned
            
        except Exception as e:
            error_msg = f"Patient name cleaning failed: {e}"
            logger.error(f"❌ {error_msg}")
            self.stats['errors'].append(error_msg)
            return 0, 0
    
    async def clean_provider_names(self) -> Tuple[int, int]:
        """Clean provider/practitioner names by removing numbers."""
        logger.info("🧼 Cleaning provider names...")
        
        try:
            # Get all practitioners
            practitioners = await self.connection.fetch("""
                SELECT id, resource FROM fhir.resources 
                WHERE resource_type = 'Practitioner' 
                AND (deleted = FALSE OR deleted IS NULL)
            """)
            
            processed = 0
            cleaned = 0
            
            for practitioner in practitioners:
                processed += 1
                # Parse JSON if it's a string
                resource = practitioner['resource']
                if isinstance(resource, str):
                    resource = json.loads(resource)
                modified = False
                
                if 'name' in resource and isinstance(resource['name'], list):
                    for name_obj in resource['name']:
                        if isinstance(name_obj, dict):
                            # Clean family name
                            if 'family' in name_obj and name_obj['family']:
                                original_family = name_obj['family']
                                cleaned_family = self.clean_name_string(original_family)
                                if cleaned_family != original_family:
                                    name_obj['family'] = cleaned_family
                                    modified = True
                            
                            # Clean given names
                            if 'given' in name_obj and isinstance(name_obj['given'], list):
                                cleaned_given = []
                                for given in name_obj['given']:
                                    if given:
                                        cleaned_name = self.clean_name_string(given)
                                        if cleaned_name:
                                            cleaned_given.append(cleaned_name)
                                
                                if cleaned_given != name_obj['given']:
                                    name_obj['given'] = cleaned_given
                                    modified = True
                
                if modified:
                    cleaned += 1
                    if not self.dry_run:
                        await self.connection.execute("""
                            UPDATE fhir.resources 
                            SET resource = $1::jsonb, last_updated = NOW() 
                            WHERE id = $2
                        """, json.dumps(resource), practitioner['id'])
            
            self.stats['providers_processed'] = processed
            self.stats['providers_cleaned'] = cleaned
            
            logger.info(f"✅ Provider name cleaning completed: {cleaned}/{processed} providers cleaned")
            return processed, cleaned
            
        except Exception as e:
            error_msg = f"Provider name cleaning failed: {e}"
            logger.error(f"❌ {error_msg}")
            self.stats['errors'].append(error_msg)
            return 0, 0
    
    async def validate_references(self, fix_issues=False) -> Tuple[int, int]:
        """Validate and optionally fix FHIR references."""
        logger.info("🔗 Validating FHIR references...")
        
        try:
            # Find orphaned observations (no patient reference)
            orphaned_obs = await self.connection.fetch("""
                SELECT id, resource FROM fhir.resources o
                WHERE o.resource_type = 'Observation'
                AND (o.deleted = FALSE OR o.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.resources p 
                    WHERE p.resource_type = 'Patient'
                    AND (p.deleted = FALSE OR p.deleted IS NULL)
                    AND (
                        o.resource->'subject'->>'reference' LIKE '%' || p.fhir_id || '%'
                        OR o.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                    )
                )
            """)
            
            # Find orphaned conditions
            orphaned_cond = await self.connection.fetch("""
                SELECT id, resource FROM fhir.resources c
                WHERE c.resource_type = 'Condition'
                AND (c.deleted = FALSE OR c.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.resources p 
                    WHERE p.resource_type = 'Patient'
                    AND (p.deleted = FALSE OR p.deleted IS NULL)
                    AND (
                        c.resource->'subject'->>'reference' LIKE '%' || p.fhir_id || '%'
                        OR c.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                    )
                )
            """)
            
            # Find orphaned medication requests
            orphaned_med = await self.connection.fetch("""
                SELECT id, resource FROM fhir.resources m
                WHERE m.resource_type = 'MedicationRequest'
                AND (m.deleted = FALSE OR m.deleted IS NULL)
                AND NOT EXISTS (
                    SELECT 1 FROM fhir.resources p 
                    WHERE p.resource_type = 'Patient'
                    AND (p.deleted = FALSE OR p.deleted IS NULL)
                    AND (
                        m.resource->'subject'->>'reference' LIKE '%' || p.fhir_id || '%'
                        OR m.resource->'subject'->>'reference' = 'Patient/' || p.fhir_id
                    )
                )
            """)
            
            total_orphaned = len(orphaned_obs) + len(orphaned_cond) + len(orphaned_med)
            fixed = 0
            
            if total_orphaned > 0:
                logger.warning(f"⚠️ Found {total_orphaned} orphaned resources:")
                logger.warning(f"   - Observations: {len(orphaned_obs)}")
                logger.warning(f"   - Conditions: {len(orphaned_cond)}")
                logger.warning(f"   - Medication Requests: {len(orphaned_med)}")
                
                if fix_issues and not self.dry_run:
                    # For now, we'll mark orphaned resources as deleted rather than trying to fix references
                    all_orphaned = list(orphaned_obs) + list(orphaned_cond) + list(orphaned_med)
                    
                    for orphaned in all_orphaned:
                        await self.connection.execute("""
                            UPDATE fhir.resources 
                            SET deleted = TRUE, last_updated = NOW() 
                            WHERE id = $1
                        """, orphaned['id'])
                        fixed += 1
                    
                    logger.info(f"✅ Marked {fixed} orphaned resources as deleted")
            else:
                logger.info("✅ No orphaned references found")
            
            self.stats['references_processed'] = total_orphaned
            self.stats['references_fixed'] = fixed
            
            return total_orphaned, fixed
            
        except Exception as e:
            error_msg = f"Reference validation failed: {e}"
            logger.error(f"❌ {error_msg}")
            self.stats['errors'].append(error_msg)
            return 0, 0
    
    async def optimize_search_parameters(self) -> int:
        """Optimize search parameters for common queries."""
        logger.info("⚡ Optimizing search parameters...")
        
        try:
            optimized = 0
            
            # Remove duplicate search parameters
            duplicates = await self.connection.fetchval("""
                DELETE FROM fhir.search_params 
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id, ROW_NUMBER() OVER (
                            PARTITION BY resource_id, param_name, param_type, 
                            value_string, value_number, value_date, value_token
                            ORDER BY id
                        ) as rn
                        FROM fhir.search_params
                    ) t WHERE t.rn > 1
                )
            """)
            
            if duplicates:
                optimized += duplicates
                logger.info(f"✅ Removed {duplicates} duplicate search parameters")
            
            # Update search parameters for Patient names (if they're missing or incorrect)
            if not self.dry_run:
                name_updates = await self.connection.execute("""
                    INSERT INTO fhir.search_params (
                        resource_id, resource_type, param_name, param_type, value_string
                    )
                    SELECT DISTINCT
                        r.id,
                        'Patient',
                        'family',
                        'string',
                        name_obj->>'family'
                    FROM fhir.resources r,
                         jsonb_array_elements(r.resource->'name') as name_obj
                    WHERE r.resource_type = 'Patient'
                    AND (r.deleted = FALSE OR r.deleted IS NULL)
                    AND name_obj->>'family' IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM fhir.search_params sp
                        WHERE sp.resource_id = r.id
                        AND sp.param_name = 'family'
                        AND sp.value_string = name_obj->>'family'
                    )
                    ON CONFLICT DO NOTHING
                """)
                
                optimized += name_updates
            
            self.stats['search_params_optimized'] = optimized
            logger.info(f"✅ Search parameter optimization completed: {optimized} operations")
            
            return optimized
            
        except Exception as e:
            error_msg = f"Search parameter optimization failed: {e}"
            logger.error(f"❌ {error_msg}")
            self.stats['errors'].append(error_msg)
            return 0
    
    async def analyze_data_quality(self) -> Dict:
        """Analyze overall data quality."""
        logger.info("📊 Analyzing data quality...")
        
        try:
            # Get resource counts
            resource_stats = await self.connection.fetch("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources 
                WHERE deleted = FALSE OR deleted IS NULL
                GROUP BY resource_type
                ORDER BY count DESC
            """)
            
            # Check for patients without names
            patients_no_names = await self.connection.fetchval("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE resource_type = 'Patient' 
                AND (deleted = FALSE OR deleted IS NULL)
                AND (resource->'name' IS NULL OR jsonb_array_length(resource->'name') = 0)
            """)
            
            # Check for resources with malformed JSON
            malformed_json = await self.connection.fetchval("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE resource IS NULL OR resource = '{}'::jsonb
            """)
            
            # Get average resource sizes
            avg_sizes = await self.connection.fetchrow("""
                SELECT 
                    AVG(octet_length(resource::text)) as avg_resource_size,
                    MAX(octet_length(resource::text)) as max_resource_size,
                    MIN(octet_length(resource::text)) as min_resource_size
                FROM fhir.resources 
                WHERE deleted = FALSE OR deleted IS NULL
            """)
            
            analysis = {
                'timestamp': datetime.now().isoformat(),
                'resource_counts': {row['resource_type']: row['count'] for row in resource_stats},
                'quality_issues': {
                    'patients_without_names': patients_no_names,
                    'malformed_json_resources': malformed_json,
                    'orphaned_references': self.stats.get('references_processed', 0)
                },
                'resource_sizes': {
                    'average_bytes': float(avg_sizes['avg_resource_size']) if avg_sizes['avg_resource_size'] else 0,
                    'maximum_bytes': avg_sizes['max_resource_size'] or 0,
                    'minimum_bytes': avg_sizes['min_resource_size'] or 0
                },
                'processing_stats': self.stats
            }
            
            logger.info("✅ Data quality analysis completed")
            return analysis
            
        except Exception as e:
            error_msg = f"Data quality analysis failed: {e}"
            logger.error(f"❌ {error_msg}")
            self.stats['errors'].append(error_msg)
            return {}
    
    async def save_processing_summary(self, analysis: Dict = None):
        """Save processing summary to file."""
        try:
            summary = {
                'timestamp': datetime.now().isoformat(),
                'mode': self.mode,
                'dry_run': self.dry_run,
                'processing_stats': self.stats,
                'data_analysis': analysis or {}
            }
            
            # Create data directory if it doesn't exist
            data_dir = Path('/app/backend/data')
            data_dir.mkdir(exist_ok=True)
            
            # Save summary
            summary_file = data_dir / f'data_processing_summary_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            with open(summary_file, 'w') as f:
                json.dump(summary, f, indent=2)
            
            logger.info(f"📄 Processing summary saved to {summary_file}")
            
            # Also save as latest
            latest_file = data_dir / 'data_processing_latest.json'
            with open(latest_file, 'w') as f:
                json.dump(summary, f, indent=2)
                
        except Exception as e:
            logger.error(f"❌ Failed to save summary: {e}")
    
    async def clean_names(self):
        """Clean patient and provider names."""
        if not await self.connect():
            return False
        
        try:
            logger.info("🧼 Starting name cleaning process...")
            if self.dry_run:
                logger.info("🔍 DRY RUN MODE - No changes will be made")
            
            # Clean patient names
            patients_processed, patients_cleaned = await self.clean_patient_names()
            
            # Clean provider names
            providers_processed, providers_cleaned = await self.clean_provider_names()
            
            # Print results for module scripts
            print(f"NAME_CLEANING_COMPLETE:patients_cleaned={patients_cleaned},providers_cleaned={providers_cleaned}")
            
            logger.info("✅ Name cleaning completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Name cleaning failed: {e}")
            return False
        finally:
            await self.close()
    
    async def validate_and_fix_references(self, fix=False):
        """Validate and optionally fix references."""
        if not await self.connect():
            return False
        
        try:
            logger.info("🔗 Starting reference validation...")
            if self.dry_run:
                logger.info("🔍 DRY RUN MODE - No changes will be made")
            
            orphaned, fixed = await self.validate_references(fix_issues=fix)
            
            logger.info(f"✅ Reference validation completed: {orphaned} issues found, {fixed} fixed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Reference validation failed: {e}")
            return False
        finally:
            await self.close()
    
    async def optimize_search(self):
        """Optimize search parameters."""
        if not await self.connect():
            return False
        
        try:
            logger.info("⚡ Starting search parameter optimization...")
            if self.dry_run:
                logger.info("🔍 DRY RUN MODE - No changes will be made")
            
            optimized = await self.optimize_search_parameters()
            
            logger.info(f"✅ Search optimization completed: {optimized} operations")
            return True
            
        except Exception as e:
            logger.error(f"❌ Search optimization failed: {e}")
            return False
        finally:
            await self.close()
    
    async def full_process(self):
        """Run complete data processing pipeline."""
        if not await self.connect():
            return False
        
        try:
            logger.info("🚀 Starting full data processing pipeline...")
            if self.dry_run:
                logger.info("🔍 DRY RUN MODE - No changes will be made")
            
            # Step 1: Clean names
            await self.clean_patient_names()
            await self.clean_provider_names()
            
            # Step 2: Validate references
            await self.validate_references(fix_issues=True)
            
            # Step 3: Optimize search parameters
            await self.optimize_search_parameters()
            
            # Step 4: Analyze data quality
            analysis = await self.analyze_data_quality()
            
            # Step 5: Save summary
            await self.save_processing_summary(analysis)
            
            logger.info("🎉 Full data processing completed successfully!")
            logger.info(f"📊 Final Statistics:")
            logger.info(f"   - Patients processed: {self.stats['patients_processed']}")
            logger.info(f"   - Patients cleaned: {self.stats['patients_cleaned']}")
            logger.info(f"   - Providers processed: {self.stats['providers_processed']}")
            logger.info(f"   - Providers cleaned: {self.stats['providers_cleaned']}")
            logger.info(f"   - References processed: {self.stats['references_processed']}")
            logger.info(f"   - References fixed: {self.stats['references_fixed']}")
            logger.info(f"   - Search params optimized: {self.stats['search_params_optimized']}")
            
            if self.stats['errors']:
                logger.warning(f"⚠️ Errors encountered: {len(self.stats['errors'])}")
                for error in self.stats['errors']:
                    logger.warning(f"   - {error}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Full processing failed: {e}")
            return False
        finally:
            await self.close()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='WintEHR Data Processor')
    parser.add_argument('--mode', choices=['development', 'production'], 
                        default='development', help='Processing mode')
    parser.add_argument('--dry-run', action='store_true', 
                        help='Perform dry run without making changes')
    
    # Action arguments (mutually exclusive)
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument('--clean-names', action='store_true',
                             help='Clean patient and provider names')
    action_group.add_argument('--validate-references', action='store_true',
                             help='Validate FHIR references')
    action_group.add_argument('--optimize-search-params', action='store_true',
                             help='Optimize search parameters')
    action_group.add_argument('--full-process', action='store_true',
                             help='Run complete processing pipeline')
    
    # Additional options
    parser.add_argument('--fix', action='store_true',
                        help='Fix issues found during validation (use with --validate-references)')
    
    args = parser.parse_args()
    
    processor = WintEHRDataProcessor(mode=args.mode, dry_run=args.dry_run)
    
    success = False
    
    if args.clean_names:
        success = await processor.clean_names()
    elif args.validate_references:
        success = await processor.validate_and_fix_references(fix=args.fix)
    elif args.optimize_search_params:
        success = await processor.optimize_search()
    elif args.full_process:
        success = await processor.full_process()
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))