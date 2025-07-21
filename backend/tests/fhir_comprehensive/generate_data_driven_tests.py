#!/usr/bin/env python3
"""
Generate data-driven tests based on actual Synthea data in the database.
Uses real data patterns to create comprehensive test cases.

Created: 2025-01-20
"""

import asyncio
import asyncpg
import json
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import random


class DataDrivenTestGenerator:
    """Generate tests based on actual data patterns."""
    
    def __init__(self, db_url: str, api_base_url: str):
        self.db_url = db_url
        self.api_base_url = api_base_url
        self.conn = None
        self.http_client = None
        self.test_cases = []
        self.test_results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    async def connect(self):
        """Connect to database and create HTTP client."""
        self.conn = await asyncpg.connect(self.db_url)
        self.http_client = httpx.AsyncClient(
            base_url=self.api_base_url,
            timeout=30.0
        )
    
    async def close(self):
        """Close connections."""
        if self.conn:
            await self.conn.close()
        if self.http_client:
            await self.http_client.aclose()
    
    async def generate_patient_search_tests(self):
        """Generate tests for Patient searches using real data."""
        print("\n📋 Generating Patient search tests...")
        
        # Get actual patient data
        query = """
        SELECT 
            fhir_id,
            resource->>'gender' as gender,
            resource->>'birthDate' as birth_date,
            resource->'name'->0->>'family' as family_name,
            resource->'name'->0->'given'->0::text as given_name,
            resource->'identifier'->0->>'value' as identifier,
            resource->'address'->0->>'city' as city,
            resource->'address'->0->>'state' as state,
            resource->>'deceasedDateTime' as deceased_date
        FROM fhir.resources
        WHERE resource_type = 'Patient'
        AND (deleted = false OR deleted IS NULL)
        """
        
        patients = await self.conn.fetch(query)
        
        # Generate test cases based on actual data
        test_cases = []
        
        # Test 1: Search by exact family name
        if patients:
            patient = patients[0]
            if patient['family_name']:
                test_cases.append({
                    "name": "search_by_family_name",
                    "description": f"Search patient by family name: {patient['family_name']}",
                    "query": f"/Patient?family={patient['family_name']}",
                    "expected": {
                        "min_count": 1,
                        "contains_id": patient['fhir_id'],
                        "all_have_family": patient['family_name']
                    }
                })
        
        # Test 2: Search by gender
        genders = await self.conn.fetch("""
            SELECT DISTINCT resource->>'gender' as gender, COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND resource->>'gender' IS NOT NULL
            GROUP BY gender
        """)
        
        for gender_row in genders:
            gender = gender_row['gender']
            count = gender_row['count']
            test_cases.append({
                "name": f"search_by_gender_{gender}",
                "description": f"Search patients by gender: {gender}",
                "query": f"/Patient?gender={gender}",
                "expected": {
                    "exact_count": count,
                    "all_have_gender": gender
                }
            })
        
        # Test 3: Search by birth date range
        birth_range = await self.conn.fetchrow("""
            SELECT 
                MIN(resource->>'birthDate') as min_date,
                MAX(resource->>'birthDate') as max_date
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND resource->>'birthDate' IS NOT NULL
        """)
        
        if birth_range['min_date'] and birth_range['max_date']:
            # Test date range
            mid_date = birth_range['min_date'][:4] + "-01-01"
            test_cases.append({
                "name": "search_by_birthdate_range",
                "description": f"Search patients born after {mid_date}",
                "query": f"/Patient?birthdate=ge{mid_date}",
                "expected": {
                    "min_count": 1,
                    "all_birthdate_after": mid_date
                }
            })
        
        # Test 4: Missing parameter - deceased patients
        deceased_count = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources
            WHERE resource_type = 'Patient'
            AND resource->>'deceasedDateTime' IS NOT NULL
        """)
        
        living_count = len(patients) - deceased_count
        
        test_cases.append({
            "name": "search_living_patients",
            "description": "Search for living patients (death-date:missing=true)",
            "query": "/Patient?death-date:missing=true",
            "expected": {
                "exact_count": living_count,
                "none_have_deceased": True
            }
        })
        
        # Test 5: Combined parameters
        if patients and len(patients) > 0:
            patient = patients[0]
            if patient['gender'] and patient['state']:
                test_cases.append({
                    "name": "search_combined_gender_state",
                    "description": f"Search by gender={patient['gender']} AND state={patient['state']}",
                    "query": f"/Patient?gender={patient['gender']}&address-state={patient['state']}",
                    "expected": {
                        "min_count": 1,
                        "all_have_gender": patient['gender'],
                        "all_have_state": patient['state']
                    }
                })
        
        return test_cases
    
    async def generate_observation_search_tests(self):
        """Generate tests for Observation searches using real data."""
        print("\n🔬 Generating Observation search tests...")
        
        # Get common observation codes
        codes = await self.conn.fetch("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->>'text' as display,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code, display
            ORDER BY count DESC
            LIMIT 5
        """)
        
        test_cases = []
        
        # Test by code
        for code_row in codes:
            code = code_row['code']
            display = code_row['display']
            count = code_row['count']
            
            test_cases.append({
                "name": f"search_observation_by_code_{code}",
                "description": f"Search observations by code {code} ({display})",
                "query": f"/Observation?code={code}",
                "expected": {
                    "exact_count": count,
                    "all_have_code": code
                }
            })
        
        # Test by patient
        patient_obs = await self.conn.fetchrow("""
            SELECT 
                resource->>'subject' as subject_ref,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->>'subject' IS NOT NULL
            GROUP BY subject_ref
            ORDER BY count DESC
            LIMIT 1
        """)
        
        if patient_obs:
            subject_ref = patient_obs['subject_ref']
            # Extract patient ID from reference
            if '/' in subject_ref:
                patient_id = subject_ref.split('/')[-1]
            else:
                patient_id = subject_ref.replace('urn:uuid:', '')
            
            test_cases.append({
                "name": "search_observations_by_patient",
                "description": f"Search observations for patient {patient_id}",
                "query": f"/Observation?patient={patient_id}",
                "expected": {
                    "exact_count": patient_obs['count'],
                    "all_have_patient": patient_id
                }
            })
        
        # Test date range
        date_range = await self.conn.fetchrow("""
            SELECT 
                MIN(resource->>'effectiveDateTime') as min_date,
                MAX(resource->>'effectiveDateTime') as max_date
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->>'effectiveDateTime' IS NOT NULL
        """)
        
        if date_range['min_date'] and date_range['max_date']:
            # Test observations from last year
            last_year = "2024-01-01"
            test_cases.append({
                "name": "search_observations_by_date",
                "description": f"Search observations after {last_year}",
                "query": f"/Observation?date=ge{last_year}",
                "expected": {
                    "min_count": 1,
                    "all_date_after": last_year
                }
            })
        
        return test_cases
    
    async def generate_condition_search_tests(self):
        """Generate tests for Condition searches using real data."""
        print("\n🏥 Generating Condition search tests...")
        
        # Get condition statistics
        conditions = await self.conn.fetch("""
            SELECT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->>'text' as display,
                resource->'clinicalStatus'->'coding'->0->>'code' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            GROUP BY code, display, status
            ORDER BY count DESC
            LIMIT 5
        """)
        
        test_cases = []
        
        # Test by clinical status
        statuses = await self.conn.fetch("""
            SELECT 
                resource->'clinicalStatus'->'coding'->0->>'code' as status,
                COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Condition'
            AND resource->'clinicalStatus'->'coding'->0->>'code' IS NOT NULL
            GROUP BY status
        """)
        
        for status_row in statuses:
            status = status_row['status']
            count = status_row['count']
            
            test_cases.append({
                "name": f"search_conditions_by_status_{status}",
                "description": f"Search conditions with clinical status: {status}",
                "query": f"/Condition?clinical-status={status}",
                "expected": {
                    "exact_count": count,
                    "all_have_status": status
                }
            })
        
        return test_cases
    
    async def generate_reference_search_tests(self):
        """Generate tests for reference searches using actual relationships."""
        print("\n🔗 Generating reference search tests...")
        
        test_cases = []
        
        # Find a patient with multiple resource types
        patient_resources = await self.conn.fetchrow("""
            SELECT 
                c.compartment_id as patient_id,
                COUNT(DISTINCT r.resource_type) as resource_types,
                COUNT(*) as total_resources
            FROM fhir.compartments c
            JOIN fhir.resources r ON r.id = c.resource_id
            WHERE c.compartment_type = 'Patient'
            GROUP BY c.compartment_id
            ORDER BY total_resources DESC
            LIMIT 1
        """)
        
        if patient_resources:
            patient_id = patient_resources['patient_id']
            
            # Test various reference formats
            test_cases.append({
                "name": "test_reference_formats",
                "description": f"Test different reference formats for patient {patient_id}",
                "variations": [
                    {
                        "query": f"/Condition?patient={patient_id}",
                        "format": "relative"
                    },
                    {
                        "query": f"/Condition?patient=Patient/{patient_id}",
                        "format": "full"
                    },
                    {
                        "query": f"/Condition?subject={patient_id}",
                        "format": "subject_relative"
                    },
                    {
                        "query": f"/Condition?subject=Patient/{patient_id}",
                        "format": "subject_full"
                    }
                ],
                "expected": {
                    "all_same_count": True,
                    "min_count": 1
                }
            })
        
        return test_cases
    
    async def run_test_case(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single test case."""
        result = {
            "name": test_case["name"],
            "description": test_case["description"],
            "status": "pending",
            "errors": []
        }
        
        try:
            if "variations" in test_case:
                # Handle multi-variation tests
                counts = []
                for variation in test_case["variations"]:
                    response = await self.http_client.get(variation["query"])
                    if response.status_code != 200:
                        result["errors"].append(f"Query {variation['query']} returned {response.status_code}")
                        continue
                    
                    bundle = response.json()
                    counts.append(bundle.get("total", 0))
                
                # Check if all variations return same count
                if test_case["expected"].get("all_same_count") and len(set(counts)) > 1:
                    result["errors"].append(f"Different counts returned: {counts}")
                
                if min(counts) < test_case["expected"].get("min_count", 0):
                    result["errors"].append(f"Count too low: {min(counts)}")
            
            else:
                # Single query test
                response = await self.http_client.get(test_case["query"])
                
                if response.status_code != 200:
                    result["errors"].append(f"HTTP {response.status_code}")
                    result["status"] = "failed"
                    return result
                
                bundle = response.json()
                total = bundle.get("total", 0)
                
                # Check expected results
                expected = test_case["expected"]
                
                if "exact_count" in expected and total != expected["exact_count"]:
                    result["errors"].append(f"Expected {expected['exact_count']} results, got {total}")
                
                if "min_count" in expected and total < expected["min_count"]:
                    result["errors"].append(f"Expected at least {expected['min_count']} results, got {total}")
                
                # Validate resource contents
                if "entry" in bundle:
                    for entry in bundle["entry"]:
                        resource = entry["resource"]
                        
                        # Check specific field values
                        if "all_have_gender" in expected:
                            if resource.get("gender") != expected["all_have_gender"]:
                                result["errors"].append(f"Resource {resource['id']} has wrong gender")
                        
                        if "all_have_code" in expected:
                            code = resource.get("code", {}).get("coding", [{}])[0].get("code")
                            if code != expected["all_have_code"]:
                                result["errors"].append(f"Resource {resource['id']} has wrong code")
                        
                        if "none_have_deceased" in expected:
                            if "deceasedDateTime" in resource or "deceasedBoolean" in resource:
                                result["errors"].append(f"Resource {resource['id']} has deceased info")
            
            result["status"] = "passed" if not result["errors"] else "failed"
            
        except Exception as e:
            result["errors"].append(f"Exception: {str(e)}")
            result["status"] = "error"
        
        return result
    
    async def generate_and_run_all_tests(self):
        """Generate and run all test cases."""
        await self.connect()
        
        try:
            # Generate test cases
            all_test_cases = []
            
            all_test_cases.extend(await self.generate_patient_search_tests())
            all_test_cases.extend(await self.generate_observation_search_tests())
            all_test_cases.extend(await self.generate_condition_search_tests())
            all_test_cases.extend(await self.generate_reference_search_tests())
            
            print(f"\n🚀 Running {len(all_test_cases)} test cases...\n")
            
            # Run tests
            for test_case in all_test_cases:
                result = await self.run_test_case(test_case)
                
                if result["status"] == "passed":
                    print(f"✅ {result['name']}: PASSED")
                    self.test_results["passed"] += 1
                else:
                    print(f"❌ {result['name']}: FAILED")
                    if result["errors"]:
                        for error in result["errors"]:
                            print(f"   - {error}")
                    self.test_results["failed"] += 1
                    self.test_results["errors"].append(result)
            
            # Generate report
            self.generate_report()
            
        finally:
            await self.close()
    
    def generate_report(self):
        """Generate test report."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total": self.test_results["passed"] + self.test_results["failed"],
                "passed": self.test_results["passed"],
                "failed": self.test_results["failed"],
                "pass_rate": self.test_results["passed"] / (self.test_results["passed"] + self.test_results["failed"]) * 100
            },
            "failed_tests": self.test_results["errors"]
        }
        
        # Save report
        with open('/app/tests/fhir_comprehensive/reports/data_driven_test_results.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📊 Test Summary:")
        print(f"   Total: {report['summary']['total']}")
        print(f"   Passed: {report['summary']['passed']}")
        print(f"   Failed: {report['summary']['failed']}")
        print(f"   Pass Rate: {report['summary']['pass_rate']:.1f}%")
        
        if self.test_results["failed"] > 0:
            print(f"\n❌ Failed Tests:")
            for error in self.test_results["errors"]:
                print(f"   - {error['name']}: {', '.join(error['errors'])}")


async def main():
    """Run the data-driven test generator."""
    db_url = "postgresql://emr_user:emr_password@postgres:5432/emr_db"
    api_url = "http://localhost:8000/fhir/R4"
    
    generator = DataDrivenTestGenerator(db_url, api_url)
    await generator.generate_and_run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())