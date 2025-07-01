#!/usr/bin/env python3
"""
Script to check what diagnosis codes are present in the conditions table
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, distinct
from database.database import SessionLocal
from models.models import Condition

def check_condition_codes():
    """Check what diagnosis codes are available in the database"""
    
    db = SessionLocal()
    try:
        # Check total number of conditions
        total_conditions = db.query(func.count(Condition.id)).scalar()
        print(f"\nTotal conditions in database: {total_conditions}")
        
        # Check conditions with SNOMED codes
        snomed_count = db.query(func.count(Condition.id)).filter(
            Condition.snomed_code.isnot(None)
        ).scalar()
        print(f"Conditions with SNOMED codes: {snomed_count}")
        
        # Check conditions with ICD-10 codes
        icd10_count = db.query(func.count(Condition.id)).filter(
            Condition.icd10_code.isnot(None)
        ).scalar()
        print(f"Conditions with ICD-10 codes: {icd10_count}")
        
        # Show sample of conditions with hypertension
        print(f"\n{'='*80}")
        print("HYPERTENSION-RELATED CONDITIONS")
        print(f"{'='*80}\n")
        
        # Search for conditions with "hypertension" in description
        hypertension_conditions = db.query(Condition).filter(
            Condition.description.ilike('%hypertension%')
        ).limit(10).all()
        
        if hypertension_conditions:
            print(f"Found {len(hypertension_conditions)} conditions with 'hypertension' in description:\n")
            for condition in hypertension_conditions:
                print(f"Description: {condition.description}")
                print(f"  - SNOMED: {condition.snomed_code or 'None'}")
                print(f"  - ICD-10: {condition.icd10_code or 'None'}")
                print(f"  - Status: {condition.clinical_status}")
                print()
        
        # Show unique SNOMED codes for hypertension
        print(f"\n{'='*80}")
        print("UNIQUE SNOMED CODES FOR HYPERTENSION")
        print(f"{'='*80}\n")
        
        unique_hypertension_snomed = db.query(
            distinct(Condition.snomed_code),
            Condition.description
        ).filter(
            Condition.description.ilike('%hypertension%')
        ).all()
        
        for snomed_code, description in unique_hypertension_snomed:
            print(f"SNOMED: {snomed_code} - {description}")
        
        # Check if there are any conditions with ICD-10 codes starting with I10
        print(f"\n{'='*80}")
        print("ICD-10 CODES STARTING WITH I10")
        print(f"{'='*80}\n")
        
        icd10_hypertension = db.query(Condition).filter(
            Condition.icd10_code.like('I10%')
        ).limit(10).all()
        
        if icd10_hypertension:
            print(f"Found {len(icd10_hypertension)} conditions with ICD-10 codes starting with I10:")
            for condition in icd10_hypertension:
                print(f"  - ICD-10: {condition.icd10_code} - {condition.description}")
        else:
            print("No conditions found with ICD-10 codes starting with I10")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_condition_codes()