#!/usr/bin/env python3
"""
Comprehensive FHIR API Testing Script
Tests all FHIR functionality including CRUD, search, chaining, and multi-version support
"""

import asyncio
import json
import time
import sys
import traceback
from typing import Dict, List, Any, Optional
import aiohttp
from datetime import datetime, timezone

class FHIRTestRunner:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.test_results = []
        self.created_resources = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = "", duration: float = 0.0):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "duration": duration
        })
        print(f"{status} {test_name} ({duration:.3f}s)")
        if details:
            print(f"   {details}")
    
    async def test_server_health(self):
        """Test if server is responding"""
        start_time = time.time()
        try:
            async with self.session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    self.log_test("Server Health Check", True, f"Status: {data.get('status', 'unknown')}", time.time() - start_time)
                    return True
                else:
                    self.log_test("Server Health Check", False, f"HTTP {response.status}", time.time() - start_time)
                    return False
        except Exception as e:
            self.log_test("Server Health Check", False, f"Error: {str(e)}", time.time() - start_time)
            return False
    
    async def test_basic_crud_operations(self):
        """Test basic CRUD operations for multiple resource types"""
        # First create a patient to use as reference for other resources
        patient_data = {
            "resourceType": "Patient",
            "name": [{"family": "TestPatient", "given": ["John"]}],
            "gender": "male",
            "birthDate": "1990-01-01"
        }
        
        # Create patient first and get ID
        patient_id = None
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/Patient",
                json=patient_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 201:
                    created_patient = await response.json()
                    patient_id = created_patient.get("id")
                    self.created_resources.append(("Patient", patient_id))
        except Exception:
            pass
        
        # Use the created patient ID or skip dependent tests
        patient_ref = f"Patient/{patient_id}" if patient_id else None
        
        resource_types = [
            ("Patient", {
                "resourceType": "Patient",
                "name": [{"family": "TestPatient", "given": ["John"]}],
                "gender": "male",
                "birthDate": "1990-01-01"
            }),
            ("Observation", {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": "8302-2", "display": "Body height"}]
                },
                "subject": {"reference": patient_ref} if patient_ref else None,
                "valueQuantity": {
                    "value": 180,
                    "unit": "cm",
                    "system": "http://unitsofmeasure.org"
                }
            }),
            ("Condition", {
                "resourceType": "Condition",
                "clinicalStatus": {
                    "coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]
                },
                "code": {
                    "coding": [{"system": "http://snomed.info/sct", "code": "386661006", "display": "Fever"}]
                },
                "subject": {"reference": patient_ref} if patient_ref else None
            })
        ]
        
        for resource_type, resource_data in resource_types:
            # Skip resources that require a patient reference if we don't have one
            if resource_type in ["Observation", "Condition"] and not patient_ref:
                resource_data = {k: v for k, v in resource_data.items() if k != "subject"}
            await self._test_resource_crud(resource_type, resource_data)
    
    async def _test_resource_crud(self, resource_type: str, resource_data: Dict[str, Any]):
        """Test CRUD operations for a specific resource type"""
        created_id = None
        
        # Test CREATE
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/{resource_type}",
                json=resource_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 201:
                    created_resource = await response.json()
                    created_id = created_resource.get("id")
                    self.created_resources.append((resource_type, created_id))
                    self.log_test(f"CREATE {resource_type}", True, f"Created ID: {created_id}", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(f"CREATE {resource_type}", False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
                    return
        except Exception as e:
            self.log_test(f"CREATE {resource_type}", False, f"Error: {str(e)}", time.time() - start_time)
            return
        
        if not created_id:
            return
        
        # Test READ
        start_time = time.time()
        try:
            async with self.session.get(f"{self.base_url}/fhir/R4/{resource_type}/{created_id}") as response:
                if response.status == 200:
                    resource = await response.json()
                    self.log_test(f"READ {resource_type}", True, f"Retrieved resource with ID: {resource.get('id')}", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(f"READ {resource_type}", False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(f"READ {resource_type}", False, f"Error: {str(e)}", time.time() - start_time)
        
        # Test UPDATE
        start_time = time.time()
        try:
            updated_resource = resource_data.copy()
            updated_resource["id"] = created_id
            if resource_type == "Patient":
                updated_resource["name"][0]["given"] = ["Updated"]
            elif resource_type == "Observation":
                updated_resource["valueQuantity"]["value"] = 185
            elif resource_type == "Condition":
                updated_resource["clinicalStatus"]["coding"][0]["code"] = "resolved"
            
            async with self.session.put(
                f"{self.base_url}/fhir/R4/{resource_type}/{created_id}",
                json=updated_resource,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    updated_resource_result = await response.json()
                    self.log_test(f"UPDATE {resource_type}", True, f"Updated resource with ID: {updated_resource_result.get('id')}", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(f"UPDATE {resource_type}", False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(f"UPDATE {resource_type}", False, f"Error: {str(e)}", time.time() - start_time)
        
        # Test DELETE
        start_time = time.time()
        try:
            async with self.session.delete(f"{self.base_url}/fhir/R4/{resource_type}/{created_id}") as response:
                if response.status in [200, 204]:
                    self.log_test(f"DELETE {resource_type}", True, f"Deleted resource with ID: {created_id}", time.time() - start_time)
                    # Remove from created_resources since it's deleted
                    self.created_resources = [(rt, rid) for rt, rid in self.created_resources if rid != created_id]
                else:
                    error_text = await response.text()
                    self.log_test(f"DELETE {resource_type}", False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(f"DELETE {resource_type}", False, f"Error: {str(e)}", time.time() - start_time)
    
    async def test_search_operations(self):
        """Test various search operations"""
        # Get an existing patient ID from the database for reference searches
        existing_patient_id = None
        try:
            async with self.session.get(f"{self.base_url}/fhir/R4/Patient?_count=1") as response:
                if response.status == 200:
                    bundle = await response.json()
                    if bundle.get("entry") and len(bundle["entry"]) > 0:
                        existing_patient_id = bundle["entry"][0]["resource"]["id"]
        except Exception:
            pass
        
        search_tests = [
            ("Patient search by name", "Patient", {"name": "Smith"}),
            ("Patient search by gender", "Patient", {"gender": "male"}),
            ("Observation search by code", "Observation", {"code": "8302-2"}),
            ("Condition search by patient", "Condition", {"subject": f"Patient/{existing_patient_id}"} if existing_patient_id else {"code": "386661006"}),
            ("Search with _count parameter", "Patient", {"_count": "5"}),
            ("Search with _sort parameter", "Patient", {"_sort": "name"}),
            ("Search with date range", "Observation", {"date": "ge2020-01-01"}),
        ]
        
        for test_name, resource_type, params in search_tests:
            await self._test_search_operation(test_name, resource_type, params)
    
    async def _test_search_operation(self, test_name: str, resource_type: str, params: Dict[str, str]):
        """Test a specific search operation"""
        start_time = time.time()
        try:
            async with self.session.get(f"{self.base_url}/fhir/R4/{resource_type}", params=params) as response:
                if response.status == 200:
                    bundle = await response.json()
                    if bundle.get("resourceType") == "Bundle":
                        total = bundle.get("total", 0)
                        entries = len(bundle.get("entry", []))
                        self.log_test(test_name, True, f"Found {total} total, {entries} entries", time.time() - start_time)
                    else:
                        self.log_test(test_name, False, "Response is not a Bundle", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(test_name, False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(test_name, False, f"Error: {str(e)}", time.time() - start_time)
    
    async def test_chained_queries(self):
        """Test chained queries and reference resolution"""
        chained_tests = [
            ("Observation by Patient name", "Observation", {"subject:Patient.name": "Smith"}),
            ("Condition by Patient gender", "Condition", {"subject:Patient.gender": "male"}),
            ("DiagnosticReport by Patient birthdate", "DiagnosticReport", {"subject:Patient.birthdate": "1990-01-01"}),
        ]
        
        for test_name, resource_type, params in chained_tests:
            await self._test_search_operation(test_name, resource_type, params)
    
    async def test_bundle_operations(self):
        """Test bundle operations including batch and transaction"""
        # Test batch bundle
        batch_bundle = {
            "resourceType": "Bundle",
            "type": "batch",
            "entry": [
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "BatchTest", "given": ["John"]}],
                        "gender": "male"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "BatchTest", "given": ["Jane"]}],
                        "gender": "female"
                    }
                }
            ]
        }
        
        await self._test_bundle_operation("Batch Bundle", batch_bundle)
        
        # Test transaction bundle
        transaction_bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "request": {
                        "method": "POST",
                        "url": "Patient"
                    },
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"family": "TransactionTest", "given": ["Alice"]}],
                        "gender": "female"
                    }
                },
                {
                    "request": {
                        "method": "POST",
                        "url": "Observation"
                    },
                    "resource": {
                        "resourceType": "Observation",
                        "status": "final",
                        "code": {
                            "coding": [{"system": "http://loinc.org", "code": "8302-2", "display": "Body height"}]
                        },
                        "subject": {"reference": "Patient/TransactionTest"},
                        "valueQuantity": {
                            "value": 165,
                            "unit": "cm",
                            "system": "http://unitsofmeasure.org"
                        }
                    }
                }
            ]
        }
        
        await self._test_bundle_operation("Transaction Bundle", transaction_bundle)
    
    async def _test_bundle_operation(self, test_name: str, bundle: Dict[str, Any]):
        """Test a specific bundle operation"""
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.base_url}/fhir/R4/",  # Note the trailing slash for bundle endpoint
                json=bundle,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    result_bundle = await response.json()
                    entries = len(result_bundle.get("entry", []))
                    self.log_test(test_name, True, f"Processed {entries} entries", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(test_name, False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(test_name, False, f"Error: {str(e)}", time.time() - start_time)
    
    async def test_multi_version_support(self):
        """Test multi-version FHIR support"""
        versions = ["R4", "R5", "R6"]
        
        for version in versions:
            await self._test_version_support(version)
    
    async def _test_version_support(self, version: str):
        """Test support for a specific FHIR version"""
        start_time = time.time()
        try:
            # Test version-specific endpoint
            async with self.session.get(f"{self.base_url}/fhir/{version}/Patient") as response:
                if response.status == 200:
                    bundle = await response.json()
                    self.log_test(f"FHIR {version} Support", True, f"Retrieved bundle with {len(bundle.get('entry', []))} entries", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(f"FHIR {version} Support", False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(f"FHIR {version} Support", False, f"Error: {str(e)}", time.time() - start_time)
    
    async def test_content_negotiation(self):
        """Test content negotiation with Accept headers"""
        headers_tests = [
            ("FHIR JSON", {"Accept": "application/fhir+json"}),
            ("FHIR R4", {"Accept": "application/fhir+json; fhirVersion=4.0.1"}),
            ("FHIR R5", {"Accept": "application/fhir+json; fhirVersion=5.0.0"}),
            ("JSON", {"Accept": "application/json"}),
        ]
        
        for test_name, headers in headers_tests:
            await self._test_content_negotiation(test_name, headers)
    
    async def _test_content_negotiation(self, test_name: str, headers: Dict[str, str]):
        """Test content negotiation with specific headers"""
        start_time = time.time()
        try:
            async with self.session.get(f"{self.base_url}/fhir/Patient", headers=headers) as response:
                if response.status == 200:
                    content_type = response.headers.get("Content-Type", "")
                    bundle = await response.json()
                    self.log_test(test_name, True, f"Content-Type: {content_type}", time.time() - start_time)
                else:
                    error_text = await response.text()
                    self.log_test(test_name, False, f"HTTP {response.status}: {error_text}", time.time() - start_time)
        except Exception as e:
            self.log_test(test_name, False, f"Error: {str(e)}", time.time() - start_time)
    
    async def test_performance(self):
        """Test performance with concurrent requests"""
        start_time = time.time()
        
        # Create multiple concurrent requests
        tasks = []
        for i in range(10):
            task = self.session.get(f"{self.base_url}/fhir/R4/Patient")
            tasks.append(task)
        
        try:
            responses = await asyncio.gather(*[task.__aenter__() for task in tasks])
            
            success_count = sum(1 for response in responses if response.status == 200)
            
            # Clean up responses
            for response in responses:
                await response.__aexit__(None, None, None)
            
            duration = time.time() - start_time
            self.log_test("Performance (10 concurrent requests)", True, f"{success_count}/10 successful, {duration:.3f}s total", duration)
            
        except Exception as e:
            self.log_test("Performance (10 concurrent requests)", False, f"Error: {str(e)}", time.time() - start_time)
    
    async def cleanup_created_resources(self):
        """Clean up any resources created during testing"""
        print("\n🧹 Cleaning up created resources...")
        
        for resource_type, resource_id in self.created_resources:
            try:
                async with self.session.delete(f"{self.base_url}/fhir/R4/{resource_type}/{resource_id}") as response:
                    if response.status in [200, 204, 404]:  # 404 is OK if already deleted
                        print(f"   Deleted {resource_type}/{resource_id}")
                    else:
                        print(f"   Failed to delete {resource_type}/{resource_id}: HTTP {response.status}")
            except Exception as e:
                print(f"   Error deleting {resource_type}/{resource_id}: {e}")
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   - {result['test']}: {result['details']}")
        
        total_duration = sum(result["duration"] for result in self.test_results)
        print(f"\nTotal Duration: {total_duration:.3f}s")
        print(f"Average Duration: {(total_duration/total_tests):.3f}s per test")
        
        return passed_tests, failed_tests

async def main():
    """Run comprehensive FHIR API tests"""
    print("🏥 MedGenEMR FHIR API Comprehensive Testing")
    print("=" * 60)
    
    async with FHIRTestRunner() as test_runner:
        try:
            # Test server health first
            if not await test_runner.test_server_health():
                print("❌ Server is not responding. Please start the MedGenEMR backend first.")
                return 1
            
            print("\n🔍 Testing Basic CRUD Operations...")
            await test_runner.test_basic_crud_operations()
            
            print("\n🔍 Testing Search Operations...")
            await test_runner.test_search_operations()
            
            print("\n🔍 Testing Chained Queries...")
            await test_runner.test_chained_queries()
            
            print("\n🔍 Testing Bundle Operations...")
            await test_runner.test_bundle_operations()
            
            print("\n🔍 Testing Multi-Version Support...")
            await test_runner.test_multi_version_support()
            
            print("\n🔍 Testing Content Negotiation...")
            await test_runner.test_content_negotiation()
            
            print("\n🔍 Testing Performance...")
            await test_runner.test_performance()
            
            # Cleanup
            await test_runner.cleanup_created_resources()
            
        except Exception as e:
            print(f"❌ Test execution failed: {e}")
            traceback.print_exc()
            return 1
        
        finally:
            # Print summary
            passed, failed = test_runner.print_summary()
            return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))