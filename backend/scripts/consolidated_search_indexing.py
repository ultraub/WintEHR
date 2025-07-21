#!/usr/bin/env python3
"""
Consolidated Search Parameter Indexing Script

This script handles all search parameter indexing operations using the shared
search parameter extraction module for consistency across the application.

Features:
- Uses shared extraction module for consistency
- Handles both initial indexing and re-indexing
- Supports different modes: index, reindex, verify, fix, monitor
- Robust error handling and recovery
- Progress tracking and detailed reporting

Usage:
    # Index all resources (default mode)
    python consolidated_search_indexing.py
    
    # Reindex specific resource type
    python consolidated_search_indexing.py --mode reindex --resource-type Condition
    
    # Verify search parameters
    python consolidated_search_indexing.py --mode verify
    
    # Fix missing parameters
    python consolidated_search_indexing.py --mode fix
    
    # Monitor health
    python consolidated_search_indexing.py --mode monitor
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

# Add the backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the shared extraction module
from fhir.core.search_param_extraction import SearchParameterExtractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SearchParameterIndexer:
    """Search parameter indexing using shared extraction module."""
    
    def __init__(self, database_url: str = None):
        # Check if running in Docker
        if os.environ.get('DOCKER_ENV') or Path('/.dockerenv').exists():
            self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        else:
            self.database_url = database_url or 'postgresql://emr_user:emr_password@localhost:5432/emr_db'
        
        self.conn = None
        self.extractor = SearchParameterExtractor()
        self.stats = {
            'processed': 0,
            'indexed': 0,
            'errors': 0,
            'skipped': 0,
            'by_type': {}
        }
    
    async def connect(self):
        """Establish database connection."""
        if not self.conn:
            self.conn = await asyncpg.connect(self.database_url)
            logger.info("Connected to database")
    
    async def disconnect(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
            self.conn = None
            logger.info("Disconnected from database")
    
    async def index_all_resources(self, resource_type: Optional[str] = None):
        """Index search parameters for all resources or specific type."""
        await self.connect()
        
        try:
            # Get resource types to process
            if resource_type:
                resource_types = [resource_type]
            else:
                result = await self.conn.fetch(
                    "SELECT DISTINCT resource_type FROM fhir.resources ORDER BY resource_type"
                )
                resource_types = [row['resource_type'] for row in result]
            
            logger.info(f"Indexing {len(resource_types)} resource type(s)")
            
            for r_type in resource_types:
                await self._index_resource_type(r_type)
            
            self._print_summary()
            
        finally:
            await self.disconnect()
    
    async def _index_resource_type(self, resource_type: str):
        """Index all resources of a specific type."""
        logger.info(f"\nProcessing {resource_type} resources...")
        
        # Initialize stats for this type
        self.stats['by_type'][resource_type] = {
            'count': 0,
            'indexed': 0,
            'errors': 0
        }
        
        # Get all resources of this type
        resources = await self.conn.fetch(
            "SELECT id, resource FROM fhir.resources WHERE resource_type = $1",
            resource_type
        )
        
        logger.info(f"Found {len(resources)} {resource_type} resources")
        self.stats['by_type'][resource_type]['count'] = len(resources)
        
        # Process each resource
        for record in resources:
            resource_id = record['id']
            resource_data = json.loads(record['resource']) if isinstance(record['resource'], str) else record['resource']
            
            try:
                # Extract search parameters using shared module
                params = self.extractor.extract_parameters(resource_type, resource_data)
                
                # Delete existing parameters for this resource
                await self.conn.execute(
                    "DELETE FROM fhir.search_params WHERE resource_id = $1",
                    resource_id
                )
                
                # Insert new parameters
                for param in params:
                    await self._insert_search_param(resource_id, resource_type, param)
                
                self.stats['processed'] += 1
                self.stats['indexed'] += len(params)
                self.stats['by_type'][resource_type]['indexed'] += len(params)
                
                # Log progress every 100 resources
                if self.stats['processed'] % 100 == 0:
                    logger.info(f"Processed {self.stats['processed']} resources...")
                
            except Exception as e:
                logger.error(f"Error processing {resource_type}/{resource_id}: {e}")
                self.stats['errors'] += 1
                self.stats['by_type'][resource_type]['errors'] += 1
    
    async def _insert_search_param(self, resource_id: int, resource_type: str, param: Dict[str, Any]):
        """Insert a search parameter into the database."""
        # For token types, populate value_token with the code value
        value_token = None
        if param['param_type'] == 'token' and param.get('value_token_code'):
            value_token = param.get('value_token_code')
        
        await self.conn.execute("""
            INSERT INTO fhir.search_params (
                resource_id, resource_type, param_name, param_type,
                value_string, value_number, value_date, value_quantity_value,
                value_quantity_unit,
                value_token, value_token_system, value_token_code, value_reference
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        """,
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
        )
    
    async def verify_search_params(self):
        """Verify search parameters are properly indexed."""
        await self.connect()
        
        try:
            # Check parameter counts by resource type
            result = await self.conn.fetch("""
                SELECT 
                    r.resource_type,
                    COUNT(DISTINCT r.id) as resource_count,
                    COUNT(sp.id) as param_count,
                    COUNT(DISTINCT sp.param_name) as unique_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
                GROUP BY r.resource_type
                ORDER BY r.resource_type
            """)
            
            print("\n" + "="*80)
            print("SEARCH PARAMETER VERIFICATION")
            print("="*80)
            print(f"{'Resource Type':<20} {'Resources':<15} {'Parameters':<15} {'Unique Params':<15}")
            print("-"*80)
            
            total_resources = 0
            total_params = 0
            
            for row in result:
                print(f"{row['resource_type']:<20} {row['resource_count']:<15} {row['param_count']:<15} {row['unique_params']:<15}")
                total_resources += row['resource_count']
                total_params += row['param_count']
            
            print("-"*80)
            print(f"{'TOTAL':<20} {total_resources:<15} {total_params:<15}")
            print("="*80)
            
            # Check for resources without any parameters
            missing_result = await self.conn.fetch("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources r
                WHERE NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp 
                    WHERE sp.resource_id = r.id
                )
                GROUP BY resource_type
                ORDER BY resource_type
            """)
            
            if missing_result:
                print("\n⚠️  Resources without search parameters:")
                for row in missing_result:
                    print(f"  - {row['resource_type']}: {row['count']} resources")
            else:
                print("\n✅ All resources have search parameters indexed")
            
        finally:
            await self.disconnect()
    
    async def fix_missing_params(self):
        """Fix resources that are missing search parameters."""
        await self.connect()
        
        try:
            # Find resources without parameters
            result = await self.conn.fetch("""
                SELECT r.id, r.resource_type, r.resource
                FROM fhir.resources r
                WHERE NOT EXISTS (
                    SELECT 1 FROM fhir.search_params sp 
                    WHERE sp.resource_id = r.id
                )
                ORDER BY r.resource_type, r.id
            """)
            
            if not result:
                logger.info("No resources missing search parameters")
                return
            
            logger.info(f"Found {len(result)} resources missing search parameters")
            
            # Process each resource
            fixed_count = 0
            for record in result:
                resource_id = record['id']
                resource_type = record['resource_type']
                resource_data = json.loads(record['resource']) if isinstance(record['resource'], str) else record['resource']
                
                try:
                    # Extract search parameters
                    params = self.extractor.extract_parameters(resource_type, resource_data)
                    
                    # Insert parameters
                    for param in params:
                        await self._insert_search_param(resource_id, resource_type, param)
                    
                    fixed_count += 1
                    
                    if fixed_count % 10 == 0:
                        logger.info(f"Fixed {fixed_count} resources...")
                    
                except Exception as e:
                    logger.error(f"Error fixing {resource_type}/{resource_id}: {e}")
            
            logger.info(f"✅ Fixed {fixed_count} resources")
            
        finally:
            await self.disconnect()
    
    async def monitor_health(self):
        """Monitor search parameter health and provide recommendations."""
        await self.connect()
        
        try:
            print("\n" + "="*80)
            print("SEARCH PARAMETER HEALTH MONITOR")
            print("="*80)
            
            # Check critical parameters by resource type
            critical_params = {
                'Patient': ['identifier', 'name', 'gender', 'birthdate'],
                'Observation': ['patient', 'code', 'status', 'category'],
                'Condition': ['patient', 'code', 'clinical-status'],
                'MedicationRequest': ['patient', 'status', 'intent'],
                'Encounter': ['patient', 'status', 'class'],
                'Procedure': ['patient', 'code', 'status'],
                'AllergyIntolerance': ['patient', 'code', 'clinical-status'],
                'Immunization': ['patient', 'vaccine-code', 'status'],
                'DiagnosticReport': ['patient', 'code', 'status']
            }
            
            for resource_type, params in critical_params.items():
                # Check if resource type exists
                resource_count = await self.conn.fetchval(
                    "SELECT COUNT(*) FROM fhir.resources WHERE resource_type = $1",
                    resource_type
                )
                
                if resource_count == 0:
                    continue
                
                print(f"\n{resource_type} ({resource_count} resources):")
                print("-" * 40)
                
                for param_name in params:
                    param_count = await self.conn.fetchval("""
                        SELECT COUNT(DISTINCT sp.resource_id)
                        FROM fhir.search_params sp
                        JOIN fhir.resources r ON r.id = sp.resource_id
                        WHERE r.resource_type = $1 AND sp.param_name = $2
                    """, resource_type, param_name)
                    
                    coverage = (param_count / resource_count * 100) if resource_count > 0 else 0
                    status = "✅" if coverage > 95 else "⚠️" if coverage > 50 else "❌"
                    
                    print(f"  {status} {param_name}: {param_count}/{resource_count} ({coverage:.1f}%)")
            
            # Overall health score
            total_result = await self.conn.fetchrow("""
                SELECT 
                    COUNT(DISTINCT r.id) as total_resources,
                    COUNT(DISTINCT sp.resource_id) as indexed_resources,
                    COUNT(sp.id) as total_params
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
            """)
            
            coverage = (total_result['indexed_resources'] / total_result['total_resources'] * 100) if total_result['total_resources'] > 0 else 0
            avg_params = total_result['total_params'] / total_result['indexed_resources'] if total_result['indexed_resources'] > 0 else 0
            
            print("\n" + "="*80)
            print("OVERALL HEALTH SCORE")
            print("="*80)
            print(f"Total Resources: {total_result['total_resources']}")
            print(f"Indexed Resources: {total_result['indexed_resources']} ({coverage:.1f}%)")
            print(f"Total Parameters: {total_result['total_params']}")
            print(f"Average Parameters per Resource: {avg_params:.1f}")
            
            if coverage < 100:
                print(f"\n⚠️  Recommendation: Run 'python {__file__} --mode fix' to index missing resources")
            else:
                print("\n✅ All resources are properly indexed")
            
        finally:
            await self.disconnect()
    
    def _print_summary(self):
        """Print indexing summary."""
        print("\n" + "="*60)
        print("INDEXING SUMMARY")
        print("="*60)
        print(f"Total resources processed: {self.stats['processed']}")
        print(f"Total parameters indexed: {self.stats['indexed']}")
        print(f"Total errors: {self.stats['errors']}")
        
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
    parser = argparse.ArgumentParser(description='Consolidated Search Parameter Indexing')
    parser.add_argument('--mode', choices=['index', 'reindex', 'verify', 'fix', 'monitor'], 
                        default='index', help='Operation mode')
    parser.add_argument('--resource-type', help='Specific resource type to process')
    parser.add_argument('--database-url', help='Override database URL')
    parser.add_argument('--docker', action='store_true', help='Running in Docker environment')
    
    args = parser.parse_args()
    
    # Set Docker environment if specified
    if args.docker:
        os.environ['DOCKER_ENV'] = '1'
    
    indexer = SearchParameterIndexer(args.database_url)
    
    try:
        if args.mode in ['index', 'reindex']:
            await indexer.index_all_resources(args.resource_type)
        elif args.mode == 'verify':
            await indexer.verify_search_params()
        elif args.mode == 'fix':
            await indexer.fix_missing_params()
        elif args.mode == 'monitor':
            await indexer.monitor_health()
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())