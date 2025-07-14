# OperationOutcome Resource Testing Documentation

## Overview

The OperationOutcome resource provides detailed information about the outcome of an attempted system operation. It contains error, warning, and information messages that result from system actions and is fundamental to FHIR error handling and validation reporting.

## FHIR R4 OperationOutcome Structure

### Core Elements
- **resourceType**: Always "OperationOutcome"
- **issue**: Array of issues (1..*)
  - **severity**: fatal | error | warning | information (required)
  - **code**: Error type code (required)
  - **details**: Additional details (optional)
  - **diagnostics**: Technical diagnostic information (optional)
  - **location**: Deprecated, use expression instead
  - **expression**: FHIRPath expression indicating location (optional)

### Severity Levels
1. **fatal**: The issue caused the action to fail, and no further checking could be performed
2. **error**: The issue is sufficiently important to cause the action to fail
3. **warning**: The issue is not important enough to cause the action to fail
4. **information**: The issue has no relation to the degree of success of the action

## Current Implementation Analysis

### OperationOutcome Generation Locations

1. **Bundle Processing** (`/backend/core/fhir/storage.py`)
   - Transaction/batch error handling
   - Individual entry failures

2. **FHIR Operations** (`/backend/core/fhir/operations.py`)
   - Validation operation results
   - Operation parameter errors

3. **Validation Pipeline** (`/backend/core/fhir/validation_pipeline.py`)
   - Resource validation errors
   - Structure validation issues

### Current OperationOutcome Usage Patterns

```python
# Bundle processing error (storage.py:874-880)
response_entry = BundleEntry(
    response=BundleEntryResponse(
        status="500",
        outcome=OperationOutcome(
            issue=[OperationOutcomeIssue(
                severity="error",
                code="exception",
                diagnostics=str(e)
            )]
        )
    )
)

# Validation operation (operations.py:148-154)
return OperationOutcome(
    issue=[{
        "severity": "error",
        "code": "required",
        "details": {"text": "No resource provided for validation"}
    }]
)
```

## Test Categories

### 1. OperationOutcome Structure Tests

#### TC-OO-001: Basic Structure Validation
**Objective**: Verify OperationOutcome meets FHIR R4 structure requirements

**Test Steps**:
1. Create OperationOutcome with minimal required fields
2. Validate against FHIR R4 schema
3. Verify serialization/deserialization

**Expected Results**:
- Valid FHIR R4 OperationOutcome structure
- Required fields present
- Proper JSON/XML serialization

#### TC-OO-002: Issue Array Validation
**Objective**: Verify issue array structure and validation

**Test Steps**:
1. Create OperationOutcome with empty issue array
2. Create OperationOutcome with multiple issues
3. Validate issue structure requirements

**Expected Results**:
- Empty issue array rejected (min 1 required)
- Multiple issues supported
- Each issue has required fields

#### TC-OO-003: Severity Level Validation
**Objective**: Test all severity levels and validation

**Test Steps**:
1. Create issues with each severity level
2. Test invalid severity values
3. Verify severity impact on processing

**Expected Results**:
- All valid severity levels accepted
- Invalid severity values rejected
- Proper severity hierarchy respected

### 2. Error Code Testing

#### TC-OO-004: Standard Error Codes
**Objective**: Test FHIR standard error codes

**Test Steps**:
1. Generate OperationOutcomes with standard codes:
   - invalid
   - structure
   - required
   - value
   - invariant
   - security
   - login
   - unknown
   - expired
   - forbidden
   - suppressed
   - processing
   - not-supported
   - duplicate
   - multiple-matches
   - not-found
   - deleted
   - too-long
   - code-invalid
   - extension
   - too-costly
   - business-rule
   - conflict
   - transient
   - lock-error
   - no-store
   - exception
   - timeout
   - incomplete
   - throttled
   - informational

**Expected Results**:
- All standard codes accepted
- Appropriate code selection for error types
- Consistent code usage across system

#### TC-OO-005: Custom Error Codes
**Objective**: Test custom error code handling

**Test Steps**:
1. Create OperationOutcomes with custom codes
2. Verify code validation behavior
3. Test code system references

**Expected Results**:
- Custom codes accepted when appropriate
- Code systems properly referenced
- Validation rules applied consistently

### 3. Issue Details and Diagnostics

#### TC-OO-006: Details Element Testing
**Objective**: Test issue details structure and content

**Test Steps**:
1. Create issues with CodeableConcept details
2. Test details with multiple codings
3. Verify details text content

**Expected Results**:
- CodeableConcept structure valid
- Multiple codings supported
- Text display properly handled

#### TC-OO-007: Diagnostics Information
**Objective**: Test diagnostics field usage

**Test Steps**:
1. Create issues with technical diagnostics
2. Test diagnostics with stack traces
3. Verify diagnostics content limits

**Expected Results**:
- Technical information preserved
- Sensitive information filtered
- Reasonable length limits enforced

#### TC-OO-008: Expression Path Testing
**Objective**: Test FHIRPath expression usage

**Test Steps**:
1. Create issues with expression paths
2. Test nested path expressions
3. Verify expression validity

**Expected Results**:
- Valid FHIRPath expressions accepted
- Nested paths properly formatted
- Expression pointing to error location

### 4. OperationOutcome Generation Tests

#### TC-OO-009: Validation Error Generation
**Objective**: Test OperationOutcome generation for validation errors

**Test Steps**:
1. Submit invalid FHIR resources
2. Trigger various validation errors
3. Verify OperationOutcome generation

**Expected Results**:
- OperationOutcome created for validation errors
- Specific error details included
- Appropriate severity levels assigned

#### TC-OO-010: Bundle Error Generation
**Objective**: Test OperationOutcome in bundle processing

**Test Steps**:
1. Submit transaction bundle with errors
2. Submit batch bundle with mixed results
3. Verify error handling

**Expected Results**:
- Transaction errors cause rollback with OperationOutcome
- Batch errors generate individual OperationOutcomes
- Error details preserved in responses

#### TC-OO-011: Operation Error Generation
**Objective**: Test OperationOutcome in FHIR operations

**Test Steps**:
1. Execute operations with invalid parameters
2. Test operation-specific error conditions
3. Verify error response format

**Expected Results**:
- Operations return OperationOutcome for errors
- Parameter errors clearly described
- Operation context preserved

### 5. HTTP Status Code Integration

#### TC-OO-012: Status Code Alignment
**Objective**: Verify HTTP status codes align with OperationOutcome severity

**Test Steps**:
1. Generate various OperationOutcome severities
2. Verify corresponding HTTP status codes
3. Test status code consistency

**Expected Results**:
- fatal/error severity → 4xx/5xx status codes
- warning/information → 2xx status codes
- Consistent status code mapping

#### TC-OO-013: Multiple Issue Severity Handling
**Objective**: Test HTTP status with mixed issue severities

**Test Steps**:
1. Create OperationOutcome with mixed severities
2. Verify HTTP status code selection
3. Test precedence rules

**Expected Results**:
- Highest severity determines HTTP status
- Consistent precedence applied
- Clear status code selection logic

### 6. Serialization and Content Negotiation

#### TC-OO-014: JSON Serialization
**Objective**: Test OperationOutcome JSON format

**Test Steps**:
1. Generate OperationOutcome with all fields
2. Serialize to JSON
3. Verify JSON structure compliance

**Expected Results**:
- Valid FHIR JSON format
- All fields properly serialized
- JSON schema compliance

#### TC-OO-015: XML Serialization
**Objective**: Test OperationOutcome XML format

**Test Steps**:
1. Generate OperationOutcome with all fields
2. Serialize to XML
3. Verify XML structure compliance

**Expected Results**:
- Valid FHIR XML format
- Proper namespaces and structure
- XML schema compliance

#### TC-OO-016: Content Negotiation
**Objective**: Test OperationOutcome content type handling

**Test Steps**:
1. Request OperationOutcome with various Accept headers
2. Test format preferences
3. Verify response format selection

**Expected Results**:
- Correct format returned based on Accept header
- Default format when no preference specified
- Error handling for unsupported formats

### 7. Integration Tests

#### TC-OO-017: CRUD Operation Integration
**Objective**: Test OperationOutcome integration with CRUD operations

**Test Steps**:
1. Perform CREATE with validation errors
2. Perform UPDATE with conflicts
3. Perform DELETE on non-existent resources
4. Verify OperationOutcome responses

**Expected Results**:
- Appropriate OperationOutcomes generated
- Error context preserved
- Consistent error reporting

#### TC-OO-018: Search Operation Integration
**Objective**: Test OperationOutcome with search operations

**Test Steps**:
1. Perform search with invalid parameters
2. Test search timeout scenarios
3. Verify error handling

**Expected Results**:
- Search errors return OperationOutcome
- Parameter validation errors described
- Search context preserved

#### TC-OO-019: Authentication/Authorization Integration
**Objective**: Test OperationOutcome for security errors

**Test Steps**:
1. Access resources without authentication
2. Access resources without authorization
3. Test expired tokens

**Expected Results**:
- Security errors return OperationOutcome
- Minimal sensitive information exposed
- Appropriate error codes used

### 8. Performance and Resource Usage

#### TC-OO-020: Large OperationOutcome Handling
**Objective**: Test handling of large OperationOutcome resources

**Test Steps**:
1. Generate OperationOutcome with many issues
2. Test memory usage and performance
3. Verify response handling

**Expected Results**:
- Large OperationOutcomes handled efficiently
- Memory usage within reasonable limits
- Response time acceptable

#### TC-OO-021: Diagnostics Size Limits
**Objective**: Test diagnostics field size handling

**Test Steps**:
1. Generate issues with very long diagnostics
2. Test system behavior with large stack traces
3. Verify truncation if implemented

**Expected Results**:
- Large diagnostics handled appropriately
- System stability maintained
- Truncation applied consistently if implemented

## Testing Implementation

### Unit Tests
```python
# Test file: test_operation_outcome.py

class TestOperationOutcome:
    def test_basic_structure(self):
        # TC-OO-001 implementation
        outcome = OperationOutcome(
            issue=[
                OperationOutcomeIssue(
                    severity="error",
                    code="invalid",
                    details={"text": "Resource validation failed"}
                )
            ]
        )
        
        assert outcome.resourceType == "OperationOutcome"
        assert len(outcome.issue) == 1
        assert outcome.issue[0].severity == "error"
        assert outcome.issue[0].code == "invalid"
    
    def test_severity_levels(self):
        # TC-OO-003 implementation
        severities = ["fatal", "error", "warning", "information"]
        
        for severity in severities:
            outcome = OperationOutcome(
                issue=[
                    OperationOutcomeIssue(
                        severity=severity,
                        code="test",
                        details={"text": f"Test {severity} message"}
                    )
                ]
            )
            assert outcome.issue[0].severity == severity
    
    def test_error_codes(self):
        # TC-OO-004 implementation
        standard_codes = [
            "invalid", "structure", "required", "value",
            "security", "not-found", "exception"
        ]
        
        for code in standard_codes:
            outcome = OperationOutcome(
                issue=[
                    OperationOutcomeIssue(
                        severity="error",
                        code=code,
                        details={"text": f"Test {code} error"}
                    )
                ]
            )
            assert outcome.issue[0].code == code
```

### Integration Tests
```python
# Test file: test_operation_outcome_integration.py

class TestOperationOutcomeIntegration:
    async def test_validation_error_response(self):
        # TC-OO-009 implementation
        invalid_patient = {"resourceType": "Patient"}  # Missing required fields
        
        response = await client.post("/fhir/Patient", json=invalid_patient)
        
        assert response.status_code == 400
        outcome = response.json()
        assert outcome["resourceType"] == "OperationOutcome"
        assert any(issue["severity"] == "error" for issue in outcome["issue"])
    
    async def test_bundle_error_handling(self):
        # TC-OO-010 implementation
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "request": {"method": "POST", "url": "Patient"},
                    "resource": {"resourceType": "Patient"}  # Invalid
                }
            ]
        }
        
        response = await client.post("/fhir", json=bundle)
        
        assert response.status_code >= 400
        outcome = response.json()
        assert outcome["resourceType"] == "OperationOutcome"
```

### Error Generation Tests
```python
# Test file: test_error_generation.py

class TestErrorGeneration:
    def test_generate_validation_error(self):
        # Test OperationOutcome generation for validation errors
        outcome = create_validation_error_outcome(
            "Patient.name is required",
            expression="Patient.name"
        )
        
        assert outcome.issue[0].severity == "error"
        assert outcome.issue[0].code == "required"
        assert "Patient.name" in outcome.issue[0].expression
    
    def test_generate_business_rule_error(self):
        # Test business rule violation OperationOutcome
        outcome = create_business_rule_error(
            "Cannot delete patient with active encounters"
        )
        
        assert outcome.issue[0].severity == "error"
        assert outcome.issue[0].code == "business-rule"
```

## Test Data

### Sample OperationOutcome - Validation Error
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "structure",
      "details": {
        "text": "Patient.name: minimum required = 1, but found 0"
      },
      "diagnostics": "fhir.resources.exceptions.ValidationError at line 42 in patient_validator.py",
      "expression": ["Patient.name"]
    }
  ]
}
```

### Sample OperationOutcome - Multiple Issues
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "required",
      "details": {
        "text": "Missing required field: Patient.name"
      },
      "expression": ["Patient.name"]
    },
    {
      "severity": "warning",
      "code": "value",
      "details": {
        "text": "Patient.gender should be one of: male, female, other, unknown"
      },
      "expression": ["Patient.gender"]
    },
    {
      "severity": "information",
      "code": "informational",
      "details": {
        "text": "Patient resource validated successfully"
      }
    }
  ]
}
```

### Sample OperationOutcome - Bundle Processing
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "fatal",
      "code": "exception",
      "details": {
        "text": "Transaction failed and was rolled back"
      },
      "diagnostics": "Entry 2 failed validation: Patient.birthDate format invalid. All changes rolled back.",
      "expression": ["Bundle.entry[2].resource"]
    }
  ]
}
```

### Sample OperationOutcome - Operation Error
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "required",
      "details": {
        "coding": [
          {
            "system": "http://hl7.org/fhir/tools/CodeSystem/tx-issue-type",
            "code": "not-found"
          }
        ],
        "text": "Resource not found for $validate operation"
      },
      "diagnostics": "Operation $validate requires a resource parameter"
    }
  ]
}
```

## Error Scenarios & Expected OperationOutcomes

### Validation Errors
| Scenario | Severity | Code | Details |
|----------|----------|------|---------|
| Missing required field | error | required | Field name and requirement |
| Invalid data type | error | value | Expected vs actual type |
| Constraint violation | error | invariant | Constraint rule description |
| Invalid code system | error | code-invalid | Code and system information |

### Processing Errors
| Scenario | Severity | Code | Details |
|----------|----------|------|---------|
| Resource not found | error | not-found | Resource type and ID |
| Duplicate resource | error | duplicate | Existing resource reference |
| Concurrent modification | error | conflict | Version conflict details |
| Database error | error | exception | Technical error information |

### Security Errors
| Scenario | Severity | Code | Details |
|----------|----------|------|---------|
| Authentication failure | error | login | Authentication method required |
| Authorization failure | error | forbidden | Required permissions |
| Token expired | error | expired | Token expiration information |
| Rate limiting | error | throttled | Rate limit information |

## OperationOutcome Creation Utilities

### Error Generation Functions
```python
# Utility functions for consistent OperationOutcome generation

def create_validation_error(message: str, expression: str = None) -> OperationOutcome:
    """Create OperationOutcome for validation errors."""
    return OperationOutcome(
        issue=[
            OperationOutcomeIssue(
                severity="error",
                code="structure",
                details={"text": message},
                expression=[expression] if expression else None
            )
        ]
    )

def create_not_found_error(resource_type: str, resource_id: str) -> OperationOutcome:
    """Create OperationOutcome for resource not found."""
    return OperationOutcome(
        issue=[
            OperationOutcomeIssue(
                severity="error",
                code="not-found",
                details={"text": f"{resource_type}/{resource_id} not found"}
            )
        ]
    )

def create_business_rule_error(message: str) -> OperationOutcome:
    """Create OperationOutcome for business rule violations."""
    return OperationOutcome(
        issue=[
            OperationOutcomeIssue(
                severity="error",
                code="business-rule",
                details={"text": message}
            )
        ]
    )
```

### OperationOutcome Builder
```python
class OperationOutcomeBuilder:
    """Builder pattern for creating complex OperationOutcomes."""
    
    def __init__(self):
        self.issues = []
    
    def add_error(self, code: str, message: str, expression: str = None):
        self.issues.append(
            OperationOutcomeIssue(
                severity="error",
                code=code,
                details={"text": message},
                expression=[expression] if expression else None
            )
        )
        return self
    
    def add_warning(self, code: str, message: str, expression: str = None):
        self.issues.append(
            OperationOutcomeIssue(
                severity="warning",
                code=code,
                details={"text": message},
                expression=[expression] if expression else None
            )
        )
        return self
    
    def build(self) -> OperationOutcome:
        return OperationOutcome(issue=self.issues)
```

## Performance Considerations

### OperationOutcome Size Management
1. **Large error lists**: Limit number of issues per OperationOutcome
2. **Diagnostics size**: Truncate very long diagnostic messages
3. **Expression complexity**: Limit FHIRPath expression depth
4. **Memory usage**: Consider streaming for large OperationOutcomes

### Error Aggregation Strategies
1. **Validation errors**: Group related validation issues
2. **Bundle errors**: Aggregate errors by entry
3. **Operation errors**: Combine parameter validation errors
4. **Batch processing**: Efficient error collection and reporting

## Security Considerations

### Information Disclosure
1. **Stack traces**: Filter sensitive system information
2. **Database errors**: Sanitize technical details
3. **File paths**: Remove absolute paths from diagnostics
4. **User data**: Avoid exposing sensitive user information

### Error Message Sanitization
```python
def sanitize_diagnostics(diagnostics: str) -> str:
    """Sanitize diagnostics information for external exposure."""
    # Remove file paths
    diagnostics = re.sub(r'/[^:\s]+/', '.../', diagnostics)
    
    # Remove stack trace details
    if 'Traceback' in diagnostics:
        lines = diagnostics.split('\n')
        # Keep only the error message, not the full trace
        diagnostics = lines[-1] if lines else diagnostics
    
    # Limit length
    if len(diagnostics) > 500:
        diagnostics = diagnostics[:497] + "..."
    
    return diagnostics
```

## Monitoring and Analytics

### OperationOutcome Metrics
1. **Error frequency**: Track error rates by type and code
2. **Severity distribution**: Monitor error vs warning ratios
3. **Source analysis**: Identify common error sources
4. **Resolution tracking**: Monitor error resolution patterns

### Alerting and Escalation
1. **High error rates**: Alert on unusual error volumes
2. **Fatal errors**: Immediate notification for fatal issues
3. **Pattern detection**: Identify recurring error patterns
4. **System health**: Monitor overall error trends

## Recent Updates

### 2025-07-14
- Created comprehensive OperationOutcome testing documentation
- Defined structure validation and error code testing scenarios  
- Established integration test requirements with CRUD operations
- Added serialization and content negotiation test cases
- Documented error generation utilities and performance considerations

---

**Next Steps**:
1. Implement automated OperationOutcome test suite
2. Add error generation utility functions
3. Enhance error message sanitization
4. Implement OperationOutcome analytics and monitoring