#!/usr/bin/env python3
"""
Dynamic Catalog Integration Validation Test
Tests the complete dynamic catalog system to ensure it's working properly.
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, List, Any

class DynamicCatalogTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.catalog_base = f"{base_url}/api/clinical/dynamic-catalog"
        self.session = None
        
    async def setup(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def test_endpoint(self, endpoint: str, expected_fields: List[str]) -> Dict[str, Any]:
        """Test a specific endpoint and validate response structure"""
        url = f"{self.catalog_base}/{endpoint}"
        
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status}: {await response.text()}"
                    }
                
                data = await response.json()
                
                if not isinstance(data, list):
                    return {
                        "success": False,
                        "error": "Response is not a list"
                    }
                
                if len(data) == 0:
                    return {
                        "success": False,
                        "error": "No data returned - empty catalog"
                    }
                
                # Validate first item has expected fields
                first_item = data[0]
                missing_fields = [field for field in expected_fields if field not in first_item]
                
                if missing_fields:
                    return {
                        "success": False,
                        "error": f"Missing required fields: {missing_fields}"
                    }
                
                return {
                    "success": True,
                    "count": len(data),
                    "sample": first_item,
                    "endpoint": endpoint
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Exception: {str(e)}"
            }
    
    async def test_search_endpoint(self, endpoint: str, search_term: str) -> Dict[str, Any]:
        """Test search functionality"""
        if endpoint == "search":
            # Universal search endpoint has different structure
            url = f"{self.catalog_base}/{endpoint}"
            params = {"query": search_term, "limit": 10}
        else:
            url = f"{self.catalog_base}/{endpoint}"
            params = {"search": search_term, "limit": 10}
        
        try:
            async with self.session.get(url, params=params) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status}: {await response.text()}"
                    }
                
                data = await response.json()
                
                if endpoint == "search":
                    # Universal search returns dict with category arrays
                    total_results = sum(len(results) for results in data.values() if isinstance(results, list))
                    return {
                        "success": True,
                        "count": total_results,
                        "search_term": search_term,
                        "endpoint": endpoint
                    }
                else:
                    return {
                        "success": True,
                        "count": len(data),
                        "search_term": search_term,
                        "endpoint": endpoint
                    }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Exception: {str(e)}"
            }
    
    async def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🧪 Starting Dynamic Catalog Integration Tests...")
        print("=" * 60)
        
        # Test configurations
        test_configs = [
            {
                "endpoint": "lab-tests",
                "expected_fields": ["loinc_code", "display", "reference_range", "frequency_count"],
                "search_term": "glucose"
            },
            {
                "endpoint": "conditions",
                "expected_fields": ["code", "display", "system", "frequency_count"],
                "search_term": "diabetes"
            },
            {
                "endpoint": "medications",
                "expected_fields": ["code", "display", "frequency_count"],
                "search_term": "aspirin"
            },
            {
                "endpoint": "procedures",
                "expected_fields": ["code", "display", "frequency_count"],
                "search_term": "vaccination"
            }
        ]
        
        results = []
        
        for config in test_configs:
            print(f"\n📋 Testing {config['endpoint']} catalog...")
            
            # Test basic endpoint
            result = await self.test_endpoint(config["endpoint"], config["expected_fields"])
            results.append(result)
            
            if result["success"]:
                print(f"✅ Basic endpoint: {result['count']} items returned")
                print(f"   Sample: {result['sample'].get('display', 'N/A')}")
            else:
                print(f"❌ Basic endpoint failed: {result['error']}")
                continue
            
            # Test search functionality
            search_result = await self.test_search_endpoint(config["endpoint"], config["search_term"])
            results.append(search_result)
            
            if search_result["success"]:
                print(f"✅ Search '{config['search_term']}': {search_result['count']} results")
            else:
                print(f"❌ Search failed: {search_result['error']}")
        
        # Test universal search
        print(f"\n🔍 Testing universal search...")
        universal_result = await self.test_search_endpoint("search", "blood")
        results.append(universal_result)
        
        if universal_result["success"]:
            print(f"✅ Universal search: {universal_result['count']} results")
        else:
            print(f"❌ Universal search failed: {universal_result['error']}")
        
        # Test statistics endpoint (returns dict not list)
        print(f"\n📊 Testing statistics endpoint...")
        try:
            url = f"{self.catalog_base}/statistics"
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    stats_result = {
                        "success": True,
                        "endpoint": "statistics",
                        "sample": data
                    }
                    print(f"✅ Statistics endpoint working")
                    print(f"   Resource counts: {data.get('resource_counts', {})}")
                else:
                    stats_result = {
                        "success": False,
                        "error": f"HTTP {response.status}"
                    }
                    print(f"❌ Statistics failed: HTTP {response.status}")
        except Exception as e:
            stats_result = {
                "success": False,
                "error": f"Exception: {str(e)}"
            }
            print(f"❌ Statistics failed: {e}")
        
        results.append(stats_result)
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\nFailed Tests:")
            for result in results:
                if not result["success"]:
                    print(f"  - {result.get('endpoint', 'unknown')}: {result['error']}")
        
        return passed_tests == total_tests

async def main():
    """Main test runner"""
    tester = DynamicCatalogTester()
    
    try:
        await tester.setup()
        success = await tester.run_all_tests()
        
        if success:
            print("\n🎉 All tests passed! Dynamic catalog integration is working correctly.")
            sys.exit(0)
        else:
            print("\n💥 Some tests failed. Please check the system.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Test suite failed with exception: {e}")
        sys.exit(1)
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    asyncio.run(main())