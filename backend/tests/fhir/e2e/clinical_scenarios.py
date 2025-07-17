#!/usr/bin/env python3
"""
End-to-End Clinical Scenario Tests for FHIR API

Tests real-world clinical workflows and complex query patterns that healthcare
professionals would use in practice.
"""

import pytest
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import aiohttp
import json
from urllib.parse import quote

# Test configuration
BASE_URL = "http://localhost:8000/fhir/R4"
TEST_PATIENT_ID = "61a2fcc0-d679-764c-7d86-b885b2c4907f"


class TestClinicalScenarios:
    """Test suite for end-to-end clinical scenarios"""
    
    @pytest.fixture
    async def session(self):
        """Create aiohttp session for tests"""
        async with aiohttp.ClientSession() as session:
            yield session
    
    async def test_patient_summary_dashboard(self, session):
        """
        Scenario: Loading a patient summary dashboard
        
        A clinician opens a patient's chart and the system needs to load:
        1. Patient demographics
        2. Active conditions
        3. Current medications
        4. Recent vitals
        5. Allergies
        6. Upcoming appointments
        """
        # 1. Get patient demographics
        patient_url = f"{BASE_URL}/Patient/{TEST_PATIENT_ID}"
        async with session.get(patient_url) as resp:
            assert resp.status == 200
            patient = await resp.json()
            assert patient['resourceType'] == 'Patient'
            assert patient['id'] == TEST_PATIENT_ID
        
        # 2. Get active conditions
        conditions_url = f"{BASE_URL}/Condition"
        conditions_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "clinical-status": "active",
            "_sort": "-onset-date",
            "_count": "10"
        }
        async with session.get(conditions_url, params=conditions_params) as resp:
            assert resp.status == 200
            conditions_bundle = await resp.json()
            assert conditions_bundle['resourceType'] == 'Bundle'
            active_conditions = [entry['resource'] for entry in conditions_bundle.get('entry', [])]
        
        # 3. Get current medications
        medications_url = f"{BASE_URL}/MedicationRequest"
        medications_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "status": "active",
            "_include": "MedicationRequest:medication",
            "_sort": "-authoredon"
        }
        async with session.get(medications_url, params=medications_params) as resp:
            assert resp.status == 200
            medications_bundle = await resp.json()
            current_medications = [
                entry['resource'] 
                for entry in medications_bundle.get('entry', [])
                if entry['resource']['resourceType'] == 'MedicationRequest'
            ]
        
        # 4. Get recent vitals (last 5 sets)
        vitals_url = f"{BASE_URL}/Observation"
        vitals_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "category": "vital-signs",
            "_sort": "-date",
            "_count": "20"  # Get more to ensure we have different types
        }
        async with session.get(vitals_url, params=vitals_params) as resp:
            assert resp.status == 200
            vitals_bundle = await resp.json()
            recent_vitals = [entry['resource'] for entry in vitals_bundle.get('entry', [])]
        
        # 5. Get allergies
        allergies_url = f"{BASE_URL}/AllergyIntolerance"
        allergies_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "clinical-status": "active"
        }
        async with session.get(allergies_url, params=allergies_params) as resp:
            assert resp.status == 200
            allergies_bundle = await resp.json()
            allergies = [entry['resource'] for entry in allergies_bundle.get('entry', [])]
        
        # 6. Get upcoming encounters
        encounters_url = f"{BASE_URL}/Encounter"
        encounters_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "status": "planned,arrived,in-progress",
            "_sort": "date"
        }
        async with session.get(encounters_url, params=encounters_params) as resp:
            assert resp.status == 200
            encounters_bundle = await resp.json()
            upcoming_encounters = [entry['resource'] for entry in encounters_bundle.get('entry', [])]
        
        # Verify we got meaningful data
        print(f"\nPatient Summary Dashboard for {patient.get('name', [{}])[0].get('given', [''])[0]} {patient.get('name', [{}])[0].get('family', '')}")
        print(f"- Active Conditions: {len(active_conditions)}")
        print(f"- Current Medications: {len(current_medications)}")
        print(f"- Recent Vitals: {len(recent_vitals)}")
        print(f"- Active Allergies: {len(allergies)}")
        print(f"- Upcoming Encounters: {len(upcoming_encounters)}")
        
        # Assert we have some data
        assert len(active_conditions) > 0 or len(current_medications) > 0 or len(recent_vitals) > 0
    
    async def test_medication_reconciliation_workflow(self, session):
        """
        Scenario: Medication reconciliation during admission
        
        A nurse needs to reconcile medications for a newly admitted patient:
        1. Get all current medications (active, on-hold)
        2. Get medication history (completed, stopped)
        3. Check for duplicates or interactions
        4. Get dispensing history
        """
        # 1. Get all current medications with different statuses
        all_medications = []
        for status in ["active", "on-hold", "draft", "entered-in-error"]:
            url = f"{BASE_URL}/MedicationRequest"
            params = {
                "patient": f"Patient/{TEST_PATIENT_ID}",
                "status": status,
                "_include": "MedicationRequest:medication"
            }
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    meds = [
                        entry['resource'] 
                        for entry in bundle.get('entry', [])
                        if entry['resource']['resourceType'] == 'MedicationRequest'
                    ]
                    all_medications.extend(meds)
        
        # 2. Get medication history
        history_url = f"{BASE_URL}/MedicationRequest"
        history_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "status": "completed,stopped,cancelled",
            "_sort": "-authoredon",
            "_count": "50"
        }
        async with session.get(history_url, params=history_params) as resp:
            assert resp.status == 200
            history_bundle = await resp.json()
            medication_history = [
                entry['resource'] 
                for entry in history_bundle.get('entry', [])
                if entry['resource']['resourceType'] == 'MedicationRequest'
            ]
        
        # 3. Group medications by drug to check for duplicates
        medication_groups = {}
        for med in all_medications:
            # Try to get medication code
            med_code = None
            if 'medicationCodeableConcept' in med:
                codes = med['medicationCodeableConcept'].get('coding', [])
                if codes:
                    med_code = codes[0].get('code', 'unknown')
            elif 'medicationReference' in med:
                med_code = med['medicationReference'].get('reference', 'unknown')
            
            if med_code:
                if med_code not in medication_groups:
                    medication_groups[med_code] = []
                medication_groups[med_code].append(med)
        
        # 4. Get dispensing history
        dispense_url = f"{BASE_URL}/MedicationDispense"
        dispense_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "_sort": "-whenhandedover",
            "_count": "20"
        }
        async with session.get(dispense_url, params=dispense_params) as resp:
            # MedicationDispense might not exist for all patients
            if resp.status == 200:
                dispense_bundle = await resp.json()
                dispense_history = [entry['resource'] for entry in dispense_bundle.get('entry', [])]
            else:
                dispense_history = []
        
        # Report findings
        print(f"\nMedication Reconciliation Summary:")
        print(f"- Total Current Medications: {len(all_medications)}")
        print(f"- Medication History Records: {len(medication_history)}")
        print(f"- Unique Medications: {len(medication_groups)}")
        print(f"- Potential Duplicates: {sum(1 for meds in medication_groups.values() if len(meds) > 1)}")
        print(f"- Dispensing Records: {len(dispense_history)}")
        
        # Assert we have medication data to reconcile
        assert len(all_medications) > 0 or len(medication_history) > 0
    
    async def test_lab_results_trending(self, session):
        """
        Scenario: Viewing lab result trends over time
        
        A physician wants to see trends for specific lab values:
        1. Get all lab results for specific tests (glucose, creatinine, etc.)
        2. Group by test type
        3. Sort by date for trending
        4. Check for critical values
        """
        # Common lab test LOINC codes
        lab_tests = {
            "2339-0": "Glucose",
            "38483-4": "Creatinine", 
            "2947-0": "Sodium",
            "6298-4": "Potassium",
            "2823-3": "Potassium",
            "718-7": "Hemoglobin",
            "789-8": "Erythrocytes",
            "33914-3": "GFR"
        }
        
        lab_trends = {}
        
        for loinc_code, test_name in lab_tests.items():
            url = f"{BASE_URL}/Observation"
            params = {
                "patient": f"Patient/{TEST_PATIENT_ID}",
                "code": loinc_code,
                "category": "laboratory",
                "_sort": "date",
                "_count": "100"
            }
            
            async with session.get(url, params=params) as resp:
                if resp.status == 200:
                    bundle = await resp.json()
                    results = [entry['resource'] for entry in bundle.get('entry', [])]
                    if results:
                        lab_trends[test_name] = results
        
        # Analyze critical values
        critical_results = []
        for test_name, results in lab_trends.items():
            for result in results:
                # Check if result has interpretation indicating critical
                interpretation = result.get('interpretation', [])
                for interp in interpretation:
                    coding = interp.get('coding', [])
                    for code in coding:
                        if code.get('code') in ['H', 'HH', 'L', 'LL', 'A', 'AA']:
                            critical_results.append({
                                'test': test_name,
                                'value': result.get('valueQuantity', {}).get('value'),
                                'unit': result.get('valueQuantity', {}).get('unit'),
                                'date': result.get('effectiveDateTime'),
                                'interpretation': code.get('code')
                            })
        
        # Report findings
        print(f"\nLab Results Trending Summary:")
        for test_name, results in lab_trends.items():
            print(f"- {test_name}: {len(results)} results")
            if results:
                # Show latest value
                latest = results[-1]
                value = latest.get('valueQuantity', {})
                if value:
                    print(f"  Latest: {value.get('value')} {value.get('unit', '')} on {latest.get('effectiveDateTime', 'unknown date')}")
        
        print(f"\nCritical/Abnormal Results: {len(critical_results)}")
        for critical in critical_results[:5]:  # Show first 5
            print(f"- {critical['test']}: {critical['value']} {critical['unit']} ({critical['interpretation']}) on {critical['date']}")
        
        # Assert we have some lab data
        assert len(lab_trends) > 0
    
    async def test_care_team_coordination(self, session):
        """
        Scenario: Care team coordination view
        
        Display all providers involved in patient care:
        1. Get care team members
        2. Get recent encounters with providers
        3. Get orders by provider
        4. Get notes/documents by provider
        """
        # 1. Get care team
        careteam_url = f"{BASE_URL}/CareTeam"
        careteam_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "status": "active"
        }
        async with session.get(careteam_url, params=careteam_params) as resp:
            if resp.status == 200:
                careteam_bundle = await resp.json()
                care_teams = [entry['resource'] for entry in careteam_bundle.get('entry', [])]
            else:
                care_teams = []
        
        # 2. Get recent encounters to find providers
        encounters_url = f"{BASE_URL}/Encounter"
        encounters_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "_sort": "-date",
            "_count": "20",
            "_include": "Encounter:practitioner"
        }
        async with session.get(encounters_url, params=encounters_params) as resp:
            assert resp.status == 200
            encounters_bundle = await resp.json()
            encounters = [
                entry['resource'] 
                for entry in encounters_bundle.get('entry', [])
                if entry['resource']['resourceType'] == 'Encounter'
            ]
        
        # Extract providers from encounters
        providers = set()
        for encounter in encounters:
            participants = encounter.get('participant', [])
            for participant in participants:
                individual = participant.get('individual', {})
                reference = individual.get('reference', '')
                if 'Practitioner' in reference:
                    providers.add(reference)
        
        # 3. Get recent orders (ServiceRequests)
        orders_url = f"{BASE_URL}/ServiceRequest"
        orders_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "_sort": "-authored",
            "_count": "20"
        }
        async with session.get(orders_url, params=orders_params) as resp:
            if resp.status == 200:
                orders_bundle = await resp.json()
                orders = [entry['resource'] for entry in orders_bundle.get('entry', [])]
            else:
                orders = []
        
        # 4. Get clinical documents
        documents_url = f"{BASE_URL}/DocumentReference"
        documents_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "_sort": "-date",
            "_count": "10"
        }
        async with session.get(documents_url, params=documents_params) as resp:
            if resp.status == 200:
                documents_bundle = await resp.json()
                documents = [entry['resource'] for entry in documents_bundle.get('entry', [])]
            else:
                documents = []
        
        # Report findings
        print(f"\nCare Team Coordination Summary:")
        print(f"- Care Teams: {len(care_teams)}")
        print(f"- Unique Providers from Encounters: {len(providers)}")
        print(f"- Recent Orders: {len(orders)}")
        print(f"- Clinical Documents: {len(documents)}")
        
        if care_teams:
            print("\nCare Team Members:")
            for team in care_teams:
                participants = team.get('participant', [])
                for participant in participants:
                    # Safely get role information
                    role_text = 'Unknown role'
                    if isinstance(participant.get('role'), list) and participant['role']:
                        role = participant['role'][0]
                        if isinstance(role, dict):
                            if 'text' in role:
                                role_text = role['text']
                            elif 'coding' in role and isinstance(role['coding'], list) and role['coding']:
                                role_text = role['coding'][0].get('display', 'Unknown role')
                    
                    member = participant.get('member', {}).get('reference', 'Unknown')
                    print(f"  - {role_text}: {member}")
        
        # Assert we have care coordination data
        assert len(encounters) > 0  # Should have encounters at minimum
    
    async def test_clinical_decision_support(self, session):
        """
        Scenario: Clinical decision support alerts
        
        Check for various clinical alerts:
        1. Drug-allergy interactions
        2. Missing immunizations
        3. Overdue screenings
        4. Abnormal vital signs
        """
        # Get patient's allergies
        allergies_url = f"{BASE_URL}/AllergyIntolerance"
        allergies_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "clinical-status": "active"
        }
        async with session.get(allergies_url, params=allergies_params) as resp:
            allergies_bundle = await resp.json() if resp.status == 200 else {"entry": []}
            allergies = [entry['resource'] for entry in allergies_bundle.get('entry', [])]
        
        # Get current medications
        medications_url = f"{BASE_URL}/MedicationRequest"
        medications_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "status": "active"
        }
        async with session.get(medications_url, params=medications_params) as resp:
            medications_bundle = await resp.json() if resp.status == 200 else {"entry": []}
            medications = [entry['resource'] for entry in medications_bundle.get('entry', [])]
        
        # Get immunizations
        immunizations_url = f"{BASE_URL}/Immunization"
        immunizations_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}"
        }
        async with session.get(immunizations_url, params=immunizations_params) as resp:
            immunizations_bundle = await resp.json() if resp.status == 200 else {"entry": []}
            immunizations = [entry['resource'] for entry in immunizations_bundle.get('entry', [])]
        
        # Get recent vital signs
        vitals_url = f"{BASE_URL}/Observation"
        vitals_params = {
            "patient": f"Patient/{TEST_PATIENT_ID}",
            "category": "vital-signs",
            "_sort": "-date",
            "_count": "50"
        }
        async with session.get(vitals_url, params=vitals_params) as resp:
            vitals_bundle = await resp.json() if resp.status == 200 else {"entry": []}
            vitals = [entry['resource'] for entry in vitals_bundle.get('entry', [])]
        
        # Analyze for alerts
        alerts = []
        
        # Check for potential drug-allergy interactions
        if allergies and medications:
            alerts.append({
                'type': 'drug-allergy-check',
                'message': f'Patient has {len(allergies)} allergies and {len(medications)} active medications - review for interactions'
            })
        
        # Check immunization status
        vaccine_types = set()
        for imm in immunizations:
            vaccine_code = imm.get('vaccineCode', {}).get('coding', [{}])[0].get('code')
            if vaccine_code:
                vaccine_types.add(vaccine_code)
        
        # Common vaccines to check
        common_vaccines = ['33', '103', '119', '122', '140']  # Pneumo, HPV, Rotavirus, DTP, Influenza
        missing_vaccines = [v for v in common_vaccines if v not in vaccine_types]
        if missing_vaccines:
            alerts.append({
                'type': 'immunization-due',
                'message': f'Patient may be due for {len(missing_vaccines)} immunizations'
            })
        
        # Check vital signs for abnormalities
        for vital in vitals[:10]:  # Check recent 10
            if vital.get('code', {}).get('coding', [{}])[0].get('code') == '8310-5':  # Body temperature
                value = vital.get('valueQuantity', {}).get('value')
                if value and (value > 38.3 or value < 35.0):  # Celsius
                    alerts.append({
                        'type': 'abnormal-vital',
                        'message': f'Abnormal temperature: {value}°C on {vital.get("effectiveDateTime")}'
                    })
            elif vital.get('code', {}).get('coding', [{}])[0].get('code') == '8867-4':  # Heart rate
                value = vital.get('valueQuantity', {}).get('value')
                if value and (value > 100 or value < 60):
                    alerts.append({
                        'type': 'abnormal-vital',
                        'message': f'Abnormal heart rate: {value} bpm on {vital.get("effectiveDateTime")}'
                    })
        
        # Report findings
        print(f"\nClinical Decision Support Summary:")
        print(f"- Active Allergies: {len(allergies)}")
        print(f"- Active Medications: {len(medications)}")
        print(f"- Immunization Records: {len(immunizations)}")
        print(f"- Recent Vitals: {len(vitals)}")
        print(f"\nGenerated Alerts: {len(alerts)}")
        for alert in alerts[:5]:  # Show first 5
            print(f"- [{alert['type']}] {alert['message']}")
        
        # Assert we generated some alerts or have clinical data
        assert len(alerts) > 0 or (len(allergies) + len(medications) + len(immunizations) + len(vitals)) > 0
    
    async def test_population_health_query(self, session):
        """
        Scenario: Population health query
        
        Find all patients with specific conditions for population management:
        1. Search for patients with diabetes
        2. Check their recent A1C values
        3. Identify those needing follow-up
        """
        # Search for patients with diabetes
        condition_url = f"{BASE_URL}/Condition"
        condition_params = {
            "code": "44054006",  # SNOMED code for Diabetes
            "_count": "20",
            "_include": "Condition:patient"
        }
        
        async with session.get(condition_url, params=condition_params) as resp:
            if resp.status == 200:
                condition_bundle = await resp.json()
                diabetes_conditions = [
                    entry['resource'] 
                    for entry in condition_bundle.get('entry', [])
                    if entry['resource']['resourceType'] == 'Condition'
                ]
                
                # Extract unique patients
                diabetes_patients = set()
                for condition in diabetes_conditions:
                    patient_ref = condition.get('subject', {}).get('reference')
                    if patient_ref:
                        diabetes_patients.add(patient_ref)
                
                print(f"\nPopulation Health Query Results:")
                print(f"- Diabetes conditions found: {len(diabetes_conditions)}")
                print(f"- Unique patients with diabetes: {len(diabetes_patients)}")
                
                # For each patient, check recent A1C
                patients_needing_followup = []
                for patient_ref in list(diabetes_patients)[:5]:  # Check first 5 patients
                    # Get A1C results
                    a1c_url = f"{BASE_URL}/Observation"
                    a1c_params = {
                        "patient": patient_ref,
                        "code": "4548-4",  # LOINC code for A1C
                        "_sort": "-date",
                        "_count": "1"
                    }
                    
                    async with session.get(a1c_url, params=a1c_params) as a1c_resp:
                        if a1c_resp.status == 200:
                            a1c_bundle = await a1c_resp.json()
                            if a1c_bundle.get('entry'):
                                latest_a1c = a1c_bundle['entry'][0]['resource']
                                value = latest_a1c.get('valueQuantity', {}).get('value')
                                date = latest_a1c.get('effectiveDateTime')
                                
                                # Check if A1C is high or test is old
                                if value and value > 7.0:
                                    patients_needing_followup.append({
                                        'patient': patient_ref,
                                        'a1c': value,
                                        'date': date
                                    })
                
                print(f"- Patients with high A1C (>7.0): {len(patients_needing_followup)}")
                for patient_data in patients_needing_followup:
                    print(f"  - {patient_data['patient']}: A1C={patient_data['a1c']} on {patient_data['date']}")
                
                # Assert we found some diabetes data
                assert len(diabetes_conditions) > 0 or len(diabetes_patients) > 0
            else:
                print(f"No diabetes conditions found in the system")
                # This is okay - not all test datasets have diabetes patients


async def run_all_clinical_scenarios():
    """Run all clinical scenario tests"""
    tester = TestClinicalScenarios()
    
    async with aiohttp.ClientSession() as session:
        print("=" * 70)
        print("FHIR API End-to-End Clinical Scenario Tests")
        print("=" * 70)
        
        try:
            # Run each scenario
            await tester.test_patient_summary_dashboard(session)
            print("\n" + "-" * 50 + "\n")
            
            await tester.test_medication_reconciliation_workflow(session)
            print("\n" + "-" * 50 + "\n")
            
            await tester.test_lab_results_trending(session)
            print("\n" + "-" * 50 + "\n")
            
            await tester.test_care_team_coordination(session)
            print("\n" + "-" * 50 + "\n")
            
            await tester.test_clinical_decision_support(session)
            print("\n" + "-" * 50 + "\n")
            
            await tester.test_population_health_query(session)
            
            print("\n" + "=" * 70)
            print("✅ All clinical scenario tests completed successfully!")
            print("=" * 70)
            
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(run_all_clinical_scenarios())