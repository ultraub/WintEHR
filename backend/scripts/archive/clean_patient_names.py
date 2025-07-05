#!/usr/bin/env python3
"""
Clean up patient names by removing numeric suffixes
"""

import re
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from database.database import DATABASE_URL

def clean_name(name):
    """Remove numbers from name"""
    # Remove numbers and keep only letters, spaces, and common name characters
    cleaned = re.sub(r'\d+', '', name)
    return cleaned.strip()

def clean_patient_names():
    """Clean all patient names in the database"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Get all patients
        result = conn.execute(text("SELECT id, first_name, last_name FROM patients"))
        patients = result.fetchall()
        
        print(f"Cleaning names for {len(patients)} patients...")
        
        # Update each patient
        for patient_id, first_name, last_name in patients:
            clean_first = clean_name(first_name)
            clean_last = clean_name(last_name)
            
            if clean_first != first_name or clean_last != last_name:
                print(f"Updating: {first_name} {last_name} -> {clean_first} {clean_last}")
                conn.execute(
                    text("UPDATE patients SET first_name = :first, last_name = :last WHERE id = :id"),
                    {"first": clean_first, "last": clean_last, "id": patient_id}
                )
        
        conn.commit()
        print("Done!")

if __name__ == "__main__":
    clean_patient_names()