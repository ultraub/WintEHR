/**
 * ThemeTestPage Component
 * Quick visual test page for theme switching functionality
 */
import React, { useContext, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  Stack,
  Alert,
  Chip,
  Card,
  CardContent,
  useTheme
} from '@mui/material';
import { MedicalThemeContext } from '../../../App';
import MetricCard from '../common/MetricCard';
import ClinicalCard from '../common/ClinicalCard';
import StatusChip from '../common/StatusChip';
import { getClinicalContext } from '../../../themes/clinicalThemeUtils';
import {
  LocalHospital as HospitalIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Person as PersonIcon
} from '@mui/icons-material';

const ThemeTestPage = () => {
  const theme = useTheme();
  const context = useContext(MedicalThemeContext);
  const {
    currentTheme,
    currentMode,
    department,
    clinicalContext,
    autoDetectContext
  } = context || {};

  const [severity, setSeverity] = useState('medium');

  // Test data
  const statuses = ['active', 'completed', 'cancelled', 'draft', 'critical'];
  const severities = ['low', 'medium', 'high', 'critical'];
  const departments = ['general', 'emergency', 'cardiology', 'pediatrics', 'oncology'];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Theme System Test Page
      </Typography>
      
      {/* Current Settings */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>Current Settings</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Theme</Typography>
            <Typography variant="body1">{currentTheme}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Mode</Typography>
            <Typography variant="body1">{currentMode}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Department</Typography>
            <Typography variant="body1">{department}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Auto-detect</Typography>
            <Typography variant="body1">{autoDetectContext ? 'Enabled' : 'Disabled'}</Typography>
          </Grid>
        </Grid>
        
        {clinicalContext && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Clinical Context: {clinicalContext.shift} shift, {clinicalContext.urgency} urgency
          </Alert>
        )}
      </Paper>

      {/* Component Tests */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Component Tests
      </Typography>

      {/* MetricCard Tests */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>MetricCard Variations</Typography>
        <Grid container spacing={3}>
          {severities.map((sev) => (
            <Grid item xs={12} sm={6} md={3} key={sev}>
              <MetricCard
                title="Test Metric"
                value={Math.floor(Math.random() * 100)}
                icon={<HospitalIcon />}
                severity={sev}
                trend={sev === 'critical' ? 'critical' : sev === 'high' ? 'warning' : 'stable'}
                department={department}
                clinicalContext={clinicalContext}
              >
                <Typography variant="caption">
                  Severity: {sev}
                </Typography>
              </MetricCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* StatusChip Tests */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>StatusChip Variations</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
          {statuses.map((status) => (
            <StatusChip
              key={status}
              status={status}
              department={department}
              urgency={status === 'critical' ? 'critical' : 'normal'}
            />
          ))}
        </Stack>
      </Box>

      {/* ClinicalCard Tests */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>ClinicalCard with Different Departments</Typography>
        <Grid container spacing={3}>
          {departments.map((dept) => (
            <Grid item xs={12} md={6} key={dept}>
              <ClinicalCard
                title={`${dept.charAt(0).toUpperCase() + dept.slice(1)} Department`}
                icon={<HospitalIcon />}
                department={dept}
                variant="clinical"
                expandable
              >
                <Typography variant="body2">
                  This card is styled for the {dept} department.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Chip label="Active" size="small" color="primary" />
                  <Chip label="Priority" size="small" color="error" />
                </Stack>
              </ClinicalCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Color Palette */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>Current Color Palette</Typography>
        <Grid container spacing={2}>
          {['primary', 'secondary', 'error', 'warning', 'info', 'success'].map((color) => (
            <Grid item xs={6} sm={4} md={2} key={color}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: `${color}.main`,
                  color: `${color}.contrastText`,
                  textAlign: 'center'
                }}
              >
                <Typography variant="caption">{color}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Typography Scale */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>Typography Scale</Typography>
        <Paper sx={{ p: 3 }}>
          {['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'caption', 'overline'].map((variant) => (
            <Typography key={variant} variant={variant} gutterBottom>
              {variant}: The quick brown fox jumps over the lazy dog
            </Typography>
          ))}
        </Paper>
      </Box>

      {/* Spacing Scale */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>Spacing Scale</Typography>
        <Stack direction="row" spacing={2}>
          {[0.5, 1, 2, 3, 4, 5].map((spacing) => (
            <Paper
              key={spacing}
              sx={{
                p: spacing,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                minWidth: 50,
                textAlign: 'center'
              }}
            >
              <Typography variant="caption">{spacing}</Typography>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Container>
  );
};

export default ThemeTestPage;