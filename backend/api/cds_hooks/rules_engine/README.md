# CDS Rules Engine

A comprehensive Clinical Decision Support (CDS) rules engine that evaluates clinical rules against patient data and generates actionable recommendations.

## Overview

The rules engine provides a flexible, extensible framework for implementing clinical decision support logic. It integrates with the existing CDS Hooks implementation while offering enhanced capabilities:

- **Rule-based evaluation**: Define conditions and actions for clinical scenarios
- **Category-based organization**: Group rules by clinical domain
- **Priority-based execution**: Process critical rules first
- **FHIR compatibility**: Native support for FHIR resources
- **Legacy integration**: Works alongside existing CDS services

## Architecture

```
rules_engine/
├── __init__.py          # Module exports
├── core.py              # Core engine classes and logic
├── clinical_rules.py    # Pre-defined clinical rules
├── data_adapters.py     # FHIR to rules engine data conversion
└── integration.py       # Integration with CDS Hooks
```

## Key Components

### 1. Rule Structure

Each rule consists of:
- **Conditions**: Criteria that must be met for the rule to trigger
- **Actions**: Responses when conditions are satisfied
- **Category**: Clinical domain (medication safety, chronic disease, etc.)
- **Priority**: Execution order (critical, high, medium, low, info)

### 2. Rule Categories

- `MEDICATION_SAFETY`: Drug dosing and contraindications
- `DRUG_INTERACTIONS`: Drug-drug interaction checks
- `ALLERGIES`: Allergy-based alerts
- `CLINICAL_GUIDELINES`: Evidence-based care recommendations
- `PREVENTIVE_CARE`: Screening and vaccination reminders
- `LAB_MONITORING`: Laboratory value monitoring
- `VITAL_SIGNS`: Vital sign alerts
- `CHRONIC_DISEASE`: Chronic disease management
- `QUALITY_MEASURES`: Quality metric tracking
- `ALERTS`: General clinical alerts

### 3. Condition Types

Conditions support various operators:
- **Comparison**: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`
- **Text matching**: `contains`, `regex`
- **Existence**: `exists`
- **Array operations**: Automatic handling of FHIR arrays

### 4. Data Adaptation

The `FHIRDataAdapter` converts between:
- FHIR resources → Rules engine format
- CDS Hook context → Evaluation context
- Handles patient demographics, conditions, medications, labs, etc.

## Usage

### Via CDS Hooks (Recommended)

1. **Using v2 services** (automatically uses rules engine):
```http
POST /cds-hooks/cds-services/medication-prescribe-v2
{
  "hook": "medication-prescribe",
  "context": {...},
  "prefetch": {...}
}
```

2. **Force rules engine** for any service:
```http
POST /cds-hooks/cds-services/diabetes-management?use_rules_engine=true
```

### Direct Rules Evaluation

```http
POST /cds-hooks/rules-engine/evaluate
{
  "context": {
    "patient": {"id": "123", "age": 72},
    "conditions": [{"code": "E11.9"}],
    "activeMedications": [{"code": "metformin"}]
  },
  "categories": ["CHRONIC_DISEASE", "MEDICATION_SAFETY"]
}
```

### Management Endpoints

1. **Get statistics**:
```http
GET /cds-hooks/rules-engine/statistics
```

2. **Toggle rule**:
```http
PATCH /cds-hooks/rules-engine/rules/medication_safety/med_safety_001/toggle?enabled=false
```

## Clinical Rules Library

### Medication Safety Rules

1. **Warfarin-NSAID Interaction** (`med_safety_001`)
   - Alerts when NSAIDs prescribed with warfarin
   - Suggests acetaminophen as alternative

2. **Metformin Renal Dosing** (`med_safety_002`)
   - Checks creatinine before metformin prescription
   - Alerts if eGFR < 30 mL/min

3. **Duplicate Therapy Check** (`med_safety_003`)
   - Identifies duplicate medications in same class
   - Prevents therapeutic duplication

### Chronic Disease Management

1. **Diabetes A1C Monitoring** (`dm_001`)
   - Reminds to check A1C every 3-6 months
   - Suggests ordering A1C test

2. **Hypertension BP Goal** (`htn_001`)
   - Alerts when BP above goal (140/90)
   - Links to AHA guidelines

3. **Diabetic Eye Exam** (`dm_002`)
   - Annual eye exam reminder
   - Suggests ophthalmology referral

### Preventive Care

1. **Annual Flu Vaccine** (`prev_001`)
   - Seasonal flu shot reminder
   - Active September-March

2. **Mammogram Screening** (`prev_002`)
   - Women 50-74, every 2 years
   - USPSTF guidelines

### Lab Monitoring

1. **Statin LFT Monitoring** (`lab_001`)
   - Liver function for statin users
   - Every 6 months

2. **Warfarin INR Monitoring** (`lab_002`)
   - Monthly INR for warfarin users
   - High priority alert

## Integration with Legacy Services

The rules engine can run alongside existing CDS services:

```python
response = await cds_integration.execute_hook(
    hook="medication-prescribe",
    context=context,
    prefetch=prefetch,
    use_legacy=True  # Merge results from both systems
)
```

## Adding Custom Rules

```python
from backend.api.cds_hooks.rules_engine import Rule, RuleCondition, RuleAction

# Define a custom rule
custom_rule = Rule(
    id="custom_001",
    name="Custom Alert",
    category=RuleCategory.ALERTS,
    priority=RulePriority.MEDIUM,
    conditions=[
        RuleCondition(
            field="labResults.potassium.value",
            operator="gt",
            value=5.5,
            data_type="number"
        )
    ],
    actions=[
        RuleAction(
            type="card",
            summary="High Potassium Alert",
            detail="Potassium > 5.5 mEq/L - risk of cardiac arrhythmia",
            indicator="warning"
        )
    ]
)

# Add to rule set
cds_integration.add_custom_rule("lab_monitoring", custom_rule)
```

## Performance Considerations

- Rules evaluated in parallel for performance
- Lazy loading of prefetch data
- Caching of rule evaluation results (via validation cache)
- Priority-based execution for critical rules first

## Future Enhancements

1. **Machine Learning Integration**: Predictive models for risk scoring
2. **Natural Language Rules**: Define rules in clinical language
3. **Rule Versioning**: Track rule changes over time
4. **Outcome Tracking**: Monitor rule effectiveness
5. **FHIR Questionnaire Integration**: Dynamic forms based on rules
6. **External Rule Sources**: Import rules from external systems