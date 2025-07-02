#!/usr/bin/env python3
"""
Create sample patients without Synthea
Simple script to generate demo patient data for testing
"""

import random
import uuid
from datetime import datetime, timedelta
from faker import Faker
from database.database import get_db
from models.synthea_models import Patient, Encounter, Observation, Condition, Medication
from models.models import Provider

fake = Faker()

# Common conditions
CONDITIONS = [
    ("I10", "Essential hypertension"),
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("J45.909", "Unspecified asthma, uncomplicated"),
    ("K21.9", "Gastro-esophageal reflux disease without esophagitis"),
    ("F41.1", "Generalized anxiety disorder"),
    ("M79.3", "Myalgia"),
    ("R50.9", "Fever, unspecified"),
    ("J06.9", "Acute upper respiratory infection, unspecified"),
]

# Common medications
MEDICATIONS = [
    ("387458008", "Aspirin 81 MG Oral Tablet", "81 mg daily"),
    ("316049000", "Lisinopril 10 MG Oral Tablet", "10 mg daily"),
    ("860975006", "Metformin 500 MG Oral Tablet", "500 mg twice daily"),
    ("197361008", "Atorvastatin 20 MG Oral Tablet", "20 mg daily"),
    ("372756006", "Warfarin 5 MG Oral Tablet", "5 mg daily"),
    ("866439002", "Cetirizine 10 MG Oral Tablet", "10 mg daily"),
]

# Vital signs ranges
VITAL_RANGES = {
    "8867-4": (96, 100),  # Heart rate
    "8480-6": (110, 130),  # Systolic BP
    "8462-4": (70, 85),   # Diastolic BP
    "8310-5": (97.5, 99.0),  # Body temperature
    "9279-1": (12, 20),   # Respiratory rate
    "2708-6": (95, 100), # Oxygen saturation
    "29463-7": (60, 100), # Body weight kg
    "8302-2": (150, 190), # Body height cm
}

def create_sample_patients(num_patients=10):
    """Create sample patients with associated data"""
    db = next(get_db())
    
    try:
        # Get providers
        providers = db.query(Provider).filter(Provider.active == True).all()
        if not providers:
            print("❌ No providers found. Please run create_sample_providers.py first.")
            return
        
        print(f"🏥 Creating {num_patients} Sample Patients")
        print("=" * 50)
        
        patients_created = 0
        
        for i in range(num_patients):
            # Create patient
            patient = Patient(
                id=str(uuid.uuid4()),
                ssn=fake.ssn(),
                drivers=f"S{fake.random_number(digits=8)}",
                passport=None,
                prefix=random.choice([None, "Mr.", "Ms.", "Mrs.", "Dr."]),
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                suffix=None,
                maiden_name=fake.last_name() if random.random() < 0.3 else None,
                marital_status=random.choice(["M", "S", "D", "W"]),
                race=random.choice(["white", "black", "asian", "other"]),
                ethnicity=random.choice(["hispanic", "nonhispanic"]),
                gender=random.choice(["M", "F"]),
                birthplace=f"{fake.city()}, {fake.state_abbr()}",
                address=fake.street_address(),
                city=fake.city(),
                state=fake.state_abbr(),
                county=fake.city(),
                fips=fake.random_number(digits=5),
                zip_code=fake.zipcode(),
                latitude=float(fake.latitude()),
                longitude=float(fake.longitude()),
                phone=fake.phone_number(),
                birthdate=fake.date_of_birth(minimum_age=18, maximum_age=85),
                deathdate=None,
                healthcare_expenses=round(random.uniform(1000, 50000), 2),
                healthcare_coverage=round(random.uniform(500, 40000), 2),
                income=random.randint(20000, 150000)
            )
            
            # Calculate age for vital signs
            age = (datetime.now().date() - patient.birthdate).days // 365
            
            db.add(patient)
            db.flush()  # Get patient ID
            
            # Assign to random provider
            provider = random.choice(providers)
            
            # Create encounters (1-3 per patient)
            num_encounters = random.randint(1, 3)
            for j in range(num_encounters):
                encounter_date = fake.date_time_between(start_date='-1y', end_date='now')
                
                encounter = Encounter(
                    id=str(uuid.uuid4()),
                    start=encounter_date,
                    stop=encounter_date + timedelta(hours=random.randint(1, 4)),
                    patient_id=patient.id,
                    organization_id=provider.organization_id,
                    provider_id=provider.id,
                    encounter_class=random.choice(["ambulatory", "emergency", "inpatient"]),
                    code="185345009",
                    description="Encounter for symptom",
                    base_encounter_cost=round(random.uniform(100, 1000), 2),
                    total_claim_cost=round(random.uniform(100, 1500), 2),
                    payer_coverage=round(random.uniform(50, 1200), 2),
                    reason_code=random.choice(["10509002", "38341003", "195662009", "25064002"])[0] if random.random() < 0.7 else None,
                    reason_description=random.choice(["Acute bronchitis", "Hypertension", "Acute respiratory infection", "Headache"]) if random.random() < 0.7 else None
                )
                db.add(encounter)
                
                # Create vital signs for this encounter
                for loinc_code, (min_val, max_val) in VITAL_RANGES.items():
                    # Adjust ranges based on age
                    if loinc_code == "8867-4" and age > 60:  # Heart rate
                        min_val, max_val = 60, 90
                    
                    value = round(random.uniform(min_val, max_val), 1)
                    
                    observation = Observation(
                        id=str(uuid.uuid4()),
                        date=encounter_date,
                        patient_id=patient.id,
                        encounter_id=encounter.id,
                        category="vital-signs",
                        code=loinc_code,
                        description=get_vital_description(loinc_code),
                        value=str(value),
                        units=get_vital_units(loinc_code),
                        type="numeric"
                    )
                    db.add(observation)
            
            # Create conditions (0-3 per patient)
            num_conditions = random.randint(0, 3)
            for _ in range(num_conditions):
                condition_code, condition_desc = random.choice(CONDITIONS)
                condition = Condition(
                    id=str(uuid.uuid4()),
                    start=fake.date_time_between(start_date='-2y', end_date='now'),
                    stop=None,
                    patient_id=patient.id,
                    encounter_id=encounter.id,  # Last encounter
                    code=condition_code,
                    description=condition_desc
                )
                db.add(condition)
            
            # Create medications (0-3 per patient)
            num_meds = random.randint(0, 3)
            for _ in range(num_meds):
                med_code, med_desc, med_dosage = random.choice(MEDICATIONS)
                medication = Medication(
                    id=str(uuid.uuid4()),
                    start=fake.date_time_between(start_date='-1y', end_date='now'),
                    stop=None,
                    patient_id=patient.id,
                    payer_id=None,
                    encounter_id=encounter.id,  # Last encounter
                    code=med_code,
                    description=med_desc,
                    base_cost=round(random.uniform(10, 200), 2),
                    payer_coverage=round(random.uniform(5, 150), 2),
                    dispenses=random.randint(1, 12),
                    total_cost=round(random.uniform(10, 500), 2),
                    reason_code=condition.code if 'condition' in locals() else None,
                    reason_description=condition.description if 'condition' in locals() else None
                )
                db.add(medication)
            
            patients_created += 1
            if patients_created % 5 == 0:
                print(f"✓ Created {patients_created} patients...")
        
        db.commit()
        print(f"\n✅ Successfully created {patients_created} sample patients")
        
        # Print summary
        total_encounters = db.query(Encounter).count()
        total_observations = db.query(Observation).count()
        total_conditions = db.query(Condition).count()
        total_medications = db.query(Medication).count()
        
        print(f"\n📊 Database Summary:")
        print(f"   Patients: {patients_created}")
        print(f"   Encounters: {total_encounters}")
        print(f"   Observations: {total_observations}")
        print(f"   Conditions: {total_conditions}")
        print(f"   Medications: {total_medications}")
        
    except Exception as e:
        print(f"❌ Error creating patients: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

def get_vital_description(loinc_code):
    """Get description for vital sign LOINC code"""
    descriptions = {
        "8867-4": "Heart rate",
        "8480-6": "Systolic Blood Pressure",
        "8462-4": "Diastolic Blood Pressure",
        "8310-5": "Body Temperature",
        "9279-1": "Respiratory rate",
        "2708-6": "Oxygen saturation",
        "29463-7": "Body Weight",
        "8302-2": "Body Height"
    }
    return descriptions.get(loinc_code, "Vital Sign")

def get_vital_units(loinc_code):
    """Get units for vital sign LOINC code"""
    units = {
        "8867-4": "/min",
        "8480-6": "mm[Hg]",
        "8462-4": "mm[Hg]",
        "8310-5": "Cel",
        "9279-1": "/min",
        "2708-6": "%",
        "29463-7": "kg",
        "8302-2": "cm"
    }
    return units.get(loinc_code, "")

if __name__ == "__main__":
    import sys
    
    num_patients = 10
    if len(sys.argv) > 1:
        try:
            num_patients = int(sys.argv[1])
        except ValueError:
            print("Invalid number of patients. Using default: 10")
    
    create_sample_patients(num_patients)