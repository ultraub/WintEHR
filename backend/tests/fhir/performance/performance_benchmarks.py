#!/usr/bin/env python3
"""
Performance Benchmark Tests for FHIR API

Measures response times, throughput, and resource utilization for various
FHIR operations under different load conditions.
"""

import pytest
import asyncio
import aiohttp
import time
import statistics
from typing import Dict, List, Any, Tuple
from datetime import datetime
import json
import random
from concurrent.futures import ThreadPoolExecutor
import psutil
import os

# Test configuration
BASE_URL = "http://localhost:8000/fhir/R4"
BENCHMARK_RESULTS = []


class PerformanceBenchmark:
    """Base class for performance benchmarks"""
    
    def __init__(self, name: str):
        self.name = name
        self.results = []
    
    async def measure_request(self, session: aiohttp.ClientSession, method: str, url: str, **kwargs) -> Tuple[float, int, Any]:
        """Measure a single request's performance"""
        start_time = time.perf_counter()
        
        async with session.request(method, url, **kwargs) as response:
            status = response.status
            data = await response.json() if response.status == 200 else None
            
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000
        
        return duration_ms, status, data
    
    def calculate_stats(self, durations: List[float]) -> Dict[str, float]:
        """Calculate performance statistics"""
        if not durations:
            return {}
        
        sorted_durations = sorted(durations)
        return {
            'count': len(durations),
            'mean': statistics.mean(durations),
            'median': statistics.median(durations),
            'min': min(durations),
            'max': max(durations),
            'p95': sorted_durations[int(len(sorted_durations) * 0.95)] if len(sorted_durations) > 1 else sorted_durations[0],
            'p99': sorted_durations[int(len(sorted_durations) * 0.99)] if len(sorted_durations) > 1 else sorted_durations[0],
            'stdev': statistics.stdev(durations) if len(durations) > 1 else 0
        }
    
    def report_results(self):
        """Generate performance report"""
        print(f"\n{'=' * 70}")
        print(f"Benchmark: {self.name}")
        print(f"{'=' * 70}")
        
        for result in self.results:
            print(f"\n{result['operation']}:")
            print(f"  Requests: {result['stats']['count']}")
            print(f"  Mean: {result['stats']['mean']:.2f}ms")
            print(f"  Median: {result['stats']['median']:.2f}ms")
            print(f"  Min: {result['stats']['min']:.2f}ms")
            print(f"  Max: {result['stats']['max']:.2f}ms")
            print(f"  95th percentile: {result['stats']['p95']:.2f}ms")
            print(f"  99th percentile: {result['stats']['p99']:.2f}ms")
            if result.get('throughput'):
                print(f"  Throughput: {result['throughput']:.2f} req/s")


class SingleResourceBenchmark(PerformanceBenchmark):
    """Benchmark single resource operations"""
    
    async def run(self, num_requests: int = 100):
        """Run single resource benchmarks"""
        # Get a list of patient IDs for testing
        async with aiohttp.ClientSession() as session:
            # First, get some patient IDs
            search_url = f"{BASE_URL}/Patient?_count=10"
            _, _, bundle = await self.measure_request(session, 'GET', search_url)
            
            if not bundle or not bundle.get('entry'):
                print("No patients found for benchmarking")
                return
            
            patient_ids = [entry['resource']['id'] for entry in bundle['entry']]
            
            # Benchmark 1: Single resource read
            durations = []
            print(f"\nRunning {num_requests} single resource reads...")
            
            for i in range(num_requests):
                patient_id = random.choice(patient_ids)
                url = f"{BASE_URL}/Patient/{patient_id}"
                duration, status, _ = await self.measure_request(session, 'GET', url)
                if status == 200:
                    durations.append(duration)
                
                if (i + 1) % 10 == 0:
                    print(f"  Progress: {i + 1}/{num_requests}")
            
            self.results.append({
                'operation': 'Single Resource Read (Patient)',
                'stats': self.calculate_stats(durations)
            })
            
            # Benchmark 2: Resource with includes
            durations = []
            print(f"\nRunning {num_requests // 2} resource reads with _include...")
            
            for i in range(num_requests // 2):
                patient_id = random.choice(patient_ids)
                url = f"{BASE_URL}/Encounter?patient=Patient/{patient_id}&_include=Encounter:patient&_count=10"
                duration, status, _ = await self.measure_request(session, 'GET', url)
                if status == 200:
                    durations.append(duration)
            
            self.results.append({
                'operation': 'Resource Read with _include',
                'stats': self.calculate_stats(durations)
            })


class SearchBenchmark(PerformanceBenchmark):
    """Benchmark search operations"""
    
    async def run(self, num_requests: int = 50):
        """Run search benchmarks"""
        async with aiohttp.ClientSession() as session:
            # Benchmark 1: Simple search
            durations = []
            print(f"\nRunning {num_requests} simple searches...")
            
            search_params = [
                {'gender': 'male'},
                {'gender': 'female'},
                {'birthdate': 'gt1990-01-01'},
                {'birthdate': 'lt2000-01-01'},
                {'_count': '10'},
                {'_count': '50'}
            ]
            
            for i in range(num_requests):
                params = random.choice(search_params)
                url = f"{BASE_URL}/Patient"
                duration, status, _ = await self.measure_request(session, 'GET', url, params=params)
                if status == 200:
                    durations.append(duration)
            
            self.results.append({
                'operation': 'Simple Search (Patient)',
                'stats': self.calculate_stats(durations)
            })
            
            # Benchmark 2: Complex search with multiple parameters
            durations = []
            print(f"\nRunning {num_requests} complex searches...")
            
            for i in range(num_requests):
                # Complex search with multiple conditions
                params = {
                    'patient': f'Patient/{random.randint(1, 1000)}',
                    'status': 'active',
                    '_sort': '-onset-date',
                    '_count': '20'
                }
                url = f"{BASE_URL}/Condition"
                duration, status, _ = await self.measure_request(session, 'GET', url, params=params)
                if status == 200:
                    durations.append(duration)
            
            self.results.append({
                'operation': 'Complex Search (Condition)',
                'stats': self.calculate_stats(durations)
            })
            
            # Benchmark 3: Search with chaining
            durations = []
            print(f"\nRunning {num_requests // 2} chained searches...")
            
            for i in range(num_requests // 2):
                # Chained search
                params = {
                    'subject:Patient.name': 'Smith',
                    '_count': '10'
                }
                url = f"{BASE_URL}/Observation"
                duration, status, _ = await self.measure_request(session, 'GET', url, params=params)
                if status in [200, 400]:  # 400 if chaining not supported
                    durations.append(duration)
            
            if durations:
                self.results.append({
                    'operation': 'Chained Search',
                    'stats': self.calculate_stats(durations)
                })


class BundleOperationBenchmark(PerformanceBenchmark):
    """Benchmark bundle and batch operations"""
    
    async def run(self, num_requests: int = 20):
        """Run bundle operation benchmarks"""
        async with aiohttp.ClientSession() as session:
            # Benchmark 1: $everything operation
            durations = []
            print(f"\nRunning {num_requests} $everything operations...")
            
            # Get some patient IDs
            search_url = f"{BASE_URL}/Patient?_count=10"
            _, _, bundle = await self.measure_request(session, 'GET', search_url)
            
            if bundle and bundle.get('entry'):
                patient_ids = [entry['resource']['id'] for entry in bundle['entry']]
                
                for i in range(min(num_requests, len(patient_ids))):
                    patient_id = patient_ids[i % len(patient_ids)]
                    url = f"{BASE_URL}/Patient/{patient_id}/$everything?_count=100"
                    duration, status, _ = await self.measure_request(session, 'GET', url)
                    if status == 200:
                        durations.append(duration)
                
                self.results.append({
                    'operation': '$everything Operation',
                    'stats': self.calculate_stats(durations)
                })
            
            # Benchmark 2: Batch bundle
            durations = []
            print(f"\nRunning {num_requests // 2} batch bundle operations...")
            
            for i in range(num_requests // 2):
                # Create a batch bundle with multiple requests
                batch_bundle = {
                    "resourceType": "Bundle",
                    "type": "batch",
                    "entry": [
                        {
                            "request": {
                                "method": "GET",
                                "url": "Patient?_count=5"
                            }
                        },
                        {
                            "request": {
                                "method": "GET",
                                "url": "Observation?_count=5"
                            }
                        },
                        {
                            "request": {
                                "method": "GET",
                                "url": "Condition?_count=5"
                            }
                        }
                    ]
                }
                
                url = f"{BASE_URL}/"
                duration, status, _ = await self.measure_request(
                    session, 'POST', url,
                    json=batch_bundle,
                    headers={'Content-Type': 'application/fhir+json'}
                )
                if status in [200, 201]:
                    durations.append(duration)
            
            if durations:
                self.results.append({
                    'operation': 'Batch Bundle',
                    'stats': self.calculate_stats(durations)
                })


class ConcurrentLoadBenchmark(PerformanceBenchmark):
    """Benchmark concurrent load handling"""
    
    async def run(self, concurrent_users: int = 10, requests_per_user: int = 10):
        """Run concurrent load benchmarks"""
        print(f"\nRunning concurrent load test with {concurrent_users} users...")
        
        async def user_session(user_id: int) -> List[float]:
            """Simulate a single user session"""
            durations = []
            async with aiohttp.ClientSession() as session:
                for i in range(requests_per_user):
                    # Mix of operations
                    operation = random.choice(['read', 'search', 'complex_search'])
                    
                    if operation == 'read':
                        url = f"{BASE_URL}/Patient/{random.randint(1, 100)}"
                        duration, _, _ = await self.measure_request(session, 'GET', url)
                    elif operation == 'search':
                        url = f"{BASE_URL}/Patient?_count=10"
                        duration, _, _ = await self.measure_request(session, 'GET', url)
                    else:
                        url = f"{BASE_URL}/Observation?patient=Patient/{random.randint(1, 100)}&_count=20"
                        duration, _, _ = await self.measure_request(session, 'GET', url)
                    
                    durations.append(duration)
            
            return durations
        
        # Run concurrent user sessions
        start_time = time.perf_counter()
        
        tasks = [user_session(i) for i in range(concurrent_users)]
        all_durations = await asyncio.gather(*tasks)
        
        end_time = time.perf_counter()
        total_time = end_time - start_time
        
        # Flatten all durations
        all_request_durations = [d for user_durations in all_durations for d in user_durations]
        
        total_requests = len(all_request_durations)
        throughput = total_requests / total_time if total_time > 0 else 0
        
        result = {
            'operation': f'Concurrent Load ({concurrent_users} users)',
            'stats': self.calculate_stats(all_request_durations),
            'throughput': throughput,
            'total_time': total_time,
            'total_requests': total_requests
        }
        
        self.results.append(result)
        
        print(f"  Total requests: {total_requests}")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Throughput: {throughput:.2f} req/s")


class ResourceUtilizationBenchmark(PerformanceBenchmark):
    """Monitor resource utilization during load"""
    
    async def run(self, duration_seconds: int = 30):
        """Run resource utilization monitoring"""
        print(f"\nMonitoring resource utilization for {duration_seconds} seconds...")
        
        # Get process info
        process = psutil.Process(os.getpid())
        
        cpu_samples = []
        memory_samples = []
        
        async def monitor_resources():
            """Monitor CPU and memory usage"""
            for _ in range(duration_seconds):
                cpu_percent = process.cpu_percent(interval=1)
                memory_info = process.memory_info()
                memory_mb = memory_info.rss / 1024 / 1024
                
                cpu_samples.append(cpu_percent)
                memory_samples.append(memory_mb)
                
                await asyncio.sleep(1)
        
        async def generate_load():
            """Generate load during monitoring"""
            async with aiohttp.ClientSession() as session:
                for _ in range(duration_seconds * 5):  # 5 requests per second
                    url = f"{BASE_URL}/Patient?_count=20"
                    await self.measure_request(session, 'GET', url)
                    await asyncio.sleep(0.2)  # 5 req/s
        
        # Run monitoring and load generation concurrently
        await asyncio.gather(monitor_resources(), generate_load())
        
        # Calculate statistics
        cpu_stats = self.calculate_stats(cpu_samples)
        memory_stats = self.calculate_stats(memory_samples)
        
        print(f"\nCPU Usage:")
        print(f"  Mean: {cpu_stats['mean']:.1f}%")
        print(f"  Max: {cpu_stats['max']:.1f}%")
        
        print(f"\nMemory Usage:")
        print(f"  Mean: {memory_stats['mean']:.1f} MB")
        print(f"  Max: {memory_stats['max']:.1f} MB")
        
        self.results.append({
            'operation': 'Resource Utilization',
            'cpu_stats': cpu_stats,
            'memory_stats': memory_stats
        })


async def run_all_benchmarks():
    """Run all performance benchmarks"""
    print("=" * 70)
    print("FHIR API Performance Benchmarks")
    print("=" * 70)
    print(f"Start time: {datetime.now().isoformat()}")
    print(f"Base URL: {BASE_URL}")
    
    benchmarks = [
        SingleResourceBenchmark("Single Resource Operations"),
        SearchBenchmark("Search Operations"),
        BundleOperationBenchmark("Bundle Operations"),
        ConcurrentLoadBenchmark("Concurrent Load"),
        ResourceUtilizationBenchmark("Resource Utilization")
    ]
    
    all_results = []
    
    try:
        for benchmark in benchmarks:
            print(f"\n{'*' * 70}")
            print(f"Starting: {benchmark.name}")
            print(f"{'*' * 70}")
            
            if isinstance(benchmark, ConcurrentLoadBenchmark):
                await benchmark.run(concurrent_users=5, requests_per_user=10)
            elif isinstance(benchmark, ResourceUtilizationBenchmark):
                await benchmark.run(duration_seconds=10)
            else:
                await benchmark.run(num_requests=50)
            
            benchmark.report_results()
            all_results.extend(benchmark.results)
    
    except Exception as e:
        print(f"\n❌ Benchmark failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary report
    print("\n" + "=" * 70)
    print("PERFORMANCE SUMMARY")
    print("=" * 70)
    
    for result in all_results:
        if 'stats' in result and 'mean' in result['stats']:
            print(f"{result['operation']}: {result['stats']['mean']:.2f}ms (median: {result['stats']['median']:.2f}ms)")
    
    # Performance thresholds check
    print("\n" + "=" * 70)
    print("PERFORMANCE ASSESSMENT")
    print("=" * 70)
    
    passed = True
    for result in all_results:
        if 'stats' in result and 'p95' in result['stats']:
            operation = result['operation']
            p95 = result['stats']['p95']
            
            # Define thresholds
            thresholds = {
                'Single Resource Read (Patient)': 100,  # ms
                'Simple Search (Patient)': 200,
                'Complex Search (Condition)': 500,
                '$everything Operation': 2000
            }
            
            threshold = thresholds.get(operation, 1000)
            
            if p95 > threshold:
                print(f"⚠️  {operation}: p95={p95:.2f}ms exceeds threshold of {threshold}ms")
                passed = False
            else:
                print(f"✅ {operation}: p95={p95:.2f}ms within threshold of {threshold}ms")
    
    if passed:
        print("\n✅ All performance benchmarks passed!")
    else:
        print("\n⚠️  Some performance thresholds exceeded")
    
    print(f"\nEnd time: {datetime.now().isoformat()}")


if __name__ == "__main__":
    asyncio.run(run_all_benchmarks())