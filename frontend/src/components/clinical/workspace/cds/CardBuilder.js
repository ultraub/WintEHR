/**
 * Card Builder Component
 * Enhanced interface for building CDS cards with tabs for different aspects
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Grid,
  Chip,
  IconButton,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';

const CARD_INDICATORS = [
  { value: 'info', label: 'Info', color: 'info', icon: <InfoIcon /> },
  { value: 'warning', label: 'Warning', color: 'warning', icon: <WarningIcon /> },
  { value: 'critical', label: 'Critical', color: 'error', icon: <ErrorIcon /> }
];

const LINK_TYPES = [
  { value: 'absolute', label: 'External URL', description: 'Opens in new tab' },
  { value: 'smart', label: 'SMART App', description: 'Launch SMART app' }
];

function TabPanel({ children, value, index, ...other }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`card-tabpanel-${index}`}
      aria-labelledby={`card-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </Box>
  );
}

const CardBuilder = ({ card, onChange, onRemove }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  const handleChange = (field, value) => {
    onChange({ ...card, [field]: value });
  };

  const addLink = () => {
    const newLink = {
      id: Date.now(),
      label: '',
      url: '',
      type: 'absolute'
    };
    handleChange('links', [...(card.links || []), newLink]);
  };

  const updateLink = (linkId, updates) => {
    const updatedLinks = (card.links || []).map(link =>
      link.id === linkId ? { ...link, ...updates } : link
    );
    handleChange('links', updatedLinks);
  };

  const removeLink = (linkId) => {
    const updatedLinks = (card.links || []).filter(link => link.id !== linkId);
    handleChange('links', updatedLinks);
  };

  const addSource = () => {
    const newSource = {
      label: '',
      url: '',
      icon: ''
    };
    handleChange('source', newSource);
  };

  const renderBasicTab = () => (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Card Summary"
          value={card.summary || ''}
          onChange={(e) => handleChange('summary', e.target.value)}
          required
          helperText="Brief, actionable summary of the alert"
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Card Details"
          value={card.detail || ''}
          onChange={(e) => handleChange('detail', e.target.value)}
          helperText="Detailed explanation and clinical context"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Indicator Level</InputLabel>
          <Select
            value={card.indicator || 'info'}
            label="Indicator Level"
            onChange={(e) => handleChange('indicator', e.target.value)}
          >
            {CARD_INDICATORS.map(indicator => (
              <MenuItem key={indicator.value} value={indicator.value}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {indicator.icon}
                  <Typography>{indicator.label}</Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          label="Selection Behavior"
          value={card.selectionBehavior || 'any'}
          onChange={(e) => handleChange('selectionBehavior', e.target.value)}
          select
          helperText="How suggestions should be selected"
        >
          <MenuItem value="any">Any</MenuItem>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="at-most-one">At Most One</MenuItem>
        </TextField>
      </Grid>
    </Grid>
  );

  const renderLinksTab = () => (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">External Links</Typography>
        <Button startIcon={<AddIcon />} onClick={addLink} size="small">
          Add Link
        </Button>
      </Stack>
      
      {(!card.links || card.links.length === 0) ? (
        <Alert severity="info">
          No links added. Links provide additional resources or references.
        </Alert>
      ) : (
        <List>
          {card.links.map((link, index) => (
            <ListItem key={link.id || index} divider>
              <ListItemText>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Link Label"
                      value={link.label}
                      onChange={(e) => updateLink(link.id, { label: e.target.value })}
                      placeholder="Learn more"
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="URL"
                      value={link.url}
                      onChange={(e) => updateLink(link.id, { url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={link.type}
                        label="Type"
                        onChange={(e) => updateLink(link.id, { type: e.target.value })}
                      >
                        {LINK_TYPES.map(type => (
                          <MenuItem key={type.value} value={type.value}>
                            {type.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </ListItemText>
              <ListItemSecondaryAction>
                <IconButton edge="end" onClick={() => removeLink(link.id)}>
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );

  const renderSourceTab = () => (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Source Information</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Source Label"
            value={card.source?.label || ''}
            onChange={(e) => handleChange('source', { ...card.source, label: e.target.value })}
            placeholder="Clinical Guidelines"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Source URL"
            value={card.source?.url || ''}
            onChange={(e) => handleChange('source', { ...card.source, url: e.target.value })}
            placeholder="https://guidelines.example.com"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Source Icon URL"
            value={card.source?.icon || ''}
            onChange={(e) => handleChange('source', { ...card.source, icon: e.target.value })}
            placeholder="https://example.com/icon.png"
            helperText="Optional icon URL for the source"
          />
        </Grid>
      </Grid>
    </Stack>
  );

  const renderAdvancedTab = () => (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Advanced Settings</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Override Reasons"
            value={card.overrideReasons || ''}
            onChange={(e) => handleChange('overrideReasons', e.target.value)}
            multiline
            rows={2}
            helperText="Comma-separated list of valid override reasons"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={card.overrideReasonRequired || false}
                onChange={(e) => handleChange('overrideReasonRequired', e.target.checked)}
              />
            }
            label="Override reason required"
            helperText="When checked, users must provide a reason to override this recommendation"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="UUID"
            value={card.uuid || ''}
            onChange={(e) => handleChange('uuid', e.target.value)}
            helperText="Unique identifier for card tracking"
          />
        </Grid>
      </Grid>
    </Stack>
  );

  const renderPreview = () => (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {CARD_INDICATORS.find(i => i.value === card.indicator)?.icon}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" gutterBottom>
                {card.summary || 'Card Summary'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {card.detail || 'Card details will appear here...'}
              </Typography>
              
              {card.links && card.links.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {card.links.map((link, index) => (
                    <Chip
                      key={index}
                      label={link.label || 'Link'}
                      icon={<LinkIcon />}
                      onClick={() => {}}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              )}
              
              {card.source && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Source: {card.source.label || 'Unknown'}
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Card Builder</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title={previewMode ? "Edit Mode" : "Preview Mode"}>
              <IconButton onClick={() => setPreviewMode(!previewMode)}>
                {previewMode ? <CodeIcon /> : <PreviewIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove Card">
              <IconButton color="error" onClick={onRemove}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Divider />

        {previewMode ? (
          renderPreview()
        ) : (
          <>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
              <Tab label="Basic Info" />
              <Tab label="Links" />
              <Tab label="Source" />
              <Tab label="Advanced" />
            </Tabs>

            <TabPanel value={activeTab} index={0}>
              {renderBasicTab()}
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              {renderLinksTab()}
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              {renderSourceTab()}
            </TabPanel>
            <TabPanel value={activeTab} index={3}>
              {renderAdvancedTab()}
            </TabPanel>
          </>
        )}
      </Stack>
    </Paper>
  );
};

export default CardBuilder;