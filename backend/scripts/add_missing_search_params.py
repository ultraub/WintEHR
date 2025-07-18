#!/usr/bin/env python3
"""
Add Missing Search Parameters to storage.py

This script adds the missing search parameter extractions identified in the analysis.
Priority 1: Critical missing parameters for MedicationRequest, Observation, and Procedure.
"""

import re
import shutil
from datetime import datetime

# Backup the original file
storage_file = "/Users/robertbarrett/Library/Mobile Documents/com~apple~CloudDocs/dev/MedGenEMR/backend/fhir/core/storage.py"
backup_file = f"{storage_file}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"

print(f"Creating backup: {backup_file}")
shutil.copy2(storage_file, backup_file)

# Read the file
with open(storage_file, 'r') as f:
    lines = f.readlines()

# Find the MedicationRequest section and add missing parameters
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    new_lines.append(line)
    
    # Add medication reference extraction after medicationCodeableConcept
    if "# Medication code" in line and i + 15 < len(lines):
        # Skip to end of medicationCodeableConcept block
        while i < len(lines) - 1:
            i += 1
            new_lines.append(lines[i])
            if "'value_token_code': coding['code']" in lines[i] and "}))" in lines[i+1]:
                i += 1
                new_lines.append(lines[i])
                break
        
        # Add medication reference extraction
        medication_ref_code = """            
            # Medication reference
            if 'medicationReference' in resource_data and 'reference' in resource_data['medicationReference']:
                params_to_extract.append({
                    'param_name': 'medication',
                    'param_type': 'reference',
                    'value_reference': resource_data['medicationReference']['reference']
                })
"""
        new_lines.append(medication_ref_code)
    
    # Add missing parameters after authoredOn for MedicationRequest
    elif "'param_name': 'authoredon'," in line and "MedicationRequest" in ''.join(lines[max(0, i-50):i]):
        # Skip to end of authoredOn block
        while i < len(lines) - 1:
            i += 1
            new_lines.append(lines[i])
            if "logging.warning" in lines[i] and "Could not parse authoredOn" in lines[i]:
                break
        
        # Add missing MedicationRequest parameters
        missing_params = """            
            # Intent
            if 'intent' in resource_data:
                params_to_extract.append({
                    'param_name': 'intent',
                    'param_type': 'token',
                    'value_token_code': resource_data['intent']
                })
            
            # Category
            if 'category' in resource_data:
                for category in resource_data['category']:
                    if 'coding' in category:
                        for coding in category['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'category',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Priority
            if 'priority' in resource_data:
                params_to_extract.append({
                    'param_name': 'priority',
                    'param_type': 'token',
                    'value_token_code': resource_data['priority']
                })
            
            # Encounter reference
            if 'encounter' in resource_data and 'reference' in resource_data['encounter']:
                params_to_extract.append({
                    'param_name': 'encounter',
                    'param_type': 'reference',
                    'value_reference': resource_data['encounter']['reference']
                })
            
            # Intended dispenser (pharmacy)
            if 'dispenseRequest' in resource_data and 'performer' in resource_data['dispenseRequest']:
                if 'reference' in resource_data['dispenseRequest']['performer']:
                    params_to_extract.append({
                        'param_name': 'intended-dispenser',
                        'param_type': 'reference',
                        'value_reference': resource_data['dispenseRequest']['performer']['reference']
                    })
            
            # Intended performer
            if 'performer' in resource_data and 'reference' in resource_data['performer']:
                params_to_extract.append({
                    'param_name': 'intended-performer',
                    'param_type': 'reference',
                    'value_reference': resource_data['performer']['reference']
                })
            
            # Intended performer type
            if 'performerType' in resource_data and 'coding' in resource_data['performerType']:
                for coding in resource_data['performerType']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'intended-performertype',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
"""
        new_lines.append(missing_params)
    
    i += 1

# Write the modified content back
with open(storage_file, 'w') as f:
    f.writelines(new_lines)

print("✓ Added missing MedicationRequest search parameters:")
print("  - medication (reference)")
print("  - intent")
print("  - category") 
print("  - priority")
print("  - encounter")
print("  - intended-dispenser")
print("  - intended-performer")
print("  - intended-performertype")
print(f"✓ Backup saved as: {backup_file}")

# Now let's add missing Observation parameters
print("\nAdding missing Observation parameters...")

# Read the updated file
with open(storage_file, 'r') as f:
    content = f.read()

# Find Observation section and add missing parameters
observation_pattern = r"(elif resource_type == 'Observation':.*?)(elif resource_type == 'Condition')"
match = re.search(observation_pattern, content, re.DOTALL)

if match:
    observation_section = match.group(1)
    
    # Add missing parameters before the next elif
    missing_observation_params = """
            # Based on reference
            if 'basedOn' in resource_data:
                for based_on in resource_data.get('basedOn', []):
                    if 'reference' in based_on:
                        params_to_extract.append({
                            'param_name': 'based-on',
                            'param_type': 'reference',
                            'value_reference': based_on['reference']
                        })
            
            # Derived from references
            if 'derivedFrom' in resource_data:
                for derived in resource_data.get('derivedFrom', []):
                    if 'reference' in derived:
                        params_to_extract.append({
                            'param_name': 'derived-from',
                            'param_type': 'reference',
                            'value_reference': derived['reference']
                        })
            
            # Has member references
            if 'hasMember' in resource_data:
                for member in resource_data.get('hasMember', []):
                    if 'reference' in member:
                        params_to_extract.append({
                            'param_name': 'has-member',
                            'param_type': 'reference',
                            'value_reference': member['reference']
                        })
            
            # Part of reference
            if 'partOf' in resource_data:
                for part in resource_data.get('partOf', []):
                    if 'reference' in part:
                        params_to_extract.append({
                            'param_name': 'part-of',
                            'param_type': 'reference',
                            'value_reference': part['reference']
                        })
            
            # Specimen reference
            if 'specimen' in resource_data and 'reference' in resource_data['specimen']:
                params_to_extract.append({
                    'param_name': 'specimen',
                    'param_type': 'reference',
                    'value_reference': resource_data['specimen']['reference']
                })
            
            # Device reference
            if 'device' in resource_data and 'reference' in resource_data['device']:
                params_to_extract.append({
                    'param_name': 'device',
                    'param_type': 'reference',
                    'value_reference': resource_data['device']['reference']
                })
            
            # Focus references
            if 'focus' in resource_data:
                for focus in resource_data.get('focus', []):
                    if 'reference' in focus:
                        params_to_extract.append({
                            'param_name': 'focus',
                            'param_type': 'reference',
                            'value_reference': focus['reference']
                        })
            
            # Method
            if 'method' in resource_data and 'coding' in resource_data['method']:
                for coding in resource_data['method']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'method',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
            
            # Data absent reason
            if 'dataAbsentReason' in resource_data and 'coding' in resource_data['dataAbsentReason']:
                for coding in resource_data['dataAbsentReason']['coding']:
                    if 'code' in coding:
                        params_to_extract.append({
                            'param_name': 'data-absent-reason',
                            'param_type': 'token',
                            'value_token_system': coding.get('system'),
                            'value_token_code': coding['code']
                        })
        
        """
    
    # Insert before the next elif
    new_observation_section = observation_section + missing_observation_params + "\n        "
    content = content.replace(match.group(0), new_observation_section + match.group(2))
    
    # Write back
    with open(storage_file, 'w') as f:
        f.write(content)
    
    print("✓ Added missing Observation search parameters:")
    print("  - based-on")
    print("  - derived-from")
    print("  - has-member")
    print("  - part-of")
    print("  - specimen")
    print("  - device")
    print("  - focus")
    print("  - method")
    print("  - data-absent-reason")

# Add missing Procedure parameters
print("\nAdding missing Procedure parameters...")

# Read the updated file again
with open(storage_file, 'r') as f:
    content = f.read()

# Find Procedure section and add missing parameters
procedure_pattern = r"(elif resource_type == 'Procedure':.*?)(elif resource_type == 'Encounter')"
match = re.search(procedure_pattern, content, re.DOTALL)

if match:
    procedure_section = match.group(1)
    
    # Add missing parameters before the next elif
    missing_procedure_params = """
            # Based on references
            if 'basedOn' in resource_data:
                for based_on in resource_data.get('basedOn', []):
                    if 'reference' in based_on:
                        params_to_extract.append({
                            'param_name': 'based-on',
                            'param_type': 'reference',
                            'value_reference': based_on['reference']
                        })
            
            # Part of reference
            if 'partOf' in resource_data:
                for part in resource_data.get('partOf', []):
                    if 'reference' in part:
                        params_to_extract.append({
                            'param_name': 'part-of',
                            'param_type': 'reference',
                            'value_reference': part['reference']
                        })
            
            # Reason code
            if 'reasonCode' in resource_data:
                for reason in resource_data.get('reasonCode', []):
                    if 'coding' in reason:
                        for coding in reason['coding']:
                            if 'code' in coding:
                                params_to_extract.append({
                                    'param_name': 'reason-code',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # Reason reference
            if 'reasonReference' in resource_data:
                for reason_ref in resource_data.get('reasonReference', []):
                    if 'reference' in reason_ref:
                        params_to_extract.append({
                            'param_name': 'reason-reference',
                            'param_type': 'reference',
                            'value_reference': reason_ref['reference']
                        })
            
            # Also add 'date' as alias for performed
            if 'performedDateTime' in resource_data:
                try:
                    performed_date = datetime.fromisoformat(
                        resource_data['performedDateTime'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': performed_date
                    })
                except (ValueError, TypeError):
                    pass
            elif 'performedPeriod' in resource_data and 'start' in resource_data['performedPeriod']:
                try:
                    performed_date = datetime.fromisoformat(
                        resource_data['performedPeriod']['start'].replace('Z', '+00:00')
                    )
                    params_to_extract.append({
                        'param_name': 'date',
                        'param_type': 'date',
                        'value_date': performed_date
                    })
                except (ValueError, TypeError):
                    pass
        
        """
    
    # Insert before the next elif
    new_procedure_section = procedure_section + missing_procedure_params + "\n        "
    content = content.replace(match.group(0), new_procedure_section + match.group(2))
    
    # Write back
    with open(storage_file, 'w') as f:
        f.write(content)
    
    print("✓ Added missing Procedure search parameters:")
    print("  - based-on")
    print("  - part-of")
    print("  - reason-code")
    print("  - reason-reference")
    print("  - date (alias for performed)")

print("\n✓ All missing search parameters have been added to storage.py")
print("Note: Composite search parameters for Observation will be added in a separate update")