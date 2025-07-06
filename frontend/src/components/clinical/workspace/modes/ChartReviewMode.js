/**
 * ChartReviewMode Component
 * Provides comprehensive patient chart review with problem list and clinical timeline
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  TextField,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Collapse,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as WarningIcon,
  CheckCircle as ResolvedIcon,
  RadioButtonUnchecked as ActiveIcon,
  History as HistoryIcon,
  LocalPharmacy as MedicationIcon,
  Vaccines as ImmunizationIcon,
  MonitorHeart,
  Science,
  Assignment as EncounterIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Contexts and Hooks
import { useWorkflow } from '../../../../contexts/WorkflowContext';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';

// Components
import FHIRResourceTimeline from '../../timeline/FHIRResourceTimeline';

// SNOMED categorization for problems
const PROBLEM_CATEGORIES = {
  'cardiovascular': { 
    label: 'Cardiovascular', 
    icon: <MonitorHeart />, 
    color: 'error',
    snomedCodes: ['414545008', '49601007', '38341003'] // Examples
  },
  'respiratory': { 
    label: 'Respiratory', 
    icon: <MonitorHeart />, 
    color: 'info',
    snomedCodes: ['195967001', '233604007']
  },
  'endocrine': { 
    label: 'Endocrine', 
    icon: <Science />, 
    color: 'warning',
    snomedCodes: ['73211009', '44054006']
  },
  'other': { 
    label: 'Other', 
    icon: <ActiveIcon />, 
    color: 'default',
    snomedCodes: []
  }
};

const ProblemListPanel = () => {
  const theme = useTheme();
  const { activeResources, clinicalContext, updateClinicalContext } = useWorkflow();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedProblems, setExpandedProblems] = useState([]);
  const [filterAnchor, setFilterAnchor] = useState(null);

  const conditions = activeResources.Condition || [];
  const medications = activeResources.MedicationRequest || [];
  const allergies = activeResources.AllergyIntolerance || [];

  // Categorize conditions
  const categorizeCondition = (condition) => {
    const code = condition.code?.coding?.[0]?.code;
    for (const [category, config] of Object.entries(PROBLEM_CATEGORIES)) {
      if (config.snomedCodes.includes(code)) {
        return category;
      }
    }
    return 'other';
  };

  // Filter conditions
  const filteredConditions = conditions.filter(condition => {
    const matchesSearch = searchQuery === '' || 
      condition.code?.text?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || 
      categorizeCondition(condition) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by status
  const activeProblems = filteredConditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active');
  const resolvedProblems = filteredConditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved');

  const toggleProblemExpanded = (conditionId) => {
    setExpandedProblems(prev => 
      prev.includes(conditionId) 
        ? prev.filter(id => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  const handleSelectProblem = (condition) => {
    updateClinicalContext({ 
      selectedConditions: [...clinicalContext.selectedConditions, condition]
    });
  };

  // Get related medications for a condition
  const getRelatedMedications = (condition) => {
    return medications.filter(med => 
      med.reasonReference?.some(ref => ref.reference?.includes(condition.id))
    );
  };

  return (
    <Paper elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Problem List</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Add Problem">
              <IconButton size="small">
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Filter">
              <IconButton size="small" onClick={(e) => setFilterAnchor(e.currentTarget)}>
                <Badge badgeContent={categoryFilter !== 'all' ? 1 : 0} color="primary">
                  <FilterIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search problems..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        {/* Summary Stats */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Chip 
            label={`${activeProblems.length} Active`} 
            color="primary" 
            size="small" 
            variant="outlined"
          />
          <Chip 
            label={`${resolvedProblems.length} Resolved`} 
            color="default" 
            size="small" 
            variant="outlined"
          />
          {allergies.length > 0 && (
            <Chip 
              label={`${allergies.length} Allergies`} 
              color="error" 
              size="small" 
              icon={<WarningIcon />}
            />
          )}
        </Box>
      </Box>

      {/* Problem List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Active Problems */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Active Problems
          </Typography>
          <List dense>
            {activeProblems.map((condition) => {
              const category = categorizeCondition(condition);
              const categoryConfig = PROBLEM_CATEGORIES[category];
              const isExpanded = expandedProblems.includes(condition.id);
              const relatedMeds = getRelatedMedications(condition);
              
              return (
                <React.Fragment key={condition.id}>
                  <ListItem
                    button
                    onClick={() => toggleProblemExpanded(condition.id)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      backgroundColor: alpha(theme.palette[categoryConfig.color].main, 0.04),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette[categoryConfig.color].main, 0.08)
                      }
                    }}
                  >
                    <ListItemIcon>
                      <Tooltip title={categoryConfig.label}>
                        {React.cloneElement(categoryConfig.icon, { 
                          color: categoryConfig.color,
                          fontSize: 'small'
                        })}
                      </Tooltip>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {condition.code?.text || 'Unknown Condition'}
                          </Typography>
                          {condition.severity && (
                            <Chip 
                              label={condition.severity.text} 
                              size="small" 
                              color={condition.severity.coding?.[0]?.code === 'severe' ? 'error' : 'default'}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Since {condition.onsetDateTime ? format(parseISO(condition.onsetDateTime), 'MMM d, yyyy') : 'Unknown'}
                          </Typography>
                          {relatedMeds.length > 0 && (
                            <Chip
                              icon={<MedicationIcon />}
                              label={`${relatedMeds.length} medications`}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" size="small">
                        {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  
                  <Collapse in={isExpanded}>
                    <Card sx={{ ml: 5, mr: 2, mb: 2 }}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Clinical Details
                        </Typography>
                        {condition.note?.[0]?.text && (
                          <Typography variant="body2" paragraph>
                            {condition.note[0].text}
                          </Typography>
                        )}
                        {relatedMeds.length > 0 && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Related Medications:
                            </Typography>
                            {relatedMeds.map(med => (
                              <Chip
                                key={med.id}
                                label={med.medicationCodeableConcept?.text}
                                size="small"
                                sx={{ ml: 1, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        )}
                      </CardContent>
                      <CardActions>
                        <Button size="small" onClick={() => handleSelectProblem(condition)}>
                          Focus on This Problem
                        </Button>
                        <Button size="small">Edit</Button>
                      </CardActions>
                    </Card>
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        </Box>

        {/* Resolved Problems */}
        {resolvedProblems.length > 0 && (
          <Box sx={{ p: 2, pt: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Resolved Problems
            </Typography>
            <List dense>
              {resolvedProblems.map((condition) => (
                <ListItem key={condition.id} sx={{ opacity: 0.7 }}>
                  <ListItemIcon>
                    <ResolvedIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={condition.code?.text}
                    secondary={`Resolved ${condition.abatementDateTime ? 
                      format(parseISO(condition.abatementDateTime), 'MMM d, yyyy') : 
                      'Unknown'}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
      >
        <MenuItem 
          selected={categoryFilter === 'all'} 
          onClick={() => { setCategoryFilter('all'); setFilterAnchor(null); }}
        >
          All Categories
        </MenuItem>
        <Divider />
        {Object.entries(PROBLEM_CATEGORIES).map(([key, config]) => (
          <MenuItem
            key={key}
            selected={categoryFilter === key}
            onClick={() => { setCategoryFilter(key); setFilterAnchor(null); }}
          >
            <ListItemIcon>{config.icon}</ListItemIcon>
            <ListItemText>{config.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
};

const ChartReviewMode = () => {
  const { currentMode, activeResources, isLoadingResources } = useWorkflow();
  const { currentPatient } = useFHIRResource();

  if (isLoadingResources) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  // The WorkspaceLayoutManager will handle the layout
  // Based on the layout config, it will render these components in the appropriate panels
  // For sidebar layout: sidebar = ProblemListPanel, main = FHIRResourceTimeline
  
  // Return an array of components for the sidebar layout
  // The WorkspaceLayoutManager expects [sidebar, main] for sidebar layout
  return [
    <ProblemListPanel key="sidebar" />,
    <Box key="main" sx={{ height: '100%', overflow: 'hidden' }}>
      <FHIRResourceTimeline patientId={currentPatient?.id} />
    </Box>
  ];
};

export default ChartReviewMode;