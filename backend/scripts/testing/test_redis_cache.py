#!/usr/bin/env python3
"""
Test Redis Cache Performance

Verifies that Redis caching is working correctly and improving performance.

Author: WintEHR Team
Date: 2025-01-24
"""

import asyncio
import logging
import os
import sys
import time
import redis
from typing import Dict, Any, List

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from fhir.core.storage import FHIRStorageEngine
from fhir.core.cache import FHIRCacheService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RedisCacheTester:
    """Test Redis cache functionality and performance."""
    
    def __init__(self, database_url: str = None):
        """Initialize tester."""
        if not database_url:
            database_url = os.getenv(
                'DATABASE_URL',
                'postgresql+asyncpg://emr_user:emr_password@localhost/emr_db'
            )
        
        self.engine = create_async_engine(database_url, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        
        # Initialize cache service
        self.cache_service = FHIRCacheService()
    
    async def test_cache_functionality(self) -> Dict[str, Any]:
        """Test basic cache functionality."""
        results = {
            'connection': False,
            'set_get': False,
            'invalidation': False,
            'search_cache': False,
            'performance': {}
        }
        
        # Test connection
        try:
            if self.cache_service.enabled:
                self.cache_service.redis_client.ping()
                results['connection'] = True
                logger.info("✅ Redis connection successful")
            else:
                logger.warning("❌ Redis caching is disabled")
                return results
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            return results
        
        # Test set/get functionality
        try:
            test_resource = {
                'resourceType': 'Patient',
                'id': 'test-123',
                'name': [{'family': 'Test', 'given': ['Cache']}]
            }
            
            # Cache the resource
            await self.cache_service.cache_resource(test_resource)
            
            # Retrieve it
            cached = await self.cache_service.get_cached_resource('Patient', 'test-123')
            
            if cached and cached['id'] == 'test-123':
                results['set_get'] = True
                logger.info("✅ Cache set/get test passed")
            else:
                logger.error("❌ Cache set/get test failed")
        except Exception as e:
            logger.error(f"❌ Cache set/get test error: {e}")
        
        # Test invalidation
        try:
            # Invalidate the resource
            await self.cache_service.invalidate_resource('Patient', 'test-123')
            
            # Try to retrieve it again
            cached = await self.cache_service.get_cached_resource('Patient', 'test-123')
            
            if cached is None:
                results['invalidation'] = True
                logger.info("✅ Cache invalidation test passed")
            else:
                logger.error("❌ Cache invalidation test failed")
        except Exception as e:
            logger.error(f"❌ Cache invalidation test error: {e}")
        
        # Test search caching with real data
        async with self.async_session() as session:
            storage = FHIRStorageEngine(session)
            
            try:
                # First search (cache miss)
                start_time = time.time()
                resources1, count1 = await storage.search_resources(
                    'Patient',
                    {'name': 'Smith'},
                    limit=10
                )
                first_time = (time.time() - start_time) * 1000
                
                # Second search (should be cache hit)
                start_time = time.time()
                resources2, count2 = await storage.search_resources(
                    'Patient',
                    {'name': 'Smith'},
                    limit=10
                )
                second_time = (time.time() - start_time) * 1000
                
                # Verify same results and faster second query
                if count1 == count2 and second_time < first_time * 0.5:
                    results['search_cache'] = True
                    results['performance'] = {
                        'first_query_ms': first_time,
                        'cached_query_ms': second_time,
                        'speedup': first_time / second_time if second_time > 0 else 0
                    }
                    logger.info(f"✅ Search cache test passed - {results['performance']['speedup']:.1f}x speedup")
                else:
                    logger.error(f"❌ Search cache test failed - first: {first_time:.1f}ms, second: {second_time:.1f}ms")
                    
            except Exception as e:
                logger.error(f"❌ Search cache test error: {e}")
        
        return results
    
    async def test_cache_performance(self) -> None:
        """Test cache performance with various scenarios."""
        logger.info("\n📊 Testing Cache Performance:")
        
        test_scenarios = [
            {
                'name': 'Simple Patient Search',
                'resource_type': 'Patient',
                'params': {'name': 'Johnson'}
            },
            {
                'name': 'Complex Condition Search',
                'resource_type': 'Condition',
                'params': {
                    'patient': 'Patient/f21ef45f-fba5-fd6f-08f9-b528c5b4bbcc',
                    'clinical-status': 'active',
                    'category': 'encounter-diagnosis'
                }
            },
            {
                'name': 'Individual Resource Read',
                'operation': 'read',
                'resource_type': 'Patient',
                'resource_id': 'f21ef45f-fba5-fd6f-08f9-b528c5b4bbcc'
            }
        ]
        
        async with self.async_session() as session:
            storage = FHIRStorageEngine(session)
            
            for scenario in test_scenarios:
                logger.info(f"\n  Testing: {scenario['name']}")
                
                if scenario.get('operation') == 'read':
                    # Test resource read
                    # First read (potential cache miss)
                    start_time = time.time()
                    resource1 = await storage.read_resource(
                        scenario['resource_type'],
                        scenario['resource_id']
                    )
                    first_time = (time.time() - start_time) * 1000
                    
                    # Second read (should be cache hit)
                    start_time = time.time()
                    resource2 = await storage.read_resource(
                        scenario['resource_type'],
                        scenario['resource_id']
                    )
                    second_time = (time.time() - start_time) * 1000
                    
                    if resource1 and resource2:
                        speedup = first_time / second_time if second_time > 0 else 0
                        logger.info(f"    First read: {first_time:.2f}ms")
                        logger.info(f"    Cached read: {second_time:.2f}ms")
                        logger.info(f"    Speedup: {speedup:.1f}x")
                else:
                    # Test search
                    # Clear cache for this resource type first
                    await self.cache_service.clear_cache(scenario['resource_type'])
                    
                    # First search (cache miss)
                    start_time = time.time()
                    resources1, count1 = await storage.search_resources(
                        scenario['resource_type'],
                        scenario['params'],
                        limit=20
                    )
                    first_time = (time.time() - start_time) * 1000
                    
                    # Second search (cache hit)
                    start_time = time.time()
                    resources2, count2 = await storage.search_resources(
                        scenario['resource_type'],
                        scenario['params'],
                        limit=20
                    )
                    second_time = (time.time() - start_time) * 1000
                    
                    speedup = first_time / second_time if second_time > 0 else 0
                    logger.info(f"    First search: {first_time:.2f}ms ({count1} results)")
                    logger.info(f"    Cached search: {second_time:.2f}ms ({count2} results)")
                    logger.info(f"    Speedup: {speedup:.1f}x")
    
    async def get_cache_stats(self) -> None:
        """Display cache statistics."""
        stats = await self.cache_service.get_cache_stats()
        
        logger.info("\n📈 Cache Statistics:")
        logger.info(f"  Enabled: {stats.get('enabled', False)}")
        logger.info(f"  Connected: {stats.get('connected', False)}")
        
        if stats.get('connected'):
            logger.info(f"  Memory Used: {stats.get('memory_used', 'Unknown')}")
            logger.info(f"  Total Keys: {stats.get('total_keys', 0)}")
            logger.info(f"  Hit Rate: {stats.get('hit_rate', 0):.2%}")
            
            if stats.get('resource_types'):
                logger.info("  Cached Resource Types:")
                for resource_type, counts in stats['resource_types'].items():
                    logger.info(f"    {resource_type}: {counts['search']} searches, {counts['get']} resources")
    
    async def close(self):
        """Close connections."""
        await self.engine.dispose()
        if self.cache_service:
            self.cache_service.close()


async def main():
    """Main test execution."""
    logger.info("🚀 Testing Redis Cache Integration")
    logger.info("=" * 60)
    
    # Check if running in Docker
    in_docker = os.path.exists('/.dockerenv') or os.getenv('DOCKER_CONTAINER') == 'true'
    
    # Set database URL based on environment
    if in_docker or '--docker' in sys.argv:
        database_url = 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db'
        os.environ['REDIS_URL'] = 'redis://redis:6379/0'
    else:
        database_url = os.getenv(
            'DATABASE_URL',
            'postgresql+asyncpg://emr_user:emr_password@localhost/emr_db'
        )
    
    tester = RedisCacheTester(database_url)
    
    try:
        # Test functionality
        results = await tester.test_cache_functionality()
        
        # Test performance
        await tester.test_cache_performance()
        
        # Show stats
        await tester.get_cache_stats()
        
        # Summary
        logger.info("\n✅ Redis cache test completed!")
        logger.info(f"  Connection: {'✅' if results['connection'] else '❌'}")
        logger.info(f"  Set/Get: {'✅' if results['set_get'] else '❌'}")
        logger.info(f"  Invalidation: {'✅' if results['invalidation'] else '❌'}")
        logger.info(f"  Search Cache: {'✅' if results['search_cache'] else '❌'}")
        
        if results.get('performance'):
            logger.info(f"  Average Speedup: {results['performance']['speedup']:.1f}x")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await tester.close()


if __name__ == "__main__":
    asyncio.run(main())