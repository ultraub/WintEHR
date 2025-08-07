# Chart Review Module

**Version**: 1.0.0  
**Last Updated**: 2025-08-06  
**Component Location**: `frontend/src/components/tabs/ChartReviewTab.js`

## Overview

The Chart Review module provides comprehensive patient chart viewing and management capabilities, serving as the primary interface for clinicians to review patient medical history, current conditions, medications, and vital signs.

## Features

### Core Functionality
- **Problem List Management**: View and manage active/resolved conditions
- **Medication List**: Current and historical medications with reconciliation
- **Allergy Tracking**: Allergies and intolerances with severity indicators
- **Vital Signs**: Current vitals with graphical trending
- **Clinical Notes**: Progress notes, consultation reports, discharge summaries
- **Lab Results**: Recent lab results with critical value highlighting
- **Immunizations**: Vaccination history and schedules

### Advanced Features
- **Timeline View**: Chronological event visualization
- **Smart Filters**: Filter by date, type, severity, status
- **Quick Actions**: One-click ordering, messaging, documentation
- **Clinical Alerts**: Important notifications and reminders
- **Export Options**: Print, PDF, or share chart sections

## User Interface

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│                    Patient Header                       │
│  Name | MRN | Age | Allergies | Alerts                 │
├─────────────────────────────────────────────────────────┤
│ Navigation Tabs                                         │
│ [Summary] [Problems] [Medications] [Vitals] [Notes]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    Content Area                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │   Filters    │  │                                │  │
│  │              │  │     Main Content Display       │  │
│  │  Date Range  │  │                                │  │
│  │  Category    │  │                                │  │
│  │  Status      │  │                                │  │
│  └──────────────┘  └──────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Component Implementation

### Main Component
```javascript
// components/tabs/ChartReviewTab.js
import React, { useState, useEffect } from 'react';
import { 
  Box, Tabs, Tab, Paper, Grid 
} from '@mui/material';
import { useFHIRResource } from '@/hooks/useFHIRResource';
import ProblemList from './ProblemList';
import MedicationList from './MedicationList';
import VitalSigns from './VitalSigns';

const ChartReviewTab = ({ patientId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const { resources, loading } = useFHIRResource('Bundle', {
    patient: patientId,
    _include: ['Condition', 'MedicationRequest', 'Observation']
  });

  if (loading) return <LoadingScreen />;

  return (
    <Box>
      <PatientHeader patient={patient} />
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
        <Tab label="Summary" />
        <Tab label="Problems" />
        <Tab label="Medications" />
        <Tab label="Vitals" />
        <Tab label="Notes" />
      </Tabs>
      
      <TabPanel value={activeTab} index={0}>
        <ChartSummary resources={resources} />
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <ProblemList conditions={resources.conditions} />
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        <MedicationList medications={resources.medications} />
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        <VitalSigns observations={resources.observations} />
      </TabPanel>
      <TabPanel value={activeTab} index={4}>
        <ClinicalNotes documents={resources.documents} />
      </TabPanel>
    </Box>
  );
};
```

### Problem List Component
```javascript
// components/clinical/ProblemList.jsx
const ProblemList = ({ conditions }) => {
  const [filter, setFilter] = useState('active');
  
  const filteredConditions = conditions.filter(c => 
    filter === 'all' || c.clinicalStatus?.coding?.[0]?.code === filter
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Problem List</Typography>
        <ToggleButtonGroup value={filter} onChange={(e, v) => setFilter(v)}>
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="resolved">Resolved</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
      <List>
        {filteredConditions.map(condition => (
          <ListItem key={condition.id}>
            <ListItemIcon>
              <ConditionIcon severity={condition.severity} />
            </ListItemIcon>
            <ListItemText
              primary={condition.code?.text}
              secondary={`Onset: ${formatDate(condition.onsetDateTime)}`}
            />
            <ListItemSecondaryAction>
              <IconButton onClick={() => handleEdit(condition)}>
                <EditIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};
```

## FHIR Resources

### Primary Resources Used
- **Patient**: Core patient demographics
- **Condition**: Problem list entries
- **MedicationRequest**: Current medications
- **Observation**: Vital signs and lab results
- **AllergyIntolerance**: Allergies and intolerances
- **Immunization**: Vaccination records
- **DocumentReference**: Clinical notes and reports

### Data Fetching
```javascript
// services/chartReviewService.js
export const fetchChartData = async (patientId) => {
  const bundle = await fhirClient.search('Bundle', {
    patient: patientId,
    _include: [
      'Condition:patient',
      'MedicationRequest:patient',
      'Observation:patient',
      'AllergyIntolerance:patient',
      'Immunization:patient',
      'DocumentReference:patient'
    ],
    _sort: '-date',
    _count: 100
  });
  
  return processBundle(bundle);
};

const processBundle = (bundle) => {
  const resources = {
    conditions: [],
    medications: [],
    observations: [],
    allergies: [],
    immunizations: [],
    documents: []
  };
  
  bundle.entry?.forEach(entry => {
    const resource = entry.resource;
    switch(resource.resourceType) {
      case 'Condition':
        resources.conditions.push(resource);
        break;
      case 'MedicationRequest':
        resources.medications.push(resource);
        break;
      // ... other resource types
    }
  });
  
  return resources;
};
```

## Clinical Workflows

### Problem List Management
```javascript
// Add new problem
const addProblem = async (problemData) => {
  const condition = {
    resourceType: 'Condition',
    subject: { reference: `Patient/${patientId}` },
    code: problemData.code,
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active'
      }]
    },
    onsetDateTime: problemData.onsetDate,
    recordedDate: new Date().toISOString()
  };
  
  const created = await fhirClient.create('Condition', condition);
  
  // Publish event
  publish(CLINICAL_EVENTS.PROBLEM_ADDED, {
    patientId,
    conditionId: created.id,
    code: problemData.code
  });
  
  return created;
};

// Resolve problem
const resolveProblem = async (conditionId) => {
  const condition = await fhirClient.read('Condition', conditionId);
  condition.clinicalStatus.coding[0].code = 'resolved';
  condition.abatementDateTime = new Date().toISOString();
  
  const updated = await fhirClient.update('Condition', conditionId, condition);
  
  publish(CLINICAL_EVENTS.PROBLEM_RESOLVED, {
    patientId,
    conditionId
  });
  
  return updated;
};
```

### Medication Reconciliation
```javascript
const reconcileMedications = async (patientId) => {
  // Get all medication sources
  const [current, historical, external] = await Promise.all([
    fetchCurrentMedications(patientId),
    fetchHistoricalMedications(patientId),
    fetchExternalMedications(patientId)
  ]);
  
  // Identify discrepancies
  const discrepancies = findDiscrepancies(current, historical, external);
  
  // Present for review
  return {
    current,
    historical,
    external,
    discrepancies,
    recommendations: generateRecommendations(discrepancies)
  };
};
```

## Vital Signs Display

### Graphical Trending
```javascript
// components/clinical/VitalSignsChart.jsx
import { Line } from 'react-chartjs-2';

const VitalSignsChart = ({ observations, vitalType }) => {
  const data = observations
    .filter(obs => obs.code.coding[0].code === vitalType)
    .map(obs => ({
      x: new Date(obs.effectiveDateTime),
      y: obs.valueQuantity.value
    }))
    .sort((a, b) => a.x - b.x);

  const chartData = {
    datasets: [{
      label: vitalType,
      data: data,
      borderColor: getVitalColor(vitalType),
      tension: 0.1
    }]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (context) => 
            `${context.parsed.y} ${getVitalUnit(vitalType)}`
        }
      }
    },
    scales: {
      x: { type: 'time' },
      y: { 
        title: { 
          display: true, 
          text: getVitalUnit(vitalType) 
        }
      }
    }
  };

  return <Line data={chartData} options={options} />;
};
```

## Security & Permissions

### Access Control
```javascript
const canViewChart = (user, patient) => {
  // Check if user has permission to view this patient's chart
  return (
    user.role === 'physician' ||
    user.role === 'nurse' ||
    (user.role === 'specialist' && hasConsultRequest(user, patient))
  );
};

const canEditProblemList = (user) => {
  return ['physician', 'nurse_practitioner'].includes(user.role);
};

const canAddNotes = (user) => {
  return ['physician', 'nurse', 'therapist'].includes(user.role);
};
```

### Audit Logging
```javascript
const logChartAccess = async (userId, patientId, action) => {
  await auditService.log({
    userId,
    patientId,
    action,
    module: 'chart-review',
    timestamp: new Date().toISOString(),
    details: {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    }
  });
};
```

## Performance Optimization

### Data Loading Strategy
```javascript
// Progressive loading for better performance
const useProgressiveChart = (patientId) => {
  const [criticalData, setCriticalData] = useState(null);
  const [fullData, setFullData] = useState(null);
  
  useEffect(() => {
    // Load critical data first
    fetchCriticalData(patientId).then(setCriticalData);
    
    // Then load full chart
    fetchFullChart(patientId).then(setFullData);
  }, [patientId]);
  
  return { criticalData, fullData };
};

const fetchCriticalData = async (patientId) => {
  // Only fetch most important data
  return await fhirClient.search('Bundle', {
    patient: patientId,
    _include: ['Condition:patient', 'AllergyIntolerance:patient'],
    'clinical-status': 'active',
    _count: 10
  });
};
```

### Caching Strategy
```javascript
// Cache chart data for quick access
const CACHE_KEY = `chart_${patientId}`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedChart = () => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }
  return null;
};
```

## Integration Points

### Event Publishing
```javascript
// Publish chart review events
publish(CLINICAL_EVENTS.CHART_VIEWED, { patientId, userId });
publish(CLINICAL_EVENTS.PROBLEM_UPDATED, { conditionId, changes });
publish(CLINICAL_EVENTS.NOTE_ADDED, { noteId, patientId });
```

### Event Subscriptions
```javascript
// Subscribe to relevant events
useEffect(() => {
  const unsubscribes = [
    subscribe(CLINICAL_EVENTS.LAB_RESULT_AVAILABLE, handleNewLabResult),
    subscribe(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, handleNewMedication),
    subscribe(CLINICAL_EVENTS.VITAL_RECORDED, handleNewVital)
  ];
  
  return () => unsubscribes.forEach(fn => fn());
}, []);
```

## Troubleshooting

### Common Issues

1. **Chart not loading**
   - Check patient ID is valid
   - Verify FHIR server connectivity
   - Check browser console for errors

2. **Missing data sections**
   - Verify resources exist for patient
   - Check search parameter indexing
   - Review included resource types

3. **Slow performance**
   - Enable progressive loading
   - Implement pagination
   - Use caching strategy

## Configuration

### Module Settings
```javascript
// config/chartReview.config.js
export const chartReviewConfig = {
  enabledSections: {
    problems: true,
    medications: true,
    vitals: true,
    notes: true,
    labs: true,
    imaging: true
  },
  defaultView: 'summary',
  vitalSigns: {
    displayCount: 10,
    trendingPeriod: '6months',
    criticalAlerts: true
  },
  medications: {
    showInactive: false,
    groupByClass: true
  }
};
```

## Testing

### Unit Tests
```javascript
describe('ChartReviewTab', () => {
  it('loads patient chart data', async () => {
    const { getByText } = render(
      <ChartReviewTab patientId="patient-123" />
    );
    
    await waitFor(() => {
      expect(getByText('Problem List')).toBeInTheDocument();
    });
  });
  
  it('filters active problems', () => {
    const problems = [
      { clinicalStatus: { coding: [{ code: 'active' }] } },
      { clinicalStatus: { coding: [{ code: 'resolved' }] } }
    ];
    
    const filtered = filterProblems(problems, 'active');
    expect(filtered).toHaveLength(1);
  });
});
```

---

Built with ❤️ for the healthcare community.