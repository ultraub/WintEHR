#\!/usr/bin/env python3
import os
import sys
sys.path.append('/app')

from database.database import SessionLocal
from models.models import Provider, Patient
from datetime import date
import uuid

# Create a test provider
db = SessionLocal()
try:
    # Check if we already have providers
    if db.query(Provider).count() == 0:
        provider = Provider(
            id=str(uuid.uuid4()),
            first_name='John',
            last_name='Smith',
            specialty='Family Medicine',
            gender='M'
        )
        db.add(provider)
        
        # Add some test patients
        patients = [
            {
                'id': str(uuid.uuid4()),
                'mrn': 'TEST001',
                'first_name': 'Jane',
                'last_name': 'Doe',
                'date_of_birth': date(1980, 1, 1),
                'gender': 'F'
            },
            {
                'id': str(uuid.uuid4()),
                'mrn': 'TEST002',
                'first_name': 'John',
                'last_name': 'Smith',
                'date_of_birth': date(1975, 5, 15),
                'gender': 'M'
            },
            {
                'id': str(uuid.uuid4()),
                'mrn': 'TEST003',
                'first_name': 'Maria',
                'last_name': 'Garcia',
                'date_of_birth': date(1990, 3, 20),
                'gender': 'F'
            }
        ]
        
        for patient_data in patients:
            patient = Patient(**patient_data)
            db.add(patient)
        
        db.commit()
        print('Test data added successfully')
        print(f'Added 1 provider and {len(patients)} patients')
    else:
        print('Data already exists')
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
