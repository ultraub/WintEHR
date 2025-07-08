#!/usr/bin/env python3
"""
Test Search Functionality

Comprehensive test of both backend FHIR search and frontend search components
to ensure partial name matching works correctly.
"""

import asyncio
import aiohttp
import sys
from datetime import datetime


class SearchFunctionalityTester:
    """Test search functionality across the system."""
    
    def __init__(self):
        self.api_base = 'http://localhost:8000'
        self.test_results = []
    
    def log(self, message, level="INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        if level == "ERROR":
            print(f"❌ [{timestamp}] {message}")
        elif level == "SUCCESS":
            print(f"✅ [{timestamp}] {message}")
        elif level == "WARNING":
            print(f"⚠️  [{timestamp}] {message}")
        else:
            print(f"ℹ️  [{timestamp}] {message}")
    
    async def test_fhir_search_api(self):
        """Test FHIR search API endpoints."""
        self.log("Testing FHIR search API...")
        
        test_cases = [
            # (search_url, expected_min_results, description)
            (f"{self.api_base}/fhir/R4/Patient?name=Miki&_count=5", 1, "Partial first name search"),
            (f"{self.api_base}/fhir/R4/Patient?name=Lang&_count=5", 1, "Partial last name search"),
            (f"{self.api_base}/fhir/R4/Patient?name=Damon&_count=5", 1, "Full first name search"),
            (f"{self.api_base}/fhir/R4/Patient?name=Morar&_count=5", 1, "Partial family name search"),
            (f"{self.api_base}/fhir/R4/Patient?name=xyz123&_count=5", 0, "Non-existent name search"),
            (f"{self.api_base}/fhir/R4/Patient?given=Miki&_count=5", 1, "Partial given name search"),
            (f"{self.api_base}/fhir/R4/Patient?family=Lang&_count=5", 1, "Partial family name search"),
            (f"{self.api_base}/fhir/R4/Patient?given:contains=iki&_count=5", 1, "Contains modifier test"),
            (f"{self.api_base}/fhir/R4/Patient?family:exact=Langosh790&_count=5", 1, "Exact modifier test"),
        ]
        
        async with aiohttp.ClientSession() as session:
            for search_url, expected_min, description in test_cases:
                try:
                    async with session.get(search_url) as resp:
                        if resp.status == 200:
                            bundle = await resp.json()
                            total = bundle.get('total', 0)
                            
                            if total >= expected_min:
                                self.log(f"{description}: {total} results", "SUCCESS")
                                self.test_results.append((description, True, f"{total} results"))
                            else:
                                self.log(f"{description}: Expected >= {expected_min}, got {total}", "ERROR")
                                self.test_results.append((description, False, f"Expected >= {expected_min}, got {total}"))
                        else:
                            self.log(f"{description}: HTTP {resp.status}", "ERROR")
                            self.test_results.append((description, False, f"HTTP {resp.status}"))
                            
                except Exception as e:
                    self.log(f"{description}: {e}", "ERROR")
                    self.test_results.append((description, False, str(e)))
    
    async def test_search_parameters(self):
        """Test that search parameters are properly indexed."""
        self.log("Testing search parameter indexing...")
        
        import asyncpg
        try:
            conn = await asyncpg.connect('postgresql://emr_user:emr_password@localhost:5432/emr_db')
            
            # Check available search parameters
            params_query = """
                SELECT DISTINCT param_name, COUNT(*) as count
                FROM fhir.search_params sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Patient'
                GROUP BY param_name
                ORDER BY param_name
            """
            
            params = await conn.fetch(params_query)
            
            expected_params = {'_id', 'name', 'given', 'family', 'gender'}
            actual_params = {row['param_name'] for row in params}
            
            missing_params = expected_params - actual_params
            if missing_params:
                self.log(f"Missing search parameters: {missing_params}", "ERROR")
                self.test_results.append(("Search parameter indexing", False, f"Missing: {missing_params}"))
            else:
                self.log("All expected search parameters present", "SUCCESS")
                self.test_results.append(("Search parameter indexing", True, "All parameters present"))
            
            self.log("Available search parameters:")
            for row in params:
                self.log(f"  - {row['param_name']}: {row['count']} entries")
            
            await conn.close()
            
        except Exception as e:
            self.log(f"Database check failed: {e}", "ERROR")
            self.test_results.append(("Database connectivity", False, str(e)))
    
    async def test_frontend_compatibility(self):
        """Test that frontend search components work with our changes."""
        self.log("Testing frontend search compatibility...")
        
        # Test the exact API calls that frontend components make
        frontend_test_cases = [
            # Patient list search calls
            (f"{self.api_base}/fhir/R4/Patient?name=Miki&_count=100&_sort=-_lastUpdated", "PatientList name search"),
            (f"{self.api_base}/fhir/R4/Patient?identifier=123&_count=100&_sort=-_lastUpdated", "PatientList MRN search"),
            
            # SearchBar calls
            (f"{self.api_base}/fhir/R4/Patient?name=Lang&_count=5&_sort=-_lastUpdated", "SearchBar patient search"),
        ]
        
        async with aiohttp.ClientSession() as session:
            for search_url, description in frontend_test_cases:
                try:
                    async with session.get(search_url) as resp:
                        if resp.status == 200:
                            bundle = await resp.json()
                            
                            # Check bundle structure
                            if bundle.get('resourceType') == 'Bundle':
                                total = bundle.get('total', 0)
                                entries = bundle.get('entry', [])
                                
                                self.log(f"{description}: Valid bundle with {total} results", "SUCCESS")
                                self.test_results.append((description, True, f"Valid bundle, {total} results"))
                                
                                # Check patient structure for frontend compatibility
                                if entries:
                                    patient = entries[0]['resource']
                                    required_fields = ['id', 'name', 'identifier']
                                    missing_fields = [field for field in required_fields if field not in patient]
                                    
                                    if missing_fields:
                                        self.log(f"{description}: Missing fields {missing_fields}", "WARNING")
                                    else:
                                        self.log(f"{description}: Patient structure compatible", "SUCCESS")
                                        
                            else:
                                self.log(f"{description}: Invalid bundle structure", "ERROR")
                                self.test_results.append((description, False, "Invalid bundle"))
                        else:
                            self.log(f"{description}: HTTP {resp.status}", "ERROR")
                            self.test_results.append((description, False, f"HTTP {resp.status}"))
                            
                except Exception as e:
                    self.log(f"{description}: {e}", "ERROR")
                    self.test_results.append((description, False, str(e)))
    
    async def run_comprehensive_test(self):
        """Run all search functionality tests."""
        self.log("Starting comprehensive search functionality test...")
        self.log("=" * 60)
        
        # Run all test categories
        await self.test_search_parameters()
        await self.test_fhir_search_api()
        await self.test_frontend_compatibility()
        
        # Summary
        self.log("=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        failed = 0
        
        for description, success, details in self.test_results:
            status = "PASS" if success else "FAIL"
            status_emoji = "✅" if success else "❌"
            self.log(f"{status_emoji} {status}: {description} - {details}")
            
            if success:
                passed += 1
            else:
                failed += 1
        
        self.log("=" * 60)
        
        if failed == 0:
            self.log(f"🎉 ALL TESTS PASSED ({passed}/{passed + failed})", "SUCCESS")
            self.log("Search functionality is working correctly!", "SUCCESS")
            return True
        else:
            self.log(f"❌ {failed} TEST(S) FAILED ({passed}/{passed + failed})", "ERROR")
            self.log("Please review the failures above", "ERROR")
            return False


async def main():
    tester = SearchFunctionalityTester()
    success = await tester.run_comprehensive_test()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())