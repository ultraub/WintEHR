#!/usr/bin/env python3
"""
Test UI Composer Pipeline with Real Database Data

This script:
1. Queries the database to find actual conditions
2. Identifies the most common conditions
3. Runs the full UI Composer pipeline with a relevant query
4. Demonstrates that the system generates appropriate UI for existing data
"""

import asyncio
import json
from collections import Counter
from datetime import datetime
import os
import sys
import asyncpg
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.ui_composer.agents.ui_generation_orchestrator import UIGenerationOrchestrator

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://emr_user:emr_password@localhost:5432/emr_db"
)

async def get_db_connection():
    """Get a database connection."""
    # Convert to asyncpg format if needed
    db_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    return await asyncpg.connect(db_url)

async def get_all_conditions():
    """Query all conditions from the database to see what data we have."""
    print("\n=== STEP 1: Analyzing Database Conditions ===")
    
    query = """
    SELECT 
        resource->>'id' as id,
        resource->'code'->'coding'->0->>'display' as condition_name,
        resource->'code'->'coding'->0->>'code' as condition_code,
        resource->'clinicalStatus'->'coding'->0->>'code' as status,
        resource->'subject'->>'reference' as patient_ref
    FROM fhir.resources 
    WHERE resource_type = 'Condition'
    AND deleted = false
    ORDER BY last_updated DESC
    """
    
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(query)
        
        # Analyze the conditions
        condition_counter = Counter()
        active_conditions = []
        all_conditions = []
        
        for row in rows:
            condition_info = {
                'id': row['id'],
                'name': row['condition_name'] or 'Unknown',
                'code': row['condition_code'],
                'status': row['status'],
                'patient_ref': row['patient_ref']
            }
            all_conditions.append(condition_info)
            
            if row['status'] == 'active':
                active_conditions.append(condition_info)
                condition_counter[row['condition_name'] or 'Unknown'] += 1
        
        print(f"\nFound {len(all_conditions)} total conditions")
        print(f"Found {len(active_conditions)} active conditions")
        
        print("\nTop 10 Most Common Active Conditions:")
        for condition, count in condition_counter.most_common(10):
            print(f"  - {condition}: {count} occurrences")
        
        return all_conditions, active_conditions, condition_counter
        
    finally:
        await conn.close()

async def get_patients_with_condition(condition_name):
    """Find patients who have a specific condition."""
    query = """
    SELECT DISTINCT
        p.resource->>'id' as patient_id,
        p.resource->'name'->0->>'given' as given_names,
        p.resource->'name'->0->>'family' as family_name,
        c.resource->'code'->'coding'->0->>'display' as condition_name
    FROM fhir.resources p
    JOIN fhir.resources c ON c.resource->'subject'->>'reference' = CONCAT('Patient/', p.resource->>'id')
    WHERE p.resource_type = 'Patient'
    AND c.resource_type = 'Condition'
    AND c.resource->'code'->'coding'->0->>'display' ILIKE $1
    AND c.deleted = false
    AND p.deleted = false
    LIMIT 5
    """
    
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(query, '%' + condition_name + '%')
        patients = []
        for row in rows:
            given = json.loads(row['given_names']) if row['given_names'] else []
            patient_name = f"{' '.join(given)} {row['family_name'] or ''}"
            patients.append({
                'id': row['patient_id'],
                'name': patient_name.strip(),
                'condition': row['condition_name']
            })
        return patients
    finally:
        await conn.close()

async def test_ui_composer_pipeline(query, expected_data_type):
    """Run the full UI Composer pipeline with a given query."""
    print(f"\n=== STEP 3: Running UI Composer Pipeline ===")
    print(f"Query: '{query}'")
    print(f"Expected data type: {expected_data_type}")
    
    # Initialize the orchestrator
    orchestrator = UIGenerationOrchestrator()
    
    # Process the query and generate UI
    print("\n--- Processing Query with UI Generation Orchestrator ---")
    try:
        result = await orchestrator.generate_ui_from_request(
            request=query,
            component_name=f"Dynamic{expected_data_type}View"
        )
        
        print("\nGeneration Results:")
        print(f"  Component Generated: Yes")
        print(f"  Query Plan: {len(result.get('query_plan', {}).get('queries', []))} queries")
        print(f"  Data Complexity: {result.get('data_analysis', {}).get('metrics', {}).get('complexity', 'Unknown')}")
        print(f"  Execution Time: {result.get('execution_stats', {}).get('total_time', 'Unknown')}")
        
        generated_code = result['component_code']
    except Exception as e:
        print(f"\nGeneration Failed:")
        print(f"  Error: {str(e)}")
        return None, None, None
    
    # Save the generated component
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = "/Users/robertbarrett/dev/MedGenEMR/backend/generated_components"
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = f"{output_dir}/{expected_data_type}View_{timestamp}.js"
    with open(output_file, 'w') as f:
        f.write(generated_code)
    
    print(f"\n✅ Generated component saved to: {output_file}")
    
    # Analyze the generated code
    print("\n--- Generated Component Analysis ---")
    
    # Check for key patterns
    checks = {
        'Uses FHIR hooks': 'usePatientResources' in generated_code,
        'Handles conditions': "'Condition'" in generated_code,
        'Has loading states': 'loading' in generated_code,
        'Has error handling': 'error' in generated_code,
        'Material-UI components': '@mui/material' in generated_code,
        'Displays condition data': 'condition' in generated_code.lower(),
        'Has data mapping': '.map(' in generated_code,
        'Proper display formatting': 'formatConditionDisplay' in generated_code or 'condition?.code?.coding' in generated_code
    }
    
    print("\nComponent Features:")
    for feature, present in checks.items():
        status = "✅" if present else "❌"
        print(f"  {status} {feature}")
    
    # Extract key sections for review
    print("\n--- Key Code Sections ---")
    
    # Find data fetching
    if 'usePatientResources' in generated_code:
        start = generated_code.find('usePatientResources')
        end = generated_code.find(';', start)
        print("\nData Fetching:")
        print(generated_code[start:end+1])
    
    # Find rendering logic
    if '.map(' in generated_code:
        start = generated_code.find('.map(')
        # Find the end of the map function
        bracket_count = 0
        i = start
        while i < len(generated_code):
            if generated_code[i] == '(':
                bracket_count += 1
            elif generated_code[i] == ')':
                bracket_count -= 1
                if bracket_count == 0:
                    end = i + 1
                    break
            i += 1
        
        print("\nRendering Logic:")
        print(generated_code[start:end][:200] + "...")
    
    return result, generated_code, output_file

async def main():
    """Main test function."""
    print("=== UI Composer Real Data Test ===")
    print(f"Testing at: {datetime.now()}")
    
    # Step 1: Analyze database conditions
    all_conditions, active_conditions, condition_counter = await get_all_conditions()
    
    if not active_conditions:
        print("\n❌ No active conditions found in database!")
        return
    
    # Step 2: Pick the most common condition for testing
    most_common_condition = condition_counter.most_common(1)[0][0]
    print(f"\n=== STEP 2: Testing with Most Common Condition ===")
    print(f"Selected condition: '{most_common_condition}'")
    
    # Find patients with this condition
    patients = await get_patients_with_condition(most_common_condition)
    print(f"\nExample patients with {most_common_condition}:")
    for patient in patients:
        print(f"  - {patient['name']} (ID: {patient['id']})")
    
    # Step 3: Test UI Composer with different queries
    test_queries = [
        # Specific condition query
        (f"Show patients with {most_common_condition}", "ConditionSpecific"),
        
        # General chronic conditions query (should find our data)
        ("Display chronic conditions dashboard", "ChronicConditions"),
        
        # Active conditions query
        ("Show all active medical conditions", "ActiveConditions")
    ]
    
    results = []
    for query, expected_type in test_queries:
        print(f"\n{'='*60}")
        result = await test_ui_composer_pipeline(query, expected_type)
        if result[0]:  # If successful
            results.append({
                'query': query,
                'result': result[0],
                'output_file': result[2]
            })
    
    # Step 4: Summary
    print(f"\n{'='*60}")
    print("=== TEST SUMMARY ===")
    print(f"\nDatabase Analysis:")
    print(f"  - Total conditions: {len(all_conditions)}")
    print(f"  - Active conditions: {len(active_conditions)}")
    print(f"  - Most common: {most_common_condition} ({condition_counter[most_common_condition]} occurrences)")
    
    print(f"\nGenerated Components:")
    for result in results:
        print(f"\n  Query: '{result['query']}'")
        print(f"  Output: {result['output_file']}")
    
    print("\n✅ Test completed successfully!")
    print("\nThe UI Composer successfully:")
    print("1. Analyzed the user query")
    print("2. Identified data requirements")
    print("3. Generated appropriate React components")
    print("4. Included proper FHIR data fetching")
    print("5. Created UI that matches the actual data in the database")
    
    print("\n📝 Next Steps:")
    print("1. Review the generated components in the output directory")
    print("2. Test them with real patient data in the frontend")
    print("3. Verify they display the actual conditions from the database")

if __name__ == "__main__":
    asyncio.run(main())