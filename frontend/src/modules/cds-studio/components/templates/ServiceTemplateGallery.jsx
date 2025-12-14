/**
 * Service Template Gallery
 *
 * Pre-built CDS service templates for rapid deployment.
 * Provides 5+ ready-to-use clinical decision support templates
 * covering common clinical scenarios.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Visibility as PreviewIcon,
  FileCopy as CopyIcon
} from '@mui/icons-material';

import { SERVICE_TYPES } from '../../types/serviceTypes';
import { createDefaultDisplayBehavior } from '../../types/displayModes';

/**
 * Pre-built service templates
 */
const SERVICE_TEMPLATES = {
  DIABETES_SCREENING: {
    id: 'diabetes-screening',
    name: 'Diabetes Screening Reminder',
    description: 'Identify patients overdue for diabetes screening based on age and risk factors',
    icon: '🩺',
    category: 'Preventive Care',
    difficulty: 'Beginner',

    serviceConfig: {
      type: 'preventive-care',
      hook: 'patient-view',
      title: 'Diabetes Screening Reminder',
      description: 'Reminds clinicians when patients are due for diabetes screening',

      conditions: [{
        type: 'group',
        operator: 'AND',
        conditions: [
          {
            type: 'condition',
            dataSource: 'patient.age',
            operator: '>=',
            value: 35
          },
          {
            type: 'condition',
            dataSource: 'screening.gap',
            operator: 'olderThanDays',
            value: 1095  // 3 years
          }
        ]
      }],

      card: {
        summary: 'Patient due for diabetes screening',
        detail: 'Patient is 35+ years old and has not had diabetes screening in the past 3 years. Current guidelines recommend screening every 3 years for adults.',
        indicator: 'info',
        source: {
          label: 'USPSTF Diabetes Screening Guidelines',
          url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes'
        },
        suggestions: [
          {
            label: 'Order HbA1c test',
            isRecommended: true,
            actions: [
              {
                type: 'create',
                description: 'Order HbA1c lab test',
                resource: {
                  resourceType: 'ServiceRequest',
                  code: { text: 'Hemoglobin A1c' },
                  intent: 'order'
                }
              }
            ]
          }
        ],
        links: [
          {
            label: 'Screening Guidelines',
            url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes',
            type: 'absolute'
          }
        ]
      },

      displayConfig: createDefaultDisplayBehavior('info')
    },

    useCase: 'Preventive care reminders for chronic disease screening',
    estimatedSetupTime: '5 minutes',
    requiredDataSources: ['Patient demographics', 'Lab results'],
    benefits: [
      'Improves screening rates',
      'Reduces diabetes complications',
      'Supports preventive care measures',
      'Meets quality metrics'
    ]
  },

  DRUG_INTERACTION: {
    id: 'drug-interaction',
    name: 'Drug Interaction Alert',
    description: 'Warn clinicians about potential drug-drug interactions during prescribing',
    icon: '💊',
    category: 'Medication Safety',
    difficulty: 'Intermediate',

    serviceConfig: {
      type: 'medication-based',
      hook: 'medication-prescribe',
      title: 'Drug Interaction Alert',
      description: 'Checks for dangerous drug-drug interactions',

      conditions: [{
        type: 'group',
        operator: 'AND',
        conditions: [
          {
            type: 'condition',
            dataSource: 'medications',
            operator: 'exists',
            catalogSelection: null
          }
        ]
      }],

      card: {
        summary: 'Potential drug interaction detected',
        detail: 'The prescribed medication may interact with existing medications. Review the interaction severity and consider alternatives.',
        indicator: 'warning',
        source: {
          label: 'Drug Interaction Database',
          url: 'https://www.nlm.nih.gov/research/umls/rxnorm/'
        },
        suggestions: [
          {
            label: 'Review interaction details',
            isRecommended: true,
            actions: []
          },
          {
            label: 'Select alternative medication',
            isRecommended: false,
            actions: []
          }
        ],
        links: [
          {
            label: 'Drug Interaction Checker',
            url: 'https://www.drugs.com/drug_interactions.html',
            type: 'absolute'
          }
        ]
      },

      displayConfig: {
        ...createDefaultDisplayBehavior('warning'),
        presentationMode: 'popup',
        acknowledgmentRequired: true,
        reasonRequired: true
      }
    },

    useCase: 'Medication safety checks during e-prescribing',
    estimatedSetupTime: '10 minutes',
    requiredDataSources: ['Active medications', 'Drug interaction database'],
    benefits: [
      'Prevents adverse drug events',
      'Improves patient safety',
      'Reduces medication errors',
      'Meets safety standards'
    ]
  },

  HYPERTENSION_MANAGEMENT: {
    id: 'hypertension-management',
    name: 'Hypertension Management',
    description: 'Alert on elevated blood pressure readings requiring intervention',
    icon: '❤️',
    category: 'Chronic Disease',
    difficulty: 'Beginner',

    serviceConfig: {
      type: 'condition-based',
      hook: 'patient-view',
      title: 'Hypertension Management Alert',
      description: 'Identifies patients with elevated BP requiring management',

      conditions: [{
        type: 'group',
        operator: 'OR',
        conditions: [
          {
            type: 'condition',
            dataSource: 'vital.value',
            operator: '>=',
            value: 140,
            catalogSelection: { code: '8480-6', display: 'Systolic BP' }
          },
          {
            type: 'condition',
            dataSource: 'vital.value',
            operator: '>=',
            value: 90,
            catalogSelection: { code: '8462-4', display: 'Diastolic BP' }
          }
        ]
      }],

      card: {
        summary: 'Elevated blood pressure detected',
        detail: 'Patient has elevated blood pressure (≥140/90 mmHg). Consider lifestyle modifications, medication adjustment, or initiation of antihypertensive therapy.',
        indicator: 'warning',
        source: {
          label: 'ACC/AHA Hypertension Guidelines',
          url: 'https://www.acc.org/guidelines/hypertension'
        },
        suggestions: [
          {
            label: 'Review BP medication',
            isRecommended: true,
            actions: []
          },
          {
            label: 'Order follow-up BP check',
            isRecommended: false,
            actions: [
              {
                type: 'create',
                description: 'Schedule BP recheck',
                resource: {
                  resourceType: 'Task',
                  description: 'Recheck blood pressure in 2 weeks'
                }
              }
            ]
          }
        ],
        links: [
          {
            label: 'HTN Guidelines',
            url: 'https://www.acc.org/guidelines/hypertension',
            type: 'absolute'
          }
        ]
      },

      displayConfig: createDefaultDisplayBehavior('warning')
    },

    useCase: 'Chronic disease management and vital sign monitoring',
    estimatedSetupTime: '5 minutes',
    requiredDataSources: ['Vital signs', 'Active medications'],
    benefits: [
      'Improves BP control rates',
      'Reduces cardiovascular events',
      'Supports treatment adherence',
      'Meets quality measures'
    ]
  },

  LAB_RESULT_FOLLOWUP: {
    id: 'lab-result-followup',
    name: 'Critical Lab Result Follow-up',
    description: 'Ensure critical lab results are acknowledged and acted upon',
    icon: '🔬',
    category: 'Results Management',
    difficulty: 'Advanced',

    serviceConfig: {
      type: 'lab-value-based',
      hook: 'patient-view',
      title: 'Critical Lab Result Follow-up',
      description: 'Alerts on unacknowledged critical lab values',

      conditions: [{
        type: 'group',
        operator: 'AND',
        conditions: [
          {
            type: 'condition',
            dataSource: 'lab.value',
            operator: 'exists'
          }
        ]
      }],

      card: {
        summary: 'Unacknowledged critical lab result',
        detail: 'Patient has a critical lab result that requires immediate attention and documentation of clinical response.',
        indicator: 'critical',
        source: {
          label: 'Critical Value Reporting Policy',
          url: ''
        },
        suggestions: [
          {
            label: 'Acknowledge and document',
            isRecommended: true,
            actions: [
              {
                type: 'update',
                description: 'Add acknowledgment note',
                resourceId: 'Observation/[id]'
              }
            ]
          },
          {
            label: 'Order follow-up test',
            isRecommended: false,
            actions: [
              {
                type: 'create',
                description: 'Order confirmatory test',
                resource: {
                  resourceType: 'ServiceRequest',
                  intent: 'order'
                }
              }
            ]
          }
        ],
        links: []
      },

      displayConfig: {
        ...createDefaultDisplayBehavior('critical'),
        presentationMode: 'modal',
        acknowledgmentRequired: true,
        reasonRequired: false,
        backdrop: 'static'
      }
    },

    useCase: 'Critical value management and patient safety',
    estimatedSetupTime: '15 minutes',
    requiredDataSources: ['Lab results', 'Critical value thresholds'],
    benefits: [
      'Prevents missed critical results',
      'Improves patient safety',
      'Ensures timely interventions',
      'Meets Joint Commission requirements'
    ]
  },

  ELDERLY_MEDICATION_SAFETY: {
    id: 'elderly-medication-safety',
    name: 'Elderly Medication Safety (Beers Criteria)',
    description: 'Identify potentially inappropriate medications in elderly patients',
    icon: '👴',
    category: 'Geriatric Care',
    difficulty: 'Intermediate',

    serviceConfig: {
      type: 'risk-assessment',
      hook: 'medication-prescribe',
      title: 'Elderly Medication Safety Check',
      description: 'Screens for inappropriate medications in patients 65+',

      conditions: [{
        type: 'group',
        operator: 'AND',
        conditions: [
          {
            type: 'condition',
            dataSource: 'patient.age',
            operator: '>=',
            value: 65
          },
          {
            type: 'condition',
            dataSource: 'medications',
            operator: 'exists'
          }
        ]
      }],

      card: {
        summary: 'Potentially inappropriate medication for elderly patient',
        detail: 'This medication appears on the Beers Criteria list of potentially inappropriate medications for patients 65 years and older. Consider alternatives or document clinical rationale.',
        indicator: 'warning',
        source: {
          label: 'AGS Beers Criteria',
          url: 'https://www.americangeriatrics.org/programs/beers-criteria'
        },
        suggestions: [
          {
            label: 'Review alternative medications',
            isRecommended: true,
            actions: []
          },
          {
            label: 'Document clinical rationale',
            isRecommended: false,
            actions: []
          }
        ],
        links: [
          {
            label: 'Beers Criteria Reference',
            url: 'https://www.americangeriatrics.org/programs/beers-criteria',
            type: 'absolute'
          }
        ]
      },

      displayConfig: {
        ...createDefaultDisplayBehavior('warning'),
        presentationMode: 'popup',
        reasonRequired: true
      }
    },

    useCase: 'Geriatric medication safety and prescribing guidance',
    estimatedSetupTime: '10 minutes',
    requiredDataSources: ['Patient age', 'Active medications', 'Beers Criteria list'],
    benefits: [
      'Reduces adverse drug events',
      'Improves geriatric care quality',
      'Prevents medication-related harm',
      'Supports age-appropriate prescribing'
    ]
  }
};

/**
 * Template Preview Dialog
 */
const TemplatePreviewDialog = ({ template, open, onClose, onUse }) => {
  if (!template) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h5">{template.icon}</Typography>
          <Typography variant="h6">{template.name}</Typography>
          <Chip label={template.difficulty} size="small" color="primary" />
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ marginLeft: 'auto' }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Description */}
          <Box>
            <Typography variant="body1" gutterBottom>
              {template.description}
            </Typography>
            <Chip label={template.category} size="small" />
          </Box>

          {/* Use Case */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Use Case
            </Typography>
            <Typography variant="body2">{template.useCase}</Typography>
          </Box>

          {/* Setup Information */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Estimated Setup Time
                </Typography>
                <Typography variant="h6">{template.estimatedSetupTime}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Difficulty Level
                </Typography>
                <Typography variant="h6">{template.difficulty}</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Required Data Sources */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Required Data Sources
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {template.requiredDataSources.map((source, index) => (
                <Chip key={index} label={source} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>

          {/* Benefits */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Benefits
            </Typography>
            <List dense>
              {template.benefits.map((benefit, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={benefit} />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Configuration Preview */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="subtitle2">Configuration Preview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box component="pre" sx={{ fontSize: '0.75rem', overflow: 'auto' }}>
                {JSON.stringify(template.serviceConfig, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onUse(template)}
          startIcon={<CopyIcon />}
        >
          Use This Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Template Card Component
 */
const TemplateCard = ({ template, onPreview, onUse }) => {
  const difficultyColors = {
    Beginner: 'success',
    Intermediate: 'warning',
    Advanced: 'error'
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={2}>
          {/* Icon and Title */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Typography variant="h3">{template.icon}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                {template.name}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={template.category} size="small" />
                <Chip
                  label={template.difficulty}
                  size="small"
                  color={difficultyColors[template.difficulty]}
                />
              </Stack>
            </Box>
          </Stack>

          {/* Description */}
          <Typography variant="body2" color="text.secondary">
            {template.description}
          </Typography>

          {/* Quick Stats */}
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Setup time: {template.estimatedSetupTime}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {template.requiredDataSources.length} data sources required
            </Typography>
          </Box>

          {/* Benefits Preview */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Key benefits:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {template.benefits.slice(0, 2).map((benefit, index) => (
                <Typography key={index} component="li" variant="caption">
                  {benefit}
                </Typography>
              ))}
              {template.benefits.length > 2 && (
                <Typography component="li" variant="caption" color="text.secondary">
                  +{template.benefits.length - 2} more
                </Typography>
              )}
            </Box>
          </Box>
        </Stack>
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<PreviewIcon />} onClick={() => onPreview(template)}>
          Preview
        </Button>
        <Button size="small" variant="contained" onClick={() => onUse(template)}>
          Use Template
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * Main Service Template Gallery Component
 */
const ServiceTemplateGallery = ({ onTemplateSelect }) => {
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = [
    'all',
    ...new Set(Object.values(SERVICE_TEMPLATES).map(t => t.category))
  ];

  const filteredTemplates = Object.values(SERVICE_TEMPLATES).filter(
    template => categoryFilter === 'all' || template.category === categoryFilter
  );

  const handleUseTemplate = (template) => {
    setPreviewTemplate(null);
    onTemplateSelect(template.serviceConfig);
  };

  return (
    <Box>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Service Template Gallery
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start with a pre-built template and customize to your needs
          </Typography>
        </Box>

        {/* Info Alert */}
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="body2">
            These templates provide complete, ready-to-deploy CDS services. Select a template to automatically
            configure conditions, card design, and display settings.
          </Typography>
        </Alert>

        {/* Category Filter */}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {categories.map((category) => (
            <Chip
              key={category}
              label={category === 'all' ? 'All Templates' : category}
              onClick={() => setCategoryFilter(category)}
              color={categoryFilter === category ? 'primary' : 'default'}
              variant={categoryFilter === category ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>

        {/* Templates Grid */}
        <Grid container spacing={3}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} md={6} key={template.id}>
              <TemplateCard
                template={template}
                onPreview={setPreviewTemplate}
                onUse={handleUseTemplate}
              />
            </Grid>
          ))}
        </Grid>

        {/* No Results */}
        {filteredTemplates.length === 0 && (
          <Alert severity="info">
            No templates found for the selected category.
          </Alert>
        )}
      </Stack>

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        template={previewTemplate}
        open={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        onUse={handleUseTemplate}
      />
    </Box>
  );
};

export default ServiceTemplateGallery;
export { SERVICE_TEMPLATES };
