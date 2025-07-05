#!/usr/bin/env python3
"""
Unified Synthea FHIR Import Script

This script imports Synthea-generated FHIR bundles into the database with:
- Profile-aware transformation for FHIR R4 compliance
- Batch processing for performance
- Comprehensive error tracking
- Progress reporting
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional
import logging
from collections import defaultdict

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


class SyntheaImporter:
    """Synthea FHIR importer with transformation and error handling."""
    
    def __init__(self, batch_size: int = 50):
        """
        Initialize the importer.
        
        Args:
            batch_size: Number of resources to process in each batch
        """
        self.transformer = ProfileAwareFHIRTransformer()
        self.engine = None
        self.batch_size = batch_size
        
        # Track statistics
        self.stats = {
            'total_files': 0,
            'total_processed': 0,
            'total_imported': 0,
            'total_failed': 0,
            'errors_by_type': defaultdict(int),
            'resources_by_type': defaultdict(int)
        }
    
    async def init_db(self):
        """Initialize database connection."""
        self.engine = create_async_engine(DATABASE_URL, echo=False)
    
    async def close_db(self):
        """Close database connection."""
        if self.engine:
            await self.engine.dispose()
    
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
        """Process a batch of resources."""
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
                # Transform the resource
                transformed = self.transformer.transform_resource(resource)
                
                # Store the resource
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
                logger.debug(f"Failed to import {resource_type}/{resource_id}: {e}")
    
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
                await self._add_search_param(
                    session, resource_id, 'birthdate', 'date',
                    value_date=resource_data['birthDate']
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
        
        # Add more search parameter extractions as needed
    
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
    
    def print_summary(self):
        """Print import summary."""
        print("\n" + "="*60)
        print("📊 Import Summary")
        print("="*60)
        print(f"Total Files Processed: {self.stats['total_files']}")
        print(f"Total Resources Processed: {self.stats['total_processed']}")
        print(f"Successfully Imported: {self.stats['total_imported']}")
        print(f"Failed: {self.stats['total_failed']}")
        
        if self.stats['resources_by_type']:
            print("\n✅ Resources by Type:")
            for resource_type, count in sorted(self.stats['resources_by_type'].items()):
                print(f"  {resource_type}: {count}")
        
        if self.stats['errors_by_type']:
            print("\n❌ Errors by Type:")
            for error_type, count in sorted(self.stats['errors_by_type'].items()):
                print(f"  {error_type}: {count}")
        
        print("="*60)


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import Synthea FHIR data')
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
    
    args = parser.parse_args()
    
    directory = Path(args.directory)
    if not directory.exists():
        print(f"❌ Directory not found: {directory}")
        return
    
    print("🚀 Starting Synthea FHIR Import")
    print(f"📁 Source directory: {directory}")
    print(f"📦 Batch size: {args.batch_size}")
    
    importer = SyntheaImporter(batch_size=args.batch_size)
    await importer.init_db()
    
    try:
        # Find all matching files
        files = sorted(directory.glob(args.pattern))
        print(f"📄 Found {len(files)} files to import")
        
        # Import each file
        for file_path in files:
            await importer.import_bundle_file(str(file_path))
        
        importer.print_summary()
        
    finally:
        await importer.close_db()


if __name__ == "__main__":
    import uuid  # Import here for use in _store_resource
    asyncio.run(main())