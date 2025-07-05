#!/usr/bin/env python3
"""
Synthea FHIR Import Script with Full Validation

This script imports Synthea-generated FHIR bundles with:
- Full FHIR R4 validation using fhir.resources
- Detailed error logging for analysis
- Profile-aware transformation
- Validation error documentation
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
from fhir.resources import construct_fhir_element

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ValidationError:
    """Container for validation error details."""
    
    def __init__(self, resource_type: str, resource_id: str, error: Exception, 
                 original_resource: Dict, transformed_resource: Optional[Dict] = None):
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.error = error
        self.error_type = type(error).__name__
        self.error_message = str(error)
        self.original_resource = original_resource
        self.transformed_resource = transformed_resource
        self.timestamp = datetime.now(timezone.utc)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'error_type': self.error_type,
            'error_message': self.error_message,
            'timestamp': self.timestamp.isoformat(),
            'original_resource': self.original_resource,
            'transformed_resource': self.transformed_resource
        }


class ValidatingSyntheaImporter:
    """Synthea FHIR importer with full validation."""
    
    def __init__(self, batch_size: int = 50, strict_validation: bool = True):
        """
        Initialize the importer.
        
        Args:
            batch_size: Number of resources to process in each batch
            strict_validation: If True, validate all resources with fhir.resources
        """
        self.transformer = ProfileAwareFHIRTransformer()
        self.engine = None
        self.batch_size = batch_size
        self.strict_validation = strict_validation
        
        # Track statistics
        self.stats = {
            'total_files': 0,
            'total_processed': 0,
            'total_imported': 0,
            'total_failed': 0,
            'total_validation_errors': 0,
            'errors_by_type': defaultdict(int),
            'resources_by_type': defaultdict(int),
            'validation_errors_by_type': defaultdict(int)
        }
        
        # Store validation errors for analysis
        self.validation_errors: List[ValidationError] = []
    
    async def init_db(self):
        """Initialize database connection."""
        self.engine = create_async_engine(DATABASE_URL, echo=False)
    
    async def close_db(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
    
    def validate_resource(self, resource_data: Dict) -> Tuple[bool, Optional[Exception]]:
        """
        Validate a FHIR resource using fhir.resources.
        
        Returns:
            Tuple of (is_valid, error_if_any)
        """
        try:
            resource_type = resource_data.get('resourceType')
            if not resource_type:
                raise ValueError("Missing resourceType")
            
            # Construct FHIR resource to validate
            fhir_resource = construct_fhir_element(resource_type, resource_data)
            
            # If we get here, the resource is valid
            return True, None
            
        except Exception as e:
            return False, e
    
    async def import_bundle_file(self, file_path: str) -> bool:
        """
        Import a single FHIR bundle file with validation.
        
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
        """Process a batch of resources with validation."""
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
                # First, validate the original resource
                is_valid_original, original_error = self.validate_resource(resource)
                
                # Transform the resource
                transformed = self.transformer.transform_resource(resource)
                
                # Validate the transformed resource
                is_valid_transformed, transformed_error = self.validate_resource(transformed)
                
                if self.strict_validation and not is_valid_transformed:
                    # Log validation error
                    validation_error = ValidationError(
                        resource_type=resource_type,
                        resource_id=resource_id,
                        error=transformed_error or original_error,
                        original_resource=resource,
                        transformed_resource=transformed
                    )
                    self.validation_errors.append(validation_error)
                    self.stats['total_validation_errors'] += 1
                    self.stats['validation_errors_by_type'][f"{resource_type}: {validation_error.error_type}"] += 1
                    
                    logger.warning(f"Validation error for {resource_type}/{resource_id}: {validation_error.error_message}")
                    
                    # Skip storing if strict validation is enabled
                    self.stats['total_failed'] += 1
                    continue
                
                # Store the resource (even if validation failed in non-strict mode)
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
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'validation_errors': [error.to_dict() for error in self.validation_errors]
        }
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Validation report saved to {filename}")
    
    def print_summary(self):
        """Print import summary."""
        print("\n" + "="*60)
        print("📊 Import Summary")
        print("="*60)
        print(f"Total Files Processed: {self.stats['total_files']}")
        print(f"Total Resources Processed: {self.stats['total_processed']}")
        print(f"Successfully Imported: {self.stats['total_imported']}")
        print(f"Failed: {self.stats['total_failed']}")
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
        
        print("="*60)


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import Synthea FHIR data with validation')
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
        '--no-strict',
        action='store_true',
        help='Disable strict validation (import even with validation errors)'
    )
    parser.add_argument(
        '--report-file',
        default='validation_errors_report.json',
        help='Output file for validation report (default: validation_errors_report.json)'
    )
    
    args = parser.parse_args()
    
    directory = Path(args.directory)
    if not directory.exists():
        print(f"❌ Directory not found: {directory}")
        return
    
    print("🚀 Starting Synthea FHIR Import with Validation")
    print(f"📁 Source directory: {directory}")
    print(f"📦 Batch size: {args.batch_size}")
    print(f"🔍 Strict validation: {not args.no_strict}")
    
    importer = ValidatingSyntheaImporter(
        batch_size=args.batch_size,
        strict_validation=not args.no_strict
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
        
        # Save validation report
        if importer.validation_errors:
            importer.save_validation_report(args.report_file)
            print(f"\n📝 Validation errors saved to {args.report_file}")
        
    finally:
        await importer.close_db()


if __name__ == "__main__":
    asyncio.run(main())