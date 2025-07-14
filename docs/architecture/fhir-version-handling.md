# FHIR Version Handling in MedGenEMR

## Overview

MedGenEMR uses FHIR R4B (4.3.0) throughout the system with R4/R5 agnostic handling for backward compatibility. This document explains the version handling strategy and common issues.

## Backend: fhir.resources R4B

The backend uses the `fhir.resources` library version 7.1.0, which implements FHIR R5. However, we explicitly use the R4B submodule:

```python
from fhir.resources.R4B.medicationrequest import MedicationRequest
```

### Important: Field Name Requirements

The fhir.resources R4B library expects exact field names for polymorphic fields:

- **MedicationRequest**: Uses `medicationCodeableConcept` or `medicationReference` (NOT `medication.concept`)
- **MedicationDispense**: Uses `medicationCodeableConcept` or `medicationReference`
- **Procedure**: Uses `performedDateTime` or `performedPeriod`
- **Encounter**: Uses `class` as a list of CodeableConcept (not a single Coding)

## Frontend: Native FHIR JSON

The frontend works with FHIR resources as plain JSON objects, following the FHIR R4B specification.

### MedicationConverter

The `MedicationConverter.js` utility handles conversion between form data and FHIR resources:

```javascript
// Creates R4B format
medicationCodeableConcept: {
  coding: [{
    system: "http://www.nlm.nih.gov/research/umls/rxnorm",
    code: "308136",
    display: "Lisinopril 10 MG Oral Tablet"
  }],
  text: "Lisinopril 10 MG Oral Tablet"
}
```

## Common Issues and Solutions

### Issue 1: "Expect any of field value from this list ['medicationCodeableConcept', 'medicationReference']"

**Cause**: The backend's synthea_validator.py was converting R4B field names to R5 format.

**Solution**: Disabled the R4-to-R5 conversion in synthea_validator.py:
```python
# DISABLED: R4/R5 conversion - we're using R4B which expects medicationCodeableConcept/medicationReference
```

### Issue 2: Transformer Converting Field Names

**Cause**: The transformer.py was converting `medicationCodeableConcept` to just `medication`.

**Solution**: Removed the transformation for MedicationRequest:
```python
elif resource_type == 'MedicationRequest':
    # Handle medication[x] - R4B expects the field names to be exactly medicationCodeableConcept or medicationReference
    # Do NOT transform to just 'medication' as that's not valid in R4B
    pass
```

## Version Detection and Transformation

The system includes version detection and transformation capabilities:

- `version_negotiator.py`: Detects FHIR version from resource structure
- `version_transformer.py`: Transforms resources between versions (currently disabled for MedicationRequest)
- `profile_transformer.py`: Handles Synthea-specific transformations

## Best Practices

1. **Always use R4B field names** in both frontend and backend
2. **Test with real Synthea data** which outputs FHIR R4 format
3. **Avoid field name transformations** unless absolutely necessary
4. **Document any version-specific handling** in code comments

## R4/R5 Agnostic Approach

The system now handles both R4B and R5 format data through preprocessing in `synthea_validator.py`:

### MedicationRequest R5 to R4B Conversion
```python
# Convert R5 format to R4B format for fhir.resources compatibility
if 'medication' in data and isinstance(data['medication'], dict):
    medication = data['medication']
    if 'concept' in medication:
        data['medicationCodeableConcept'] = medication['concept']
        del data['medication']
    elif 'reference' in medication:
        data['medicationReference'] = medication['reference']
        del data['medication']
```

### Reason Field Conversion
```python
# Convert R5 reason format to R4B reasonCode/reasonReference format
if 'reason' in data and isinstance(data['reason'], list):
    reason_codes = []
    reason_references = []
    
    for reason in data['reason']:
        if isinstance(reason, dict):
            if 'concept' in reason:
                reason_codes.append(reason['concept'])
            elif 'reference' in reason:
                reason_references.append(reason['reference'])
    
    if reason_codes:
        data['reasonCode'] = reason_codes
    if reason_references:
        data['reasonReference'] = reason_references
    
    del data['reason']
```

This approach allows:
- Existing R5 format data in the database to be processed correctly
- New R4B format data from the frontend to work without modification
- Seamless migration without requiring database updates

## Recent Updates

### 2025-01-14
- Implemented R4/R5 agnostic preprocessing for medication resources
- Added R5 to R4B conversion for MedicationRequest and MedicationDispense
- Fixed reason field conversion from R5 to R4B format
- Fixed numberOfRepeatsAllowed validation to prevent negative values
- Verified all medication workflows (prescribe, verify, dispense) working with both formats