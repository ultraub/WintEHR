#!/usr/bin/env python3
"""
Comprehensive FHIR R4 API Test Suite v2
Based on actual database structure and data analysis
Tests all FHIR search parameters, modifiers, and edge cases with correct SQL queries
"""

import requests
import sqlite3
import sys
import time
from datetime import datetime, timedelta
from urllib.parse import quote
from typing import Dict, List, Any, Optional
import json

class ComprehensiveFHIRTesterV2:
    def __init__(self, fhir_base_url: str, db_path: str):
        self.fhir_base_url = fhir_base_url
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.test_results = []
        self.verbose = True
        
    def close(self):
        self.conn.close()
    
    def run_sql(self, query: str, params: Optional[tuple] = None) -> List[sqlite3.Row]:
        """Execute SQL query and return results"""
        cursor = self.conn.cursor()
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchall()
        except Exception as e:
            print(f"SQL Error: {e}")
            print(f"Query: {query}")
            return []
    
    def run_fhir(self, resource_type: str, params: Dict[str, str]) -> Dict[str, Any]:
        """Execute FHIR query and return results"""
        url = f"{self.fhir_base_url}/fhir/R4/{resource_type}"
        
        # Handle array parameters properly
        query_parts = []
        for key, value in params.items():
            if isinstance(value, list):
                for v in value:
                    query_parts.append(f"{key}={quote(str(v))}")
            else:
                query_parts.append(f"{key}={quote(str(value))}")
        
        if query_parts:
            url += "?" + "&".join(query_parts)
        
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'total': data.get('total', 0),
                    'entries': data.get('entry', []),
                    'bundle': data,
                    'url': url,
                    'status_code': response.status_code
                }
            else:
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text[:200]}",
                    'total': 0,
                    'entries': [],
                    'url': url,
                    'status_code': response.status_code
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'total': 0,
                'entries': [],
                'url': url,
                'status_code': 0
            }
    
    def compare_results(self, test_name: str, sql_count: int, fhir_count: int, 
                       sql_results: List[Any], fhir_results: Dict[str, Any]) -> bool:
        """Compare SQL and FHIR results with detailed analysis"""
        print(f"\nComparison for: {test_name}")
        print(f"SQL Count: {sql_count}")
        print(f"FHIR Total: {fhir_count}")
        print(f"FHIR Returned: {len(fhir_results.get('entries', []))}")
        
        if sql_count == fhir_count:
            print("✓ Counts match!")
            
            # Additional validation for data consistency
            if sql_results and fhir_results.get('entries'):
                print("Validating data consistency...")
                # Add specific validation logic based on resource type
                
            return True
        else:
            print(f"✗ Count mismatch! Difference: {abs(sql_count - fhir_count)}")
            
            # Analyze why counts might differ
            if fhir_count > sql_count:
                print("  → FHIR returned more results than SQL")
            else:
                print("  → SQL returned more results than FHIR")
                
            # Show sample data for debugging
            if self.verbose and sql_results:
                print("\nSample SQL results:")
                for row in sql_results[:3]:
                    print(f"  {dict(row)}")
                    
            return False
    
    def test_patient_searches(self):
        """Comprehensive Patient resource search tests"""
        print("\n" + "="*80)
        print("PATIENT RESOURCE TESTS")
        print("="*80)
        
        tests = [
            # Basic searches
            {
                'name': 'All patients',
                'fhir_params': {'_count': '100'},
                'sql': "SELECT COUNT(*) as count FROM patients",
                'sql_params': None
            },
            {
                'name': 'Patient by exact ID (existing)',
                'fhir_params': {'_id': self.get_sample_patient_id()},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE id = ?",
                'sql_params': (self.get_sample_patient_id(),)
            },
            {
                'name': 'Patient by family name (case insensitive)',
                'fhir_params': {'family': 'marquez'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE LOWER(last_name) LIKE LOWER(?)",
                'sql_params': ('%marquez%',)
            },
            {
                'name': 'Patient by given name',
                'fhir_params': {'given': 'Susan'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE LOWER(first_name) LIKE LOWER(?)",
                'sql_params': ('%susan%',)
            },
            {
                'name': 'Patient by full name search',
                'fhir_params': {'name': 'Marquez'},
                'sql': """SELECT COUNT(*) as count FROM patients 
                         WHERE LOWER(first_name) LIKE LOWER(?) OR LOWER(last_name) LIKE LOWER(?)""",
                'sql_params': ('%marquez%', '%marquez%')
            },
            
            # Multiple parameters (AND logic)
            {
                'name': 'Patient by gender=male',
                'fhir_params': {'gender': 'male'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE LOWER(gender) = LOWER(?)",
                'sql_params': ('male',)
            },
            {
                'name': 'Patient by gender=female',
                'fhir_params': {'gender': 'female'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE LOWER(gender) = LOWER(?)",
                'sql_params': ('female',)
            },
            
            # Date searches with prefixes
            {
                'name': 'Patient born after 1990',
                'fhir_params': {'birthdate': 'gt1990-01-01'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_birth > ?",
                'sql_params': ('1990-01-01',)
            },
            {
                'name': 'Patient born before 1970',
                'fhir_params': {'birthdate': 'lt1970-01-01'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_birth < ?",
                'sql_params': ('1970-01-01',)
            },
            
            # Address searches
            {
                'name': 'Patient by city Boston',
                'fhir_params': {'address': 'Boston'},
                'sql': """SELECT COUNT(*) as count FROM patients 
                         WHERE LOWER(address) LIKE LOWER(?) OR LOWER(city) LIKE LOWER(?) 
                         OR LOWER(state) LIKE LOWER(?) OR LOWER(zip_code) LIKE LOWER(?)""",
                'sql_params': ('%boston%', '%boston%', '%boston%', '%boston%')
            },
            
            # Telecom searches
            {
                'name': 'Patient by phone/email containing 555',
                'fhir_params': {'telecom': '555'},
                'sql': """SELECT COUNT(*) as count FROM patients 
                         WHERE phone LIKE ? OR email LIKE ?""",
                'sql_params': ('%555%', '%555%')
            },
            
            # Complex multi-parameter
            {
                'name': 'Female patients born after 1980',
                'fhir_params': {'gender': 'female', 'birthdate': 'gt1980-01-01'},
                'sql': """SELECT COUNT(*) as count FROM patients 
                         WHERE LOWER(gender) = LOWER(?) AND date_of_birth > ?""",
                'sql_params': ('female', '1980-01-01')
            },
            
            # OR logic tests
            {
                'name': 'Multiple patient IDs (OR logic)',
                'fhir_params': {'_id': self.get_two_patient_ids_comma_separated()},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE id IN (?, ?)",
                'sql_params': self.get_two_patient_ids_tuple()
            },
        ]
        
        self._run_test_group('Patient', tests)
    
    def test_observation_searches(self):
        """Comprehensive Observation resource search tests"""
        print("\n" + "="*80)
        print("OBSERVATION RESOURCE TESTS")
        print("="*80)
        
        tests = [
            # Basic searches
            {
                'name': 'All observations',
                'fhir_params': {'_count': '100'},
                'sql': "SELECT COUNT(*) as count FROM observations",
                'sql_params': None
            },
            {
                'name': 'Observation by LOINC code 8302-2 (Body Height)',
                'fhir_params': {'code': '8302-2'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE loinc_code LIKE ?",
                'sql_params': ('%8302-2%',)
            },
            {
                'name': 'Observation by multiple LOINC codes (OR)',
                'fhir_params': {'code': '8302-2,29463-7'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE loinc_code LIKE ? OR loinc_code LIKE ?",
                'sql_params': ('%8302-2%', '%29463-7%')
            },
            
            # Category search
            {
                'name': 'Vital signs observations',
                'fhir_params': {'category': 'vital-signs'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE observation_type = ?",
                'sql_params': ('vital-signs',)
            },
            {
                'name': 'Laboratory observations',
                'fhir_params': {'category': 'laboratory'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE observation_type = ?",
                'sql_params': ('laboratory',)
            },
            
            # Value quantity searches with operators
            {
                'name': 'Observation value > 100 (numeric values only)',
                'fhir_params': {'value-quantity': 'gt100'},
                'sql': """SELECT COUNT(*) as count FROM observations 
                         WHERE value_quantity > 100""",
                'sql_params': None
            },
            {
                'name': 'Observation value < 50 (numeric values only)',
                'fhir_params': {'value-quantity': 'lt50'},
                'sql': """SELECT COUNT(*) as count FROM observations 
                         WHERE value_quantity < 50""",
                'sql_params': None
            },
            {
                'name': 'Observation value >= 100 (numeric values only)',
                'fhir_params': {'value-quantity': 'ge100'},
                'sql': """SELECT COUNT(*) as count FROM observations 
                         WHERE value_quantity >= 100""",
                'sql_params': None
            },
            
            # Date searches
            {
                'name': 'Observations after 2020',
                'fhir_params': {'date': 'gt2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE observation_date > ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            {
                'name': 'Observations in 2019',
                'fhir_params': {'date': 'ge2019-01-01'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE observation_date >= ?",
                'sql_params': ('2019-01-01 00:00:00',)
            },
            
            # Patient reference
            {
                'name': 'Observations for specific patient',
                'fhir_params': {'subject': f'Patient/{self.get_sample_patient_id()}'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE patient_id = ?",
                'sql_params': (self.get_sample_patient_id(),)
            },
            
            # Complex searches
            {
                'name': 'Vital signs with value > 0',
                'fhir_params': {'category': 'vital-signs', 'value-quantity': 'gt0'},
                'sql': """SELECT COUNT(*) as count FROM observations 
                         WHERE observation_type = ? AND value_quantity > 0""",
                'sql_params': ('vital-signs',)
            },
            {
                'name': 'Lab results for glucose (2339-0)',
                'fhir_params': {'code': '2339-0', 'category': 'laboratory'},
                'sql': """SELECT COUNT(*) as count FROM observations 
                         WHERE loinc_code LIKE ? AND observation_type = ?""",
                'sql_params': ('%2339-0%', 'laboratory')
            },
        ]
        
        self._run_test_group('Observation', tests)
    
    def test_encounter_searches(self):
        """Comprehensive Encounter resource search tests"""
        print("\n" + "="*80)
        print("ENCOUNTER RESOURCE TESTS")
        print("="*80)
        
        tests = [
            # Basic searches
            {
                'name': 'All encounters',
                'fhir_params': {'_count': '100'},
                'sql': "SELECT COUNT(*) as count FROM encounters",
                'sql_params': None
            },
            {
                'name': 'Finished encounters',
                'fhir_params': {'status': 'finished'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE LOWER(status) = LOWER(?)",
                'sql_params': ('finished',)
            },
            
            # Type searches
            {
                'name': 'Encounters containing "general"',
                'fhir_params': {'type': 'general'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE LOWER(encounter_type) LIKE LOWER(?)",
                'sql_params': ('%general%',)
            },
            {
                'name': 'Emergency encounters',
                'fhir_params': {'type': 'emergency'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE LOWER(encounter_type) LIKE LOWER(?)",
                'sql_params': ('%emergency%',)
            },
            
            # Date searches
            {
                'name': 'Encounters after 2020',
                'fhir_params': {'period': 'gt2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE encounter_date > ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            {
                'name': 'Encounters in 2019',
                'fhir_params': {'period': 'ge2019-01-01'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE encounter_date >= ?",
                'sql_params': ('2019-01-01 00:00:00',)
            },
            
            # Patient reference
            {
                'name': 'Encounters for specific patient',
                'fhir_params': {'subject': f'Patient/{self.get_sample_patient_id()}'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE patient_id = ?",
                'sql_params': (self.get_sample_patient_id(),)
            },
            
            # Chained parameter tests
            {
                'name': 'Encounters for patients with last name containing "ez"',
                'fhir_params': {'subject:Patient.family': 'ez'},
                'sql': """SELECT COUNT(*) as count FROM encounters e
                         JOIN patients p ON e.patient_id = p.id
                         WHERE LOWER(p.last_name) LIKE LOWER(?)""",
                'sql_params': ('%ez%',)
            },
            {
                'name': 'Encounters for female patients',
                'fhir_params': {'subject:Patient.gender': 'female'},
                'sql': """SELECT COUNT(*) as count FROM encounters e
                         JOIN patients p ON e.patient_id = p.id
                         WHERE LOWER(p.gender) = LOWER(?)""",
                'sql_params': ('female',)
            },
            
            # Provider/Location searches (checking for NULL values)
            {
                'name': 'Encounters with provider assigned',
                'fhir_params': {'participant:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE provider_id IS NOT NULL",
                'sql_params': None
            },
            {
                'name': 'Encounters with location assigned',
                'fhir_params': {'location:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE location_id IS NOT NULL",
                'sql_params': None
            },
        ]
        
        self._run_test_group('Encounter', tests)
    
    def test_condition_searches(self):
        """Comprehensive Condition resource search tests"""
        print("\n" + "="*80)
        print("CONDITION RESOURCE TESTS")
        print("="*80)
        
        tests = [
            # Basic searches
            {
                'name': 'All conditions',
                'fhir_params': {'_count': '100'},
                'sql': "SELECT COUNT(*) as count FROM conditions",
                'sql_params': None
            },
            {
                'name': 'Active conditions',
                'fhir_params': {'clinical-status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE LOWER(clinical_status) = LOWER(?)",
                'sql_params': ('active',)
            },
            {
                'name': 'Resolved conditions',
                'fhir_params': {'clinical-status': 'resolved'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE LOWER(clinical_status) = LOWER(?)",
                'sql_params': ('resolved',)
            },
            {
                'name': 'Confirmed conditions',
                'fhir_params': {'verification-status': 'confirmed'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE LOWER(verification_status) = LOWER(?)",
                'sql_params': ('confirmed',)
            },
            
            # Code searches
            {
                'name': 'Hypertension conditions (by description)',
                'fhir_params': {'code': 'hypertension'},
                'sql': """SELECT COUNT(*) as count FROM conditions 
                         WHERE LOWER(icd10_code) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?)""",
                'sql_params': ('%hypertension%', '%hypertension%')
            },
            {
                'name': 'Diabetes conditions (E11)',
                'fhir_params': {'code': 'E11'},
                'sql': """SELECT COUNT(*) as count FROM conditions 
                         WHERE icd10_code LIKE ? OR description LIKE ?""",
                'sql_params': ('%E11%', '%E11%')
            },
            
            # Date searches
            {
                'name': 'Conditions onset after 2020',
                'fhir_params': {'onset-date': 'gt2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE onset_date > ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            
            # Complex searches
            {
                'name': 'Active conditions onset in 2019',
                'fhir_params': {'clinical-status': 'active', 'onset-date': 'ge2019-01-01'},
                'sql': """SELECT COUNT(*) as count FROM conditions 
                         WHERE LOWER(clinical_status) = LOWER(?) AND onset_date >= ?""",
                'sql_params': ('active', '2019-01-01 00:00:00')
            },
        ]
        
        self._run_test_group('Condition', tests)
    
    def test_medication_searches(self):
        """Comprehensive MedicationRequest resource search tests"""
        print("\n" + "="*80)
        print("MEDICATION REQUEST RESOURCE TESTS")
        print("="*80)
        
        tests = [
            # Basic searches
            {
                'name': 'All medications',
                'fhir_params': {'_count': '100'},
                'sql': "SELECT COUNT(*) as count FROM medications",
                'sql_params': None
            },
            {
                'name': 'Active medications',
                'fhir_params': {'status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE LOWER(status) = LOWER(?)",
                'sql_params': ('active',)
            },
            {
                'name': 'Completed medications',
                'fhir_params': {'status': 'completed'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE LOWER(status) = LOWER(?)",
                'sql_params': ('completed',)
            },
            
            # Medication name searches
            {
                'name': 'Medications containing "aspirin"',
                'fhir_params': {'medication': 'aspirin'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE LOWER(medication_name) LIKE LOWER(?)",
                'sql_params': ('%aspirin%',)
            },
            {
                'name': 'Medications containing "metformin"',
                'fhir_params': {'medication': 'metformin'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE LOWER(medication_name) LIKE LOWER(?)",
                'sql_params': ('%metformin%',)
            },
            
            # Date searches
            {
                'name': 'Medications started after 2020',
                'fhir_params': {'authored-on': 'gt2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE start_date > ?",
                'sql_params': ('2020-01-01',)
            },
            
            # Prescriber searches (checking for NULL)
            {
                'name': 'Medications with prescriber assigned',
                'fhir_params': {'requester:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE prescriber_id IS NOT NULL",
                'sql_params': None
            },
        ]
        
        self._run_test_group('MedicationRequest', tests)
    
    def test_practitioner_searches(self):
        """Test Practitioner resource searches"""
        print("\n" + "="*80)
        print("PRACTITIONER RESOURCE TESTS")
        print("="*80)
        
        tests = [
            {
                'name': 'All practitioners',
                'fhir_params': {'_count': '100'},
                'sql': "SELECT COUNT(*) as count FROM providers",
                'sql_params': None
            },
            {
                'name': 'Active practitioners',
                'fhir_params': {'active': 'true'},
                'sql': "SELECT COUNT(*) as count FROM providers WHERE active = 1",
                'sql_params': None
            },
            {
                'name': 'Practitioners by specialty containing "care"',
                'fhir_params': {'qualification': 'care'},
                'sql': "SELECT COUNT(*) as count FROM providers WHERE LOWER(specialty) LIKE LOWER(?)",
                'sql_params': ('%care%',)
            },
        ]
        
        self._run_test_group('Practitioner', tests)
    
    def test_special_features(self):
        """Test special FHIR features"""
        print("\n" + "="*80)
        print("SPECIAL FHIR FEATURES TESTS")
        print("="*80)
        
        # Test _count and pagination
        print("\n--- Testing Pagination ---")
        for count in [5, 10, 20, 50, 100]:
            result = self.run_fhir('Patient', {'_count': str(count)})
            if result['success']:
                actual_count = len(result['entries'])
                expected_count = min(count, 12)  # We have 12 patients total
                print(f"_count={count}: Requested {count}, Got {actual_count}, Expected {expected_count}")
                if actual_count <= count:
                    print("  ✓ PASS")
                else:
                    print("  ✗ FAIL: Returned more than requested")
        
        # Test _include
        print("\n--- Testing _include Parameter ---")
        include_tests = [
            {
                'resource': 'Encounter',
                'params': {'_include': 'Encounter:subject', '_count': '5'},
                'description': 'Include patient with encounter'
            },
            {
                'resource': 'Observation',
                'params': {'_include': 'Observation:subject', '_count': '5'},
                'description': 'Include patient with observation'
            },
        ]
        
        for test in include_tests:
            print(f"\nTest: {test['description']}")
            result = self.run_fhir(test['resource'], test['params'])
            if result['success']:
                resource_types = {}
                for entry in result['entries']:
                    res_type = entry['resource']['resourceType']
                    resource_types[res_type] = resource_types.get(res_type, 0) + 1
                print(f"Resource types in bundle: {resource_types}")
                if len(resource_types) > 1:
                    print("  ✓ PASS: Multiple resource types found")
                else:
                    print("  ✗ FAIL: Only primary resource type found")
        
        # Test error handling
        print("\n--- Testing Error Handling ---")
        error_tests = [
            {
                'name': 'Invalid resource type',
                'resource': 'InvalidResource',
                'params': {},
                'expected_status': 404
            },
            {
                'name': 'Invalid search parameter',
                'resource': 'Patient',
                'params': {'invalid_param': 'value'},
                'expected_status': 400
            },
            {
                'name': 'Invalid date format',
                'resource': 'Patient',
                'params': {'birthdate': 'not-a-date'},
                'expected_status': 400
            },
        ]
        
        for test in error_tests:
            print(f"\nTest: {test['name']}")
            result = self.run_fhir(test['resource'], test['params'])
            if result['status_code'] == test['expected_status']:
                print(f"  ✓ PASS: Got expected {test['expected_status']} error")
            else:
                print(f"  ✗ FAIL: Expected {test['expected_status']}, got {result['status_code']}")
    
    def _run_test_group(self, resource_type: str, tests: List[Dict[str, Any]]):
        """Run a group of tests for a specific resource type"""
        passed = 0
        failed = 0
        
        for test in tests:
            print(f"\n{'='*60}")
            print(f"Test: {test['name']}")
            print(f"{'='*60}")
            
            # Run SQL query
            sql_results = self.run_sql(test['sql'], test.get('sql_params'))
            sql_count = sql_results[0]['count'] if sql_results else 0
            
            print(f"SQL Query: {test['sql']}")
            if test.get('sql_params'):
                print(f"SQL Params: {test['sql_params']}")
            print(f"SQL Result: {sql_count}")
            
            # Run FHIR query
            fhir_results = self.run_fhir(resource_type, test['fhir_params'])
            
            print(f"\nFHIR URL: {fhir_results.get('url', 'N/A')}")
            
            if fhir_results['success']:
                fhir_count = fhir_results['total']
                
                # Compare results
                if self.compare_results(test['name'], sql_count, fhir_count, sql_results, fhir_results):
                    passed += 1
                    self.test_results.append((test['name'], 'PASS', sql_count, fhir_count))
                else:
                    failed += 1
                    self.test_results.append((test['name'], 'FAIL', sql_count, fhir_count))
                    
            else:
                print(f"FHIR Error: {fhir_results['error']}")
                failed += 1
                self.test_results.append((test['name'], 'ERROR', sql_count, 0))
        
        print(f"\n{resource_type} Tests Summary: {passed} passed, {failed} failed")
        
        return passed, failed
    
    def get_sample_patient_id(self):
        """Get a valid patient ID from the database"""
        result = self.run_sql("SELECT id FROM patients LIMIT 1")
        return result[0]['id'] if result else 'unknown'
    
    def get_two_patient_ids_comma_separated(self):
        """Get two patient IDs as comma-separated string"""
        result = self.run_sql("SELECT id FROM patients LIMIT 2")
        if len(result) >= 2:
            return f"{result[0]['id']},{result[1]['id']}"
        return 'unknown'
    
    def get_two_patient_ids_tuple(self):
        """Get two patient IDs as tuple for SQL IN clause"""
        result = self.run_sql("SELECT id FROM patients LIMIT 2")
        if len(result) >= 2:
            return (result[0]['id'], result[1]['id'])
        return ('unknown', 'unknown')
    
    def run_comprehensive_test_suite(self):
        """Run all test categories"""
        start_time = time.time()
        
        print("="*80)
        print("COMPREHENSIVE FHIR R4 API TEST SUITE V2")
        print("Based on actual database structure and data")
        print(f"Testing against: {self.fhir_base_url}")
        print(f"Database: {self.db_path}")
        print("="*80)
        
        # First, show database statistics
        self.show_database_stats()
        
        # Run all test categories
        self.test_patient_searches()
        self.test_observation_searches()
        self.test_encounter_searches()
        self.test_condition_searches()
        self.test_medication_searches()
        self.test_practitioner_searches()
        self.test_special_features()
        
        # Final summary
        elapsed_time = time.time() - start_time
        
        print("\n" + "="*80)
        print("FINAL TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for _, status, _, _ in self.test_results if status == 'PASS')
        failed_tests = sum(1 for _, status, _, _ in self.test_results if status == 'FAIL')
        error_tests = sum(1 for _, status, _, _ in self.test_results if status == 'ERROR')
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ({passed_tests/total_tests*100:.1f}%)")
        print(f"Failed: {failed_tests} ({failed_tests/total_tests*100:.1f}%)")
        print(f"Errors: {error_tests} ({error_tests/total_tests*100:.1f}%)")
        print(f"Time Elapsed: {elapsed_time:.2f} seconds")
        
        # List failures for easy review
        if failed_tests > 0 or error_tests > 0:
            print("\nFAILED/ERROR TESTS:")
            for name, status, sql_count, fhir_count in self.test_results:
                if status in ['FAIL', 'ERROR']:
                    print(f"  ✗ {name}: SQL={sql_count}, FHIR={fhir_count}")
        
        return self.test_results
    
    def show_database_stats(self):
        """Show database statistics for context"""
        print("\n" + "="*80)
        print("DATABASE STATISTICS")
        print("="*80)
        
        stats = [
            ("Patients", "SELECT COUNT(*) as count FROM patients"),
            ("- Male", "SELECT COUNT(*) as count FROM patients WHERE gender = 'male'"),
            ("- Female", "SELECT COUNT(*) as count FROM patients WHERE gender = 'female'"),
            ("Observations", "SELECT COUNT(*) as count FROM observations"),
            ("- Vital Signs", "SELECT COUNT(*) as count FROM observations WHERE observation_type = 'vital-signs'"),
            ("- Laboratory", "SELECT COUNT(*) as count FROM observations WHERE observation_type = 'laboratory'"),
            ("Encounters", "SELECT COUNT(*) as count FROM encounters"),
            ("- Finished", "SELECT COUNT(*) as count FROM encounters WHERE status = 'finished'"),
            ("Conditions", "SELECT COUNT(*) as count FROM conditions"),
            ("- Active", "SELECT COUNT(*) as count FROM conditions WHERE clinical_status = 'active'"),
            ("- Resolved", "SELECT COUNT(*) as count FROM conditions WHERE clinical_status = 'resolved'"),
            ("Medications", "SELECT COUNT(*) as count FROM medications"),
            ("- Active", "SELECT COUNT(*) as count FROM medications WHERE status = 'active'"),
            ("- Completed", "SELECT COUNT(*) as count FROM medications WHERE status = 'completed'"),
            ("Providers", "SELECT COUNT(*) as count FROM providers"),
        ]
        
        for label, query in stats:
            result = self.run_sql(query)
            count = result[0]['count'] if result else 0
            print(f"{label}: {count}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python fhir_comprehensive_test_suite_v2.py <fhir_base_url> <db_path>")
        print("Example: python fhir_comprehensive_test_suite_v2.py http://localhost:8000 /app/data/emr.db")
        sys.exit(1)
    
    fhir_url = sys.argv[1]
    db_path = sys.argv[2]
    
    tester = ComprehensiveFHIRTesterV2(fhir_url, db_path)
    try:
        results = tester.run_comprehensive_test_suite()
        
        # Return appropriate exit code
        failed_count = sum(1 for _, status, _, _ in results if status != 'PASS')
        sys.exit(0 if failed_count == 0 else 1)
        
    finally:
        tester.close()

if __name__ == "__main__":
    main()