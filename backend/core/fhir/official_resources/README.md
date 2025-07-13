# Official FHIR Resources

This directory contains official FHIR resources directly from HL7 for accurate version-aware conversions using the official FHIR ecosystem tools.

## Approach: Official FHIR Ecosystem Integration

Instead of custom implementations, we leverage the official FHIR tools:
- **FHIR Mapping Language (FML)** - Declarative transformation language
- **StructureMap Resource** - Machine-readable transformation definitions  
- **ConceptMap Resource** - Code system mappings
- **Official Examples** - Canonical resource examples from HL7

## Directory Structure

```
official_resources/
├── r4/                          # FHIR R4 official examples
│   ├── AllergyIntolerance.json
│   ├── Condition.json
│   └── MedicationRequest.json
├── r5/                          # FHIR R5 official examples
│   ├── AllergyIntolerance.json
│   └── ...
├── r6/                          # FHIR R6 official examples (ballot)
│   ├── AllergyIntolerance.json
│   └── ...
├── structure_maps/              # Official StructureMaps
│   ├── AllergyIntolerance3to4.json
│   ├── AllergyIntolerance4to5.json
│   └── ...
└── concept_maps/                # Official ConceptMaps
    ├── terminology_mappings.json
    └── ...
```

## Tools Used

### Python: MaLaC-HD Library
- **Package**: `malac-hd` (MApping LAnguage Compiler for Health Data)
- **Purpose**: Fast StructureMap execution in Python
- **Features**: FML to StructureMap processing, Python code generation

### Java: FHIR Validator
- **Source**: HAPI FHIR reference implementation
- **Purpose**: Official StructureMap execution
- **Usage**: Command-line transforms with official validation

## Official Sources

### Resource Examples
- **R4**: `https://hl7.org/fhir/R4/[resource]-example.json`
- **R5**: `https://hl7.org/fhir/R5/[resource]-example.json` 
- **R6**: `https://build.fhir.org/[resource]-example.json`

### StructureMaps
- **R3→R4**: `http://hl7.org/fhir/StructureMap/[Resource]3to4`
- **R4→R5**: `http://hl7.org/fhir/StructureMap/[Resource]4to5`
- **Version Maps**: `https://hl7.org/fhir/R[X]/[resource]-version-maps.html`

## Usage Process

1. **Download Official Resources**: Use wget to fetch canonical examples
2. **Process StructureMaps**: Use MaLaC-HD or Java validator for transformations
3. **Validate Conversions**: Round-trip testing with official examples
4. **Integration**: Connect to version-aware storage system

## Benefits

- **Official Compliance**: Uses HL7-maintained transformations
- **Standard Framework**: Leverages FHIR ecosystem tools
- **Validation**: "No validation errors - all conversions are clean"
- **Interoperability**: Compatible with other FHIR implementations
- **Future-Proof**: Automatically updated with FHIR specifications