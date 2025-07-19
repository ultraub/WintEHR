/**
 * Relationship Filter Panel
 * 
 * Provides advanced filtering options for the RelationshipMapper visualization.
 * Supports filtering by resource type, date range, relationship type, and depth.
 */

import React, { useState, useEffect, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Stack,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Badge,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  DateRange as DateRangeIcon,
  Category as CategoryIcon,
  Link as LinkIcon,
  Layers as LayersIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  RestartAlt as ResetIcon,
  Save as SaveIcon,
  Upload as LoadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Resource type categories for grouping
const RESOURCE_CATEGORIES = {
  'Clinical': ['Patient', 'Practitioner', 'PractitionerRole', 'Organization', 'Location'],
  'Diagnostics': ['Observation', 'DiagnosticReport', 'ImagingStudy', 'Specimen'],
  'Medications': ['MedicationRequest', 'MedicationDispense', 'MedicationAdministration', 'Medication'],
  'Conditions': ['Condition', 'AllergyIntolerance', 'FamilyMemberHistory'],
  'Procedures': ['Procedure', 'Immunization', 'CarePlan', 'CareTeam'],
  'Documents': ['DocumentReference', 'Composition', 'Media'],
  'Encounters': ['Encounter', 'Appointment', 'EpisodeOfCare'],
  'Financial': ['Coverage', 'Claim', 'ExplanationOfBenefit']
};

// Common relationship types
const RELATIONSHIP_TYPES = [
  { value: 'subject', label: 'Subject/Patient' },
  { value: 'performer', label: 'Performer' },
  { value: 'author', label: 'Author' },
  { value: 'encounter', label: 'Encounter' },
  { value: 'basedOn', label: 'Based On' },
  { value: 'partOf', label: 'Part Of' },
  { value: 'reasonReference', label: 'Reason' },
  { value: 'medication', label: 'Medication' },
  { value: 'location', label: 'Location' },
  { value: 'organization', label: 'Organization' }
];

function RelationshipFilterPanel({ 
  onFiltersChange,
  availableResourceTypes = [],
  availableRelationshipTypes = [],
  currentFilters = {},
  nodeCount = 0,
  linkCount = 0
}) {
  // Filter states
  const [filters, setFilters] = useState({
    resourceTypes: new Set(),
    excludedResourceTypes: new Set(),
    relationshipTypes: new Set(),
    dateRange: { start: null, end: null },
    depth: 2,
    showOrphans: true,
    highlightCritical: false,
    ...currentFilters
  });

  const [expandedSections, setExpandedSections] = useState({
    resourceTypes: true,
    relationships: false,
    dateRange: false,
    advanced: false
  });

  // Preset filter configurations
  const [savedFilters, setSavedFilters] = useState(() => {
    const saved = localStorage.getItem('fhir-relationship-filters');
    return saved ? JSON.parse(saved) : [];
  });

  // Update parent when filters change
  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Handle resource type toggle
  const handleResourceTypeToggle = (resourceType) => {
    const newTypes = new Set(filters.resourceTypes);
    if (newTypes.has(resourceType)) {
      newTypes.delete(resourceType);
    } else {
      newTypes.add(resourceType);
    }
    setFilters(prev => ({ ...prev, resourceTypes: newTypes }));
  };

  // Handle category toggle
  const handleCategoryToggle = (category) => {
    const categoryTypes = RESOURCE_CATEGORIES[category] || [];
    const newTypes = new Set(filters.resourceTypes);
    const allSelected = categoryTypes.every(type => newTypes.has(type));
    
    categoryTypes.forEach(type => {
      if (allSelected) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
    });
    
    setFilters(prev => ({ ...prev, resourceTypes: newTypes }));
  };

  // Handle relationship type toggle
  const handleRelationshipTypeToggle = (relType) => {
    const newTypes = new Set(filters.relationshipTypes);
    if (newTypes.has(relType)) {
      newTypes.delete(relType);
    } else {
      newTypes.add(relType);
    }
    setFilters(prev => ({ ...prev, relationshipTypes: newTypes }));
  };

  // Clear all filters
  const handleClearAll = () => {
    setFilters({
      resourceTypes: new Set(),
      excludedResourceTypes: new Set(),
      relationshipTypes: new Set(),
      dateRange: { start: null, end: null },
      depth: 2,
      showOrphans: true,
      highlightCritical: false
    });
  };

  // Save current filter configuration
  const handleSaveFilters = () => {
    const filterName = prompt('Enter a name for this filter configuration:');
    if (filterName) {
      const newSaved = [...savedFilters, {
        name: filterName,
        filters: {
          ...filters,
          resourceTypes: Array.from(filters.resourceTypes),
          excludedResourceTypes: Array.from(filters.excludedResourceTypes),
          relationshipTypes: Array.from(filters.relationshipTypes)
        },
        timestamp: new Date().toISOString()
      }];
      setSavedFilters(newSaved);
      localStorage.setItem('fhir-relationship-filters', JSON.stringify(newSaved));
    }
  };

  // Load saved filter configuration
  const handleLoadFilters = (savedFilter) => {
    setFilters({
      ...savedFilter.filters,
      resourceTypes: new Set(savedFilter.filters.resourceTypes),
      excludedResourceTypes: new Set(savedFilter.filters.excludedResourceTypes),
      relationshipTypes: new Set(savedFilter.filters.relationshipTypes)
    });
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.resourceTypes.size > 0) count++;
    if (filters.relationshipTypes.size > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.depth !== 2) count++;
    if (!filters.showOrphans) count++;
    if (filters.highlightCritical) count++;
    return count;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon />
            Filters
            <Badge badgeContent={getActiveFilterCount()} color="primary" />
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Save Filters">
              <IconButton size="small" onClick={handleSaveFilters}>
                <SaveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear All">
              <IconButton size="small" onClick={handleClearAll}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Summary */}
        <Alert severity="info" icon={false} sx={{ mb: 2, py: 0.5 }}>
          <Typography variant="caption">
            Showing {nodeCount} nodes and {linkCount} relationships
          </Typography>
        </Alert>

        {/* Resource Types Section */}
        <Accordion 
          expanded={expandedSections.resourceTypes}
          onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, resourceTypes: expanded }))}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon fontSize="small" />
              Resource Types
              {filters.resourceTypes.size > 0 && (
                <Chip label={filters.resourceTypes.size} size="small" />
              )}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {Object.entries(RESOURCE_CATEGORIES).map(([category, types]) => {
              const availableInCategory = types.filter(type => availableResourceTypes.includes(type));
              const selectedInCategory = availableInCategory.filter(type => filters.resourceTypes.has(type));
              
              if (availableInCategory.length === 0) return null;
              
              return (
                <Box key={category} sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedInCategory.length === availableInCategory.length}
                        indeterminate={selectedInCategory.length > 0 && selectedInCategory.length < availableInCategory.length}
                        onChange={() => handleCategoryToggle(category)}
                      />
                    }
                    label={
                      <Typography variant="subtitle2">
                        {category} ({selectedInCategory.length}/{availableInCategory.length})
                      </Typography>
                    }
                  />
                  <Box sx={{ ml: 3 }}>
                    {availableInCategory.map(type => (
                      <FormControlLabel
                        key={type}
                        control={
                          <Checkbox
                            size="small"
                            checked={filters.resourceTypes.has(type)}
                            onChange={() => handleResourceTypeToggle(type)}
                          />
                        }
                        label={<Typography variant="body2">{type}</Typography>}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </AccordionDetails>
        </Accordion>

        {/* Relationship Types Section */}
        <Accordion 
          expanded={expandedSections.relationships}
          onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, relationships: expanded }))}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon fontSize="small" />
              Relationship Types
              {filters.relationshipTypes.size > 0 && (
                <Chip label={filters.relationshipTypes.size} size="small" />
              )}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormGroup>
              {RELATIONSHIP_TYPES.map(relType => (
                <FormControlLabel
                  key={relType.value}
                  control={
                    <Checkbox
                      size="small"
                      checked={filters.relationshipTypes.has(relType.value)}
                      onChange={() => handleRelationshipTypeToggle(relType.value)}
                    />
                  }
                  label={<Typography variant="body2">{relType.label}</Typography>}
                />
              ))}
            </FormGroup>
          </AccordionDetails>
        </Accordion>

        {/* Date Range Section */}
        <Accordion 
          expanded={expandedSections.dateRange}
          onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, dateRange: expanded }))}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DateRangeIcon fontSize="small" />
              Date Range
              {(filters.dateRange.start || filters.dateRange.end) && (
                <Chip label="Active" size="small" color="primary" />
              )}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <DatePicker
                label="Start Date"
                value={filters.dateRange.start}
                onChange={(date) => setFilters(prev => ({ 
                  ...prev, 
                  dateRange: { ...prev.dateRange, start: date }
                }))}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true
                  }
                }}
              />
              <DatePicker
                label="End Date"
                value={filters.dateRange.end}
                onChange={(date) => setFilters(prev => ({ 
                  ...prev, 
                  dateRange: { ...prev.dateRange, end: date }
                }))}
                slotProps={{
                  textField: {
                    size: "small",
                    fullWidth: true
                  }
                }}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Advanced Options Section */}
        <Accordion 
          expanded={expandedSections.advanced}
          onChange={(e, expanded) => setExpandedSections(prev => ({ ...prev, advanced: expanded }))}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LayersIcon fontSize="small" />
              Advanced Options
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {/* Depth Slider */}
              <Box>
                <Typography gutterBottom variant="body2">
                  Exploration Depth: {filters.depth}
                </Typography>
                <Slider
                  value={filters.depth}
                  onChange={(e, value) => setFilters(prev => ({ ...prev, depth: value }))}
                  min={1}
                  max={3}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>

              {/* Switches */}
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.showOrphans}
                    onChange={(e) => setFilters(prev => ({ ...prev, showOrphans: e.target.checked }))}
                  />
                }
                label="Show Orphan Nodes"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={filters.highlightCritical}
                    onChange={(e) => setFilters(prev => ({ ...prev, highlightCritical: e.target.checked }))}
                  />
                }
                label="Highlight Critical Resources"
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Saved Filters
            </Typography>
            <List dense>
              {savedFilters.map((saved, idx) => (
                <ListItem 
                  key={idx}
                  button
                  onClick={() => handleLoadFilters(saved)}
                >
                  <ListItemIcon>
                    <LoadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={saved.name}
                    secondary={new Date(saved.timestamp).toLocaleDateString()}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSavedFilters(prev => prev.filter((_, i) => i !== idx));
                        localStorage.setItem('fhir-relationship-filters', 
                          JSON.stringify(savedFilters.filter((_, i) => i !== idx)));
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>
    </LocalizationProvider>
  );
}

export default memo(RelationshipFilterPanel);