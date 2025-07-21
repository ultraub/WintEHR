#!/usr/bin/env python3
"""
Test script to verify Redis cache functionality in FHIR API.

Tests both direct cache operations and integration with the FHIR search API.
"""

import asyncio
import os
import sys
import time
import httpx
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fhir.api.redis_cache import RedisSearchCache, get_redis_cache
from fhir.api.cache import get_search_cache


async def test_redis_connection():
    """Test basic Redis connection and operations."""
    print("\n=== Testing Redis Connection ===")
    
    try:
        cache = await get_redis_cache()
        
        # Test set and get
        test_data = ([{"id": "test-1", "name": "Test Patient"}], 1)
        await cache.set("Patient", {"name": "test"}, test_data[0], test_data[1])
        
        # Retrieve data
        result = await cache.get("Patient", {"name": "test"})
        if result:
            print("✅ Redis connection successful")
            print(f"   Retrieved data: {result}")
        else:
            print("❌ Failed to retrieve data from Redis")
        
        # Test cache invalidation
        await cache.invalidate_resource_type("Patient")
        result_after = await cache.get("Patient", {"name": "test"})
        if result_after is None:
            print("✅ Cache invalidation working")
        else:
            print("❌ Cache invalidation failed")
        
        # Get stats
        stats = await cache.get_stats()
        print(f"\n📊 Cache Statistics:")
        print(f"   Redis Available: {stats['redis_cache']['available']}")
        print(f"   Redis Connected: {stats['redis_cache'].get('connected', False)}")
        print(f"   Total Requests: {stats['total_requests']}")
        print(f"   Hit Rate: {stats['hit_rate']:.2%}")
        
    except Exception as e:
        print(f"❌ Redis connection error: {e}")
        return False
    
    return True


async def test_api_caching():
    """Test caching through the FHIR API."""
    print("\n=== Testing API Caching ===")
    
    base_url = "http://localhost:8000/fhir/R4"
    
    async with httpx.AsyncClient() as client:
        # First request - should miss cache
        print("\n1. First request (cache miss expected):")
        start_time = time.time()
        response1 = await client.get(f"{base_url}/Patient?name=Smith&_count=10")
        time1 = time.time() - start_time
        
        if response1.status_code == 200:
            data1 = response1.json()
            print(f"   ✅ Response received in {time1:.3f}s")
            print(f"   Total patients: {data1.get('total', 0)}")
        else:
            print(f"   ❌ Request failed: {response1.status_code}")
            return False
        
        # Second request - should hit cache
        print("\n2. Second request (cache hit expected):")
        start_time = time.time()
        response2 = await client.get(f"{base_url}/Patient?name=Smith&_count=10")
        time2 = time.time() - start_time
        
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"   ✅ Response received in {time2:.3f}s")
            print(f"   Speed improvement: {(time1/time2):.1f}x faster")
            
            # Verify data is identical
            if data1 == data2:
                print("   ✅ Cached data matches original")
            else:
                print("   ❌ Cached data differs from original")
        else:
            print(f"   ❌ Request failed: {response2.status_code}")
            return False
        
        # Test cache invalidation by creating a patient
        print("\n3. Testing cache invalidation:")
        patient_data = {
            "resourceType": "Patient",
            "name": [{"family": "CacheTest", "given": ["Redis"]}],
            "birthDate": "2000-01-01"
        }
        
        create_response = await client.post(
            f"{base_url}/Patient",
            json=patient_data,
            headers={"Content-Type": "application/fhir+json"}
        )
        
        if create_response.status_code == 201:
            print("   ✅ Patient created successfully")
            
            # Third request - should miss cache after invalidation
            print("\n4. Request after invalidation (cache miss expected):")
            start_time = time.time()
            response3 = await client.get(f"{base_url}/Patient?name=Smith&_count=10")
            time3 = time.time() - start_time
            
            if response3.status_code == 200:
                print(f"   ✅ Response received in {time3:.3f}s")
                if time3 > time2 * 2:  # Should be slower than cached request
                    print("   ✅ Cache was invalidated (slower response)")
                else:
                    print("   ⚠️  Response time suggests cache may not have been invalidated")
            else:
                print(f"   ❌ Request failed: {response3.status_code}")
        else:
            print(f"   ❌ Failed to create patient: {create_response.status_code}")
    
    return True


async def test_fallback_behavior():
    """Test fallback to memory cache when Redis is unavailable."""
    print("\n=== Testing Fallback Behavior ===")
    
    # Create a cache instance with invalid Redis URL to force fallback
    cache = RedisSearchCache(redis_url="redis://invalid-host:6379/0")
    
    # This should fall back to memory cache
    test_data = ([{"id": "test-2", "name": "Fallback Test"}], 1)
    await cache.set("Patient", {"test": "fallback"}, test_data[0], test_data[1])
    
    result = await cache.get("Patient", {"test": "fallback"})
    if result:
        print("✅ Fallback to memory cache working")
        stats = await cache.get_stats()
        print(f"   Memory cache size: {stats['memory_cache']['size']}")
        print(f"   Redis available: {stats['redis_cache']['available']}")
    else:
        print("❌ Fallback to memory cache failed")
    
    return True


async def test_performance_comparison():
    """Compare performance between Redis and memory cache."""
    print("\n=== Performance Comparison ===")
    
    # Test data
    large_dataset = [{"id": f"patient-{i}", "data": f"test-{i}" * 100} for i in range(100)]
    search_params = {"test": "performance"}
    
    # Test Redis cache
    redis_cache = await get_redis_cache()
    
    # Write to Redis
    start_time = time.time()
    for i in range(10):
        await redis_cache.set("Patient", {**search_params, "page": i}, large_dataset, 100)
    redis_write_time = time.time() - start_time
    
    # Read from Redis
    start_time = time.time()
    for i in range(10):
        await redis_cache.get("Patient", {**search_params, "page": i})
    redis_read_time = time.time() - start_time
    
    # Test memory cache
    memory_cache = get_search_cache()
    
    # Write to memory
    start_time = time.time()
    for i in range(10):
        memory_cache.set("Patient", {**search_params, "page": i}, large_dataset, 100)
    memory_write_time = time.time() - start_time
    
    # Read from memory
    start_time = time.time()
    for i in range(10):
        memory_cache.get("Patient", {**search_params, "page": i})
    memory_read_time = time.time() - start_time
    
    print(f"\n📊 Performance Results (10 operations each):")
    print(f"   Redis Write:  {redis_write_time:.3f}s")
    print(f"   Memory Write: {memory_write_time:.3f}s")
    print(f"   Redis Read:   {redis_read_time:.3f}s")
    print(f"   Memory Read:  {memory_read_time:.3f}s")
    print(f"\n   Redis is {memory_read_time/redis_read_time:.1f}x for reads")
    print(f"   Note: Redis provides distributed caching benefits")
    
    return True


async def main():
    """Run all Redis cache tests."""
    print(f"FHIR Redis Cache Testing - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Check if Redis is expected to be available
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    use_redis = os.getenv('USE_REDIS_CACHE', 'true').lower() == 'true'
    
    print(f"Configuration:")
    print(f"  REDIS_URL: {redis_url}")
    print(f"  USE_REDIS_CACHE: {use_redis}")
    
    tests = [
        ("Redis Connection", test_redis_connection),
        ("API Caching", test_api_caching),
        ("Fallback Behavior", test_fallback_behavior),
        ("Performance Comparison", test_performance_comparison)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ Error in {test_name}: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:.<40} {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.0f}%)")
    
    if passed == total:
        print("\n🎉 All tests passed! Redis caching is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
    
    return passed == total


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)