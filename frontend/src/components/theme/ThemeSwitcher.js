/**
 * ThemeSwitcher Component
 * Allows users to switch between different medical themes and modes
 */
import React, { useState, useContext } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Typography,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
  Stack,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Palette as PaletteIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Accessibility as AccessibilityIcon,
  Colorize as ColorizeIcon,
  Check as CheckIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  Psychology as PsychologyIcon,
  LocalHospital as MedicalIcon
} from '@mui/icons-material';
import { themePresets } from '../../themes/medicalTheme';
import { MedicalThemeContext } from '../../App';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import {
  LocalHospital as EmergencyIcon,
  Favorite as CardiologyIcon,
  ChildCare as PediatricsIcon,
  Science as OncologyIcon,
  MedicalServices as GeneralIcon
} from '@mui/icons-material';

// Department configuration
const departments = [
  { id: 'general', name: 'General Medicine', icon: <GeneralIcon />, color: '#1976D2' },
  { id: 'emergency', name: 'Emergency', icon: <EmergencyIcon />, color: '#D32F2F' },
  { id: 'cardiology', name: 'Cardiology', icon: <CardiologyIcon />, color: '#E91E63' },
  { id: 'pediatrics', name: 'Pediatrics', icon: <PediatricsIcon />, color: '#4CAF50' },
  { id: 'oncology', name: 'Oncology', icon: <OncologyIcon />, color: '#9C27B0' },
];

const ThemePreviewCard = ({ 
  theme, 
  isSelected, 
  onSelect, 
  mode = 'light' 
}) => {
  const previewStyles = {
    professional: {
      light: { primary: '#1565C0', secondary: '#2E7D32', background: '#FAFBFC' },
      dark: { primary: '#42A5F5', secondary: '#66BB6A', background: '#0A0E13' }
    },
    accessible: {
      light: { primary: '#0066CC', secondary: '#006600', background: '#FFFFFF' },
      dark: { primary: '#3399FF', secondary: '#339933', background: '#000000' }
    },
    warm: {
      light: { primary: '#7C4DFF', secondary: '#FF7043', background: '#FFFEF7' },
      dark: { primary: '#B085F5', secondary: '#FFAB91', background: '#1A0E1A' }
    },
    dark: {
      light: { primary: '#1976D2', secondary: '#4CAF50', background: '#FAFAFA' },
      dark: { primary: '#42A5F5', secondary: '#66BB6A', background: '#0A0E13' }
    },
    ocean: {
      light: { primary: '#0097A7', secondary: '#00ACC1', background: '#F0F7F8' },
      dark: { primary: '#4DD0E1', secondary: '#5DDEF4', background: '#0A0E13' }
    },
    forest: {
      light: { primary: '#2E7D32', secondary: '#558B2F', background: '#F1F8E9' },
      dark: { primary: '#81C784', secondary: '#A5D6A7', background: '#0A0E13' }
    },
    sunrise: {
      light: { primary: '#F57C00', secondary: '#FFD54F', background: '#FFF8E1' },
      dark: { primary: '#FFB74D', secondary: '#FFFF81', background: '#0A0E13' }
    },
    midnight: {
      light: { primary: '#5C6BC0', secondary: '#7E57C2', background: '#0A0E13' },
      dark: { primary: '#5C6BC0', secondary: '#7E57C2', background: '#0A0E13' }
    },
    monochrome: {
      light: { primary: '#616161', secondary: '#424242', background: '#FAFAFA' },
      dark: { primary: '#BDBDBD', secondary: '#9E9E9E', background: '#0A0E13' }
    },
    pediatric: {
      light: { primary: '#E91E63', secondary: '#00BCD4', background: '#FFF3E0' },
      dark: { primary: '#F8BBD0', secondary: '#B2EBF2', background: '#0A0E13' }
    }
  };

  const colors = previewStyles[theme.key]?.[mode] || previewStyles.professional[mode];

  return (
    <Card 
      sx={{ 
        cursor: 'pointer',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)'
        }
      }}
      onClick={onSelect}
    >
      <CardHeader
        avatar={
          <Avatar 
            sx={{ 
              bgcolor: colors.primary,
              width: 32,
              height: 32
            }}
          >
            {isSelected ? <CheckIcon /> : <PaletteIcon />}
          </Avatar>
        }
        title={theme.name}
        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
        subheader={theme.description}
        subheaderTypographyProps={{ variant: 'caption' }}
        action={
          isSelected && (
            <Chip 
              label="Active" 
              color="primary" 
              size="small"
              icon={<CheckIcon />}
            />
          )
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {/* Theme Preview */}
        <Paper 
          sx={{ 
            p: 2, 
            backgroundColor: colors.background,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2
          }}
          elevation={0}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  backgroundColor: colors.primary 
                }} 
              />
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  backgroundColor: colors.secondary 
                }} 
              />
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  backgroundColor: mode === 'dark' ? '#EF5350' : '#D32F2F' 
                }} 
              />
            </Box>
            <Typography 
              variant="caption" 
              sx={{ 
                color: mode === 'dark' ? '#F7FAFC' : '#1A202C',
                fontSize: '0.7rem'
              }}
            >
              Sample clinical interface
            </Typography>
          </Stack>
        </Paper>
      </CardContent>
    </Card>
  );
};

const ThemeCustomizationPanel = ({ theme, onCustomize }) => (
  <Paper sx={{ p: 3, borderRadius: 3 }}>
    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <SettingsIcon />
      Theme Customization
    </Typography>
    
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Accessibility Features
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <AccessibilityIcon />
            </ListItemIcon>
            <ListItemText 
              primary="High Contrast Mode" 
              secondary="Enhances visibility for users with visual impairments"
            />
            <ListItemSecondaryAction>
              <Switch />
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <VisibilityIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Large Text" 
              secondary="Increases font sizes throughout the interface"
            />
            <ListItemSecondaryAction>
              <Switch />
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <PsychologyIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Reduced Motion" 
              secondary="Minimizes animations and transitions"
            />
            <ListItemSecondaryAction>
              <Switch />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Clinical Interface Options
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <MedicalIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Color-Coded Severity" 
              secondary="Use colors to indicate clinical severity levels"
            />
            <ListItemSecondaryAction>
              <Switch defaultChecked />
            </ListItemSecondaryAction>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <ColorizeIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Department Colors" 
              secondary="Color-code interface by medical department"
            />
            <ListItemSecondaryAction>
              <Switch />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Box>
    </Stack>
  </Paper>
);

const ThemeSwitcher = () => {
  const context = useContext(MedicalThemeContext);
  const {
    currentTheme = 'professional',
    currentMode = 'light',
    department = 'general',
    clinicalContext,
    autoDetectContext = false,
    onThemeChange,
    onModeChange,
    onDepartmentChange,
    onAutoDetectChange
  } = context || {};
  const [open, setOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [selectedMode, setSelectedMode] = useState(currentMode);
  const [showCustomization, setShowCustomization] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(department);
  const [autoDetect, setAutoDetect] = useState(autoDetectContext);
  
  // Get current department info with safe defaults
  const currentDepartmentInfo = departments.find(d => d.id === selectedDepartment) || departments[0] || { 
    id: 'general', 
    name: 'General Medicine', 
    icon: <MedicalIcon />, 
    color: '#1976D2' 
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    // Reset to current values
    setSelectedTheme(currentTheme);
    setSelectedMode(currentMode);
    setSelectedDepartment(department);
    setAutoDetect(autoDetectContext);
  };

  const handleApply = () => {
    onThemeChange?.(selectedTheme);
    onModeChange?.(selectedMode);
    onDepartmentChange?.(selectedDepartment);
    onAutoDetectChange?.(autoDetect);
    setOpen(false);
  };

  const themes = Object.entries(themePresets).map(([key, preset]) => ({
    key,
    ...preset
  }));

  return (
    <>
      <Tooltip title="Change Theme">
        <IconButton onClick={handleOpen}>
          <PaletteIcon />
        </IconButton>
      </Tooltip>

      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <PaletteIcon color="primary" />
            <Box>
              <Typography variant="h6">
                Theme Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customize the appearance of your medical interface
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={4}>
            {/* Clinical Context Settings */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Clinical Context
              </Typography>
              
              <Stack spacing={3}>
                {/* Department Selection */}
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    label="Department"
                    startAdornment={currentDepartmentInfo && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, color: currentDepartmentInfo.color || '#1976D2' }}>
                        {currentDepartmentInfo.icon || <MedicalIcon />}
                      </Box>
                    )}
                  >
                    {departments.map((dept) => (
                      <MenuItem key={dept.id} value={dept.id}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box sx={{ color: dept.color }}>
                            {dept.icon}
                          </Box>
                          <Typography>{dept.name}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Auto-detect Context */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoDetect}
                        onChange={(e) => setAutoDetect(e.target.checked)}
                      />
                    }
                    label={
                      <Stack>
                        <Typography variant="body1">
                          Auto-detect Clinical Context
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically adjust theme based on time of day and department
                        </Typography>
                      </Stack>
                    }
                  />
                  
                  {autoDetect && clinicalContext && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Current context: {clinicalContext.shift} shift in {clinicalContext.department}
                      </Typography>
                    </Alert>
                  )}
                </Paper>
              </Stack>
            </Box>

            {/* Mode Selection */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedMode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
                Display Mode
              </Typography>
              
              <Stack direction="row" spacing={2}>
                <Button
                  variant={selectedMode === 'light' ? 'contained' : 'outlined'}
                  startIcon={<LightModeIcon />}
                  onClick={() => setSelectedMode('light')}
                  sx={{ flex: 1 }}
                >
                  Light Mode
                </Button>
                <Button
                  variant={selectedMode === 'dark' ? 'contained' : 'outlined'}
                  startIcon={<DarkModeIcon />}
                  onClick={() => setSelectedMode('dark')}
                  sx={{ flex: 1 }}
                >
                  Dark Mode
                </Button>
              </Stack>
            </Box>

            {/* Theme Selection */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Color Scheme
              </Typography>
              
              <Grid container spacing={2}>
                {themes.map((theme) => (
                  <Grid item xs={12} sm={6} key={theme.key}>
                    <ThemePreviewCard
                      theme={theme}
                      isSelected={selectedTheme === theme.key}
                      onSelect={() => setSelectedTheme(theme.key)}
                      mode={selectedMode}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Customization Panel */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  Advanced Options
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setShowCustomization(!showCustomization)}
                >
                  {showCustomization ? 'Hide' : 'Show'} Options
                </Button>
              </Stack>
              
              {showCustomization && (
                <ThemeCustomizationPanel 
                  theme={selectedTheme}
                  onCustomize={(options) => {}}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleApply}
            startIcon={<CheckIcon />}
          >
            Apply Theme
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ThemeSwitcher;