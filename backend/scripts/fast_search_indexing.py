#!/usr/bin/env python3
"""
Fast Search Parameter Indexing Script
Optimized version with batching, parallel processing, and connection pooling
"""

import asyncio
import json
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import asyncpg
from pathlib import Path
import logging
import os
from concurrent.futures import ProcessPoolExecutor
import multiprocessing

# Add the backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from fhir.core.search_param_extraction import SearchParameterExtractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FastSearchParameterIndexer:
    """Optimized search parameter indexing with batching and parallel processing."""
    
    def __init__(self, database_url: str = None, batch_size: int = 1000, num_workers: int = None):
        # Check if running in Docker
        if os.environ.get('DOCKER_ENV') or Path('/.dockerenv').exists():
            self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        else:
            self.database_url = database_url or 'postgresql://emr_user:emr_password@localhost:5432/emr_db'
        
        self.batch_size = batch_size
        self.num_workers = num_workers or min(4, multiprocessing.cpu_count())
        self.pool = None
        self.extractor = SearchParameterExtractor()
        self.stats = {
            'processed': 0,
            'indexed': 0,
            'errors': 0,
            'skipped': 0,
            'by_type': {}
        }
    
    async def connect(self):
        """Create connection pool."""
        self.pool = await asyncpg.create_pool(
            self.database_url,
            min_size=self.num_workers,
            max_size=self.num_workers * 2
        )
        logger.info(f"Created connection pool with {self.num_workers} workers")
    
    async def disconnect(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("Closed connection pool")
    
    async def index_all_resources(self, resource_type: Optional[str] = None):
        """Index search parameters for all resources with parallel processing."""
        await self.connect()
        
        try:
            # Get resource types to process
            if resource_type:
                resource_types = [resource_type]
            else:
                async with self.pool.acquire() as conn:
                    result = await conn.fetch(
                        "SELECT DISTINCT resource_type FROM fhir.resources ORDER BY resource_type"
                    )
                    resource_types = [row['resource_type'] for row in result]
            
            logger.info(f"Indexing {len(resource_types)} resource type(s) with {self.num_workers} workers")
            
            # Process resource types in parallel
            tasks = []
            for r_type in resource_types:
                task = asyncio.create_task(self._index_resource_type(r_type))
                tasks.append(task)
            
            # Wait for all tasks to complete
            await asyncio.gather(*tasks)
            
            self._print_summary()
            
        finally:
            await self.disconnect()
    
    async def _index_resource_type(self, resource_type: str):
        """Index all resources of a specific type with batching."""
        logger.info(f"\nProcessing {resource_type} resources...")
        
        # Initialize stats for this type
        self.stats['by_type'][resource_type] = {
            'count': 0,
            'indexed': 0,
            'errors': 0
        }
        
        async with self.pool.acquire() as conn:
            # Get all resources of this type
            resources = await conn.fetch(
                "SELECT id, resource FROM fhir.resources WHERE resource_type = $1",
                resource_type
            )
            
            logger.info(f"Found {len(resources)} {resource_type} resources")
            self.stats['by_type'][resource_type]['count'] = len(resources)
            
            # Process in batches
            batch = []
            batch_params = []
            
            for i, record in enumerate(resources):
                resource_id = record['id']
                resource_data = json.loads(record['resource']) if isinstance(record['resource'], str) else record['resource']
                
                try:
                    # Extract search parameters using shared module
                    params = self.extractor.extract_parameters(resource_type, resource_data)
                    
                    # Add to batch
                    batch.append(resource_id)
                    for param in params:
                        # For token types, populate value_token with the code value
                        value_token = None
                        if param['param_type'] == 'token' and param.get('value_token_code'):
                            value_token = param.get('value_token_code')
                        
                        batch_params.append((
                            resource_id,
                            resource_type,
                            param['param_name'],
                            param['param_type'],
                            param.get('value_string'),
                            param.get('value_number'),
                            param.get('value_date'),
                            param.get('value_quantity_value'),
                            param.get('value_quantity_unit'),
                            value_token,
                            param.get('value_token_system'),
                            param.get('value_token_code'),
                            param.get('value_reference')
                        ))
                    
                    # Process batch when it reaches the size limit
                    if len(batch) >= self.batch_size or i == len(resources) - 1:
                        await self._process_batch(conn, batch, batch_params)
                        
                        self.stats['processed'] += len(batch)
                        self.stats['indexed'] += len(batch_params)
                        self.stats['by_type'][resource_type]['indexed'] += len(batch_params)
                        
                        # Log progress
                        if self.stats['processed'] % 1000 == 0:
                            logger.info(f"Processed {self.stats['processed']} resources...")
                        
                        # Clear batch
                        batch = []
                        batch_params = []
                    
                except Exception as e:
                    logger.error(f"Error processing {resource_type}/{resource_id}: {e}")
                    self.stats['errors'] += 1
                    self.stats['by_type'][resource_type]['errors'] += 1
    
    async def _process_batch(self, conn, resource_ids: List[int], params: List[Tuple]):
        """Process a batch of resources."""
        if not resource_ids:
            return
        
        # Start transaction
        async with conn.transaction():
            # Delete existing parameters for these resources
            await conn.execute(
                "DELETE FROM fhir.search_params WHERE resource_id = ANY($1::int[])",
                resource_ids
            )
            
            # Bulk insert new parameters
            if params:
                await conn.executemany("""
                    INSERT INTO fhir.search_params (
                        resource_id, resource_type, param_name, param_type,
                        value_string, value_number, value_date, value_quantity_value,
                        value_quantity_unit,
                        value_token, value_token_system, value_token_code, value_reference
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                """, params)
    
    def _print_summary(self):
        """Print indexing summary."""
        print("\n" + "="*60)
        print("INDEXING SUMMARY")
        print("="*60)
        print(f"Total resources processed: {self.stats['processed']}")
        print(f"Total parameters indexed: {self.stats['indexed']}")
        print(f"Total errors: {self.stats['errors']}")
        print(f"Batch size: {self.batch_size}")
        print(f"Workers: {self.num_workers}")
        
        if self.stats['by_type']:
            print("\nBy Resource Type:")
            print("-"*40)
            for resource_type, type_stats in sorted(self.stats['by_type'].items()):
                avg_params = type_stats['indexed'] / type_stats['count'] if type_stats['count'] > 0 else 0
                print(f"{resource_type:20} {type_stats['count']:6} resources, "
                      f"{type_stats['indexed']:6} params (avg: {avg_params:.1f}), "
                      f"{type_stats['errors']:3} errors")
        
        print("="*60)


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Fast Search Parameter Indexing')
    parser.add_argument('--mode', choices=['index', 'reindex'], 
                        default='index', help='Operation mode')
    parser.add_argument('--resource-type', help='Specific resource type to process')
    parser.add_argument('--database-url', help='Override database URL')
    parser.add_argument('--docker', action='store_true', help='Running in Docker environment')
    parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for inserts')
    parser.add_argument('--workers', type=int, help='Number of parallel workers')
    
    args = parser.parse_args()
    
    # Set Docker environment if specified
    if args.docker:
        os.environ['DOCKER_ENV'] = '1'
    
    indexer = FastSearchParameterIndexer(
        args.database_url,
        batch_size=args.batch_size,
        num_workers=args.workers
    )
    
    start_time = datetime.now()
    
    try:
        await indexer.index_all_resources(args.resource_type)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"\nCompleted in {duration:.1f} seconds")
        print(f"Processing rate: {indexer.stats['processed'] / duration:.1f} resources/second")
        
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())