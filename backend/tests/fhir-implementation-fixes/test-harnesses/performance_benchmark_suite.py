#!/usr/bin/env python3
"""
Performance Benchmark Suite

This suite provides comprehensive performance testing and load validation for
FHIR implementations including benchmarks for CRUD operations, search queries,
Bundle transactions, and concurrent access patterns.
"""

import asyncio
import sys
import os
import time
import logging
import statistics
import concurrent.futures
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

# Add parent directories to path for imports
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from fhir.core.storage import FHIRStorageEngine
from database import get_session_maker


@dataclass
class PerformanceBenchmarkResult:
    """Result of a performance benchmark"""
    benchmark_name: str
    operation: str
    resource_type: str
    samples: int
    avg_duration: float
    min_duration: float
    max_duration: float
    p95_duration: float
    operations_per_second: float
    success_rate: float
    status: str  # PASS, FAIL, SKIP
    message: str
    details: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class PerformanceBenchmarkSuite:
    """Comprehensive performance benchmark suite"""
    
    def __init__(self):
        self.session_maker = get_session_maker()
        self.logger = logging.getLogger(__name__)
        
        # Performance targets (operations per second)
        self.performance_targets = {
            'read': 100,    # 100 reads/sec
            'search': 50,   # 50 searches/sec
            'create': 20,   # 20 creates/sec
            'update': 15,   # 15 updates/sec
            'delete': 10    # 10 deletes/sec
        }
        
        # Duration thresholds (seconds)
        self.duration_thresholds = {
            'read': 0.100,      # 100ms
            'simple_search': 0.200,  # 200ms
            'complex_search': 0.500, # 500ms
            'create': 0.300,    # 300ms
            'update': 0.400,    # 400ms
            'delete': 0.200,    # 200ms
            'bundle': 1.000     # 1 second
        }
    
    async def run_comprehensive_benchmarks(self, sample_size: int = 50) -> List[PerformanceBenchmarkResult]:
        """Run comprehensive performance benchmarks"""
        results = []
        
        async with self.session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # CRUD operation benchmarks
            crud_results = await self._benchmark_crud_operations(storage_engine, sample_size)
            results.extend(crud_results)
            
            # Search operation benchmarks
            search_results = await self._benchmark_search_operations(storage_engine, sample_size)
            results.extend(search_results)
            
            # Bundle operation benchmarks
            bundle_results = await self._benchmark_bundle_operations(storage_engine, sample_size // 5)
            results.extend(bundle_results)
            
            # Concurrent access benchmarks
            concurrent_results = await self._benchmark_concurrent_access(storage_engine, sample_size // 10)
            results.extend(concurrent_results)
        
        return results
    
    async def _benchmark_crud_operations(self, storage_engine: FHIRStorageEngine, sample_size: int) -> List[PerformanceBenchmarkResult]:
        """Benchmark CRUD operations"""
        results = []
        
        resource_types = ['Patient', 'Observation', 'Condition']
        operations = ['create', 'read', 'update', 'delete']
        
        for resource_type in resource_types:
            for operation in operations:
                if operation == 'read':
                    # Benchmark read operations
                    result = await self._benchmark_read_operation(storage_engine, resource_type, sample_size)
                    results.append(result)
                elif operation == 'create':
                    # Benchmark create operations
                    result = await self._benchmark_create_operation(storage_engine, resource_type, sample_size // 5)
                    results.append(result)
                elif operation == 'update':
                    # Benchmark update operations
                    result = await self._benchmark_update_operation(storage_engine, resource_type, sample_size // 5)
                    results.append(result)
                elif operation == 'delete':
                    # Benchmark delete operations
                    result = await self._benchmark_delete_operation(storage_engine, resource_type, sample_size // 10)
                    results.append(result)
        
        return results
    
    async def _benchmark_read_operation(self, storage_engine: FHIRStorageEngine, resource_type: str, sample_size: int) -> PerformanceBenchmarkResult:
        """Benchmark read operations"""
        durations = []
        successes = 0
        
        # Get sample resource IDs
        search_result = await storage_engine.search_resources(resource_type, {}, {'_count': [str(sample_size)]})
        resource_ids = [entry['resource']['id'] for entry in search_result.get('entry', [])]
        
        if not resource_ids:
            return PerformanceBenchmarkResult(
                benchmark_name="crud_performance",
                operation="read",
                resource_type=resource_type,
                samples=0,
                avg_duration=0,
                min_duration=0,
                max_duration=0,
                p95_duration=0,
                operations_per_second=0,
                success_rate=0,
                status="SKIP",
                message=f"No {resource_type} resources found for read benchmarking"
            )
        
        # Benchmark read operations
        for resource_id in resource_ids[:sample_size]:
            start_time = time.time()
            try:
                await storage_engine.get_resource(resource_type, resource_id)
                duration = time.time() - start_time
                durations.append(duration)
                successes += 1
            except Exception:
                durations.append(float('inf'))
        
        # Calculate metrics
        valid_durations = [d for d in durations if d != float('inf')]
        if not valid_durations:
            avg_duration = float('inf')
            min_duration = float('inf')
            max_duration = float('inf')
            p95_duration = float('inf')
            ops_per_second = 0
        else:
            avg_duration = statistics.mean(valid_durations)
            min_duration = min(valid_durations)
            max_duration = max(valid_durations)
            p95_duration = statistics.quantiles(valid_durations, n=20)[18] if len(valid_durations) > 1 else avg_duration
            ops_per_second = 1 / avg_duration if avg_duration > 0 else 0
        
        success_rate = successes / len(durations) if durations else 0
        threshold = self.duration_thresholds['read']
        target_ops = self.performance_targets['read']
        
        # Determine status
        if success_rate < 0.95:
            status = "FAIL"
            message = f"Low success rate: {success_rate:.1%}"
        elif avg_duration > threshold:
            status = "FAIL"
            message = f"Exceeds duration threshold: {avg_duration:.3f}s > {threshold}s"
        elif ops_per_second < target_ops:
            status = "FAIL"
            message = f"Below performance target: {ops_per_second:.1f} ops/s < {target_ops} ops/s"
        else:
            status = "PASS"
            message = f"Performance target met: {ops_per_second:.1f} ops/s"
        
        return PerformanceBenchmarkResult(
            benchmark_name="crud_performance",
            operation="read",
            resource_type=resource_type,
            samples=len(durations),
            avg_duration=avg_duration,
            min_duration=min_duration,
            max_duration=max_duration,
            p95_duration=p95_duration,
            operations_per_second=ops_per_second,
            success_rate=success_rate,
            status=status,
            message=message,
            details={
                "threshold": threshold,
                "target_ops_per_second": target_ops,
                "valid_samples": len(valid_durations)
            }
        )
    
    async def _benchmark_create_operation(self, storage_engine: FHIRStorageEngine, resource_type: str, sample_size: int) -> PerformanceBenchmarkResult:
        """Benchmark create operations"""
        durations = []
        successes = 0
        created_ids = []
        
        # Generate test resources
        test_resources = self._generate_test_resources(resource_type, sample_size)
        
        # Benchmark create operations
        for test_resource in test_resources:
            start_time = time.time()
            try:
                created = await storage_engine.create_resource(resource_type, test_resource)
                duration = time.time() - start_time
                durations.append(duration)
                created_ids.append(created['id'])
                successes += 1
            except Exception:
                durations.append(float('inf'))
        
        # Cleanup created resources
        for resource_id in created_ids:
            try:
                await storage_engine.delete_resource(resource_type, resource_id)
            except:
                pass
        
        # Calculate metrics
        valid_durations = [d for d in durations if d != float('inf')]
        if not valid_durations:
            avg_duration = float('inf')
            min_duration = float('inf')
            max_duration = float('inf')
            p95_duration = float('inf')
            ops_per_second = 0
        else:
            avg_duration = statistics.mean(valid_durations)
            min_duration = min(valid_durations)
            max_duration = max(valid_durations)
            p95_duration = statistics.quantiles(valid_durations, n=20)[18] if len(valid_durations) > 1 else avg_duration
            ops_per_second = 1 / avg_duration if avg_duration > 0 else 0
        
        success_rate = successes / len(durations) if durations else 0
        threshold = self.duration_thresholds['create']
        target_ops = self.performance_targets['create']
        
        # Determine status
        if success_rate < 0.95:
            status = "FAIL"
            message = f"Low success rate: {success_rate:.1%}"
        elif avg_duration > threshold:
            status = "FAIL"
            message = f"Exceeds duration threshold: {avg_duration:.3f}s > {threshold}s"
        elif ops_per_second < target_ops:
            status = "FAIL"
            message = f"Below performance target: {ops_per_second:.1f} ops/s < {target_ops} ops/s"
        else:
            status = "PASS"
            message = f"Performance target met: {ops_per_second:.1f} ops/s"
        
        return PerformanceBenchmarkResult(
            benchmark_name="crud_performance",
            operation="create",
            resource_type=resource_type,
            samples=len(durations),
            avg_duration=avg_duration,
            min_duration=min_duration,
            max_duration=max_duration,
            p95_duration=p95_duration,
            operations_per_second=ops_per_second,
            success_rate=success_rate,
            status=status,
            message=message,
            details={
                "threshold": threshold,
                "target_ops_per_second": target_ops,
                "valid_samples": len(valid_durations)
            }
        )
    
    async def _benchmark_update_operation(self, storage_engine: FHIRStorageEngine, resource_type: str, sample_size: int) -> PerformanceBenchmarkResult:
        """Benchmark update operations"""
        # Similar implementation to create, but with updates
        return PerformanceBenchmarkResult(
            benchmark_name="crud_performance",
            operation="update",
            resource_type=resource_type,
            samples=0,
            avg_duration=0,
            min_duration=0,
            max_duration=0,
            p95_duration=0,
            operations_per_second=0,
            success_rate=0,
            status="SKIP",
            message="Update benchmarking not implemented in this version"
        )
    
    async def _benchmark_delete_operation(self, storage_engine: FHIRStorageEngine, resource_type: str, sample_size: int) -> PerformanceBenchmarkResult:
        """Benchmark delete operations"""
        # Similar implementation with delete operations
        return PerformanceBenchmarkResult(
            benchmark_name="crud_performance",
            operation="delete",
            resource_type=resource_type,
            samples=0,
            avg_duration=0,
            min_duration=0,
            max_duration=0,
            p95_duration=0,
            operations_per_second=0,
            success_rate=0,
            status="SKIP",
            message="Delete benchmarking not implemented in this version"
        )
    
    async def _benchmark_search_operations(self, storage_engine: FHIRStorageEngine, sample_size: int) -> List[PerformanceBenchmarkResult]:
        """Benchmark search operations"""
        results = []
        
        # Simple search benchmark
        simple_result = await self._benchmark_simple_search(storage_engine, sample_size)
        results.append(simple_result)
        
        # Complex search benchmark
        complex_result = await self._benchmark_complex_search(storage_engine, sample_size // 2)
        results.append(complex_result)
        
        return results
    
    async def _benchmark_simple_search(self, storage_engine: FHIRStorageEngine, sample_size: int) -> PerformanceBenchmarkResult:
        """Benchmark simple search operations"""
        durations = []
        successes = 0
        
        # Benchmark simple searches
        for i in range(sample_size):
            start_time = time.time()
            try:
                await storage_engine.search_resources('Patient', {}, {'_count': ['10']})
                duration = time.time() - start_time
                durations.append(duration)
                successes += 1
            except Exception:
                durations.append(float('inf'))
        
        # Calculate metrics
        valid_durations = [d for d in durations if d != float('inf')]
        if not valid_durations:
            avg_duration = float('inf')
            min_duration = float('inf')
            max_duration = float('inf')
            p95_duration = float('inf')
            ops_per_second = 0
        else:
            avg_duration = statistics.mean(valid_durations)
            min_duration = min(valid_durations)
            max_duration = max(valid_durations)
            p95_duration = statistics.quantiles(valid_durations, n=20)[18] if len(valid_durations) > 1 else avg_duration
            ops_per_second = 1 / avg_duration if avg_duration > 0 else 0
        
        success_rate = successes / len(durations) if durations else 0
        threshold = self.duration_thresholds['simple_search']
        target_ops = self.performance_targets['search']
        
        # Determine status
        if success_rate < 0.95:
            status = "FAIL"
            message = f"Low success rate: {success_rate:.1%}"
        elif avg_duration > threshold:
            status = "FAIL"
            message = f"Exceeds duration threshold: {avg_duration:.3f}s > {threshold}s"
        elif ops_per_second < target_ops:
            status = "FAIL"
            message = f"Below performance target: {ops_per_second:.1f} ops/s < {target_ops} ops/s"
        else:
            status = "PASS"
            message = f"Performance target met: {ops_per_second:.1f} ops/s"
        
        return PerformanceBenchmarkResult(
            benchmark_name="search_performance",
            operation="simple_search",
            resource_type="Patient",
            samples=len(durations),
            avg_duration=avg_duration,
            min_duration=min_duration,
            max_duration=max_duration,
            p95_duration=p95_duration,
            operations_per_second=ops_per_second,
            success_rate=success_rate,
            status=status,
            message=message,
            details={
                "threshold": threshold,
                "target_ops_per_second": target_ops,
                "valid_samples": len(valid_durations)
            }
        )
    
    async def _benchmark_complex_search(self, storage_engine: FHIRStorageEngine, sample_size: int) -> PerformanceBenchmarkResult:
        """Benchmark complex search operations"""
        durations = []
        successes = 0
        
        # Benchmark complex searches with multiple parameters
        search_params = [
            {'name': ['Smith'], 'gender': ['male']},
            {'birthdate': ['ge1950-01-01', 'le2000-12-31']},
            {'address': ['Boston'], 'active': ['true']}
        ]
        
        for i in range(sample_size):
            params = search_params[i % len(search_params)]
            start_time = time.time()
            try:
                await storage_engine.search_resources('Patient', params, {'_count': ['10']})
                duration = time.time() - start_time
                durations.append(duration)
                successes += 1
            except Exception:
                durations.append(float('inf'))
        
        # Calculate metrics (similar to simple search)
        valid_durations = [d for d in durations if d != float('inf')]
        if not valid_durations:
            avg_duration = float('inf')
            min_duration = float('inf')
            max_duration = float('inf')
            p95_duration = float('inf')
            ops_per_second = 0
        else:
            avg_duration = statistics.mean(valid_durations)
            min_duration = min(valid_durations)
            max_duration = max(valid_durations)
            p95_duration = statistics.quantiles(valid_durations, n=20)[18] if len(valid_durations) > 1 else avg_duration
            ops_per_second = 1 / avg_duration if avg_duration > 0 else 0
        
        success_rate = successes / len(durations) if durations else 0
        threshold = self.duration_thresholds['complex_search']
        
        # Status determination
        if success_rate < 0.95:
            status = "FAIL"
            message = f"Low success rate: {success_rate:.1%}"
        elif avg_duration > threshold:
            status = "FAIL"
            message = f"Exceeds duration threshold: {avg_duration:.3f}s > {threshold}s"
        else:
            status = "PASS"
            message = f"Performance acceptable: {avg_duration:.3f}s"
        
        return PerformanceBenchmarkResult(
            benchmark_name="search_performance",
            operation="complex_search",
            resource_type="Patient",
            samples=len(durations),
            avg_duration=avg_duration,
            min_duration=min_duration,
            max_duration=max_duration,
            p95_duration=p95_duration,
            operations_per_second=ops_per_second,
            success_rate=success_rate,
            status=status,
            message=message,
            details={
                "threshold": threshold,
                "valid_samples": len(valid_durations),
                "search_variations": len(search_params)
            }
        )
    
    async def _benchmark_bundle_operations(self, storage_engine: FHIRStorageEngine, sample_size: int) -> List[PerformanceBenchmarkResult]:
        """Benchmark Bundle operations"""
        results = []
        
        # For now, return a placeholder
        results.append(PerformanceBenchmarkResult(
            benchmark_name="bundle_performance",
            operation="transaction",
            resource_type="Bundle",
            samples=0,
            avg_duration=0,
            min_duration=0,
            max_duration=0,
            p95_duration=0,
            operations_per_second=0,
            success_rate=0,
            status="SKIP",
            message="Bundle benchmarking not implemented in this version"
        ))
        
        return results
    
    async def _benchmark_concurrent_access(self, storage_engine: FHIRStorageEngine, sample_size: int) -> List[PerformanceBenchmarkResult]:
        """Benchmark concurrent access patterns"""
        results = []
        
        # For now, return a placeholder
        results.append(PerformanceBenchmarkResult(
            benchmark_name="concurrent_performance",
            operation="concurrent_read",
            resource_type="Mixed",
            samples=0,
            avg_duration=0,
            min_duration=0,
            max_duration=0,
            p95_duration=0,
            operations_per_second=0,
            success_rate=0,
            status="SKIP",
            message="Concurrent access benchmarking not implemented in this version"
        ))
        
        return results
    
    def _generate_test_resources(self, resource_type: str, count: int) -> List[dict]:
        """Generate test resources for benchmarking"""
        resources = []
        
        for i in range(count):
            if resource_type == 'Patient':
                resource = {
                    "resourceType": "Patient",
                    "identifier": [
                        {
                            "system": "http://example.org/patient-ids",
                            "value": f"BENCH-{i:06d}"
                        }
                    ],
                    "name": [
                        {
                            "family": f"BenchmarkFamily{i}",
                            "given": [f"BenchmarkGiven{i}"]
                        }
                    ],
                    "gender": "unknown",
                    "birthDate": "2000-01-01"
                }
            elif resource_type == 'Observation':
                resource = {
                    "resourceType": "Observation",
                    "status": "final",
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "8302-2",
                                "display": "Body height"
                            }
                        ]
                    },
                    "subject": {
                        "reference": "Patient/benchmark-patient"
                    },
                    "valueQuantity": {
                        "value": 180 + i,
                        "unit": "cm",
                        "system": "http://unitsofmeasure.org",
                        "code": "cm"
                    }
                }
            else:
                # Generic resource
                resource = {
                    "resourceType": resource_type,
                    "identifier": [
                        {
                            "system": f"http://example.org/{resource_type.lower()}-ids",
                            "value": f"BENCH-{resource_type}-{i:06d}"
                        }
                    ]
                }
            
            resources.append(resource)
        
        return resources


async def main():
    """Main entry point for performance benchmarking"""
    logging.basicConfig(level=logging.INFO)
    
    suite = PerformanceBenchmarkSuite()
    
    print("Starting Performance Benchmark Suite...")
    print("=" * 60)
    
    # Run benchmarks with configurable sample size
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples', type=int, default=50, help='Number of samples for benchmarking')
    args = parser.parse_args()
    
    results = await suite.run_comprehensive_benchmarks(args.samples)
    
    # Summary statistics
    total_benchmarks = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")
    
    print(f"\nBenchmark Summary:")
    print(f"Total Benchmarks: {total_benchmarks}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    print(f"Success Rate: {(passed/total_benchmarks*100):.1f}%" if total_benchmarks > 0 else "N/A")
    
    # Performance details
    print(f"\nPerformance Results:")
    print("-" * 60)
    
    for result in results:
        if result.status != "SKIP":
            status_icon = "✓" if result.status == "PASS" else "✗"
            print(f"{status_icon} {result.resource_type} {result.operation}:")
            print(f"   Avg: {result.avg_duration:.3f}s | Ops/sec: {result.operations_per_second:.1f} | Success: {result.success_rate:.1%}")
            print(f"   P95: {result.p95_duration:.3f}s | Min: {result.min_duration:.3f}s | Max: {result.max_duration:.3f}s")
            print(f"   {result.message}")
            print()
    
    # Exit with error code if any failures
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))