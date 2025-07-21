#!/usr/bin/env python3
"""
Fix the _sort parameter implementation in the FHIR storage engine.
This adds proper sorting support based on the parsed sort parameters.

Created: 2025-01-21
"""

import sys
from pathlib import Path

# Path to the storage.py file
STORAGE_FILE = Path(__file__).parent.parent.parent / "fhir/core/storage.py"

def fix_sort_implementation():
    """Add proper _sort parameter handling to search_resources method."""
    
    with open(STORAGE_FILE, 'r') as f:
        content = f.read()
    
    # Find the hardcoded ORDER BY line
    old_code = '''        # Add ordering
        query += " ORDER BY r.last_updated DESC"'''
    
    # Replace with dynamic ordering based on _sort parameter
    new_code = '''        # Add ordering based on _sort parameter
        sort_clauses = []
        
        # Check if _sort parameter was provided
        if '_sort' in search_params:
            sort_params = search_params.get('_sort', [])
            if isinstance(sort_params, str):
                sort_params = [sort_params]
            
            # Parse sort parameters using the handler
            parsed_sorts = search_handler.parse_sort_params(sort_params)
            
            for sort_field, sort_order in parsed_sorts:
                # Map sort fields to database columns
                if sort_field == '_id':
                    sort_clauses.append(f"r.fhir_id {sort_order}")
                elif sort_field == '_lastUpdated':
                    sort_clauses.append(f"r.last_updated {sort_order}")
                elif sort_field == 'birthdate' and resource_type == 'Patient':
                    sort_clauses.append(f"r.resource->>'birthDate' {sort_order}")
                elif sort_field == 'name' and resource_type == 'Patient':
                    sort_clauses.append(f"r.resource->'name'->0->>'family' {sort_order}")
                elif sort_field == 'date' and resource_type == 'Observation':
                    sort_clauses.append(f"r.resource->>'effectiveDateTime' {sort_order}")
                elif sort_field == 'date' and resource_type == 'Encounter':
                    sort_clauses.append(f"r.resource->'period'->>'start' {sort_order}")
                elif sort_field == 'onset-date' and resource_type == 'Condition':
                    sort_clauses.append(f"r.resource->>'onsetDateTime' {sort_order}")
                elif sort_field == 'authoredon' and resource_type == 'MedicationRequest':
                    sort_clauses.append(f"r.resource->>'authoredOn' {sort_order}")
                elif sort_field == 'status':
                    sort_clauses.append(f"r.resource->>'status' {sort_order}")
                elif sort_field == 'gender' and resource_type == 'Patient':
                    sort_clauses.append(f"r.resource->>'gender' {sort_order}")
                # Add more field mappings as needed
        
        # Apply sorting or use default
        if sort_clauses:
            query += " ORDER BY " + ", ".join(sort_clauses)
        else:
            query += " ORDER BY r.last_updated DESC"'''
    
    if old_code in content:
        content = content.replace(old_code, new_code)
        
        with open(STORAGE_FILE, 'w') as f:
            f.write(content)
        
        print("✅ Successfully updated storage.py to support _sort parameter")
        print("\nAdded support for sorting by:")
        print("  - _id")
        print("  - _lastUpdated")
        print("  - birthdate (Patient)")
        print("  - name (Patient)")
        print("  - date (Observation, Encounter)")
        print("  - onset-date (Condition)")
        print("  - authoredon (MedicationRequest)")
        print("  - status (all resources)")
        print("  - gender (Patient)")
        print("\nThe implementation now properly handles:")
        print("  - Single sort fields: _sort=birthdate")
        print("  - Descending sort: _sort=-birthdate")
        print("  - Multiple sort fields: _sort=gender,birthdate")
    else:
        print("❌ Could not find the expected code to replace")
        print("The file may have already been modified or has a different structure")

if __name__ == "__main__":
    fix_sort_implementation()