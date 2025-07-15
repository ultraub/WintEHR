#!/usr/bin/env python
"""
Robust version of populate_references_table that handles errors and can resume.
"""

import asyncio
import sys
from pathlib import Path
import logging
from datetime import datetime
import json

# Add the backend directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.fhir.storage import FHIRStorageEngine
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Track progress
processed_resources = set()
error_resources = []

async def populate_references_robust():
    """Populate references table with better error handling."""
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    
    # Create session factory
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as db:
        storage = FHIRStorageEngine(db)
        
        # Don't clear existing references - we want to resume
        logger.info("Checking existing references...")
        result = await db.execute(text("SELECT COUNT(*) FROM fhir.references"))
        existing_count = result.scalar()
        logger.info(f"Existing references: {existing_count:,}")
        
        # Get already processed resources
        result = await db.execute(text("""
            SELECT DISTINCT source_id, source_type 
            FROM fhir.references
        """))
        for row in result:
            processed_resources.add((row.source_id, row.source_type))
        logger.info(f"Already processed {len(processed_resources):,} resources")
        
        # Get total count
        result = await db.execute(text("""
            SELECT COUNT(*) 
            FROM fhir.resources 
            WHERE (deleted = FALSE OR deleted IS NULL)
        """))
        total_count = result.scalar()
        logger.info(f"Total resources to process: {total_count:,}")
        
        # Get resource types
        result = await db.execute(text("""
            SELECT DISTINCT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE (deleted = FALSE OR deleted IS NULL)
            GROUP BY resource_type
            ORDER BY resource_type
        """))
        resource_types = [(row.resource_type, row.count) for row in result]
        logger.info(f"Resource types found: {', '.join([rt[0] for rt in resource_types])}")
        
        # Process each resource type
        total_refs = existing_count
        for resource_type, type_count in resource_types:
            logger.info(f"\nProcessing {resource_type} resources ({type_count:,} total)...")
            
            batch_size = 100
            offset = 0
            type_refs = 0
            type_errors = 0
            
            while offset < type_count:
                try:
                    # Fetch batch
                    result = await db.execute(text("""
                        SELECT id, resource_type, fhir_id, resource
                        FROM fhir.resources
                        WHERE resource_type = :resource_type
                        AND (deleted = FALSE OR deleted IS NULL)
                        ORDER BY id
                        LIMIT :limit OFFSET :offset
                    """), {
                        "resource_type": resource_type,
                        "limit": batch_size,
                        "offset": offset
                    })
                    
                    resources = result.fetchall()
                    if not resources:
                        break
                    
                    # Process each resource in batch
                    for row in resources:
                        if (row.id, row.resource_type) in processed_resources:
                            continue
                            
                        try:
                            refs = extract_references(row.resource, row.id, row.resource_type)
                            
                            # Insert references with individual error handling
                            for ref in refs:
                                try:
                                    # Truncate long values
                                    target_id = ref['target_id']
                                    if target_id and len(target_id) > 255:
                                        logger.warning(f"Truncating long target_id: {target_id[:50]}...")
                                        target_id = target_id[:255]
                                    
                                    reference_value = ref['reference_value']
                                    if reference_value and len(reference_value) > 1000:
                                        logger.warning(f"Truncating long reference_value: {reference_value[:50]}...")
                                        reference_value = reference_value[:1000]
                                    
                                    await db.execute(text("""
                                        INSERT INTO fhir.references (
                                            source_id, source_type, target_type, target_id,
                                            reference_path, reference_value
                                        ) VALUES (
                                            :source_id, :source_type, :target_type, :target_id,
                                            :reference_path, :reference_value
                                        )
                                    """), {
                                        'source_id': ref['source_id'],
                                        'source_type': ref['source_type'],
                                        'target_type': ref['target_type'],
                                        'target_id': target_id,
                                        'reference_path': ref['reference_path'],
                                        'reference_value': reference_value
                                    })
                                    type_refs += 1
                                except Exception as e:
                                    logger.error(f"  Error inserting reference: {e}")
                                    
                            processed_resources.add((row.id, row.resource_type))
                            
                        except Exception as e:
                            type_errors += 1
                            error_resources.append({
                                'resource_type': row.resource_type,
                                'fhir_id': row.fhir_id,
                                'error': str(e)
                            })
                            logger.error(f"  Error processing {row.resource_type}/{row.fhir_id}: {e}")
                    
                    # Commit batch
                    await db.commit()
                    
                except Exception as e:
                    logger.error(f"Batch error at offset {offset}: {e}")
                    await db.rollback()
                    # Skip this batch
                    offset += batch_size
                    continue
                
                offset += batch_size
                
                # Progress update every 10 batches
                if offset % (batch_size * 10) == 0:
                    logger.info(f"  Progress: {offset:,}/{type_count:,} resources processed")
            
            total_refs += type_refs
            logger.info(f"  Completed {resource_type}: {type_refs:,} references found, {type_errors} errors")
        
        # Summary
        result = await db.execute(text("SELECT COUNT(*) FROM fhir.references"))
        final_count = result.scalar()
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Population complete!")
        logger.info(f"Total references in table: {final_count:,}")
        logger.info(f"New references added: {final_count - existing_count:,}")
        logger.info(f"Resources with errors: {len(error_resources)}")
        
        if error_resources:
            logger.info("\nFirst 10 errors:")
            for err in error_resources[:10]:
                logger.info(f"  {err['resource_type']}/{err['fhir_id']}: {err['error']}")
    
    await engine.dispose()


def extract_references(resource_data, source_id, source_type):
    """Extract all references from a FHIR resource."""
    references = []
    
    def find_references(obj, path=""):
        if isinstance(obj, dict):
            # Direct reference
            if 'reference' in obj and isinstance(obj['reference'], str):
                ref_value = obj['reference']
                target_type = None
                target_id = None
                
                # Parse reference
                if '/' in ref_value:
                    parts = ref_value.split('/', 1)
                    if not ref_value.startswith('http'):
                        target_type = parts[0]
                        target_id = parts[1]
                elif ref_value.startswith('urn:uuid:'):
                    target_id = ref_value[9:]  # Remove urn:uuid: prefix
                
                references.append({
                    'source_id': source_id,
                    'source_type': source_type,
                    'target_type': target_type,
                    'target_id': target_id,
                    'reference_path': path,
                    'reference_value': ref_value
                })
            
            # Recurse into dict
            for key, value in obj.items():
                new_path = f"{path}.{key}" if path else key
                find_references(value, new_path)
                
        elif isinstance(obj, list):
            # Recurse into list
            for i, item in enumerate(obj):
                new_path = f"{path}[{i}]"
                find_references(item, new_path)
    
    find_references(resource_data)
    return references


if __name__ == "__main__":
    asyncio.run(populate_references_robust())