# FHIR Operations Module

## Overview
The FHIR Operations module implements standard FHIR operations like `$validate`, `$everything`, `$expand`, and custom operations. It provides a framework for adding new operations while maintaining FHIR compliance.

## Architecture

### Core Components

1. **OperationHandler** (`backend/fhir/core/operations.py`)
   - Central handler for all FHIR operations
   - Supports system, type, and instance level operations
   - Extensible framework for custom operations

2. **Operation Router** (`backend/fhir/api/router.py`)
   - HTTP endpoints for operation invocation
   - Parameter parsing and validation
   - Response formatting

## Implemented Operations

### Patient/$everything

The `$everything` operation returns all resources related to a patient, implementing the FHIR R4 specification completely.

#### Features
- **Complete Patient Compartment**: Includes all 50+ resource types defined in FHIR R4 patient compartment
- **Parameter Support**:
  - `_since`: Only include resources modified after specified date
  - `_type`: Filter by comma-separated list of resource types
  - `_count`: Limit results per page (pagination)
  - `_offset`: Skip resources for pagination
- **Reference Following**: Includes resources referenced by patient compartment resources
- **Pagination**: Full support with self/next/previous links
- **Error Handling**: Graceful handling of search failures

#### Usage Examples

```bash
# Get all resources for a patient
GET /Patient/123/$everything

# Get only recent resources
GET /Patient/123/$everything?_since=2024-01-01T00:00:00Z

# Get specific resource types
GET /Patient/123/$everything?_type=Observation,Condition,MedicationRequest

# Paginated results
GET /Patient/123/$everything?_count=100
GET /Patient/123/$everything?_count=100&_offset=100

# Combined parameters
GET /Patient/123/$everything?_type=Observation&_since=2024-01-01&_count=50
```

#### Response Format

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 250,
  "link": [
    {
      "relation": "self",
      "url": "Patient/123/$everything?_count=100"
    },
    {
      "relation": "next",
      "url": "Patient/123/$everything?_count=100&_offset=100"
    }
  ],
  "entry": [
    {
      "fullUrl": "Patient/123",
      "resource": {
        "resourceType": "Patient",
        "id": "123",
        // ... patient data
      }
    },
    {
      "fullUrl": "Observation/456",
      "resource": {
        "resourceType": "Observation",
        "id": "456",
        "subject": {
          "reference": "Patient/123"
        }
        // ... observation data
      }
    }
    // ... more resources
  ]
}
```

### Other Operations

#### $validate
Validates a FHIR resource against its profile.

```bash
POST /$validate
POST /Patient/$validate
POST /Patient/123/$validate
```

#### $meta
Returns metadata about resources.

```bash
GET /$meta
GET /Patient/$meta
```

#### $history
Returns version history of resources.

```bash
GET /Patient/123/_history
GET /Patient/_history
```

## Implementation Details

### Patient Compartment Resources

The following resources are included when searching the patient compartment:

**Clinical Resources:**
- AllergyIntolerance, CarePlan, CareTeam, ClinicalImpression
- Condition, DiagnosticReport, DocumentReference, Encounter
- Goal, ImagingStudy, Immunization, MedicationAdministration
- MedicationDispense, MedicationRequest, MedicationStatement
- Observation, Procedure, RiskAssessment, ServiceRequest

**Administrative Resources:**
- Account, AdverseEvent, Appointment, AppointmentResponse
- Basic, BodyStructure, ChargeItem, Claim, ClaimResponse
- Communication, CommunicationRequest, Composition, Consent
- Coverage, DetectedIssue, DeviceRequest, DeviceUseStatement
- EpisodeOfCare, ExplanationOfBenefit, FamilyMemberHistory
- Flag, Invoice, List, Media, NutritionOrder
- Person, Provenance, QuestionnaireResponse, RelatedPerson
- RequestGroup, ResearchSubject, Schedule, Specimen
- SupplyDelivery, SupplyRequest, VisionPrescription

### Search Parameter Mapping

Different resources use different parameters to reference patients:

| Resource Type | Search Parameter |
|--------------|------------------|
| Most resources | `patient` |
| Basic, BodyStructure, Consent, etc. | `subject` |
| Coverage | `beneficiary` |
| Group | `member` |
| Person | `link` |
| RelatedPerson | `patient` |

### Performance Considerations

1. **Resource Limits**: Searches are limited to 10,000 resources per type to prevent memory exhaustion
2. **Pagination**: Use `_count` parameter for large result sets
3. **Type Filtering**: Use `_type` to reduce search scope
4. **Date Filtering**: Use `_since` to get only recent updates

## Extending Operations

### Adding a Custom Operation

```python
# In operations.py
async def _custom_operation(
    self,
    resource_type: Optional[str],
    resource_id: Optional[str],
    parameters: Optional[dict]
) -> dict:
    """Custom operation implementation."""
    # Implementation here
    pass

# Register the operation
operation_handler.register_custom_operation(
    "custom",
    operation_handler._custom_operation,
    resource_type="Patient"  # Optional: resource-specific
)
```

### Operation Levels

1. **System Level**: `/$operation`
2. **Type Level**: `/ResourceType/$operation`
3. **Instance Level**: `/ResourceType/id/$operation`

## Testing

Comprehensive tests are available in `backend/tests/test_everything_operation.py`:

```bash
# Run operation tests
docker exec emr-backend pytest tests/test_everything_operation.py -v

# Run with coverage
docker exec emr-backend pytest tests/test_everything_operation.py --cov=fhir.core.operations
```

## Error Handling

Operations handle errors gracefully:
- **404 Not Found**: When resource doesn't exist
- **400 Bad Request**: Invalid parameters
- **500 Internal Error**: Unexpected errors (logged but operation continues)

## Recent Updates

**2025-01-16**
- Implemented complete FHIR R4 $everything operation
- Added full parameter support (_since, _type, _count, _offset)
- Included all patient compartment resources
- Added reference following capability
- Implemented proper pagination
- Created comprehensive test suite

## Future Enhancements

1. **Async Processing**: For very large $everything requests
2. **Caching**: Cache results for frequently accessed patients
3. **Bulk Operations**: Support for multiple patients
4. **GraphQL Integration**: Alternative query mechanism
5. **Custom Compartments**: Support for practitioner, encounter compartments