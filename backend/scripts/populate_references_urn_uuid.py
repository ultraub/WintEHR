#!/usr/bin/env python3
"""
Populate fhir.references table by extracting references from existing FHIR resources.
This version handles urn:uuid references by resolving them to actual resource types.
"""

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL
from fhir.core.storage import FHIRStorageEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class ReferencePopulator:
    """Populates the fhir.references table from existing FHIR resources."""
    
    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size
        self.engine = create_async_engine(
            DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
            echo=False,
            pool_size=10,
            max_overflow=20
        )
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        self.processed_count = 0
        self.error_count = 0
        self.reference_count = 0
        self.start_time = None
        self.uuid_to_resource = {}  # Cache for UUID to resource type/id mapping
    
    async def populate(self):
        """Main method to populate references for all resources."""
        self.start_time = datetime.now()
        
        logger.info("Starting reference population...")
        
        # First, build UUID to resource mapping
        await self._build_uuid_mapping()
        
        # Get total resource count
        async with self.async_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM fhir.resources WHERE deleted = false OR deleted IS NULL")
            )
            total_resources = result.scalar()
            
        logger.info(f"Total resources to process: {total_resources:,}")
        
        # Check current references count
        async with self.async_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM fhir.references")
            )
            existing_refs = result.scalar()
            
        logger.info(f"Existing references: {existing_refs:,}")
        
        # Process resources by type
        resource_types = await self._get_resource_types()
        
        for resource_type in resource_types:
            await self._process_resource_type(resource_type)
        
        # Final statistics
        elapsed = (datetime.now() - self.start_time).total_seconds()
        logger.info("\n" + "="*60)
        logger.info(f"Reference population completed!")
        logger.info(f"Total resources processed: {self.processed_count:,}")
        logger.info(f"Total references created: {self.reference_count:,}")
        logger.info(f"Errors encountered: {self.error_count}")
        logger.info(f"Time elapsed: {elapsed:.2f} seconds")
        logger.info(f"Processing rate: {self.processed_count/elapsed:.2f} resources/second")
        
        # Final reference count
        async with self.async_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM fhir.references")
            )
            final_refs = result.scalar()
            
        logger.info(f"Total references in database: {final_refs:,}")
        logger.info(f"New references added: {final_refs - existing_refs:,}")
    
    async def _build_uuid_mapping(self):
        """Build a mapping of UUIDs to resource types and IDs."""
        logger.info("Building UUID to resource mapping...")
        
        async with self.async_session() as session:
            # Get all resources that have UUID-style IDs
            result = await session.execute(
                text("""
                    SELECT resource_type, fhir_id, resource->>'id' as uuid
                    FROM fhir.resources
                    WHERE (deleted = false OR deleted IS NULL)
                    AND resource->>'id' IS NOT NULL
                """)
            )
            
            count = 0
            for row in result:
                uuid = row.uuid
                if uuid:
                    self.uuid_to_resource[uuid] = (row.resource_type, row.fhir_id)
                    count += 1
            
            logger.info(f"Built mapping for {count:,} UUIDs")
    
    async def _get_resource_types(self):
        """Get list of resource types in the database."""
        async with self.async_session() as session:
            result = await session.execute(
                text("""
                    SELECT DISTINCT resource_type 
                    FROM fhir.resources 
                    WHERE deleted = false OR deleted IS NULL
                    ORDER BY resource_type
                """)
            )
            return [row[0] for row in result]
    
    async def _process_resource_type(self, resource_type: str):
        """Process all resources of a given type."""
        logger.info(f"\nProcessing {resource_type} resources...")
        
        async with self.async_session() as session:
            # Get count for this type
            result = await session.execute(
                text("""
                    SELECT COUNT(*) 
                    FROM fhir.resources 
                    WHERE resource_type = :resource_type 
                    AND (deleted = false OR deleted IS NULL)
                """),
                {"resource_type": resource_type}
            )
            type_count = result.scalar()
            
            if type_count == 0:
                return
            
            logger.info(f"Found {type_count:,} {resource_type} resources")
            
            # Process in batches
            offset = 0
            type_processed = 0
            type_refs = 0
            
            while offset < type_count:
                batch_refs = await self._process_batch(resource_type, offset, session)
                type_refs += batch_refs
                type_processed += self.batch_size
                offset += self.batch_size
                
                # Progress update
                progress = min(100, (type_processed / type_count) * 100)
                logger.info(
                    f"  Progress: {progress:.1f}% "
                    f"({type_processed:,}/{type_count:,}) "
                    f"References: {type_refs:,}"
                )
            
            logger.info(f"Completed {resource_type}: {type_refs:,} references extracted")
    
    async def _process_batch(self, resource_type: str, offset: int, session: AsyncSession) -> int:
        """Process a batch of resources."""
        batch_refs = 0
        
        try:
            # Get batch of resources
            result = await session.execute(
                text("""
                    SELECT id, fhir_id, resource 
                    FROM fhir.resources 
                    WHERE resource_type = :resource_type 
                    AND (deleted = false OR deleted IS NULL)
                    ORDER BY id
                    LIMIT :limit OFFSET :offset
                """),
                {
                    "resource_type": resource_type,
                    "limit": self.batch_size,
                    "offset": offset
                }
            )
            
            resources = result.fetchall()
            
            for resource in resources:
                resource_id, fhir_id, data = resource
                
                try:
                    # Clear existing references for this resource
                    await session.execute(
                        text("DELETE FROM fhir.references WHERE source_id = :source_id"),
                        {"source_id": resource_id}
                    )
                    
                    # Extract and insert references
                    refs_count = await self._extract_and_insert_references(
                        session, resource_id, resource_type, data
                    )
                    
                    batch_refs += refs_count
                    self.processed_count += 1
                    self.reference_count += refs_count
                    
                except Exception as e:
                    logger.error(f"Error processing {resource_type}/{fhir_id}: {str(e)}")
                    self.error_count += 1
            
            # Commit batch
            await session.commit()
            
        except Exception as e:
            logger.error(f"Error processing batch at offset {offset}: {str(e)}")
            await session.rollback()
        
        return batch_refs
    
    def _resolve_reference(self, reference_value: str) -> Optional[Tuple[str, str]]:
        """Resolve a reference value to resource type and ID."""
        if reference_value.startswith("urn:uuid:"):
            # Extract UUID and look up in mapping
            uuid = reference_value[9:]  # Remove "urn:uuid:" prefix
            if uuid in self.uuid_to_resource:
                return self.uuid_to_resource[uuid]
            else:
                # Try without any potential trailing characters
                clean_uuid = uuid.strip()
                if clean_uuid in self.uuid_to_resource:
                    return self.uuid_to_resource[clean_uuid]
        elif "/" in reference_value:
            # Standard ResourceType/id format
            parts = reference_value.split("/", 1)
            if len(parts) == 2:
                return parts[0], parts[1]
        
        return None
    
    async def _extract_and_insert_references(
        self, 
        session: AsyncSession, 
        resource_id: int, 
        resource_type: str, 
        data: Dict[str, Any]
    ) -> int:
        """Extract references from a resource and insert them into the references table."""
        refs_count = 0
        
        async def process_value(value: Any, path: str):
            nonlocal refs_count
            
            if isinstance(value, dict):
                # Check if this is a reference
                if "reference" in value and isinstance(value["reference"], str):
                    resolved = self._resolve_reference(value["reference"])
                    if resolved:
                        target_type, target_id = resolved
                        
                        await session.execute(
                            text("""
                                INSERT INTO fhir.references (
                                    source_id, source_type, target_type, target_id,
                                    reference_path, reference_value
                                ) VALUES (
                                    :source_id, :source_type, :target_type, :target_id,
                                    :reference_path, :reference_value
                                )
                            """),
                            {
                                "source_id": resource_id,
                                "source_type": resource_type,
                                "target_type": target_type,
                                "target_id": target_id,
                                "reference_path": path,
                                "reference_value": value.get("display", "")
                            }
                        )
                        refs_count += 1
                else:
                    # Recurse into nested objects
                    for key, val in value.items():
                        await process_value(val, f"{path}.{key}" if path else key)
            
            elif isinstance(value, list):
                # Process each item in the list
                for i, item in enumerate(value):
                    await process_value(item, f"{path}[{i}]")
        
        # Start processing from the root
        await process_value(data, "")
        
        return refs_count
    
    async def cleanup(self):
        """Clean up resources."""
        await self.engine.dispose()


async def main():
    """Main entry point."""
    populator = ReferencePopulator(batch_size=100)
    
    try:
        await populator.populate()
    finally:
        await populator.cleanup()


if __name__ == "__main__":
    asyncio.run(main())