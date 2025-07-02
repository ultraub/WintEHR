#!/usr/bin/env python3
"""
Comprehensive FHIR R4 Test Suite
Tests all FHIR resources and search parameters against SQL database
Ensures complete API coverage and SQL/FHIR consistency
"""

import requests
import json
import sys
import sqlite3
from datetime import datetime
from termcolor import colored
from typing import Dict, List, Optional, Any

class ComprehensiveFHIRTestSuite:
    def __init__(self, fhir_base_url: str, db_path: str):
        self.fhir_base_url = fhir_base_url.rstrip('/')
        self.db_path = db_path
        self.test_results = {"passed": 0, "failed": 0}
        self.resource_tests = {}
        
    def test_all_resources(self):
        """Test all FHIR resources comprehensively"""
        print(colored("\n" + "="*100, "blue"))
        print(colored("COMPREHENSIVE FHIR R4 API TEST SUITE", "blue", attrs=["bold"]))
        print(colored("="*100, "blue"))
        
        # Test each resource type
        self.test_patient_comprehensive()
        self.test_encounter_comprehensive()
        self.test_observation_comprehensive()
        self.test_condition_comprehensive()
        self.test_medication_request_comprehensive()
        self.test_practitioner_comprehensive()
        self.test_organization_comprehensive()
        self.test_location_comprehensive()
        self.test_allergy_intolerance_comprehensive()
        self.test_immunization_comprehensive()
        self.test_procedure_comprehensive()
        self.test_care_plan_comprehensive()
        self.test_device_comprehensive()
        self.test_diagnostic_report_comprehensive()
        self.test_imaging_study_comprehensive()
        
        # Test cross-resource functionality
        self.test_cross_resource_searches()
        self.test_fhir_compliance()
        
    def test_patient_comprehensive(self):
        """Comprehensive Patient resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("PATIENT RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            # Basic searches
            {
                'name': 'Patient count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM patients",
                'sql_params': ()
            },
            {
                'name': 'Patient by gender=male',
                'fhir_params': {'gender': 'male'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE gender = ?",
                'sql_params': ('male',)
            },
            {
                'name': 'Patient by gender=female',
                'fhir_params': {'gender': 'female'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE gender = ?",
                'sql_params': ('female',)
            },
            # Name searches
            {
                'name': 'Patient by family name',
                'fhir_params': {'family': 'Smith'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE last_name LIKE ?",
                'sql_params': ('%Smith%',)
            },
            {
                'name': 'Patient by given name', 
                'fhir_params': {'given': 'John'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE first_name LIKE ?",
                'sql_params': ('%John%',)
            },
            # Date searches
            {
                'name': 'Patient birthdate after 1990',
                'fhir_params': {'birthdate': 'gt1990-01-01'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_birth > ?",
                'sql_params': ('1990-01-01',)
            },
            {
                'name': 'Patient birthdate before 1980',
                'fhir_params': {'birthdate': 'lt1980-01-01'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_birth < ?",
                'sql_params': ('1980-01-01',)
            },
            # Address searches
            {
                'name': 'Patient by city',
                'fhir_params': {'address-city': 'Boston'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE city LIKE ?",
                'sql_params': ('%Boston%',)
            },
            {
                'name': 'Patient by state',
                'fhir_params': {'address-state': 'MA'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE state LIKE ?",
                'sql_params': ('%MA%',)
            },
            # Status searches
            {
                'name': 'Patient active=true',
                'fhir_params': {'active': 'true'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE is_active = 1",
                'sql_params': ()
            },
            {
                'name': 'Patient deceased=true',
                'fhir_params': {'deceased': 'true'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_death IS NOT NULL",
                'sql_params': ()
            },
            # Missing searches
            {
                'name': 'Patient deceased:missing=true',
                'fhir_params': {'deceased:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM patients WHERE date_of_death IS NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Patient")
            
    def test_encounter_comprehensive(self):
        """Comprehensive Encounter resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("ENCOUNTER RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Encounter count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM encounters",
                'sql_params': ()
            },
            {
                'name': 'Encounter by class=AMB',
                'fhir_params': {'class': 'AMB'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE encounter_class = ?",
                'sql_params': ('AMB',)
            },
            {
                'name': 'Encounter by status=finished',
                'fhir_params': {'status': 'finished'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE status = ?",
                'sql_params': ('finished',)
            },
            {
                'name': 'Encounter by date range',
                'fhir_params': {'date': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE encounter_date >= ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            {
                'name': 'Encounter by patient reference',
                'fhir_params': {'subject': '0bf227bc-f275-4707-9794-75c97635d800'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE patient_id = ?",
                'sql_params': ('0bf227bc-f275-4707-9794-75c97635d800',)
            },
            {
                'name': 'Encounter service-provider missing',
                'fhir_params': {'service-provider:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE organization_id IS NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Encounter")
            
    def test_observation_comprehensive(self):
        """Comprehensive Observation resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("OBSERVATION RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Observation count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM observations",
                'sql_params': ()
            },
            {
                'name': 'Observation by status=final',
                'fhir_params': {'status': 'final'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE status = ?",
                'sql_params': ('final',)
            },
            {
                'name': 'Observation by category=laboratory',
                'fhir_params': {'category': 'laboratory'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE observation_type = ?",
                'sql_params': ('laboratory',)
            },
            {
                'name': 'Observation by LOINC code',
                'fhir_params': {'code': '8302-2'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE loinc_code = ?",
                'sql_params': ('8302-2',)
            },
            {
                'name': 'Observation by patient',
                'fhir_params': {'patient': '0bf227bc-f275-4707-9794-75c97635d800'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE patient_id = ?",
                'sql_params': ('0bf227bc-f275-4707-9794-75c97635d800',)
            },
            {
                'name': 'Observation by date range',
                'fhir_params': {'date': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE observation_date >= ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            {
                'name': 'Observation value-quantity > 100',
                'fhir_params': {'value-quantity': 'gt100'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE value_quantity > 100",
                'sql_params': ()
            },
            {
                'name': 'Observation performer missing',
                'fhir_params': {'performer:missing': 'true'},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE provider_id IS NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Observation")
            
    def test_condition_comprehensive(self):
        """Comprehensive Condition resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("CONDITION RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Condition count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM conditions",
                'sql_params': ()
            },
            {
                'name': 'Condition by clinical-status=active',
                'fhir_params': {'clinical-status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE clinical_status = ?",
                'sql_params': ('active',)
            },
            {
                'name': 'Condition by verification-status=confirmed',
                'fhir_params': {'verification-status': 'confirmed'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE verification_status = ?",
                'sql_params': ('confirmed',)
            },
            {
                'name': 'Condition by SNOMED code',
                'fhir_params': {'code': '44054006'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE snomed_code = ?",
                'sql_params': ('44054006',)
            },
            {
                'name': 'Condition by ICD-10 code',
                'fhir_params': {'code': 'Z87.891'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE icd10_code = ?",
                'sql_params': ('Z87.891',)
            },
            {
                'name': 'Condition by patient',
                'fhir_params': {'patient': '0bf227bc-f275-4707-9794-75c97635d800'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE patient_id = ?",
                'sql_params': ('0bf227bc-f275-4707-9794-75c97635d800',)
            },
            {
                'name': 'Condition by onset date',
                'fhir_params': {'onset-date': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE onset_date >= ?",
                'sql_params': ('2020-01-01 00:00:00',)
            },
            {
                'name': 'Condition by recorded date',
                'fhir_params': {'recorded-date': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE recorded_date >= ?",
                'sql_params': ('2020-01-01 00:00:00',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "Condition")
            
    def test_medication_request_comprehensive(self):
        """Comprehensive MedicationRequest resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("MEDICATIONREQUEST RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'MedicationRequest count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM medications",
                'sql_params': ()
            },
            {
                'name': 'MedicationRequest by status=active',
                'fhir_params': {'status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE status = ?",
                'sql_params': ('active',)
            },
            {
                'name': 'MedicationRequest by intent=order',
                'fhir_params': {'intent': 'order'},
                'sql': "SELECT COUNT(*) as count FROM medications",
                'sql_params': ()
            },
            {
                'name': 'MedicationRequest by patient',
                'fhir_params': {'patient': '0bf227bc-f275-4707-9794-75c97635d800'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE patient_id = ?",
                'sql_params': ('0bf227bc-f275-4707-9794-75c97635d800',)
            },
            {
                'name': 'MedicationRequest by authored date',
                'fhir_params': {'authored-on': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE start_date >= ?",
                'sql_params': ('2020-01-01',)
            },
            {
                'name': 'MedicationRequest by medication name',
                'fhir_params': {'medication': 'Lisinopril'},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE medication_name LIKE ?",
                'sql_params': ('%Lisinopril%',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "MedicationRequest")
            
    def test_practitioner_comprehensive(self):
        """Comprehensive Practitioner resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("PRACTITIONER RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Practitioner count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM providers",
                'sql_params': ()
            },
            {
                'name': 'Practitioner by family name',
                'fhir_params': {'family': 'Smith'},
                'sql': "SELECT COUNT(*) as count FROM providers WHERE last_name LIKE ?",
                'sql_params': ('%Smith%',)
            },
            {
                'name': 'Practitioner by given name',
                'fhir_params': {'given': 'John'},
                'sql': "SELECT COUNT(*) as count FROM providers WHERE first_name LIKE ?",
                'sql_params': ('%John%',)
            },
            {
                'name': 'Practitioner active=true',
                'fhir_params': {'active': 'true'},
                'sql': "SELECT COUNT(*) as count FROM providers WHERE active = 1",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Practitioner")
            
    def test_organization_comprehensive(self):
        """Comprehensive Organization resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("ORGANIZATION RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Organization count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM organizations",
                'sql_params': ()
            },
            {
                'name': 'Organization by name',
                'fhir_params': {'name': 'Hospital'},
                'sql': "SELECT COUNT(*) as count FROM organizations WHERE name LIKE ?",
                'sql_params': ('%Hospital%',)
            },
            {
                'name': 'Organization active=true',
                'fhir_params': {'active': 'true'},
                'sql': "SELECT COUNT(*) as count FROM organizations WHERE active = 1",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Organization")
            
    def test_location_comprehensive(self):
        """Comprehensive Location resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("LOCATION RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Location count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM locations",
                'sql_params': ()
            },
            {
                'name': 'Location by name',
                'fhir_params': {'name': 'Room'},
                'sql': "SELECT COUNT(*) as count FROM locations WHERE name LIKE ?",
                'sql_params': ('%Room%',)
            },
            {
                'name': 'Location status=active',
                'fhir_params': {'status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM locations WHERE status = 'active' OR status IS NULL",
                'sql_params': ()
            }
        ]
        
        for test in tests:
            self._run_test(test, "Location")
            
    def test_allergy_intolerance_comprehensive(self):
        """Comprehensive AllergyIntolerance resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("ALLERGYINTOLERANCE RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'AllergyIntolerance count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM allergies",
                'sql_params': ()
            },
            {
                'name': 'AllergyIntolerance by clinical-status=active',
                'fhir_params': {'clinical-status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM allergies WHERE clinical_status = ?",
                'sql_params': ('active',)
            },
            {
                'name': 'AllergyIntolerance by category=food',
                'fhir_params': {'category': 'food'},
                'sql': "SELECT COUNT(*) as count FROM allergies WHERE category = ?",
                'sql_params': ('food',)
            },
            {
                'name': 'AllergyIntolerance by type=allergy',
                'fhir_params': {'type': 'allergy'},
                'sql': "SELECT COUNT(*) as count FROM allergies WHERE allergy_type = ?",
                'sql_params': ('allergy',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "AllergyIntolerance")
            
    def test_immunization_comprehensive(self):
        """Comprehensive Immunization resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("IMMUNIZATION RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Immunization count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM immunizations",
                'sql_params': ()
            },
            {
                'name': 'Immunization by status=completed',
                'fhir_params': {'status': 'completed'},
                'sql': "SELECT COUNT(*) as count FROM immunizations WHERE status = ?",
                'sql_params': ('completed',)
            },
            {
                'name': 'Immunization by date range',
                'fhir_params': {'date': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM immunizations WHERE immunization_date >= ?",
                'sql_params': ('2020-01-01 00:00:00',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "Immunization")
            
    def test_procedure_comprehensive(self):
        """Comprehensive Procedure resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("PROCEDURE RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Procedure count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM procedures",
                'sql_params': ()
            },
            {
                'name': 'Procedure by status=completed',
                'fhir_params': {'status': 'completed'},
                'sql': "SELECT COUNT(*) as count FROM procedures WHERE status = ?",
                'sql_params': ('completed',)
            },
            {
                'name': 'Procedure by date range',
                'fhir_params': {'date': 'ge2020-01-01'},
                'sql': "SELECT COUNT(*) as count FROM procedures WHERE procedure_date >= ?",
                'sql_params': ('2020-01-01 00:00:00',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "Procedure")
            
    def test_care_plan_comprehensive(self):
        """Comprehensive CarePlan resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("CAREPLAN RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'CarePlan count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM careplans",
                'sql_params': ()
            },
            {
                'name': 'CarePlan by status=active',
                'fhir_params': {'status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM careplans WHERE status = ?",
                'sql_params': ('active',)
            },
            {
                'name': 'CarePlan by intent=plan',
                'fhir_params': {'intent': 'plan'},
                'sql': "SELECT COUNT(*) as count FROM careplans WHERE intent = ?",
                'sql_params': ('plan',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "CarePlan")
            
    def test_device_comprehensive(self):
        """Comprehensive Device resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("DEVICE RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'Device count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM devices",
                'sql_params': ()
            },
            {
                'name': 'Device by status=active',
                'fhir_params': {'status': 'active'},
                'sql': "SELECT COUNT(*) as count FROM devices WHERE status = ?",
                'sql_params': ('active',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "Device")
            
    def test_diagnostic_report_comprehensive(self):
        """Comprehensive DiagnosticReport resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("DIAGNOSTICREPORT RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'DiagnosticReport count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM diagnostic_reports",
                'sql_params': ()
            },
            {
                'name': 'DiagnosticReport by status=final',
                'fhir_params': {'status': 'final'},
                'sql': "SELECT COUNT(*) as count FROM diagnostic_reports WHERE status = ?",
                'sql_params': ('final',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "DiagnosticReport")
            
    def test_imaging_study_comprehensive(self):
        """Comprehensive ImagingStudy resource tests"""
        print(colored("\n" + "="*80, "green"))
        print(colored("IMAGINGSTUDY RESOURCE COMPREHENSIVE TESTS", "green", attrs=["bold"]))
        print(colored("="*80, "green"))
        
        tests = [
            {
                'name': 'ImagingStudy count total',
                'fhir_params': {},
                'sql': "SELECT COUNT(*) as count FROM imaging_studies",
                'sql_params': ()
            },
            {
                'name': 'ImagingStudy by status=available',
                'fhir_params': {'status': 'available'},
                'sql': "SELECT COUNT(*) as count FROM imaging_studies WHERE status = ?",
                'sql_params': ('available',)
            }
        ]
        
        for test in tests:
            self._run_test(test, "ImagingStudy")
            
    def test_cross_resource_searches(self):
        """Test cross-resource searches and references"""
        print(colored("\n" + "="*80, "magenta"))
        print(colored("CROSS-RESOURCE SEARCH TESTS", "magenta", attrs=["bold"]))
        print(colored("="*80, "magenta"))
        
        # Get a patient ID for cross-resource tests
        patient_id = self._get_sample_patient_id()
        if not patient_id:
            print(colored("No patients found - skipping cross-resource tests", "yellow"))
            return
            
        tests = [
            {
                'name': 'Encounters for specific patient',
                'resource': 'Encounter',
                'fhir_params': {'subject': patient_id},
                'sql': "SELECT COUNT(*) as count FROM encounters WHERE patient_id = ?",
                'sql_params': (patient_id,)
            },
            {
                'name': 'Observations for specific patient',
                'resource': 'Observation',
                'fhir_params': {'patient': patient_id},
                'sql': "SELECT COUNT(*) as count FROM observations WHERE patient_id = ?",
                'sql_params': (patient_id,)
            },
            {
                'name': 'Conditions for specific patient',
                'resource': 'Condition',
                'fhir_params': {'patient': patient_id},
                'sql': "SELECT COUNT(*) as count FROM conditions WHERE patient_id = ?",
                'sql_params': (patient_id,)
            },
            {
                'name': 'Medications for specific patient',
                'resource': 'MedicationRequest',
                'fhir_params': {'patient': patient_id},
                'sql': "SELECT COUNT(*) as count FROM medications WHERE patient_id = ?",
                'sql_params': (patient_id,)
            }
        ]
        
        for test in tests:
            self._run_cross_resource_test(test)
            
    def test_fhir_compliance(self):
        """Test FHIR R4 compliance features"""
        print(colored("\n" + "="*80, "cyan"))
        print(colored("FHIR R4 COMPLIANCE TESTS", "cyan", attrs=["bold"]))
        print(colored("="*80, "cyan"))
        
        # Test metadata endpoint
        self._test_capability_statement()
        
        # Test search parameters
        self._test_search_parameter_validation()
        
        # Test bundle structure
        self._test_bundle_structure()
        
        # Test error handling
        self._test_error_handling()
        
    def _test_capability_statement(self):
        """Test CapabilityStatement endpoint"""
        print(colored("\nTesting CapabilityStatement...", "cyan"))
        
        try:
            response = requests.get(f"{self.fhir_base_url}/fhir/R4/metadata")
            if response.status_code == 200:
                capability = response.json()
                
                # Check basic structure
                if capability.get('resourceType') == 'CapabilityStatement':
                    print(colored("✓ CapabilityStatement structure valid", "green"))
                    self.test_results["passed"] += 1
                    
                    # Check supported resources
                    resources = capability.get('rest', [{}])[0].get('resource', [])
                    expected_resources = {
                        'Patient', 'Encounter', 'Observation', 'Condition', 
                        'MedicationRequest', 'Practitioner', 'Organization', 
                        'Location', 'AllergyIntolerance', 'Immunization', 
                        'Procedure', 'CarePlan', 'Device', 'DiagnosticReport', 
                        'ImagingStudy'
                    }
                    
                    found_resources = {r['type'] for r in resources}
                    missing_resources = expected_resources - found_resources
                    
                    if not missing_resources:
                        print(colored("✓ All expected resources supported", "green"))
                        self.test_results["passed"] += 1
                    else:
                        print(colored(f"✗ Missing resources: {missing_resources}", "red"))
                        self.test_results["failed"] += 1
                else:
                    print(colored("✗ Invalid CapabilityStatement structure", "red"))
                    self.test_results["failed"] += 1
            else:
                print(colored(f"✗ CapabilityStatement request failed: {response.status_code}", "red"))
                self.test_results["failed"] += 1
        except Exception as e:
            print(colored(f"✗ CapabilityStatement test error: {str(e)}", "red"))
            self.test_results["failed"] += 1
            
    def _test_search_parameter_validation(self):
        """Test search parameter validation"""
        print(colored("\nTesting search parameter validation...", "cyan"))
        
        # Test invalid parameter
        try:
            response = requests.get(f"{self.fhir_base_url}/fhir/R4/Patient?invalid_param=test")
            if response.status_code == 400:
                print(colored("✓ Invalid parameter correctly rejected", "green"))
                self.test_results["passed"] += 1
            else:
                print(colored("✗ Invalid parameter not rejected", "red"))
                self.test_results["failed"] += 1
        except Exception as e:
            print(colored(f"✗ Parameter validation test error: {str(e)}", "red"))
            self.test_results["failed"] += 1
            
    def _test_bundle_structure(self):
        """Test FHIR Bundle structure"""
        print(colored("\nTesting Bundle structure...", "cyan"))
        
        try:
            response = requests.get(f"{self.fhir_base_url}/fhir/R4/Patient?_count=1")
            if response.status_code == 200:
                bundle = response.json()
                
                required_fields = ['resourceType', 'type', 'total', 'link', 'entry']
                missing_fields = [field for field in required_fields if field not in bundle]
                
                if not missing_fields:
                    print(colored("✓ Bundle structure valid", "green"))
                    self.test_results["passed"] += 1
                else:
                    print(colored(f"✗ Bundle missing fields: {missing_fields}", "red"))
                    self.test_results["failed"] += 1
            else:
                print(colored(f"✗ Bundle test request failed: {response.status_code}", "red"))
                self.test_results["failed"] += 1
        except Exception as e:
            print(colored(f"✗ Bundle structure test error: {str(e)}", "red"))
            self.test_results["failed"] += 1
            
    def _test_error_handling(self):
        """Test error handling"""
        print(colored("\nTesting error handling...", "cyan"))
        
        # Test unsupported resource
        try:
            response = requests.get(f"{self.fhir_base_url}/fhir/R4/UnsupportedResource")
            if response.status_code == 404:
                print(colored("✓ Unsupported resource correctly returns 404", "green"))
                self.test_results["passed"] += 1
            else:
                print(colored("✗ Unsupported resource should return 404", "red"))
                self.test_results["failed"] += 1
        except Exception as e:
            print(colored(f"✗ Error handling test error: {str(e)}", "red"))
            self.test_results["failed"] += 1
            
    def _get_sample_patient_id(self) -> Optional[str]:
        """Get a sample patient ID for cross-resource tests"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM patients LIMIT 1")
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None
        
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
                
                # Store resource test results
                if resource_type not in self.resource_tests:
                    self.resource_tests[resource_type] = {"passed": 0, "failed": 0}
                self.resource_tests[resource_type]["passed"] += 1
            else:
                print(colored("✗ Counts do not match!", "red", attrs=["bold"]))
                self.test_results["failed"] += 1
                
                if resource_type not in self.resource_tests:
                    self.resource_tests[resource_type] = {"passed": 0, "failed": 0}
                self.resource_tests[resource_type]["failed"] += 1
        else:
            print(colored("✗ FHIR query failed!", "red", attrs=["bold"]))
            self.test_results["failed"] += 1
            
            if resource_type not in self.resource_tests:
                self.resource_tests[resource_type] = {"passed": 0, "failed": 0}
            self.resource_tests[resource_type]["failed"] += 1
            
    def _run_cross_resource_test(self, test: Dict[str, Any]):
        """Run a cross-resource test"""
        print(colored(f"\n{'='*60}", "cyan"))
        print(colored(f"Cross-Resource Test: {test['name']}", "cyan", attrs=["bold"]))
        print(colored("="*60, "cyan"))
        
        # Execute SQL query
        sql_count = self._execute_sql(test['sql'], test.get('sql_params', ()))
        
        # Execute FHIR query
        fhir_url = f"{self.fhir_base_url}/fhir/R4/{test['resource']}"
        fhir_response = self._execute_fhir_query(fhir_url, test['fhir_params'])
        
        if fhir_response:
            fhir_total = fhir_response.get('total', 0)
            
            print(f"\nComparison for: {test['name']}")
            print(f"SQL Count: {sql_count}")
            print(f"FHIR Total: {fhir_total}")
            
            if sql_count == fhir_total:
                print(colored("✓ Cross-resource search consistent!", "green", attrs=["bold"]))
                self.test_results["passed"] += 1
            else:
                print(colored("✗ Cross-resource search inconsistent!", "red", attrs=["bold"]))
                self.test_results["failed"] += 1
        else:
            print(colored("✗ Cross-resource FHIR query failed!", "red", attrs=["bold"]))
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
        full_url = f"{base_url}?{query_params}" if params else base_url
        
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
            
    def print_summary(self):
        """Print comprehensive test summary"""
        print(colored("\n" + "="*100, "magenta", attrs=["bold"]))
        print(colored("COMPREHENSIVE TEST SUMMARY", "magenta", attrs=["bold"]))
        print(colored("="*100, "magenta", attrs=["bold"]))
        
        total = self.test_results["passed"] + self.test_results["failed"]
        print(colored(f"Total Tests: {total}", "white", attrs=["bold"]))
        print(colored(f"Passed: {self.test_results['passed']}", "green", attrs=["bold"]))
        print(colored(f"Failed: {self.test_results['failed']}", "red", attrs=["bold"]))
        
        # Print per-resource summary
        print(colored("\nPER-RESOURCE SUMMARY:", "white", attrs=["bold"]))
        for resource, results in self.resource_tests.items():
            total_resource = results["passed"] + results["failed"]
            status = "✓" if results["failed"] == 0 else "✗"
            print(colored(f"{status} {resource}: {results['passed']}/{total_resource} passed", 
                         "green" if results["failed"] == 0 else "red"))
        
        if self.test_results["failed"] == 0:
            print(colored("\n🎉 ALL TESTS PASSED! FHIR R4 API FULLY COMPLIANT", "green", attrs=["bold"]))
        else:
            print(colored(f"\n❌ {self.test_results['failed']} tests failed", "red", attrs=["bold"]))
            
        return self.test_results["failed"] == 0
        
    def run_all_tests(self):
        """Run all test suites"""
        self.test_all_resources()
        return self.print_summary()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python comprehensive_fhir_test_suite.py <fhir_base_url> <db_path>")
        print("Example: python comprehensive_fhir_test_suite.py http://localhost:8000 backend/data/emr.db")
        sys.exit(1)
        
    fhir_base_url = sys.argv[1]
    db_path = sys.argv[2]
    
    tester = ComprehensiveFHIRTestSuite(fhir_base_url, db_path)
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)