/**
 * Card Designer Component
 *
 * WYSIWYG editor for designing CDS Hook cards with live preview.
 * Allows configuration of card content, severity, suggestions, and links.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Stack,
  Divider,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  Visibility as PreviewIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import CDSCard from '../../../../components/clinical/cds/CDSCard';

/**
 * Card indicator options
 */
const CARD_INDICATORS = {
  info: { label: 'Info', icon: <InfoIcon />, color: 'info' },
  warning: { label: 'Warning', icon: <WarningIcon />, color: 'warning' },
  critical: { label: 'Critical', icon: <ErrorIcon />, color: 'error' }
};

/**
 * Suggestion action types from CDS Hooks spec
 */
const ACTION_TYPES = {
  create: 'Create Resource',
  update: 'Update Resource',
  delete: 'Delete Resource'
};

/**
 * Suggestion Builder Dialog/Section
 */
const SuggestionBuilder = ({ suggestion, onChange, onDelete }) => {
  const [actions, setActions] = useState(suggestion.actions || []);

  const handleLabelChange = (label) => {
    onChange({ ...suggestion, label });
  };

  const handleRecommendedChange = (isRecommended) => {
    onChange({ ...suggestion, isRecommended });
  };

  const handleAddAction = () => {
    const newAction = {
      type: 'create',
      description: '',
      resource: null
    };
    const updatedActions = [...actions, newAction];
    setActions(updatedActions);
    onChange({ ...suggestion, actions: updatedActions });
  };

  const handleActionChange = (index, updatedAction) => {
    const updatedActions = [...actions];
    updatedActions[index] = updatedAction;
    setActions(updatedActions);
    onChange({ ...suggestion, actions: updatedActions });
  };

  const handleDeleteAction = (index) => {
    const updatedActions = actions.filter((_, i) => i !== index);
    setActions(updatedActions);
    onChange({ ...suggestion, actions: updatedActions });
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        {/* Suggestion Label */}
        <TextField
          fullWidth
          label="Suggestion Label"
          value={suggestion.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="e.g., Order screening test"
          helperText="User-facing text for this suggestion"
        />

        {/* Is Recommended */}
        <FormControl fullWidth>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">Mark as Recommended:</Typography>
            <ToggleButtonGroup
              value={suggestion.isRecommended || false}
              exclusive
              onChange={(e, val) => val !== null && handleRecommendedChange(val)}
              size="small"
            >
              <ToggleButton value={true}>Yes</ToggleButton>
              <ToggleButton value={false}>No</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </FormControl>

        {/* Actions */}
        <Box>
          <Stack direction="row" spacing={2} alignItems="center" mb={1}>
            <Typography variant="subtitle2">Actions</Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddAction}
              variant="outlined"
            >
              Add Action
            </Button>
          </Stack>

          {actions.map((action, idx) => (
            <Paper key={idx} elevation={0} sx={{ p: 1.5, mb: 1, backgroundColor: 'grey.50' }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Action Type</InputLabel>
                    <Select
                      value={action.type || 'create'}
                      label="Action Type"
                      onChange={(e) => handleActionChange(idx, { ...action, type: e.target.value })}
                    >
                      {Object.entries(ACTION_TYPES).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    label="Description"
                    value={action.description || ''}
                    onChange={(e) => handleActionChange(idx, { ...action, description: e.target.value })}
                    sx={{ flex: 1 }}
                    placeholder="Describe what this action does"
                  />

                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteAction(idx)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>

                {/* Resource Configuration (simplified) */}
                <TextField
                  size="small"
                  label="Resource ID (optional)"
                  value={action.resourceId || ''}
                  onChange={(e) => handleActionChange(idx, { ...action, resourceId: e.target.value })}
                  placeholder="e.g., MedicationRequest/123"
                  helperText="For update/delete actions"
                />
              </Stack>
            </Paper>
          ))}

          {actions.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No actions defined. Add actions to make this suggestion actionable.
            </Typography>
          )}
        </Box>

        {/* Delete Suggestion */}
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          sx={{ alignSelf: 'flex-start' }}
        >
          Delete Suggestion
        </Button>
      </Stack>
    </Paper>
  );
};

/**
 * Link Builder Section
 */
const LinkBuilder = ({ links, onChange }) => {
  const handleAddLink = () => {
    const newLink = {
      label: '',
      url: '',
      type: 'absolute'
    };
    onChange([...links, newLink]);
  };

  const handleLinkChange = (index, updatedLink) => {
    const updatedLinks = [...links];
    updatedLinks[index] = updatedLink;
    onChange(updatedLinks);
  };

  const handleDeleteLink = (index) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Typography variant="subtitle1">Links</Typography>
        <Button
          size="small"
          startIcon={<LinkIcon />}
          onClick={handleAddLink}
          variant="outlined"
        >
          Add Link
        </Button>
      </Stack>

      {links.map((link, idx) => (
        <Paper key={idx} elevation={1} sx={{ p: 2, mb: 1 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Link Label"
                value={link.label || ''}
                onChange={(e) => handleLinkChange(idx, { ...link, label: e.target.value })}
                placeholder="e.g., Clinical Guidelines"
                sx={{ flex: 1 }}
              />

              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={link.type || 'absolute'}
                  label="Type"
                  onChange={(e) => handleLinkChange(idx, { ...link, type: e.target.value })}
                >
                  <MenuItem value="absolute">Absolute</MenuItem>
                  <MenuItem value="smart">SMART App</MenuItem>
                </Select>
              </FormControl>

              <IconButton
                color="error"
                onClick={() => handleDeleteLink(idx)}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>

            <TextField
              label="URL"
              value={link.url || ''}
              onChange={(e) => handleLinkChange(idx, { ...link, url: e.target.value })}
              placeholder="https://example.com/guidelines"
              fullWidth
            />

            {link.type === 'smart' && (
              <TextField
                label="App ID"
                value={link.appContext || ''}
                onChange={(e) => handleLinkChange(idx, { ...link, appContext: e.target.value })}
                placeholder="SMART app identifier"
                fullWidth
              />
            )}
          </Stack>
        </Paper>
      ))}

      {links.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 1 }}>
          No links defined. Add links to provide additional resources.
        </Typography>
      )}
    </Box>
  );
};

/**
 * Main Card Designer Component
 */
const CardDesigner = ({
  card,
  onChange,
  error = null
}) => {
  const [summary, setSummary] = useState(card?.summary || '');
  const [detail, setDetail] = useState(card?.detail || '');
  const [indicator, setIndicator] = useState(card?.indicator || 'info');
  const [suggestions, setSuggestions] = useState(card?.suggestions || []);
  const [links, setLinks] = useState(card?.links || []);
  const [source, setSource] = useState(card?.source || { label: '', url: '' });
  const [previewMode, setPreviewMode] = useState(false);

  // Update parent when any field changes
  const updateCard = useCallback((updates) => {
    const updatedCard = {
      summary,
      detail,
      indicator,
      suggestions,
      links,
      source,
      ...updates
    };
    onChange(updatedCard);
  }, [summary, detail, indicator, suggestions, links, source, onChange]);

  const handleSummaryChange = (newSummary) => {
    setSummary(newSummary);
    updateCard({ summary: newSummary });
  };

  const handleDetailChange = (newDetail) => {
    setDetail(newDetail);
    updateCard({ detail: newDetail });
  };

  const handleIndicatorChange = (newIndicator) => {
    setIndicator(newIndicator);
    updateCard({ indicator: newIndicator });
  };

  const handleAddSuggestion = () => {
    const newSuggestion = {
      label: '',
      isRecommended: false,
      actions: []
    };
    const updatedSuggestions = [...suggestions, newSuggestion];
    setSuggestions(updatedSuggestions);
    updateCard({ suggestions: updatedSuggestions });
  };

  const handleSuggestionChange = (index, updatedSuggestion) => {
    const updatedSuggestions = [...suggestions];
    updatedSuggestions[index] = updatedSuggestion;
    setSuggestions(updatedSuggestions);
    updateCard({ suggestions: updatedSuggestions });
  };

  const handleDeleteSuggestion = (index) => {
    const updatedSuggestions = suggestions.filter((_, i) => i !== index);
    setSuggestions(updatedSuggestions);
    updateCard({ suggestions: updatedSuggestions });
  };

  const handleLinksChange = (updatedLinks) => {
    setLinks(updatedLinks);
    updateCard({ links: updatedLinks });
  };

  const handleSourceChange = (field, value) => {
    const updatedSource = { ...source, [field]: value };
    setSource(updatedSource);
    updateCard({ source: updatedSource });
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <EditIcon color="primary" fontSize="large" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">Card Designer</Typography>
          <Typography variant="body2" color="text.secondary">
            Design the alert card that will be shown to clinicians
          </Typography>
        </Box>
        <Button
          variant={previewMode ? 'contained' : 'outlined'}
          startIcon={<PreviewIcon />}
          onClick={() => setPreviewMode(!previewMode)}
        >
          {previewMode ? 'Edit Mode' : 'Preview'}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {previewMode ? (
        /* Live Preview Mode */
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Preview Mode:</strong> This is how your card will appear in the EMR.
              Click "Edit Mode" to continue editing.
            </Typography>
          </Alert>

          <CDSCard
            card={{
              summary,
              detail,
              indicator,
              suggestions,
              links,
              source
            }}
            serviceId="preview-service"
            hookInstance="preview"
            onAcceptSuggestion={() => console.log('Preview: Suggestion accepted')}
            onDismiss={() => console.log('Preview: Card dismissed')}
          />
        </Box>
      ) : (
        /* Edit Mode */
        <Grid container spacing={3}>
          {/* Left Panel - Card Content */}
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              {/* Basic Card Info */}
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Card Content
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  {/* Summary */}
                  <TextField
                    fullWidth
                    label="Summary"
                    value={summary}
                    onChange={(e) => handleSummaryChange(e.target.value)}
                    placeholder="Brief one-line summary of the alert"
                    required
                    helperText="Clear, concise summary (required)"
                  />

                  {/* Detail */}
                  <TextField
                    fullWidth
                    label="Detail"
                    value={detail}
                    onChange={(e) => handleDetailChange(e.target.value)}
                    placeholder="Detailed explanation of the alert and recommended action"
                    multiline
                    rows={4}
                    helperText="Provide clinical context and rationale"
                  />

                  {/* Indicator */}
                  <FormControl fullWidth>
                    <InputLabel>Severity Indicator</InputLabel>
                    <Select
                      value={indicator}
                      label="Severity Indicator"
                      onChange={(e) => handleIndicatorChange(e.target.value)}
                    >
                      {Object.entries(CARD_INDICATORS).map(([value, config]) => (
                        <MenuItem key={value} value={value}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {config.icon}
                            <Typography>{config.label}</Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Source */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Source Information
                    </Typography>
                    <Stack spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Source Label"
                        value={source.label || ''}
                        onChange={(e) => handleSourceChange('label', e.target.value)}
                        placeholder="e.g., Clinical Guidelines Database"
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Source URL (optional)"
                        value={source.url || ''}
                        onChange={(e) => handleSourceChange('url', e.target.value)}
                        placeholder="https://example.com/source"
                      />
                    </Stack>
                  </Box>
                </Stack>
              </Paper>

              {/* Links */}
              <Paper elevation={2} sx={{ p: 3 }}>
                <LinkBuilder
                  links={links}
                  onChange={handleLinksChange}
                />
              </Paper>
            </Stack>
          </Grid>

          {/* Right Panel - Suggestions */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Typography variant="subtitle1" sx={{ flex: 1 }}>
                  Suggestions
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddSuggestion}
                  variant="contained"
                >
                  Add Suggestion
                </Button>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {suggestions.length > 0 ? (
                <Box>
                  {suggestions.map((suggestion, idx) => (
                    <SuggestionBuilder
                      key={idx}
                      suggestion={suggestion}
                      onChange={(updated) => handleSuggestionChange(idx, updated)}
                      onDelete={() => handleDeleteSuggestion(idx)}
                    />
                  ))}
                </Box>
              ) : (
                <Alert severity="info">
                  <Typography variant="body2">
                    No suggestions defined. Add suggestions to make this card actionable.
                  </Typography>
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Helper Info */}
      {!previewMode && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Tip:</strong> Use the Preview mode to see how your card will appear to clinicians.
            Suggestions allow users to take action directly from the alert.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default CardDesigner;
