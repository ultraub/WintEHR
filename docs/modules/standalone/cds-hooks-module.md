# CDS Hooks Module

## Overview

The CDS Hooks module provides a complete Clinical Decision Support (CDS) system implementing the HL7 CDS Hooks 1.0 specification. It enables real-time, context-aware clinical guidance integrated seamlessly into the EMR workflow.

**Key Features:**
- Full CDS Hooks 1.0 specification compliance
- Visual hook builder with drag-and-drop interface (CDS Hooks Studio)
- 10+ pre-built clinical rules
- Real-time patient context evaluation
- Custom hook creation and management
- Comprehensive testing and validation tools

## Architecture

### Backend Services

**Core Components:**
- `/backend/api/cds_hooks/` - CDS Hooks API endpoints
- `/backend/core/cds/` - CDS engine and rule evaluation
- `/backend/core/cds/hooks/` - Pre-built clinical hooks

**API Endpoints:**
```
GET  /cds-hooks                     # Discovery endpoint
POST /cds-hooks/{hook-id}          # Hook execution
GET  /api/cds-hooks/hooks          # List custom hooks
POST /api/cds-hooks/hooks          # Create custom hook
PUT  /api/cds-hooks/hooks/{id}     # Update custom hook
DELETE /api/cds-hooks/hooks/{id}   # Delete custom hook
POST /api/cds-hooks/test           # Test hook with patient context
```

### Frontend Components

**Services:**
- `cdsHooksClient.js` - Client for CDS Hooks API integration
- `cdsHooksService.js` - Custom hook CRUD operations
- `cdsHooksTester.js` - Testing utilities

**UI Components:**
- `CDSHooksStudio.js` - Visual hook builder and manager
- `CDSHooksTab.js` - Clinical workspace CDS integration
- `CDSHooksVerifier.js` - Hook validation tool
- `CDSAlertsPanel.js` - Alert display component

## CDS Hooks Studio

### Overview

The CDS Hooks Studio is a comprehensive visual environment for creating, testing, and managing clinical decision support rules. It features three distinct modes:

#### 1. Learn Mode
- Interactive tutorials on CDS Hooks concepts
- Step-by-step hook creation guides
- Best practices for clinical rules
- Example scenarios and use cases

#### 2. Build Mode
- **Visual Condition Builder**: Drag-and-drop interface for creating complex clinical conditions
- **Card Designer**: Visual card creation with markdown support
- **Prefetch Builder**: Configure required FHIR resources
- **Real-time Preview**: See hook definition and card appearance
- **Template Library**: Pre-built templates for common scenarios

#### 3. Manage Mode
- View and organize all hooks
- Performance analytics
- Version control
- Collaboration features

### Key Features

#### Visual Condition Builder
```javascript
// Supported condition types:
- Patient conditions (age, gender, pregnancy status)
- Clinical conditions (diagnoses, problems, allergies)
- Laboratory values (with comparisons)
- Medications (active, interactions)
- Vital signs (with thresholds)
- Temporal conditions (date ranges, durations)
```

#### Card Designer
- Visual card editor with live preview
- Support for multiple card types:
  - Info cards (blue)
  - Warning cards (orange)
  - Critical cards (red)
- Markdown formatting
- Smart suggestions
- Link builder for resources

#### Hook Templates
Pre-built templates for common clinical scenarios:
- Diabetes management alerts
- Drug interaction warnings
- Preventive care reminders
- Pregnancy-related alerts
- Vaccination recommendations
- Allergy warnings

## Pre-built Clinical Hooks

### Available Hooks

1. **diabetes-a1c-check**
   - Triggers: patient-view
   - Condition: Diabetes diagnosis + no recent A1C
   - Action: Suggest A1C testing

2. **drug-drug-interaction**
   - Triggers: medication-prescribe
   - Condition: Potential drug interactions
   - Action: Warning with alternatives

3. **pregnancy-medication-check**
   - Triggers: medication-prescribe
   - Condition: Pregnancy + teratogenic medication
   - Action: Critical warning

4. **vaccination-reminder**
   - Triggers: patient-view
   - Condition: Due for vaccinations
   - Action: Vaccination recommendations

5. **allergy-alert**
   - Triggers: medication-prescribe, order-sign
   - Condition: Known allergy to medication/substance
   - Action: Critical allergy warning

6. **renal-dosing**
   - Triggers: medication-prescribe
   - Condition: Renal impairment + medication requiring adjustment
   - Action: Dosing recommendations

7. **preventive-care-gaps**
   - Triggers: patient-view
   - Condition: Missing preventive care measures
   - Action: Care gap alerts

8. **abnormal-result-followup**
   - Triggers: patient-view
   - Condition: Abnormal results without follow-up
   - Action: Follow-up recommendations

9. **duplicate-therapy**
   - Triggers: medication-prescribe
   - Condition: Multiple medications same class
   - Action: Duplicate therapy warning

10. **clinical-guidelines**
    - Triggers: patient-view, order-sign
    - Condition: Condition-specific guideline triggers
    - Action: Evidence-based recommendations

### Hook Response Format

```json
{
  "cards": [
    {
      "uuid": "unique-card-id",
      "summary": "Brief card summary",
      "detail": "Detailed explanation with **markdown** support",
      "indicator": "info|warning|critical",
      "source": {
        "label": "Guideline source",
        "url": "https://reference-url"
      },
      "suggestions": [
        {
          "label": "Suggested action",
          "uuid": "suggestion-id",
          "actions": [...]
        }
      ],
      "links": [
        {
          "label": "More information",
          "url": "https://info-url",
          "type": "absolute"
        }
      ]
    }
  ]
}
```

## Integration with Clinical Workflow

### Automatic Triggers

CDS Hooks automatically fire at key workflow points:

1. **Patient View**: When opening a patient chart
2. **Medication Prescribe**: When prescribing medications
3. **Order Sign**: When signing clinical orders
4. **Order Select**: When selecting orders from catalogs

### Manual Invocation

Users can manually trigger CDS evaluation:
- Click the lightbulb icon in Clinical Workspace
- Use the "Check CDS" button in relevant workflows
- Access CDS Hooks tab for comprehensive view

### Alert Management

- **Dismissible**: Users can dismiss non-critical alerts
- **Snooze**: Temporarily hide alerts for session
- **Accept**: Apply suggested actions directly
- **Override**: Document reason for not following recommendation

## Creating Custom Hooks

### Using CDS Hooks Studio

1. **Access Studio**: Navigate to `/cds-studio`
2. **Choose Build Mode**: Select the Build tab
3. **Create New Hook**:
   - Set basic information (title, description, trigger)
   - Build conditions using visual builder
   - Design cards with preview
   - Configure prefetch resources
   - Test with real patients
   - Save and activate

### Programmatic Creation

```javascript
// Using cdsHooksService
const newHook = await cdsHooksService.createHook({
  id: 'custom-alert',
  title: 'Custom Clinical Alert',
  description: 'Alert for specific clinical scenario',
  hook: 'patient-view',
  conditions: [
    {
      type: 'age',
      operator: 'greater_than',
      value: 65
    },
    {
      type: 'condition',
      operator: 'exists',
      value: 'diabetes'
    }
  ],
  cards: [
    {
      summary: 'Elderly Diabetes Management',
      detail: 'Consider adjusted treatment goals',
      indicator: 'info'
    }
  ]
});
```

### Condition Types and Operators

**Patient Conditions:**
- age: greater_than, less_than, equals, between
- gender: equals, not_equals
- pregnancy_status: is_pregnant, not_pregnant

**Clinical Conditions:**
- condition: exists, not_exists, active_within_days
- allergy: exists, not_exists, severity_equals
- procedure: performed_within_days, never_performed

**Laboratory:**
- lab_result: greater_than, less_than, equals, abnormal
- lab_test: not_performed_within_days

**Medications:**
- medication: is_taking, not_taking, interaction_with
- medication_class: is_taking_class

**Temporal:**
- date: before, after, between
- age_in_days: greater_than, less_than

## Testing Hooks

### Using CDS Hooks Studio

1. Click the test icon in Build mode
2. Select or search for a test patient
3. Review patient context
4. Execute hook and view results
5. Iterate on conditions and cards

### Using Testing Panel

```javascript
// Test hook programmatically
const testResult = await cdsHooksService.testHook(
  hookDefinition,
  { patientId: 'patient-123' }
);

// Review results
console.log('Cards generated:', testResult.cards);
console.log('Execution time:', testResult.metrics.executionTime);
```

### Validation Rules

Hooks are validated for:
- Required fields (title, hook type, at least one card)
- Valid condition syntax
- Proper FHIR resource references
- Card content requirements
- Prefetch query validity

## Performance Optimization

### Prefetch Strategy

Define only necessary resources:
```javascript
prefetch: {
  patient: 'Patient/{{context.patientId}}',
  conditions: 'Condition?patient={{context.patientId}}&active=true',
  medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
}
```

### Caching

- Hook definitions cached for 5 minutes
- Patient context cached per session
- Prefetch results cached during request

### Best Practices

1. **Minimize Prefetch**: Only request needed data
2. **Efficient Conditions**: Use indexed fields
3. **Batch Evaluations**: Group related checks
4. **Async Processing**: For complex rules

## Security Considerations

### Access Control

- Hook creation requires admin role
- Hook execution based on user permissions
- Patient data access follows FHIR security

### Audit Trail

All CDS activities are logged:
- Hook executions
- Card presentations
- User actions (dismiss, accept, override)
- Hook modifications

### PHI Protection

- No PHI in hook definitions
- Patient context isolated per request
- Secure prefetch token handling

## Troubleshooting

### Common Issues

1. **Hook Not Firing**
   - Check hook trigger matches workflow
   - Verify conditions are met
   - Review browser console for errors

2. **Empty Results**
   - Validate patient has required data
   - Check condition logic
   - Test with known positive case

3. **Performance Issues**
   - Optimize prefetch queries
   - Reduce condition complexity
   - Enable caching

4. **Validation Errors**
   - Review error messages in Studio
   - Check required fields
   - Validate FHIR references

### Debug Mode

Enable debug logging:
```javascript
// In browser console
localStorage.setItem('cds-debug', 'true');
```

## API Reference

### Hook Definition Schema

```typescript
interface CDSHook {
  id: string;
  title: string;
  description: string;
  hook: 'patient-view' | 'medication-prescribe' | 'order-sign' | 'order-select';
  conditions: Condition[];
  cards: Card[];
  prefetch?: Record<string, string>;
  _meta?: {
    created: Date;
    modified: Date;
    version: number;
    author: string;
  };
}

interface Condition {
  type: string;
  field?: string;
  operator: string;
  value: any;
  logic?: 'AND' | 'OR';
  conditions?: Condition[]; // For nested groups
}

interface Card {
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source?: {
    label: string;
    url?: string;
  };
  suggestions?: Suggestion[];
  links?: Link[];
}
```

### Service Methods

```javascript
// List all hooks
const hooks = await cdsHooksService.getHooks();

// Get specific hook
const hook = await cdsHooksService.getHook(hookId);

// Create new hook
const newHook = await cdsHooksService.createHook(hookData);

// Update existing hook
const updated = await cdsHooksService.updateHook(hookId, updates);

// Delete hook
await cdsHooksService.deleteHook(hookId);

// Test hook
const result = await cdsHooksService.testHook(hook, context);

// Get analytics
const analytics = await cdsHooksService.getHookAnalytics(hookId);
```

## Recent Updates

**2025-01-08**: Major redesign of CDS Hooks Builder
- Introduced CDS Hooks Studio with three-mode interface
- Added visual drag-and-drop condition builder
- Implemented real-time preview system
- Created comprehensive template library
- Enhanced testing capabilities with patient search
- Improved validation and error handling

## Future Enhancements

1. **Machine Learning Integration**
   - Predictive risk scoring
   - Anomaly detection
   - Personalized recommendations

2. **Advanced Analytics**
   - Hook effectiveness metrics
   - User interaction patterns
   - Clinical outcome correlation

3. **Collaboration Features**
   - Hook sharing marketplace
   - Team workspaces
   - Version control integration

4. **External Integration**
   - SMART on FHIR apps
   - External CDS services
   - Clinical guidelines APIs

## Related Documentation

- [Clinical Services Module](../backend/clinical-services-module.md)
- [FHIR API Module](../backend/fhir-api-module.md)
- [Clinical Workspace Module](../frontend/clinical-workspace-module.md)
- [Architecture Overview](../../architecture/overview.md)