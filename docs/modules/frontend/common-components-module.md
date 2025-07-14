# Common Components Module

## Overview
The Common Components Module provides reusable UI components that implement healthcare-specific patterns, Material-UI integration, and clinical workflows. These components form the building blocks for WintEHR's user interface.

## Architecture
```
Common Components Module
├── Dialogs/
│   ├── Clinical Forms
│   ├── Confirmation Dialogs
│   └── Multi-step Wizards
├── Charts/
│   ├── Lab Trends
│   ├── Vital Signs
│   └── Clinical Timelines
├── Lists/
│   ├── Resource Lists
│   ├── Search Results
│   └── Clinical Cards
├── Forms/
│   ├── FHIR Forms
│   ├── Clinical Inputs
│   └── Validation
└── Layout/
    ├── Page Templates
    ├── Navigation
    └── Clinical Headers
```

## Dialog Components

### AddProblemDialog
**Purpose**: SNOMED-integrated problem list addition

**Features**:
- Real-time SNOMED search
- ICD-10 mapping
- Clinical status selection
- Onset date picking
- Severity assessment

**Component Structure**:
```javascript
<Dialog>
  <DialogTitle>Add Problem</DialogTitle>
  <DialogContent>
    <Autocomplete /> {/* SNOMED search */}
    <DatePicker />   {/* Onset date */}
    <Select />       {/* Clinical status */}
    <TextField />    {/* Notes */}
  </DialogContent>
  <DialogActions>
    <Button>Cancel</Button>
    <Button>Add Problem</Button>
  </DialogActions>
</Dialog>
```

### PrescribeMedicationDialog
**Purpose**: Comprehensive medication ordering

**Features**:
- RxNorm medication search
- Dosage calculation
- Frequency selection
- Duration setting
- Refill management
- Drug interaction checking (placeholder)

**Advanced Features**:
- SIG builder
- PRN instructions
- Tapering schedules
- Substitution preferences

### EditProblemDialog
**Purpose**: Problem modification with audit trail

**Features**:
- Status transitions
- Resolution dating
- Note addition
- History viewing
- Soft deletion

### EncounterSummaryDialog
**Purpose**: Comprehensive encounter details

**Sections**:
- Chief complaint
- Vital signs
- Assessment & plan
- Orders placed
- Medications changed
- Follow-up instructions

## Chart Components

### LabTrendsChart
**Purpose**: Multi-parameter lab visualization

**Features**:
- Multiple Y-axes support
- Reference range shading
- Abnormal value highlighting
- Zoom/pan functionality
- Data point tooltips
- Time range selection

**Configuration**:
```javascript
<LabTrendsChart
  data={labData}
  parameters={['glucose', 'hba1c']}
  timeRange="1year"
  showReferenceRanges
  highlightAbnormal
  onDataPointClick={handleClick}
/>
```

### VitalSignsChart
**Purpose**: Vital signs trending with clinical context

**Tracks**:
- Blood pressure (systolic/diastolic)
- Heart rate
- Temperature
- Respiratory rate
- O2 saturation
- Weight/BMI

**Features**:
- Multiple parameter overlay
- Clinical event markers
- Normal range indicators
- Trend analysis

### ClinicalTimeline
**Purpose**: Patient history visualization

**Timeline Events**:
- Encounters
- Procedures
- Medications started/stopped
- Lab results
- Imaging studies
- Diagnoses

## List Components

### MedicationList
**Purpose**: Active medication display with actions

**Features**:
- Medication grouping (chronic/acute/PRN)
- Adherence indicators
- Refill status
- Quick actions (refill, discontinue)
- Interaction warnings

**List Item Structure**:
```javascript
<ListItem>
  <ListItemAvatar>
    <MedicationIcon />
  </ListItemAvatar>
  <ListItemText
    primary={medicationName}
    secondary={`${dose} ${frequency} - ${duration}`}
  />
  <ListItemSecondaryAction>
    <IconButton><Refill /></IconButton>
    <IconButton><Stop /></IconButton>
  </ListItemSecondaryAction>
</ListItem>
```

### ProblemList
**Purpose**: Structured problem display

**Organization**:
- Active problems
- Resolved problems
- Chronic conditions
- Acute issues

**Features**:
- ICD-10 codes
- Onset dates
- Last updated
- Associated medications
- Quick edit/resolve

### SearchResultsList
**Purpose**: Unified search result display

**Result Types**:
- Conditions (SNOMED)
- Medications (RxNorm)
- Lab tests (LOINC)
- Procedures (CPT)

**Features**:
- Result grouping
- Relevance scoring
- Quick selection
- Detail preview

## Form Components

### FHIRResourceForm
**Purpose**: Generic FHIR resource editing

**Features**:
- Schema-driven rendering
- Validation rules
- Nested object support
- Array handling
- Reference picker

**Usage**:
```javascript
<FHIRResourceForm
  resourceType="Condition"
  resource={condition}
  schema={conditionSchema}
  onSubmit={handleSubmit}
  validation={validationRules}
/>
```

### ClinicalDatePicker
**Purpose**: Healthcare-aware date selection

**Features**:
- Onset date fuzzy matching
- Age-based calculation
- Future date restrictions
- Clinical event markers

### MedicationDosageInput
**Purpose**: Structured dosage entry

**Components**:
- Dose amount
- Unit selection
- Route dropdown
- Frequency builder
- PRN instructions

### AllergyInput
**Purpose**: Allergy documentation

**Fields**:
- Allergen search
- Reaction type
- Severity scale
- Onset date
- Verification status

## Layout Components

### PatientHeader
**Purpose**: Consistent patient identification

**Display Elements**:
- Name (preferred)
- MRN
- Age/DOB
- Gender
- Allergies (count)
- Primary insurance

**Actions**:
- Patient search
- Context switch
- Demographics edit
- Print labels

### ClinicalNav
**Purpose**: Role-based navigation

**Navigation Structure**:
- Clinical workspace
- Orders & results
- Medications
- Documentation
- Reports
- Settings

### PageTemplate
**Purpose**: Consistent page layout

**Structure**:
```javascript
<PageTemplate
  title="Clinical Workspace"
  subtitle={patientName}
  actions={<ActionButtons />}
  breadcrumbs={['Home', 'Patients', patientName]}
>
  {/* Page content */}
</PageTemplate>
```

## Shared Patterns

### Material-UI Integration
```javascript
// Consistent theming
const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
  },
  primary: {
    color: theme.palette.primary.main,
  },
  error: {
    color: theme.palette.error.main,
    backgroundColor: theme.palette.error.light,
  }
}));
```

### Loading States
```javascript
// Skeleton loading pattern
if (loading) {
  return (
    <>
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="rectangular" height={200} />
      <Skeleton variant="text" width="60%" />
    </>
  );
}
```

### Error Handling
```javascript
// Consistent error display
<Alert severity="error" onClose={handleDismiss}>
  <AlertTitle>Error</AlertTitle>
  {error.message}
  {error.details && (
    <details>
      <summary>Technical details</summary>
      <pre>{JSON.stringify(error.details, null, 2)}</pre>
    </details>
  )}
</Alert>
```

### Empty States
```javascript
// Informative empty states
<Box textAlign="center" py={4}>
  <EmptyStateIcon />
  <Typography variant="h6">No results found</Typography>
  <Typography variant="body2" color="textSecondary">
    Try adjusting your search criteria
  </Typography>
  <Button onClick={handleReset}>Reset Filters</Button>
</Box>
```

## Integration Points

### Hook Integration
- Components use custom hooks
- Automatic data fetching
- State management
- Event handling

### Context Usage
- Patient context awareness
- Auth state integration
- Theme preferences
- Locale support

### Service Layer
- Direct service calls for actions
- Error handling propagation
- Loading state management
- Cache utilization

## Key Features

### Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus management

### Responsive Design
- Mobile-first approach
- Breakpoint handling
- Touch-friendly controls
- Adaptive layouts

### Clinical Safety
- Required field validation
- Data integrity checks
- Confirmation dialogs
- Audit trail support
- Error prevention

## Educational Value

### Component Patterns
- Compound components
- Render props
- Higher-order components
- Composition patterns
- Controlled components

### Material-UI Best Practices
- Theme customization
- Component styling
- Responsive grids
- Icon usage
- Animation patterns

### Healthcare UI/UX
- Clinical workflows
- Safety considerations
- Information density
- Quick actions
- Error prevention

## Missing Features & Improvements

### Planned Enhancements
- Drag-and-drop support
- Advanced filtering
- Bulk operations
- Keyboard shortcuts
- Custom themes

### Component Library
- Storybook integration
- Component documentation
- Visual regression testing
- Design tokens
- Figma sync

### Clinical Features
- Voice input support
- Barcode scanning
- Clinical calculators
- Decision support UI
- Template library

## Best Practices

### Component Design
- Single responsibility
- Props validation
- Default props
- Error boundaries
- Memoization

### Styling
- Use theme consistently
- Avoid inline styles
- Responsive by default
- Support dark mode
- Minimize specificity

### Performance
- Lazy load heavy components
- Virtualize long lists
- Optimize re-renders
- Code split dialogs
- Image optimization

## Module Dependencies
```
Common Components Module
├── Material-UI
├── Hooks Module
├── Utils Module
├── Services Module (for actions)
└── External Libraries
    ├── Chart.js
    ├── date-fns
    ├── react-hook-form
    └── yup (validation)
```

## Testing Strategy
- Component unit tests
- Visual regression tests
- Accessibility tests
- User interaction tests
- Storybook scenarios