# Missing Search Parameters Analysis

**Date**: 2025-07-18
**Purpose**: Identify missing FHIR R4 search parameters in MedGenEMR implementation

## MedicationRequest Search Parameters

### Currently Implemented (from search_indexer.py):
1. ✅ _id (token) - path: id
2. ✅ _lastUpdated (date) - path: meta.lastUpdated
3. ✅ identifier (token) - path: identifier
4. ✅ status (token) - path: status
5. ✅ intent (token) - path: intent
6. ✅ category (token) - path: category
7. ✅ priority (token) - path: priority
8. ✅ medication (reference) - path: medicationReference
9. ✅ subject (reference) - path: subject
10. ✅ encounter (reference) - path: encounter
11. ✅ requester (reference) - path: requester
12. ✅ authoredon (date) - path: authoredOn
13. ✅ code (token) - path: medicationCodeableConcept

### Missing from FHIR R4 Spec:
1. ❌ **date** (date) - path: dosageInstruction.timing.event
   - Returns medication request to be administered on a specific date
   - Complex path through dosageInstruction array

2. ❌ **intended-dispenser** (reference) - path: dispenseRequest.performer
   - Returns prescriptions intended to be dispensed by this Organization
   - Important for pharmacy workflows

3. ❌ **intended-performer** (reference) - path: performer
   - Returns requests for a specific intended performer
   - Different from requester

4. ❌ **intended-performertype** (token) - path: performerType
   - Returns requests for a specific intended performer type
   - Useful for role-based filtering

5. ❌ **patient** (reference) - path: subject
   - Specific alias for subject when target is Patient
   - Should filter to only Patient references

### Implementation Notes:
- The 'patient' parameter is effectively covered by 'subject' but FHIR spec lists it separately
- The 'date' parameter requires parsing complex dosageInstruction structures
- Several parameters relate to dispensing and performance which are important for pharmacy workflows

## Observation Search Parameters

### Currently Implemented (from search_indexer.py):
1. ✅ _id (token) - path: id
2. ✅ _lastUpdated (date) - path: meta.lastUpdated
3. ✅ identifier (token) - path: identifier
4. ✅ status (token) - path: status
5. ✅ category (token) - path: category
6. ✅ code (token) - path: code
7. ✅ subject (reference) - path: subject
8. ✅ encounter (reference) - path: encounter
9. ✅ date (date) - path: effectiveDateTime
10. ✅ issued (date) - path: issued
11. ✅ performer (reference) - path: performer
12. ✅ value-quantity (quantity) - path: valueQuantity
13. ✅ value-string (string) - path: valueString
14. ✅ value-concept (token) - path: valueCodeableConcept
15. ✅ component-code (token) - path: component.code
16. ✅ component-value-quantity (quantity) - path: component.valueQuantity

### Missing from FHIR R4 Spec:
1. ❌ **patient** (reference) - path: subject
   - Alias for subject when the subject is a patient

2. ❌ **based-on** (reference) - path: basedOn
   - Reference to the service request

3. ❌ **derived-from** (reference) - path: derivedFrom
   - Related measurements the observation is made from

4. ❌ **has-member** (reference) - path: hasMember
   - Reference to resources that make up the group observation

5. ❌ **part-of** (reference) - path: partOf
   - Part of referenced event

6. ❌ **specimen** (reference) - path: specimen
   - Specimen used for this observation

7. ❌ **device** (reference) - path: device
   - The Device that generated the observation data

8. ❌ **focus** (reference) - path: focus
   - The focus of an observation when not the patient of record

9. ❌ **data-absent-reason** (token) - path: dataAbsentReason
   - Reason why value is missing

10. ❌ **method** (token) - path: method
    - The method used for the observation

11. ❌ **value-date** (date) - path: valueDateTime or valuePeriod
    - The value of the observation, if the value is a date/time

12. ❌ **component-value-concept** (token) - path: component.valueCodeableConcept
    - Component observation value as CodeableConcept

### Composite Search Parameters Missing:
13. ❌ **code-value-string** - Composite of code and string value
14. ❌ **code-value-quantity** - Composite of code and quantity value
15. ❌ **code-value-date** - Composite of code and date value
16. ❌ **code-value-concept** - Composite of code and coded value
17. ❌ **combo-code-value-quantity** - Code and quantity including components
18. ❌ **combo-code-value-concept** - Code and coded value including components
19. ❌ **component-code-value-quantity** - Component code and quantity
20. ❌ **component-code-value-concept** - Component code and coded value

### Implementation Notes:
- Many reference parameters are missing which are important for clinical queries
- Composite parameters allow searching for specific observations with specific values
- The 'patient' parameter is a common alias that improves usability

## Procedure Search Parameters

### Currently Implemented (from search_indexer.py):
1. ✅ _id (token) - path: id
2. ✅ _lastUpdated (date) - path: meta.lastUpdated
3. ✅ identifier (token) - path: identifier
4. ✅ status (token) - path: status
5. ✅ category (token) - path: category
6. ✅ code (token) - path: code
7. ✅ subject (reference) - path: subject
8. ✅ encounter (reference) - path: encounter
9. ✅ performed (date) - path: performedDateTime
10. ✅ performer (reference) - path: performer.actor
11. ✅ location (reference) - path: location
12. ✅ outcome (token) - path: outcome

### Missing from FHIR R4 Spec:
1. ❌ **patient** (reference) - path: subject
   - Alias for subject when the subject is a patient

2. ❌ **based-on** (reference) - path: basedOn
   - Reference to resource containing request details

3. ❌ **date** (date) - path: performedDateTime or performedPeriod
   - Alias for performed parameter

4. ❌ **instantiates-canonical** (reference) - path: instantiatesCanonical
   - FHIR-defined protocol/guideline reference

5. ❌ **instantiates-uri** (uri) - path: instantiatesUri
   - External protocol/guideline reference

6. ❌ **part-of** (reference) - path: partOf
   - Larger event this procedure is part of

7. ❌ **reason-code** (token) - path: reasonCode
   - Coded reason procedure was performed

8. ❌ **reason-reference** (reference) - path: reasonReference
   - Justification reference for the procedure

### Implementation Notes:
- The 'date' parameter is an alias for 'performed' which is already implemented
- Several parameters relate to protocol adherence and clinical reasoning
- The 'patient' parameter provides consistency across resources

## Summary of Missing Search Parameters

### Critical Gaps by Category:

#### 1. Reference Parameters (High Priority)
These are essential for clinical workflows and data relationships:
- **MedicationRequest**: intended-dispenser, intended-performer
- **Observation**: based-on, derived-from, has-member, part-of, specimen, device, focus
- **Procedure**: based-on, part-of, reason-reference

#### 2. Composite Parameters (Medium Priority)
Enable complex clinical queries:
- **Observation**: All composite parameters (code-value-*, component-code-value-*)
- These allow queries like "find all blood pressure readings above 140"

#### 3. Alias Parameters (Low Priority)
Improve usability but functionality exists:
- **patient** parameter for all resources (alias for subject)
- **date** parameter for Procedure (alias for performed)

#### 4. Clinical Context Parameters
Important for care coordination:
- **MedicationRequest**: intended-performertype
- **Observation**: method, data-absent-reason
- **Procedure**: reason-code, instantiates-canonical, instantiates-uri

### Impact Assessment:
1. **Pharmacy Workflows**: Missing intended-dispenser affects pharmacy queue filtering
2. **Laboratory Integration**: Missing specimen parameter limits lab result queries
3. **Clinical Decision Support**: Missing composite parameters limit value-based queries
4. **Care Coordination**: Missing part-of and based-on limit workflow tracking

### Recommendation Priority:
1. **Immediate**: Add missing reference parameters for clinical relationships
2. **Short-term**: Implement composite search parameters for Observation
3. **Medium-term**: Add remaining parameters for full FHIR compliance

### Implementation Complexity:
- **Simple**: Token and string parameters (direct path extraction)
- **Medium**: Reference parameters (need reference resolution)
- **Complex**: Composite parameters (require multi-field correlation)
- **Very Complex**: Array-based paths like dosageInstruction.timing.event
