/**
 * Card Designer Improved - Enhanced visual interface for designing CDS cards
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Divider,
  Switch,
  FormControlLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Lightbulb as SuggestionIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  VisibilityOff as PreviewOffIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatListBulleted as BulletIcon,
  ExpandMore as ExpandMoreIcon,
  LocalHospital as OrderIcon,
  Medication as MedicationIcon,
  Assignment as TaskIcon,
  Launch as LaunchIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';

// Import sub-components
import SuggestionBuilder from './cards/SuggestionBuilder';
import ActionBuilder from './cards/ActionBuilder';

// Card indicator types with enhanced descriptions
const CARD_INDICATORS = [
  { 
    id: 'info', 
    label: 'Info', 
    icon: <InfoIcon />, 
    color: '#2196F3',
    description: 'General information or guidance' 
  },
  { 
    id: 'warning', 
    label: 'Warning', 
    icon: <WarningIcon />, 
    color: '#FF9800',
    description: 'Important alerts requiring attention' 
  },
  { 
    id: 'critical', 
    label: 'Critical', 
    icon: <ErrorIcon />, 
    color: '#F44336',
    description: 'Urgent issues requiring immediate action' 
  },
  { 
    id: 'success', 
    label: 'Success', 
    icon: <SuccessIcon />, 
    color: '#4CAF50',
    description: 'Positive feedback or confirmations' 
  }
];

// Card templates organized by use case
const CARD_TEMPLATES = {
  clinical: [
    {
      id: 'drug-interaction',
      name: 'Drug Interaction Alert',
      summary: 'Potential drug interaction detected',
      detail: 'The prescribed medication **{medication}** may interact with the patient\'s current medications:\n\n* **{existing_med}** - {interaction_type}\n\nConsider alternative medications or adjust dosing.',
      indicator: 'warning',
      source: { label: 'Drug Interaction Database' }
    },
    {
      id: 'allergy-alert',
      name: 'Allergy Alert',
      summary: 'Patient has documented allergy',
      detail: 'Patient has a documented allergy to **{allergen}**.\n\nReaction type: {reaction_type}\nSeverity: {severity}',
      indicator: 'critical',
      source: { label: 'Patient Allergy Record' }
    }
  ],
  preventive: [
    {
      id: 'screening-due',
      name: 'Screening Due',
      summary: '{screening_type} screening is due',
      detail: 'Patient is due for {screening_type} screening based on:\n\n* Age: {age} years\n* Last screening: {last_date}\n* Risk factors: {risk_factors}',
      indicator: 'info',
      suggestions: [{
        label: 'Order {screening_type} screening',
        type: 'order'
      }]
    },
    {
      id: 'immunization-due',
      name: 'Immunization Due',
      summary: '{vaccine} immunization recommended',
      detail: 'Patient is eligible for {vaccine} based on current guidelines.',
      indicator: 'info',
      suggestions: [{
        label: 'Order {vaccine}',
        type: 'immunization'
      }]
    }
  ],
  chronic: [
    {
      id: 'diabetes-control',
      name: 'Diabetes Management',
      summary: 'HbA1c above target',
      detail: 'Latest HbA1c: **{value}%** (target: <{target}%)\n\nConsider:\n* Medication adjustment\n* Lifestyle counseling\n* Specialist referral',
      indicator: 'warning',
      source: { label: 'ADA Guidelines' }
    }
  ]
};

// Markdown editor toolbar
const MarkdownToolbar = ({ onInsert }) => {
  const tools = [
    { icon: <BoldIcon />, text: '**bold**', tooltip: 'Bold' },
    { icon: <ItalicIcon />, text: '*italic*', tooltip: 'Italic' },
    { icon: <BulletIcon />, text: '\n* Item', tooltip: 'Bullet list' },
    { icon: <LinkIcon />, text: '[text](url)', tooltip: 'Link' }
  ];

  return (
    <Stack direction="row" spacing={0.5}>
      {tools.map((tool, idx) => (
        <Tooltip key={idx} title={tool.tooltip}>
          <IconButton 
            size="small" 
            onClick={() => onInsert(tool.text)}
          >
            {tool.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
};

// Individual card editor
const CardEditor = ({ card, onChange, onDelete, onDuplicate }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const handleTextInsert = (text) => {
    const newDetail = card.detail + text;
    onChange({ ...card, detail: newDetail });
  };

  const indicator = CARD_INDICATORS.find(i => i.id === card.indicator) || CARD_INDICATORS[0];

  return (
    <Accordion expanded={expanded} onChange={(e, isExpanded) => setExpanded(isExpanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          <Box sx={{ color: indicator.color }}>
            {indicator.icon}
          </Box>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {card.summary || 'Untitled Card'}
          </Typography>
          <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Duplicate">
              <IconButton size="small" onClick={onDuplicate}>
                <DuplicateIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={onDelete} color="error">
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          {/* Card type selector */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Card Type</InputLabel>
                <Select
                  value={card.indicator}
                  onChange={(e) => onChange({ ...card, indicator: e.target.value })}
                  label="Card Type"
                >
                  {CARD_INDICATORS.map(ind => (
                    <MenuItem key={ind.id} value={ind.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: ind.color }}>{ind.icon}</Box>
                        <Box>
                          <Typography variant="body2">{ind.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ind.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                size="small"
                label="Summary"
                value={card.summary}
                onChange={(e) => onChange({ ...card, summary: e.target.value })}
                placeholder="Brief one-line summary..."
              />
            </Grid>
          </Grid>

          {/* Tabbed content editor */}
          <Paper variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                <Tab label="Content" />
                <Tab label="Suggestions" />
                <Tab label="Actions" />
                <Tab label="Advanced" />
              </Tabs>
            </Box>

            <Box sx={{ p: 2 }}>
              {/* Content Tab */}
              {activeTab === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={showPreview ? 6 : 12}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2">Detail Message</Typography>
                      <Stack direction="row" spacing={1}>
                        <MarkdownToolbar onInsert={handleTextInsert} />
                        <IconButton 
                          size="small" 
                          onClick={() => setShowPreview(!showPreview)}
                        >
                          {showPreview ? <PreviewOffIcon /> : <PreviewIcon />}
                        </IconButton>
                      </Stack>
                    </Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      value={card.detail || ''}
                      onChange={(e) => onChange({ ...card, detail: e.target.value })}
                      placeholder="Detailed message with markdown support..."
                      sx={{ fontFamily: 'monospace' }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Supports Markdown: **bold**, *italic*, [links](url), bullet lists
                    </Typography>
                  </Grid>
                  {showPreview && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Preview</Typography>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 2, 
                          minHeight: 200,
                          backgroundColor: 'grey.50'
                        }}
                      >
                        <ReactMarkdown>{card.detail || '*No content*'}</ReactMarkdown>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Suggestions Tab */}
              {activeTab === 1 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Suggestions propose FHIR resources to create (orders, referrals, etc.)
                  </Alert>
                  <SuggestionBuilder
                    suggestions={card.suggestions || []}
                    onChange={(suggestions) => onChange({ ...card, suggestions })}
                  />
                </Box>
              )}

              {/* Actions Tab */}
              {activeTab === 2 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Actions can launch SMART apps or external tools
                  </Alert>
                  <ActionBuilder
                    actions={card.actions || []}
                    onChange={(actions) => onChange({ ...card, actions })}
                  />
                </Box>
              )}

              {/* Advanced Tab */}
              {activeTab === 3 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Source Label"
                      value={card.source?.label || ''}
                      onChange={(e) => onChange({ 
                        ...card, 
                        source: { ...card.source, label: e.target.value }
                      })}
                      placeholder="e.g., Clinical Guidelines, Drug Database"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Source URL"
                      value={card.source?.url || ''}
                      onChange={(e) => onChange({ 
                        ...card, 
                        source: { ...card.source, url: e.target.value }
                      })}
                      placeholder="https://guidelines.example.com"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={card.selectionBehavior === 'at-most-one'}
                          onChange={(e) => onChange({ 
                            ...card, 
                            selectionBehavior: e.target.checked ? 'at-most-one' : 'any'
                          })}
                        />
                      }
                      label="Suggestions are mutually exclusive (at-most-one)"
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          </Paper>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

// Main component
const CardDesignerImproved = ({ cards = [], onChange }) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('clinical');

  // Add new card
  const addCard = (template = null) => {
    const newCard = template ? {
      id: uuidv4(),
      ...template,
      source: template.source || {}
    } : {
      id: uuidv4(),
      summary: '',
      detail: '',
      indicator: 'info',
      source: {},
      suggestions: [],
      actions: []
    };

    onChange([...cards, newCard]);
    setShowTemplates(false);
  };

  // Update card
  const updateCard = (index, updates) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], ...updates };
    onChange(newCards);
  };

  // Delete card
  const deleteCard = (index) => {
    onChange(cards.filter((_, i) => i !== index));
  };

  // Duplicate card
  const duplicateCard = (index) => {
    const newCard = {
      ...cards[index],
      id: uuidv4(),
      summary: `${cards[index].summary} (copy)`
    };
    const newCards = [...cards];
    newCards.splice(index + 1, 0, newCard);
    onChange(newCards);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h6">Response Cards</Typography>
          <Typography variant="body2" color="text.secondary">
            Design the alerts and recommendations shown to users
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowTemplates(true)}
        >
          Add Card
        </Button>
      </Box>

      {/* Cards list */}
      {cards.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary" gutterBottom>
            No cards defined yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cards provide information, warnings, and suggestions to users
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowTemplates(true)}
          >
            Create First Card
          </Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {cards.map((card, index) => (
            <CardEditor
              key={card.id}
              card={card}
              onChange={(updates) => updateCard(index, updates)}
              onDelete={() => deleteCard(index)}
              onDuplicate={() => duplicateCard(index)}
            />
          ))}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setShowTemplates(true)}
            fullWidth
          >
            Add Another Card
          </Button>
        </Stack>
      )}

      {/* Template selector dialog */}
      {showTemplates && (
        <Paper sx={{ mt: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Choose a Template
          </Typography>
          <Tabs 
            value={selectedCategory} 
            onChange={(e, v) => setSelectedCategory(v)}
            sx={{ mb: 2 }}
          >
            <Tab label="Clinical Alerts" value="clinical" />
            <Tab label="Preventive Care" value="preventive" />
            <Tab label="Chronic Disease" value="chronic" />
            <Tab label="Blank Card" value="blank" />
          </Tabs>
          
          {selectedCategory === 'blank' ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" gutterBottom>
                Start with a blank card
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => addCard()}
              >
                Create Blank Card
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {CARD_TEMPLATES[selectedCategory]?.map(template => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 2 }
                    }}
                    onClick={() => addCard(template)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {template.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {template.summary}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
          
          <Box mt={2} textAlign="right">
            <Button onClick={() => setShowTemplates(false)}>
              Cancel
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default CardDesignerImproved;