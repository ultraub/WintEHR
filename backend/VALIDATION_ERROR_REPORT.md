# FHIR Validation Error Report

## Summary of Enhanced Transformer Testing

After implementing comprehensive resource handlers in the ProfileAwareFHIRTransformer, here's the current validation status:

### Validation Results

| Resource Type | Status | Common Errors |
|--------------|--------|---------------|
| Patient | ✅ PASSED | - |
| Encounter | ❌ FAILED | - `class` must be list<br>- `period` extra field<br>- `reasonCode` extra field |
| Observation | ❌ FAILED | - `value` extra field (polymorphic field issue) |
| Condition | ✅ PASSED | - |
| Procedure | ❌ FAILED | - `performed` extra field (polymorphic field issue) |
| MedicationRequest | ❌ FAILED | - `medication.coding` extra field<br>- `dosageInstruction.asNeededBoolean` extra field |
| DiagnosticReport | ✅ PASSED | - |
| DocumentReference | ❌ FAILED | - `content.format` extra field<br>- `context.encounter` extra field |
| Claim | ❌ FAILED | - Various structural issues |
| ExplanationOfBenefit | ❌ FAILED | - `payment` type mismatch<br>- `contained` resource issues |
| Device | ❌ FAILED | - `udiCarrier.issuer` required but missing |
| CarePlan | ❌ FAILED | - Activity structure issues |
| CareTeam | ❌ FAILED | - Participant role structure |
| Immunization | ❌ FAILED | - Various field issues |
| AllergyIntolerance | ❌ FAILED | - Reaction structure issues |
| ImagingStudy | ❌ FAILED | - Series modality/bodySite structure |

### Key Issues Identified

1. **Polymorphic Fields**: The FHIR R4 specification uses polymorphic fields (like `value[x]`, `performed[x]`, `medication[x]`) where the field name includes the data type suffix. Our transformer was incorrectly trying to rename these.

2. **Extra Fields**: Synthea includes fields that aren't part of the FHIR R4 specification, causing "extra fields not permitted" errors.

3. **Structural Mismatches**: Some fields have different structures between Synthea's output and FHIR R4 requirements:
   - `Encounter.class` should be a single Coding, not an array
   - `Claim.total` should be a single Money object, not an array
   - Various BackboneElement structures have extra fields

4. **Required Fields**: Some resources are missing required fields (e.g., `Device.udiCarrier.issuer`)

## Options for Complete Resolution

### Option 1: Strict Validation Mode (Recommended)
- Create a comprehensive field whitelist for each resource type
- Remove all fields not in the FHIR R4 specification
- Add default values for required fields that are missing
- Validate against fhir.resources models before storage

### Option 2: Lenient Storage Mode
- Store resources as-is with minimal transformation
- Use PostgreSQL JSONB without strict validation
- Perform validation only on read/API access
- Allow gradual migration to strict compliance

### Option 3: Custom FHIR Profiles
- Create custom FHIR profiles that match Synthea's output
- Use StructureDefinitions to define allowed extensions
- Validate against custom profiles instead of base R4
- Map between custom and standard profiles as needed

### Option 4: Two-Phase Import
- Phase 1: Import with minimal transformation for data preservation
- Phase 2: Background process to clean and validate resources
- Mark resources with validation status
- Provide tools to fix validation errors incrementally

## Recommended Approach

I recommend **Option 1** (Strict Validation Mode) combined with **Option 4** (Two-Phase Import):

1. **Immediate**: Continue using the lenient import approach to get data into the system
2. **Short-term**: Enhance the transformer with complete field whitelists and structural fixes
3. **Long-term**: Build a validation dashboard showing resource compliance status
4. **Ongoing**: Create automated fixes for common validation errors

This approach ensures:
- No data loss during import
- Clear visibility into validation issues
- Gradual improvement of data quality
- Compatibility with standard FHIR tools

## Next Steps

1. **Create Field Whitelists**: Define allowed fields for each resource type based on FHIR R4 spec
2. **Implement Field Cleaning**: Remove all fields not in whitelist during transformation
3. **Add Default Values**: Provide sensible defaults for required missing fields
4. **Build Validation Dashboard**: Show validation status for all imported resources
5. **Create Fix Scripts**: Automate common validation error corrections