/**
 * Presentation Mode Selector
 *
 * Visual selector for CDS alert presentation modes with interactive previews.
 * Provides a card-based interface showing all 9 presentation modes with
 * visual examples, characteristics, and best-use recommendations.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Stack,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Badge,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  Visibility as PreviewIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Notifications as BellIcon
} from '@mui/icons-material';

import { PRESENTATION_MODES, getRecommendedMode } from '../../types/displayModes';

/**
 * Mode Preview Dialog - Shows detailed mode information
 */
const ModePreviewDialog = ({ mode, open, onClose }) => {
  if (!mode) return null;

  const severityColors = {
    critical: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6'
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h5">{mode.icon}</Typography>
          <Typography variant="h6">{mode.label}</Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ marginLeft: 'auto' }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Description */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1">{mode.description}</Typography>
          </Box>

          {/* Best For */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Best For
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {mode.bestFor.map((use, index) => (
                <Chip key={index} label={use} color="primary" size="small" />
              ))}
            </Stack>
          </Box>

          {/* Characteristics */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Characteristics
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {mode.characteristics.map((char, index) => (
                <Typography key={index} component="li" variant="body2">
                  {char}
                </Typography>
              ))}
            </Box>
          </Box>

          {/* Configuration Options */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Configuration Options
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              {Object.entries(mode.configOptions || {}).map(([key, config]) => (
                <Box key={key} mb={1}>
                  <Typography variant="caption" fontWeight="bold">
                    {key}:
                  </Typography>
                  <Typography variant="caption" color="text.secondary" ml={1}>
                    {config.type} (default: {JSON.stringify(config.default)})
                  </Typography>
                </Box>
              ))}
            </Paper>
          </Box>

          {/* Visual Example */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Visual Example
            </Typography>
            <Paper
              elevation={3}
              sx={{
                p: 2,
                backgroundColor: mode.preview.color,
                color: 'white',
                position: 'relative',
                minHeight: 100
              }}
            >
              <Typography variant="body2" fontWeight="bold">
                {mode.label} Example
              </Typography>
              <Typography variant="caption">
                Layout: {mode.preview.layout} | Position: {mode.preview.position}
              </Typography>

              {/* Position indicator */}
              <Box
                sx={{
                  position: 'absolute',
                  ...(mode.preview.position === 'top' && { top: 0, left: 0, right: 0 }),
                  ...(mode.preview.position === 'bottom-right' && { bottom: 0, right: 0 }),
                  ...(mode.preview.position === 'right' && { top: 0, right: 0, bottom: 0 }),
                  ...(mode.preview.position === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
                  width: mode.preview.position.includes('right') ? '50%' : '100%',
                  height: mode.preview.position.includes('top') || mode.preview.position.includes('bottom') ? '40px' : '100%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed rgba(255,255,255,0.5)'
                }}
              >
                <Typography variant="caption" fontWeight="bold">
                  Alert appears here
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Mode Card Component
 */
const ModeCard = ({ mode, selected, recommended, onSelect, onPreview }) => {
  const isRecommended = recommended.includes(mode.id.toUpperCase());

  return (
    <Card
      elevation={selected ? 8 : 1}
      sx={{
        height: '100%',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        position: 'relative',
        transition: 'all 0.2s',
        '&:hover': {
          elevation: 4,
          borderColor: 'primary.light'
        }
      }}
    >
      {isRecommended && (
        <Chip
          label="Recommended"
          color="success"
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1
          }}
        />
      )}

      <CardActionArea onClick={onSelect} sx={{ height: '100%' }}>
        <CardContent>
          <Stack spacing={2}>
            {/* Icon and Title */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="h4">{mode.icon}</Typography>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" component="div">
                  {mode.label}
                </Typography>
                {selected && (
                  <Chip
                    icon={<CheckIcon />}
                    label="Selected"
                    color="primary"
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
            </Stack>

            {/* Description */}
            <Typography variant="body2" color="text.secondary">
              {mode.description}
            </Typography>

            {/* Best For Tags */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Best for:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {mode.bestFor.slice(0, 3).map((use, index) => (
                  <Chip key={index} label={use} size="small" variant="outlined" />
                ))}
                {mode.bestFor.length > 3 && (
                  <Chip label={`+${mode.bestFor.length - 3}`} size="small" variant="outlined" />
                )}
              </Stack>
            </Box>

            {/* Preview Button */}
            <Button
              size="small"
              startIcon={<PreviewIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onPreview(mode);
              }}
              variant="outlined"
            >
              Preview Details
            </Button>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

/**
 * Category Filter Component
 */
const CategoryFilter = ({ category, onCategoryChange }) => {
  const categories = [
    { value: 'all', label: 'All Modes', icon: '📋' },
    { value: 'critical', label: 'Critical Alerts', icon: '🚨' },
    { value: 'warning', label: 'Warnings', icon: '⚠️' },
    { value: 'info', label: 'Information', icon: 'ℹ️' },
    { value: 'passive', label: 'Passive', icon: '🔔' }
  ];

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      {categories.map((cat) => (
        <Chip
          key={cat.value}
          icon={<span>{cat.icon}</span>}
          label={cat.label}
          onClick={() => onCategoryChange(cat.value)}
          color={category === cat.value ? 'primary' : 'default'}
          variant={category === cat.value ? 'filled' : 'outlined'}
        />
      ))}
    </Stack>
  );
};

/**
 * Main Presentation Mode Selector Component
 */
const PresentationModeSelector = ({
  selectedMode,
  onModeSelect,
  cardIndicator = 'info',
  showRecommendations = true,
  allowPreview = true
}) => {
  const [category, setCategory] = useState('all');
  const [previewMode, setPreviewMode] = useState(null);

  // Get recommended modes based on card indicator
  const recommendedModes = showRecommendations ? getRecommendedMode(cardIndicator) : [];

  // Filter modes by category
  const getFilteredModes = () => {
    const allModes = Object.values(PRESENTATION_MODES);

    if (category === 'all') return allModes;

    // Category-based filtering
    const categoryMap = {
      critical: ['MODAL', 'BANNER'],
      warning: ['POPUP', 'SIDEBAR', 'INLINE'],
      info: ['INLINE', 'CARD', 'TOAST'],
      passive: ['COMPACT', 'DRAWER', 'TOAST']
    };

    const categoryKeys = categoryMap[category] || [];
    return allModes.filter(mode =>
      categoryKeys.includes(mode.id.toUpperCase())
    );
  };

  const filteredModes = getFilteredModes();

  return (
    <Box>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h5" gutterBottom>
            Select Presentation Mode
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose how your CDS alert will be displayed to clinicians in the EMR
          </Typography>
        </Box>

        {/* Recommendations Alert */}
        {showRecommendations && recommendedModes.length > 0 && (
          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="body2">
              <strong>Recommended for {cardIndicator} alerts:</strong>{' '}
              {recommendedModes.map((mode, index) => (
                <React.Fragment key={mode}>
                  {index > 0 && ', '}
                  <strong>{PRESENTATION_MODES[mode]?.label || mode}</strong>
                </React.Fragment>
              ))}
            </Typography>
          </Alert>
        )}

        {/* Category Filter */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Filter by Use Case
          </Typography>
          <CategoryFilter category={category} onCategoryChange={setCategory} />
        </Box>

        <Divider />

        {/* Mode Cards Grid */}
        <Grid container spacing={3}>
          {filteredModes.map((mode) => (
            <Grid item xs={12} sm={6} md={4} key={mode.id}>
              <ModeCard
                mode={mode}
                selected={selectedMode === mode.id}
                recommended={recommendedModes}
                onSelect={() => onModeSelect(mode.id)}
                onPreview={allowPreview ? setPreviewMode : null}
              />
            </Grid>
          ))}
        </Grid>

        {/* No Results */}
        {filteredModes.length === 0 && (
          <Alert severity="info">
            <Typography variant="body2">
              No modes found for the selected category. Try selecting "All Modes".
            </Typography>
          </Alert>
        )}

        {/* Quick Comparison */}
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Comparison Guide
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={0.5}>
                <Typography variant="caption" fontWeight="bold" color="error.main">
                  Critical Alerts
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • Hard-Stop Modal<br />
                  • Top Banner
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={0.5}>
                <Typography variant="caption" fontWeight="bold" color="warning.main">
                  Warnings
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • Modal Dialog<br />
                  • Side Panel<br />
                  • Inline Alert
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={0.5}>
                <Typography variant="caption" fontWeight="bold" color="info.main">
                  Information
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • Inline Alert<br />
                  • Card View<br />
                  • Toast Notification
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={0.5}>
                <Typography variant="caption" fontWeight="bold" color="text.secondary">
                  Low Priority
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • Compact Icon<br />
                  • Slide-out Drawer<br />
                  • Toast
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Selected Mode Summary */}
        {selectedMode && (
          <Paper elevation={2} sx={{ p: 2, backgroundColor: 'primary.50' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <CheckIcon color="primary" />
              <Typography variant="body2">
                <strong>Selected Mode:</strong>{' '}
                {PRESENTATION_MODES[Object.keys(PRESENTATION_MODES).find(
                  key => PRESENTATION_MODES[key].id === selectedMode
                )]?.label || selectedMode}
              </Typography>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Preview Dialog */}
      {allowPreview && previewMode && (
        <ModePreviewDialog
          mode={previewMode}
          open={Boolean(previewMode)}
          onClose={() => setPreviewMode(null)}
        />
      )}
    </Box>
  );
};

export default PresentationModeSelector;
