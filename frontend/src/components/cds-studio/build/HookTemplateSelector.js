/**
 * Hook Template Selector - Pre-built hook templates for common scenarios
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  LocalHospital as ClinicalIcon,
  Science as LabIcon,
  Medication as MedIcon,
  Warning as SafetyIcon,
  Assignment as ComplianceIcon,
  TrendingUp as QualityIcon
} from '@mui/icons-material';

// Hook templates organized by category
const HOOK_TEMPLATES = {
  clinical: {
    label: 'Clinical Guidelines',
    icon: <ClinicalIcon />,
    color: '#2196F3',
    templates: [
      {
        id: 'diabetes-management',
        title: 'Diabetes Management Alert',
        description: 'Monitor HbA1c levels and suggest interventions for diabetic patients',
        hook: 'patient-view',
        conditions: [
          { field: 'has_condition', operator: 'contains', value: 'Diabetes' },
          { field: 'hba1c', operator: '>', value: '7' }
        ],
        cards: [{
          summary: 'Elevated HbA1c - Intervention Needed',
          detail: 'Patient\'s HbA1c is above target. Consider medication adjustment or lifestyle counseling.',
          indicator: 'warning',
          source: { label: 'ADA Guidelines' }
        }]
      },
      {
        id: 'hypertension-control',
        title: 'Hypertension Control',
        description: 'Alert for uncontrolled blood pressure readings',
        hook: 'patient-view',
        conditions: [
          { field: 'blood_pressure_systolic', operator: '>=', value: '140' }
        ],
        cards: [{
          summary: 'Elevated Blood Pressure',
          detail: 'Consider medication adjustment or lifestyle modifications.',
          indicator: 'warning'
        }]
      }
    ]
  },
  safety: {
    label: 'Medication Safety',
    icon: <SafetyIcon />,
    color: '#F44336',
    templates: [
      {
        id: 'drug-interaction',
        title: 'Drug Interaction Check',
        description: 'Alert for potential drug interactions when prescribing',
        hook: 'medication-prescribe',
        conditions: [
          { field: 'drug_interaction', operator: '=', value: true }
        ],
        cards: [{
          summary: 'Potential Drug Interaction Detected',
          detail: 'Review medication list for potential interactions.',
          indicator: 'critical',
          source: { label: 'Drug Interaction Database' }
        }]
      },
      {
        id: 'allergy-alert',
        title: 'Allergy Alert',
        description: 'Warn about medication allergies',
        hook: 'medication-prescribe',
        conditions: [
          { field: 'allergy', operator: 'contains', value: '{{context.medication}}' }
        ],
        cards: [{
          summary: 'Allergy Alert',
          detail: 'Patient has documented allergy to this medication class.',
          indicator: 'critical'
        }]
      }
    ]
  },
  laboratory: {
    label: 'Lab Results',
    icon: <LabIcon />,
    color: '#4CAF50',
    templates: [
      {
        id: 'critical-lab',
        title: 'Critical Lab Value',
        description: 'Alert for critical laboratory results',
        hook: 'patient-view',
        conditions: [
          { field: 'lab_result', operator: '>', value: 'critical_high' }
        ],
        cards: [{
          summary: 'Critical Lab Result',
          detail: 'Immediate action required for critical lab value.',
          indicator: 'critical'
        }]
      },
      {
        id: 'kidney-function',
        title: 'Kidney Function Alert',
        description: 'Monitor creatinine levels for kidney disease',
        hook: 'patient-view',
        conditions: [
          { field: 'creatinine', operator: '>', value: '1.5' }
        ],
        cards: [{
          summary: 'Elevated Creatinine',
          detail: 'Consider medication dose adjustment for renal function.',
          indicator: 'warning'
        }]
      }
    ]
  },
  preventive: {
    label: 'Preventive Care',
    icon: <ComplianceIcon />,
    color: '#FF9800',
    templates: [
      {
        id: 'screening-due',
        title: 'Screening Reminder',
        description: 'Remind about due preventive screenings',
        hook: 'patient-view',
        conditions: [
          { field: 'age', operator: '>=', value: '50' },
          { field: 'days_since', operator: '>', value: '365' }
        ],
        cards: [{
          summary: 'Preventive Screening Due',
          detail: 'Patient is due for age-appropriate screening.',
          indicator: 'info',
          suggestions: [{ label: 'Order Screening', type: 'create' }]
        }]
      },
      {
        id: 'immunization-due',
        title: 'Immunization Reminder',
        description: 'Alert for due immunizations',
        hook: 'patient-view',
        conditions: [
          { field: 'days_since', operator: '>', value: '365' }
        ],
        cards: [{
          summary: 'Immunization Due',
          detail: 'Review immunization schedule.',
          indicator: 'info'
        }]
      }
    ]
  },
  quality: {
    label: 'Quality Measures',
    icon: <QualityIcon />,
    color: '#9C27B0',
    templates: [
      {
        id: 'care-gap',
        title: 'Care Gap Alert',
        description: 'Identify and close care gaps',
        hook: 'patient-view',
        conditions: [
          { field: 'has_condition', operator: 'contains', value: 'Chronic' }
        ],
        cards: [{
          summary: 'Care Gap Identified',
          detail: 'Patient has not received recommended care for chronic condition.',
          indicator: 'warning',
          suggestions: [{ label: 'Schedule Follow-up', type: 'create' }]
        }]
      }
    ]
  }
};

const HookTemplateSelector = ({ onSelectTemplate, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const filterTemplates = (templates) => {
    if (!searchTerm) return templates;
    
    const term = searchTerm.toLowerCase();
    return templates.filter(template => 
      template.title.toLowerCase().includes(term) ||
      template.description.toLowerCase().includes(term)
    );
  };

  const handleSelectTemplate = (template) => {
    // Create a copy with generated IDs for conditions and cards
    const templateCopy = {
      ...template,
      conditions: template.conditions.map(c => ({
        ...c,
        id: `${Date.now()}-${Math.random()}`
      })),
      cards: template.cards.map(c => ({
        ...c,
        id: `${Date.now()}-${Math.random()}`
      }))
    };
    onSelectTemplate(templateCopy);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Select a Template</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        placeholder="Search templates..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />

      {/* Category Chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
        <Chip
          label="All"
          onClick={() => setSelectedCategory(null)}
          color={selectedCategory === null ? 'primary' : 'default'}
        />
        {Object.entries(HOOK_TEMPLATES).map(([key, category]) => (
          <Chip
            key={key}
            icon={category.icon}
            label={category.label}
            onClick={() => setSelectedCategory(key)}
            color={selectedCategory === key ? 'primary' : 'default'}
          />
        ))}
      </Stack>

      {/* Templates Grid */}
      <Grid container spacing={2}>
        {Object.entries(HOOK_TEMPLATES)
          .filter(([key]) => !selectedCategory || selectedCategory === key)
          .map(([categoryKey, category]) => 
            filterTemplates(category.templates).map(template => (
              <Grid item xs={12} md={6} key={template.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box color={category.color}>
                        {category.icon}
                      </Box>
                      <Typography variant="h6">
                        {template.title}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {template.description}
                    </Typography>
                    
                    <Stack direction="row" spacing={1}>
                      <Chip label={template.hook} size="small" />
                      <Chip label={`${template.conditions.length} conditions`} size="small" />
                      <Chip label={`${template.cards.length} cards`} size="small" />
                    </Stack>
                  </CardContent>
                  
                  <CardActions>
                    <Button 
                      size="small" 
                      onClick={() => handleSelectTemplate(template)}
                    >
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
      </Grid>

      {Object.values(HOOK_TEMPLATES).every(cat => filterTemplates(cat.templates).length === 0) && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary">
            No templates found matching "{searchTerm}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HookTemplateSelector;