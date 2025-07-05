#!/usr/bin/env python3
"""
Unified Synthea FHIR Import Script

This script combines the best of both approaches:
- Optional FHIR validation with configurable strictness
- Comprehensive error tracking and reporting
- Performance optimizations
- Graceful error handling
- Detailed progress reporting
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import logging
from collections import defaultdict
import uuid

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from core.fhir.storage import FHIRStorageEngine
from core.fhir.profile_transformer import ProfileAwareFHIRTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ValidationResult:
    """Container for validation results."""
    
    def __init__(self, is_valid: bool, error: Optional[Exception] = None, 
                 resource_type: str = None, resource_id: str = None):
        self.is_valid = is_valid
        self.error = error
        self.error_type = type(error).__name__ if error else None
        self.error_message = str(error) if error else None
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.timestamp = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'is_valid': self.is_valid,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'error_type': self.error_type,
            'error_message': self.error_message,
            'timestamp': self.timestamp.isoformat()
        }


class UnifiedSyntheaImporter:
    """Unified Synthea FHIR importer with configurable validation."""
    
    def __init__(self, batch_size: int = 50, validation_mode: str = 'transform_only',
                 max_validation_errors: int = 100):
        """
        Initialize the importer.
        
        Args:
            batch_size: Number of resources to process in each batch
            validation_mode: 'none', 'transform_only', 'light', or 'strict'
            max_validation_errors: Maximum validation errors to track
        """
        self.transformer = ProfileAwareFHIRTransformer()
        self.engine = None
        self.batch_size = batch_size
        self.validation_mode = validation_mode
        self.max_validation_errors = max_validation_errors
        
        # Validation modes:
        # - 'none': No validation, just transform and import
        # - 'transform_only': Only validate after transformation (recommended)
        # - 'light': Validate but continue on errors
        # - 'strict': Validate and skip resources that fail
        
        # Track statistics
        self.stats = {
            'total_files': 0,
            'total_processed': 0,
            'total_imported': 0,
            'total_failed': 0,
            'total_validation_errors': 0,
            'total_transformation_errors': 0,
            'errors_by_type': defaultdict(int),
            'resources_by_type': defaultdict(int),
            'validation_errors_by_type': defaultdict(int)
        }
        
        # Store validation errors for analysis (limited to prevent memory issues)
        self.validation_errors: List[ValidationResult] = []
        
        # Try to import fhir.resources for validation
        self.fhir_validation_available = False
        try:
            from fhir.resources import construct_fhir_element
            self.construct_fhir_element = construct_fhir_element
            self.fhir_validation_available = True
            logger.info("FHIR validation available using fhir.resources")
        except ImportError:
            logger.warning("fhir.resources not available, validation disabled")
    
    async def init_db(self):
        """Initialize database connection."""
        self.engine = create_async_engine(DATABASE_URL, echo=False)
    
    async def close_db(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
    
    def validate_resource(self, resource_data: Dict, stage: str = "unknown") -> ValidationResult:
        """
        Validate a FHIR resource using fhir.resources if available.
        
        Args:
            resource_data: The resource to validate
            stage: "original" or "transformed" for tracking
            
        Returns:
            ValidationResult object
        """
        resource_type = resource_data.get('resourceType')
        resource_id = resource_data.get('id')
        
        if not self.fhir_validation_available or self.validation_mode == 'none':
            return ValidationResult(True, None, resource_type, resource_id)
        
        try:
            if not resource_type:
                raise ValueError("Missing resourceType")
            
            # Construct FHIR resource to validate
            fhir_resource = self.construct_fhir_element(resource_type, resource_data)
            
            # If we get here, the resource is valid
            return ValidationResult(True, None, resource_type, resource_id)
            
        except Exception as e:
            return ValidationResult(False, e, resource_type, resource_id)
    
    async def import_bundle_file(self, file_path: str) -> bool:
        """
        Import a single FHIR bundle file.
        
        Args:
            file_path: Path to the FHIR bundle JSON file
            
        Returns:
            True if successful, False otherwise
        """
        file_name = Path(file_path).name
        logger.info(f"Processing bundle: {file_name}")
        
        try:
            with open(file_path, 'r') as f:
                bundle_data = json.load(f)
            
            if bundle_data.get('resourceType') != 'Bundle':
                logger.warning(f"Not a Bundle resource: {file_name}")
                return False
            
            entries = bundle_data.get('entry', [])
            logger.info(f"Found {len(entries)} resources in {file_name}")
            
            # Process in batches
            async with AsyncSession(self.engine) as session:
                storage = FHIRStorageEngine(session)
                
                for i in range(0, len(entries), self.batch_size):
                    batch = entries[i:i + self.batch_size]
                    await self._process_batch(session, storage, batch)
                
                await session.commit()
            
            self.stats['total_files'] += 1
            return True
            
        except Exception as e:
            logger.error(f"Failed to process bundle {file_name}: {e}")
            return False
    
    async def _process_batch(self, session, storage, batch: List[Dict]):
        """Process a batch of resources with configurable validation."""
        for entry in batch:
            resource = entry.get('resource', {})
            if not resource:
                continue
            
            resource_type = resource.get('resourceType')
            resource_id = resource.get('id')
            
            if not resource_type:
                continue
            
            self.stats['total_processed'] += 1
            
            try:
                # Step 1: Optional validation of original resource
                if self.validation_mode in ['light', 'strict']:
                    original_validation = self.validate_resource(resource, "original")
                    if not original_validation.is_valid:
                        self._track_validation_error(original_validation)
                        if self.validation_mode == 'strict':
                            self.stats['total_failed'] += 1
                            continue
                
                # Step 2: Transform the resource
                try:
                    transformed = self.transformer.transform_resource(resource)
                except Exception as transform_error:
                    self.stats['total_transformation_errors'] += 1
                    self.stats['errors_by_type'][f"{resource_type}: TransformationError"] += 1
                    logger.warning(f"Transformation failed for {resource_type}/{resource_id}: {transform_error}")
                    
                    if self.validation_mode == 'strict':
                        self.stats['total_failed'] += 1
                        continue
                    else:
                        # Use original resource if transformation fails
                        transformed = resource
                
                # Step 3: Optional validation of transformed resource
                if self.validation_mode in ['transform_only', 'light', 'strict']:
                    transformed_validation = self.validate_resource(transformed, "transformed")
                    if not transformed_validation.is_valid:
                        self._track_validation_error(transformed_validation)
                        if self.validation_mode == 'strict':
                            self.stats['total_failed'] += 1
                            continue
                
                # Step 4: Store the resource
                await self._store_resource(
                    session, resource_type, resource_id, transformed
                )
                
                self.stats['total_imported'] += 1
                self.stats['resources_by_type'][resource_type] += 1
                
                # Log progress every 100 resources
                if self.stats['total_imported'] % 100 == 0:
                    logger.info(f"Progress: {self.stats['total_imported']} resources imported")
                
            except Exception as e:
                self.stats['total_failed'] += 1
                error_key = f"{resource_type}: {type(e).__name__}"
                self.stats['errors_by_type'][error_key] += 1
                logger.error(f"Failed to import {resource_type}/{resource_id}: {e}")
    
    def _track_validation_error(self, validation_result: ValidationResult):
        """Track a validation error."""
        self.stats['total_validation_errors'] += 1
        
        error_key = f"{validation_result.resource_type}: {validation_result.error_type}"
        self.stats['validation_errors_by_type'][error_key] += 1
        
        # Only store detailed errors up to the limit
        if len(self.validation_errors) < self.max_validation_errors:
            self.validation_errors.append(validation_result)
    
    async def _store_resource(self, session, resource_type, resource_id, resource_data):
        """Store a resource in the database."""
        # Ensure resource has required metadata
        if 'id' not in resource_data:
            resource_data['id'] = resource_id or str(uuid.uuid4())
        
        if 'meta' not in resource_data:
            resource_data['meta'] = {}
        
        if 'versionId' not in resource_data['meta']:
            resource_data['meta']['versionId'] = '1'
        
        if 'lastUpdated' not in resource_data['meta']:
            resource_data['meta']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
        
        # Insert into FHIR storage
        query = text("""
            INSERT INTO fhir.resources (
                resource_type, fhir_id, version_id, last_updated, resource
            ) VALUES (
                :resource_type, :fhir_id, :version_id, :last_updated, :resource
            )
            ON CONFLICT (resource_type, fhir_id) 
            DO UPDATE SET 
                version_id = fhir.resources.version_id + 1,
                last_updated = EXCLUDED.last_updated,
                resource = EXCLUDED.resource
            RETURNING id
        """)
        
        result = await session.execute(query, {
            'resource_type': resource_type,
            'fhir_id': resource_data['id'],
            'version_id': 1,
            'last_updated': datetime.now(timezone.utc),
            'resource': json.dumps(resource_data)
        })
        
        resource_id = result.scalar()
        
        # Extract basic search parameters
        await self._extract_search_params(session, resource_id, resource_type, resource_data)
    
    async def _extract_search_params(self, session, resource_id, resource_type, resource_data):
        """Extract and store search parameters for the resource."""
        # Always index the resource ID
        await self._add_search_param(
            session, resource_id, '_id', 'token', 
            value_string=resource_data.get('id')
        )
        
        # Extract common search parameters based on resource type
        if resource_type == 'Patient':
            # Name
            if 'name' in resource_data:
                for name in resource_data['name']:
                    if 'family' in name:
                        await self._add_search_param(
                            session, resource_id, 'family', 'string',
                            value_string=name['family']
                        )
                    if 'given' in name:
                        for given in name['given']:
                            await self._add_search_param(
                                session, resource_id, 'given', 'string',
                                value_string=given
                            )
            
            # Gender
            if 'gender' in resource_data:
                await self._add_search_param(
                    session, resource_id, 'gender', 'token',
                    value_string=resource_data['gender']
                )
            
            # Birthdate
            if 'birthDate' in resource_data:
                from datetime import datetime
                birthdate = resource_data['birthDate']
                # Convert string to date if needed
                if isinstance(birthdate, str):
                    try:
                        birthdate = datetime.fromisoformat(birthdate.replace('Z', '+00:00')).date()
                    except:
                        birthdate = datetime.strptime(birthdate, '%Y-%m-%d').date()
                
                await self._add_search_param(
                    session, resource_id, 'birthdate', 'date',
                    value_date=birthdate
                )
        
        elif resource_type in ['Encounter', 'Observation', 'Condition']:
            # Patient reference
            if 'subject' in resource_data and isinstance(resource_data['subject'], dict):
                ref = resource_data['subject'].get('reference', '')
                if ref.startswith('Patient/'):
                    patient_id = ref.split('/')[-1]
                    await self._add_search_param(
                        session, resource_id, 'patient', 'reference',
                        value_reference=patient_id
                    )
    
    async def _add_search_param(self, session, resource_id, param_name, param_type, **values):
        """Add a search parameter to the database."""
        query = text("""
            INSERT INTO fhir.search_params (
                resource_id, param_name, param_type,
                value_string, value_number, value_date,
                value_token_system, value_token_code, value_reference
            ) VALUES (
                :resource_id, :param_name, :param_type,
                :value_string, :value_number, :value_date,
                :value_token_system, :value_token_code, :value_reference
            )
            ON CONFLICT DO NOTHING
        """)
        
        await session.execute(query, {
            'resource_id': resource_id,
            'param_name': param_name,
            'param_type': param_type,
            'value_string': values.get('value_string'),
            'value_number': values.get('value_number'),
            'value_date': values.get('value_date'),
            'value_token_system': values.get('value_token_system'),
            'value_token_code': values.get('value_token_code'),
            'value_reference': values.get('value_reference')
        })
    
    def save_validation_report(self, filename: str = "validation_errors_report.json"):
        """Save validation errors to a JSON file for analysis."""
        report = {
            'summary': self.stats,
            'validation_mode': self.validation_mode,
            'fhir_validation_available': self.fhir_validation_available,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'validation_errors': [error.to_dict() for error in self.validation_errors]
        }
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Validation report saved to {filename}")
    
    def print_summary(self):
        """Print import summary."""
        print("\n" + "="*70)
        print("📊 Unified Synthea Import Summary")
        print("="*70)
        print(f"Validation Mode: {self.validation_mode}")
        print(f"FHIR Validation Available: {self.fhir_validation_available}")
        print(f"Total Files Processed: {self.stats['total_files']}")
        print(f"Total Resources Processed: {self.stats['total_processed']}")
        print(f"Successfully Imported: {self.stats['total_imported']}")
        print(f"Failed: {self.stats['total_failed']}")
        print(f"Transformation Errors: {self.stats['total_transformation_errors']}")
        print(f"Validation Errors: {self.stats['total_validation_errors']}")
        
        if self.stats['resources_by_type']:
            print("\n✅ Resources by Type:")
            for resource_type, count in sorted(self.stats['resources_by_type'].items()):
                print(f"  {resource_type}: {count}")
        
        if self.stats['validation_errors_by_type']:
            print("\n⚠️ Validation Errors by Type:")
            for error_type, count in sorted(self.stats['validation_errors_by_type'].items()):
                print(f"  {error_type}: {count}")
        
        if self.stats['errors_by_type']:
            print("\n❌ Other Errors by Type:")
            for error_type, count in sorted(self.stats['errors_by_type'].items()):
                print(f"  {error_type}: {count}")
        
        # Success rate calculation
        total_attempts = self.stats['total_processed']
        if total_attempts > 0:
            success_rate = (self.stats['total_imported'] / total_attempts) * 100
            print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        print("="*70)


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Unified Synthea FHIR import with configurable validation')
    parser.add_argument(
        'directory',
        nargs='?',
        default='../synthea/output/fhir',
        help='Directory containing FHIR bundles (default: ../synthea/output/fhir)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Number of resources to process in each batch (default: 50)'
    )
    parser.add_argument(
        '--pattern',
        default='*.json',
        help='File pattern to match (default: *.json)'
    )
    parser.add_argument(
        '--validation-mode',
        choices=['none', 'transform_only', 'light', 'strict'],
        default='transform_only',
        help='Validation mode (default: transform_only)'
    )
    parser.add_argument(
        '--max-validation-errors',
        type=int,
        default=100,
        help='Maximum validation errors to track (default: 100)'
    )
    parser.add_argument(
        '--report-file',
        default='unified_import_report.json',
        help='Output file for validation report (default: unified_import_report.json)'
    )
    
    args = parser.parse_args()
    
    directory = Path(args.directory)
    if not directory.exists():
        print(f"❌ Directory not found: {directory}")
        return
    
    print("🚀 Starting Unified Synthea FHIR Import")
    print(f"📁 Source directory: {directory}")
    print(f"📦 Batch size: {args.batch_size}")
    print(f"🔍 Validation mode: {args.validation_mode}")
    
    importer = UnifiedSyntheaImporter(
        batch_size=args.batch_size,
        validation_mode=args.validation_mode,
        max_validation_errors=args.max_validation_errors
    )
    await importer.init_db()
    
    try:
        # Find all matching files
        files = sorted(directory.glob(args.pattern))
        print(f"📄 Found {len(files)} files to import")
        
        # Import each file
        for file_path in files:
            await importer.import_bundle_file(str(file_path))
        
        importer.print_summary()
        
        # Save validation report if there were validation errors
        if importer.validation_errors or args.validation_mode != 'none':
            importer.save_validation_report(args.report_file)
            print(f"\n📝 Import report saved to {args.report_file}")
        
    finally:
        await importer.close_db()


if __name__ == "__main__":
    asyncio.run(main())