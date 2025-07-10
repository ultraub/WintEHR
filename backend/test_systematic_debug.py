#!/usr/bin/env python3
"""Systematic debugging of the UI Composer error"""

import json
import sys
sys.path.append('.')

# Test building the exact prompt that's failing
generation_specific_instructions = """
FULL GENERATION MODE:
- Create completely custom components from scratch
- Use unique styling and layout approaches
- Don't follow standard MedGenEMR patterns unless necessary
- Focus on innovation and creativity
- Generate all necessary sub-components inline
"""

data_context_section = ""

component = {
    'type': 'stat',
    'props': {'title': 'Vital Signs'},
    'dataBinding': {'resourceType': 'Observation'}
}

component_type = component.get('type')
component_props = json.dumps(component.get('props', {}), indent=2)
component_binding = json.dumps(component.get('dataBinding', {}), indent=2)

# Test each part of the prompt separately
print("Testing prompt parts...")

try:
    part1 = f"Component Type: {component_type}"
    print(f"✓ Part 1: {part1}")
except Exception as e:
    print(f"✗ Part 1 failed: {e}")

try:
    part2 = f"Component Props: {component_props}"
    print(f"✓ Part 2: {part2[:50]}...")
except Exception as e:
    print(f"✗ Part 2 failed: {e}")

try:
    part3 = f"Data Binding: {component_binding}"
    print(f"✓ Part 3: {part3[:50]}...")
except Exception as e:
    print(f"✗ Part 3 failed: {e}")

try:
    part4 = f"{generation_specific_instructions}"
    print(f"✓ Part 4: {part4[:50]}...")
except Exception as e:
    print(f"✗ Part 4 failed: {e}")

try:
    part5 = f"{data_context_section}"
    print(f"✓ Part 5: {part5[:50] if part5 else '(empty)'}...")
except Exception as e:
    print(f"✗ Part 5 failed: {e}")

# Now test the full prompt
print("\nTesting full prompt construction...")

try:
    prompt = f"""Generate a React component for a clinical UI based on the following specification:

Component Type: {component_type}
Component Props: {component_props}
Data Binding: {component_binding}
{generation_specific_instructions}
{data_context_section}

CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY:
1. Use Material-UI components (@mui/material, @mui/icons-material)
2. Follow MedGenEMR patterns and conventions
3. Include proper error handling and loading states
4. **MANDATORY**: Use ACTUAL MedGenEMR FHIR hooks - NOT MOCK DATA:
   - import {{ usePatientResources }} from '../../../hooks/useFHIRResources';
   - import {{ useFHIRClient }} from '../../../contexts/FHIRClientContext';
   - import {{ fhirService }} from '../../../services/fhirService';
5. **ABSOLUTELY NO MOCK DATA** - Query REAL FHIR database only
6. Handle null/missing FHIR data gracefully with proper empty states
7. Use progressive loading (show available data immediately)
8. **REQUIRED**: Accept patientId as a prop and use it for data fetching
9. Generate FHIR queries based on the ACTUAL data context provided above, NOT hardcoded examples.
   - Use the resource types from the data context
   - Use the actual LOINC/SNOMED codes found in the sample data
   - Query for the specific clinical data relevant to this request

10. Format FHIR data properly:
   - Use resource.valueQuantity?.value for numeric values
   - Use resource.code?.coding?.[0]?.display for code displays
   - Use resource.effectiveDateTime for dates
   - Always use optional chaining (?.) for safety"""
    
    print(f"✓ Full prompt constructed successfully! Length: {len(prompt)}")
except Exception as e:
    print(f"✗ Full prompt construction failed: {e}")
    import traceback
    traceback.print_exc()

# Test the JavaScript examples that have 'code' in them
print("\nTesting JavaScript examples...")

try:
    js_example = """- Example for hypertension patients:
  const conditionsResponse = await fhirService.searchResources('Condition', {{
    'code': '38341003,59621000,1201005', // Hypertension SNOMED codes
    _count: 1000
  }});"""
    
    prompt_with_js = f"""Test prompt with JS:
{js_example}"""
    
    print(f"✓ JavaScript example in f-string works")
except Exception as e:
    print(f"✗ JavaScript example failed: {e}")

# Check if the issue is with specific special characters
print("\nChecking for special characters...")
test_strings = [
    "code",
    "'code'",
    '"code"',
    "code:",
    "code =",
    "${code}",
    "{code}",
    "{{code}}",
    "resource.code",
    "use resource.code?.coding"
]

for test_str in test_strings:
    try:
        result = f"Test: {test_str}"
        print(f"✓ '{test_str}' works in f-string")
    except Exception as e:
        print(f"✗ '{test_str}' fails: {e}")