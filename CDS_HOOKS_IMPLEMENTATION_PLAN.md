# CDS Hooks Builder Enhancement - Implementation Plan

**Created**: 2025-01-11  
**Status**: In Progress  
**Development Mode**: Using `docker-compose.dev.yml` for hot reload

## Overview
This document tracks the comprehensive implementation of CDS Hooks Builder enhancements in the CDS Studio developer tools.

## Current Architecture

### Key Locations
- **CDS Studio**: `/frontend/src/pages/CDSHooksStudio.js`
- **Visual Builder**: `/frontend/src/components/cds-studio/build/VisualConditionBuilder.js`
- **Condition Builders**: `/frontend/src/components/cds-studio/build/conditions/`
- **Services**: `/frontend/src/services/`
- **Backend CDS**: `/backend/api/cds_hooks/`

### Existing Services to Leverage
- `searchService.js` - Clinical catalog searches
- `vitalSignsService.js` - Vital signs metadata
- `fhirClient.js` - FHIR operations
- `cdsHooksService.js` - CDS Hook CRUD operations

## Phase 1: Condition Configuration Improvements

### 1.1 Lab Value Conditions ✅ COMPLETED
**Status**: Implemented and ready for testing
**Location**: `/frontend/src/components/cds-studio/build/conditions/LabValueConditionBuilder.js`

#### Completed Features:
- [x] Lab test autocomplete with LOINC codes (20 common tests)
- [x] Range operators (>, <, >=, <=, between, abnormal, critical)
- [x] Reference range display with normal/critical values
- [x] Timeframe selector (7 days to 2 years)
- [x] Unit display based on selected lab
- [x] Trending operators with configuration
- [x] Integration with VisualConditionBuilder

#### Testing Files:
- `cds-studio-lab-value.cy.js` - Component testing
- `cds-builder-workflow.cy.js` - Workflow testing

### 1.2 Vital Signs Conditions ✅ COMPLETED
**Status**: Fully implemented and ready for testing
**Location**: `/frontend/src/components/cds-studio/build/conditions/VitalSignConditionBuilder.js`

#### Completed Features:
- [x] Create vital sign type dropdown
  - [x] Blood Pressure (with systolic/diastolic)
  - [x] Heart Rate
  - [x] Temperature (F/C)
  - [x] Oxygen Saturation
  - [x] Respiratory Rate
  - [x] Weight
  - [x] Height
  - [x] BMI
  - [x] Pain Scale
- [x] Add normal range indicators
  - [x] Age-based ranges
  - [x] Gender-based adjustments capability
- [x] Implement range operators (>, <, >=, <=, between, abnormal, critical, trending)
- [x] Add trend analysis (increasing/decreasing over time)
- [x] Support for BP systolic/diastolic components
- [x] Integrate with `vitalSignsService.js`
- [x] Unit preference toggle (metric/imperial)
- [x] Critical range indicators
- [x] Trend configuration (min readings, threshold)
- [x] Age input for testing range adjustments

#### References:
- Vital signs service: `/frontend/src/services/vitalSignsService.js`
- LOINC codes for vitals:
  - BP: 85354-9
  - Systolic: 8480-6
  - Diastolic: 8462-4
  - HR: 8867-4
  - Temp: 8310-5
  - O2 Sat: 2708-6

### 1.3 Medical Conditions ✅ COMPLETED
**Status**: Fully implemented and ready for testing
**Location**: `/frontend/src/components/cds-studio/build/conditions/MedicalConditionBuilder.js`

#### Completed Features:
- [x] Integrate condition search from `searchService.js`
- [x] Create autocomplete with debouncing (300ms)
- [x] Display format: "CODE - Description" with system info
- [x] Support multiple code systems:
  - [x] SNOMED CT (primary)
  - [x] ICD-10 (via search)
  - [x] ICD-9 (legacy support)
- [x] Add severity filters (any/mild/moderate/severe)
- [x] Add status filters (has/not has/active/resolved/inactive)
- [x] Support condition categories (8 categories)
- [x] Add advanced operators:
  - [x] New diagnosis (within timeframe)
  - [x] Chronic vs Acute conditions
  - [x] Include related conditions option
- [x] Quick select from 8 common conditions
- [x] Category-based filtering for quick selection
- [x] Visual indicators for severity levels
- [x] Helpful examples for each operator

#### References:
- Search service: `/frontend/src/services/searchService.js`
- Existing condition search in ChartReviewTab

## Phase 2: Response Card Configuration

### 2.1 Card Builder Restructure 🚧 TODO
**Location**: Create new `/frontend/src/components/cds-studio/build/cards/EnhancedCardBuilder.js`

#### Subtasks:
- [ ] Create tabbed interface
  - [ ] Info Cards tab
  - [ ] Suggestion Cards tab
  - [ ] Action Cards tab
- [ ] Implement card type switching
- [ ] Add card preview panel
- [ ] Support multiple cards per hook

### 2.2 Info Cards Enhancement 🚧 TODO
#### Subtasks:
- [ ] Markdown editor with live preview
- [ ] External link builder
  - [ ] URL validation
  - [ ] Link text customization
  - [ ] Target window options
- [ ] Source attribution
  - [ ] Guideline references
  - [ ] Evidence level indicators
- [ ] Card styling options
- [ ] Icon selection

### 2.3 Suggestion Cards 🚧 TODO
**Create**: `/frontend/src/components/cds-studio/build/cards/SuggestionBuilder.js`

#### Subtasks:
- [ ] FHIR resource templates
  - [ ] ServiceRequest (lab/imaging orders)
  - [ ] MedicationRequest
  - [ ] Appointment
  - [ ] Task
  - [ ] CarePlan
  - [ ] Procedure
- [ ] Template customization
- [ ] Multiple suggestions per card
- [ ] Suggestion grouping (at-most-one, any)
- [ ] Priority ordering UI

#### FHIR Templates Needed:
```javascript
// ServiceRequest template for lab order
{
  resourceType: "ServiceRequest",
  status: "draft",
  intent: "order",
  code: { /* populated from selection */ },
  subject: { reference: "Patient/{{context.patientId}}" },
  authoredOn: "{{timestamp}}"
}
```

### 2.4 Action Cards 🚧 TODO
**Create**: `/frontend/src/components/cds-studio/build/cards/ActionBuilder.js`

#### Subtasks:
- [ ] SMART app launcher configuration
  - [ ] App URL input
  - [ ] Launch context builder
  - [ ] Parameter mapping
- [ ] External API integration
  - [ ] MDCalc calculator links
  - [ ] Clinical guideline APIs
  - [ ] Risk score calculators
- [ ] Custom action definitions
- [ ] Action validation

## Phase 3: Advanced Features

### 3.1 Display Behavior Configuration 🚧 TODO
**Create**: `/frontend/src/components/cds-studio/build/DisplayBehaviorPanel.js`

#### Subtasks:
- [ ] Presentation mode selector
  - [ ] Hard stop (modal, must address)
  - [ ] Dismissible popup
  - [ ] Non-obtrusive (sidebar/banner)
  - [ ] Inline suggestion
- [ ] Per-indicator overrides
  - [ ] Critical → Always hard stop
  - [ ] Warning → Configurable
  - [ ] Info → Default non-obtrusive
- [ ] Acknowledgment settings
  - [ ] Require reason for override
  - [ ] Capture dismissal reason
  - [ ] Snooze duration options

### 3.2 Prefetch Query Builder 🚧 TODO
**Create**: `/frontend/src/components/cds-studio/build/PrefetchBuilder.js`

#### Subtasks:
- [ ] Visual query builder interface
- [ ] Common query templates
  - [ ] Active conditions
  - [ ] Current medications
  - [ ] Recent labs (by date)
  - [ ] Allergies
  - [ ] Recent vitals
- [ ] US Core profile integration
- [ ] Token replacement preview
  - [ ] Show example with test patient
  - [ ] Validate token syntax
- [ ] Query performance estimation
- [ ] _include parameter builder

#### Example Prefetch Templates:
```javascript
{
  "patient": "Patient/{{context.patientId}}",
  "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
  "medications": "MedicationRequest?patient={{context.patientId}}&status=active",
  "recentLabs": "Observation?patient={{context.patientId}}&category=laboratory&date=ge{{today-90days}}"
}
```

### 3.3 Policy/Governance Configuration 🚧 TODO
**Create**: `/frontend/src/components/cds-studio/build/PolicyPanel.js`

#### Subtasks:
- [ ] Provider role configuration
  - [ ] Role selector (MD, RN, PA, etc.)
  - [ ] Specialty filters
  - [ ] Department restrictions
- [ ] Workflow triggers
  - [ ] Enable/disable by workflow
  - [ ] Time-based activation
  - [ ] Location-based rules
- [ ] Override permissions
  - [ ] Who can override
  - [ ] Require attestation
  - [ ] Audit requirements
- [ ] Testing restrictions
  - [ ] Test mode indicators
  - [ ] Production safeguards

## Phase 4: UI/UX Improvements

### 4.1 Interface Enhancements 🚧 TODO
#### Subtasks:
- [ ] Add comprehensive tooltips
  - [ ] Use MUI Tooltip component
  - [ ] Context-sensitive help
  - [ ] Link to documentation
- [ ] Rename UI elements
  - [ ] "CDS Hook Integration" instead of "New Hook"
  - [ ] Clear labeling throughout
- [ ] Improve visual hierarchy
  - [ ] Better section separation
  - [ ] Progress indicators
  - [ ] Visual cues for required fields

### 4.2 Live Preview Panel 🚧 TODO
**Create**: `/frontend/src/components/cds-studio/build/LivePreviewPanel.js`

#### Subtasks:
- [ ] Split-screen view option
- [ ] Mock EMR context
  - [ ] Patient banner
  - [ ] Current workflow simulation
  - [ ] Alert placement preview
- [ ] Interactive preview
  - [ ] Test dismissal behavior
  - [ ] Test acknowledgment flow
- [ ] Multiple device previews

### 4.3 Testing Improvements 🚧 TODO
#### Subtasks:
- [ ] Patient search integration
  - [ ] Use existing patient search
  - [ ] Filter by conditions
  - [ ] Recent patients list
- [ ] Test scenario builder
  - [ ] Save test scenarios
  - [ ] Batch testing
  - [ ] Coverage reporting
- [ ] Performance metrics
  - [ ] Execution time
  - [ ] Prefetch duration
  - [ ] Total response time
- [ ] Test history tracking

## Backend Requirements

### API Endpoints Needed 🚧 TODO

1. **Lab Catalog Endpoint**
   ```
   GET /api/clinical/lab-catalog
   Query params: search, category, common_only
   ```

2. **Vital Sign References**
   ```
   GET /api/clinical/vital-references
   Query params: age, gender, vital_type
   ```

3. **Condition Evaluation Enhancement**
   - Update `/backend/api/cds_hooks/cds_hooks_router.py`
   - Add support for new operators
   - Implement trend calculations

## Testing Strategy

### Cypress Test Files
1. ✅ `cds-studio-lab-value.cy.js` - Lab value builder
2. 🚧 `cds-studio-vital-signs.cy.js` - Vital signs builder
3. 🚧 `cds-studio-conditions.cy.js` - Medical conditions
4. 🚧 `cds-studio-cards.cy.js` - Card builder
5. 🚧 `cds-studio-workflow-complete.cy.js` - End-to-end

### Manual Testing Checklist
- [ ] Lab value conditions work correctly
- [ ] Vital sign conditions with ranges
- [ ] Medical condition search and selection
- [ ] Card creation with all types
- [ ] Prefetch query validation
- [ ] Policy configuration saves correctly
- [ ] Live preview updates in real-time
- [ ] Test execution with real patients

## Development Workflow

1. **Start Development Environment**
   ```bash
   ./dev-mode.sh start
   ```

2. **Component Development Order**
   - Complete Phase 1 conditions first
   - Then Phase 2 cards
   - Phase 3 advanced features
   - Phase 4 UI polish

3. **Testing During Development**
   ```bash
   ./dev-mode.sh test
   ```

## Progress Tracking

### Completed ✅
- Lab Value Condition Builder
- Vital Signs Condition Builder
- Medical Condition Builder
- Improved CDS Studio UI (cleaner layout)
- Development environment setup with hot reload
- Cypress workflow testing framework
- Fixed import path issues
- Git commits and pushes

### In Progress 🚧
- Testing all condition builders in UI
- Card Builder enhancements (next priority)

### Not Started 🚧
- Advanced features (Display behavior, Prefetch, Policy)
- Additional UI/UX improvements
- Backend API endpoints
- Programmatic tests

## Next Steps

1. **Immediate**: Test all three condition builders in the UI
2. **Next**: Enhance Card Builder with tabbed interface
3. **Then**: Add FHIR resource templates for suggestions
4. **Finally**: Implement advanced features (Display behavior, Prefetch)

## References

- CDS Hooks Spec: https://cds-hooks.hl7.org/
- FHIR R4: https://hl7.org/fhir/R4/
- US Core: http://hl7.org/fhir/us/core/
- LOINC: https://loinc.org/
- SNOMED CT: https://www.snomed.org/

## Notes

- All components should follow existing patterns in codebase
- Use Material-UI components consistently
- Implement loading states and error handling
- Add proper TypeScript types where applicable
- Follow accessibility guidelines
- Test with real Synthea data, not mock data