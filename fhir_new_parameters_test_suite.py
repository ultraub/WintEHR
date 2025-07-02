#!/usr/bin/env python3
"""
FHIR R4 New Search Parameters Test Suite
Tests all newly added search parameters to ensure they work correctly
"""

import requests
import json
import sys
import sqlite3
from datetime import datetime
from termcolor import colored
from typing import Dict, List, Optional, Any

class FHIRNewParametersTestSuite:
    def __init__(self, fhir_base_url: str, db_path: str):
        self.fhir_base_url = fhir_base_url.rstrip('/')
        self.db_path = db_path
        self.test_results = {"passed": 0, "failed": 0}
        
    def test_patient_new_parameters(self):
        """Test newly added Patient search parameters"""
        print(colored("\n" + "="*80, "blue"))
        print(colored("PATIENT NEW SEARCH PARAMETERS TESTS", "blue", attrs=["bold"]))
        print(colored("="*80, "blue"))
        
        tests = [
            {
                'name': 'Patient active=true',
                'fhir_params': {'active': 'true'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE is_active = 1",
                'sql_params': ()
            },
            {
                'name': 'Patient active=false',
                'fhir_params': {'active': 'false'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE is_active = 0",
                'sql_params': ()
            },
            {
                'name': 'Patient by city (address-city)',
                'fhir_params': {'address-city': 'Boston'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE city LIKE ?",
                'sql_params': ('%Boston%',)
            },
            {
                'name': 'Patient by state (address-state)',
                'fhir_params': {'address-state': 'Massachusetts'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE state LIKE ?",
                'sql_params': ('%Massachusetts%',)
            },
            {
                'name': 'Patient by postal code (address-postalcode)',
                'fhir_params': {'address-postalcode': '02135'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE zip_code LIKE ?",
                'sql_params': ('%02135%',)
            },
            {
                'name': 'Patient deceased=true',
                'fhir_params': {'deceased': 'true'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_death IS NOT NULL",
                'sql_params': ()
            },
            {
                'name': 'Patient deceased=false',
                'fhir_params': {'deceased': 'false'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_death IS NULL",
                'sql_params': ()
            },
            {
                'name': 'Patient deceased:missing=true',
                'fhir_params': {'deceased:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_death IS NULL",
                'sql_params': ()
            },
            {
                'name': 'Patient deceased:missing=false',
                'fhir_params': {'deceased:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_death IS NOT NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Patient")
            
    def test_encounter_new_parameters(self):
        """Test newly added Encounter search parameters"""
        print(colored("\n" + "="*80, "blue"))
        print(colored("ENCOUNTER NEW SEARCH PARAMETERS TESTS", "blue", attrs=["bold"]))
        print(colored("="*80, "blue"))
        
        tests = [
            {
                'name': 'Encounter by class=ambulatory',
                'fhir_params': {'class': 'ambulatory'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE encounter_class = ?",
                'sql_params': ('ambulatory',)
            },
            {
                'name': 'Encounter by class=AMB',
                'fhir_params': {'class': 'AMB'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE encounter_class = ?",
                'sql_params': ('AMB',)
            },
            {
                'name': 'Encounter by reason-code (chief complaint)',
                'fhir_params': {'reason-code': 'pain'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE chief_complaint LIKE ?",
                'sql_params': ('%pain%',)
            },
            {
                'name': 'Encounter by service-provider (organization)',
                'fhir_params': {'service-provider:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE organization_id IS NULL",
                'sql_params': ()
            },
            {
                'name': 'Encounter by service-provider:missing=false',
                'fhir_params': {'service-provider:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE organization_id IS NOT NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Encounter")
            
    def test_observation_new_parameters(self):
        """Test newly added Observation search parameters"""
        print(colored("\n" + "="*80, "blue"))
        print(colored("OBSERVATION NEW SEARCH PARAMETERS TESTS", "blue", attrs=["bold"]))
        print(colored("="*80, "blue"))
        
        tests = [
            {
                'name': 'Observation by status=final',
                'fhir_params': {'status': 'final'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE status = ?",
                'sql_params': ('final',)
            },
            {
                'name': 'Observation by performer:missing=true',
                'fhir_params': {'performer:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE provider_id IS NULL",
                'sql_params': ()
            },
            {
                'name': 'Observation by performer:missing=false',
                'fhir_params': {'performer:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE provider_id IS NOT NULL",
                'sql_params': ()
            },
            {
                'name': 'Observation by encounter:missing=true',
                'fhir_params': {'encounter:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE encounter_id IS NULL",
                'sql_params': ()
            },
            {
                'name': 'Observation by encounter:missing=false',
                'fhir_params': {'encounter:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE encounter_id IS NOT NULL",
                'sql_params': ()
            },
            {
                'name': 'Observation by value-string',
                'fhir_params': {'value-string': 'positive'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE value LIKE ?",
                'sql_params': ('%positive%',)
            },
            {
                'name': 'Observation by value-concept',
                'fhir_params': {'value-concept': 'normal'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE value_code LIKE ?",
                'sql_params': ('%normal%',)
            },
            {
                'name': 'Observation using patient alias',
                'fhir_params': {'patient': '0bf227bc-f275-4707-9794-75c97635d800'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE patient_id = ?",
                'sql_params': ('0bf227bc-f275-4707-9794-75c97635d800',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "Observation")
            
    def test_condition_new_parameters(self):
        """Test newly added Condition search parameters"""
        print(colored("\n" + "="*80, "blue"))
        print(colored("CONDITION NEW SEARCH PARAMETERS TESTS", "blue", attrs=["bold"]))
        print(colored("="*80, "blue"))
        
        tests = [
            {
                'name': 'Condition by verification-status=confirmed',
                'fhir_params': {'verification-status': 'confirmed'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE verification_status = ?",
                'sql_params': ('confirmed',)
            },
            {
                'name': 'Condition by severity=mild',
                'fhir_params': {'severity': 'mild'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE severity = ?",
                'sql_params': ('mild',)
            },
            {
                'name': 'Condition by severity=moderate',
                'fhir_params': {'severity': 'moderate'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE severity = ?",
                'sql_params': ('moderate',)
            },
            {
                'name': 'Condition by severity=severe',
                'fhir_params': {'severity': 'severe'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE severity = ?",
                'sql_params': ('severe',)
            },
            {
                'name': 'Condition by recorded-date > 2020',
                'fhir_params': {'recorded-date': 'gt2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE recorded_date > ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            {
                'name': 'Condition by abatement-date exists',
                'fhir_params': {'abatement-date:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE abatement_date IS NOT NULL",
                'sql_params': ()
            },
            {
                'name': 'Condition by encounter:missing=true',
                'fhir_params': {'encounter:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE encounter_id IS NULL",
                'sql_params': ()
            },
            {
                'name': 'Condition by encounter:missing=false',
                'fhir_params': {'encounter:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE encounter_id IS NOT NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Condition")
            
    def test_medication_new_parameters(self):
        """Test newly added MedicationRequest search parameters"""
        print(colored("\n" + "="*80, "blue"))
        print(colored("MEDICATIONREQUEST NEW SEARCH PARAMETERS TESTS", "blue", attrs=["bold"]))
        print(colored("="*80, "blue"))
        
        tests = [
            {
                'name': 'MedicationRequest by intent=order',
                'fhir_params': {'intent': 'order'},
                'sql': "SELECT COUNT(*) as count FROM medications",  # All are orders
                'sql_params': ()
            },
            {
                'name': 'MedicationRequest by intent=plan (should be empty)',
                'fhir_params': {'intent': 'plan'},
                'sql': "SELECT 0 as count",  # None should match
                'sql_params': ()
            },
            {
                'name': 'MedicationRequest by code (rxnorm)',
                'fhir_params': {'code': '1234567'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE rxnorm_code = ?",
                'sql_params': ('1234567',)
            },
            {
                'name': 'MedicationRequest by encounter:missing=true',
                'fhir_params': {'encounter:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE encounter_id IS NULL",
                'sql_params': ()
            },
            {
                'name': 'MedicationRequest by encounter:missing=false',
                'fhir_params': {'encounter:missing': 'false'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE encounter_id IS NOT NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "MedicationRequest")
            
    def test_token_exact_match(self):
        """Test that token searches use exact match"""
        print(colored("\n" + "="*80, "blue"))
        print(colored("TOKEN EXACT MATCH TESTS", "blue", attrs=["bold"]))
        print(colored("="*80, "blue"))
        
        # Test case sensitivity for tokens
        tests = [
            {
                'name': 'Gender exact match - lowercase',
                'resource': 'Patient',
                'fhir_params': {'gender': 'male'},
                'should_match': True
            },
            {
                'name': 'Gender exact match - uppercase (should not match)',
                'resource': 'Patient',
                'fhir_params': {'gender': 'MALE'},
                'should_match': False
            },
            {
                'name': 'Gender exact match - mixed case (should not match)',
                'resource': 'Patient',
                'fhir_params': {'gender': 'Male'},
                'should_match': False
            },
            {
                'name': 'Boolean exact match - true',
                'resource': 'Patient',
                'fhir_params': {'active': 'true'},
                'should_match': True
            },
            {
                'name': 'Boolean exact match - True (should not match)',
                'resource': 'Patient',
                'fhir_params': {'active': 'True'},
                'should_match': False
            },
            {
                'name': 'Boolean exact match - TRUE (should not match)',
                'resource': 'Patient',
                'fhir_params': {'active': 'TRUE'},
                'should_match': False
            },
            {
                'name': 'Status exact match - final',
                'resource': 'Observation',
                'fhir_params': {'status': 'final'},
                'should_match': True
            },
            {
                'name': 'Status exact match - Final (should not match)',
                'resource': 'Observation',
                'fhir_params': {'status': 'Final'},
                'should_match': False
            }
        ]
        
        for test in tests:
            self._run_token_test(test)
            
    def _run_test(self, test: Dict[str, Any], resource_type: str):
        """Run a single test comparing SQL and FHIR results"""
        print(colored(f"\n{'='*60}", "cyan"))
        print(colored(f"Test: {test['name']}", "cyan", attrs=["bold"]))
        print(colored("="*60, "cyan"))
        
        # Execute SQL query
        sql_count = self._execute_sql(test['sql'], test.get('sql_params', ()))
        
        # Execute FHIR query
        fhir_url = f"{self.fhir_base_url}/fhir/R4/{resource_type}"
        fhir_response = self._execute_fhir_query(fhir_url, test['fhir_params'])
        
        if fhir_response:
            fhir_total = fhir_response.get('total', 0)
            
            # Compare results
            print(f"\nComparison for: {test['name']}")
            print(f"SQL Count: {sql_count}")
            print(f"FHIR Total: {fhir_total}")
            
            if sql_count == fhir_total:
                print(colored("✓ Counts match!", "green", attrs=["bold"]))
                self.test_results["passed"] += 1
            else:
                print(colored("✗ Counts do not match!", "red", attrs=["bold"]))
                self.test_results["failed"] += 1
        else:
            print(colored("✗ FHIR query failed!", "red", attrs=["bold"]))
            self.test_results["failed"] += 1
            
    def _run_token_test(self, test: Dict[str, Any]):
        """Run a token exact match test"""
        print(colored(f"\n{'='*60}", "cyan"))
        print(colored(f"Test: {test['name']}", "cyan", attrs=["bold"]))
        print(colored("="*60, "cyan"))
        
        # Execute FHIR query
        fhir_url = f"{self.fhir_base_url}/fhir/R4/{test['resource']}"
        fhir_response = self._execute_fhir_query(fhir_url, test['fhir_params'])
        
        if fhir_response:
            fhir_total = fhir_response.get('total', 0)
            has_results = fhir_total > 0
            
            print(f"FHIR Total: {fhir_total}")
            print(f"Expected to match: {test['should_match']}")
            print(f"Has results: {has_results}")
            
            if test['should_match'] and has_results:
                print(colored("✓ Token exact match working correctly (found results)", "green", attrs=["bold"]))
                self.test_results["passed"] += 1
            elif not test['should_match'] and not has_results:
                print(colored("✓ Token exact match working correctly (no results)", "green", attrs=["bold"]))
                self.test_results["passed"] += 1
            else:
                print(colored("✗ Token exact match not working as expected!", "red", attrs=["bold"]))
                self.test_results["failed"] += 1
        else:
            print(colored("✗ FHIR query failed!", "red", attrs=["bold"]))
            self.test_results["failed"] += 1
            
    def _execute_sql(self, query: str, params: tuple) -> int:
        """Execute SQL query and return count"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        print(f"SQL Query: {query}")
        if params:
            print(f"SQL Params: {params}")
            
        cursor.execute(query, params)
        result = cursor.fetchone()
        conn.close()
        
        count = result[0] if result else 0
        print(f"SQL Result: {count}")
        return count
        
    def _execute_fhir_query(self, base_url: str, params: Dict[str, Any]) -> Optional[Dict]:
        """Execute FHIR query and return response"""
        # Add _count parameter to get more results
        params['_count'] = 100
        
        # Build query string
        query_params = "&".join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{base_url}?{query_params}"
        
        print(f"\nFHIR URL: {full_url}")
        
        try:
            response = requests.get(full_url)
            if response.status_code == 200:
                return response.json()
            else:
                print(colored(f"FHIR Error: {response.status_code} - {response.text}", "red"))
                return None
        except Exception as e:
            print(colored(f"Request failed: {str(e)}", "red"))
            return None
            
    def run_all_tests(self):
        """Run all test suites"""
        print(colored("\n" + "="*80, "magenta", attrs=["bold"]))
        print(colored("FHIR R4 NEW SEARCH PARAMETERS TEST SUITE", "magenta", attrs=["bold"]))
        print(colored(f"Testing against: {self.fhir_base_url}", "magenta"))
        print(colored(f"Database: {self.db_path}", "magenta"))
        print(colored("="*80, "magenta", attrs=["bold"]))
        
        # Run all test suites
        self.test_patient_new_parameters()
        self.test_encounter_new_parameters()
        self.test_observation_new_parameters()
        self.test_condition_new_parameters()
        self.test_medication_new_parameters()
        self.test_token_exact_match()
        
        # Print summary
        print(colored("\n" + "="*80, "magenta", attrs=["bold"]))
        print(colored("TEST SUMMARY", "magenta", attrs=["bold"]))
        print(colored("="*80, "magenta", attrs=["bold"]))
        
        total = self.test_results["passed"] + self.test_results["failed"]
        print(colored(f"Total Tests: {total}", "white", attrs=["bold"]))
        print(colored(f"Passed: {self.test_results['passed']}", "green", attrs=["bold"]))
        print(colored(f"Failed: {self.test_results['failed']}", "red", attrs=["bold"]))
        
        if self.test_results["failed"] == 0:
            print(colored("\n✅ All tests passed!", "green", attrs=["bold"]))
        else:
            print(colored(f"\n❌ {self.test_results['failed']} tests failed!", "red", attrs=["bold"]))
            
        return self.test_results["failed"] == 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python fhir_new_parameters_test_suite.py <fhir_base_url> <db_path>")
        print("Example: python fhir_new_parameters_test_suite.py http://localhost:8000 /app/data/emr.db")
        sys.exit(1)
        
    fhir_base_url = sys.argv[1]
    db_path = sys.argv[2]
    
    tester = FHIRNewParametersTestSuite(fhir_base_url, db_path)
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)