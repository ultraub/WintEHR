# DomainResource Base Resource Testing Documentation

## Overview

DomainResource is the abstract base resource in FHIR R4 from which most clinical and administrative resources inherit. It provides fundamental capabilities including human-readable narrative, contained resources, extensions, and modifier extensions. Testing DomainResource functionality ensures the foundation for all derived resources works correctly.

## FHIR R4 DomainResource Structure

### Core Elements (Inherited by all clinical resources)
- **resourceType**: Specific resource type (Patient, Observation, etc.)
- **id**: Logical resource identifier
- **meta**: Resource metadata (version, profile, tags, security)
- **implicitRules**: Special rules for resource interpretation
- **language**: Language of resource content
- **text**: Human-readable narrative (from DomainResource)
- **contained**: Contained resources (from DomainResource)
- **extension**: Extensions (from DomainResource)
- **modifierExtension**: Extensions that modify meaning (from DomainResource)

### DomainResource-Specific Elements
1. **text**: Narrative element with status and div content
2. **contained**: Array of contained resources
3. **extension**: Array of extension elements
4. **modifierExtension**: Array of modifier extension elements

## Current Implementation Analysis

### DomainResource Usage in System

Located in: `/backend/core/fhir/resources_r4b.py`

```python
# DomainResource import
from fhir.resources.R4B.domainresource import DomainResource
from fhir.resources.R4B.resource import Resource

# All clinical resources inherit from DomainResource
# Patient, Observation, Condition, etc. all extend DomainResource
```

### Base Resource Functionality in Storage Engine

Located in: `/backend/core/fhir/storage.py`

#### Metadata Handling
```python
# Add resource metadata (common to all resources)
resource_dict['id'] = fhir_id
resource_dict['meta'] = resource_dict.get('meta', {})
resource_dict['meta']['versionId'] = str(version_id)
resource_dict['meta']['lastUpdated'] = last_updated.isoformat()
```

#### Validation Pipeline
```python
# Validation applied to all DomainResource derivatives
fhir_resource = construct_fhir_element(resource_type, resource_data)
resource_dict = fhir_resource.dict(exclude_none=True)
```

#### Search Parameter Extraction
```python
# Common search parameters extracted for all resources
if 'id' in resource_data:
    params_to_extract.append({
        'param_name': '_id',
        'param_type': 'token',
        'value_string': resource_data['id']
    })

if 'meta' in resource_data and 'lastUpdated' in resource_data['meta']:
    params_to_extract.append({
        'param_name': '_lastUpdated',
        'param_type': 'date',
        'value_date': datetime.fromisoformat(
            resource_data['meta']['lastUpdated'].replace('Z', '+00:00')
        )
    })
```

## Test Categories

### 1. Base Resource Structure Tests

#### TC-DR-001: DomainResource Inheritance Validation
**Objective**: Verify all clinical resources properly inherit DomainResource capabilities

**Test Steps**:
1. Create instances of various clinical resources (Patient, Observation, Condition)
2. Verify each has DomainResource elements available
3. Test DomainResource element functionality

**Expected Results**:
- All clinical resources inherit from DomainResource
- DomainResource elements present in all instances
- Proper inheritance hierarchy maintained

#### TC-DR-002: Resource Metadata Validation
**Objective**: Test resource metadata handling across all resource types

**Test Steps**:
1. Create resources with various metadata configurations
2. Test meta.profile, meta.tag, meta.security elements
3. Verify metadata persistence and retrieval

**Expected Results**:
- Metadata properly stored and retrieved
- Profile references validated
- Tags and security labels preserved

#### TC-DR-003: Resource Identity and Versioning
**Objective**: Test resource identity and version management

**Test Steps**:
1. Create resources and verify ID assignment
2. Update resources and verify version increments
3. Test version-specific resource retrieval

**Expected Results**:
- Resource IDs properly assigned
- Version tracking accurate
- Historical versions accessible

### 2. Narrative (text) Element Tests

#### TC-DR-004: Narrative Generation and Validation
**Objective**: Test narrative text element functionality

**Test Steps**:
1. Create resources with narrative text
2. Test narrative status values (generated, extensions, additional, empty)
3. Validate XHTML content in narrative div

**Expected Results**:
- Narrative text properly stored
- Status values validated
- XHTML content preserved and validated

#### TC-DR-005: Narrative Status Validation
**Objective**: Test narrative status enumeration

**Test Steps**:
1. Test each narrative status value:
   - generated: Narrative generated by system
   - extensions: Narrative contains additional information
   - additional: Narrative has more information than resource
   - empty: Narrative is empty
2. Verify status validation rules

**Expected Results**:
- All valid status values accepted
- Invalid status values rejected
- Status semantics respected

#### TC-DR-006: XHTML Content Validation
**Objective**: Test XHTML validation in narrative div element

**Test Steps**:
1. Submit valid XHTML content
2. Submit invalid XHTML content
3. Test XHTML security restrictions

**Expected Results**:
- Valid XHTML accepted
- Invalid XHTML rejected with clear errors
- Security restrictions enforced

### 3. Contained Resources Tests

#### TC-DR-007: Basic Contained Resource Functionality
**Objective**: Test basic contained resource capabilities

**Test Steps**:
1. Create resource with contained Patient
2. Create resource with contained Practitioner
3. Verify contained resource validation

**Expected Results**:
- Contained resources properly embedded
- Contained resource validation applied
- Internal references working

#### TC-DR-008: Contained Resource References
**Objective**: Test references to contained resources

**Test Steps**:
1. Create Observation with contained Patient
2. Reference contained Patient from Observation.subject
3. Verify reference resolution

**Expected Results**:
- Internal references using #id format
- Reference resolution working
- Contained resource accessible

#### TC-DR-009: Complex Contained Resource Scenarios
**Objective**: Test complex contained resource hierarchies

**Test Steps**:
1. Create resource with multiple contained resources
2. Test contained resources referencing other contained resources
3. Verify validation and integrity

**Expected Results**:
- Multiple contained resources supported
- Inter-contained references working
- Validation maintains integrity

### 4. Extension Mechanism Tests

#### TC-DR-010: Basic Extension Functionality
**Objective**: Test basic extension element usage

**Test Steps**:
1. Add simple value extensions to resources
2. Add complex extensions with nested values
3. Verify extension validation and storage

**Expected Results**:
- Extensions properly stored and retrieved
- Extension validation applied
- Extension URLs validated

#### TC-DR-011: Extension URL Validation
**Objective**: Test extension URL requirements and validation

**Test Steps**:
1. Use valid extension URLs
2. Test invalid extension URLs
3. Verify URL format requirements

**Expected Results**:
- Valid URLs accepted
- Invalid URLs rejected
- URL format validation enforced

#### TC-DR-012: Complex Extension Structures
**Objective**: Test complex extension scenarios

**Test Steps**:
1. Create extensions with multiple nested extensions
2. Test extensions on extensions
3. Verify complex extension validation

**Expected Results**:
- Nested extensions supported
- Complex structures validated
- Extension hierarchy preserved

### 5. Modifier Extension Tests

#### TC-DR-013: Modifier Extension Behavior
**Objective**: Test modifier extension functionality and validation

**Test Steps**:
1. Add modifier extensions to resources
2. Test modifier extension URL validation
3. Verify processing requirements

**Expected Results**:
- Modifier extensions properly flagged
- URL validation applied
- Processing implications clear

#### TC-DR-014: Modifier Extension Validation Rules
**Objective**: Test modifier extension-specific validation

**Test Steps**:
1. Use valid modifier extension URLs
2. Test modifier extensions with proper mustSupport
3. Verify modifier extension semantics

**Expected Results**:
- Modifier extension URLs validated
- MustSupport requirements enforced
- Semantic implications respected

#### TC-DR-015: Modifier Extension Processing
**Objective**: Test system behavior with unknown modifier extensions

**Test Steps**:
1. Submit resources with unknown modifier extensions
2. Test system processing behavior
3. Verify error handling

**Expected Results**:
- Unknown modifier extensions trigger warnings/errors
- Processing behavior consistent
- Clear error messages provided

### 6. Resource Validation Tests

#### TC-DR-016: FHIR R4 Schema Validation
**Objective**: Test FHIR R4 schema compliance for DomainResource elements

**Test Steps**:
1. Validate resources against FHIR R4 schema
2. Test schema validation for all DomainResource elements
3. Verify error reporting for schema violations

**Expected Results**:
- Schema validation enforced
- All DomainResource elements validated
- Clear schema violation errors

#### TC-DR-017: Constraint Validation
**Objective**: Test FHIR constraint validation for DomainResource

**Test Steps**:
1. Test invariant constraints on DomainResource
2. Verify constraint validation for inherited constraints
3. Test custom constraint implementation

**Expected Results**:
- Invariant constraints enforced
- Inherited constraints validated
- Custom constraints working

#### TC-DR-018: Profile Validation
**Objective**: Test profile-based validation for DomainResource derivatives

**Test Steps**:
1. Apply profiles to various resource types
2. Test profile constraint enforcement
3. Verify profile-specific validation

**Expected Results**:
- Profile constraints enforced
- Profile validation accurate
- Profile-specific rules applied

### 7. Search Parameter Tests

#### TC-DR-019: Common Search Parameters
**Objective**: Test search parameters common to all DomainResource derivatives

**Test Steps**:
1. Test _id search parameter
2. Test _lastUpdated search parameter  
3. Test _profile search parameter
4. Test _tag and _security search parameters

**Expected Results**:
- Common search parameters work across all resources
- Search indexing consistent
- Search results accurate

#### TC-DR-020: Search Parameter Inheritance
**Objective**: Test search parameter inheritance from DomainResource

**Test Steps**:
1. Verify inherited search parameters on derived resources
2. Test search parameter combination with resource-specific parameters
3. Verify search parameter index consistency

**Expected Results**:
- Search parameters properly inherited
- Combination searches working
- Index consistency maintained

#### TC-DR-021: Meta Search Parameters
**Objective**: Test search parameters related to resource metadata

**Test Steps**:
1. Search by meta.profile
2. Search by meta.tag
3. Search by meta.security
4. Search by meta.lastUpdated

**Expected Results**:
- Metadata search parameters working
- Accurate search results
- Proper index extraction

### 8. Integration Tests

#### TC-DR-022: CRUD Operations on DomainResource Derivatives
**Objective**: Test CRUD operations maintain DomainResource functionality

**Test Steps**:
1. Create, read, update, delete various resource types
2. Verify DomainResource elements preserved through operations
3. Test operation impact on extensions and contained resources

**Expected Results**:
- CRUD operations preserve DomainResource elements
- Extensions maintained through operations
- Contained resources handled correctly

#### TC-DR-023: Bundle Operations with DomainResource Elements
**Objective**: Test Bundle operations with DomainResource functionality

**Test Steps**:
1. Include resources with contained resources in bundles
2. Test bundle operations with resources containing extensions
3. Verify bundle processing preserves DomainResource elements

**Expected Results**:
- Bundle operations preserve DomainResource elements
- Contained resources handled in bundles
- Extensions preserved through bundle processing

#### TC-DR-024: Version and History with DomainResource
**Objective**: Test versioning and history with DomainResource elements

**Test Steps**:
1. Update resources with DomainResource elements
2. Retrieve historical versions
3. Verify DomainResource element history

**Expected Results**:
- Historical versions preserve DomainResource elements
- Version history accurate
- Element history trackable

### 9. Performance Tests

#### TC-DR-025: Large Extension Performance
**Objective**: Test performance with resources containing many extensions

**Test Steps**:
1. Create resources with large numbers of extensions
2. Test serialization/deserialization performance
3. Monitor memory usage and processing time

**Expected Results**:
- Large extension counts handled efficiently
- Performance within acceptable limits
- Memory usage reasonable

#### TC-DR-026: Complex Contained Resource Performance
**Objective**: Test performance with complex contained resource hierarchies

**Test Steps**:
1. Create resources with deeply nested contained resources
2. Test validation and processing performance
3. Monitor system resource usage

**Expected Results**:
- Complex contained structures handled efficiently
- Validation performance acceptable
- System resources used efficiently

#### TC-DR-027: Bulk Operations with DomainResource Elements
**Objective**: Test bulk operations preserving DomainResource functionality

**Test Steps**:
1. Perform bulk operations on resources with extensions
2. Test bulk operations with contained resources
3. Verify DomainResource element preservation at scale

**Expected Results**:
- Bulk operations preserve DomainResource elements
- Scale performance acceptable
- Element integrity maintained

## Testing Implementation

### Unit Tests
```python
# Test file: test_domain_resource.py

class TestDomainResource:
    def test_domain_resource_inheritance(self):
        # TC-DR-001 implementation
        patient = Patient(
            name=[{"family": "Test", "given": ["Patient"]}],
            gender="unknown"
        )
        
        # Verify DomainResource elements available
        assert hasattr(patient, 'text')
        assert hasattr(patient, 'contained')
        assert hasattr(patient, 'extension')
        assert hasattr(patient, 'modifierExtension')
    
    def test_resource_metadata(self):
        # TC-DR-002 implementation
        patient = Patient(
            meta={
                "profile": ["http://example.org/StructureDefinition/TestPatient"],
                "tag": [{"system": "http://example.org/tags", "code": "test"}],
                "security": [{"system": "http://example.org/security", "code": "restricted"}]
            },
            name=[{"family": "Test"}],
            gender="unknown"
        )
        
        assert len(patient.meta.profile) == 1
        assert patient.meta.tag[0].code == "test"
        assert patient.meta.security[0].code == "restricted"
    
    def test_narrative_text(self):
        # TC-DR-004 implementation
        narrative = {
            "status": "generated",
            "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Test narrative</div>"
        }
        
        patient = Patient(
            text=narrative,
            name=[{"family": "Test"}],
            gender="unknown"
        )
        
        assert patient.text.status == "generated"
        assert "Test narrative" in patient.text.div
    
    def test_contained_resources(self):
        # TC-DR-007 implementation
        contained_practitioner = Practitioner(
            id="contained-practitioner",
            name=[{"family": "Doctor", "given": ["Test"]}]
        )
        
        observation = Observation(
            contained=[contained_practitioner],
            status="final",
            code={"coding": [{"system": "http://loinc.org", "code": "8302-2"}]},
            subject={"reference": "Patient/123"},
            performer=[{"reference": "#contained-practitioner"}],
            valueQuantity={"value": 185, "unit": "cm"}
        )
        
        assert len(observation.contained) == 1
        assert observation.contained[0].id == "contained-practitioner"
        assert observation.performer[0].reference == "#contained-practitioner"
    
    def test_extensions(self):
        # TC-DR-010 implementation
        extension = {
            "url": "http://example.org/extensions/test-extension",
            "valueString": "test-value"
        }
        
        patient = Patient(
            extension=[extension],
            name=[{"family": "Test"}],
            gender="unknown"
        )
        
        assert len(patient.extension) == 1
        assert patient.extension[0].url == "http://example.org/extensions/test-extension"
        assert patient.extension[0].valueString == "test-value"
    
    def test_modifier_extensions(self):
        # TC-DR-013 implementation
        modifier_extension = {
            "url": "http://example.org/extensions/modifier-extension",
            "valueBoolean": True
        }
        
        patient = Patient(
            modifierExtension=[modifier_extension],
            name=[{"family": "Test"}],
            gender="unknown"
        )
        
        assert len(patient.modifierExtension) == 1
        assert patient.modifierExtension[0].url == "http://example.org/extensions/modifier-extension"
        assert patient.modifierExtension[0].valueBoolean is True
```

### Integration Tests
```python
# Test file: test_domain_resource_integration.py

class TestDomainResourceIntegration:
    async def test_crud_preserves_domain_elements(self):
        # TC-DR-022 implementation
        patient_data = {
            "resourceType": "Patient",
            "text": {
                "status": "generated",
                "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">Test narrative</div>"
            },
            "extension": [{
                "url": "http://example.org/extension",
                "valueString": "test"
            }],
            "name": [{"family": "Test", "given": ["Patient"]}],
            "gender": "unknown"
        }
        
        # Create
        patient_id, version, created = await storage.create_resource("Patient", patient_data)
        
        # Read
        retrieved = await storage.read_resource("Patient", patient_id)
        
        # Verify DomainResource elements preserved
        assert retrieved["text"]["status"] == "generated"
        assert len(retrieved["extension"]) == 1
        assert retrieved["extension"][0]["valueString"] == "test"
    
    async def test_bundle_with_domain_elements(self):
        # TC-DR-023 implementation
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "request": {"method": "POST", "url": "Patient"},
                    "resource": {
                        "resourceType": "Patient",
                        "extension": [{
                            "url": "http://example.org/extension",
                            "valueString": "bundle-test"
                        }],
                        "name": [{"family": "Bundle", "given": ["Test"]}],
                        "gender": "unknown"
                    }
                }
            ]
        }
        
        response = await storage.process_bundle_dict(bundle)
        
        # Verify extension preserved through bundle processing
        assert response["type"] == "transaction-response"
        assert response["entry"][0]["response"]["status"] == "201"
```

### Performance Tests
```python
# Test file: test_domain_resource_performance.py

class TestDomainResourcePerformance:
    def test_large_extension_performance(self):
        # TC-DR-025 implementation
        extensions = []
        for i in range(1000):
            extensions.append({
                "url": f"http://example.org/extension-{i}",
                "valueString": f"value-{i}"
            })
        
        start_time = time.time()
        patient = Patient(
            extension=extensions,
            name=[{"family": "Performance", "given": ["Test"]}],
            gender="unknown"
        )
        creation_time = time.time() - start_time
        
        start_time = time.time()
        patient_dict = patient.dict()
        serialization_time = time.time() - start_time
        
        # Performance assertions
        assert creation_time < 1.0  # Should create within 1 second
        assert serialization_time < 1.0  # Should serialize within 1 second
        assert len(patient_dict["extension"]) == 1000
```

## Test Data

### Basic DomainResource with All Elements
```json
{
  "resourceType": "Patient",
  "id": "domain-resource-test",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2023-01-01T00:00:00Z",
    "profile": ["http://example.org/StructureDefinition/TestPatient"],
    "tag": [
      {
        "system": "http://example.org/tags",
        "code": "test-patient"
      }
    ],
    "security": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
        "code": "N"
      }
    ]
  },
  "implicitRules": "http://example.org/rules",
  "language": "en-US",
  "text": {
    "status": "generated",
    "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p>Test Patient for DomainResource testing</p></div>"
  },
  "contained": [
    {
      "resourceType": "Practitioner",
      "id": "contained-practitioner",
      "name": [
        {
          "family": "Doctor",
          "given": ["Test"]
        }
      ]
    }
  ],
  "extension": [
    {
      "url": "http://example.org/extensions/birth-place",
      "valueAddress": {
        "city": "Test City",
        "state": "Test State",
        "country": "Test Country"
      }
    }
  ],
  "modifierExtension": [
    {
      "url": "http://example.org/extensions/patient-status",
      "valueCode": "active"
    }
  ],
  "name": [
    {
      "family": "Test",
      "given": ["Domain", "Resource"]
    }
  ],
  "gender": "unknown"
}
```

### Resource with Complex Extensions
```json
{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "8302-2",
        "display": "Body height"
      }
    ]
  },
  "subject": {
    "reference": "Patient/123"
  },
  "extension": [
    {
      "url": "http://example.org/extensions/measurement-context",
      "extension": [
        {
          "url": "location",
          "valueString": "clinic"
        },
        {
          "url": "equipment",
          "valueString": "stadiometer"
        },
        {
          "url": "accuracy",
          "valueQuantity": {
            "value": 0.1,
            "unit": "cm"
          }
        }
      ]
    }
  ],
  "valueQuantity": {
    "value": 185,
    "unit": "cm",
    "system": "http://unitsofmeasure.org",
    "code": "cm"
  }
}
```

### Resource with Multiple Contained Resources
```json
{
  "resourceType": "DiagnosticReport",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
          "code": "LAB"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "24323-8",
        "display": "Comprehensive metabolic 2000 panel - Serum or Plasma"
      }
    ]
  },
  "subject": {
    "reference": "Patient/123"
  },
  "contained": [
    {
      "resourceType": "Practitioner",
      "id": "ordering-physician",
      "name": [
        {
          "family": "Physician",
          "given": ["Ordering"]
        }
      ]
    },
    {
      "resourceType": "Organization",
      "id": "lab-organization",
      "name": "Test Laboratory"
    },
    {
      "resourceType": "Specimen",
      "id": "blood-specimen", 
      "type": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "119297000",
            "display": "Blood specimen"
          }
        ]
      }
    }
  ],
  "performer": [
    {
      "reference": "#lab-organization"
    }
  ],
  "specimen": [
    {
      "reference": "#blood-specimen"
    }
  ]
}
```

## Validation Rules for DomainResource

### Narrative Validation
1. **text.status**: Must be one of generated, extensions, additional, empty
2. **text.div**: Must be valid XHTML with specific namespace
3. **XHTML content**: Must not contain script, object, embed, or other unsafe elements
4. **Narrative completeness**: Should provide human-readable summary

### Contained Resource Validation
1. **Resource completeness**: Contained resources must be valid FHIR resources
2. **Reference format**: References to contained resources must use #id format
3. **Independence violation**: Contained resources should not have independent existence
4. **Circular references**: Cannot contain resources that reference the container

### Extension Validation
1. **URL format**: Extension URLs must be valid URIs
2. **Value constraints**: Extensions must have exactly one value element
3. **Definition compliance**: Extensions should conform to their definitions
4. **Nested extensions**: Complex extensions using extension.extension

### Modifier Extension Validation
1. **Processing requirement**: Systems must understand modifier extensions or reject resource
2. **URL validation**: Modifier extension URLs must be valid URIs
3. **Semantic impact**: Modifier extensions change resource meaning
4. **Documentation**: Modifier extensions require clear documentation

## Performance Optimization

### DomainResource Element Optimization
1. **Lazy loading**: Load narrative and extensions only when needed
2. **Caching**: Cache parsed extension values
3. **Indexing**: Index commonly searched extension URLs
4. **Compression**: Compress large narrative content

### Contained Resource Optimization
1. **Reference resolution**: Efficient resolution of contained resource references
2. **Validation caching**: Cache validation results for contained resources
3. **Serialization**: Optimize serialization of complex contained hierarchies
4. **Memory management**: Efficient memory usage for large contained resources

## Security Considerations

### Narrative Security
1. **XHTML sanitization**: Remove potentially harmful XHTML elements
2. **Content filtering**: Filter sensitive information from narratives
3. **Size limits**: Limit narrative content size
4. **Encoding validation**: Validate character encoding

### Extension Security
1. **URL validation**: Validate extension URLs for security
2. **Value sanitization**: Sanitize extension values
3. **Access control**: Respect access controls for extension content
4. **Information disclosure**: Prevent sensitive information in extensions

### Contained Resource Security
1. **Access inheritance**: Contained resources inherit container access controls
2. **Reference validation**: Validate contained resource references
3. **Isolation**: Ensure contained resources don't expose unauthorized data
4. **Audit trails**: Track access to contained resources

## Recent Updates

### 2025-07-14
- Created comprehensive DomainResource testing documentation
- Defined inheritance validation and metadata testing scenarios
- Established narrative, contained resource, and extension test requirements
- Added performance and security considerations for base resource functionality
- Documented validation rules and optimization strategies for DomainResource elements

---

**Next Steps**:
1. Implement automated DomainResource test suite
2. Add validation utilities for DomainResource elements
3. Enhance extension and contained resource handling
4. Implement performance monitoring for base resource operations