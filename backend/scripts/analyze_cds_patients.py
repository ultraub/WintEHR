#!/usr/bin/env python3
"""
Analyze patients for CDS hook triggers
Finds patients that would trigger specific CDS hooks
"""

import asyncio
import json
from datetime import datetime, date
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DATABASE_URL

async def analyze_patients():
    """Analyze patients for CDS triggers"""
    # Create async engine
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get all patients
        query = text("""
            SELECT 
                id,
                resource->>'id' as fhir_id,
                resource->>'birthDate' as birth_date,
                resource->'name'->0->>'family' as last_name,
                resource->'name'->0->'given'->0 as first_name,
                resource->>'gender' as gender
            FROM fhir.resources 
            WHERE resource_type = 'Patient' 
            AND deleted = false
            ORDER BY resource->>'birthDate' DESC
        """)
        
        result = await session.execute(query)
        patients = result.fetchall()
        
        print(f"\nFound {len(patients)} patients\n")
        
        # Analyze for CDS triggers
        seniors = []
        diabetes_patients = []
        
        for patient in patients:
            fhir_id = patient.fhir_id
            birth_date = patient.birth_date
            name = f"{patient.first_name} {patient.last_name}" if patient.first_name else patient.last_name
            
            # Calculate age
            if birth_date:
                birth = datetime.strptime(birth_date, '%Y-%m-%d').date()
                today = date.today()
                age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
                
                if age >= 65:
                    seniors.append({
                        'id': fhir_id,
                        'name': name,
                        'age': age,
                        'birth_date': birth_date
                    })
            
            # Check for diabetes
            condition_query = text("""
                SELECT 
                    resource->>'id' as condition_id,
                    resource->'code'->'coding'->0->>'code' as code,
                    resource->'code'->'coding'->0->>'display' as display,
                    resource->'code'->>'text' as text
                FROM fhir.resources 
                WHERE resource_type = 'Condition' 
                AND deleted = false
                AND resource->'subject'->>'reference' = :patient_ref
                AND (
                    resource->'code'->'coding'->0->>'code' LIKE 'E10%' OR
                    resource->'code'->'coding'->0->>'code' LIKE 'E11%' OR
                    resource->'code'->>'text' ILIKE '%diabetes%'
                )
            """)
            
            cond_result = await session.execute(
                condition_query, 
                {'patient_ref': f'Patient/{fhir_id}'}
            )
            conditions = cond_result.fetchall()
            
            if conditions:
                diabetes_patients.append({
                    'id': fhir_id,
                    'name': name,
                    'age': age if birth_date else 'Unknown',
                    'conditions': [
                        {
                            'code': c.code,
                            'display': c.display or c.text
                        } for c in conditions
                    ]
                })
        
        # Print results
        print("=" * 80)
        print("PATIENTS THAT WILL TRIGGER CDS HOOKS")
        print("=" * 80)
        
        print(f"\n1. SENIOR CARE REMINDER (Age >= 65): {len(seniors)} patients")
        print("-" * 50)
        for i, patient in enumerate(seniors[:5], 1):
            print(f"{i}. {patient['name']} - Age: {patient['age']} (ID: {patient['id']})")
        if len(seniors) > 5:
            print(f"   ... and {len(seniors) - 5} more")
        
        print(f"\n2. DIABETES MANAGEMENT ALERT: {len(diabetes_patients)} patients")
        print("-" * 50)
        for i, patient in enumerate(diabetes_patients[:5], 1):
            print(f"{i}. {patient['name']} - Age: {patient['age']} (ID: {patient['id']})")
            for condition in patient['conditions']:
                print(f"   - {condition['display']} ({condition['code']})")
        if len(diabetes_patients) > 5:
            print(f"   ... and {len(diabetes_patients) - 5} more")
        
        print(f"\n3. GENERAL PATIENT INFO CARD: All {len(patients)} patients")
        print("-" * 50)
        print("This card shows for every patient")
        
        # Show some example patient IDs for testing
        print("\n" + "=" * 80)
        print("EXAMPLE PATIENT IDs FOR TESTING:")
        print("=" * 80)
        
        if seniors:
            print(f"\nSenior patient example: {seniors[0]['name']}")
            print(f"URL: http://localhost:3000/patients/{seniors[0]['id']}")
        
        if diabetes_patients:
            print(f"\nDiabetes patient example: {diabetes_patients[0]['name']}")
            print(f"URL: http://localhost:3000/patients/{diabetes_patients[0]['id']}")
        
        # Any patient example
        if patients:
            print(f"\nAny patient example: {patients[0].first_name} {patients[0].last_name}")
            print(f"URL: http://localhost:3000/patients/{patients[0].fhir_id}")

if __name__ == "__main__":
    asyncio.run(analyze_patients())