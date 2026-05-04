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
  Grid,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import CDSCard from '../../../../components/clinical/cds/CDSCard';
import SuggestionActionBuilder from './SuggestionActionBuilder';

/**
 * Read-only preview shown in place of the static Summary/Detail input
 * when the parent CQL has a matching `define CardSummary:` / `CardDetail:`
 * literal. The CQL value wins at $apply time anyway, so the static field
 * would be unreachable — surfacing the CQL value here is honest about
 * what the runtime will display.
 */
const CqlOverridePreview = ({ label, value, onJumpToCQL, multiline = false }) => (
  <Box
    sx={{
      border: 1,
      borderColor: 'divider',
      borderRadius: 0,
      p: 1.5,
      backgroundColor: 'action.hover',
    }}
  >
    <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        {label}
      </Typography>
      {onJumpToCQL && (
        <Button size="small" startIcon={<EditIcon />} onClick={onJumpToCQL}>
          Edit in CQL
        </Button>
      )}
    </Stack>
    <Typography
      variant="body2"
      sx={{
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        fontStyle: 'italic',
        color: 'text.primary',
      }}
    >
      {value || <span style={{ color: 'rgba(0,0,0,0.4)' }}>(empty string from CQL)</span>}
    </Typography>
  </Box>
);

/**
 * Card indicator options
 */
const CARD_INDICATORS = {
  info: { label: 'Info', icon: <InfoIcon />, color: 'info' },
  warning: { label: 'Warning', icon: <WarningIcon />, color: 'warning' },
  critical: { label: 'Critical', icon: <ErrorIcon />, color: 'error' }
};

/**
 * Suggestion editor — label + isRecommended + templated FHIR actions.
 * Actions are persisted in CDS Hooks 2.0 runtime shape (`{type, description,
 * resource}`); the action builder owns the catalog UI and the runtime↔builder
 * conversion.
 */
const SuggestionBuilder = ({ suggestion, onChange, onDelete }) => {
  const handleLabelChange = (label) => {
    onChange({ ...suggestion, label });
  };

  const handleRecommendedChange = (isRecommended) => {
    onChange({ ...suggestion, isRecommended });
  };

  const handleActionsChange = (actions) => {
    onChange({ ...suggestion, actions });
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Suggestion Label"
          value={suggestion.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="e.g., Order screening test"
          helperText="User-facing text for this suggestion"
        />

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

        <SuggestionActionBuilder
          actions={suggestion.actions || []}
          onChange={handleActionsChange}
        />

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
  error = null,
  // When the parent CQL has `define CardSummary:` / `CardDetail:` string
  // literals, surface them as `{ summary?, detail? }`. The matching
  // static input is replaced with a read-only preview because the CQL
  // value overrides the static action.title/description at $apply time
  // anyway (cql_artifact_builder wires it as PlanDefinition.action.dynamicValue).
  cqlOverrides = {},
  // Optional callback to jump back to the Build Logic step. Used by the
  // "Edit in CQL" affordance on the read-only preview.
  onJumpToCQL,
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
            onAcceptSuggestion={() => {}}
            onDismiss={() => {}}
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
                  {/* Summary — read-only preview when CQL provides CardSummary */}
                  {cqlOverrides.summary !== undefined ? (
                    <CqlOverridePreview
                      label="Summary (from CQL CardSummary)"
                      value={cqlOverrides.summary}
                      onJumpToCQL={onJumpToCQL}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label="Summary"
                      value={summary}
                      onChange={(e) => handleSummaryChange(e.target.value)}
                      placeholder="Brief one-line summary of the alert"
                      required
                      helperText="Clear, concise summary (required)"
                    />
                  )}

                  {/* Detail — read-only preview when CQL provides CardDetail */}
                  {cqlOverrides.detail !== undefined ? (
                    <CqlOverridePreview
                      label="Detail (from CQL CardDetail)"
                      value={cqlOverrides.detail}
                      onJumpToCQL={onJumpToCQL}
                      multiline
                    />
                  ) : (
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
                  )}

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
