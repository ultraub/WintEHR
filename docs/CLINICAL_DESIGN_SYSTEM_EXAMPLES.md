# WintEHR Clinical Design System - Usage Examples

**Version**: 1.0  
**Last Updated**: 2025-01-24  
**Purpose**: Practical code examples for implementing the Clinical Design System

## Table of Contents

1. [Quick Start](#quick-start)
2. [Component Examples](#component-examples)
3. [Common Patterns](#common-patterns)
4. [Real-World Scenarios](#real-world-scenarios)
5. [Integration Examples](#integration-examples)
6. [Testing Examples](#testing-examples)

## Quick Start

### Basic Setup

```javascript
// 1. Import required components
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '@/components/clinical/shared';

// 2. Import FHIR templates if needed
import {
  ConditionCardTemplate,
  MedicationCardTemplate,
  ObservationCardTemplate
} from '@/components/clinical/shared/templates';

// 3. Import theme utilities
import { useTheme } from '@mui/material/styles';
import { clinicalColors } from '@/themes/clinicalThemeUtils';
```

### Minimal Example

```javascript
const PatientConditions = ({ patientId }) => {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConditions();
  }, [patientId]);

  const loadConditions = async () => {
    try {
      const data = await fhirClient.search({
        resourceType: 'Condition',
        searchParams: { patient: patientId }
      });
      setConditions(data.resources);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ClinicalLoadingState.ResourceCard />;
  if (!conditions.length) return <ClinicalEmptyState title="No conditions found" />;

  return (
    <Box>
      {conditions.map((condition, index) => (
        <ConditionCardTemplate
          key={condition.id}
          condition={condition}
          isAlternate={index % 2 === 1}
        />
      ))}
    </Box>
  );
};
```

## Component Examples

### ClinicalResourceCard

#### Basic Usage
```javascript
<ClinicalResourceCard
  title="Essential Hypertension"
  severity="high"
  status="Active"
  statusColor="error"
  icon={<LocalHospitalIcon />}
  details={[
    { label: 'Onset', value: 'Jan 15, 2024' },
    { label: 'Severity', value: 'Stage 2' },
    { label: 'Last Review', value: '2 days ago' }
  ]}
/>
```

#### With Actions
```javascript
<ClinicalResourceCard
  title="Diabetes Type 2"
  severity="moderate"
  status="Active"
  statusColor="warning"
  onEdit={() => handleEdit(condition.id)}
  onDelete={() => handleDelete(condition.id)}
  actions={[
    { 
      label: 'Review', 
      onClick: () => handleReview(condition.id),
      icon: <AssessmentIcon />
    },
    { 
      label: 'Add Note', 
      onClick: () => handleAddNote(condition.id),
      icon: <NoteAddIcon />
    }
  ]}
  isAlternate={true}
/>
```

#### With Complex Content
```javascript
<ClinicalResourceCard
  title="COVID-19 Vaccination"
  severity="normal"
  status="Completed"
  statusColor="success"
  icon={<VaccinesIcon />}
>
  <Box sx={{ mt: 1 }}>
    <Typography variant="body2" color="text.secondary">
      Pfizer-BioNTech COVID-19 Vaccine
    </Typography>
    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
      <Chip 
        label="Dose 1: Jan 15, 2024" 
        size="small" 
        sx={{ borderRadius: '4px' }}
      />
      <Chip 
        label="Dose 2: Feb 5, 2024" 
        size="small" 
        sx={{ borderRadius: '4px' }}
      />
    </Box>
  </Box>
</ClinicalResourceCard>
```

### ClinicalSummaryCard

#### Basic Metric Display
```javascript
<ClinicalSummaryCard
  title="Active Medications"
  value={8}
  severity="moderate"
  icon={<MedicationIcon />}
/>
```

#### With Trend Indicator
```javascript
<ClinicalSummaryCard
  title="Blood Pressure"
  value="145/90"
  severity="high"
  icon={<FavoriteIcon />}
  trend={{
    direction: 'up',
    value: '+10',
    label: 'since last visit'
  }}
/>
```

#### With Action Chips
```javascript
<ClinicalSummaryCard
  title="Lab Results"
  value={24}
  severity="normal"
  icon={<ScienceIcon />}
  chips={[
    { 
      label: '3 Critical', 
      color: 'error',
      onClick: () => filterBySeverity('critical')
    },
    { 
      label: '5 Abnormal', 
      color: 'warning',
      onClick: () => filterBySeverity('abnormal')
    }
  ]}
  onClick={() => navigateToResults()}
/>
```

### ClinicalFilterPanel

#### Basic Search and Date Range
```javascript
const [filters, setFilters] = useState({
  searchQuery: '',
  dateRange: { start: null, end: null },
  viewMode: 'dashboard'
});

<ClinicalFilterPanel
  searchQuery={filters.searchQuery}
  onSearchChange={(value) => setFilters({ ...filters, searchQuery: value })}
  dateRange={filters.dateRange}
  onDateRangeChange={(range) => setFilters({ ...filters, dateRange: range })}
  viewMode={filters.viewMode}
  onViewModeChange={(mode) => setFilters({ ...filters, viewMode: mode })}
/>
```

#### With Additional Filters
```javascript
<ClinicalFilterPanel
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  additionalFilters={
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        size="small"
        sx={{ minWidth: 120 }}
      >
        <MenuItem value="all">All Statuses</MenuItem>
        <MenuItem value="active">Active</MenuItem>
        <MenuItem value="resolved">Resolved</MenuItem>
        <MenuItem value="inactive">Inactive</MenuItem>
      </Select>
      
      <Select
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
        size="small"
        sx={{ minWidth: 120 }}
      >
        <MenuItem value="all">All Severities</MenuItem>
        <MenuItem value="critical">Critical</MenuItem>
        <MenuItem value="high">High</MenuItem>
        <MenuItem value="moderate">Moderate</MenuItem>
        <MenuItem value="low">Low</MenuItem>
      </Select>
    </Box>
  }
/>
```

### ClinicalDataGrid

#### Basic Table
```javascript
const columns = [
  { field: 'name', headerName: 'Test Name', flex: 1 },
  { field: 'value', headerName: 'Result', width: 120 },
  { field: 'unit', headerName: 'Unit', width: 100 },
  { field: 'range', headerName: 'Reference Range', width: 150 },
  { field: 'status', headerName: 'Status', width: 100 }
];

const rows = labResults.map(result => ({
  id: result.id,
  name: result.code?.text || 'Unknown',
  value: result.valueQuantity?.value || '-',
  unit: result.valueQuantity?.unit || '',
  range: result.referenceRange?.[0]?.text || '-',
  status: result.interpretation?.text || 'Normal'
}));

<ClinicalDataGrid
  columns={columns}
  rows={rows}
  density="comfortable"
  getRowClassName={(params) => {
    if (params.row.status === 'Critical') return 'critical-row';
    if (params.row.status === 'Abnormal') return 'high-row';
    return '';
  }}
/>
```

#### With Custom Cell Rendering
```javascript
const columns = [
  { 
    field: 'medication',
    headerName: 'Medication',
    flex: 1,
    renderCell: (params) => (
      <Box>
        <Typography variant="body2">{params.value.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {params.value.dosage}
        </Typography>
      </Box>
    )
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={params.value === 'Active' ? 'success' : 'default'}
        sx={{ borderRadius: '4px' }}
      />
    )
  }
];
```

### ClinicalEmptyState

#### Basic Empty State
```javascript
<ClinicalEmptyState
  icon={<SearchOffIcon />}
  title="No results found"
  message="Try adjusting your search criteria or date range"
/>
```

#### With Actions
```javascript
<ClinicalEmptyState
  icon={<AssignmentIcon />}
  title="No active orders"
  message="There are no active orders for this patient"
  actions={[
    {
      label: 'Create Order',
      onClick: () => openOrderDialog(),
      variant: 'contained'
    },
    {
      label: 'View History',
      onClick: () => showOrderHistory(),
      variant: 'outlined'
    }
  ]}
/>
```

### ClinicalLoadingState

#### Card Skeleton
```javascript
// Single card
<ClinicalLoadingState.ResourceCard />

// Multiple cards
<Box>
  {[...Array(3)].map((_, index) => (
    <ClinicalLoadingState.ResourceCard key={index} />
  ))}
</Box>
```

#### Table Skeleton
```javascript
<ClinicalLoadingState.Table rows={5} columns={4} />
```

#### Summary Cards Skeleton
```javascript
<Grid container spacing={2}>
  {[...Array(4)].map((_, index) => (
    <Grid item xs={12} sm={6} md={3} key={index}>
      <ClinicalLoadingState.Summary />
    </Grid>
  ))}
</Grid>
```

## Common Patterns

### Progressive Loading Pattern
```javascript
const ClinicalDashboard = ({ patientId }) => {
  const [loadingStates, setLoadingStates] = useState({
    critical: true,
    important: true,
    optional: true
  });
  
  const [data, setData] = useState({
    conditions: [],
    medications: [],
    vitals: [],
    labs: []
  });

  useEffect(() => {
    loadCriticalData();
    loadImportantData();
    loadOptionalData();
  }, [patientId]);

  const loadCriticalData = async () => {
    const [conditions, medications] = await Promise.all([
      fhirClient.search({ resourceType: 'Condition', searchParams: { patient: patientId } }),
      fhirClient.search({ resourceType: 'MedicationRequest', searchParams: { patient: patientId } })
    ]);
    
    setData(prev => ({
      ...prev,
      conditions: conditions.resources,
      medications: medications.resources
    }));
    
    setLoadingStates(prev => ({ ...prev, critical: false }));
  };

  return (
    <Box>
      {/* Critical section loads first */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          {loadingStates.critical ? (
            <ClinicalLoadingState.ResourceCard />
          ) : (
            data.conditions.map(condition => (
              <ConditionCardTemplate key={condition.id} condition={condition} />
            ))
          )}
        </Grid>
      </Grid>
    </Box>
  );
};
```

### Filter and Search Pattern
```javascript
const useFilteredResources = (resources, filters) => {
  return useMemo(() => {
    let filtered = [...resources];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(resource => 
        resource.code?.text?.toLowerCase().includes(query) ||
        resource.display?.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(resource => {
        const resourceDate = new Date(resource.effectiveDateTime || resource.authoredOn);
        if (filters.dateRange.start && resourceDate < new Date(filters.dateRange.start)) return false;
        if (filters.dateRange.end && resourceDate > new Date(filters.dateRange.end)) return false;
        return true;
      });
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(resource => 
        resource.status === filters.status
      );
    }

    return filtered;
  }, [resources, filters]);
};

// Usage
const filteredConditions = useFilteredResources(conditions, filters);
```

### Error Handling Pattern
```javascript
const ClinicalDataLoader = ({ children, resourceType, searchParams }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fhirClient.search({ resourceType, searchParams });
      setData(result.resources);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [resourceType, searchParams, retryCount]);

  const retry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (loading) {
    return <ClinicalLoadingState.Full />;
  }

  if (error) {
    return (
      <ClinicalEmptyState
        icon={<ErrorOutlineIcon />}
        title="Failed to load data"
        message={error.message || 'An unexpected error occurred'}
        actions={[
          { label: 'Retry', onClick: retry, variant: 'contained' }
        ]}
      />
    );
  }

  return children(data);
};
```

## Real-World Scenarios

### Patient Summary Dashboard
```javascript
const PatientSummaryDashboard = ({ patientId }) => {
  const theme = useTheme();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummaryData();
  }, [patientId]);

  const loadSummaryData = async () => {
    try {
      const [conditions, medications, allergies, vitals] = await Promise.all([
        fhirClient.search({ resourceType: 'Condition', searchParams: { patient: patientId, 'clinical-status': 'active' } }),
        fhirClient.search({ resourceType: 'MedicationRequest', searchParams: { patient: patientId, status: 'active' } }),
        fhirClient.search({ resourceType: 'AllergyIntolerance', searchParams: { patient: patientId } }),
        fhirClient.search({ resourceType: 'Observation', searchParams: { patient: patientId, category: 'vital-signs', _count: 10 } })
      ]);

      setSummaryData({
        activeConditions: conditions.resources.length,
        activeMedications: medications.resources.length,
        allergies: allergies.resources.length,
        recentVitals: vitals.resources
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Grid container spacing={2}>
        {[...Array(4)].map((_, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <ClinicalLoadingState.Summary />
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Active Conditions"
            value={summaryData.activeConditions}
            severity={summaryData.activeConditions > 5 ? 'high' : 'normal'}
            icon={<LocalHospitalIcon />}
            onClick={() => navigateToTab('chart-review')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Active Medications"
            value={summaryData.activeMedications}
            severity={summaryData.activeMedications > 10 ? 'moderate' : 'normal'}
            icon={<MedicationIcon />}
            chips={[
              { label: '2 High Risk', color: 'error' }
            ]}
            onClick={() => navigateToTab('pharmacy')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Allergies"
            value={summaryData.allergies}
            severity={summaryData.allergies > 0 ? 'high' : 'low'}
            icon={<WarningIcon />}
            onClick={() => navigateToTab('chart-review')}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <ClinicalSummaryCard
            title="Recent Vitals"
            value={summaryData.recentVitals.length}
            severity="normal"
            icon={<FavoriteIcon />}
            trend={{
              direction: 'stable',
              label: 'Blood pressure stable'
            }}
            onClick={() => navigateToTab('results')}
          />
        </Grid>
      </Grid>

      {/* Recent Activity Section */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Recent Clinical Activity
        </Typography>
        <RecentActivityList patientId={patientId} />
      </Paper>
    </Box>
  );
};
```

### Lab Results with Trends
```javascript
const LabResultsWithTrends = ({ patientId, observationCode }) => {
  const [results, setResults] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLabResults();
  }, [patientId, observationCode]);

  const loadLabResults = async () => {
    try {
      const data = await fhirClient.search({
        resourceType: 'Observation',
        searchParams: {
          patient: patientId,
          code: observationCode,
          _sort: '-date',
          _count: 20
        }
      });
      setResults(data.resources);
    } finally {
      setLoading(false);
    }
  };

  const getSeverity = (observation) => {
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
    switch (interpretation) {
      case 'C': return 'critical';
      case 'H': case 'HH': return 'high';
      case 'L': case 'LL': return 'moderate';
      default: return 'normal';
    }
  };

  if (loading) return <ClinicalLoadingState.Table rows={5} />;

  if (viewMode === 'list') {
    return (
      <Box>
        <ClinicalFilterPanel
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          additionalFilters={
            <Button
              startIcon={<TrendingUpIcon />}
              onClick={() => setViewMode('trend')}
              size="small"
            >
              View Trend
            </Button>
          }
        />
        
        {results.map((result, index) => (
          <ObservationCardTemplate
            key={result.id}
            observation={result}
            isAlternate={index % 2 === 1}
            severity={getSeverity(result)}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <ClinicalFilterPanel
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <TrendChart data={results} />
    </Box>
  );
};
```

### Medication Management
```javascript
const MedicationManagement = ({ patientId }) => {
  const [medications, setMedications] = useState([]);
  const [filters, setFilters] = useState({
    searchQuery: '',
    status: 'active'
  });
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredMedications = useMemo(() => {
    return medications.filter(med => {
      if (filters.status !== 'all' && med.status !== filters.status) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const medName = med.medicationCodeableConcept?.text?.toLowerCase() || '';
        return medName.includes(query);
      }
      return true;
    });
  }, [medications, filters]);

  const handleRefill = (medication) => {
    setSelectedMedication(medication);
    setDialogOpen(true);
  };

  const handleDiscontinue = async (medicationId) => {
    try {
      await fhirClient.update({
        resourceType: 'MedicationRequest',
        id: medicationId,
        resource: {
          ...medications.find(m => m.id === medicationId),
          status: 'stopped',
          statusReason: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-status-reason',
              code: 'altchoice',
              display: 'Alternative therapy chosen'
            }]
          }
        }
      });
      
      // Reload medications
      await loadMedications();
      
      showNotification('Medication discontinued successfully', 'success');
    } catch (error) {
      showNotification('Failed to discontinue medication', 'error');
    }
  };

  return (
    <Box>
      <ClinicalFilterPanel
        searchQuery={filters.searchQuery}
        onSearchChange={(value) => setFilters({ ...filters, searchQuery: value })}
        additionalFilters={
          <ToggleButtonGroup
            value={filters.status}
            exclusive
            onChange={(e, value) => setFilters({ ...filters, status: value || 'all' })}
            size="small"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="stopped">Stopped</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {filteredMedications.length === 0 ? (
        <ClinicalEmptyState
          title="No medications found"
          message={filters.status === 'active' ? 'No active medications' : 'No medications match your criteria'}
          actions={[
            { label: 'Add Medication', onClick: () => openPrescribeDialog() }
          ]}
        />
      ) : (
        <Grid container spacing={2}>
          {filteredMedications.map((medication, index) => (
            <Grid item xs={12} md={6} key={medication.id}>
              <MedicationCardTemplate
                medication={medication}
                isAlternate={index % 2 === 1}
                actions={[
                  { label: 'Refill', onClick: () => handleRefill(medication) },
                  { label: 'Discontinue', onClick: () => handleDiscontinue(medication.id) }
                ]}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <RefillDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        medication={selectedMedication}
        onRefill={handleRefillSubmit}
      />
    </Box>
  );
};
```

## Integration Examples

### With React Hook Form
```javascript
const ClinicalForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <ClinicalResourceCard
        title="New Condition"
        severity="normal"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            {...register('conditionName', { required: 'Condition name is required' })}
            label="Condition Name"
            error={!!errors.conditionName}
            helperText={errors.conditionName?.message}
            fullWidth
          />
          
          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              {...register('severity')}
              defaultValue="moderate"
            >
              <MenuItem value="mild">Mild</MenuItem>
              <MenuItem value="moderate">Moderate</MenuItem>
              <MenuItem value="severe">Severe</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            type="submit" 
            variant="contained" 
            sx={{ borderRadius: 0 }}
          >
            Save Condition
          </Button>
        </Box>
      </ClinicalResourceCard>
    </form>
  );
};
```

### With Context API
```javascript
// Context
const ClinicalFilterContext = createContext();

export const ClinicalFilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    searchQuery: '',
    dateRange: { start: null, end: null },
    status: 'all',
    severity: 'all'
  });

  return (
    <ClinicalFilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </ClinicalFilterContext.Provider>
  );
};

// Usage in component
const FilteredClinicalList = () => {
  const { filters } = useContext(ClinicalFilterContext);
  const [resources, setResources] = useState([]);

  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      // Apply filters
      return true; // filtering logic
    });
  }, [resources, filters]);

  return (
    <Box>
      <ClinicalFilterPanel {...filters} />
      {/* Render filtered resources */}
    </Box>
  );
};
```

### With Redux Toolkit
```javascript
// Slice
const clinicalSlice = createSlice({
  name: 'clinical',
  initialState: {
    conditions: [],
    loading: false,
    error: null
  },
  reducers: {
    setConditions: (state, action) => {
      state.conditions = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    }
  }
});

// Component
const ConditionsList = () => {
  const dispatch = useDispatch();
  const { conditions, loading, error } = useSelector(state => state.clinical);

  useEffect(() => {
    dispatch(loadConditions());
  }, []);

  if (loading) return <ClinicalLoadingState.ResourceCard count={3} />;
  if (error) return <ClinicalEmptyState title="Error" message={error} />;

  return conditions.map(condition => (
    <ConditionCardTemplate key={condition.id} condition={condition} />
  ));
};
```

## Testing Examples

### Component Testing
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ClinicalResourceCard', () => {
  it('renders with correct severity styling', () => {
    render(
      <ClinicalResourceCard
        title="Test Condition"
        severity="high"
        status="Active"
      />
    );

    const card = screen.getByText('Test Condition').closest('.MuiCard-root');
    expect(card).toHaveStyle('border-left: 4px solid');
  });

  it('calls edit handler when edit button clicked', async () => {
    const handleEdit = jest.fn();
    
    render(
      <ClinicalResourceCard
        title="Test Condition"
        onEdit={handleEdit}
      />
    );

    const editButton = screen.getByLabelText('Edit');
    await userEvent.click(editButton);
    
    expect(handleEdit).toHaveBeenCalled();
  });
});
```

### Integration Testing
```javascript
describe('Clinical Dashboard Integration', () => {
  it('loads and displays patient data correctly', async () => {
    const mockPatientId = 'patient-123';
    
    // Mock FHIR client
    jest.spyOn(fhirClient, 'search').mockImplementation(({ resourceType }) => {
      if (resourceType === 'Condition') {
        return Promise.resolve({
          resources: [
            { id: '1', code: { text: 'Hypertension' }, status: 'active' }
          ]
        });
      }
      return Promise.resolve({ resources: [] });
    });

    render(<PatientSummaryDashboard patientId={mockPatientId} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    // Check that data is displayed
    expect(screen.getByText('Active Conditions')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
```

### Accessibility Testing
```javascript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Clinical Components Accessibility', () => {
  it('ClinicalResourceCard has no accessibility violations', async () => {
    const { container } = render(
      <ClinicalResourceCard
        title="Test Condition"
        severity="high"
        status="Active"
        onEdit={() => {}}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('provides proper ARIA labels', () => {
    render(
      <ClinicalFilterPanel
        searchQuery=""
        onSearchChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
  });
});
```

## Performance Optimization Examples

### Memoization
```javascript
const ExpensiveComponent = React.memo(({ conditions }) => {
  const processedConditions = useMemo(() => {
    return conditions
      .filter(c => c.status === 'active')
      .sort((a, b) => new Date(b.recordedDate) - new Date(a.recordedDate))
      .map(c => ({
        ...c,
        severityScore: calculateSeverityScore(c)
      }));
  }, [conditions]);

  return (
    <Box>
      {processedConditions.map(condition => (
        <ConditionCardTemplate key={condition.id} condition={condition} />
      ))}
    </Box>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.conditions.length === nextProps.conditions.length &&
         prevProps.conditions.every((c, i) => c.id === nextProps.conditions[i].id);
});
```

### Virtual Scrolling
```javascript
import { FixedSizeList } from 'react-window';

const VirtualizedConditionList = ({ conditions }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ConditionCardTemplate
        condition={conditions[index]}
        isAlternate={index % 2 === 1}
      />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={conditions.length}
      itemSize={120} // Height of each card
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

### Lazy Loading
```javascript
const LazyTabContent = ({ tabId }) => {
  const TabComponent = useMemo(() => {
    switch (tabId) {
      case 'conditions':
        return lazy(() => import('./tabs/ConditionsTab'));
      case 'medications':
        return lazy(() => import('./tabs/MedicationsTab'));
      default:
        return () => <div>Unknown tab</div>;
    }
  }, [tabId]);

  return (
    <Suspense fallback={<ClinicalLoadingState.Full />}>
      <TabComponent />
    </Suspense>
  );
};
```

---

These examples demonstrate practical implementations of the Clinical Design System components in real-world scenarios. For more detailed specifications, refer to the [Clinical Design System Documentation](./CLINICAL_DESIGN_SYSTEM.md).