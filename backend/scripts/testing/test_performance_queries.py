#!/usr/bin/env python3
"""
Performance test for complex FHIR queries with actual data volumes.
Measures query execution times and identifies optimization opportunities.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import httpx
import time
from datetime import datetime, timedelta
import statistics

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class PerformanceQueryTester:
    """Tests FHIR query performance with real data."""
    
    def __init__(self):
        self.api_base = "http://localhost:8000/fhir/R4"
        self.results = []
        self.performance_targets = {
            'simple': 0.1,      # 100ms
            'moderate': 0.5,    # 500ms
            'complex': 1.0,     # 1 second
            'heavy': 2.0        # 2 seconds
        }
    
    async def run_all_tests(self):
        """Run all performance tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("⚡ FHIR Query Performance Testing\n")
                print("="*60)
                
                # Get data statistics first
                await self.analyze_data_volume()
                
                # Test different query categories
                await self.test_simple_queries()
                await self.test_moderate_queries()
                await self.test_complex_queries()
                await self.test_heavy_queries()
                await self.test_pagination_performance()
                await self.test_include_performance()
                await self.test_sort_performance()
                await self.test_concurrent_queries()
                
                # Print performance summary
                self.print_summary()
    
    async def analyze_data_volume(self):
        """Analyze current data volumes."""
        print("\n📊 Data Volume Analysis...")
        
        result = await self.db.execute(text("""
            SELECT 
                resource_type,
                COUNT(*) as count,
                pg_size_pretty(SUM(pg_column_size(resource))) as total_size,
                pg_size_pretty(AVG(pg_column_size(resource))::bigint) as avg_size
            FROM fhir.resources
            WHERE deleted = false
            GROUP BY resource_type
            ORDER BY count DESC
            LIMIT 10
        """))
        
        print("\nTop Resource Types by Count:")
        print(f"{'Resource Type':<20} {'Count':<10} {'Total Size':<12} {'Avg Size':<10}")
        print("-" * 52)
        
        total_resources = 0
        for row in result:
            print(f"{row.resource_type:<20} {row.count:<10} {row.total_size:<12} {row.avg_size:<10}")
            total_resources += row.count
        
        self.total_resources = total_resources
        print(f"\nTotal Resources: {total_resources:,}")
        
        # Get search parameter statistics
        result = await self.db.execute(text("""
            SELECT 
                COUNT(*) as total_params,
                COUNT(DISTINCT resource_id) as indexed_resources,
                pg_size_pretty(pg_total_relation_size('fhir.search_params')) as table_size
            FROM fhir.search_params
        """))
        
        row = result.fetchone()
        print(f"\nSearch Index Statistics:")
        print(f"  - Total Parameters: {row.total_params:,}")
        print(f"  - Indexed Resources: {row.indexed_resources:,}")
        print(f"  - Index Table Size: {row.table_size}")
    
    async def test_simple_queries(self):
        """Test simple, single-parameter queries."""
        print("\n🟢 Testing Simple Queries...")
        
        queries = [
            ("Patient by ID", "/Patient?_id=123"),
            ("Patient by gender", "/Patient?gender=female"),
            ("All Patients", "/Patient?_count=10"),
            ("Observation by status", "/Observation?status=final&_count=10"),
            ("Condition by patient", "/Condition?patient=Patient/123&_count=10"),
        ]
        
        for name, query in queries:
            times = await self.measure_query(query, runs=3)
            self.record_performance('simple', name, times, query)
    
    async def test_moderate_queries(self):
        """Test moderate complexity queries."""
        print("\n🟡 Testing Moderate Queries...")
        
        queries = [
            ("Multi-param Patient", "/Patient?gender=female&birthdate=ge1980-01-01&_count=20"),
            ("Date range Observation", "/Observation?date=ge2024-01-01&date=le2024-12-31&_count=50"),
            ("Active Conditions", "/Condition?clinical-status=active&_count=50"),
            ("Recent Encounters", "/Encounter?date=ge2024-01-01&_count=30"),
            ("Coded Observations", "/Observation?code=8867-4,8310-5,8302-2&_count=20"),
        ]
        
        for name, query in queries:
            times = await self.measure_query(query, runs=3)
            self.record_performance('moderate', name, times, query)
    
    async def test_complex_queries(self):
        """Test complex multi-parameter queries."""
        print("\n🟠 Testing Complex Queries...")
        
        # Get a patient with many resources
        result = await self.db.execute(text("""
            SELECT patient_id
            FROM (
                SELECT 
                    SUBSTRING(resource->'subject'->>'reference' FROM 'Patient/(.+)') as patient_id,
                    COUNT(*) as resource_count
                FROM fhir.resources
                WHERE resource_type IN ('Observation', 'Condition', 'MedicationRequest')
                AND deleted = false
                AND resource->'subject'->>'reference' LIKE 'Patient/%'
                GROUP BY patient_id
                ORDER BY resource_count DESC
                LIMIT 1
            ) t
        """))
        busy_patient = result.scalar()
        
        queries = [
            ("Patient full history", f"/Patient/{busy_patient}/$everything?_count=100"),
            ("Complex date + code", "/Observation?code=8867-4&date=ge2023-01-01&patient=Patient/123&_count=50"),
            ("Multi-resource search", "/Condition?clinical-status=active&onset-date=ge2020&_count=100"),
            ("Large result set", "/Observation?_count=500"),
            ("Multiple includes", "/MedicationRequest?_include=MedicationRequest:patient&_include=MedicationRequest:medication&_count=20"),
        ]
        
        for name, query in queries:
            times = await self.measure_query(query, runs=2)
            self.record_performance('complex', name, times, query)
    
    async def test_heavy_queries(self):
        """Test heavy queries that stress the system."""
        print("\n🔴 Testing Heavy Queries...")
        
        queries = [
            ("Max page size", "/Observation?_count=1000"),
            ("Everything operation", "/Patient/$everything?_count=500"),
            ("All resources type", "/Procedure?_count=1000"),
            ("Complex sort", "/Patient?_sort=-birthdate&_count=100"),
            ("Multiple search params", "/Observation?status=final&category=vital-signs&date=ge2020-01-01&_count=200"),
        ]
        
        for name, query in queries:
            times = await self.measure_query(query, runs=1)
            self.record_performance('heavy', name, times, query)
    
    async def test_pagination_performance(self):
        """Test pagination performance across pages."""
        print("\n📄 Testing Pagination Performance...")
        
        # Test sequential page access
        page_times = []
        
        for page in range(1, 6):
            query = f"/Observation?_count=50&_page={page}"
            times = await self.measure_query(query, runs=1)
            page_times.append(times[0])
            print(f"  Page {page}: {times[0]:.3f}s")
        
        # Check if performance degrades with higher pages
        if max(page_times) > min(page_times) * 2:
            self.record_performance('moderate', "Pagination degradation detected", 
                                  page_times, "Sequential pages 1-5")
        else:
            self.record_performance('moderate', "Pagination consistent", 
                                  page_times, "Sequential pages 1-5")
    
    async def test_include_performance(self):
        """Test _include performance impact."""
        print("\n🔗 Testing Include Performance...")
        
        # Base query without include
        base_query = "/MedicationRequest?_count=20"
        base_times = await self.measure_query(base_query, runs=2)
        
        # Same query with include
        include_query = "/MedicationRequest?_include=MedicationRequest:patient&_count=20"
        include_times = await self.measure_query(include_query, runs=2)
        
        # Calculate overhead
        base_avg = statistics.mean(base_times)
        include_avg = statistics.mean(include_times)
        overhead = ((include_avg - base_avg) / base_avg) * 100
        
        print(f"  Base query: {base_avg:.3f}s")
        print(f"  With include: {include_avg:.3f}s")
        print(f"  Include overhead: {overhead:.1f}%")
        
        self.record_performance('moderate', "Include overhead", 
                              [overhead], f"{overhead:.1f}% overhead")
    
    async def test_sort_performance(self):
        """Test _sort parameter performance."""
        print("\n🔤 Testing Sort Performance...")
        
        # Unsorted query
        unsorted_query = "/Patient?_count=50"
        unsorted_times = await self.measure_query(unsorted_query, runs=2)
        
        # Sorted queries
        sort_queries = [
            ("Sort by birthdate", "/Patient?_sort=birthdate&_count=50"),
            ("Sort by name", "/Patient?_sort=name&_count=50"),
            ("Reverse sort", "/Patient?_sort=-birthdate&_count=50"),
        ]
        
        for name, query in sort_queries:
            times = await self.measure_query(query, runs=2)
            
            # Compare to unsorted
            unsorted_avg = statistics.mean(unsorted_times)
            sorted_avg = statistics.mean(times)
            overhead = ((sorted_avg - unsorted_avg) / unsorted_avg) * 100
            
            self.record_performance('simple', f"{name} overhead", 
                                  [overhead], f"{overhead:.1f}% vs unsorted")
    
    async def test_concurrent_queries(self):
        """Test performance under concurrent load."""
        print("\n🔀 Testing Concurrent Query Performance...")
        
        queries = [
            "/Patient?_count=10",
            "/Observation?_count=20",
            "/Condition?_count=15",
            "/MedicationRequest?_count=10",
        ]
        
        # Run queries sequentially
        sequential_start = time.time()
        for query in queries:
            await self.client.get(query)
        sequential_time = time.time() - sequential_start
        
        # Run queries concurrently
        concurrent_start = time.time()
        tasks = [self.client.get(query) for query in queries]
        await asyncio.gather(*tasks)
        concurrent_time = time.time() - concurrent_start
        
        speedup = sequential_time / concurrent_time
        
        print(f"  Sequential: {sequential_time:.3f}s")
        print(f"  Concurrent: {concurrent_time:.3f}s")
        print(f"  Speedup: {speedup:.2f}x")
        
        self.record_performance('complex', "Concurrent speedup", 
                              [speedup], f"{speedup:.2f}x speedup")
    
    async def measure_query(self, query: str, runs: int = 3) -> List[float]:
        """Measure query execution time."""
        times = []
        
        # Warm up
        await self.client.get(query)
        
        # Measure
        for _ in range(runs):
            start = time.time()
            response = await self.client.get(query)
            elapsed = time.time() - start
            
            if response.status_code == 200:
                times.append(elapsed)
            else:
                print(f"  ⚠️ Query failed with status {response.status_code}: {query}")
                times.append(999.0)  # Penalty for failed queries
        
        return times
    
    def record_performance(self, category: str, name: str, times: List[float], query: str):
        """Record performance result."""
        avg_time = statistics.mean(times)
        min_time = min(times)
        max_time = max(times)
        target = self.performance_targets[category]
        
        passed = avg_time <= target
        
        if passed:
            status = "✅"
        elif avg_time <= target * 1.5:  # Within 50% of target
            status = "⚠️"
        else:
            status = "❌"
        
        print(f"  {status} {name}: {avg_time:.3f}s avg (target: {target}s)")
        
        if len(times) > 1:
            print(f"     Min: {min_time:.3f}s, Max: {max_time:.3f}s")
        
        self.results.append({
            'category': category,
            'name': name,
            'query': query,
            'avg_time': avg_time,
            'min_time': min_time,
            'max_time': max_time,
            'target': target,
            'passed': passed,
            'times': times
        })
    
    def print_summary(self):
        """Print performance test summary."""
        print("\n" + "="*60)
        print("📊 PERFORMANCE TEST SUMMARY")
        print("="*60)
        
        # Calculate statistics by category
        categories = {}
        for result in self.results:
            cat = result['category']
            if cat not in categories:
                categories[cat] = {'total': 0, 'passed': 0, 'times': []}
            
            categories[cat]['total'] += 1
            if result['passed']:
                categories[cat]['passed'] += 1
            categories[cat]['times'].append(result['avg_time'])
        
        print("\nPerformance by Category:")
        print(f"{'Category':<15} {'Pass Rate':<15} {'Avg Time':<15} {'Target':<10}")
        print("-" * 55)
        
        for cat, data in categories.items():
            pass_rate = (data['passed'] / data['total']) * 100
            avg_time = statistics.mean(data['times'])
            target = self.performance_targets[cat]
            
            print(f"{cat:<15} {pass_rate:>6.1f}%        {avg_time:>6.3f}s        {target:>6.1f}s")
        
        # Find slowest queries
        print("\n🐌 Slowest Queries:")
        slowest = sorted(self.results, key=lambda x: x['avg_time'], reverse=True)[:5]
        
        for result in slowest:
            print(f"  - {result['name']}: {result['avg_time']:.3f}s")
            print(f"    Query: {result['query']}")
        
        # Performance insights
        print("\n💡 Performance Insights:")
        
        # Check pagination performance
        pagination_results = [r for r in self.results if 'Pagination' in r['name']]
        if pagination_results:
            if any(not r['passed'] for r in pagination_results):
                print("  ⚠️ Pagination performance degrades with higher page numbers")
            else:
                print("  ✅ Pagination performance is consistent across pages")
        
        # Check include overhead
        include_results = [r for r in self.results if 'Include' in r['name']]
        if include_results:
            overhead = include_results[0]['times'][0] if include_results[0]['times'] else 0
            if overhead > 50:
                print(f"  ⚠️ Include operations add significant overhead ({overhead:.0f}%)")
            else:
                print(f"  ✅ Include overhead is acceptable ({overhead:.0f}%)")
        
        # Check sort performance
        sort_results = [r for r in self.results if 'Sort' in r['name'] or 'sort' in r['query']]
        if sort_results:
            slow_sorts = [r for r in sort_results if not r['passed']]
            if slow_sorts:
                print("  ⚠️ Some sort operations are slow - consider adding indexes")
            else:
                print("  ✅ Sort operations perform within targets")
        
        # Overall assessment
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['passed'])
        pass_rate = (passed_tests / total_tests) * 100
        
        print(f"\n📈 Overall Performance Score: {pass_rate:.1f}%")
        print(f"   ({passed_tests}/{total_tests} queries met performance targets)")
        
        if pass_rate >= 90:
            print("\n✅ Excellent performance - system is production ready")
        elif pass_rate >= 70:
            print("\n⚠️ Good performance - some optimization recommended")
        else:
            print("\n❌ Performance needs improvement before production")
        
        # Recommendations
        print("\n📝 Recommendations:")
        
        heavy_queries = [r for r in self.results if r['category'] == 'heavy' and not r['passed']]
        if heavy_queries:
            print("  1. Consider adding indexes for heavy queries")
            print("  2. Implement query result caching")
            print("  3. Optimize large result set handling")
        
        if self.total_resources > 10000:
            print("  4. Monitor performance as data volume grows")
            print("  5. Consider partitioning for very large datasets")
        
        print("\n🔧 Query Optimization Tips:")
        print("  - Use specific search parameters to narrow results")
        print("  - Always include _count to limit result size")
        print("  - Use proper indexes for frequently searched fields")
        print("  - Consider caching for repeated complex queries")
        print("  - Monitor slow query logs in production")


async def main():
    """Run performance tests."""
    tester = PerformanceQueryTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())