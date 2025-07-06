#!/usr/bin/env python3
import sys
sys.path.append('/Users/robertbarrett/dev/MedGenEMR/backend')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL
from fhir.resources.R4B.patient import Patient as FHIRPatient
from datetime import datetime

# Create database session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    patient_id = "b47dba3f-d775-84e6-3160-663fcea0f795"
    
    # Get patient data
    query = text("""
        SELECT resource 
        FROM fhir.resources 
        WHERE resource_type = 'Patient' 
        AND resource->>'id' = :patient_id
        AND deleted = false
        LIMIT 1
    """)
    result = db.execute(query, {'patient_id': patient_id}).first()
    
    if result:
        patient_dict = result.resource
        print(f"Patient data found: {patient_dict.get('name', [{}])[0]}")
        print(f"BirthDate in DB: {patient_dict.get('birthDate')}")
        
        # Parse as FHIR Patient
        patient = FHIRPatient(**patient_dict)
        print(f"FHIR Patient parsed successfully")
        print(f"Patient.birthDate: {patient.birthDate}")
        print(f"Type of birthDate: {type(patient.birthDate)}")
        
        # Calculate age
        if patient.birthDate:
            birth_date = patient.birthDate.date if hasattr(patient.birthDate, 'date') else patient.birthDate
            print(f"Birth date for calculation: {birth_date}")
            age = (datetime.now().date() - birth_date).days / 365.25
            print(f"Calculated age: {age:.1f}")
            print(f"Is >= 65? {age >= 65}")
    else:
        print(f"Patient {patient_id} not found")
        
finally:
    db.close()