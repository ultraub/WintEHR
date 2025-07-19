/**
 * Card Designer - Visual interface for designing CDS cards
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Divider,
  Switch,
  FormControlLabel,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  DragIndicator as DragIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Lightbulb as SuggestionIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  Link as LinkInsertIcon,
  ListAlt as ListIcon,
  Settings as AdvancedIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';

// Card indicator types
const CARD_INDICATORS = [
  { id: 'info', label: 'Info', icon: <InfoIcon />, color: '#2196F3' },
  { id: 'warning', label: 'Warning', icon: <WarningIcon />, color: '#FF9800' },
  { id: 'critical', label: 'Critical', icon: <ErrorIcon />, color: '#F44336' },
  { id: 'success', label: 'Success', icon: <SuccessIcon />, color: '#4CAF50' }
];

// Card templates
const CARD_TEMPLATES = {
  alert: {
    name: 'Clinical Alert',
    summary: 'Important clinical alert',
    detail: 'This patient requires immediate attention for the following reason:\n\n* Reason 1\n* Reason 2',
    indicator: 'warning',
    source: { label: 'Clinical Guidelines' }
  },
  recommendation: {
    name: 'Treatment Recommendation',
    summary: 'Recommended intervention',
    detail: 'Based on current clinical data, consider the following:\n\n1. Intervention 1\n2. Intervention 2',
    indicator: 'info',
    suggestions: [{ label: 'Order Test', type: 'create' }]
  },
  reminder: {
    name: 'Care Reminder',
    summary: 'Preventive care due',
    detail: 'The patient is due for the following preventive care measures.',
    indicator: 'info',
    source: { label: 'Care Guidelines' }
  },
  risk: {
    name: 'Risk Assessment',
    summary: 'Elevated risk detected',
    detail: 'Risk factors identified:\n\n* Factor 1: Description\n* Factor 2: Description',
    indicator: 'critical',
    links: [{ label: 'Risk Calculator', url: 'https://example.com/calculator' }]
  }
};

// Suggestion action types
const SUGGESTION_ACTIONS = [
  { id: 'create', label: 'Create Order' },
  { id: 'delete', label: 'Remove Order' },
  { id: 'update', label: 'Update Order' },
  { id: 'view', label: 'View Details' }
];

// Variables that can be inserted into card text
const AVAILABLE_VARIABLES = [
  { id: 'patient.name', label: 'Patient Name', example: 'John Doe' },
  { id: 'patient.age', label: 'Patient Age', example: '45 years' },
  { id: 'patient.gender', label: 'Patient Gender', example: 'Male' },
  { id: 'condition.name', label: 'Condition Name', example: 'Diabetes' },
  { id: 'medication.name', label: 'Medication Name', example: 'Metformin' },
  { id: 'lab.value', label: 'Lab Value', example: '7.2%' },
  { id: 'date.today', label: 'Today\'s Date', example: '2025-01-08' }
];

// Card editor dialog
const CardEditorDialog = ({ open, onClose, card, onSave }) => {
  const [editedCard, setEditedCard] = useState(card || {
    id: uuidv4(),
    summary: '',
    detail: '',
    indicator: 'info',
    source: { label: '' },
    suggestions: [],
    links: [],
    selectionBehavior: 'any'
  });
  const [activeTab, setActiveTab] = useState(0);
  const [showVariables, setShowVariables] = useState(false);

  const handleSave = () => {
    onSave(editedCard);
    onClose();
  };

  const addSuggestion = () => {
    setEditedCard({
      ...editedCard,
      suggestions: [
        ...editedCard.suggestions,
        { label: '', type: 'create', actions: [] }
      ]
    });
  };

  const updateSuggestion = (index, updates) => {
    const newSuggestions = [...editedCard.suggestions];
    newSuggestions[index] = { ...newSuggestions[index], ...updates };
    setEditedCard({ ...editedCard, suggestions: newSuggestions });
  };

  const deleteSuggestion = (index) => {
    setEditedCard({
      ...editedCard,
      suggestions: editedCard.suggestions.filter((_, i) => i !== index)
    });
  };

  const addLink = () => {
    setEditedCard({
      ...editedCard,
      links: [
        ...(editedCard.links || []),
        { label: '', url: '', type: 'absolute' }
      ]
    });
  };

  const updateLink = (index, updates) => {
    const newLinks = [...(editedCard.links || [])];
    newLinks[index] = { ...newLinks[index], ...updates };
    setEditedCard({ ...editedCard, links: newLinks });
  };

  const deleteLink = (index) => {
    setEditedCard({
      ...editedCard,
      links: editedCard.links.filter((_, i) => i !== index)
    });
  };

  const insertVariable = (variable) => {
    const currentDetail = editedCard.detail || '';
    setEditedCard({
      ...editedCard,
      detail: currentDetail + ` {{${variable.id}}}`
    });
  };

  const applyTemplate = (template) => {
    setEditedCard({
      ...editedCard,
      ...template,
      id: editedCard.id // Preserve ID
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {card ? 'Edit Card' : 'Create New Card'}
          </Typography>
          <Select
            value=""
            onChange={(e) => applyTemplate(CARD_TEMPLATES[e.target.value])}
            displayEmpty
            size="small"
          >
            <MenuItem value="" disabled>Apply Template</MenuItem>
            {Object.entries(CARD_TEMPLATES).map(([key, template]) => (
              <MenuItem key={key} value={key}>{template.name}</MenuItem>
            ))}
          </Select>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Content" />
          <Tab label="Actions" />
          <Tab label="Advanced" />
          <Tab label="Preview" />
        </Tabs>

        {/* Content Tab */}
        {activeTab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Summary"
                value={editedCard.summary}
                onChange={(e) => setEditedCard({ ...editedCard, summary: e.target.value })}
                required
                helperText="Brief one-line summary of the card"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Indicator</InputLabel>
                <Select
                  value={editedCard.indicator}
                  onChange={(e) => setEditedCard({ ...editedCard, indicator: e.target.value })}
                  label="Indicator"
                >
                  {CARD_INDICATORS.map(indicator => (
                    <MenuItem key={indicator.id} value={indicator.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {indicator.icon}
                        <Typography>{indicator.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Source"
                value={editedCard.source?.label || ''}
                onChange={(e) => setEditedCard({ 
                  ...editedCard, 
                  source: { label: e.target.value } 
                })}
                helperText="e.g., Clinical Guidelines, Evidence-Based Medicine"
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2">Detail (Markdown Supported)</Typography>
                <Button
                  size="small"
                  onClick={() => setShowVariables(!showVariables)}
                  startIcon={<CodeIcon />}
                >
                  Insert Variable
                </Button>
              </Box>
              
              {showVariables && (
                <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
                  <Grid container spacing={1}>
                    {AVAILABLE_VARIABLES.map(variable => (
                      <Grid item key={variable.id}>
                        <Chip
                          label={variable.label}
                          size="small"
                          onClick={() => insertVariable(variable)}
                          clickable
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}

              <TextField
                fullWidth
                multiline
                rows={6}
                value={editedCard.detail}
                onChange={(e) => setEditedCard({ ...editedCard, detail: e.target.value })}
                placeholder="Detailed explanation with markdown formatting..."
                helperText="Use **bold**, *italic*, [links](url), and variables like {{patient.name}}"
              />
            </Grid>
          </Grid>
        )}

        {/* Actions Tab */}
        {activeTab === 1 && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Suggestions</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={addSuggestion}
                size="small"
              >
                Add Suggestion
              </Button>
            </Box>

            <List>
              {editedCard.suggestions.map((suggestion, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <SuggestionIcon />
                  </ListItemIcon>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Label"
                        value={suggestion.label}
                        onChange={(e) => updateSuggestion(index, { label: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Action</InputLabel>
                        <Select
                          value={suggestion.type}
                          onChange={(e) => updateSuggestion(index, { type: e.target.value })}
                          label="Action"
                        >
                          {SUGGESTION_ACTIONS.map(action => (
                            <MenuItem key={action.id} value={action.id}>
                              {action.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <IconButton onClick={() => deleteSuggestion(index)} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 3 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Links</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={addLink}
                size="small"
              >
                Add Link
              </Button>
            </Box>

            <List>
              {(editedCard.links || []).map((link, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <LinkIcon />
                  </ListItemIcon>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Label"
                        value={link.label}
                        onChange={(e) => updateLink(index, { label: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="URL"
                        value={link.url}
                        onChange={(e) => updateLink(index, { url: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <IconButton onClick={() => deleteLink(index)} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Advanced Tab */}
        {activeTab === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Selection Behavior</InputLabel>
                <Select
                  value={editedCard.selectionBehavior || 'any'}
                  onChange={(e) => setEditedCard({ ...editedCard, selectionBehavior: e.target.value })}
                  label="Selection Behavior"
                >
                  <MenuItem value="any">Any (User can select any suggestion)</MenuItem>
                  <MenuItem value="at-most-one">At Most One</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editedCard.overrideReasons?.required || false}
                    onChange={(e) => setEditedCard({
                      ...editedCard,
                      overrideReasons: { required: e.target.checked }
                    })}
                  />
                }
                label="Require override reason if card is dismissed"
              />
            </Grid>
          </Grid>
        )}

        {/* Preview Tab */}
        {activeTab === 3 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              This is how your card will appear to users
            </Alert>
            
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  {CARD_INDICATORS.find(i => i.id === editedCard.indicator)?.icon}
                  <Typography variant="h6">
                    {editedCard.summary || 'Card Summary'}
                  </Typography>
                </Box>
                
                {editedCard.source?.label && (
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Source: {editedCard.source.label}
                  </Typography>
                )}
                
                <Divider sx={{ my: 1 }} />
                
                <Box sx={{ '& p': { margin: 0 } }}>
                  <ReactMarkdown>
                    {editedCard.detail || 'Card detail will appear here...'}
                  </ReactMarkdown>
                </Box>
                
                {editedCard.suggestions.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Suggestions:
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {editedCard.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outlined"
                          size="small"
                          startIcon={<SuggestionIcon />}
                        >
                          {suggestion.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
                
                {editedCard.links?.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Links:
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {editedCard.links.map((link, index) => (
                        <Button
                          key={index}
                          size="small"
                          startIcon={<LinkIcon />}
                          href={link.url}
                          target="_blank"
                        >
                          {link.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Card
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Card Designer component
const CardDesigner = ({ cards = [], onChange, hookType }) => {
  const [editingCard, setEditingCard] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(cards);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange(items);
  };

  const addCard = () => {
    setEditingCard(null);
    setShowEditor(true);
  };

  const editCard = (card) => {
    setEditingCard(card);
    setShowEditor(true);
  };

  const saveCard = (card) => {
    if (editingCard) {
      // Update existing card
      const updatedCards = cards.map(c => c.id === card.id ? card : c);
      onChange(updatedCards);
    } else {
      // Add new card
      onChange([...cards, card]);
    }
  };

  const deleteCard = (cardId) => {
    onChange(cards.filter(c => c.id !== cardId));
  };

  const duplicateCard = (card) => {
    const newCard = {
      ...card,
      id: uuidv4(),
      summary: `${card.summary} (Copy)`
    };
    onChange([...cards, newCard]);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Decision Cards</Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={addCard}
          variant="contained"
        >
          Add Card
        </Button>
      </Box>

      {cards.length === 0 ? (
        <Alert severity="warning">
          No cards defined. Add at least one card to provide guidance to users.
        </Alert>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="cards">
            {(provided) => (
              <Box ref={provided.innerRef} {...provided.droppableProps}>
                {cards.map((card, index) => (
                  <Draggable key={card.id} draggableId={card.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          mb: 2,
                          backgroundColor: snapshot.isDragging ? 'action.hover' : 'background.paper'
                        }}
                      >
                        <CardContent>
                          <Grid container alignItems="center" spacing={2}>
                            <Grid item>
                              <Box {...provided.dragHandleProps}>
                                <DragIcon color="action" />
                              </Box>
                            </Grid>
                            
                            <Grid item xs>
                              <Box display="flex" alignItems="center" gap={1}>
                                {CARD_INDICATORS.find(i => i.id === card.indicator)?.icon}
                                <Typography variant="subtitle1">
                                  {card.summary}
                                </Typography>
                              </Box>
                              {card.source?.label && (
                                <Typography variant="caption" color="text.secondary">
                                  Source: {card.source.label}
                                </Typography>
                              )}
                            </Grid>
                            
                            <Grid item>
                              <Stack direction="row" spacing={1}>
                                <Tooltip title="Edit">
                                  <IconButton onClick={() => editCard(card)} size="small">
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Duplicate">
                                  <IconButton onClick={() => duplicateCard(card)} size="small">
                                    <DuplicateIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton onClick={() => deleteCard(card.id)} size="small" color="error">
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <CardEditorDialog
        open={showEditor}
        onClose={() => setShowEditor(false)}
        card={editingCard}
        onSave={saveCard}
      />
    </Box>
  );
};

export default CardDesigner;