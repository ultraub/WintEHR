/**
 * Query Templates Component
 * 
 * Predefined query templates for common clinical scenarios
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
  Alert,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  LocalHospital as ClinicalIcon,
  Timeline as TimelineIcon,
  Assessment as QualityIcon,
  Medication as MedicationIcon,
  Warning as AlertIcon,
  FolderSpecial as CategoryIcon,
  Add as AddIcon,
  Code as CodeIcon,
  PlayArrow as RunIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon
} from '@mui/icons-material';

// Query template categories
const TEMPLATE_CATEGORIES = {
  clinical: {
    name: 'Clinical Care',
    icon: ClinicalIcon,
    color: '#4caf50',
    description: 'Patient care and clinical workflows'
  },
  quality: {
    name: 'Quality Measures',
    icon: QualityIcon,
    color: '#2196f3',
    description: 'Clinical quality and performance metrics'
  },
  population: {
    name: 'Population Health',
    icon: TimelineIcon,
    color: '#ff9800',
    description: 'Population management and analytics'
  },
  medication: {
    name: 'Medication Management',
    icon: MedicationIcon,
    color: '#9c27b0',
    description: 'Medication safety and adherence'
  },
  alerts: {
    name: 'Alerts & Reminders',
    icon: AlertIcon,
    color: '#f44336',
    description: 'Clinical alerts and care reminders'
  }
};

// Predefined query templates
const QUERY_TEMPLATES = [
  // Clinical Care Templates
  {
    id: 'diabetes-monitoring',
    category: 'clinical',
    name: 'Diabetes Monitoring',
    description: 'Find patients with diabetes and their recent A1C results',
    tags: ['diabetes', 'chronic-disease', 'lab-results'],
    query: {
      resourceType: 'Observation',
      searchParams: [
        { name: 'code', value: '4548-4', operator: '' }, // A1C
        { name: 'date', value: 'ge2024-01-01', operator: '' },
        { name: '_has', value: 'Condition:patient:code=44054006' } // Diabetes
      ],
      includes: ['Observation:patient'],
      sort: '-date'
    }
  },
  {
    id: 'hypertension-control',
    category: 'clinical',
    name: 'Hypertension Control',
    description: 'Patients with hypertension and recent blood pressure readings',
    tags: ['hypertension', 'vital-signs', 'chronic-disease'],
    query: {
      resourceType: 'Observation',
      searchParams: [
        { name: 'code', value: '85354-9', operator: '' }, // Blood pressure
        { name: 'date', value: 'ge2024-01-01', operator: '' },
        { name: '_has', value: 'Condition:patient:code=38341003' } // Hypertension
      ],
      compositeParams: [
        {
          name: 'component-code-value-quantity',
          values: ['8480-6', 'gt140'] // Systolic > 140
        }
      ]
    }
  },
  {
    id: 'preventive-care-due',
    category: 'clinical',
    name: 'Preventive Care Due',
    description: 'Patients due for preventive care screenings',
    tags: ['prevention', 'screening', 'wellness'],
    query: {
      resourceType: 'Patient',
      searchParams: [
        { name: 'birthdate', value: 'le1974-01-01', operator: '' }, // 50+ years old
        { name: '_has', value: 'Procedure:patient:code=73761001&date=le2023-01-01' } // Colonoscopy > 1 year ago
      ]
    }
  },

  // Quality Measures Templates
  {
    id: 'hba1c-control',
    category: 'quality',
    name: 'HbA1c < 8% (Quality Measure)',
    description: 'Diabetic patients with HbA1c under control',
    tags: ['quality-measure', 'diabetes', 'outcomes'],
    query: {
      resourceType: 'Observation',
      searchParams: [
        { name: 'code', value: '4548-4', operator: '' }, // A1C
        { name: 'value-quantity', value: 'lt8', operator: '' },
        { name: 'date', value: 'ge2024-01-01', operator: '' }
      ]
    }
  },
  {
    id: 'immunization-coverage',
    category: 'quality',
    name: 'Immunization Coverage',
    description: 'Patients with up-to-date immunizations',
    tags: ['quality-measure', 'immunizations', 'prevention'],
    query: {
      resourceType: 'Immunization',
      searchParams: [
        { name: 'date', value: 'ge2024-01-01', operator: '' },
        { name: 'status', value: 'completed', operator: '' }
      ],
      includes: ['Immunization:patient']
    }
  },

  // Population Health Templates
  {
    id: 'high-risk-patients',
    category: 'population',
    name: 'High-Risk Patient Registry',
    description: 'Patients with multiple chronic conditions',
    tags: ['population-health', 'risk-stratification', 'care-management'],
    query: {
      resourceType: 'Patient',
      searchParams: [
        { name: '_has', value: 'Condition:patient:clinical-status=active' }
      ],
      revIncludes: ['Condition:patient', 'MedicationRequest:patient']
    }
  },
  {
    id: 'ed-utilization',
    category: 'population',
    name: 'ED High Utilizers',
    description: 'Patients with frequent emergency department visits',
    tags: ['utilization', 'emergency', 'care-coordination'],
    query: {
      resourceType: 'Encounter',
      searchParams: [
        { name: 'class', value: 'EMER', operator: '' },
        { name: 'date', value: 'ge2024-01-01', operator: '' }
      ],
      includes: ['Encounter:patient'],
      count: 100
    }
  },

  // Medication Management Templates
  {
    id: 'polypharmacy',
    category: 'medication',
    name: 'Polypharmacy Review',
    description: 'Patients on 5+ active medications',
    tags: ['medication-safety', 'elderly', 'review'],
    query: {
      resourceType: 'MedicationRequest',
      searchParams: [
        { name: 'status', value: 'active', operator: '' }
      ],
      includes: ['MedicationRequest:patient', 'MedicationRequest:medication']
    }
  },
  {
    id: 'high-risk-meds',
    category: 'medication',
    name: 'High-Risk Medications',
    description: 'Patients on anticoagulants or high-alert medications',
    tags: ['medication-safety', 'anticoagulants', 'monitoring'],
    query: {
      resourceType: 'MedicationRequest',
      searchParams: [
        { name: 'code', value: '11289,5224', operator: ':text' }, // Warfarin codes
        { name: 'status', value: 'active', operator: '' }
      ]
    }
  },

  // Alerts & Reminders Templates
  {
    id: 'abnormal-labs',
    category: 'alerts',
    name: 'Critical Lab Values',
    description: 'Recent abnormal or critical lab results',
    tags: ['alerts', 'lab-results', 'critical-values'],
    query: {
      resourceType: 'Observation',
      searchParams: [
        { name: 'category', value: 'laboratory', operator: '' },
        { name: 'date', value: 'ge2024-01-01', operator: '' },
        { name: 'value-quantity', value: 'gt500|lt50', operator: '' } // Very high or low
      ],
      sort: '-date'
    }
  },
  {
    id: 'overdue-followup',
    category: 'alerts',
    name: 'Overdue Follow-ups',
    description: 'Patients with conditions requiring follow-up',
    tags: ['follow-up', 'care-gaps', 'reminders'],
    query: {
      resourceType: 'Condition',
      searchParams: [
        { name: 'clinical-status', value: 'active', operator: '' },
        { name: 'recorded-date', value: 'le2023-07-01', operator: '' } // > 6 months old
      ],
      includes: ['Condition:patient']
    }
  }
];

function QueryTemplates({ onLoadTemplate, onNavigate }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [bookmarkedTemplates, setBookmarkedTemplates] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = [...QUERY_TEMPLATES];
    
    if (selectedCategory) {
      templates = templates.filter(t => t.category === selectedCategory);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }
    
    return templates;
  }, [selectedCategory, searchTerm]);

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    return filteredTemplates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {});
  }, [filteredTemplates]);

  // Handle template selection
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setShowDetails(true);
  };

  // Handle load template
  const handleLoadTemplate = () => {
    if (selectedTemplate && onLoadTemplate) {
      onLoadTemplate(selectedTemplate.query);
      setShowDetails(false);
    }
  };

  // Toggle bookmark
  const toggleBookmark = (templateId) => {
    setBookmarkedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  // Copy template query
  const copyTemplateQuery = (template) => {
    const queryUrl = `/${template.query.resourceType}?${new URLSearchParams(
      template.query.searchParams.reduce((acc, param) => {
        acc[param.name + (param.operator || '')] = param.value;
        return acc;
      }, {})
    )}`;
    navigator.clipboard.writeText(queryUrl);
  };

  return (
    <Box>
      {/* Header and Filters */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              label="Category"
            >
              <MenuItem value="">All Categories</MenuItem>
              {Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <category.icon sx={{ fontSize: 20, color: category.color }} />
                    <Typography>{category.name}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            Create Template
          </Button>
        </Stack>
      </Box>

      {/* Template Grid */}
      {Object.entries(groupedTemplates).map(([category, templates]) => (
        <Box key={category} sx={{ mb: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ bgcolor: TEMPLATE_CATEGORIES[category].color, width: 32, height: 32 }}>
              <TEMPLATE_CATEGORIES[category].icon sx={{ fontSize: 20 }} />
            </Avatar>
            <Box>
              <Typography variant="h6">{TEMPLATE_CATEGORIES[category].name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {TEMPLATE_CATEGORIES[category].description}
              </Typography>
            </Box>
          </Stack>

          <Grid container spacing={2}>
            {templates.map((template) => (
              <Grid item xs={12} md={6} lg={4} key={template.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': { boxShadow: 3 }
                  }}
                >
                  <CardHeader
                    title={template.name}
                    action={
                      <IconButton
                        onClick={() => toggleBookmark(template.id)}
                        size="small"
                      >
                        {bookmarkedTemplates.includes(template.id) ? 
                          <BookmarkIcon color="primary" /> : 
                          <BookmarkBorderIcon />
                        }
                      </IconButton>
                    }
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {template.description}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {template.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" sx={{ mb: 0.5 }} />
                      ))}
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<CodeIcon />}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      View Details
                    </Button>
                    <Button
                      size="small"
                      startIcon={<RunIcon />}
                      onClick={() => onLoadTemplate && onLoadTemplate(template.query)}
                      color="primary"
                    >
                      Use Template
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => copyTemplateQuery(template)}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* Template Details Dialog */}
      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate?.name}
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="body1" paragraph>
                {selectedTemplate.description}
              </Typography>
              
              <Typography variant="h6" gutterBottom>Query Details</Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                  {JSON.stringify(selectedTemplate.query, null, 2)}
                </Typography>
              </Paper>

              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>Tags</Typography>
                <Stack direction="row" spacing={1}>
                  {selectedTemplate.tags.map((tag) => (
                    <Chip key={tag} label={tag} />
                  ))}
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
          <Button onClick={handleLoadTemplate} variant="contained" startIcon={<RunIcon />}>
            Use This Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Template Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null);
          // Navigate to template creation
        }}>
          Create from Current Query
        </MenuItem>
        <MenuItem onClick={() => {
          setAnchorEl(null);
          // Navigate to template import
        }}>
          Import Template
        </MenuItem>
      </Menu>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Alert severity="info">
          No templates found matching your criteria. Try adjusting your filters.
        </Alert>
      )}
    </Box>
  );
}

export default QueryTemplates;