#!/usr/bin/env python3
"""
Comprehensive report on patients with hypertension including recent vitals and medications
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session
from database.database import SessionLocal
from models.models import Patient, Condition, Observation, Medication, Encounter
from datetime import datetime, timedelta

def get_recent_blood_pressure(db, patient_id):
    """Get most recent blood pressure readings for a patient"""
    # LOINC codes for blood pressure
    systolic_code = '8480-6'  # Systolic blood pressure
    diastolic_code = '8462-4'  # Diastolic blood pressure
    
    # Get most recent systolic
    systolic = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.loinc_code == systolic_code
        )
    ).order_by(Observation.observation_date.desc()).first()
    
    # Get most recent diastolic
    diastolic = db.query(Observation).filter(
        and_(
            Observation.patient_id == patient_id,
            Observation.loinc_code == diastolic_code
        )
    ).order_by(Observation.observation_date.desc()).first()
    
    return systolic, diastolic

def get_hypertension_medications(db, patient_id):
    """Get active medications for hypertension"""
    # Common antihypertensive medication keywords
    hypertension_med_keywords = [
        'lisinopril', 'amlodipine', 'metoprolol', 'losartan', 'hydrochlorothiazide',
        'atenolol', 'captopril', 'enalapril', 'ramipril', 'valsartan',
        'diltiazem', 'propranolol', 'carvedilol', 'furosemide', 'spironolactone'
    ]
    
    # Build OR conditions for medication names
    med_conditions = []
    for keyword in hypertension_med_keywords:
        med_conditions.append(Medication.medication_name.ilike(f'%{keyword}%'))
    
    medications = db.query(Medication).filter(
        and_(
            Medication.patient_id == patient_id,
            Medication.status == 'active',
            or_(*med_conditions)
        )
    ).all()
    
    return medications

def generate_hypertension_report():
    """Generate comprehensive report on hypertension patients"""
    
    db = SessionLocal()
    try:
        # Get all patients with hypertension
        hypertension_snomed = '59621000'  # Essential hypertension
        
        results = db.query(Patient, Condition).join(
            Condition, Patient.id == Condition.patient_id
        ).filter(
            Condition.snomed_code == hypertension_snomed
        ).all()
        
        # Group by patient
        patients_data = {}
        for patient, condition in results:
            if patient.id not in patients_data:
                patients_data[patient.id] = {
                    'patient': patient,
                    'condition': condition
                }
        
        print(f"\n{'='*100}")
        print(f"COMPREHENSIVE HYPERTENSION PATIENT REPORT")
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*100}\n")
        
        print(f"Total patients with hypertension: {len(patients_data)}\n")
        
        for idx, (patient_id, data) in enumerate(patients_data.items(), 1):
            patient = data['patient']
            condition = data['condition']
            
            # Calculate age
            if patient.date_of_birth:
                today = datetime.now().date()
                age = today.year - patient.date_of_birth.year - (
                    (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day)
                )
            else:
                age = "Unknown"
            
            print(f"\n{'-'*100}")
            print(f"PATIENT {idx}: {patient.first_name} {patient.last_name}")
            print(f"{'-'*100}")
            
            # Demographics
            print(f"\nDEMOGRAPHICS:")
            print(f"  - Patient ID: {patient.id}")
            print(f"  - MRN: {patient.mrn}")
            print(f"  - Age: {age} years")
            print(f"  - Gender: {patient.gender}")
            print(f"  - DOB: {patient.date_of_birth}")
            if patient.city and patient.state:
                print(f"  - Location: {patient.city}, {patient.state}")
            
            # Hypertension diagnosis
            print(f"\nHYPERTENSION DIAGNOSIS:")
            print(f"  - Description: {condition.description}")
            print(f"  - SNOMED Code: {condition.snomed_code}")
            print(f"  - Onset Date: {condition.onset_date}")
            print(f"  - Clinical Status: {condition.clinical_status}")
            
            # Calculate duration
            if condition.onset_date:
                duration = datetime.now() - condition.onset_date
                years = duration.days // 365
                months = (duration.days % 365) // 30
                print(f"  - Duration: {years} years, {months} months")
            
            # Recent blood pressure
            print(f"\nMOST RECENT BLOOD PRESSURE:")
            systolic, diastolic = get_recent_blood_pressure(db, patient.id)
            
            if systolic and diastolic:
                bp_date = systolic.observation_date
                sys_value = systolic.value_quantity
                dia_value = diastolic.value_quantity
                print(f"  - Date: {bp_date.strftime('%Y-%m-%d')}")
                print(f"  - Reading: {int(sys_value)}/{int(dia_value)} mmHg")
                
                # Interpret BP
                if sys_value >= 140 or dia_value >= 90:
                    print(f"  - Status: ELEVATED (Stage 2 Hypertension)")
                elif sys_value >= 130 or dia_value >= 80:
                    print(f"  - Status: ELEVATED (Stage 1 Hypertension)")
                elif sys_value >= 120 and sys_value < 130:
                    print(f"  - Status: Elevated Blood Pressure")
                else:
                    print(f"  - Status: Normal")
            else:
                print(f"  - No blood pressure readings found")
            
            # Medications
            print(f"\nANTIHYPERTENSIVE MEDICATIONS:")
            medications = get_hypertension_medications(db, patient.id)
            
            if medications:
                for med in medications:
                    print(f"  - {med.medication_name}")
                    if med.dosage:
                        print(f"    Dosage: {med.dosage}")
                    if med.start_date:
                        print(f"    Started: {med.start_date}")
            else:
                print(f"  - No antihypertensive medications found")
            
            # Recent encounters
            print(f"\nRECENT ENCOUNTERS:")
            recent_encounters = db.query(Encounter).filter(
                Encounter.patient_id == patient.id
            ).order_by(Encounter.encounter_date.desc()).limit(3).all()
            
            if recent_encounters:
                for enc in recent_encounters:
                    print(f"  - {enc.encounter_date.strftime('%Y-%m-%d')}: {enc.encounter_type}")
                    if enc.reason_description:
                        print(f"    Reason: {enc.reason_description}")
            else:
                print(f"  - No recent encounters found")
        
        # Summary statistics
        print(f"\n\n{'='*100}")
        print(f"SUMMARY STATISTICS")
        print(f"{'='*100}\n")
        
        # Age distribution
        age_groups = {'<40': 0, '40-59': 0, '60-79': 0, '80+': 0}
        for patient_id, data in patients_data.items():
            patient = data['patient']
            if patient.date_of_birth:
                today = datetime.now().date()
                age = today.year - patient.date_of_birth.year - (
                    (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day)
                )
                if age < 40:
                    age_groups['<40'] += 1
                elif age < 60:
                    age_groups['40-59'] += 1
                elif age < 80:
                    age_groups['60-79'] += 1
                else:
                    age_groups['80+'] += 1
        
        print("Age Distribution:")
        for group, count in age_groups.items():
            print(f"  - {group}: {count} patients")
        
        # Gender distribution
        gender_counts = {}
        for patient_id, data in patients_data.items():
            gender = data['patient'].gender
            gender_counts[gender] = gender_counts.get(gender, 0) + 1
        
        print("\nGender Distribution:")
        for gender, count in gender_counts.items():
            print(f"  - {gender}: {count} patients")
        
    except Exception as e:
        print(f"Error generating report: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    generate_hypertension_report()