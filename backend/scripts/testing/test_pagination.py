#!/usr/bin/env python3
"""
Test FHIR pagination with actual large result sets from database.
Verifies _count, _page parameters and navigation links.

Created: 2025-01-21
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, List, Set, Optional
import httpx

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database import get_db_context
from sqlalchemy import text


class PaginationTester:
    """Tests FHIR pagination with real data."""
    
    def __init__(self):
        self.api_base = "http://localhost:8000/fhir/R4"
        self.results = []
        self.stats = {
            'total': 0,
            'passed': 0,
            'failed': 0,
            'errors': []
        }
    
    async def run_all_tests(self):
        """Run all pagination tests."""
        async with get_db_context() as db:
            async with httpx.AsyncClient(base_url=self.api_base, timeout=30.0) as client:
                self.db = db
                self.client = client
                
                print("📄 Testing FHIR Pagination\n")
                print("="*60)
                
                # Test basic pagination
                await self.test_basic_pagination()
                
                # Test _count parameter
                await self.test_count_parameter()
                
                # Test _page parameter
                await self.test_page_parameter()
                
                # Test navigation links
                await self.test_navigation_links()
                
                # Test edge cases
                await self.test_edge_cases()
                
                # Test with search criteria
                await self.test_pagination_with_search()
                
                # Test large result sets
                await self.test_large_result_sets()
                
                # Test consistency
                await self.test_pagination_consistency()
                
                # Print summary
                self.print_summary()
    
    async def test_basic_pagination(self):
        """Test basic pagination with default settings."""
        print("\n📋 Testing basic pagination...")
        
        # Get total count of a resource type with many instances
        result = await self.db.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false
            GROUP BY resource_type
            ORDER BY count DESC
            LIMIT 5
        """))
        
        for row in result:
            if row.count > 20:  # Need enough for pagination
                resource_type = row.resource_type
                total_count = row.count
                
                # Test default pagination (should be 10 per page)
                response = await self.client.get(f"/{resource_type}")
                
                if response.status_code == 200:
                    bundle = response.json()
                    
                    # Check bundle structure
                    success = True
                    errors = []
                    
                    if bundle.get('type') != 'searchset':
                        success = False
                        errors.append("Bundle type should be 'searchset'")
                    
                    if 'total' not in bundle:
                        success = False
                        errors.append("Bundle missing 'total' field")
                    elif bundle['total'] != total_count:
                        success = False
                        errors.append(f"Total mismatch: expected {total_count}, got {bundle['total']}")
                    
                    entry_count = len(bundle.get('entry', []))
                    if entry_count > 10:  # Default _count is 10
                        success = False
                        errors.append(f"Too many entries returned: {entry_count} (default should be 10)")
                    
                    self.record_result(success, f"Basic pagination for {resource_type}",
                                     " | ".join(errors) if errors else None,
                                     count=entry_count)
                else:
                    self.record_result(False, f"Basic pagination for {resource_type}",
                                     f"HTTP {response.status_code}")
                
                break  # Test one resource type
    
    async def test_count_parameter(self):
        """Test _count parameter with various values."""
        print("\n🔢 Testing _count parameter...")
        
        # Find resource type with enough instances
        result = await self.db.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false
            AND resource_type = 'Observation'
            GROUP BY resource_type
        """))
        row = result.fetchone()
        
        if row and row.count > 50:
            resource_type = row.resource_type
            
            # Test various _count values
            test_counts = [1, 5, 20, 50, 100]
            
            for count in test_counts:
                response = await self.client.get(f"/{resource_type}?_count={count}")
                
                if response.status_code == 200:
                    bundle = response.json()
                    actual_count = len(bundle.get('entry', []))
                    expected_count = min(count, row.count)
                    
                    if actual_count == expected_count:
                        self.record_result(True, f"_count={count}",
                                         count=actual_count)
                    else:
                        self.record_result(False, f"_count={count}",
                                         f"Expected {expected_count} entries, got {actual_count}")
                else:
                    self.record_result(False, f"_count={count}",
                                     f"HTTP {response.status_code}")
            
            # Test invalid _count values
            invalid_counts = [-1, 0, 1001, "abc"]
            
            for count in invalid_counts:
                response = await self.client.get(f"/{resource_type}?_count={count}")
                
                if count == -1:
                    # Should return 400 Bad Request
                    if response.status_code == 400:
                        self.record_result(True, f"_count={count} rejected")
                    else:
                        self.record_result(False, f"_count={count} validation",
                                         f"Expected 400, got {response.status_code}")
                elif count == 0:
                    # _count=0 might be valid for count-only queries
                    if response.status_code in [200, 400]:
                        self.record_result(True, f"_count={count} handled")
                    else:
                        self.record_result(False, f"_count={count}",
                                         f"Unexpected response: {response.status_code}")
                elif count == 1001:
                    # Should be capped at 1000
                    if response.status_code == 200:
                        bundle = response.json()
                        actual_count = len(bundle.get('entry', []))
                        if actual_count <= 1000:
                            self.record_result(True, f"_count={count} capped at 1000")
                        else:
                            self.record_result(False, f"_count={count}",
                                             f"Not capped: returned {actual_count}")
                    else:
                        self.record_result(False, f"_count={count}",
                                         f"HTTP {response.status_code}")
    
    async def test_page_parameter(self):
        """Test _page parameter for pagination."""
        print("\n📑 Testing _page parameter...")
        
        # Use Observation which typically has many instances
        result = await self.db.execute(text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
        """))
        total_count = result.scalar()
        
        if total_count > 30:
            # Test sequential pages
            page_size = 10
            total_pages = (total_count + page_size - 1) // page_size
            
            all_ids = set()
            
            for page in range(1, min(4, total_pages + 1)):  # Test first 3 pages
                response = await self.client.get(f"/Observation?_count={page_size}&_page={page}")
                
                if response.status_code == 200:
                    bundle = response.json()
                    
                    # Check entries
                    entries = bundle.get('entry', [])
                    page_ids = {entry['resource']['id'] for entry in entries}
                    
                    # Check for duplicates across pages
                    duplicates = all_ids.intersection(page_ids)
                    if duplicates:
                        self.record_result(False, f"Page {page} uniqueness",
                                         f"Duplicate IDs: {list(duplicates)[:3]}")
                    else:
                        self.record_result(True, f"Page {page} unique entries",
                                         count=len(entries))
                    
                    all_ids.update(page_ids)
                    
                    # Check entry count
                    if page < total_pages:
                        expected = page_size
                    else:
                        expected = total_count - (page - 1) * page_size
                    
                    if len(entries) != expected:
                        self.record_result(False, f"Page {page} count",
                                         f"Expected {expected}, got {len(entries)}")
                else:
                    self.record_result(False, f"Page {page}",
                                     f"HTTP {response.status_code}")
            
            # Test out of range page
            response = await self.client.get(f"/Observation?_count=10&_page=9999")
            
            if response.status_code == 200:
                bundle = response.json()
                if len(bundle.get('entry', [])) == 0:
                    self.record_result(True, "Out of range page returns empty")
                else:
                    self.record_result(False, "Out of range page",
                                     "Should return empty bundle")
    
    async def test_navigation_links(self):
        """Test navigation links (self, next, previous)."""
        print("\n🔗 Testing navigation links...")
        
        # Find resource with enough instances
        result = await self.db.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false
            GROUP BY resource_type
            HAVING COUNT(*) > 30
            LIMIT 1
        """))
        row = result.fetchone()
        
        if row:
            resource_type = row.resource_type
            
            # Test first page
            response = await self.client.get(f"/{resource_type}?_count=10&_page=1")
            
            if response.status_code == 200:
                bundle = response.json()
                links = {link['relation']: link['url'] for link in bundle.get('link', [])}
                
                # Should have self and next, but not previous
                if 'self' in links:
                    self.record_result(True, "First page has 'self' link")
                else:
                    self.record_result(False, "First page links",
                                     "Missing 'self' link")
                
                if 'next' in links:
                    self.record_result(True, "First page has 'next' link")
                    
                    # Follow next link
                    next_response = await self.client.get(links['next'])
                    if next_response.status_code == 200:
                        self.record_result(True, "Next link is functional")
                    else:
                        self.record_result(False, "Next link",
                                         f"HTTP {next_response.status_code}")
                else:
                    self.record_result(False, "First page links",
                                     "Missing 'next' link")
                
                if 'previous' not in links:
                    self.record_result(True, "First page has no 'previous' link")
                else:
                    self.record_result(False, "First page links",
                                     "Should not have 'previous' link")
            
            # Test middle page
            response = await self.client.get(f"/{resource_type}?_count=10&_page=2")
            
            if response.status_code == 200:
                bundle = response.json()
                links = {link['relation']: link['url'] for link in bundle.get('link', [])}
                
                # Should have all three links
                for rel in ['self', 'next', 'previous']:
                    if rel in links:
                        self.record_result(True, f"Middle page has '{rel}' link")
                    else:
                        self.record_result(False, "Middle page links",
                                         f"Missing '{rel}' link")
    
    async def test_edge_cases(self):
        """Test pagination edge cases."""
        print("\n🔧 Testing edge cases...")
        
        # Test empty result set
        response = await self.client.get("/Patient?name=NONEXISTENT_NAME_XYZ")
        
        if response.status_code == 200:
            bundle = response.json()
            
            if bundle.get('total') == 0 and len(bundle.get('entry', [])) == 0:
                self.record_result(True, "Empty result set handled correctly")
            else:
                self.record_result(False, "Empty result set",
                                 f"Total: {bundle.get('total')}, Entries: {len(bundle.get('entry', []))}")
        
        # Test single result
        result = await self.db.execute(text("""
            SELECT fhir_id
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND deleted = false
            LIMIT 1
        """))
        patient_id = result.scalar()
        
        if patient_id:
            response = await self.client.get(f"/Patient?_id={patient_id}")
            
            if response.status_code == 200:
                bundle = response.json()
                
                if bundle.get('total') == 1 and len(bundle.get('entry', [])) == 1:
                    self.record_result(True, "Single result handled correctly")
                    
                    # Should not have next/previous links
                    links = {link['relation'] for link in bundle.get('link', [])}
                    if 'next' not in links and 'previous' not in links:
                        self.record_result(True, "Single result has no navigation links")
                    else:
                        self.record_result(False, "Single result links",
                                         f"Unexpected links: {links}")
    
    async def test_pagination_with_search(self):
        """Test pagination combined with search criteria."""
        print("\n🔍 Testing pagination with search...")
        
        # Find common observation code with many instances
        result = await self.db.execute(text("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND deleted = false
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code
            HAVING COUNT(*) > 20
            ORDER BY count DESC
            LIMIT 1
        """))
        row = result.fetchone()
        
        if row:
            code = row.code
            total_count = row.count
            
            # Test pagination with search
            page_size = 5
            collected_ids = []
            
            for page in [1, 2, 3]:
                response = await self.client.get(
                    f"/Observation?code={code}&_count={page_size}&_page={page}"
                )
                
                if response.status_code == 200:
                    bundle = response.json()
                    
                    # Verify total matches database count
                    if bundle.get('total') == total_count:
                        self.record_result(True, f"Search pagination page {page} total correct")
                    else:
                        self.record_result(False, f"Search pagination page {page}",
                                         f"Total mismatch: expected {total_count}, got {bundle.get('total')}")
                    
                    # Collect IDs
                    for entry in bundle.get('entry', []):
                        collected_ids.append(entry['resource']['id'])
                    
                    # Verify all results match search criteria
                    all_match = True
                    for entry in bundle.get('entry', []):
                        resource_code = entry['resource'].get('code', {}).get('coding', [{}])[0].get('code')
                        if resource_code != code:
                            all_match = False
                            break
                    
                    if all_match:
                        self.record_result(True, f"Search results page {page} all match criteria")
                    else:
                        self.record_result(False, f"Search results page {page}",
                                         "Some results don't match search criteria")
            
            # Check no duplicates across pages
            if len(collected_ids) == len(set(collected_ids)):
                self.record_result(True, "No duplicates across search pages")
            else:
                self.record_result(False, "Search pagination duplicates",
                                 f"Found {len(collected_ids) - len(set(collected_ids))} duplicates")
    
    async def test_large_result_sets(self):
        """Test pagination with the largest result sets."""
        print("\n📊 Testing large result sets...")
        
        # Find the largest resource collections
        result = await self.db.execute(text("""
            SELECT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false
            GROUP BY resource_type
            ORDER BY count DESC
            LIMIT 3
        """))
        
        for row in result:
            resource_type = row.resource_type
            total_count = row.count
            
            print(f"\n  Testing {resource_type} with {total_count} resources...")
            
            # Test different page sizes
            page_sizes = [10, 50, 100, 500]
            
            for page_size in page_sizes:
                if page_size > total_count:
                    continue
                
                response = await self.client.get(f"/{resource_type}?_count={page_size}")
                
                if response.status_code == 200:
                    bundle = response.json()
                    
                    actual_count = len(bundle.get('entry', []))
                    expected_count = min(page_size, total_count)
                    
                    if actual_count == expected_count:
                        self.record_result(True, f"{resource_type} with _count={page_size}",
                                         count=actual_count)
                    else:
                        self.record_result(False, f"{resource_type} with _count={page_size}",
                                         f"Expected {expected_count}, got {actual_count}")
                    
                    # Check bundle.total accuracy
                    if bundle.get('total') == total_count:
                        self.record_result(True, f"{resource_type} total count accurate")
                    else:
                        self.record_result(False, f"{resource_type} total count",
                                         f"Expected {total_count}, got {bundle.get('total')}")
                else:
                    self.record_result(False, f"{resource_type} with _count={page_size}",
                                     f"HTTP {response.status_code}")
    
    async def test_pagination_consistency(self):
        """Test that pagination returns consistent results."""
        print("\n🔄 Testing pagination consistency...")
        
        # Use a stable resource type
        resource_type = "Patient"
        
        # Get first page twice
        response1 = await self.client.get(f"/{resource_type}?_count=5&_page=1")
        response2 = await self.client.get(f"/{resource_type}?_count=5&_page=1")
        
        if response1.status_code == 200 and response2.status_code == 200:
            bundle1 = response1.json()
            bundle2 = response2.json()
            
            # Extract IDs in order
            ids1 = [entry['resource']['id'] for entry in bundle1.get('entry', [])]
            ids2 = [entry['resource']['id'] for entry in bundle2.get('entry', [])]
            
            if ids1 == ids2:
                self.record_result(True, "Pagination returns consistent results")
            else:
                self.record_result(False, "Pagination consistency",
                                 f"Different results: {ids1} vs {ids2}")
            
            # Check totals are consistent
            if bundle1.get('total') == bundle2.get('total'):
                self.record_result(True, "Total count is consistent")
            else:
                self.record_result(False, "Total consistency",
                                 f"Totals differ: {bundle1.get('total')} vs {bundle2.get('total')}")
        
        # Test that sequential pages don't overlap
        page1_response = await self.client.get(f"/{resource_type}?_count=5&_page=1")
        page2_response = await self.client.get(f"/{resource_type}?_count=5&_page=2")
        
        if page1_response.status_code == 200 and page2_response.status_code == 200:
            page1_bundle = page1_response.json()
            page2_bundle = page2_response.json()
            
            page1_ids = {entry['resource']['id'] for entry in page1_bundle.get('entry', [])}
            page2_ids = {entry['resource']['id'] for entry in page2_bundle.get('entry', [])}
            
            overlap = page1_ids.intersection(page2_ids)
            
            if not overlap:
                self.record_result(True, "No overlap between sequential pages")
            else:
                self.record_result(False, "Page overlap",
                                 f"Pages 1 and 2 share IDs: {overlap}")
    
    def record_result(self, success: bool, description: str, error: str = None, count: int = None):
        """Record test result."""
        self.stats['total'] += 1
        
        if success:
            self.stats['passed'] += 1
            count_str = f" ({count} items)" if count is not None else ""
            print(f"  ✅ {description}{count_str}")
        else:
            self.stats['failed'] += 1
            self.stats['errors'].append({'test': description, 'error': error})
            print(f"  ❌ {description}: {error}")
    
    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("📊 PAGINATION TEST SUMMARY")
        print("="*60)
        
        print(f"\nTotal Tests: {self.stats['total']}")
        print(f"Passed: {self.stats['passed']} ({self.stats['passed']/max(1, self.stats['total'])*100:.1f}%)")
        print(f"Failed: {self.stats['failed']} ({self.stats['failed']/max(1, self.stats['total'])*100:.1f}%)")
        
        if self.stats['failed'] > 0:
            print("\n❌ Failed Tests:")
            for error in self.stats['errors']:
                print(f"  - {error['test']}: {error['error']}")
        
        print("\n📝 Notes:")
        print("  - Default page size is 10 items")
        print("  - Maximum _count is 1000")
        print("  - _page parameter starts at 1")
        print("  - Navigation links should be provided for multi-page results")
        print("  - Empty result sets should return total=0 with no entries")
        print("  - Results should be consistent across requests")


async def main():
    """Run pagination tests."""
    tester = PaginationTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())