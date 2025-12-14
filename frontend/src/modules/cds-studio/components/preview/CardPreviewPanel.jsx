/**
 * Card Preview Panel
 *
 * Provides real-time preview of CDS card as user designs it.
 * Shows how the card will appear in different presentation modes.
 * Helps designers visualize the final user experience.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Tabs,
  Tab,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Visibility as PreviewIcon,
  Phone as PhoneIcon,
  Tablet as TabletIcon,
  Computer as DesktopIcon,
  Code as CodeIcon
} from '@mui/icons-material';

import CDSCard from '../../../../components/clinical/cds/CDSCard';
import CDSPresentation from '../../../../components/clinical/cds/CDSPresentation';

/**
 * Card Preview Panel Component
 */
const CardPreviewPanel = ({
  card,
  displayConfig,
  serviceId = 'preview-service'
}) => {
  const [previewMode, setPreviewMode] = useState('card'); // 'card' or 'presentation'
  const [devicePreview, setDevicePreview] = useState('desktop'); // 'phone', 'tablet', 'desktop'
  const [showRawJSON, setShowRawJSON] = useState(false);

  // Device dimensions for responsive preview
  const deviceDimensions = {
    phone: { width: 375, label: 'iPhone (375px)' },
    tablet: { width: 768, label: 'iPad (768px)' },
    desktop: { width: '100%', label: 'Desktop (Full)' }
  };

  // Get presentation mode from display config
  const presentationMode = displayConfig?.presentationMode || 'inline';

  // Create preview card object
  const previewCard = {
    uuid: 'preview-card',
    summary: card?.summary || 'Card summary',
    detail: card?.detail || 'Card detail text',
    indicator: card?.indicator || 'info',
    source: card?.source || { label: 'Preview Source' },
    suggestions: card?.suggestions || [],
    links: card?.links || []
  };

  return (
    <Box>
      {/* Preview Controls */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
          {/* Preview Mode Tabs */}
          <Tabs
            value={previewMode}
            onChange={(e, newValue) => setPreviewMode(newValue)}
            sx={{ minHeight: 'auto' }}
          >
            <Tab
              icon={<PreviewIcon />}
              label="Card Only"
              value="card"
              iconPosition="start"
            />
            <Tab
              icon={<PreviewIcon />}
              label="With Presentation"
              value="presentation"
              iconPosition="start"
            />
            <Tab
              icon={<CodeIcon />}
              label="JSON"
              value="json"
              iconPosition="start"
            />
          </Tabs>

          {/* Device Preview Selector */}
          {(previewMode === 'card' || previewMode === 'presentation') && (
            <ToggleButtonGroup
              value={devicePreview}
              exclusive
              onChange={(e, newDevice) => {
                if (newDevice !== null) {
                  setDevicePreview(newDevice);
                }
              }}
              size="small"
            >
              <ToggleButton value="phone">
                <PhoneIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="tablet">
                <TabletIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="desktop">
                <DesktopIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>

        {/* Device Info */}
        {(previewMode === 'card' || previewMode === 'presentation') && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              <strong>Device:</strong> {deviceDimensions[devicePreview].label}
              {previewMode === 'presentation' && (
                <>
                  {' | '}
                  <strong>Mode:</strong> {presentationMode}
                </>
              )}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Preview Area */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          minHeight: 400,
          bgcolor: 'grey.50',
          position: 'relative'
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6">Live Preview</Typography>
            <Chip
              label={previewMode === 'presentation' ? presentationMode.toUpperCase() : 'CARD VIEW'}
              size="small"
              color="primary"
            />
          </Stack>

          <Divider />

          {/* Card-Only Preview */}
          {previewMode === 'card' && (
            <Box
              sx={{
                maxWidth: deviceDimensions[devicePreview].width,
                mx: devicePreview === 'desktop' ? 0 : 'auto',
                transition: 'max-width 0.3s ease'
              }}
            >
              <CDSCard
                card={previewCard}
                serviceId={serviceId}
                onAcceptSuggestion={(suggestionId) => {
                  console.log('Preview: Suggestion accepted', suggestionId);
                }}
                onDismiss={() => {
                  console.log('Preview: Card dismissed');
                }}
                onOverride={() => {
                  console.log('Preview: Card overridden');
                }}
              />
            </Box>
          )}

          {/* Presentation Mode Preview */}
          {previewMode === 'presentation' && (
            <Box
              sx={{
                maxWidth: deviceDimensions[devicePreview].width,
                mx: devicePreview === 'desktop' ? 0 : 'auto',
                transition: 'max-width 0.3s ease',
                minHeight: 300
              }}
            >
              <CDSPresentation
                cards={[previewCard]}
                presentationMode={presentationMode}
                serviceId={serviceId}
                onAcceptSuggestion={(suggestionId) => {
                  console.log('Preview: Suggestion accepted', suggestionId);
                }}
                onDismiss={() => {
                  console.log('Preview: Card dismissed');
                }}
                onOverride={() => {
                  console.log('Preview: Card overridden');
                }}
              />
            </Box>
          )}

          {/* JSON Preview */}
          {previewMode === 'json' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                CDS Hooks Card JSON
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}
              >
                {JSON.stringify(previewCard, null, 2)}
              </Box>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Display Configuration JSON
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}
              >
                {JSON.stringify(displayConfig, null, 2)}
              </Box>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Preview Legend */}
      <Paper elevation={1} sx={{ p: 2, mt: 3, bgcolor: 'info.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Preview Guide
        </Typography>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            • <strong>Card Only:</strong> Shows just the CDS card component
          </Typography>
          <Typography variant="caption" color="text.secondary">
            • <strong>With Presentation:</strong> Shows card in selected presentation mode (banner, modal, etc.)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            • <strong>JSON:</strong> Shows raw CDS Hooks card and display configuration
          </Typography>
          <Typography variant="caption" color="text.secondary">
            • <strong>Device Views:</strong> Preview how card appears on different screen sizes
          </Typography>
          <Typography variant="caption" color="text.secondary">
            • <strong>Interactive:</strong> Buttons and actions are clickable but won't save in preview mode
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
};

export default CardPreviewPanel;
