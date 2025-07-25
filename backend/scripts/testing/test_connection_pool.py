#!/usr/bin/env python3
"""
Test Database Connection Pool Performance

Tests connection pooling configuration and monitors performance improvements.

Author: WintEHR Team
Date: 2025-01-24
"""

import asyncio
import logging
import os
import sys
import time
from typing import Dict, Any, List
import statistics

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from database_enhanced import (
    engine, 
    get_db_session, 
    get_pool_status,
    optimize_pool_settings,
    initialize_pool_monitor,
    warmup_pool,
    shutdown_database
)
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ConnectionPoolTester:
    """Test connection pool performance and optimization."""
    
    async def test_concurrent_connections(self, num_connections: int = 50) -> Dict[str, Any]:
        """
        Test performance with concurrent connections.
        
        Args:
            num_connections: Number of concurrent connections to test
            
        Returns:
            Dictionary with test results
        """
        logger.info(f"\n🔌 Testing {num_connections} concurrent connections...")
        
        async def execute_query(query_id: int) -> float:
            """Execute a simple query and return execution time."""
            start_time = time.time()
            
            try:
                async with engine.connect() as conn:
                    # Simulate a typical query
                    result = await conn.execute(text("""
                        SELECT COUNT(*) 
                        FROM fhir.resources 
                        WHERE resource_type = 'Patient'
                    """))
                    count = result.scalar()
                    
                execution_time = time.time() - start_time
                return execution_time
                
            except Exception as e:
                logger.error(f"Query {query_id} failed: {e}")
                return -1
        
        # Get pool status before test
        status_before = await get_pool_status()
        
        # Execute concurrent queries
        start_time = time.time()
        tasks = [execute_query(i) for i in range(num_connections)]
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        # Get pool status after test
        status_after = await get_pool_status()
        
        # Calculate statistics
        successful_queries = [r for r in results if r > 0]
        failed_queries = [r for r in results if r < 0]
        
        stats = {
            'total_queries': num_connections,
            'successful_queries': len(successful_queries),
            'failed_queries': len(failed_queries),
            'total_time': total_time,
            'queries_per_second': num_connections / total_time if total_time > 0 else 0,
            'avg_query_time': statistics.mean(successful_queries) if successful_queries else 0,
            'min_query_time': min(successful_queries) if successful_queries else 0,
            'max_query_time': max(successful_queries) if successful_queries else 0,
            'pool_status_before': status_before,
            'pool_status_after': status_after
        }
        
        return stats
    
    async def test_pool_exhaustion(self) -> Dict[str, Any]:
        """Test behavior when pool is exhausted."""
        logger.info("\n🚫 Testing pool exhaustion behavior...")
        
        # Get current pool config
        pool_status = await get_pool_status()
        pool_size = pool_status['pool_config']['size']
        max_overflow = pool_status['pool_config']['max_overflow']
        total_capacity = pool_size + max_overflow
        
        logger.info(f"Pool capacity: {pool_size} + {max_overflow} overflow = {total_capacity} total")
        
        # Hold connections to exhaust pool
        connections = []
        exhaustion_point = 0
        
        try:
            for i in range(total_capacity + 10):
                try:
                    conn = await engine.connect()
                    connections.append(conn)
                    
                    if i % 10 == 0:
                        status = await get_pool_status()
                        logger.info(f"Connections held: {i+1}, Pool status: {status['pool_status']}")
                        
                except asyncio.TimeoutError:
                    exhaustion_point = i
                    logger.warning(f"Pool exhausted at {i} connections")
                    break
                except Exception as e:
                    exhaustion_point = i
                    logger.error(f"Error at {i} connections: {e}")
                    break
            
            # Try one more query with exhausted pool
            try:
                start_time = time.time()
                async with asyncio.timeout(5):  # 5 second timeout
                    async with engine.connect() as conn:
                        await conn.execute(text("SELECT 1"))
                wait_time = time.time() - start_time
                pool_recovered = True
            except asyncio.TimeoutError:
                wait_time = 5.0
                pool_recovered = False
            
        finally:
            # Release all connections
            for conn in connections:
                await conn.close()
        
        return {
            'pool_capacity': total_capacity,
            'exhaustion_point': exhaustion_point,
            'pool_recovered': pool_recovered,
            'recovery_wait_time': wait_time
        }
    
    async def test_connection_recycling(self) -> Dict[str, Any]:
        """Test connection recycling behavior."""
        logger.info("\n♻️  Testing connection recycling...")
        
        results = []
        
        # Execute queries over time to test recycling
        for i in range(5):
            async with engine.connect() as conn:
                # Get connection info
                result = await conn.execute(text("""
                    SELECT 
                        pid,
                        backend_start,
                        state_change,
                        EXTRACT(EPOCH FROM (NOW() - backend_start)) as connection_age_seconds
                    FROM pg_stat_activity
                    WHERE pid = pg_backend_pid()
                """))
                
                row = result.first()
                if row:
                    results.append({
                        'iteration': i,
                        'pid': row[0],
                        'connection_age': row[3]
                    })
            
            # Wait a bit between connections
            await asyncio.sleep(1)
        
        # Check if PIDs changed (indicating recycling)
        pids = [r['pid'] for r in results]
        unique_pids = len(set(pids))
        
        return {
            'connections_tested': len(results),
            'unique_pids': unique_pids,
            'recycling_detected': unique_pids > 1,
            'connection_details': results
        }
    
    async def test_optimization_recommendations(self) -> Dict[str, Any]:
        """Get and display optimization recommendations."""
        logger.info("\n🔧 Getting optimization recommendations...")
        
        # Get current status
        status = await get_pool_status()
        
        # Get recommendations
        recommendations = await optimize_pool_settings()
        
        return {
            'current_health_score': recommendations['current_health_score'],
            'recommendations': recommendations['recommendations'],
            'optimal_settings': recommendations['optimal_settings'],
            'current_settings': recommendations['current_settings']
        }


async def main():
    """Main test execution."""
    logger.info("🚀 Testing Database Connection Pool")
    logger.info("=" * 60)
    
    try:
        # Initialize pool monitor
        await initialize_pool_monitor()
        
        # Warm up pool
        logger.info("\n🔥 Warming up connection pool...")
        await warmup_pool()
        
        # Wait for warmup to complete
        await asyncio.sleep(2)
        
        tester = ConnectionPoolTester()
        
        # Test 1: Concurrent connections with different loads
        for num_connections in [10, 25, 50, 100]:
            results = await tester.test_concurrent_connections(num_connections)
            
            logger.info(f"\n📊 Results for {num_connections} concurrent connections:")
            logger.info(f"  Total time: {results['total_time']:.2f}s")
            logger.info(f"  Queries/second: {results['queries_per_second']:.1f}")
            logger.info(f"  Avg query time: {results['avg_query_time']*1000:.1f}ms")
            logger.info(f"  Min/Max query time: {results['min_query_time']*1000:.1f}ms / {results['max_query_time']*1000:.1f}ms")
            logger.info(f"  Failed queries: {results['failed_queries']}")
            
            # Show pool status
            pool_after = results['pool_status_after']['pool_status']
            logger.info(f"  Pool status: {pool_after['checked_out']}/{pool_after['total']} connections in use")
            
            # Wait between tests
            await asyncio.sleep(2)
        
        # Test 2: Pool exhaustion
        exhaustion_results = await tester.test_pool_exhaustion()
        logger.info(f"\n📊 Pool exhaustion test results:")
        logger.info(f"  Pool capacity: {exhaustion_results['pool_capacity']}")
        logger.info(f"  Exhausted at: {exhaustion_results['exhaustion_point']} connections")
        logger.info(f"  Recovery successful: {exhaustion_results['pool_recovered']}")
        logger.info(f"  Recovery wait time: {exhaustion_results['recovery_wait_time']:.2f}s")
        
        # Test 3: Connection recycling
        recycling_results = await tester.test_connection_recycling()
        logger.info(f"\n📊 Connection recycling test results:")
        logger.info(f"  Connections tested: {recycling_results['connections_tested']}")
        logger.info(f"  Unique PIDs: {recycling_results['unique_pids']}")
        logger.info(f"  Recycling detected: {recycling_results['recycling_detected']}")
        
        # Test 4: Get optimization recommendations
        optimization = await tester.test_optimization_recommendations()
        logger.info(f"\n📊 Optimization recommendations:")
        logger.info(f"  Current health score: {optimization['current_health_score']:.1f}%")
        
        if optimization['recommendations']:
            logger.info("  Recommendations:")
            for rec in optimization['recommendations']:
                logger.info(f"    [{rec['priority'].upper()}] {rec['issue']}")
                logger.info(f"      → {rec['recommendation']}")
        
        logger.info("\n  Optimal settings vs Current:")
        for key, optimal_value in optimization['optimal_settings'].items():
            current_value = optimization['current_settings'].get(key, 'N/A')
            if optimal_value != current_value:
                logger.info(f"    {key}: {current_value} → {optimal_value} (recommended)")
            else:
                logger.info(f"    {key}: {current_value} ✓")
        
        # Final pool status
        final_status = await get_pool_status()
        logger.info(f"\n📈 Final pool health score: {final_status['health_score']:.1f}%")
        
        logger.info("\n✅ Connection pool test completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await shutdown_database()


if __name__ == "__main__":
    asyncio.run(main())