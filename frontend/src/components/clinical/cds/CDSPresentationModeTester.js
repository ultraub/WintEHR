/**
 * CDS Presentation Mode Tester
 * Component to test all CDS presentation modes
 */
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Grid,
  Chip,
  Divider,
  Alert,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import CDSPresentation, { PRESENTATION_MODES } from './CDSPresentation';

const CDSPresentationModeTester = () => {
  const [activeAlerts, setActiveAlerts] = useState({});
  const [autoHide, setAutoHide] = useState(false);
  
  // Sample alerts for each presentation mode
  const sampleAlerts = {
    [PRESENTATION_MODES.INLINE]: {
      uuid: 'inline-001',
      serviceId: 'test-inline',
      serviceName: 'Inline Test Service',
      indicator: 'warning',
      summary: 'Inline Alert Example',
      detail: 'This is an inline alert that appears within the normal page flow. It can be dismissed but does not interrupt workflow.',
      source: { label: 'Test System' },
      timestamp: new Date(),
      suggestions: [
        { 
          uuid: 'sug-1', 
          label: 'Review Details',
          description: 'Review the complete information'
        }
      ],
      links: [
        { label: 'Learn More', url: 'https://example.com/inline' }
      ]
    },
    [PRESENTATION_MODES.MODAL]: {
      uuid: 'modal-001',
      serviceId: 'test-modal',
      serviceName: 'Modal Test Service',
      indicator: 'critical',
      summary: 'Critical Alert - Immediate Action Required',
      detail: 'This is a hard-stop modal alert that requires acknowledgment before continuing. Used for critical patient safety alerts.',
      source: { label: 'Safety System' },
      timestamp: new Date(),
      displayBehavior: {
        presentationMode: PRESENTATION_MODES.MODAL,
        acknowledgmentRequired: true,
        reasonRequired: true
      }
    },
    [PRESENTATION_MODES.BANNER]: {
      uuid: 'banner-001',
      serviceId: 'test-banner',
      serviceName: 'Banner Test Service',
      indicator: 'critical',
      summary: 'System-Wide Critical Alert',
      detail: 'This banner appears at the top of the screen for critical system-wide alerts.',
      source: { label: 'System Alert' },
      timestamp: new Date()
    },
    [PRESENTATION_MODES.TOAST]: {
      uuid: 'toast-001',
      serviceId: 'test-toast',
      serviceName: 'Toast Test Service',
      indicator: 'info',
      summary: 'New Information Available',
      detail: 'Toast notifications appear temporarily in the corner.',
      source: { label: 'Notification System' },
      timestamp: new Date()
    },
    [PRESENTATION_MODES.POPUP]: {
      uuid: 'popup-001',
      serviceId: 'test-popup',
      serviceName: 'Popup Test Service',
      indicator: 'warning',
      summary: 'Important Information',
      detail: 'This popup dialog presents important information that needs attention but is not critical enough for a hard-stop modal.',
      source: { label: 'Alert System' },
      timestamp: new Date(),
      suggestions: [
        { uuid: 'sug-2', label: 'Take Action' }
      ]
    },
    [PRESENTATION_MODES.DRAWER]: {
      uuid: 'drawer-001',
      serviceId: 'test-drawer',
      serviceName: 'Drawer Test Service',
      indicator: 'info',
      summary: 'Detailed Information Available',
      detail: 'The drawer slides out from the right side to show detailed alert information without covering the main content.',
      source: { label: 'Information System' },
      timestamp: new Date()
    },
    [PRESENTATION_MODES.SIDEBAR]: {
      uuid: 'sidebar-001',
      serviceId: 'test-sidebar',
      serviceName: 'Sidebar Test Service',
      indicator: 'warning',
      summary: 'Persistent Alert Display',
      detail: 'The sidebar remains fixed on the right side of the screen, showing alerts while allowing continued workflow.',
      source: { label: 'Monitoring System' },
      timestamp: new Date()
    },
    [PRESENTATION_MODES.CARD]: {
      uuid: 'card-001',
      serviceId: 'test-card',
      serviceName: 'Card Test Service',
      indicator: 'info',
      summary: 'Rich Card Display',
      detail: 'Card mode provides a rich, visually enhanced display for alerts with hover effects and detailed information.',
      source: { label: 'Card System' },
      timestamp: new Date(),
      links: [
        { label: 'Documentation', url: 'https://example.com/cards' }
      ]
    },
    [PRESENTATION_MODES.COMPACT]: {
      uuid: 'compact-001',
      serviceId: 'test-compact',
      serviceName: 'Compact Test Service',
      indicator: 'warning',
      summary: 'Compact Alert',
      detail: 'Compact mode shows a small icon with badge that expands to show full alert details.',
      source: { label: 'Compact System' },
      timestamp: new Date()
    }
  };

  // Add a second alert for some modes to test multiple alerts
  const multipleAlerts = {
    [PRESENTATION_MODES.MODAL]: [
      sampleAlerts[PRESENTATION_MODES.MODAL],
      {
        ...sampleAlerts[PRESENTATION_MODES.MODAL],
        uuid: 'modal-002',
        summary: 'Second Critical Alert',
        detail: 'This demonstrates multiple alerts requiring acknowledgment.',
      }
    ],
    [PRESENTATION_MODES.TOAST]: [
      sampleAlerts[PRESENTATION_MODES.TOAST],
      {
        ...sampleAlerts[PRESENTATION_MODES.TOAST],
        uuid: 'toast-002',
        indicator: 'warning',
        summary: 'Second Toast Alert',
        detail: 'Multiple toasts stack vertically.',
      },
      {
        ...sampleAlerts[PRESENTATION_MODES.TOAST],
        uuid: 'toast-003',
        indicator: 'critical',
        summary: 'Critical Toast Alert',
        detail: 'Different severity levels.',
      }
    ]
  };

  const activateMode = (mode) => {
    const alerts = multipleAlerts[mode] || [sampleAlerts[mode]];
    setActiveAlerts(prev => ({
      ...prev,
      [mode]: alerts
    }));
  };

  const deactivateMode = (mode) => {
    setActiveAlerts(prev => {
      const newAlerts = { ...prev };
      delete newAlerts[mode];
      return newAlerts;
    });
  };

  const clearAll = () => {
    setActiveAlerts({});
  };

  const getModeDescription = (mode) => {
    const descriptions = {
      [PRESENTATION_MODES.INLINE]: 'Standard inline display within page content',
      [PRESENTATION_MODES.MODAL]: 'Hard-stop modal requiring acknowledgment',
      [PRESENTATION_MODES.BANNER]: 'Sticky banner at top of screen',
      [PRESENTATION_MODES.TOAST]: 'Temporary notifications in corner',
      [PRESENTATION_MODES.POPUP]: 'Modal dialog that can be closed',
      [PRESENTATION_MODES.DRAWER]: 'Slide-out panel from right',
      [PRESENTATION_MODES.SIDEBAR]: 'Fixed panel on right side',
      [PRESENTATION_MODES.CARD]: 'Rich card display with effects',
      [PRESENTATION_MODES.COMPACT]: 'Icon with expandable popover'
    };
    return descriptions[mode] || '';
  };

  const getModeColor = (mode) => {
    const colors = {
      [PRESENTATION_MODES.INLINE]: 'warning',
      [PRESENTATION_MODES.MODAL]: 'error',
      [PRESENTATION_MODES.BANNER]: 'error',
      [PRESENTATION_MODES.TOAST]: 'info',
      [PRESENTATION_MODES.POPUP]: 'warning',
      [PRESENTATION_MODES.DRAWER]: 'info',
      [PRESENTATION_MODES.SIDEBAR]: 'warning',
      [PRESENTATION_MODES.CARD]: 'info',
      [PRESENTATION_MODES.COMPACT]: 'warning'
    };
    return colors[mode] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        CDS Presentation Mode Tester
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Test each CDS presentation mode to verify proper display and behavior.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={clearAll}
          >
            Clear All Alerts
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={autoHide}
                onChange={(e) => setAutoHide(e.target.checked)}
              />
            }
            label="Auto-hide (for supported modes)"
          />
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {Object.entries(PRESENTATION_MODES).map(([key, mode]) => (
          <Grid item xs={12} sm={6} md={4} key={mode}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6">
                    {key}
                  </Typography>
                  <Chip 
                    label={mode} 
                    size="small" 
                    color={getModeColor(mode)}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {getModeDescription(mode)}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayIcon />}
                    onClick={() => activateMode(mode)}
                    disabled={!!activeAlerts[mode]}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<StopIcon />}
                    onClick={() => deactivateMode(mode)}
                    disabled={!activeAlerts[mode]}
                  >
                    Deactivate
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Render active alerts */}
      {Object.entries(activeAlerts).map(([mode, alerts]) => (
        <Box key={mode} sx={{ mb: mode === PRESENTATION_MODES.INLINE ? 2 : 0 }}>
          <CDSPresentation
            alerts={alerts}
            mode={mode}
            autoHide={autoHide}
            hideDelay={5000}
            allowInteraction={true}
            onAlertAction={(alertId, action, data) => {
              console.log('Alert action:', { mode, alertId, action, data });
            }}
          />
        </Box>
      ))}

      {/* Instructions */}
      <Box sx={{ mt: 4 }}>
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            Testing Instructions:
          </Typography>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
            <li>Click "Activate" to show an alert in that presentation mode</li>
            <li>Some modes (Modal, Toast) show multiple alerts to test stacking</li>
            <li>Try activating multiple modes simultaneously</li>
            <li>Test dismissal, acknowledgment, and interaction features</li>
            <li>Enable "Auto-hide" to test automatic dismissal (Toast mode)</li>
            <li>Check responsive behavior by resizing the window</li>
          </ul>
        </Alert>
      </Box>
    </Box>
  );
};

export default CDSPresentationModeTester;