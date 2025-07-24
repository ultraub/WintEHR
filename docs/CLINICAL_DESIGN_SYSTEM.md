# WintEHR Clinical Design System

**Version**: 1.0  
**Last Updated**: 2025-01-24  
**Status**: Living Document

## Table of Contents

1. [Introduction](#introduction)
2. [Design Principles](#design-principles)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Components](#components)
7. [Patterns](#patterns)
8. [Accessibility](#accessibility)
9. [Implementation Guide](#implementation-guide)
10. [Migration Guide](#migration-guide)

## Introduction

The WintEHR Clinical Design System provides a comprehensive set of UI components, patterns, and guidelines specifically designed for healthcare applications. It emphasizes clarity, efficiency, and safety in clinical workflows.

### Goals
- **Consistency**: Unified visual language across all clinical modules
- **Efficiency**: Optimize for rapid clinical decision-making
- **Safety**: Clear visual hierarchy to prevent medical errors
- **Accessibility**: WCAG 2.1 AA compliance for all users
- **Performance**: Fast rendering on all devices

## Design Principles

### 1. Clinical Clarity
Every design decision prioritizes clear communication of clinical information. Dense data is presented with appropriate visual hierarchy and spacing.

### 2. Professional Aesthetic
Sharp corners and minimal embellishments create a professional medical interface that instills confidence.

### 3. Severity-Based Design
Visual indicators scale with clinical severity, ensuring critical information stands out immediately.

### 4. Information Density
Balance between comprehensive data display and cognitive load, optimizing for clinical workflows.

### 5. Responsive Intelligence
Adapt layouts and information density based on device capabilities and user context.

## Color System

### Clinical Severity Scale

Our color system is based on clinical severity levels, providing immediate visual context for healthcare providers.

```javascript
const clinicalColors = {
  critical: {
    main: '#d32f2f',      // Red-700
    light: '#ff5252',     // Red-A200
    dark: '#b71c1c',      // Red-900
    contrast: '#ffffff'
  },
  high: {
    main: '#f57c00',      // Orange-700
    light: '#ff9800',     // Orange-500
    dark: '#e65100',      // Orange-900
    contrast: '#ffffff'
  },
  moderate: {
    main: '#fbc02d',      // Yellow-700
    light: '#fdd835',     // Yellow-600
    dark: '#f57f17',      // Yellow-900
    contrast: '#000000'
  },
  low: {
    main: '#388e3c',      // Green-700
    light: '#4caf50',     // Green-500
    dark: '#1b5e20',      // Green-900
    contrast: '#ffffff'
  },
  normal: {
    main: '#1976d2',      // Blue-700
    light: '#2196f3',     // Blue-500
    dark: '#0d47a1',      // Blue-900
    contrast: '#ffffff'
  }
};
```

### Semantic Colors

```javascript
const semanticColors = {
  // Status
  active: '#4caf50',      // Green for active/current
  inactive: '#9e9e9e',    // Gray for inactive/past
  pending: '#ff9800',     // Orange for pending/in-progress
  
  // Actions
  primary: '#1976d2',     // Blue for primary actions
  secondary: '#dc004e',   // Pink for secondary actions
  danger: '#d32f2f',      // Red for destructive actions
  
  // Backgrounds
  surface: '#ffffff',
  background: '#fafafa',
  paper: '#ffffff',
  
  // Borders
  divider: 'rgba(0, 0, 0, 0.12)',
  border: 'rgba(0, 0, 0, 0.23)'
};
```

### Usage Guidelines

1. **Critical (Red)**: Life-threatening conditions, urgent alerts, critical lab values
2. **High (Orange)**: Abnormal results requiring attention, warnings
3. **Moderate (Yellow)**: Cautions, slightly abnormal values
4. **Low (Green)**: Normal results, completed actions, success states
5. **Normal (Blue)**: Default state, informational content

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
  sans-serif;
```

### Type Scale
```javascript
const typography = {
  h1: { fontSize: '2.5rem', fontWeight: 400, lineHeight: 1.2 },
  h2: { fontSize: '2rem', fontWeight: 400, lineHeight: 1.3 },
  h3: { fontSize: '1.75rem', fontWeight: 400, lineHeight: 1.4 },
  h4: { fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.4 },
  h5: { fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.5 },
  h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
  body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.43 },
  caption: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.66 },
  overline: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 2.66, textTransform: 'uppercase' }
};
```

### Clinical Text Hierarchy
- **Primary Information**: Patient name, critical values (16px, semi-bold)
- **Secondary Information**: Dates, normal values (14px, regular)
- **Tertiary Information**: Metadata, timestamps (12px, regular)
- **Labels**: Field names, categories (12px, medium, uppercase)

## Spacing & Layout

### Spacing Scale
```javascript
const spacing = {
  xs: 4,   // 4px - Tight spacing within components
  sm: 8,   // 8px - Default spacing between elements
  md: 16,  // 16px - Card padding, section spacing
  lg: 24,  // 24px - Major section spacing
  xl: 32,  // 32px - Page margins
  xxl: 48  // 48px - Large separations
};
```

### Layout Principles

#### Card Layout
```css
.clinical-card {
  padding: 16px;
  border-radius: 0; /* Sharp corners */
  border-left: 4px solid; /* Severity indicator */
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}
```

#### Grid System
- **Desktop**: 12-column grid, 24px gutters
- **Tablet**: 8-column grid, 16px gutters
- **Mobile**: 4-column grid, 8px gutters

#### Responsive Breakpoints
```javascript
const breakpoints = {
  xs: 0,     // Mobile
  sm: 600,   // Large mobile
  md: 960,   // Tablet
  lg: 1280,  // Desktop
  xl: 1920   // Large desktop
};
```

## Components

### Core Components

#### 1. ClinicalResourceCard
Base card component for all clinical resources.

```jsx
<ClinicalResourceCard
  title="Hypertension"
  severity="high"
  status="active"
  statusColor="error"
  icon={<ConditionIcon />}
  details={[
    { label: 'Onset', value: 'Jan 15, 2024' },
    { label: 'Severity', value: 'Stage 2' }
  ]}
  onEdit={handleEdit}
  isAlternate={index % 2 === 1}
/>
```

**Design Specifications:**
- Border radius: 0px (sharp corners)
- Left border: 4px solid (severity color)
- Padding: 16px
- Shadow: 0 1px 3px rgba(0,0,0,0.12)
- Hover state: Elevation increases to 4

#### 2. ClinicalSummaryCard
Statistical summary cards for dashboards.

```jsx
<ClinicalSummaryCard
  title="Active Medications"
  value={8}
  severity="moderate"
  icon={<MedicationIcon />}
  chips={[
    { label: '2 High Risk', color: 'error' }
  ]}
  trend={{ direction: 'up', value: '+3', label: 'this week' }}
/>
```

**Design Specifications:**
- Min height: 120px
- Icon size: 48px
- Value font size: 32px
- Trend indicator: 14px with directional arrow

#### 3. ClinicalFilterPanel
Unified filtering interface across all modules.

```jsx
<ClinicalFilterPanel
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  additionalFilters={
    <Select value={status} onChange={setStatus}>
      <MenuItem value="all">All Statuses</MenuItem>
      <MenuItem value="active">Active</MenuItem>
      <MenuItem value="resolved">Resolved</MenuItem>
    </Select>
  }
/>
```

**Design Specifications:**
- Background: #f5f5f5
- Border radius: 0px
- Padding: 16px
- Auto-collapse on scroll
- Mobile: Stacked layout

#### 4. ClinicalDataGrid
Data table with clinical-specific features.

```jsx
<ClinicalDataGrid
  columns={[
    { field: 'name', headerName: 'Test Name', flex: 1 },
    { field: 'value', headerName: 'Result', width: 120 },
    { field: 'range', headerName: 'Reference', width: 150 }
  ]}
  rows={labResults}
  getRowClassName={(params) => 
    params.row.interpretation === 'abnormal' ? 'high-severity' : ''
  }
  density="comfortable"
/>
```

**Design Specifications:**
- Row height: 52px (comfortable), 40px (compact)
- Alternating row backgrounds: #fafafa / #ffffff
- Header background: #f5f5f5
- Sort indicators: Material-UI arrows
- Abnormal values: Bold with severity color

#### 5. ClinicalEmptyState
Informative empty states with actions.

```jsx
<ClinicalEmptyState
  icon={<NoDataIcon />}
  title="No results found"
  message="Try adjusting your filters or date range"
  actions={[
    { label: 'Clear Filters', onClick: clearFilters },
    { label: 'Add Result', onClick: addResult, variant: 'contained' }
  ]}
/>
```

**Design Specifications:**
- Icon size: 64px
- Icon color: #9e9e9e
- Title: 18px, semi-bold
- Message: 14px, regular
- Vertical spacing: 24px between elements

#### 6. ClinicalLoadingState
Skeleton screens matching component layouts.

```jsx
// Card skeleton
<ClinicalLoadingState.ResourceCard />

// Table skeleton
<ClinicalLoadingState.Table rows={5} columns={4} />

// Summary skeleton
<ClinicalLoadingState.Summary count={4} />
```

**Design Specifications:**
- Animation: Pulse (1.5s ease-in-out)
- Background: Linear gradient (#f5f5f5 to #eeeeee)
- Match exact dimensions of loaded content

### FHIR Resource Templates

Pre-built templates for common FHIR resources:

#### ConditionCardTemplate
```jsx
<ConditionCardTemplate
  condition={{
    code: { text: 'Essential Hypertension' },
    clinicalStatus: { coding: [{ code: 'active' }] },
    severity: { coding: [{ code: 'moderate' }] },
    onsetDateTime: '2024-01-15'
  }}
  onEdit={handleEdit}
/>
```

#### MedicationCardTemplate
```jsx
<MedicationCardTemplate
  medication={{
    medicationCodeableConcept: { text: 'Lisinopril 10mg' },
    status: 'active',
    dosageInstruction: [{ text: 'Take 1 tablet daily' }],
    authoredOn: '2024-01-20'
  }}
  onEdit={handleEdit}
/>
```

## Patterns

### Loading Patterns

#### Progressive Loading
Load critical data first, then enhance with additional information.

```javascript
// Phase 1: Critical data (conditions, medications, allergies)
const criticalData = await loadCriticalResources(patientId);

// Phase 2: Important data (recent labs, vitals)
const importantData = await loadImportantResources(patientId);

// Phase 3: Historical data (past encounters, old results)
const historicalData = await loadHistoricalResources(patientId);
```

#### Skeleton Screens
Show layout structure while loading to reduce perceived wait time.

### Error Handling

#### Error States
```jsx
<Alert severity="error" sx={{ borderRadius: 0 }}>
  <AlertTitle>Failed to load medications</AlertTitle>
  Please check your connection and try again.
  <Button onClick={retry} size="small" sx={{ mt: 1 }}>
    Retry
  </Button>
</Alert>
```

#### Validation Feedback
- Inline validation with clear error messages
- Field-level error states with red borders
- Summary of all errors at form top

### Navigation Patterns

#### Tab Navigation
```jsx
<Tabs value={activeTab} onChange={handleTabChange}>
  <Tab label="Summary" icon={<DashboardIcon />} />
  <Tab label="Chart Review" icon={<AssignmentIcon />} />
  <Tab label="Results" icon={<ScienceIcon />} />
</Tabs>
```

#### Deep Linking
Support URL parameters for direct navigation:
```
/clinical/patient/123?tab=results&resourceId=obs-456
```

### Data Visualization

#### Trend Charts
Use consistent colors and clear axes for clinical trends.

```jsx
<TrendChart
  data={vitalSigns}
  yAxis={{ label: 'Blood Pressure (mmHg)' }}
  xAxis={{ label: 'Date' }}
  series={[
    { name: 'Systolic', color: clinicalColors.high.main },
    { name: 'Diastolic', color: clinicalColors.moderate.main }
  ]}
/>
```

#### Status Indicators
```jsx
<Chip
  label={status}
  size="small"
  sx={{
    backgroundColor: getStatusColor(status),
    color: 'white',
    borderRadius: '4px' // Slightly rounded for chips
  }}
/>
```

## Accessibility

### WCAG 2.1 AA Compliance

#### Color Contrast
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum
- Focus indicators: 3:1 minimum

#### Keyboard Navigation
- All interactive elements accessible via keyboard
- Logical tab order
- Visible focus indicators
- Skip links for main content

#### Screen Reader Support
```jsx
// Proper ARIA labels
<IconButton aria-label="Edit medication">
  <EditIcon />
</IconButton>

// Live regions for updates
<div aria-live="polite" aria-atomic="true">
  {updateMessage}
</div>

// Semantic HTML
<nav aria-label="Patient sections">
  <Tabs>...</Tabs>
</nav>
```

#### Responsive Design
- Touch targets: Minimum 44x44px
- Text remains readable when zoomed to 200%
- No horizontal scrolling at standard zoom
- Content reflows for mobile viewports

### Testing Checklist
- [ ] Keyboard-only navigation
- [ ] Screen reader testing (NVDA/JAWS)
- [ ] Color contrast validation
- [ ] Focus indicator visibility
- [ ] Error message clarity
- [ ] Loading state announcements
- [ ] Mobile touch target sizes

## Implementation Guide

### Setup

#### 1. Install Dependencies
```bash
npm install @mui/material @emotion/react @emotion/styled
```

#### 2. Theme Configuration
```javascript
import { createTheme } from '@mui/material/styles';

const clinicalTheme = createTheme({
  shape: {
    borderRadius: 0 // Sharp corners
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif'
    ].join(',')
  },
  palette: {
    severity: {
      critical: '#d32f2f',
      high: '#f57c00',
      moderate: '#fbc02d',
      low: '#388e3c',
      normal: '#1976d2'
    }
  }
});
```

#### 3. Component Usage
```jsx
import { 
  ClinicalResourceCard,
  ClinicalFilterPanel,
  ClinicalDataGrid 
} from '@/components/clinical/shared';

function MyComponent() {
  return (
    <Box>
      <ClinicalFilterPanel {...filterProps} />
      <ClinicalDataGrid {...gridProps} />
    </Box>
  );
}
```

### Best Practices

#### 1. Consistent Severity Mapping
```javascript
function getSeverity(resource) {
  if (resource.interpretation?.coding?.[0]?.code === 'critical') {
    return 'critical';
  }
  if (resource.priority === 'urgent') {
    return 'high';
  }
  // ... additional logic
  return 'normal';
}
```

#### 2. Loading State Management
```javascript
const [loading, setLoading] = useState({
  initial: true,
  refresh: false,
  loadMore: false
});

// Show different loading states
if (loading.initial) return <ClinicalLoadingState.Full />;
if (loading.refresh) return <ClinicalLoadingState.Overlay />;
```

#### 3. Error Boundaries
```jsx
<ErrorBoundary fallback={<ClinicalErrorFallback />}>
  <ClinicalComponent />
</ErrorBoundary>
```

#### 4. Performance Optimization
```javascript
// Memoize expensive calculations
const processedData = useMemo(
  () => processLabResults(rawData),
  [rawData]
);

// Virtualize long lists
<VirtualList
  items={medications}
  itemHeight={64}
  renderItem={(med) => <MedicationCardTemplate medication={med} />}
/>
```

## Migration Guide

### From Legacy Components

#### Step 1: Identify Deprecated Components
```javascript
// Old
import ChartReviewTab from './tabs/ChartReviewTab';
import ClinicalCard from './common/ClinicalCard';

// New
import ChartReviewTabOptimized from './tabs/ChartReviewTabOptimized';
import { ClinicalResourceCard } from './shared';
```

#### Step 2: Update Imports
```javascript
// Before
import { Card, CardContent, CardActions } from '@mui/material';

// After
import { ClinicalResourceCard } from '@/components/clinical/shared';
```

#### Step 3: Refactor Components
```javascript
// Before
<Card sx={{ borderRadius: 2, mb: 2 }}>
  <CardContent>
    <Typography variant="h6">{condition.display}</Typography>
    <Typography color="textSecondary">{condition.status}</Typography>
  </CardContent>
</Card>

// After
<ClinicalResourceCard
  title={condition.display}
  severity={getSeverity(condition)}
  status={condition.status}
  statusColor={getStatusColor(condition.status)}
  details={[
    { label: 'Onset', value: formatDate(condition.onset) },
    { label: 'Severity', value: condition.severity }
  ]}
/>
```

#### Step 4: Apply New Patterns
1. Replace rounded corners with sharp corners
2. Add severity-based left borders
3. Implement alternating row backgrounds
4. Use standardized loading states
5. Apply consistent spacing scale

### Testing Migration
```javascript
// Test checklist
describe('Clinical Component Migration', () => {
  it('should display with sharp corners', () => {
    expect(component).toHaveStyle('border-radius: 0');
  });
  
  it('should show severity indicator', () => {
    expect(component).toHaveStyle('border-left: 4px solid');
  });
  
  it('should handle loading states', () => {
    expect(loading).toShowSkeleton();
  });
});
```

### Rollback Plan
If issues arise during migration:
1. Components can be rolled back individually
2. Use feature flags for gradual rollout
3. Maintain backward compatibility through wrapper components

## Resources

### Component Library
- Source: `/frontend/src/components/clinical/shared/`
- Templates: `/frontend/src/components/clinical/shared/templates/`
- **Usage Examples**: [Clinical Design System Examples](./CLINICAL_DESIGN_SYSTEM_EXAMPLES.md) - Comprehensive code examples

### Tools
- [Figma Design Files](#) (Coming soon)
- [Storybook Component Playground](#) (Coming soon)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Accessibility Tool](https://wave.webaim.org/)

### Further Reading
- [FHIR Resource Specifications](https://www.hl7.org/fhir/)
- [Material-UI Documentation](https://mui.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Clinical UI Best Practices](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6371261/)

---

**Version History**
- v1.0 (2025-01-24): Initial release with core components and patterns
- v1.1 (2025-01-24): Added comprehensive usage examples documentation