#!/usr/bin/env python3
"""
Test Performance Improvements Script

Tests the performance improvements from database index optimization.
Compares query times before and after optimization.
"""

import asyncio
import asyncpg
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class PerformanceTester:
    def __init__(self):
        self.db_url = 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        self.conn = None
        self.results = {}
    
    async def connect(self):
        """Establish database connection."""
        self.conn = await asyncpg.connect(self.db_url)
        print("✅ Connected to database")
    
    async def disconnect(self):
        """Close database connection."""
        if self.conn:
            await self.conn.close()
            print("✅ Disconnected from database")
    
    async def time_query(self, query: str, params: list = None) -> Tuple[float, int]:
        """Execute query and return execution time and result count."""
        start = time.time()
        if params:
            results = await self.conn.fetch(query, *params)
        else:
            results = await self.conn.fetch(query)
        end = time.time()
        
        execution_time = (end - start) * 1000  # Convert to milliseconds
        return execution_time, len(results)
    
    async def test_patient_search(self):
        """Test patient search with various parameters."""
        print("\n📋 Testing Patient Search Performance...")
        
        # Get a sample patient ID
        patient = await self.conn.fetchrow(
            "SELECT fhir_id FROM fhir.resources WHERE resource_type = 'Patient' LIMIT 1"
        )
        if not patient:
            print("❌ No patients found")
            return
        
        patient_id = patient['fhir_id']
        
        # Test 1: Search by patient reference
        query = """
            SELECT DISTINCT r.* 
            FROM fhir.resources r
            JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE sp.param_name IN ('patient', 'subject')
            AND sp.value_reference = $1
            AND r.resource_type = 'Condition'
        """
        time_ms, count = await self.time_query(query, [patient_id])
        self.results['patient_condition_search'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Search conditions by patient reference'
        }
        print(f"  ✓ Patient condition search: {time_ms:.2f}ms ({count} results)")
        
        # Test 2: Multi-parameter search
        query = """
            SELECT DISTINCT r.* 
            FROM fhir.resources r
            JOIN fhir.search_params sp1 ON r.id = sp1.resource_id
            JOIN fhir.search_params sp2 ON r.id = sp2.resource_id
            WHERE sp1.param_name = 'patient' AND sp1.value_reference = $1
            AND sp2.param_name = 'status' AND sp2.value_token_code = 'active'
            AND r.resource_type = 'MedicationRequest'
        """
        time_ms, count = await self.time_query(query, [patient_id])
        self.results['multi_param_search'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Multi-parameter search (patient + status)'
        }
        print(f"  ✓ Multi-parameter search: {time_ms:.2f}ms ({count} results)")
    
    async def test_date_range_queries(self):
        """Test date range query performance."""
        print("\n📅 Testing Date Range Query Performance...")
        
        # Test date range search
        query = """
            SELECT DISTINCT r.*
            FROM fhir.resources r
            JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.resource_type = 'Encounter'
            AND sp.param_name = 'date'
            AND sp.value_date >= '2024-01-01'::timestamp
            AND sp.value_date <= '2024-12-31'::timestamp
        """
        time_ms, count = await self.time_query(query)
        self.results['date_range_search'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Date range search on Encounters'
        }
        print(f"  ✓ Date range search: {time_ms:.2f}ms ({count} results)")
    
    async def test_sort_operations(self):
        """Test sort operation performance."""
        print("\n🔤 Testing Sort Operation Performance...")
        
        # Test 1: Sort patients by birthdate
        query = """
            SELECT id, fhir_id, resource->>'birthDate' as birthdate
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            ORDER BY resource->>'birthDate' DESC
            LIMIT 100
        """
        time_ms, count = await self.time_query(query)
        self.results['birthdate_sort'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Sort patients by birthdate'
        }
        print(f"  ✓ Birthdate sort: {time_ms:.2f}ms ({count} results)")
        
        # Test 2: Sort patients by name
        query = """
            SELECT id, fhir_id, resource->'name'->0->>'family' as family_name
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            ORDER BY resource->'name'->0->>'family'
            LIMIT 100
        """
        time_ms, count = await self.time_query(query)
        self.results['name_sort'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Sort patients by family name'
        }
        print(f"  ✓ Name sort: {time_ms:.2f}ms ({count} results)")
        
        # Test 3: Sort observations by date
        query = """
            SELECT id, fhir_id, resource->>'effectiveDateTime' as effective_date
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->>'effectiveDateTime' IS NOT NULL
            ORDER BY resource->>'effectiveDateTime' DESC
            LIMIT 100
        """
        time_ms, count = await self.time_query(query)
        self.results['observation_date_sort'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Sort observations by date'
        }
        print(f"  ✓ Observation date sort: {time_ms:.2f}ms ({count} results)")
    
    async def test_patient_everything(self):
        """Test Patient/$everything performance."""
        print("\n🏥 Testing Patient/$everything Performance...")
        
        # Get a patient with many resources
        patient = await self.conn.fetchrow("""
            SELECT p.fhir_id, COUNT(c.id) as resource_count
            FROM fhir.resources p
            JOIN fhir.compartments c ON c.compartment_id = p.fhir_id
            WHERE p.resource_type = 'Patient'
            AND c.compartment_type = 'Patient'
            GROUP BY p.fhir_id
            ORDER BY COUNT(c.id) DESC
            LIMIT 1
        """)
        
        if not patient:
            print("❌ No patient compartments found")
            return
        
        patient_id = patient['fhir_id']
        expected_count = patient['resource_count']
        
        # Test compartment query
        query = """
            SELECT r.*
            FROM fhir.resources r
            JOIN fhir.compartments c ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            AND c.compartment_id = $1
        """
        time_ms, count = await self.time_query(query, [patient_id])
        self.results['patient_everything'] = {
            'time_ms': time_ms,
            'count': count,
            'description': f'Patient/$everything for patient with {expected_count} resources'
        }
        print(f"  ✓ Patient/$everything: {time_ms:.2f}ms ({count} resources)")
    
    async def test_pagination(self):
        """Test pagination performance."""
        print("\n📄 Testing Pagination Performance...")
        
        # Test paginated query
        query = """
            SELECT id, fhir_id, last_updated
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            ORDER BY last_updated DESC, id
            LIMIT 50 OFFSET 100
        """
        time_ms, count = await self.time_query(query)
        self.results['pagination'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Paginated Observation query (page 3)'
        }
        print(f"  ✓ Pagination: {time_ms:.2f}ms ({count} results)")
    
    async def test_code_searches(self):
        """Test clinical code search performance."""
        print("\n🔬 Testing Clinical Code Search Performance...")
        
        # Get a common code
        code_info = await self.conn.fetchrow("""
            SELECT value_token_code, value_token_system, COUNT(*) as count
            FROM fhir.search_params
            WHERE param_name = 'code'
            AND value_token_code IS NOT NULL
            GROUP BY value_token_code, value_token_system
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """)
        
        if code_info:
            code = code_info['value_token_code']
            system = code_info['value_token_system']
            
            # Test code search
            query = """
                SELECT DISTINCT r.*
                FROM fhir.resources r
                JOIN fhir.search_params sp ON r.id = sp.resource_id
                WHERE r.resource_type = 'Observation'
                AND sp.param_name = 'code'
                AND sp.value_token_code = $1
                AND ($2::text IS NULL OR sp.value_token_system = $2)
            """
            time_ms, count = await self.time_query(query, [code, system])
            self.results['code_search'] = {
                'time_ms': time_ms,
                'count': count,
                'description': f'Search by clinical code: {code}'
            }
            print(f"  ✓ Code search: {time_ms:.2f}ms ({count} results)")
    
    async def test_status_searches(self):
        """Test status-based search performance."""
        print("\n📊 Testing Status Search Performance...")
        
        # Test active medications
        query = """
            SELECT DISTINCT r.*
            FROM fhir.resources r
            JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.resource_type = 'MedicationRequest'
            AND sp.param_name = 'status'
            AND sp.value_token_code = 'active'
        """
        time_ms, count = await self.time_query(query)
        self.results['status_search'] = {
            'time_ms': time_ms,
            'count': count,
            'description': 'Search for active medications'
        }
        print(f"  ✓ Status search: {time_ms:.2f}ms ({count} results)")
    
    async def run_all_tests(self):
        """Run all performance tests."""
        print("🚀 Starting Performance Tests...")
        print("=" * 60)
        
        await self.connect()
        
        try:
            await self.test_patient_search()
            await self.test_date_range_queries()
            await self.test_sort_operations()
            await self.test_patient_everything()
            await self.test_pagination()
            await self.test_code_searches()
            await self.test_status_searches()
            
            # Print summary
            print("\n" + "=" * 60)
            print("📈 PERFORMANCE TEST SUMMARY")
            print("=" * 60)
            
            total_time = 0
            for test_name, result in self.results.items():
                print(f"\n{result['description']}:")
                print(f"  Time: {result['time_ms']:.2f}ms")
                print(f"  Results: {result['count']}")
                total_time += result['time_ms']
            
            print(f"\n✅ Total test time: {total_time:.2f}ms")
            print(f"✅ Average query time: {total_time/len(self.results):.2f}ms")
            
            # Check if indexes are being used
            print("\n📊 Checking Index Usage...")
            index_stats = await self.conn.fetch("""
                SELECT 
                    indexrelname as indexname,
                    idx_scan,
                    idx_tup_read
                FROM pg_stat_user_indexes
                WHERE schemaname = 'fhir'
                AND indexrelname LIKE 'idx_%'
                AND idx_scan > 0
                ORDER BY idx_scan DESC
                LIMIT 10
            """)
            
            if index_stats:
                print("\nTop Used Indexes:")
                for idx in index_stats:
                    print(f"  - {idx['indexname']}: {idx['idx_scan']} scans, {idx['idx_tup_read']} tuples")
            
        finally:
            await self.disconnect()


async def main():
    tester = PerformanceTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())