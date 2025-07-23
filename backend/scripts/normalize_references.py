#!/usr/bin/env python3
"""
Normalize FHIR references by converting urn:uuid format to ResourceType/id format.
This is an optional enhancement that can be run after data import.

Usage:
    python scripts/normalize_references.py [--dry-run]
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import argparse

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class ReferenceNormalizer:
    """Normalizes FHIR references from urn:uuid to ResourceType/id format."""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.engine = create_async_engine(
            DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
            echo=False,
            pool_size=10,
            max_overflow=20
        )
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        self.uuid_to_type = {}  # Cache for UUID to resource type mapping
        self.stats = {
            'resources_processed': 0,
            'references_found': 0,
            'references_normalized': 0,
            'errors': 0
        }
    
    async def build_uuid_mapping(self):
        """Build a mapping of UUIDs to resource types."""
        logger.info("Building UUID to resource type mapping...")
        
        async with self.async_session() as session:
            result = await session.execute(
                text("""
                    SELECT resource_type, fhir_id, resource->>'id' as uuid
                    FROM fhir.resources
                    WHERE (deleted = false OR deleted IS NULL)
                    AND resource->>'id' IS NOT NULL
                """)
            )
            
            for row in result:
                uuid = row.uuid
                if uuid:
                    self.uuid_to_type[uuid] = row.resource_type
            
            logger.info(f"Built mapping for {len(self.uuid_to_type)} UUIDs")
    
    def normalize_reference(self, reference: str) -> Optional[str]:
        """Convert urn:uuid reference to ResourceType/id format."""
        if reference.startswith("urn:uuid:"):
            uuid = reference[9:]  # Remove "urn:uuid:" prefix
            resource_type = self.uuid_to_type.get(uuid)
            if resource_type:
                return f"{resource_type}/{uuid}"
        return None
    
    def process_resource_references(self, resource: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
        """Recursively process and normalize references in a resource."""
        changes = 0
        
        def process_value(value: Any) -> Any:
            nonlocal changes
            
            if isinstance(value, dict):
                if "reference" in value and isinstance(value["reference"], str):
                    normalized = self.normalize_reference(value["reference"])
                    if normalized:
                        value["reference"] = normalized
                        changes += 1
                
                # Recurse into nested objects
                for key, val in value.items():
                    value[key] = process_value(val)
            
            elif isinstance(value, list):
                # Process each item in the list
                for i, item in enumerate(value):
                    value[i] = process_value(item)
            
            return value
        
        # Process the entire resource
        normalized_resource = process_value(resource.copy())
        return normalized_resource, changes
    
    async def normalize_all_references(self):
        """Normalize all references in the database."""
        logger.info(f"Starting reference normalization (dry_run={self.dry_run})...")
        
        # First build the UUID mapping
        await self.build_uuid_mapping()
        
        async with self.async_session() as session:
            # Get all resources
            result = await session.execute(
                text("""
                    SELECT id, resource_type, resource
                    FROM fhir.resources
                    WHERE deleted = false OR deleted IS NULL
                    ORDER BY id
                """)
            )
            
            resources = result.fetchall()
            total = len(resources)
            logger.info(f"Processing {total} resources...")
            
            for i, (resource_id, resource_type, resource_data) in enumerate(resources):
                try:
                    # Parse resource data
                    if isinstance(resource_data, str):
                        resource_dict = json.loads(resource_data)
                    else:
                        resource_dict = resource_data
                    
                    # Process references
                    normalized_resource, changes = self.process_resource_references(resource_dict)
                    
                    if changes > 0:
                        self.stats['references_found'] += changes
                        
                        if not self.dry_run:
                            # Update the resource
                            await session.execute(
                                text("""
                                    UPDATE fhir.resources
                                    SET resource = :resource,
                                        last_updated = CURRENT_TIMESTAMP
                                    WHERE id = :id
                                """),
                                {
                                    'id': resource_id,
                                    'resource': json.dumps(normalized_resource)
                                }
                            )
                            self.stats['references_normalized'] += changes
                    
                    self.stats['resources_processed'] += 1
                    
                    # Progress update every 1000 resources
                    if (i + 1) % 1000 == 0:
                        logger.info(f"Progress: {i + 1}/{total} resources processed")
                        if not self.dry_run:
                            await session.commit()
                
                except Exception as e:
                    logger.error(f"Error processing resource {resource_id}: {e}")
                    self.stats['errors'] += 1
            
            if not self.dry_run:
                await session.commit()
    
    async def update_search_params(self):
        """Update search parameters to use normalized references."""
        if self.dry_run:
            logger.info("Skipping search parameter updates (dry run)")
            return
        
        logger.info("Updating search parameters...")
        
        async with self.async_session() as session:
            # Update reference search parameters
            result = await session.execute(
                text("""
                    UPDATE fhir.search_params
                    SET value_reference = 
                        CASE 
                            WHEN value_reference LIKE 'urn:uuid:%' 
                            THEN REPLACE(value_reference, 'urn:uuid:', '')
                            ELSE value_reference
                        END
                    WHERE param_type = 'reference'
                    AND value_reference LIKE 'urn:uuid:%'
                """)
            )
            
            updated = result.rowcount
            await session.commit()
            
            logger.info(f"Updated {updated} search parameters")
    
    async def cleanup(self):
        """Clean up resources."""
        await self.engine.dispose()
    
    def print_summary(self):
        """Print normalization summary."""
        logger.info("\n" + "="*60)
        logger.info("Reference Normalization Summary")
        logger.info("="*60)
        logger.info(f"Resources processed: {self.stats['resources_processed']:,}")
        logger.info(f"References found: {self.stats['references_found']:,}")
        
        if self.dry_run:
            logger.info(f"References to be normalized: {self.stats['references_found']:,}")
            logger.info("\nThis was a DRY RUN - no changes were made")
        else:
            logger.info(f"References normalized: {self.stats['references_normalized']:,}")
        
        logger.info(f"Errors: {self.stats['errors']}")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Normalize FHIR references")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making any modifications"
    )
    args = parser.parse_args()
    
    normalizer = ReferenceNormalizer(dry_run=args.dry_run)
    
    try:
        await normalizer.normalize_all_references()
        await normalizer.update_search_params()
        normalizer.print_summary()
    finally:
        await normalizer.cleanup()


if __name__ == "__main__":
    asyncio.run(main())