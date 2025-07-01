#!/usr/bin/env python3
"""
Script to find patients with hypertension diagnosis
Searches for both SNOMED and ICD-10 codes
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from database.database import SessionLocal
from models.models import Patient, Condition  # Import from models.py which handles all imports
from datetime import datetime

def find_hypertension_patients():
    """Find all patients with hypertension diagnosis"""
    
    # Common hypertension codes
    # SNOMED codes for hypertension
    hypertension_snomed_codes = [
        '38341003',  # Hypertensive disorder, systemic arterial (disorder)
        '59621000',  # Essential hypertension (disorder)
        '1201005',   # Benign essential hypertension (disorder)
        '31387002',  # Essential hypertension NOS (disorder)
        '73410007',  # Benign secondary hypertension (disorder)
        '84094009',  # Rebound hypertension (disorder)
        '428575007', # Hypertension secondary to renal disease in obstetric context
    ]
    
    # ICD-10 codes for hypertension
    hypertension_icd10_prefixes = ['I10', 'I11', 'I12', 'I13', 'I15']
    
    db = SessionLocal()
    try:
        # Build the query
        query = db.query(Patient, Condition).join(
            Condition, Patient.id == Condition.patient_id
        )
        
        # Create OR conditions for all hypertension codes
        snomed_conditions = [Condition.snomed_code == code for code in hypertension_snomed_codes]
        icd10_conditions = [Condition.icd10_code.like(f'{prefix}%') for prefix in hypertension_icd10_prefixes]
        
        # Combine all conditions
        all_conditions = or_(
            *snomed_conditions,
            *icd10_conditions
        )
        
        # Apply the filter
        results = query.filter(all_conditions).all()
        
        # Process and display results
        print(f"\n{'='*80}")
        print(f"PATIENTS WITH HYPERTENSION DIAGNOSIS")
        print(f"{'='*80}\n")
        
        if not results:
            print("No patients found with hypertension diagnosis.")
            return
        
        # Group by patient to avoid duplicates
        patients_data = {}
        for patient, condition in results:
            if patient.id not in patients_data:
                patients_data[patient.id] = {
                    'patient': patient,
                    'conditions': []
                }
            patients_data[patient.id]['conditions'].append(condition)
        
        print(f"Found {len(patients_data)} patients with hypertension:\n")
        
        for idx, (patient_id, data) in enumerate(patients_data.items(), 1):
            patient = data['patient']
            conditions = data['conditions']
            
            # Calculate age
            if patient.date_of_birth:
                today = datetime.now().date()
                age = today.year - patient.date_of_birth.year - (
                    (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day)
                )
            else:
                age = "Unknown"
            
            print(f"{idx}. {patient.first_name} {patient.last_name}")
            print(f"   - Patient ID: {patient.id}")
            print(f"   - MRN: {patient.mrn}")
            print(f"   - Age: {age}")
            print(f"   - Gender: {patient.gender}")
            print(f"   - Date of Birth: {patient.date_of_birth}")
            
            print(f"   - Hypertension Diagnoses:")
            for condition in conditions:
                print(f"     * {condition.description}")
                if condition.snomed_code:
                    print(f"       SNOMED: {condition.snomed_code}")
                if condition.icd10_code:
                    print(f"       ICD-10: {condition.icd10_code}")
                print(f"       Onset: {condition.onset_date}")
                print(f"       Status: {condition.clinical_status}")
            
            # Add location info if available
            if patient.city and patient.state:
                print(f"   - Location: {patient.city}, {patient.state}")
            
            print()
        
        # Summary statistics
        print(f"\n{'='*80}")
        print(f"SUMMARY STATISTICS")
        print(f"{'='*80}\n")
        
        # Count by code type
        snomed_count = sum(1 for p, c in results if c.snomed_code in hypertension_snomed_codes)
        icd10_count = sum(1 for p, c in results if c.icd10_code and any(c.icd10_code.startswith(prefix) for prefix in hypertension_icd10_prefixes))
        
        print(f"Total patients with hypertension: {len(patients_data)}")
        print(f"Total hypertension conditions: {len(results)}")
        print(f"Conditions with SNOMED codes: {snomed_count}")
        print(f"Conditions with ICD-10 codes: {icd10_count}")
        
        # Active vs resolved
        active_count = sum(1 for p, c in results if c.clinical_status == 'active')
        resolved_count = sum(1 for p, c in results if c.clinical_status == 'resolved')
        
        print(f"\nCondition Status:")
        print(f"  - Active: {active_count}")
        print(f"  - Resolved: {resolved_count}")
        print(f"  - Other: {len(results) - active_count - resolved_count}")
        
    except Exception as e:
        print(f"Error querying database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    find_hypertension_patients()