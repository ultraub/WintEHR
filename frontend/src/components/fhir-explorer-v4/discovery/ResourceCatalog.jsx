/**
 * Resource Catalog Component for FHIR Explorer v4
 * 
 * Visual interface for browsing and exploring FHIR resource types with:
 * - Interactive resource cards with real data counts
 * - Search and filtering capabilities
 * - Quick preview and navigation to queries
 * - Resource relationship indicators
 * - Progressive disclosure of complexity
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  TextField,
  Button,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Badge,
  LinearProgress,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  AlertTitle,
  Fade,
  Zoom,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ViewModule as CardViewIcon,
  ViewList as ListViewIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Info as InfoIcon,
  PlayArrow as PlayIcon,
  Visibility as VisibilityIcon,
  TrendingUp as TrendingUpIcon,
  AccountTree as RelationshipIcon,
  Speed as SpeedIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Launch as LaunchIcon,
  People as PeopleIcon,
  Science as ScienceIcon,
  Medication as MedicationIcon,
  LocalHospital as HospitalIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Security as SecurityIcon,
  Description as DocumentIcon,
  MoreVert as MoreIcon,
  Help as HelpIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

// Import hooks
import { useFHIRData } from '../hooks/useFHIRData';
import { useUserPreferences } from '../hooks/useUserPreferences';

// Import mode constants
import { APP_MODES, QUERY_VIEWS } from '../constants/appConstants';

// Comprehensive FHIR resource catalog with metadata
const FHIR_RESOURCES = {
  // Core Clinical Resources
  Patient: {
    category: 'clinical',
    difficulty: 'beginner',
    icon: <PeopleIcon />,
    color: '#2196f3',
    description: 'Individuals receiving healthcare services',
    keyFields: ['name', 'birthDate', 'gender', 'address', 'identifier'],
    searchParams: ['name', 'family', 'given', 'identifier', 'birthdate', 'gender'],
    relationships: ['Observation', 'Condition', 'MedicationRequest', 'Encounter'],
    useCase: 'Patient demographics and basic information',
    examples: ['Find patient by name', 'Search by identifier', 'Demographics lookup']
  },
  Practitioner: {
    category: 'clinical',
    difficulty: 'beginner',
    icon: <PeopleIcon />,
    color: '#3f51b5',
    description: 'Healthcare service providers',
    keyFields: ['name', 'qualification', 'specialty', 'telecom'],
    searchParams: ['name', 'identifier', 'specialty', 'qualification'],
    relationships: ['PractitionerRole', 'Encounter', 'MedicationRequest'],
    useCase: 'Provider directory and credentials',
    examples: ['Find doctor by specialty', 'Provider contact info', 'Qualification lookup']
  },
  
  // Observations and Diagnostics
  Observation: {
    category: 'diagnostics',
    difficulty: 'intermediate',
    icon: <ScienceIcon />,
    color: '#4caf50',
    description: 'Measurements and simple assertions made about a patient',
    keyFields: ['code', 'value', 'subject', 'effectiveDateTime', 'category'],
    searchParams: ['code', 'category', 'date', 'patient', 'value-quantity'],
    relationships: ['Patient', 'Encounter', 'DiagnosticReport', 'ServiceRequest'],
    useCase: 'Lab results, vital signs, assessments',
    examples: ['Recent lab results', 'Vital signs trends', 'Specific test values']
  },
  DiagnosticReport: {
    category: 'diagnostics',
    difficulty: 'intermediate',
    icon: <AssessmentIcon />,
    color: '#607d8b',
    description: 'Clinical reports containing observations and interpretations',
    keyFields: ['code', 'subject', 'effectiveDateTime', 'result', 'conclusion'],
    searchParams: ['code', 'date', 'patient', 'category', 'status'],
    relationships: ['Patient', 'Observation', 'Encounter', 'Practitioner'],
    useCase: 'Lab panels, imaging reports, pathology',
    examples: ['Complete blood count', 'Radiology reports', 'Pathology results']
  },
  
  // Conditions and Problems
  Condition: {
    category: 'clinical',
    difficulty: 'intermediate',
    icon: <AssessmentIcon />,
    color: '#f44336',
    description: 'Health conditions, problems, and diagnoses',
    keyFields: ['code', 'subject', 'onsetDateTime', 'clinicalStatus', 'severity'],
    searchParams: ['code', 'clinical-status', 'patient', 'onset-date', 'severity'],
    relationships: ['Patient', 'Encounter', 'Procedure', 'MedicationRequest'],
    useCase: 'Diagnoses, problems list, conditions',
    examples: ['Active conditions', 'Chronic diseases', 'Problem list']
  },
  
  // Medications
  MedicationRequest: {
    category: 'medications',
    difficulty: 'intermediate',
    icon: <MedicationIcon />,
    color: '#ff9800',
    description: 'Orders for medications to be dispensed',
    keyFields: ['medication', 'subject', 'authoredOn', 'requester', 'dosageInstruction'],
    searchParams: ['medication', 'patient', 'status', 'intent', 'authoredon'],
    relationships: ['Patient', 'Practitioner', 'MedicationDispense', 'Medication'],
    useCase: 'Prescriptions, medication orders',
    examples: ['Active prescriptions', 'Medication history', 'Prescriber lookup']
  },
  MedicationDispense: {
    category: 'medications',
    difficulty: 'advanced',
    icon: <MedicationIcon />,
    color: '#ff5722',
    description: 'Dispensing of medications by pharmacy',
    keyFields: ['medication', 'subject', 'whenHandedOver', 'quantity', 'performer'],
    searchParams: ['medication', 'patient', 'status', 'whenhandedover', 'performer'],
    relationships: ['Patient', 'MedicationRequest', 'Practitioner', 'Organization'],
    useCase: 'Pharmacy dispensing, medication adherence',
    examples: ['Dispensed medications', 'Pharmacy records', 'Compliance tracking']
  },
  
  // Encounters and Care
  Encounter: {
    category: 'clinical',
    difficulty: 'intermediate',
    icon: <HospitalIcon />,
    color: '#9c27b0',
    description: 'Healthcare visits and episodes of care',
    keyFields: ['status', 'class', 'subject', 'period', 'serviceProvider'],
    searchParams: ['patient', 'date', 'status', 'class', 'service-provider'],
    relationships: ['Patient', 'Practitioner', 'Organization', 'Observation', 'Procedure'],
    useCase: 'Visits, hospitalizations, appointments',
    examples: ['Recent visits', 'Hospital stays', 'Outpatient encounters']
  },
  
  // Procedures and Interventions
  Procedure: {
    category: 'clinical',
    difficulty: 'intermediate',
    icon: <HospitalIcon />,
    color: '#795548',
    description: 'Medical procedures and interventions performed',
    keyFields: ['code', 'subject', 'performedDateTime', 'performer', 'outcome'],
    searchParams: ['code', 'patient', 'date', 'performer', 'status'],
    relationships: ['Patient', 'Encounter', 'Practitioner', 'Condition'],
    useCase: 'Surgeries, treatments, interventions',
    examples: ['Surgical procedures', 'Treatment history', 'Interventions']
  },
  
  // Administrative
  Organization: {
    category: 'administrative',
    difficulty: 'beginner',
    icon: <BusinessIcon />,
    color: '#607d8b',
    description: 'Healthcare organizations and facilities',
    keyFields: ['name', 'identifier', 'type', 'telecom', 'address'],
    searchParams: ['name', 'identifier', 'type', 'address'],
    relationships: ['Practitioner', 'PractitionerRole', 'Location', 'Encounter'],
    useCase: 'Hospitals, clinics, departments',
    examples: ['Hospital lookup', 'Clinic directory', 'Department info']
  },
  Location: {
    category: 'administrative',
    difficulty: 'beginner',
    icon: <LocationIcon />,
    color: '#795548',
    description: 'Physical locations where care is provided',
    keyFields: ['name', 'description', 'type', 'address', 'managingOrganization'],
    searchParams: ['name', 'address', 'type', 'organization'],
    relationships: ['Organization', 'Encounter', 'PractitionerRole'],
    useCase: 'Rooms, buildings, facilities',
    examples: ['Room assignments', 'Facility lookup', 'Location directory']
  },
  
  // Workflow and Requests
  ServiceRequest: {
    category: 'workflow',
    difficulty: 'advanced',
    icon: <AssessmentIcon />,
    color: '#3f51b5',
    description: 'Requests for healthcare services',
    keyFields: ['code', 'subject', 'authoredOn', 'requester', 'intent'],
    searchParams: ['code', 'patient', 'authored', 'requester', 'status'],
    relationships: ['Patient', 'Practitioner', 'Observation', 'DiagnosticReport'],
    useCase: 'Lab orders, referrals, service requests',
    examples: ['Lab orders', 'Radiology requests', 'Referrals']
  },
  
  // Documents
  DocumentReference: {
    category: 'documents',
    difficulty: 'advanced',
    icon: <DocumentIcon />,
    color: '#607d8b',
    description: 'References to clinical documents',
    keyFields: ['type', 'subject', 'date', 'author', 'content'],
    searchParams: ['type', 'patient', 'date', 'author', 'format'],
    relationships: ['Patient', 'Practitioner', 'Encounter'],
    useCase: 'Clinical notes, reports, images',
    examples: ['Progress notes', 'Discharge summaries', 'Clinical images']
  }
};

// Resource categories with colors and descriptions
const RESOURCE_CATEGORIES = {
  clinical: {
    label: 'Clinical',
    color: '#2196f3',
    description: 'Core clinical resources for patient care',
    icon: <HospitalIcon />
  },
  diagnostics: {
    label: 'Diagnostics',
    color: '#4caf50',
    description: 'Observations, tests, and diagnostic reports',
    icon: <ScienceIcon />
  },
  medications: {
    label: 'Medications',
    color: '#ff9800',
    description: 'Medication management and pharmacy',
    icon: <MedicationIcon />
  },
  administrative: {
    label: 'Administrative',
    color: '#607d8b',
    description: 'Organizations, locations, and admin data',
    icon: <BusinessIcon />
  },
  workflow: {
    label: 'Workflow',
    color: '#9c27b0',
    description: 'Requests, orders, and workflow management',
    icon: <TimelineIcon />
  },
  documents: {
    label: 'Documents',
    color: '#795548',
    description: 'Clinical documents and references',
    icon: <DocumentIcon />
  }
};

/**
 * Resource Card Component
 */
const ResourceCard = ({ 
  resourceType, 
  resourceConfig, 
  resourceData, 
  onExplore, 
  onQuickQuery,
  favorites,
  onToggleFavorite,
  viewMode = 'card'
}) => {
  const theme = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const isFavorite = favorites.includes(resourceType);
  
  const count = resourceData?.total || 0;
  const sampleSize = resourceData?.sample || 0;
  const hasData = count > 0;

  if (viewMode === 'list') {
    return (
      <ListItemButton
        onClick={() => onExplore(resourceType)}
        sx={{
          borderRadius: 2,
          mb: 1,
          border: 1,
          borderColor: 'divider',
          '&:hover': {
            borderColor: resourceConfig.color,
            bgcolor: alpha(resourceConfig.color, 0.04)
          }
        }}
      >
        <ListItemIcon>
          <Avatar 
            sx={{ 
              bgcolor: alpha(resourceConfig.color, 0.1),
              color: resourceConfig.color,
              width: 40,
              height: 40
            }}
          >
            {resourceConfig.icon}
          </Avatar>
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {resourceType}
              </Typography>
              <Chip 
                label={resourceConfig.difficulty}
                size="small"
                color={resourceConfig.difficulty === 'beginner' ? 'success' : 
                       resourceConfig.difficulty === 'intermediate' ? 'warning' : 'error'}
              />
              {isFavorite && <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
            </Box>
          }
          secondary={resourceConfig.description}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: resourceConfig.color }}>
              {count.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              resources
            </Typography>
          </Box>
          <IconButton 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onQuickQuery(resourceType);
            }}
          >
            <PlayIcon />
          </IconButton>
        </Box>
      </ListItemButton>
    );
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: 1,
        borderColor: hasData ? alpha(resourceConfig.color, 0.2) : 'divider',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(resourceConfig.color, 0.15)}`,
          borderColor: resourceConfig.color
        }
      }}
      onClick={() => onExplore(resourceType)}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: alpha(resourceConfig.color, 0.1),
              color: resourceConfig.color,
              width: 48,
              height: 48
            }}
          >
            {resourceConfig.icon}
          </Avatar>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(resourceType);
              }}
            >
              {isFavorite ? 
                <StarIcon sx={{ color: 'warning.main' }} /> : 
                <StarBorderIcon />
              }
            </IconButton>
            <IconButton 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(true);
              }}
            >
              <InfoIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Title and category */}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          {resourceType}
        </Typography>
        <Chip 
          label={RESOURCE_CATEGORIES[resourceConfig.category]?.label}
          size="small"
          sx={{ 
            bgcolor: alpha(RESOURCE_CATEGORIES[resourceConfig.category]?.color, 0.1),
            color: RESOURCE_CATEGORIES[resourceConfig.category]?.color,
            mb: 2
          }}
        />

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
          {resourceConfig.description}
        </Typography>

        {/* Statistics */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: resourceConfig.color }}>
              {hasData ? count.toLocaleString() : '0'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              resources
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Chip 
              label={resourceConfig.difficulty}
              size="small"
              color={resourceConfig.difficulty === 'beginner' ? 'success' : 
                     resourceConfig.difficulty === 'intermediate' ? 'warning' : 'error'}
            />
          </Box>
        </Box>

        {/* Progress bar */}
        {hasData && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={Math.min((sampleSize / 20) * 100, 100)}
              sx={{ 
                bgcolor: alpha(resourceConfig.color, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: resourceConfig.color
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
              {sampleSize} loaded
            </Typography>
          </Box>
        )}

        {/* Quick stats */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            icon={<RelationshipIcon />}
            label={`${resourceConfig.relationships?.length || 0} relations`}
            size="small"
            variant="outlined"
          />
          <Chip 
            icon={<SearchIcon />}
            label={`${resourceConfig.searchParams?.length || 0} search params`}
            size="small"
            variant="outlined"
          />
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Button 
          size="small" 
          onClick={(e) => {
            e.stopPropagation();
            onExplore(resourceType);
          }}
          startIcon={<VisibilityIcon />}
        >
          Explore
        </Button>
        <Button 
          size="small" 
          onClick={(e) => {
            e.stopPropagation();
            onQuickQuery(resourceType);
          }}
          startIcon={<PlayIcon />}
          sx={{ color: resourceConfig.color }}
        >
          Query
        </Button>
      </CardActions>

      {/* Details Dialog */}
      <Dialog 
        open={showDetails} 
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: alpha(resourceConfig.color, 0.1), color: resourceConfig.color }}>
              {resourceConfig.icon}
            </Avatar>
            <Box>
              <Typography variant="h6">{resourceType}</Typography>
              <Typography variant="body2" color="text.secondary">
                {resourceConfig.description}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs defaultValue={0}>
            <Tab label="Overview" />
            <Tab label="Fields" />
            <Tab label="Search" />
            <Tab label="Relationships" />
          </Tabs>
          
          {/* Overview tab content would go here */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Use Case</Typography>
            <Typography variant="body2" paragraph>{resourceConfig.useCase}</Typography>
            
            <Typography variant="subtitle2" gutterBottom>Common Examples</Typography>
            <List dense>
              {resourceConfig.examples?.map((example, index) => (
                <ListItem key={index}>
                  <ListItemText primary={example} />
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setShowDetails(false);
              onQuickQuery(resourceType);
            }}
            startIcon={<PlayIcon />}
          >
            Quick Query
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

/**
 * Main Resource Catalog Component
 */
function ResourceCatalog({ onNavigate }) {
  const theme = useTheme();
  const { data, loading } = useFHIRData();
  const { preferences } = useUserPreferences();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('card');
  const [favorites, setFavorites] = useState([]);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('fhir-explorer-favorite-resources');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (err) {
        console.error('Failed to load favorite resources:', err);
      }
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites) => {
    setFavorites(newFavorites);
    localStorage.setItem('fhir-explorer-favorite-resources', JSON.stringify(newFavorites));
  }, []);

  // Toggle favorite status
  const toggleFavorite = useCallback((resourceType) => {
    const newFavorites = favorites.includes(resourceType)
      ? favorites.filter(fav => fav !== resourceType)
      : [...favorites, resourceType];
    saveFavorites(newFavorites);
  }, [favorites, saveFavorites]);

  // Filter and sort resources
  const filteredResources = useMemo(() => {
    let filtered = Object.entries(FHIR_RESOURCES);

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(([resourceType, config]) => 
        resourceType.toLowerCase().includes(term) ||
        config.description.toLowerCase().includes(term) ||
        config.useCase.toLowerCase().includes(term) ||
        config.examples?.some(example => example.toLowerCase().includes(term))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(([, config]) => config.category === selectedCategory);
    }

    // Difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(([, config]) => config.difficulty === difficultyFilter);
    }

    // Sort
    filtered.sort(([aType, aConfig], [bType, bConfig]) => {
      switch (sortBy) {
        case 'name':
          return aType.localeCompare(bType);
        case 'category':
          return aConfig.category.localeCompare(bConfig.category);
        case 'difficulty':
          const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
          return difficultyOrder[aConfig.difficulty] - difficultyOrder[bConfig.difficulty];
        case 'count':
          const aCount = data?.metadata?.[aType]?.total || 0;
          const bCount = data?.metadata?.[bType]?.total || 0;
          return bCount - aCount;
        case 'favorites':
          const aFav = favorites.includes(aType);
          const bFav = favorites.includes(bType);
          if (aFav && !bFav) return -1;
          if (!aFav && bFav) return 1;
          return aType.localeCompare(bType);
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchTerm, selectedCategory, difficultyFilter, sortBy, data?.metadata, favorites]);

  // Handle resource exploration
  const handleExplore = useCallback((resourceType) => {
    // Navigate to schema explorer for this resource
    onNavigate(APP_MODES.DISCOVERY, 'schema', { resourceType });
  }, [onNavigate]);

  // Handle quick query
  const handleQuickQuery = useCallback((resourceType) => {
    // Navigate to query builder with pre-filled resource type
    onNavigate(APP_MODES.QUERY_BUILDING, QUERY_VIEWS.VISUAL, { resourceType });
  }, [onNavigate]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          FHIR Resource Catalog
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore and discover FHIR resource types in your dataset. 
          Click any resource to learn more or start querying.
        </Typography>
      </Box>

      {/* Filters and Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchTerm('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          {/* Category filter */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
              >
                <MenuItem value="all">All Categories</MenuItem>
                {Object.entries(RESOURCE_CATEGORIES).map(([key, category]) => (
                  <MenuItem key={key} value={key}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Difficulty filter */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                label="Difficulty"
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="beginner">Beginner</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Sort */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sort by"
              >
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="category">Category</MenuItem>
                <MenuItem value="difficulty">Difficulty</MenuItem>
                <MenuItem value="count">Data Count</MenuItem>
                <MenuItem value="favorites">Favorites</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* View mode */}
          <Grid item xs={12} sm={6} md={2}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              fullWidth
            >
              <ToggleButton value="card">
                <CardViewIcon />
              </ToggleButton>
              <ToggleButton value="list">
                <ListViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Category stats */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          {Object.entries(RESOURCE_CATEGORIES).map(([key, category]) => {
            const count = Object.entries(FHIR_RESOURCES)
              .filter(([, config]) => config.category === key).length;
            const dataCount = Object.entries(FHIR_RESOURCES)
              .filter(([, config]) => config.category === key)
              .reduce((sum, [resourceType]) => sum + (data?.metadata?.[resourceType]?.total || 0), 0);
            
            return (
              <Grid item xs={6} sm={4} md={2} key={key}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: category.color,
                      bgcolor: alpha(category.color, 0.04)
                    }
                  }}
                  onClick={() => setSelectedCategory(key)}
                >
                  <Avatar 
                    sx={{ 
                      bgcolor: alpha(category.color, 0.1),
                      color: category.color,
                      mx: 'auto',
                      mb: 1
                    }}
                  >
                    {category.icon}
                  </Avatar>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {category.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {count} types
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dataCount.toLocaleString()} resources
                  </Typography>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Results count */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {filteredResources.length} Resource{filteredResources.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
        </Typography>
        {favorites.length > 0 && (
          <Chip 
            icon={<StarIcon />}
            label={`${favorites.length} favorites`}
            color="warning"
            onClick={() => setSortBy('favorites')}
          />
        )}
      </Box>

      {/* Resource grid/list */}
      {viewMode === 'card' ? (
        <Grid container spacing={3}>
          {filteredResources.map(([resourceType, resourceConfig]) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={resourceType}>
              <Zoom in timeout={600} style={{ transitionDelay: '100ms' }}>
                <div>
                  <ResourceCard
                    resourceType={resourceType}
                    resourceConfig={resourceConfig}
                    resourceData={data?.metadata?.[resourceType]}
                    onExplore={handleExplore}
                    onQuickQuery={handleQuickQuery}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    viewMode="card"
                  />
                </div>
              </Zoom>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper>
          <List>
            {filteredResources.map(([resourceType, resourceConfig]) => (
              <ResourceCard
                key={resourceType}
                resourceType={resourceType}
                resourceConfig={resourceConfig}
                resourceData={data?.metadata?.[resourceType]}
                onExplore={handleExplore}
                onQuickQuery={handleQuickQuery}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                viewMode="list"
              />
            ))}
          </List>
        </Paper>
      )}

      {/* Empty state */}
      {filteredResources.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No resources found
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Try adjusting your search terms or filters to find what you're looking for.
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setDifficultyFilter('all');
            }}
          >
            Clear Filters
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default ResourceCatalog;