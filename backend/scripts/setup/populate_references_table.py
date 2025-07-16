#!/usr/bin/env python3
"""Populate the references table for all existing FHIR resources."""

import asyncio
import sys
from pathlib import Path
import logging
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fhir.core.storage import FHIRStorageEngine
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Use the correct database URL with emr_user
DATABASE_URL = "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def populate_references():
    """Process all FHIR resources and extract their references."""
    
    # Create async engine
    async_db_url = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    engine = create_async_engine(async_db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        storage = FHIRStorageEngine(db)
        
        start_time = datetime.now()
        
        # First, clear all existing references to avoid duplicates
        logger.info("Clearing existing references...")
        await db.execute(text("TRUNCATE TABLE fhir.references RESTART IDENTITY"))
        await db.commit()
        
        # Get count of resources to process
        result = await db.execute(text("""
            SELECT COUNT(*) as count 
            FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
        """))
        total_resources = result.scalar()
        logger.info(f"Total resources to process: {total_resources:,}")
        
        # Process resources in batches to avoid memory issues
        batch_size = 100
        processed = 0
        references_found = 0
        
        # Get all resource types
        result = await db.execute(text("""
            SELECT DISTINCT resource_type 
            FROM fhir.resources 
            WHERE deleted = FALSE OR deleted IS NULL
            ORDER BY resource_type
        """))
        resource_types = [row.resource_type for row in result]
        
        logger.info(f"Resource types found: {', '.join(resource_types)}")
        
        for resource_type in resource_types:
            logger.info(f"\nProcessing {resource_type} resources...")
            
            # Get count for this type
            result = await db.execute(text("""
                SELECT COUNT(*) as count 
                FROM fhir.resources 
                WHERE resource_type = :resource_type
                AND (deleted = FALSE OR deleted IS NULL)
            """), {'resource_type': resource_type})
            type_count = result.scalar()
            
            offset = 0
            type_refs = 0
            
            while offset < type_count:
                # Get batch of resources
                result = await db.execute(text("""
                    SELECT id, resource_type, fhir_id, resource
                    FROM fhir.resources
                    WHERE resource_type = :resource_type
                    AND (deleted = FALSE OR deleted IS NULL)
                    ORDER BY id
                    LIMIT :limit OFFSET :offset
                """), {
                    'resource_type': resource_type,
                    'limit': batch_size,
                    'offset': offset
                })
                
                resources = result.fetchall()
                if not resources:
                    break
                
                # Process each resource
                for resource in resources:
                    try:
                        # Extract references
                        await storage._extract_references(
                            resource.id, 
                            resource.resource, 
                            "", 
                            resource.resource_type
                        )
                        processed += 1
                        
                        if processed % 1000 == 0:
                            logger.info(f"  Progress: {processed:,}/{total_resources:,} resources processed")
                            await db.commit()
                            
                    except Exception as e:
                        logger.error(f"  Error processing {resource.resource_type}/{resource.fhir_id}: {str(e)}")
                        continue
                
                offset += batch_size
                
            # Commit after each resource type
            await db.commit()
            
            # Count references for this type
            result = await db.execute(text("""
                SELECT COUNT(*) as count 
                FROM fhir.references 
                WHERE source_type = :resource_type
            """), {'resource_type': resource_type})
            type_ref_count = result.scalar() - type_refs
            type_refs += type_ref_count
            references_found += type_ref_count
            
            logger.info(f"  Completed {resource_type}: {type_count:,} resources, {type_ref_count:,} references found")
        
        # Get final statistics
        result = await db.execute(text("""
            SELECT 
                source_type,
                target_type,
                reference_path,
                COUNT(*) as count
            FROM fhir.references
            GROUP BY source_type, target_type, reference_path
            ORDER BY count DESC
            LIMIT 20
        """))
        
        logger.info("\n" + "="*60)
        logger.info("REFERENCE EXTRACTION COMPLETE")
        logger.info("="*60)
        logger.info(f"Total resources processed: {processed:,}")
        logger.info(f"Total references found: {references_found:,}")
        logger.info(f"Time taken: {datetime.now() - start_time}")
        
        logger.info("\nTop 20 reference patterns:")
        logger.info("-"*60)
        logger.info(f"{'Source Type':<20} {'Target Type':<20} {'Path':<15} {'Count':>8}")
        logger.info("-"*60)
        for row in result:
            logger.info(f"{row.source_type:<20} {row.target_type:<20} {row.reference_path:<15} {row.count:>8,}")
        
        # Show sample references with urn:uuid format
        result = await db.execute(text("""
            SELECT * FROM fhir.references
            WHERE reference_value LIKE 'urn:uuid:%'
            LIMIT 5
        """))
        
        logger.info("\nSample urn:uuid references:")
        for row in result:
            logger.info(f"  {row.source_type}/{row.source_id} -> {row.target_type}/{row.target_id}")

if __name__ == "__main__":
    asyncio.run(populate_references())