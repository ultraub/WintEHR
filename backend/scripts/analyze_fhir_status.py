#!/usr/bin/env python3
"""
Analyze FHIR resource status fields to understand active/inactive patterns
"""
import json
from sqlalchemy import create_engine, text
from collections import defaultdict
import os

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://medgenemr:medgenemr@localhost:5432/medgenemr')
engine = create_engine(DATABASE_URL)

def analyze_status_fields():
    """Analyze status fields across different FHIR resource types"""
    
    resource_types = [
        'Condition',
        'MedicationRequest', 
        'AllergyIntolerance',
        'CarePlan',
        'CareTeam',
        'Coverage',
        'Encounter'
    ]
    
    results = {}
    
    with engine.connect() as conn:
        for resource_type in resource_types:
            print(f"\n=== Analyzing {resource_type} ===")
            
            # Get sample resources
            query = text(f"""
                SELECT resource_data 
                FROM fhir.{resource_type.lower()}
                LIMIT 10
            """)
            
            try:
                result = conn.execute(query)
                resources = [row[0] for row in result]
                
                if not resources:
                    print(f"No {resource_type} resources found")
                    continue
                
                # Analyze status fields
                status_fields = defaultdict(list)
                
                for resource in resources:
                    # Check various status fields
                    if 'status' in resource:
                        status_fields['status'].append(resource['status'])
                    
                    if 'clinicalStatus' in resource:
                        clinical_status = resource['clinicalStatus']
                        if isinstance(clinical_status, dict) and 'coding' in clinical_status:
                            for coding in clinical_status['coding']:
                                status_fields['clinicalStatus'].append(coding.get('code', 'unknown'))
                    
                    if 'verificationStatus' in resource:
                        verification_status = resource['verificationStatus']
                        if isinstance(verification_status, dict) and 'coding' in verification_status:
                            for coding in verification_status['coding']:
                                status_fields['verificationStatus'].append(coding.get('code', 'unknown'))
                
                # Print unique values
                for field, values in status_fields.items():
                    unique_values = list(set(values))
                    print(f"  {field}: {unique_values}")
                    print(f"    Count by value: {dict([(v, values.count(v)) for v in unique_values])}")
                
                # Show example resource structure
                if resources:
                    print(f"\n  Example {resource_type} structure:")
                    example = resources[0]
                    for key in ['id', 'status', 'clinicalStatus', 'verificationStatus']:
                        if key in example:
                            print(f"    {key}: {json.dumps(example[key], indent=6)}")
                
            except Exception as e:
                print(f"Error analyzing {resource_type}: {e}")

def get_resource_counts():
    """Get counts of resources by status"""
    
    with engine.connect() as conn:
        print("\n=== Resource Counts by Status ===")
        
        # Conditions by clinical status
        query = text("""
            SELECT 
                resource_data->'clinicalStatus'->'coding'->0->>'code' as status,
                COUNT(*) as count
            FROM fhir.condition
            GROUP BY status
            ORDER BY count DESC
        """)
        
        print("\nConditions by clinicalStatus:")
        result = conn.execute(query)
        for row in result:
            print(f"  {row[0] or 'null'}: {row[1]}")
        
        # MedicationRequest by status
        query = text("""
            SELECT 
                resource_data->>'status' as status,
                COUNT(*) as count
            FROM fhir.medicationrequest
            GROUP BY status
            ORDER BY count DESC
        """)
        
        print("\nMedicationRequests by status:")
        result = conn.execute(query)
        for row in result:
            print(f"  {row[0] or 'null'}: {row[1]}")
        
        # AllergyIntolerance by clinical status
        query = text("""
            SELECT 
                resource_data->'clinicalStatus'->'coding'->0->>'code' as status,
                COUNT(*) as count
            FROM fhir.allergyintolerance
            GROUP BY status
            ORDER BY count DESC
        """)
        
        print("\nAllergyIntolerances by clinicalStatus:")
        result = conn.execute(query)
        for row in result:
            print(f"  {row[0] or 'null'}: {row[1]}")

if __name__ == '__main__':
    analyze_status_fields()
    get_resource_counts()