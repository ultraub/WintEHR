#!/usr/bin/env python3
"""Create a fixed version of the generate_component method"""

# This is the working prompt building code
def build_prompt(component, generation_specific_instructions, data_context_section):
    """Build prompt without the error"""
    
    component_type = component.get('type')
    component_props = component.get('props', {})
    component_binding = component.get('dataBinding', {})
    
    import json
    props_json = json.dumps(component_props, indent=2)
    binding_json = json.dumps(component_binding, indent=2)
    
    prompt = f"""Generate a React component for a clinical UI based on the following specification:

Component Type: {component_type}
Component Props: {props_json}
Data Binding: {binding_json}
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
   - Always use optional chaining (?.) for safety

11. **SPECIFIC TO THIS REQUEST**: The component must display ACTUAL patient data from the FHIR database. Do NOT generate example data like "Patient A", "Patient B" or hardcoded values. Use the real data returned from usePatientResources.

12. **FOR POPULATION-LEVEL QUERIES**: If querying across multiple patients, use appropriate FHIR search parameters and display actual patient names and real values from the database.

13. **AGENT PIPELINE DATA**: When agent pipeline data is provided above, you MUST:
    - Use the exact resource types, LOINC codes, and data structures from the sample data
    - Query for the specific clinical data mentioned in the agent context
    - NEVER use hardcoded LOINC codes like 4548-4 (A1C) unless they appear in the actual data context
    - Generate queries that match the clinical focus and domain from the agent analysis

FHIR QUERY REQUIREMENTS:
- For population dashboards: Use fhirService.searchResources() to query ALL patients/resources
- DO NOT filter by a single patientId for population views
- Example for hypertension patients:
  const conditionsResponse = await fhirService.searchResources('Condition', {{
    'code': '38341003,59621000,1201005', // Hypertension SNOMED codes
    _count: 1000
  }});
- Example for blood pressure:
  const observationsResponse = await fhirService.searchResources('Observation', {{
    'code': '85354-9,8480-6,8462-4', // Blood pressure LOINC codes
    _count: 1000,
    _sort: '-date'
  }});

COMPONENT DATA REQUIREMENTS:
- Each component must fetch and display REAL data based on its dataBinding specification
- Use the exact filters from the component specification
- Calculate aggregations (counts, averages, distributions) from the actual data
- Display real patient names from patient.name[0].given[0] + patient.name[0].family

IMPORTANT: Generate and return ONLY the React component code. Do NOT return descriptions, explanations, or documentation. Return ONLY executable JSX/React code that can be saved as a .js file and imported into the application.

Generate a complete, functional React component that queries and displays REAL FHIR data from the MedGenEMR database. Return ONLY the component code with NO mock data whatsoever."""
    
    return prompt

# Test it
component = {
    'type': 'stat',
    'props': {'title': 'Test'},
    'dataBinding': {'resourceType': 'Observation'}
}

prompt = build_prompt(component, "Test instructions", "Test context")
print(f"Prompt built successfully, length: {len(prompt)}")
print("\nFirst 200 chars:")
print(prompt[:200])