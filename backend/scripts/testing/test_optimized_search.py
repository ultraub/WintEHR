#!/usr/bin/env python3
"""
Test Optimized Search Query Builder Bug Fixes

Verifies that the OptimizedSearchBuilder is working correctly after fixing:
1. KeyError bug - param_data['name'] doesn't exist
2. Value extraction bug - values are dictionaries not strings

Author: WintEHR Team
Date: 2025-01-25
"""

import asyncio
import logging
import os
import sys
import time
from typing import Dict, Any, List

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from fhir.core.storage import FHIRStorageEngine
from fhir.core.search.optimized import OptimizedSearchBuilder

# Configure logging to see debug output
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SearchPerformanceTester:
    """Test and compare search performance."""
    
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
    
    async def test_search_performance(self) -> Dict[str, Any]:
        """Test search performance with various queries."""
        results = {
            'basic_search': [],
            'optimized_search': [],
            'improvements': []
        }
        
        # Test queries
        test_queries = [
            # Simple patient search
            {
                'name': 'Patient by name',
                'resource_type': 'Patient',
                'params': {'name': 'Smith'}
            },
            # Multi-parameter condition search
            {
                'name': 'Active conditions for patient',
                'resource_type': 'Condition',
                'params': {
                    'patient': 'Patient/f21ef45f-fba5-fd6f-08f9-b528c5b4bbcc',
                    'clinical-status': 'active'
                }
            },
            # Complex observation search
            {
                'name': 'Vital signs for patient',
                'resource_type': 'Observation',
                'params': {
                    'patient': 'Patient/f21ef45f-fba5-fd6f-08f9-b528c5b4bbcc',
                    'category': 'vital-signs',
                    'date': 'ge2024-01-01'
                }
            },
            # Medication request search
            {
                'name': 'Active medications for patient',
                'resource_type': 'MedicationRequest',
                'params': {
                    'patient': 'Patient/f21ef45f-fba5-fd6f-08f9-b528c5b4bbcc',
                    'status': 'active'
                }
            }
        ]
        
        # Initialize storage engine
        async with self.async_session() as session:
            storage = FHIRStorageEngine(session)
            
            for test_query in test_queries:
                logger.info(f"\n🔍 Testing: {test_query['name']}")
                
                # Test with basic search (disable optimization)
                os.environ['USE_OPTIMIZED_SEARCH'] = 'false'
                start_time = time.time()
                
                try:
                    basic_resources, basic_count = await storage.search_resources(
                        test_query['resource_type'],
                        test_query['params']
                    )
                    basic_time = (time.time() - start_time) * 1000  # Convert to ms
                    
                    results['basic_search'].append({
                        'query': test_query['name'],
                        'time_ms': basic_time,
                        'count': basic_count,
                        'success': True
                    })
                    
                    logger.info(f"  Basic search: {basic_time:.2f}ms, {basic_count} results")
                    
                except Exception as e:
                    logger.error(f"  Basic search failed: {e}")
                    results['basic_search'].append({
                        'query': test_query['name'],
                        'error': str(e),
                        'success': False
                    })
                
                # Test with optimized search
                os.environ['USE_OPTIMIZED_SEARCH'] = 'true'
                start_time = time.time()
                
                try:
                    opt_resources, opt_count = await storage.search_resources(
                        test_query['resource_type'],
                        test_query['params']
                    )
                    opt_time = (time.time() - start_time) * 1000  # Convert to ms
                    
                    results['optimized_search'].append({
                        'query': test_query['name'],
                        'time_ms': opt_time,
                        'count': opt_count,
                        'success': True
                    })
                    
                    logger.info(f"  Optimized search: {opt_time:.2f}ms, {opt_count} results")
                    
                    # Calculate improvement
                    if 'basic_time' in locals() and basic_time > 0:
                        improvement = ((basic_time - opt_time) / basic_time) * 100
                        speedup = basic_time / opt_time if opt_time > 0 else 0
                        
                        results['improvements'].append({
                            'query': test_query['name'],
                            'basic_ms': basic_time,
                            'optimized_ms': opt_time,
                            'improvement_pct': improvement,
                            'speedup_factor': speedup
                        })
                        
                        logger.info(f"  ✨ Improvement: {improvement:.1f}% faster ({speedup:.1f}x speedup)")
                    
                except Exception as e:
                    logger.error(f"  Optimized search failed: {e}")
                    results['optimized_search'].append({
                        'query': test_query['name'],
                        'error': str(e),
                        'success': False
                    })
        
        return results
    
    async def verify_query_plans(self) -> None:
        """Verify that optimized queries use indexes properly."""
        logger.info("\n📊 Verifying Query Plans:")
        
        async with self.async_session() as session:
            # Example optimized query
            optimized_query = """
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT DISTINCT r.resource, r.fhir_id, r.version_id, r.last_updated
                FROM fhir.resources r
                WHERE r.resource_type = 'Condition'
                AND r.deleted = false
                AND EXISTS (
                    SELECT 1 FROM fhir.search_params sp1
                    WHERE sp1.resource_id = r.id
                    AND sp1.param_name = 'patient'
                    AND sp1.value_reference = 'Patient/f21ef45f-fba5-fd6f-08f9-b528c5b4bbcc'
                )
                AND EXISTS (
                    SELECT 1 FROM fhir.search_params sp2
                    WHERE sp2.resource_id = r.id
                    AND sp2.param_name = 'clinical-status'
                    AND sp2.value_token = 'active'
                )
                ORDER BY r.last_updated DESC
                LIMIT 100
            """
            
            result = await session.execute(text(optimized_query))
            
            logger.info("\nOptimized Query Plan:")
            for row in result:
                logger.info(f"  {row[0]}")
    
    async def test_bug_fixes(self) -> None:
        """Test that the bug fixes work correctly."""
        logger.info("\n🐛 Testing Bug Fixes:")
        
        # Test the OptimizedSearchBuilder directly
        builder = OptimizedSearchBuilder()
        
        # Test case that would trigger the KeyError bug
        test_params = {
            'patient': {
                'type': 'reference',
                'values': [{'value': 'Patient/123'}]
            },
            'status': {
                'type': 'token',
                'values': [{'value': 'active'}]
            }
        }
        
        try:
            query, sql_params = builder.build_optimized_query(
                'MedicationRequest',
                test_params,
                limit=10,
                offset=0,
                count_only=False
            )
            
            logger.info("✅ Bug fix test PASSED - No KeyError!")
            logger.info(f"Generated query: {query[:200]}...")
            logger.info(f"SQL params: {sql_params}")
            
            # Test with actual database
            async with self.async_session() as session:
                result = await session.execute(text(query), sql_params)
                rows = result.fetchall()
                logger.info(f"Query executed successfully, returned {len(rows)} rows")
                
        except Exception as e:
            logger.error(f"❌ Bug fix test FAILED: {e}")
            import traceback
            traceback.print_exc()
    
    async def close(self):
        """Close database connection."""
        await self.engine.dispose()


async def main():
    """Main test execution."""
    logger.info("🚀 Testing Optimized Search Performance")
    logger.info("=" * 60)
    
    # Check if running in Docker
    in_docker = os.path.exists('/.dockerenv') or os.getenv('DOCKER_CONTAINER') == 'true'
    
    # Set database URL based on environment
    if in_docker or '--docker' in sys.argv:
        database_url = 'postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db'
    else:
        database_url = os.getenv(
            'DATABASE_URL',
            'postgresql+asyncpg://emr_user:emr_password@localhost/emr_db'
        )
    
    tester = SearchPerformanceTester(database_url)
    
    try:
        # First test the bug fixes
        await tester.test_bug_fixes()
        
        # Run performance tests
        results = await tester.test_search_performance()
        
        # Verify query plans
        await tester.verify_query_plans()
        
        # Summary
        logger.info("\n📈 Performance Summary:")
        
        if results['improvements']:
            total_improvement = sum(imp['improvement_pct'] for imp in results['improvements'])
            avg_improvement = total_improvement / len(results['improvements'])
            avg_speedup = sum(imp['speedup_factor'] for imp in results['improvements']) / len(results['improvements'])
            
            logger.info(f"  Average improvement: {avg_improvement:.1f}%")
            logger.info(f"  Average speedup: {avg_speedup:.1f}x faster")
            
            logger.info("\n🏆 Best improvements:")
            sorted_improvements = sorted(
                results['improvements'], 
                key=lambda x: x['speedup_factor'], 
                reverse=True
            )
            
            for imp in sorted_improvements[:3]:
                logger.info(f"  {imp['query']}: {imp['speedup_factor']:.1f}x faster "
                          f"({imp['basic_ms']:.1f}ms → {imp['optimized_ms']:.1f}ms)")
        
        logger.info("\n✅ Search optimization test completed!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await tester.close()


if __name__ == "__main__":
    asyncio.run(main())