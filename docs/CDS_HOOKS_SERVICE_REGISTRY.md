# CDS Hooks Service Registry Pattern

**Created**: 2025-08-04  
**Purpose**: Documentation for the CDS Hooks service registry pattern implementation

## Overview

The service registry pattern separates CDS service configuration from implementation logic, following the CDS Hooks 1.0 specification. This approach replaces the legacy "conditions" field with proper service implementations.

## Architecture

### Core Components

1. **ServiceDefinition** - Spec-compliant service metadata
   - id, hook, title, description
   - prefetch templates
   - usage requirements

2. **ServiceImplementation** - Business logic
   - `should_execute()` - Replaces conditions with code
   - `execute()` - Generates cards
   - Helper methods for card creation

3. **ServiceRegistry** - Central management
   - Service registration
   - Discovery endpoint support
   - Service invocation

## Implementation Example

### Legacy Approach (Not Spec-Compliant)
```json
{
  "id": "diabetes-screening",
  "hook": "patient-view",
  "conditions": [
    {
      "type": "age",
      "operator": ">=",
      "value": 45
    }
  ],
  "cards": [...]
}
```

### New Service Registry Approach
```python
class DiabetesScreeningService(ServiceImplementation):
    async def should_execute(self, context, prefetch):
        patient = prefetch.get("patient")
        age = calculate_age(patient.get("birthDate"))
        return age >= 45
    
    async def execute(self, context, prefetch):
        # Generate cards based on logic
        return [self.create_card(...)]

# Register the service
registry.register_service(
    ServiceDefinition(
        id="diabetes-screening",
        hook="patient-view",
        title="Diabetes Screening",
        description="...",
        prefetch={...}
    ),
    DiabetesScreeningService("diabetes-screening")
)
```

## Usage

### Discovery
```bash
# Get all services (includes registry services)
GET /cds-services?use_registry=true

# List registry services only
GET /cds-services/registry/services
```

### Invocation
```bash
# Execute service through registry
POST /cds-services/{service_id}?use_registry=true
{
  "hook": "patient-view",
  "context": {...}
}
```

## Benefits

1. **Spec Compliance** - No non-standard fields
2. **Maintainability** - Logic in code, not configuration
3. **Testability** - Unit test service implementations
4. **Flexibility** - Complex conditions easily expressed
5. **Type Safety** - Python type hints and validation

## Migration Path

1. Existing hooks continue to work through legacy engine
2. New services use the registry pattern
3. Migrate existing hooks gradually using the migration tool
4. Eventually deprecate condition-based configuration

## Example Services

The following example services are registered by default:

- `diabetes-screening` - Age-based screening reminder
- `colonoscopy-screening` - Age 50+ screening
- `mammography-screening` - Gender and age-specific
- `drug-interactions` - Medication interaction checking
- `potassium-monitor` - Critical lab value alerts

## Adding New Services

1. Create a class extending `ServiceImplementation`
2. Implement `should_execute()` and `execute()` methods
3. Register with the service registry
4. Service is automatically available via discovery

## Future Enhancements

- Dynamic service registration via API
- Service versioning support
- Service performance metrics
- A/B testing integration
- Service composition patterns