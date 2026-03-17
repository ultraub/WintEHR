import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Chip,
  Alert,
  Divider,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  Info as InfoIcon,
  ViewCompact as DisplayIcon,
  DensitySmall as CompactIcon,
  DensityMedium as ComfortableIcon,
  DensityLarge as SpaciousIcon,
  LocalHospital as MedicalIcon,
  Favorite as CardiologyIcon,
  ChildCare as PediatricsIcon,
  Science as OncologyIcon,
  MedicalServices as GeneralIcon,
  School as SchoolIcon,
  CheckCircle as HealthyIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { themePresets } from '../themes/medicalTheme';
import { MedicalThemeContext } from '../App';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const departments = [
  { id: 'general', name: 'General Medicine', icon: <GeneralIcon />, color: '#1976D2' },
  { id: 'emergency', name: 'Emergency', icon: <MedicalIcon />, color: '#D32F2F' },
  { id: 'cardiology', name: 'Cardiology', icon: <CardiologyIcon />, color: '#E91E63' },
  { id: 'pediatrics', name: 'Pediatrics', icon: <PediatricsIcon />, color: '#4CAF50' },
  { id: 'oncology', name: 'Oncology', icon: <OncologyIcon />, color: '#9C27B0' },
];

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact', icon: <CompactIcon />, description: 'Maximum information density, smaller spacing' },
  { value: 'comfortable', label: 'Comfortable', icon: <ComfortableIcon />, description: 'Balanced layout with standard spacing (default)' },
  { value: 'spacious', label: 'Spacious', icon: <SpaciousIcon />, description: 'More white space, larger touch targets' },
];

const previewColors = {
  professional: { light: { primary: '#1565C0', secondary: '#2E7D32', bg: '#FAFBFC' }, dark: { primary: '#42A5F5', secondary: '#66BB6A', bg: '#0A0E13' } },
  accessible:   { light: { primary: '#0066CC', secondary: '#006600', bg: '#FFFFFF' }, dark: { primary: '#3399FF', secondary: '#339933', bg: '#000000' } },
  warm:         { light: { primary: '#7C4DFF', secondary: '#FF7043', bg: '#FFFEF7' }, dark: { primary: '#B085F5', secondary: '#FFAB91', bg: '#1A0E1A' } },
  dark:         { light: { primary: '#1976D2', secondary: '#4CAF50', bg: '#FAFAFA' }, dark: { primary: '#42A5F5', secondary: '#66BB6A', bg: '#0A0E13' } },
  ocean:        { light: { primary: '#0097A7', secondary: '#00ACC1', bg: '#F0F7F8' }, dark: { primary: '#4DD0E1', secondary: '#5DDEF4', bg: '#0A0E13' } },
  forest:       { light: { primary: '#2E7D32', secondary: '#558B2F', bg: '#F1F8E9' }, dark: { primary: '#81C784', secondary: '#A5D6A7', bg: '#0A0E13' } },
  sunrise:      { light: { primary: '#F57C00', secondary: '#FFD54F', bg: '#FFF8E1' }, dark: { primary: '#FFB74D', secondary: '#FFFF81', bg: '#0A0E13' } },
  midnight:     { light: { primary: '#5C6BC0', secondary: '#7E57C2', bg: '#0A0E13' }, dark: { primary: '#5C6BC0', secondary: '#7E57C2', bg: '#0A0E13' } },
  monochrome:   { light: { primary: '#616161', secondary: '#424242', bg: '#FAFAFA' }, dark: { primary: '#BDBDBD', secondary: '#9E9E9E', bg: '#0A0E13' } },
  pediatric:    { light: { primary: '#E91E63', secondary: '#00BCD4', bg: '#FFF3E0' }, dark: { primary: '#F8BBD0', secondary: '#B2EBF2', bg: '#0A0E13' } },
};

// ---------------------------------------------------------------------------
// TabPanel
// ---------------------------------------------------------------------------

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

// ---------------------------------------------------------------------------
// ThemePreviewCard (inline, not dialog)
// ---------------------------------------------------------------------------

function ThemePreviewCard({ themeKey, preset, isSelected, onSelect, mode }) {
  const colors = previewColors[themeKey]?.[mode] || previewColors.professional[mode];

  return (
    <Card
      sx={{
        cursor: 'pointer',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease-in-out',
        '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
      }}
      onClick={onSelect}
    >
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: colors.primary, width: 32, height: 32 }}>
            {isSelected ? <CheckIcon fontSize="small" /> : <PaletteIcon fontSize="small" />}
          </Avatar>
        }
        title={preset.name}
        titleTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
        subheader={preset.description}
        subheaderTypographyProps={{ variant: 'caption' }}
        action={
          isSelected ? (
            <Chip label="Active" color="primary" size="small" icon={<CheckIcon />} />
          ) : null
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 1, pb: '12px !important' }}>
        <Paper
          sx={{ p: 1.5, backgroundColor: colors.bg, border: 1, borderColor: 'divider', borderRadius: 1 }}
          elevation={0}
        >
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: colors.primary }} />
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: colors.secondary }} />
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: mode === 'dark' ? '#EF5350' : '#D32F2F' }} />
          </Box>
        </Paper>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Appearance Tab
// ---------------------------------------------------------------------------

function AppearanceTab() {
  const themeCtx = useContext(MedicalThemeContext);
  const {
    currentTheme = 'professional',
    currentMode = 'light',
    department = 'general',
    clinicalContext,
    autoDetectContext = false,
    onThemeChange,
    onModeChange,
    onDepartmentChange,
    onAutoDetectChange,
  } = themeCtx || {};

  const themes = Object.entries(themePresets).map(([key, preset]) => ({ key, ...preset }));

  const currentDeptInfo = departments.find((d) => d.id === department) || departments[0];

  return (
    <Stack spacing={4}>
      {/* Display Mode */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentMode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
          Display Mode
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant={currentMode === 'light' ? 'contained' : 'outlined'}
            startIcon={<LightModeIcon />}
            onClick={() => onModeChange?.('light')}
            sx={{ flex: 1 }}
          >
            Light
          </Button>
          <Button
            variant={currentMode === 'dark' ? 'contained' : 'outlined'}
            startIcon={<DarkModeIcon />}
            onClick={() => onModeChange?.('dark')}
            sx={{ flex: 1 }}
          >
            Dark
          </Button>
        </Stack>
      </Paper>

      {/* Color Scheme */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Color Scheme
        </Typography>
        <Grid container spacing={2}>
          {themes.map((t) => (
            <Grid item xs={12} sm={6} md={4} key={t.key}>
              <ThemePreviewCard
                themeKey={t.key}
                preset={t}
                isSelected={currentTheme === t.key}
                onSelect={() => onThemeChange?.(t.key)}
                mode={currentMode}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Clinical Context */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Clinical Context
        </Typography>
        <Stack spacing={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Department</InputLabel>
            <Select
              value={department}
              onChange={(e) => onDepartmentChange?.(e.target.value)}
              label="Department"
              startAdornment={
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: currentDeptInfo.color }}>
                  {currentDeptInfo.icon}
                </Box>
              }
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ color: dept.color, display: 'flex' }}>{dept.icon}</Box>
                    <Typography>{dept.name}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={autoDetectContext}
                onChange={(e) => onAutoDetectChange?.(e.target.checked)}
              />
            }
            label={
              <Stack>
                <Typography variant="body2">Auto-detect Clinical Context</Typography>
                <Typography variant="caption" color="text.secondary">
                  Adjust theme based on time of day and department
                </Typography>
              </Stack>
            }
          />

          {autoDetectContext && clinicalContext && (
            <Alert severity="info" variant="outlined">
              Current context: <strong>{clinicalContext.shift}</strong> shift in{' '}
              <strong>{clinicalContext.department}</strong>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Display Tab
// ---------------------------------------------------------------------------

function DisplayTab() {
  const muiTheme = useTheme();
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('clinicalDensity') || 'comfortable';
  });

  const handleDensityChange = useCallback((value) => {
    setDensity(value);
    localStorage.setItem('clinicalDensity', value);
  }, []);

  return (
    <Stack spacing={4}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DisplayIcon />
          Information Density
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Controls spacing and sizing across clinical data views such as patient lists, lab
          results, and medication tables.
        </Typography>
        <Grid container spacing={2}>
          {DENSITY_OPTIONS.map((opt) => {
            const selected = density === opt.value;
            return (
              <Grid item xs={12} sm={4} key={opt.value}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: selected ? 2 : 1,
                    borderColor: selected ? 'primary.main' : 'divider',
                    backgroundColor: selected
                      ? alpha(muiTheme.palette.primary.main, 0.04)
                      : 'background.paper',
                    transition: 'all 0.2s',
                    '&:hover': { boxShadow: 2 },
                  }}
                  onClick={() => handleDensityChange(opt.value)}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar
                      sx={{
                        mx: 'auto',
                        mb: 1.5,
                        bgcolor: selected
                          ? 'primary.main'
                          : alpha(muiTheme.palette.text.secondary, 0.12),
                        color: selected ? 'primary.contrastText' : 'text.secondary',
                        width: 44,
                        height: 44,
                      }}
                    >
                      {opt.icon}
                    </Avatar>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {opt.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {opt.description}
                    </Typography>
                    {selected && (
                      <Chip
                        label="Active"
                        color="primary"
                        size="small"
                        icon={<CheckIcon />}
                        sx={{ mt: 1.5 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Preview */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Preview
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: density === 'compact' ? 0.5 : density === 'spacious' ? 2 : 1,
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'background.default',
          }}
        >
          {['Systolic BP: 120 mmHg', 'Heart Rate: 72 bpm', 'Temperature: 98.6 F'].map(
            (item, idx) => (
              <Typography
                key={idx}
                variant={density === 'compact' ? 'caption' : density === 'spacious' ? 'body1' : 'body2'}
                sx={{
                  py: density === 'compact' ? 0.25 : density === 'spacious' ? 1 : 0.5,
                  px: 1.5,
                  borderRadius: 0.5,
                  backgroundColor: alpha(muiTheme.palette.primary.main, 0.04),
                }}
              >
                {item}
              </Typography>
            )
          )}
        </Box>
      </Paper>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Profile Tab
// ---------------------------------------------------------------------------

function ProfileTab() {
  const { user } = useAuth();

  const displayName = user?.display_name || user?.full_name || user?.username || 'Unknown';
  const role = user?.role || 'N/A';
  const username = user?.username || 'N/A';
  const loginTime = user?.login_time || user?.last_login || null;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography variant="h6">{displayName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
              {role}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Username
            </Typography>
            <Typography variant="body2">{username}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Role
            </Typography>
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
              {role}
            </Typography>
          </Grid>
          {user?.practitioner_id && (
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Practitioner ID
              </Typography>
              <Typography variant="body2">{user.practitioner_id}</Typography>
            </Grid>
          )}
          {loginTime && (
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Last Login
              </Typography>
              <Typography variant="body2">
                {new Date(loginTime).toLocaleString()}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Alert severity="info" variant="outlined">
        This is a <strong>demo environment</strong> with pre-configured credentials. Profile
        editing is disabled. Available demo accounts: demo/password (Physician),
        nurse/password (Nurse), pharmacist/password (Pharmacist), admin/password
        (Administrator).
      </Alert>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// About Tab
// ---------------------------------------------------------------------------

function AboutTab() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await api.get('/api/health');
      setHealthStatus(response.data);
    } catch (err) {
      try {
        const fallback = await api.get('/health');
        setHealthStatus(fallback.data);
      } catch (err2) {
        setHealthError('Unable to reach backend. Is the server running?');
      }
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <Stack spacing={3}>
      {/* Application Info */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <MedicalIcon />
          </Avatar>
          <Box>
            <Typography variant="h6">WintEHR</Typography>
            <Typography variant="body2" color="text.secondary">
              Educational Electronic Health Records Platform
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography variant="body2">6.1 (Educational)</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              FHIR Standard
            </Typography>
            <Typography variant="body2">R4 (4.0.1)</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Frontend
            </Typography>
            <Typography variant="body2">React 18 + Material-UI 5</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Backend
            </Typography>
            <Typography variant="body2">FastAPI + HAPI FHIR</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* System Health */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">System Health</Typography>
          <Button size="small" onClick={checkHealth} disabled={healthLoading}>
            {healthLoading ? 'Checking...' : 'Refresh'}
          </Button>
        </Stack>

        {healthLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Checking system health...
            </Typography>
          </Box>
        )}

        {healthError && (
          <Alert severity="error" variant="outlined">
            {healthError}
          </Alert>
        )}

        {healthStatus && !healthLoading && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              {healthStatus.status === 'healthy' || healthStatus.status === 'ok' ? (
                <HealthyIcon color="success" fontSize="small" />
              ) : (
                <ErrorIcon color="error" fontSize="small" />
              )}
              <Typography variant="body2">
                Backend: <strong>{healthStatus.status || 'unknown'}</strong>
              </Typography>
            </Stack>
            {healthStatus.fhir_server && (
              <Stack direction="row" spacing={1} alignItems="center">
                {healthStatus.fhir_server === 'connected' ? (
                  <HealthyIcon color="success" fontSize="small" />
                ) : (
                  <ErrorIcon color="warning" fontSize="small" />
                )}
                <Typography variant="body2">
                  FHIR Server: <strong>{healthStatus.fhir_server}</strong>
                </Typography>
              </Stack>
            )}
            {healthStatus.database && (
              <Stack direction="row" spacing={1} alignItems="center">
                {healthStatus.database === 'connected' ? (
                  <HealthyIcon color="success" fontSize="small" />
                ) : (
                  <ErrorIcon color="warning" fontSize="small" />
                )}
                <Typography variant="body2">
                  Database: <strong>{healthStatus.database}</strong>
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
      </Paper>

      {/* Educational Disclaimer */}
      <Alert severity="warning" variant="outlined" icon={<SchoolIcon />}>
        <Typography variant="subtitle2" gutterBottom>
          Educational Use Only
        </Typography>
        <Typography variant="body2">
          WintEHR is designed for learning healthcare IT concepts including FHIR R4, EHR
          workflows, and CDS Hooks. It must never be used with real Protected Health
          Information (PHI). All patient data is synthetic, generated by Synthea.
        </Typography>
      </Alert>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

const Settings = () => {
  const [tab, setTab] = useState(0);
  const muiTheme = useTheme();

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: 3, px: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <SettingsIcon sx={{ fontSize: 32, color: muiTheme.palette.primary.main }} />
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Customize your WintEHR experience
          </Typography>
        </Box>
      </Stack>

      {/* Tabs */}
      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: alpha(muiTheme.palette.background.default, 0.6),
          }}
        >
          <Tab icon={<PaletteIcon />} iconPosition="start" label="Appearance" {...a11yProps(0)} />
          <Tab icon={<DisplayIcon />} iconPosition="start" label="Display" {...a11yProps(1)} />
          <Tab icon={<PersonIcon />} iconPosition="start" label="Profile" {...a11yProps(2)} />
          <Tab icon={<InfoIcon />} iconPosition="start" label="About" {...a11yProps(3)} />
        </Tabs>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <TabPanel value={tab} index={0}>
            <AppearanceTab />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <DisplayTab />
          </TabPanel>
          <TabPanel value={tab} index={2}>
            <ProfileTab />
          </TabPanel>
          <TabPanel value={tab} index={3}>
            <AboutTab />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

export default Settings;
