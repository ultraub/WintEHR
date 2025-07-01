#!/usr/bin/env python3
"""
Script to check what diagnosis codes are stored in the database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from models.models import Condition
from database.database import DATABASE_URL

def check_diagnosis_codes():
    """Check and display diagnosis codes in the database"""
    
    # Create database connection
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        # Count total conditions
        total_conditions = session.query(Condition).count()
        print(f"\nTotal conditions in database: {total_conditions}")
        
        # Count unique SNOMED codes
        unique_snomed = session.query(func.count(func.distinct(Condition.snomed_code))).filter(
            Condition.snomed_code.isnot(None)
        ).scalar()
        print(f"Unique SNOMED codes: {unique_snomed}")
        
        # Count unique ICD-10 codes
        unique_icd10 = session.query(func.count(func.distinct(Condition.icd10_code))).filter(
            Condition.icd10_code.isnot(None)
        ).scalar()
        print(f"Unique ICD-10 codes: {unique_icd10}")
        
        # Get sample of unique diagnosis codes
        print("\n--- Sample SNOMED Codes and Descriptions ---")
        sample_conditions = session.query(
            Condition.snomed_code, 
            Condition.description
        ).filter(
            Condition.snomed_code.isnot(None)
        ).distinct().limit(20).all()
        
        for code, desc in sample_conditions:
            print(f"{code:20} | {desc}")
        
        # Check if any ICD-10 codes exist
        if unique_icd10 > 0:
            print("\n--- Sample ICD-10 Codes ---")
            icd10_conditions = session.query(
                Condition.icd10_code,
                Condition.description
            ).filter(
                Condition.icd10_code.isnot(None)
            ).distinct().limit(10).all()
            
            for code, desc in icd10_conditions:
                print(f"{code:10} | {desc}")
        else:
            print("\nNo ICD-10 codes found in database.")
            
        # Get most common conditions
        print("\n--- Most Common Conditions ---")
        common_conditions = session.query(
            Condition.snomed_code,
            Condition.description,
            func.count(Condition.id).label('count')
        ).filter(
            Condition.snomed_code.isnot(None)
        ).group_by(
            Condition.snomed_code,
            Condition.description
        ).order_by(
            func.count(Condition.id).desc()
        ).limit(10).all()
        
        for code, desc, count in common_conditions:
            print(f"{code:20} | {desc:50} | Count: {count}")
            
    finally:
        session.close()

if __name__ == "__main__":
    check_diagnosis_codes()