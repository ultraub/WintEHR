# MedGenEMR Frontend Redesign Plan

## Overview
Transform the frontend into a comprehensive FHIR-native EMR that simulates real-world clinical workflows while serving as a training platform for physicians and informaticists. Do not be afraid to scrap anything, or rebuild in a better fashion. Do not keep legacy files, they will be tracked in the git history.

## Key Design Principles
1. **FHIR-First**: All clinical data consumed via FHIR R4 APIs
2. **Clinical Workflow Focused**: Mirror real EMR patterns
3. **Educational**: Include FHIR resource viewers for learning
4. **Performance**: Efficient data loading and caching
5. **Real-time**: WebSocket integration for live updates

## Proposed Architecture Changes

### 1. Patient Dashboard Redesign
- **Summary Cards**: Overview of key clinical data
  - Demographics with insurance (Coverage resources)
  - Active Problems (Condition resources)
  - Current Medications (MedicationRequest)
  - Recent Vitals (Observation)
  - Allergies (AllergyIntolerance)
  - Care Team (CareTeam resources)
  
- **Timeline View**: Chronological patient journey
  - Encounters with procedures
  - Lab results trends
  - Medication changes
  - Care plan milestones

### 2. Clinical Workspace Enhancement
Replace current tabs with comprehensive clinical modules:

#### A. **Chart Review Tab**
- Problem List (Conditions)
- Medication List with interactions
- Allergy List with reactions
- Immunization History
- Social History (from Observations)
- Family History

#### B. **Orders & Results Tab**
- Lab Results viewer with trends
- Diagnostic Reports with PDF viewing
- Imaging Studies (ImagingStudy resources)
- Procedure History
- Order Entry (ServiceRequest creation)

#### C. **Care Management Tab**
- Care Plans viewer/editor
- Care Team management
- Goals tracking
- Patient tasks (from CarePlan activities)

#### D. **Clinical Documents Tab**
- DocumentReference viewer
- Clinical notes (from DocumentReference)
- External documents
- Generate summaries

#### E. **Financial Tab**
- Claims history (Claim resources)
- Coverage details
- Explanation of Benefits
- Billing summaries

### 3. New Components to Create

#### Clinical Components:
1. **FHIRResourceTimeline**: Visual timeline of all resources ✅
2. **MedicationReconciliation**: Med rec workflow
3. **ProblemListManager**: SNOMED-coded problem management
4. **VitalSignsFlowsheet**: Tabular vitals over time
5. **LabResultsGraph**: Trending lab values
6. **ImmunizationScheduler**: Vaccine tracking/forecasting
7. **CareGapAnalysis**: Quality measure gaps
8. **ClinicalDecisionSupport**: Enhanced CDS with explanations

#### Administrative Components:
1. **EncounterBuilder**: Create new encounters
2. **OrderBuilder**: FHIR ServiceRequest creator
3. **ReferralManager**: Manage referrals
4. **InsuranceVerification**: Coverage validation
5. **ProviderSchedule**: Practitioner availability

#### Educational Components:
1. **FHIRResourceExplorer**: Raw resource viewer
2. **FHIRGraphExplorer**: Resource relationship visualization
3. **ClinicalWorkflowSimulator**: Training scenarios
4. **FHIRQueryBuilder**: Learn FHIR search

### 4. Data Flow Improvements

#### Caching Strategy:
- Patient context caching
- Resource bundling for related data
- Optimistic updates with WebSocket sync

#### Search Enhancements:
- Patient search with demographics
- Encounter search by date/type/provider
- Global resource search

### 5. Navigation Restructure

```
Root
├── Patient Registry (search/list)
├── Patient Chart
│   ├── Summary Dashboard
│   ├── Chart Review
│   ├── Orders & Results
│   ├── Care Management
│   ├── Documents
│   ├── Financial
│   └── Timeline
├── Provider Workspace
│   ├── Schedule
│   ├── Tasks
│   ├── Messages
│   └── Analytics
├── Administration
│   ├── Organization Management
│   ├── Location Directory
│   ├── Provider Directory
│   └── System Settings
└── Training Center
    ├── FHIR Explorer
    ├── Workflow Simulator
    ├── Query Builder
    └── Resource Relationships
```

### 6. Key Features to Implement

1. **Smart Patient Banner**: Contextual alerts and key info
2. **Encounter Context**: Maintain encounter context across views
3. **Quick Actions**: Common workflows (order labs, prescribe, refer)
4. **Clinical Inbox**: Tasks, results, messages in unified view
5. **Patient Portal Preview**: See patient's view
6. **Export Functions**: C-CDA, PDF summaries
7. **Audit Trail Integration**: Track all actions

### 7. Technical Enhancements

- Replace mixed API calls with pure FHIR client
- Implement FHIR resource state management (Redux/Context)
- Add resource relationship mapping
- Enhance error handling for FHIR operations
- Add offline capability with service workers

### 8. Educational Features

- FHIR resource tooltips
- "View as FHIR" toggle on all screens
- Resource relationship diagrams
- FHIR query examples
- Clinical workflow tutorials

## Available FHIR Resources (Total: 3,461)
- AllergyIntolerance: 20
- CarePlan: 20
- CareTeam: 20
- Claim: 279
- Condition: 161
- Device: 18
- DiagnosticReport: 315
- DocumentReference: 209
- Encounter: 209
- ExplanationOfBenefit: 279
- ImagingStudy: 6
- Immunization: 95
- Location: 37
- Medication: 11
- MedicationAdministration: 11
- MedicationRequest: 70
- Observation: 1090
- Organization: 36
- Patient: 11
- Practitioner: 36
- PractitionerRole: 36
- Procedure: 421
- Provenance: 11
- SupplyDelivery: 60