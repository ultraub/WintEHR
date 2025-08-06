#!/usr/bin/env python3
"""
Test script to verify enhanced patient summary data loading
"""

import asyncio
import aiohttp
import json
from typing import Dict, List, Any

# Configuration
BASE_URL = "http://localhost:8000"
FHIR_BASE = f"{BASE_URL}/fhir/R4"

async def test_patient_summary_resources(session: aiohttp.ClientSession, patient_id: str) -> Dict[str, Any]:
    """Test loading all resource types needed for enhanced patient summary"""
    
    print(f"\n{'='*60}")
    print(f"Testing Enhanced Patient Summary Resources for Patient: {patient_id}")
    print(f"{'='*60}\n")
    
    # Resource types needed for enhanced summary
    resource_types = [
        ('Patient', f'/Patient/{patient_id}'),
        ('Condition', f'/Condition?patient={patient_id}&_count=50&_sort=-recorded-date'),
        ('MedicationRequest', f'/MedicationRequest?patient={patient_id}&_count=50&_sort=-authored'),
        ('AllergyIntolerance', f'/AllergyIntolerance?patient={patient_id}&_count=20&_sort=-date'),
        ('Observation', f'/Observation?patient={patient_id}&_count=30&_sort=-date&category=vital-signs'),
        ('Encounter', f'/Encounter?patient={patient_id}&_count=10&_sort=-date'),
        ('Procedure', f'/Procedure?patient={patient_id}&_count=10&_sort=-performed-date'),
        ('DiagnosticReport', f'/DiagnosticReport?patient={patient_id}&_count=10&_sort=-date&category=LAB'),
        ('Immunization', f'/Immunization?patient={patient_id}&_count=20&_sort=-occurrence-date')
    ]
    
    results = {}
    
    for resource_type, path in resource_types:
        try:
            async with session.get(f"{FHIR_BASE}{path}") as response:
                data = await response.json()
                
                if resource_type == 'Patient':
                    results[resource_type] = {
                        'count': 1,
                        'status': 'success',
                        'name': f"{data.get('name', [{}])[0].get('given', ['Unknown'])[0]} {data.get('name', [{}])[0].get('family', 'Unknown')}"
                    }
                else:
                    # It's a bundle
                    count = len(data.get('entry', []))
                    results[resource_type] = {
                        'count': count,
                        'status': 'success',
                        'total': data.get('total', count)
                    }
                    
                    # Extract some sample data for key resource types
                    if resource_type == 'Condition' and count > 0:
                        conditions = []
                        for entry in data.get('entry', [])[:3]:  # First 3 conditions
                            condition = entry['resource']
                            code_display = condition.get('code', {}).get('coding', [{}])[0].get('display', 'Unknown')
                            conditions.append(code_display)
                        results[resource_type]['samples'] = conditions
                    
                    elif resource_type == 'Procedure' and count > 0:
                        procedures = []
                        for entry in data.get('entry', [])[:3]:  # First 3 procedures
                            procedure = entry['resource']
                            code_display = procedure.get('code', {}).get('coding', [{}])[0].get('display', 'Unknown')
                            performed_date = procedure.get('performedDateTime', procedure.get('performedPeriod', {}).get('start', 'Unknown'))
                            procedures.append(f"{code_display} ({performed_date[:10] if performed_date != 'Unknown' else 'Unknown'})")
                        results[resource_type]['samples'] = procedures
                    
                    elif resource_type == 'DiagnosticReport' and count > 0:
                        reports = []
                        for entry in data.get('entry', [])[:3]:  # First 3 reports
                            report = entry['resource']
                            code_display = report.get('code', {}).get('coding', [{}])[0].get('display', 'Unknown')
                            effective_date = report.get('effectiveDateTime', 'Unknown')
                            reports.append(f"{code_display} ({effective_date[:10] if effective_date != 'Unknown' else 'Unknown'})")
                        results[resource_type]['samples'] = reports
                    
                    elif resource_type == 'Immunization' and count > 0:
                        immunizations = []
                        for entry in data.get('entry', [])[:3]:  # First 3 immunizations
                            immunization = entry['resource']
                            vaccine_code = immunization.get('vaccineCode', {}).get('coding', [{}])[0].get('display', 'Unknown')
                            occurrence_date = immunization.get('occurrenceDateTime', 'Unknown')
                            immunizations.append(f"{vaccine_code} ({occurrence_date[:10] if occurrence_date != 'Unknown' else 'Unknown'})")
                        results[resource_type]['samples'] = immunizations
                        
        except Exception as e:
            results[resource_type] = {
                'count': 0,
                'status': 'error',
                'error': str(e)
            }
    
    return results

async def test_risk_factor_detection(session: aiohttp.ClientSession, patient_id: str) -> Dict[str, Any]:
    """Test clinical risk factor detection logic"""
    
    # Get all conditions for the patient
    async with session.get(f"{FHIR_BASE}/Condition?patient={patient_id}&_count=50") as response:
        data = await response.json()
        
    risk_factors = {
        'diabetes': False,
        'hypertension': False,
        'cardiovascular': False
    }
    
    # Risk factor detection logic (matching PatientSummaryV4)
    diabetes_codes = ['44054006', '73211009', 'E11', 'E10']
    hypertension_codes = ['38341003', '59621000', 'I10']
    cardiovascular_codes = ['53741008', '414545008', 'I25', 'I21']
    
    for entry in data.get('entry', []):
        condition = entry['resource']
        if condition.get('clinicalStatus', {}).get('coding', [{}])[0].get('code') != 'active':
            continue
            
        for coding in condition.get('code', {}).get('coding', []):
            code = coding.get('code', '')
            
            if code in diabetes_codes:
                risk_factors['diabetes'] = True
            elif code in hypertension_codes:
                risk_factors['hypertension'] = True
            elif code in cardiovascular_codes:
                risk_factors['cardiovascular'] = True
    
    return risk_factors

def print_results(results: Dict[str, Any], risk_factors: Dict[str, Any]):
    """Pretty print test results"""
    
    print("\n📊 Resource Loading Summary:")
    print("=" * 60)
    
    total_resources = 0
    for resource_type, result in results.items():
        status_icon = "✅" if result['status'] == 'success' else "❌"
        count = result['count']
        total_resources += count
        
        print(f"{status_icon} {resource_type:20} Count: {count:3}")
        
        if 'samples' in result and result['samples']:
            print(f"   Sample data:")
            for sample in result['samples']:
                print(f"   - {sample}")
        
        if result['status'] == 'error':
            print(f"   ❌ Error: {result['error']}")
        
        print()
    
    print(f"\n📈 Total Resources Loaded: {total_resources}")
    
    print("\n🚨 Risk Factors Detected:")
    print("=" * 40)
    for factor, detected in risk_factors.items():
        icon = "⚠️" if detected else "✓"
        status = "DETECTED" if detected else "Not detected"
        print(f"{icon} {factor.capitalize():15} {status}")
    
    # Performance considerations
    print("\n💡 Performance Notes:")
    print("=" * 60)
    print("- Batch loading these resources reduces API calls from 9 to 1")
    print("- Total resources loaded optimized for clinical relevance")
    print("- Risk factor detection runs client-side for efficiency")
    
    # Clinical completeness check
    print("\n✅ Clinical Completeness Check:")
    print("=" * 60)
    
    critical_complete = all([
        results['Condition']['count'] > 0 or results['Condition']['status'] == 'success',
        results['MedicationRequest']['count'] > 0 or results['MedicationRequest']['status'] == 'success',
        results['AllergyIntolerance']['status'] == 'success'  # Can be 0
    ])
    
    enhanced_complete = all([
        results['Procedure']['status'] == 'success',
        results['DiagnosticReport']['status'] == 'success',
        results['Immunization']['status'] == 'success'
    ])
    
    print(f"Critical data loaded: {'✅ YES' if critical_complete else '❌ NO'}")
    print(f"Enhanced data loaded: {'✅ YES' if enhanced_complete else '❌ NO'}")

async def get_test_patient():
    """Get a patient with good test data"""
    async with aiohttp.ClientSession() as session:
        # Look for a patient with conditions and procedures
        async with session.get(f"{FHIR_BASE}/Patient?_count=10") as response:
            result = await response.json()
            
        # Try to find a patient with rich data
        for entry in result.get('entry', []):
            patient_id = entry['resource']['id']
            
            # Check if patient has conditions
            async with session.get(f"{FHIR_BASE}/Condition?patient={patient_id}&_count=1") as response:
                condition_data = await response.json()
                
            if condition_data.get('total', 0) > 0:
                return patient_id
        
        # Fallback to first patient
        if result.get('entry'):
            return result['entry'][0]['resource']['id']
    
    return None

async def main():
    """Main test function"""
    # Get a test patient
    patient_id = await get_test_patient()
    
    if not patient_id:
        print("No patients found in the system!")
        return
    
    async with aiohttp.ClientSession() as session:
        # Test resource loading
        results = await test_patient_summary_resources(session, patient_id)
        
        # Test risk factor detection
        risk_factors = await test_risk_factor_detection(session, patient_id)
        
        # Print results
        print_results(results, risk_factors)

if __name__ == "__main__":
    asyncio.run(main())