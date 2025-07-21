#!/usr/bin/env python3
"""
Test script to verify connection pool optimization improvements.

Compares performance between the standard and optimized database configurations.
"""

import asyncio
import os
import sys
import time
import statistics
from datetime import datetime
from typing import List, Dict, Any
import httpx

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from database import get_db_session as get_standard_db
from database_optimized import get_db_session as get_optimized_db, get_pool_status, warmup_pool
from sqlalchemy import text


async def test_connection_acquisition(db_getter, name: str, iterations: int = 50) -> Dict[str, Any]:
    """Test how quickly connections can be acquired from the pool."""
    print(f"\n=== Testing {name} Connection Acquisition ===")
    
    times = []
    errors = 0
    
    for i in range(iterations):
        start_time = time.time()
        try:
            async for db in db_getter():
                # Just get a connection and release it
                await db.execute(text("SELECT 1"))
                break
            acquisition_time = time.time() - start_time
            times.append(acquisition_time)
        except Exception as e:
            errors += 1
            print(f"Error on iteration {i}: {e}")
    
    if times:
        return {
            "name": name,
            "iterations": iterations,
            "errors": errors,
            "min_time": min(times) * 1000,  # Convert to ms
            "max_time": max(times) * 1000,
            "mean_time": statistics.mean(times) * 1000,
            "median_time": statistics.median(times) * 1000,
            "stddev_time": statistics.stdev(times) * 1000 if len(times) > 1 else 0
        }
    else:
        return {
            "name": name,
            "iterations": iterations,
            "errors": errors,
            "status": "Failed - no successful connections"
        }


async def test_concurrent_load(db_getter, name: str, concurrent_tasks: int = 20) -> Dict[str, Any]:
    """Test performance under concurrent load."""
    print(f"\n=== Testing {name} Concurrent Load ({concurrent_tasks} tasks) ===")
    
    async def execute_query(task_id: int) -> float:
        start_time = time.time()
        async for db in db_getter():
            # Simulate a typical query
            result = await db.execute(text("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE resource_type = 'Patient' 
                AND deleted = false
            """))
            break
        return time.time() - start_time
    
    # Run concurrent tasks
    start_time = time.time()
    tasks = [execute_query(i) for i in range(concurrent_tasks)]
    
    try:
        task_times = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # Filter out exceptions
        successful_times = [t for t in task_times if isinstance(t, float)]
        errors = len([t for t in task_times if isinstance(t, Exception)])
        
        if successful_times:
            return {
                "name": name,
                "concurrent_tasks": concurrent_tasks,
                "total_time": total_time * 1000,
                "successful_tasks": len(successful_times),
                "errors": errors,
                "avg_task_time": statistics.mean(successful_times) * 1000,
                "max_task_time": max(successful_times) * 1000,
                "throughput": len(successful_times) / total_time  # tasks per second
            }
        else:
            return {
                "name": name,
                "concurrent_tasks": concurrent_tasks,
                "errors": errors,
                "status": "Failed - no successful tasks"
            }
            
    except Exception as e:
        return {
            "name": name,
            "concurrent_tasks": concurrent_tasks,
            "error": str(e),
            "status": "Failed"
        }


async def test_query_performance(db_getter, name: str) -> Dict[str, Any]:
    """Test performance of various query types."""
    print(f"\n=== Testing {name} Query Performance ===")
    
    queries = [
        ("Simple SELECT", "SELECT 1"),
        ("Count query", "SELECT COUNT(*) FROM fhir.resources WHERE deleted = false"),
        ("Complex search", """
            SELECT r.* FROM fhir.resources r
            JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.resource_type = 'Patient' 
            AND sp.param_name = 'name'
            AND r.deleted = false
            LIMIT 10
        """),
        ("Aggregation", """
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false
            GROUP BY resource_type
            ORDER BY count DESC
        """)
    ]
    
    results = []
    
    for query_name, query_sql in queries:
        times = []
        
        for _ in range(5):  # Run each query 5 times
            start_time = time.time()
            try:
                async for db in db_getter():
                    await db.execute(text(query_sql))
                    break
                query_time = time.time() - start_time
                times.append(query_time)
            except Exception as e:
                print(f"Error in {query_name}: {e}")
        
        if times:
            results.append({
                "query": query_name,
                "avg_time": statistics.mean(times) * 1000,
                "min_time": min(times) * 1000,
                "max_time": max(times) * 1000
            })
    
    return {
        "name": name,
        "queries": results
    }


async def test_api_performance() -> Dict[str, Any]:
    """Test performance through the API with caching enabled."""
    print("\n=== Testing API Performance ===")
    
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient() as client:
        # Test different endpoints
        endpoints = [
            ("/fhir/R4/Patient?_count=10", "Patient search"),
            ("/fhir/R4/Observation?patient=Patient/1&_count=20", "Observation search"),
            ("/fhir/R4/MedicationRequest?status=active&_count=10", "MedicationRequest search"),
            ("/api/monitoring/health", "Health check"),
            ("/api/monitoring/pool/status", "Pool status")
        ]
        
        results = []
        
        for endpoint, name in endpoints:
            times = []
            
            # First request (cache miss)
            start_time = time.time()
            response = await client.get(f"{base_url}{endpoint}")
            first_time = time.time() - start_time
            
            if response.status_code == 200:
                # Subsequent requests (should hit cache)
                for _ in range(3):
                    start_time = time.time()
                    response = await client.get(f"{base_url}{endpoint}")
                    times.append(time.time() - start_time)
                
                results.append({
                    "endpoint": name,
                    "first_request_ms": first_time * 1000,
                    "cached_avg_ms": statistics.mean(times) * 1000 if times else 0,
                    "cache_speedup": first_time / statistics.mean(times) if times else 0
                })
            else:
                results.append({
                    "endpoint": name,
                    "error": f"Status {response.status_code}"
                })
        
        return {"api_tests": results}


async def compare_configurations():
    """Compare standard vs optimized database configurations."""
    print(f"Connection Pool Optimization Testing - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Warm up the optimized pool
    print("\nWarming up optimized connection pool...")
    await warmup_pool()
    print("✅ Pool warmup complete")
    
    # Run tests for both configurations
    test_configs = [
        (get_standard_db, "Standard Pool"),
        (get_optimized_db, "Optimized Pool")
    ]
    
    all_results = {}
    
    # 1. Connection acquisition test
    print("\n" + "=" * 80)
    print("CONNECTION ACQUISITION TEST")
    print("=" * 80)
    
    for db_getter, name in test_configs:
        result = await test_connection_acquisition(db_getter, name)
        all_results[f"{name}_acquisition"] = result
        
        if "mean_time" in result:
            print(f"\n{name} Results:")
            print(f"  Mean time: {result['mean_time']:.2f}ms")
            print(f"  Min time:  {result['min_time']:.2f}ms")
            print(f"  Max time:  {result['max_time']:.2f}ms")
            print(f"  Errors:    {result['errors']}")
    
    # 2. Concurrent load test
    print("\n" + "=" * 80)
    print("CONCURRENT LOAD TEST")
    print("=" * 80)
    
    for db_getter, name in test_configs:
        result = await test_concurrent_load(db_getter, name)
        all_results[f"{name}_concurrent"] = result
        
        if "throughput" in result:
            print(f"\n{name} Results:")
            print(f"  Total time:     {result['total_time']:.2f}ms")
            print(f"  Avg task time:  {result['avg_task_time']:.2f}ms")
            print(f"  Throughput:     {result['throughput']:.1f} tasks/sec")
            print(f"  Errors:         {result['errors']}")
    
    # 3. Query performance test
    print("\n" + "=" * 80)
    print("QUERY PERFORMANCE TEST")
    print("=" * 80)
    
    for db_getter, name in test_configs:
        result = await test_query_performance(db_getter, name)
        all_results[f"{name}_queries"] = result
        
        print(f"\n{name} Results:")
        for query_result in result["queries"]:
            print(f"  {query_result['query']:.<30} {query_result['avg_time']:>8.2f}ms")
    
    # 4. API performance test
    print("\n" + "=" * 80)
    print("API PERFORMANCE TEST")
    print("=" * 80)
    
    api_results = await test_api_performance()
    all_results["api"] = api_results
    
    print("\nAPI Results:")
    for test in api_results["api_tests"]:
        if "error" not in test:
            print(f"  {test['endpoint']:.<30}")
            print(f"    First request:  {test['first_request_ms']:>8.2f}ms")
            print(f"    Cached avg:     {test['cached_avg_ms']:>8.2f}ms")
            print(f"    Cache speedup:  {test['cache_speedup']:>8.1f}x")
        else:
            print(f"  {test['endpoint']:.<30} ERROR: {test['error']}")
    
    # 5. Get pool status if using optimized pool
    try:
        pool_status = await get_pool_status()
        print("\n" + "=" * 80)
        print("OPTIMIZED POOL STATUS")
        print("=" * 80)
        print(f"  Pool size:      {pool_status['pool_size']}")
        print(f"  Max overflow:   {pool_status['max_overflow']}")
        print(f"  Checked out:    {pool_status['checked_out']}")
        print(f"  Utilization:    {pool_status['utilization']:.1%}")
        print(f"  Recommendation: {pool_status['recommendation']}")
    except Exception as e:
        print(f"\n⚠️  Could not get pool status: {e}")
    
    # Summary comparison
    print("\n" + "=" * 80)
    print("PERFORMANCE COMPARISON SUMMARY")
    print("=" * 80)
    
    # Compare acquisition times
    std_acq = all_results.get("Standard Pool_acquisition", {})
    opt_acq = all_results.get("Optimized Pool_acquisition", {})
    
    if "mean_time" in std_acq and "mean_time" in opt_acq:
        improvement = (std_acq["mean_time"] - opt_acq["mean_time"]) / std_acq["mean_time"] * 100
        print(f"\nConnection Acquisition:")
        print(f"  Standard:  {std_acq['mean_time']:.2f}ms")
        print(f"  Optimized: {opt_acq['mean_time']:.2f}ms")
        print(f"  Improvement: {improvement:.1f}%")
    
    # Compare throughput
    std_con = all_results.get("Standard Pool_concurrent", {})
    opt_con = all_results.get("Optimized Pool_concurrent", {})
    
    if "throughput" in std_con and "throughput" in opt_con:
        improvement = (opt_con["throughput"] - std_con["throughput"]) / std_con["throughput"] * 100
        print(f"\nConcurrent Throughput:")
        print(f"  Standard:  {std_con['throughput']:.1f} tasks/sec")
        print(f"  Optimized: {opt_con['throughput']:.1f} tasks/sec")
        print(f"  Improvement: {improvement:.1f}%")
    
    print("\n" + "=" * 80)
    print("✅ Connection pool optimization testing complete!")
    
    return all_results


async def main():
    """Run all connection pool optimization tests."""
    try:
        results = await compare_configurations()
        
        # Check if optimization is working
        improvements = []
        
        std_acq = results.get("Standard Pool_acquisition", {})
        opt_acq = results.get("Optimized Pool_acquisition", {})
        if "mean_time" in std_acq and "mean_time" in opt_acq:
            improvements.append(opt_acq["mean_time"] < std_acq["mean_time"])
        
        std_con = results.get("Standard Pool_concurrent", {})
        opt_con = results.get("Optimized Pool_concurrent", {})
        if "throughput" in std_con and "throughput" in opt_con:
            improvements.append(opt_con["throughput"] > std_con["throughput"])
        
        if all(improvements) and improvements:
            print("\n🎉 Optimized pool shows performance improvements!")
            return True
        else:
            print("\n⚠️  Optimized pool performance needs tuning")
            return False
            
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)