# CDS Hooks Migration Guide

This guide explains how to migrate from WintEHR's condition-based configuration to CDS Hooks 1.0 specification-compliant service implementations.

## Key Changes

### 1. Terminology Change: Hooks → Services

- **Old**: "Create a hook" with conditions
- **New**: "Create a service" that responds to hooks

Services respond to specific hooks (trigger points) like `patient-view`, `medication-prescribe`, etc.

### 2. Conditions Move to Service Logic

The CDS Hooks specification doesn't include a "conditions" field. Instead, conditional logic belongs in the service implementation.

### 3. API Endpoints Updated

- **Old**: `/cds-hooks`
- **New**: `/cds-services`

All API endpoints have been updated to follow the CDS Hooks specification naming.

**Before** (Configuration-based):
```json
{
  "id": "diabetes-screening",
  "hook": "patient-view",
  "conditions": [
    {
      "type": "age",
      "operator": ">=",
      "value": 45
    },
    {
      "type": "condition",
      "codes": ["44054006"],
      "operator": "not_exists"
    }
  ],
  "cards": [...]
}
```

**After** (Service Implementation):
```python
class DiabetesScreeningService(ServiceImplementation):
    async def should_execute(self, context, prefetch):
        patient = prefetch.get("patient")
        
        # Age check
        age = calculate_age(patient.get("birthDate"))
        if age < 45:
            return False
        
        # Check if already has diabetes
        conditions = prefetch.get("conditions", {}).get("entry", [])
        has_diabetes = any(
            "44054006" in get_condition_codes(cond)
            for cond in conditions
        )
        
        return not has_diabetes
```

### 3. Display Behavior Removed

Display behavior (popup, inline, etc.) is controlled by the CDS client, not the service.

### 4. API Endpoints Change

- **Old**: `/cds-hooks`
- **New**: `/cds-services`

## Migration Steps

### Step 1: Use the Migration Tool

1. Go to CDS Studio → Migrate tab
2. Review the analysis of your existing hooks
3. Click "Migrate" for individual services or "Start Migration" for batch
4. Export the migration plan for reference

### Step 2: Implement Service Logic

For each migrated service with conditions:

1. Create a service implementation class
2. Move condition logic to `should_execute()` method
3. Move card generation to `execute()` method
4. Register the service with its implementation

### Step 3: Test the Migration

1. Use the CDS Studio Test feature
2. Verify conditions trigger correctly
3. Check card generation matches expectations

## Common Condition Migrations

### Age-Based Conditions

**Configuration**:
```json
{
  "type": "age",
  "operator": ">=",
  "value": 50
}
```

**Implementation**:
```python
def calculate_age(birth_date_str):
    birth = parser.parse(birth_date_str)
    return (datetime.now() - birth).days // 365

async def should_execute(self, context, prefetch):
    patient = prefetch.get("patient")
    age = calculate_age(patient.get("birthDate"))
    return age >= 50
```

### Gender-Based Conditions

**Configuration**:
```json
{
  "type": "gender",
  "value": "female"
}
```

**Implementation**:
```python
async def should_execute(self, context, prefetch):
    patient = prefetch.get("patient")
    return patient.get("gender", "").lower() == "female"
```

### Lab Value Conditions

**Configuration**:
```json
{
  "type": "lab_value",
  "labTest": "2823-3",
  "operator": ">",
  "value": 5.5
}
```

**Implementation**:
```python
async def should_execute(self, context, prefetch):
    labs = prefetch.get("recentLabs", {}).get("entry", [])
    
    for lab in labs:
        if lab_code_matches(lab, "2823-3"):
            value = get_lab_value(lab)
            if value > 5.5:
                return True
    return False
```

### Diagnosis/Condition Checks

**Configuration**:
```json
{
  "type": "condition",
  "codes": ["E11.9", "E11.65"],
  "operator": "exists"
}
```

**Implementation**:
```python
async def should_execute(self, context, prefetch):
    conditions = prefetch.get("conditions", {}).get("entry", [])
    
    target_codes = {"E11.9", "E11.65"}
    
    for condition in conditions:
        codes = get_condition_codes(condition)
        if codes.intersection(target_codes):
            return True
    return False
```

### Medication Checks

**Configuration**:
```json
{
  "type": "medication",
  "value": "warfarin",
  "operator": "active"
}
```

**Implementation**:
```python
async def should_execute(self, context, prefetch):
    medications = prefetch.get("activeMedications", {}).get("entry", [])
    
    for med in medications:
        med_name = get_medication_name(med).lower()
        if "warfarin" in med_name:
            return True
    return False
```

## Complex Logic Examples

### Multiple Conditions (AND)

**Configuration**:
```json
{
  "conditions": [
    {"type": "age", "operator": ">=", "value": 65},
    {"type": "condition", "codes": ["J44.0"], "operator": "exists"}
  ]
}
```

**Implementation**:
```python
async def should_execute(self, context, prefetch):
    # Age check
    age = calculate_age(prefetch.get("patient", {}).get("birthDate"))
    if age < 65:
        return False
    
    # COPD check
    conditions = prefetch.get("conditions", {}).get("entry", [])
    has_copd = any("J44.0" in get_condition_codes(c) for c in conditions)
    
    return has_copd  # Both conditions must be true
```

### Alternative Conditions (OR)

**Implementation**:
```python
async def should_execute(self, context, prefetch):
    # Check multiple risk factors
    age = calculate_age(prefetch.get("patient", {}).get("birthDate"))
    
    # Any of these triggers the service
    if age >= 65:
        return True
    
    if has_condition(prefetch, "E11"):  # Diabetes
        return True
        
    if has_condition(prefetch, "I10"):  # Hypertension
        return True
    
    return False
```

## Testing Your Migration

1. **Unit Tests**: Test your service implementation logic
2. **Integration Tests**: Test with the CDS Hooks infrastructure
3. **Manual Testing**: Use CDS Studio's test feature
4. **Validation**: Use the official CDS Hooks validator

## Best Practices

1. **Keep Logic Simple**: Complex conditions might indicate need for multiple services
2. **Use Prefetch**: Define what data you need in the service definition
3. **Handle Missing Data**: Always check if prefetch data exists
4. **Log Decisions**: Help with debugging why a service did/didn't fire
5. **Version Your Services**: Use semantic versioning for service updates

## Troubleshooting

### Service Not Firing

1. Check `should_execute()` returns `True`
2. Verify prefetch templates are correct
3. Check service is registered and enabled
4. Review logs for errors

### Cards Not Displaying

1. Ensure card has required fields (summary, source)
2. Check indicator is valid (info, warning, critical)
3. Verify summary is ≤140 characters

### Migration Failures

1. Check for syntax errors in migrated service
2. Verify all required fields are present
3. Test with minimal configuration first
4. Use the export feature to review changes

## Service Registry Pattern

WintEHR now includes a service registry pattern that provides a clean separation between service configuration and implementation:

1. **ServiceDefinition** - Contains metadata (id, hook, title, description, prefetch)
2. **ServiceImplementation** - Contains the logic (should_execute, execute)
3. **ServiceRegistry** - Manages services and handles invocation

### Using the Service Registry

```python
# Check available services
GET /cds-services?use_registry=true

# Execute a service
POST /cds-services/{service_id}?use_registry=true

# View registry services
GET /cds-services/registry/services
```

## Next Steps

1. Review the example implementations in `service_implementations.py`
2. Start with simple services and progress to complex ones
3. Test thoroughly before deploying to production
4. Monitor service performance and adjust as needed
5. Consider migrating existing services to the registry pattern

For more information, see:
- [CDS Hooks specification](https://cds-hooks.org/)
- [Service Registry Documentation](./CDS_HOOKS_SERVICE_REGISTRY.md)