# Parameters Resource Testing Documentation

## Overview

The Parameters resource is a non-persistent container used to pass information into and return information from FHIR operations. It serves as the input/output mechanism for FHIR operations and has no RESTful endpoint of its own, being specifically designed for operation parameter passing.

## FHIR R4 Parameters Structure

### Core Elements
- **resourceType**: Always "Parameters"
- **parameter**: Array of parameter elements (0..*)
  - **name**: Parameter name (required)
  - **value[x]**: Parameter value (choice of 50+ types)
  - **resource**: Complete FHIR resource as parameter
  - **part**: Multi-part parameter (for complex structures)

### Supported Value Types
Parameters support all FHIR data types including:
- **Primitives**: string, integer, decimal, boolean, date, dateTime, uri, etc.
- **Complex Types**: CodeableConcept, Coding, Identifier, Reference, etc.
- **Resources**: Any FHIR resource can be passed as a parameter
- **Multi-part**: Complex parameter structures using `part` elements

## Current Implementation Analysis

### Parameters Usage in Operations

Located in: `/backend/core/fhir/operations.py`

#### Operation Handler Integration
```python
async def execute_operation(
    self,
    operation_name: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    parameters: Optional[Parameters] = None
) -> Any:
    # Parameters passed to operation handlers
    return await handler(resource_type, resource_id, parameters)
```

#### Parameter Extraction Patterns
```python
# $validate operation parameter extraction
if parameters and parameters.parameter:
    for param in parameters.parameter:
        if param.name == 'resource':
            resource_param = param.resource
        elif param.name == 'profile':
            profile_param = param.valueUri

# $convert operation parameter extraction  
for param in parameters.parameter or []:
    if param.name == "input":
        input_resource = param.resource
    elif param.name == "format":
        target_format = param.valueString
```

#### Parameter Creation Patterns
```python
# Simple parameter creation
return Parameters(
    parameter=[
        ParametersParameter(
            name="result",
            valueBoolean=is_valid
        ),
        ParametersParameter(
            name="message", 
            valueString=f"Validation result: {message}"
        )
    ]
)

# Complex parameter with parts
return Parameters(
    parameter=[
        ParametersParameter(
            name="statistics",
            part=[
                ParametersParameter(name="count", valueInteger=100),
                ParametersParameter(name="average", valueDecimal=120.5),
                ParametersParameter(name="min", valueDecimal=80.0),
                ParametersParameter(name="max", valueDecimal=180.0)
            ]
        )
    ]
)
```

## Test Categories

### 1. Parameters Structure Tests

#### TC-PAR-001: Basic Structure Validation
**Objective**: Verify Parameters resource meets FHIR R4 structure requirements

**Test Steps**:
1. Create Parameters with empty parameter array
2. Create Parameters with single parameter
3. Validate against FHIR R4 schema

**Expected Results**:
- Valid FHIR R4 Parameters structure
- Empty parameter array allowed
- Proper JSON/XML serialization

#### TC-PAR-002: Parameter Element Validation
**Objective**: Verify parameter element structure requirements

**Test Steps**:
1. Create parameter without name (should fail)
2. Create parameter with name only
3. Create parameter with value and resource (should fail)

**Expected Results**:
- Parameter name is required
- Parameter must have either value[x], resource, or part
- Cannot have both value and resource simultaneously

#### TC-PAR-003: Parameter Naming Validation
**Objective**: Test parameter naming rules and validation

**Test Steps**:
1. Create parameters with valid names
2. Test parameters with special characters
3. Test parameter name uniqueness within same level

**Expected Results**:
- Valid names accepted
- Special characters handled appropriately
- Name uniqueness not enforced (multiple parameters can have same name)

### 2. Value Type Tests

#### TC-PAR-004: Primitive Value Types
**Objective**: Test all primitive FHIR data types as parameter values

**Test Steps**:
1. Create parameters with each primitive type:
   - valueString
   - valueInteger
   - valueDecimal
   - valueBoolean
   - valueDate
   - valueDateTime
   - valueTime
   - valueUri
   - valueUrl
   - valueCanonical
   - valueCode
   - valueOid
   - valueUuid
   - valueId
   - valueUnsignedInt
   - valuePositiveInt
   - valueMarkdown
   - valueBase64Binary
   - valueInstant

**Expected Results**:
- All primitive types properly handled
- Type validation applied correctly
- Serialization preserves type information

#### TC-PAR-005: Complex Value Types
**Objective**: Test complex FHIR data types as parameter values

**Test Steps**:
1. Create parameters with complex types:
   - valueCodeableConcept
   - valueCoding
   - valueQuantity
   - valueRange
   - valueRatio
   - valuePeriod
   - valueReference
   - valueIdentifier
   - valueHumanName
   - valueAddress
   - valueContactPoint
   - valueAttachment
   - valueMeta
   - valueSignature

**Expected Results**:
- Complex types properly structured
- Nested elements validated
- Reference resolution working

#### TC-PAR-006: Resource Parameters
**Objective**: Test passing complete FHIR resources as parameters

**Test Steps**:
1. Create parameter with Patient resource
2. Create parameter with Observation resource
3. Test parameter with Bundle resource

**Expected Results**:
- Resources properly embedded
- Resource validation applied
- Nested resource structure preserved

### 3. Multi-part Parameter Tests

#### TC-PAR-007: Simple Multi-part Parameters
**Objective**: Test basic multi-part parameter structure

**Test Steps**:
1. Create parameter with simple parts
2. Test nested part structures
3. Verify part parameter naming

**Expected Results**:
- Parts properly nested
- Part validation applied
- Clear parameter hierarchy

#### TC-PAR-008: Complex Multi-part Parameters
**Objective**: Test complex multi-part parameter scenarios

**Test Steps**:
1. Create parameters with multiple levels of nesting
2. Test mixed value types within parts
3. Test parts with resources

**Expected Results**:
- Deep nesting supported
- Mixed types within parts work
- Resource parts properly handled

#### TC-PAR-009: Multi-part Parameter Validation
**Objective**: Test validation of multi-part parameter structures

**Test Steps**:
1. Create invalid part structures
2. Test parts without names
3. Test circular part references

**Expected Results**:
- Invalid structures rejected
- Part validation enforced
- Circular references prevented

### 4. Operation Integration Tests

#### TC-PAR-010: Validate Operation Parameters
**Objective**: Test Parameters with $validate operation

**Test Steps**:
1. Call $validate with resource parameter
2. Call $validate with profile parameter
3. Test $validate with missing parameters

**Expected Results**:
- Resource parameter properly extracted
- Profile parameter applied correctly
- Missing parameters handled gracefully

#### TC-PAR-011: Search Operation Parameters
**Objective**: Test Parameters with $search operation

**Test Steps**:
1. Use Parameters for POST-based search
2. Include multiple search parameters
3. Test search parameter validation

**Expected Results**:
- Search parameters extracted correctly
- Multiple parameters supported
- Search executed properly

#### TC-PAR-012: Custom Operation Parameters
**Objective**: Test Parameters with custom operations

**Test Steps**:
1. Define custom operation with Parameters input
2. Test parameter extraction and validation
3. Verify parameter-based operation execution

**Expected Results**:
- Custom parameters supported
- Parameter validation working
- Operation execution successful

### 5. Parameter Extraction and Processing

#### TC-PAR-013: Parameter Extraction Utilities
**Objective**: Test parameter extraction helper functions

**Test Steps**:
1. Extract parameters by name
2. Extract parameters by type
3. Test parameter existence checking

**Expected Results**:
- Parameters extracted by name correctly
- Type-based extraction working
- Existence checking reliable

#### TC-PAR-014: Parameter Type Coercion
**Objective**: Test automatic type conversion for parameters

**Test Steps**:
1. Pass string values for numeric parameters
2. Test date string to date conversion
3. Verify boolean string handling

**Expected Results**:
- Appropriate type coercion applied
- Invalid conversions rejected
- Type safety maintained

#### TC-PAR-015: Parameter Default Values
**Objective**: Test default value handling for missing parameters

**Test Steps**:
1. Call operations with missing optional parameters
2. Test operations with required parameters missing
3. Verify default value application

**Expected Results**:
- Default values applied for missing optional parameters
- Required parameter absence causes error
- Default value types consistent

### 6. Error Handling Tests

#### TC-PAR-016: Invalid Parameter Structure
**Objective**: Test handling of malformed Parameters resources

**Test Steps**:
1. Submit Parameters with invalid JSON
2. Submit Parameters with missing required fields
3. Test Parameters with conflicting value types

**Expected Results**:
- Malformed Parameters rejected
- Clear error messages provided
- OperationOutcome generated appropriately

#### TC-PAR-017: Parameter Validation Errors
**Objective**: Test parameter-specific validation errors

**Test Steps**:
1. Submit parameters with invalid value types
2. Test parameters with invalid resource content
3. Verify parameter constraint validation

**Expected Results**:
- Parameter validation applied
- Specific error details provided
- Operation fails appropriately

#### TC-PAR-018: Operation Parameter Mismatches
**Objective**: Test parameter compatibility with operations

**Test Steps**:
1. Submit wrong parameter types to operations
2. Test operations with excessive parameters
3. Verify parameter name validation

**Expected Results**:
- Parameter type mismatches detected
- Excessive parameters handled gracefully
- Parameter names validated against operation definitions

### 7. Serialization and Format Tests

#### TC-PAR-019: JSON Serialization
**Objective**: Test Parameters JSON format compliance

**Test Steps**:
1. Serialize Parameters with all value types
2. Test round-trip serialization/deserialization
3. Verify JSON schema compliance

**Expected Results**:
- Valid FHIR JSON format
- Round-trip preservation of data
- Schema compliance maintained

#### TC-PAR-020: XML Serialization  
**Objective**: Test Parameters XML format compliance

**Test Steps**:
1. Serialize Parameters to XML
2. Test XML schema validation
3. Verify namespace handling

**Expected Results**:
- Valid FHIR XML format
- XML schema compliance
- Proper namespace declarations

#### TC-PAR-021: Content Type Negotiation
**Objective**: Test Parameters with different content types

**Test Steps**:
1. Submit Parameters as JSON
2. Submit Parameters as XML
3. Test Accept header handling for responses

**Expected Results**:
- Both JSON and XML accepted
- Appropriate response format returned
- Content negotiation working

### 8. Performance and Scalability Tests

#### TC-PAR-022: Large Parameters Handling
**Objective**: Test handling of large Parameters resources

**Test Steps**:
1. Create Parameters with many parameter elements
2. Test Parameters with large resource values
3. Monitor memory usage and performance

**Expected Results**:
- Large Parameters handled efficiently
- Memory usage within reasonable limits
- Processing time acceptable

#### TC-PAR-023: Deep Nesting Performance
**Objective**: Test performance with deeply nested parameter structures

**Test Steps**:
1. Create Parameters with deep part nesting
2. Test serialization/deserialization performance
3. Verify processing speed

**Expected Results**:
- Deep nesting handled efficiently
- Serialization performance acceptable
- No stack overflow issues

#### TC-PAR-024: Concurrent Parameter Processing
**Objective**: Test concurrent operations with Parameters

**Test Steps**:
1. Submit multiple operations with Parameters simultaneously
2. Test parameter isolation between operations
3. Verify thread safety

**Expected Results**:
- Concurrent processing works correctly
- Parameter isolation maintained
- Thread safety ensured

## Testing Implementation

### Unit Tests
```python
# Test file: test_parameters.py

class TestParameters:
    def test_basic_structure(self):
        # TC-PAR-001 implementation
        params = Parameters(
            parameter=[
                ParametersParameter(
                    name="test-param",
                    valueString="test-value"
                )
            ]
        )
        
        assert params.resourceType == "Parameters"
        assert len(params.parameter) == 1
        assert params.parameter[0].name == "test-param"
        assert params.parameter[0].valueString == "test-value"
    
    def test_primitive_value_types(self):
        # TC-PAR-004 implementation
        params = Parameters(
            parameter=[
                ParametersParameter(name="string-param", valueString="test"),
                ParametersParameter(name="int-param", valueInteger=42),
                ParametersParameter(name="bool-param", valueBoolean=True),
                ParametersParameter(name="date-param", valueDate="2023-01-01")
            ]
        )
        
        assert len(params.parameter) == 4
        assert params.parameter[0].valueString == "test"
        assert params.parameter[1].valueInteger == 42
        assert params.parameter[2].valueBoolean is True
        assert params.parameter[3].valueDate == "2023-01-01"
    
    def test_complex_value_types(self):
        # TC-PAR-005 implementation
        coding = Coding(
            system="http://example.org/codes",
            code="test-code",
            display="Test Code"
        )
        
        params = Parameters(
            parameter=[
                ParametersParameter(
                    name="coding-param",
                    valueCoding=coding
                )
            ]
        )
        
        assert params.parameter[0].valueCoding.code == "test-code"
    
    def test_resource_parameters(self):
        # TC-PAR-006 implementation
        patient = Patient(
            name=[{"family": "Test", "given": ["Patient"]}],
            gender="unknown"
        )
        
        params = Parameters(
            parameter=[
                ParametersParameter(
                    name="patient-param",
                    resource=patient
                )
            ]
        )
        
        assert params.parameter[0].resource.resourceType == "Patient"
        assert params.parameter[0].resource.name[0].family == "Test"
    
    def test_multipart_parameters(self):
        # TC-PAR-007 implementation
        params = Parameters(
            parameter=[
                ParametersParameter(
                    name="complex-param",
                    part=[
                        ParametersParameter(name="sub-param1", valueString="value1"),
                        ParametersParameter(name="sub-param2", valueInteger=123)
                    ]
                )
            ]
        )
        
        assert len(params.parameter[0].part) == 2
        assert params.parameter[0].part[0].valueString == "value1"
        assert params.parameter[0].part[1].valueInteger == 123
```

### Operation Integration Tests
```python
# Test file: test_parameters_operations.py

class TestParametersOperations:
    async def test_validate_operation_parameters(self):
        # TC-PAR-010 implementation
        patient = Patient(name=[{"family": "Test"}], gender="unknown")
        
        params = Parameters(
            parameter=[
                ParametersParameter(name="resource", resource=patient),
                ParametersParameter(name="profile", valueUri="http://example.org/Profile")
            ]
        )
        
        result = await operation_handler.execute_operation(
            "validate", parameters=params
        )
        
        assert isinstance(result, OperationOutcome)
    
    async def test_search_operation_parameters(self):
        # TC-PAR-011 implementation
        params = Parameters(
            parameter=[
                ParametersParameter(name="name", valueString="Test"),
                ParametersParameter(name="gender", valueString="unknown")
            ]
        )
        
        result = await operation_handler.execute_operation(
            "search", resource_type="Patient", parameters=params
        )
        
        assert isinstance(result, Bundle)
        assert result.type == "searchset"
```

### Parameter Extraction Tests
```python
# Test file: test_parameter_extraction.py

class TestParameterExtraction:
    def test_extract_parameter_by_name(self):
        # TC-PAR-013 implementation
        params = Parameters(
            parameter=[
                ParametersParameter(name="param1", valueString="value1"),
                ParametersParameter(name="param2", valueInteger=42)
            ]
        )
        
        value1 = extract_parameter_value(params, "param1")
        value2 = extract_parameter_value(params, "param2")
        
        assert value1 == "value1"
        assert value2 == 42
    
    def test_extract_resource_parameter(self):
        # Helper function test
        patient = Patient(name=[{"family": "Test"}])
        params = Parameters(
            parameter=[
                ParametersParameter(name="patient", resource=patient)
            ]
        )
        
        extracted_patient = extract_resource_parameter(params, "patient", Patient)
        
        assert isinstance(extracted_patient, Patient)
        assert extracted_patient.name[0].family == "Test"
```

## Test Data

### Basic Parameters Resource
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "simple-string",
      "valueString": "test-value"
    },
    {
      "name": "simple-integer", 
      "valueInteger": 42
    },
    {
      "name": "simple-boolean",
      "valueBoolean": true
    }
  ]
}
```

### Complex Parameters Resource
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "coding-parameter",
      "valueCoding": {
        "system": "http://loinc.org",
        "code": "8302-2",
        "display": "Body height"
      }
    },
    {
      "name": "reference-parameter",
      "valueReference": {
        "reference": "Patient/123",
        "display": "Test Patient"
      }
    }
  ]
}
```

### Resource Parameter
```json
{
  "resourceType": "Parameters", 
  "parameter": [
    {
      "name": "patient-resource",
      "resource": {
        "resourceType": "Patient",
        "id": "example-patient",
        "name": [
          {
            "family": "Doe",
            "given": ["John"]
          }
        ],
        "gender": "male"
      }
    }
  ]
}
```

### Multi-part Parameters
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "complex-statistics",
      "part": [
        {
          "name": "count",
          "valueInteger": 150
        },
        {
          "name": "average",
          "valueDecimal": 125.7
        },
        {
          "name": "range",
          "part": [
            {
              "name": "min",
              "valueDecimal": 90.0
            },
            {
              "name": "max", 
              "valueDecimal": 180.0
            }
          ]
        }
      ]
    }
  ]
}
```

### Operation-Specific Parameters

#### $validate Operation
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "resource",
      "resource": {
        "resourceType": "Patient",
        "name": [{"family": "Test"}],
        "gender": "unknown"
      }
    },
    {
      "name": "profile",
      "valueUri": "http://hl7.org/fhir/StructureDefinition/Patient"
    }
  ]
}
```

#### $expand Operation
```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "url",
      "valueUri": "http://hl7.org/fhir/ValueSet/administrative-gender"
    },
    {
      "name": "filter",
      "valueString": "mal"
    },
    {
      "name": "count",
      "valueInteger": 10
    }
  ]
}
```

## Parameter Extraction Utilities

### Helper Functions
```python
def extract_parameter_value(parameters: Parameters, name: str, default=None):
    """Extract parameter value by name."""
    if not parameters or not parameters.parameter:
        return default
    
    for param in parameters.parameter:
        if param.name == name:
            # Return the first non-None value attribute
            for attr in dir(param):
                if attr.startswith('value') and getattr(param, attr) is not None:
                    return getattr(param, attr)
            return param.resource if param.resource else default
    
    return default

def extract_resource_parameter(parameters: Parameters, name: str, resource_type=None):
    """Extract resource parameter by name."""
    if not parameters or not parameters.parameter:
        return None
    
    for param in parameters.parameter:
        if param.name == name and param.resource:
            if resource_type and param.resource.resourceType != resource_type.__name__:
                raise ValueError(f"Expected {resource_type.__name__}, got {param.resource.resourceType}")
            return param.resource
    
    return None

def extract_multipart_parameter(parameters: Parameters, name: str):
    """Extract multi-part parameter by name."""
    if not parameters or not parameters.parameter:
        return None
    
    for param in parameters.parameter:
        if param.name == name and param.part:
            # Convert parts to dictionary for easier access
            parts_dict = {}
            for part in param.part:
                value = None
                for attr in dir(part):
                    if attr.startswith('value') and getattr(part, attr) is not None:
                        value = getattr(part, attr)
                        break
                if value is None and part.resource:
                    value = part.resource
                if value is None and part.part:
                    value = extract_multipart_parameter(Parameters(parameter=[part]), part.name)
                parts_dict[part.name] = value
            return parts_dict
    
    return None

def validate_required_parameters(parameters: Parameters, required_params: List[str]):
    """Validate that all required parameters are present."""
    if not parameters or not parameters.parameter:
        if required_params:
            raise ValueError(f"Missing required parameters: {required_params}")
        return
    
    param_names = {param.name for param in parameters.parameter}
    missing = set(required_params) - param_names
    
    if missing:
        raise ValueError(f"Missing required parameters: {list(missing)}")
```

### Parameter Builder Utility
```python
class ParametersBuilder:
    """Builder pattern for creating Parameters resources."""
    
    def __init__(self):
        self.parameters = []
    
    def add_string(self, name: str, value: str):
        self.parameters.append(
            ParametersParameter(name=name, valueString=value)
        )
        return self
    
    def add_integer(self, name: str, value: int):
        self.parameters.append(
            ParametersParameter(name=name, valueInteger=value)
        )
        return self
    
    def add_boolean(self, name: str, value: bool):
        self.parameters.append(
            ParametersParameter(name=name, valueBoolean=value)
        )
        return self
    
    def add_resource(self, name: str, resource):
        self.parameters.append(
            ParametersParameter(name=name, resource=resource)
        )
        return self
    
    def add_multipart(self, name: str, parts: Dict[str, Any]):
        part_params = []
        for part_name, part_value in parts.items():
            if isinstance(part_value, str):
                part_params.append(
                    ParametersParameter(name=part_name, valueString=part_value)
                )
            elif isinstance(part_value, int):
                part_params.append(
                    ParametersParameter(name=part_name, valueInteger=part_value)
                )
            elif isinstance(part_value, bool):
                part_params.append(
                    ParametersParameter(name=part_name, valueBoolean=part_value)
                )
            # Add more type handling as needed
        
        self.parameters.append(
            ParametersParameter(name=name, part=part_params)
        )
        return self
    
    def build(self) -> Parameters:
        return Parameters(parameter=self.parameters)
```

## Validation Rules

### Parameter-Level Validation
1. **Parameter name**: Required for all parameters
2. **Value exclusivity**: Cannot have both value[x] and resource
3. **Value requirement**: Must have either value[x], resource, or part
4. **Part validation**: Parts follow same rules as top-level parameters

### Type-Specific Validation
1. **Primitive types**: Format and range validation
2. **Complex types**: Structure and constraint validation  
3. **Resources**: Full FHIR resource validation
4. **References**: Reference format and target validation

### Operation-Specific Validation
1. **Required parameters**: Operation-defined required parameters
2. **Parameter types**: Expected types for operation parameters
3. **Parameter combinations**: Valid parameter combinations
4. **Parameter constraints**: Operation-specific business rules

## Error Scenarios & Expected Outcomes

### Structure Errors
| Error Type | Expected Outcome |
|------------|------------------|
| Missing parameter name | 400 Bad Request with OperationOutcome |
| Both value and resource present | 400 Bad Request with validation error |
| Empty parameter (no value/resource/part) | 400 Bad Request with validation error |
| Invalid JSON structure | 400 Bad Request with parse error |

### Type Validation Errors
| Error Type | Expected Outcome |
|------------|------------------|
| Invalid primitive type format | 400 Bad Request with type error |
| Invalid complex type structure | 400 Bad Request with structure error |
| Invalid resource content | 400 Bad Request with resource validation error |
| Invalid reference format | 400 Bad Request with reference error |

### Operation Parameter Errors
| Error Type | Expected Outcome |
|------------|------------------|
| Missing required parameter | 400 Bad Request with missing parameter error |
| Wrong parameter type | 400 Bad Request with type mismatch error |
| Invalid parameter combination | 400 Bad Request with business rule error |
| Unknown parameter for operation | Warning or ignored depending on operation |

## Performance Considerations

### Parameter Processing Optimization
1. **Lazy loading**: Load parameter values only when needed
2. **Type caching**: Cache type information for repeated access
3. **Bulk processing**: Efficient processing of multiple parameters
4. **Memory management**: Proper cleanup of large parameter values

### Serialization Performance
1. **Streaming**: Stream large Parameters resources
2. **Compression**: Compress large parameter values
3. **Caching**: Cache serialized forms for repeated use
4. **Parallel processing**: Parallelize parameter processing where safe

## Security Considerations

### Parameter Sanitization
1. **Input validation**: Validate all parameter inputs
2. **Type safety**: Enforce strict type checking
3. **Size limits**: Limit parameter value sizes
4. **Resource validation**: Validate embedded resources fully

### Information Disclosure
1. **Error messages**: Sanitize error messages in parameters
2. **Resource filtering**: Filter sensitive resource content
3. **Logging**: Careful logging of parameter content
4. **Access control**: Respect resource-level access controls

## Recent Updates

### 2025-07-14
- Created comprehensive Parameters testing documentation
- Defined structure validation and value type testing scenarios
- Established operation integration test requirements
- Added parameter extraction utilities and builder patterns
- Documented multi-part parameter testing and validation rules

---

**Next Steps**:
1. Implement automated Parameters test suite
2. Add parameter extraction and validation utilities
3. Enhance operation parameter handling
4. Implement parameter performance monitoring