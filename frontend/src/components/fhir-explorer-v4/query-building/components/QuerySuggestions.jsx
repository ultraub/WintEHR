/**
 * Query Suggestions Component
 * 
 * Provides intelligent query suggestions based on context
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Divider,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Lightbulb as LightbulbIcon,
  TrendingUp as TrendingIcon,
  History as HistoryIcon,
  AutoAwesome as AutoAwesomeIcon,
  ChevronRight as ChevronIcon,
  Star as StarIcon,
  QueryStats as QueryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

// Common query patterns by resource type
const QUERY_PATTERNS = {
  Patient: [
    {
      title: 'Active Patients',
      params: { active: 'true' },
      description: 'Find all currently active patients'
    },
    {
      title: 'Patients by Age Range',
      params: { birthdate: 'ge1950-01-01', birthdate2: 'le2000-12-31' },
      description: 'Find patients born between specific dates'
    },
    {
      title: 'Patients with Recent Encounters',
      params: { '_has': 'Encounter:patient:date=ge2024-01-01' },
      description: 'Find patients who had encounters this year'
    }
  ],
  Observation: [
    {
      title: 'Vital Signs',
      params: { category: 'vital-signs', '_sort': '-date' },
      description: 'All vital sign observations, newest first'
    },
    {
      title: 'Lab Results',
      params: { category: 'laboratory', status: 'final' },
      description: 'Final laboratory results'
    },
    {
      title: 'Abnormal Results',
      params: { 'value-quantity': 'gt100', category: 'laboratory' },
      description: 'Lab results with values over 100'
    },
    {
      title: 'Blood Pressure Readings',
      params: { code: '85354-9', '_include': 'Observation:patient' },
      description: 'Blood pressure observations with patient details'
    }
  ],
  Condition: [
    {
      title: 'Active Conditions',
      params: { 'clinical-status': 'active' },
      description: 'Currently active medical conditions'
    },
    {
      title: 'Chronic Conditions',
      params: { category: 'problem-list-item', 'clinical-status': 'active' },
      description: 'Active chronic conditions on problem list'
    },
    {
      title: 'Recent Diagnoses',
      params: { 'recorded-date': 'ge2024-01-01', '_sort': '-recorded-date' },
      description: 'Conditions recorded this year'
    }
  ],
  MedicationRequest: [
    {
      title: 'Active Medications',
      params: { status: 'active', '_include': 'MedicationRequest:medication' },
      description: 'Currently active prescriptions with medication details'
    },
    {
      title: 'Recent Prescriptions',
      params: { authoredon: 'ge2024-01-01', '_sort': '-authoredon' },
      description: 'Prescriptions written this year'
    },
    {
      title: 'High Priority Meds',
      params: { priority: 'urgent,stat' },
      description: 'Urgent or stat medication orders'
    }
  ],
  Encounter: [
    {
      title: 'In-Progress Encounters',
      params: { status: 'in-progress' },
      description: 'Currently active encounters'
    },
    {
      title: 'Emergency Visits',
      params: { class: 'EMER', '_include': 'Encounter:patient' },
      description: 'Emergency department visits'
    },
    {
      title: 'Recent Admissions',
      params: { class: 'IMP', period: 'ge2024-01-01' },
      description: 'Inpatient admissions this year'
    }
  ]
};

// Contextual suggestions based on selected parameters
const CONTEXTUAL_SUGGESTIONS = {
  'has-patient': {
    title: 'Patient Context',
    suggestions: [
      { label: 'Include patient details', action: 'add-include', value: ':patient' },
      { label: 'Filter by encounter', action: 'add-param', param: 'encounter' },
      { label: 'Sort by date', action: 'add-sort', value: '-date' }
    ]
  },
  'has-date': {
    title: 'Time-based Queries',
    suggestions: [
      { label: 'Last 30 days', action: 'modify-date', value: 'ge{30daysAgo}' },
      { label: 'This year', action: 'modify-date', value: 'ge{yearStart}' },
      { label: 'Add end date', action: 'add-param', param: 'date', modifier: 'le' }
    ]
  },
  'has-code': {
    title: 'Code-based Queries',
    suggestions: [
      { label: 'Search by text', action: 'add-modifier', modifier: ':text' },
      { label: 'Include hierarchy', action: 'add-modifier', modifier: ':below' },
      { label: 'Add value filter', action: 'add-param', param: 'value-quantity' }
    ]
  }
};

function QuerySuggestions({ 
  resourceType, 
  currentParams = {}, 
  onApplySuggestion,
  recentQueries = [],
  favoriteQueries = []
}) {
  const [expandedSection, setExpandedSection] = useState('patterns');
  const [selectedPattern, setSelectedPattern] = useState(null);

  // Get relevant patterns for resource type
  const patterns = useMemo(() => {
    return QUERY_PATTERNS[resourceType] || [];
  }, [resourceType]);

  // Get contextual suggestions based on current parameters
  const contextualSuggestions = useMemo(() => {
    const suggestions = [];
    
    if (currentParams.patient || currentParams.subject) {
      suggestions.push(CONTEXTUAL_SUGGESTIONS['has-patient']);
    }
    
    if (currentParams.date || currentParams['authored-on'] || currentParams.period) {
      suggestions.push(CONTEXTUAL_SUGGESTIONS['has-date']);
    }
    
    if (currentParams.code) {
      suggestions.push(CONTEXTUAL_SUGGESTIONS['has-code']);
    }
    
    return suggestions;
  }, [currentParams]);

  // Apply suggestion
  const applySuggestion = (suggestion) => {
    if (onApplySuggestion) {
      onApplySuggestion(suggestion);
    }
  };

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!resourceType) {
    return (
      <Alert severity="info">
        Select a resource type to see query suggestions
      </Alert>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Query Suggestions"
        subheader="Get started quickly with common query patterns"
        avatar={<LightbulbIcon color="warning" />}
      />
      <CardContent sx={{ p: 0 }}>
        {/* Common Patterns */}
        <Box>
          <ListItemButton onClick={() => toggleSection('patterns')}>
            <ListItemIcon>
              <QueryIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Common Query Patterns"
              secondary={`${patterns.length} patterns available`}
            />
            {expandedSection === 'patterns' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
          
          <Collapse in={expandedSection === 'patterns'}>
            <List disablePadding>
              {patterns.map((pattern, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemButton
                    onClick={() => applySuggestion({ type: 'pattern', ...pattern })}
                    selected={selectedPattern === index}
                  >
                    <ListItemText
                      primary={pattern.title}
                      secondary={pattern.description}
                    />
                    <ChevronIcon />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        <Divider />

        {/* Contextual Suggestions */}
        {contextualSuggestions.length > 0 && (
          <>
            <Box>
              <ListItemButton onClick={() => toggleSection('contextual')}>
                <ListItemIcon>
                  <AutoAwesomeIcon color="secondary" />
                </ListItemIcon>
                <ListItemText 
                  primary="Smart Suggestions"
                  secondary="Based on your current query"
                />
                <Badge badgeContent={contextualSuggestions.length} color="secondary">
                  {expandedSection === 'contextual' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Badge>
              </ListItemButton>
              
              <Collapse in={expandedSection === 'contextual'}>
                <Box sx={{ p: 2 }}>
                  {contextualSuggestions.map((context, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {context.title}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {context.suggestions.map((suggestion, idx) => (
                          <Chip
                            key={idx}
                            label={suggestion.label}
                            size="small"
                            onClick={() => applySuggestion({ 
                              type: 'contextual', 
                              ...suggestion 
                            })}
                            icon={<AutoAwesomeIcon />}
                          />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
            <Divider />
          </>
        )}

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <>
            <Box>
              <ListItemButton onClick={() => toggleSection('recent')}>
                <ListItemIcon>
                  <HistoryIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Recent Queries"
                  secondary={`${recentQueries.length} recent queries`}
                />
                {expandedSection === 'recent' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              
              <Collapse in={expandedSection === 'recent'}>
                <List dense disablePadding>
                  {recentQueries.slice(0, 5).map((query, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemButton
                        onClick={() => applySuggestion({ type: 'recent', query })}
                      >
                        <ListItemText
                          primary={query.name || query.url}
                          secondary={`${query.resultCount} results`}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
            <Divider />
          </>
        )}

        {/* Favorites */}
        {favoriteQueries.length > 0 && (
          <Box>
            <ListItemButton onClick={() => toggleSection('favorites')}>
              <ListItemIcon>
                <StarIcon color="warning" />
              </ListItemIcon>
              <ListItemText 
                primary="Favorite Queries"
                secondary={`${favoriteQueries.length} saved favorites`}
              />
              {expandedSection === 'favorites' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItemButton>
            
            <Collapse in={expandedSection === 'favorites'}>
              <List dense disablePadding>
                {favoriteQueries.map((query, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemButton
                      onClick={() => applySuggestion({ type: 'favorite', query })}
                    >
                      <ListItemIcon>
                        <StarIcon fontSize="small" color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={query.name}
                        secondary={query.description}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        )}

        {/* Tips */}
        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingIcon fontSize="small" />
            Pro Tips
          </Typography>
          <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
            • Use modifiers like :exact, :contains for precise string matching
          </Typography>
          <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
            • Combine multiple parameters for complex queries
          </Typography>
          <Typography variant="caption" display="block">
            • Save frequently used queries as favorites
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default QuerySuggestions;