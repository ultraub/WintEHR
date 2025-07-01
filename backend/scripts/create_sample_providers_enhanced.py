#!/usr/bin/env python3
"""
Enhanced provider creation script with configurable count
Creates realistic healthcare providers for the EMR system
"""

import sys
import os
import argparse
import random
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine
from models.models import Provider, Organization
import uuid

# Expanded provider data for dynamic generation
FIRST_NAMES = {
    'male': ['John', 'Michael', 'David', 'Robert', 'Christopher', 'Daniel', 'James', 
             'Kevin', 'Ryan', 'Matthew', 'Joseph', 'William', 'Andrew', 'Thomas',
             'Charles', 'Anthony', 'Joshua', 'Mark', 'Paul', 'Steven', 'Kenneth',
             'Edward', 'Brian', 'George', 'Ronald', 'Timothy', 'Jason', 'Jeffrey',
             'Frank', 'Scott', 'Eric', 'Stephen', 'Gregory', 'Raymond', 'Larry'],
    'female': ['Sarah', 'Emily', 'Lisa', 'Jennifer', 'Amanda', 'Jessica', 'Ashley',
               'Michelle', 'Nicole', 'Rachel', 'Mary', 'Patricia', 'Linda', 'Barbara',
               'Elizabeth', 'Susan', 'Margaret', 'Dorothy', 'Nancy', 'Karen', 'Betty',
               'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Laura',
               'Cynthia', 'Kathleen', 'Amy', 'Angela', 'Brenda', 'Emma', 'Olivia']
}

LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Anderson', 'Taylor',
               'Miller', 'Garcia', 'Martinez', 'Rodriguez', 'Lopez', 'Gonzalez',
               'Hernandez', 'Young', 'King', 'Wright', 'Hill', 'Green', 'Adams',
               'Baker', 'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips',
               'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris',
               'Murphy', 'Cook', 'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed',
               'Bailey', 'Bell', 'Gomez', 'Kelly', 'Howard', 'Ward', 'Cox', 'Richardson']

SPECIALTIES = [
    # Primary Care (40%)
    {'name': 'Family Medicine', 'weight': 20},
    {'name': 'Internal Medicine', 'weight': 15},
    {'name': 'Pediatrics', 'weight': 5},
    
    # Specialists (40%)
    {'name': 'Cardiology', 'weight': 5},
    {'name': 'Endocrinology', 'weight': 3},
    {'name': 'Dermatology', 'weight': 3},
    {'name': 'Neurology', 'weight': 4},
    {'name': 'Pulmonology', 'weight': 3},
    {'name': 'Gastroenterology', 'weight': 4},
    {'name': 'Rheumatology', 'weight': 2},
    {'name': 'Nephrology', 'weight': 3},
    {'name': 'Hematology/Oncology', 'weight': 3},
    {'name': 'Infectious Disease', 'weight': 2},
    {'name': 'Allergy/Immunology', 'weight': 2},
    {'name': 'Psychiatry', 'weight': 4},
    {'name': 'Physical Medicine', 'weight': 2},
    
    # Hospital-based (10%)
    {'name': 'Emergency Medicine', 'weight': 4},
    {'name': 'Hospitalist', 'weight': 4},
    {'name': 'Critical Care', 'weight': 2},
    
    # Surgical (10%)
    {'name': 'General Surgery', 'weight': 2},
    {'name': 'Orthopedic Surgery', 'weight': 2},
    {'name': 'Obstetrics and Gynecology', 'weight': 3},
    {'name': 'Urology', 'weight': 1},
    {'name': 'Ophthalmology', 'weight': 1},
    {'name': 'Otolaryngology', 'weight': 1}
]

def get_weighted_specialty():
    """Select a specialty based on realistic distribution weights."""
    total_weight = sum(s['weight'] for s in SPECIALTIES)
    rand = random.uniform(0, total_weight)
    
    cumulative = 0
    for specialty in SPECIALTIES:
        cumulative += specialty['weight']
        if rand <= cumulative:
            return specialty['name']
    
    return SPECIALTIES[0]['name']  # Fallback

def generate_unique_npi(existing_npis):
    """Generate a unique NPI number."""
    while True:
        # NPI is a 10-digit number starting with 1 or 2
        npi = f"1{random.randint(100000000, 999999999)}"
        if npi not in existing_npis:
            existing_npis.add(npi)
            return npi

def create_organizations(session):
    """Create healthcare organizations."""
    organizations = []
    
    # Main hospital
    main_hospital = Organization(
        name="General Hospital",
        type="Hospital",
        address="123 Medical Center Drive",
        city="Boston",
        state="MA",
        zip_code="02101",
        phone="(617) 555-0100"
    )
    session.add(main_hospital)
    organizations.append(main_hospital)
    
    # Additional organizations based on size
    org_templates = [
        {"name": "Family Medicine Clinic", "type": "Clinic", "zip": "02102"},
        {"name": "Specialty Care Center", "type": "Clinic", "zip": "02103"},
        {"name": "Community Health Center", "type": "FQHC", "zip": "02104"},
        {"name": "Medical Associates", "type": "Group Practice", "zip": "02105"},
        {"name": "Regional Medical Center", "type": "Hospital", "zip": "02106"},
        {"name": "Urgent Care Center", "type": "Urgent Care", "zip": "02107"},
        {"name": "Pediatric Associates", "type": "Clinic", "zip": "02108"},
        {"name": "Women's Health Center", "type": "Clinic", "zip": "02109"},
    ]
    
    for i, template in enumerate(org_templates[:min(4, len(org_templates))]):
        org = Organization(
            name=template["name"],
            type=template["type"],
            address=f"{100 + i * 100} Health Street",
            city="Boston",
            state="MA",
            zip_code=template["zip"],
            phone=f"(617) 555-{200 + i:02d}00"
        )
        session.add(org)
        organizations.append(org)
    
    session.flush()
    return organizations

def create_providers(count=20):
    """Create specified number of healthcare providers."""
    print(f"🏥 Creating {count} Healthcare Providers")
    print("=" * 50)
    
    with SessionLocal() as session:
        # Create organizations
        organizations = create_organizations(session)
        print(f"✓ Created {len(organizations)} healthcare organizations")
        
        # Track used names and NPIs
        used_names = set()
        used_npis = set()
        providers_created = 0
        
        for i in range(count):
            # Alternate between male and female names
            gender = 'male' if i % 2 == 0 else 'female'
            
            # Generate unique name
            attempts = 0
            while attempts < 100:
                first_name = random.choice(FIRST_NAMES[gender])
                last_name = random.choice(LAST_NAMES)
                full_name = f"{first_name} {last_name}"
                
                if full_name not in used_names:
                    used_names.add(full_name)
                    break
                attempts += 1
            
            # Generate unique NPI
            npi = generate_unique_npi(used_npis)
            
            # Select specialty based on weights
            specialty = get_weighted_specialty()
            
            # Assign to organization (weighted towards main hospital)
            if random.random() < 0.6:  # 60% to main hospital
                org = organizations[0]
            else:
                org = random.choice(organizations[1:]) if len(organizations) > 1 else organizations[0]
            
            # Create provider
            provider = Provider(
                npi=npi,
                first_name=first_name,
                last_name=last_name,
                specialty=specialty,
                organization_id=org.id,
                phone=f"(617) 555-{random.randint(1000, 9999)}",
                email=f"{first_name.lower()}.{last_name.lower()}@{org.name.replace(' ', '').lower()}.org",
                active=True
            )
            
            session.add(provider)
            providers_created += 1
            
            # Show progress for large counts
            if count > 50 and (i + 1) % 10 == 0:
                print(f"  Created {i + 1}/{count} providers...")
        
        session.commit()
        
        # Print summary
        print(f"\n✓ Created {providers_created} healthcare providers")
        print(f"✓ Organizations: {len(organizations)}")
        
        # Show specialty distribution
        print("\nSpecialty Distribution:")
        specialty_counts = {}
        for provider in session.query(Provider).all():
            specialty_counts[provider.specialty] = specialty_counts.get(provider.specialty, 0) + 1
        
        for specialty, count in sorted(specialty_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {specialty}: {count}")
        
        print("\n✓ Provider creation completed successfully")

def main():
    parser = argparse.ArgumentParser(description='Create sample healthcare providers')
    parser.add_argument(
        '--count',
        type=int,
        default=20,
        help='Number of providers to create (default: 20)'
    )
    
    args = parser.parse_args()
    
    if args.count < 1:
        print("Error: Count must be at least 1")
        sys.exit(1)
    
    if args.count > 1000:
        print("Warning: Creating more than 1000 providers may take a while...")
    
    create_providers(args.count)

if __name__ == "__main__":
    main()