/**
 * ClinicalLayout Component
 * Enhanced layout component with clinical context awareness and adaptive theming
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Paper,
  Stack,
  Chip,
  useTheme,
  useMediaQuery,
  Fade,
  Slide,
  alpha
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  LocalHospital as HospitalIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { 
  getClinicalContext, 
  buildClinicalTheme, 
  getClinicalSpacing,
  getClinicalAnimation 
} from '../../../themes/clinicalThemeUtils';
import StatusChip from '../common/StatusChip';
import ThemeSwitcher from '../../theme/ThemeSwitcher';

const ClinicalLayout = ({
  children,
  department = 'general',
  shift,
  urgency = 'normal',
  patientContext,
  showPatientInfo = true,
  showDepartmentInfo = true,
  showTimeInfo = true,
  onDepartmentChange,
  onThemeChange,
  onModeChange,
  currentTheme = 'professional',
  currentMode = 'light',
  title = 'WintEHR',
  subtitle
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Get clinical context
  const clinicalContext = useMemo(() => {
    return getClinicalContext(
      window.location.pathname,
      currentTime.getHours(),
      department
    );
  }, [department, currentTime]);
  
  // Build clinical theme
  const clinicalTheme = useMemo(() => {
    return buildClinicalTheme(theme, {
      ...clinicalContext,
      urgency,
      shift: shift || clinicalContext.shift
    });
  }, [theme, clinicalContext, urgency, shift]);
  
  // Get clinical spacing and animations
  const spacing = getClinicalSpacing(clinicalTheme, clinicalContext, 'comfortable');
  const headerAnimation = getClinicalAnimation(clinicalTheme, 'dataUpdate', clinicalContext);
  
  // Get department-specific colors
  const departmentColor = clinicalTheme.clinical?.departments?.[department]?.primary || theme.palette.primary.main;
  const departmentSurface = clinicalTheme.clinical?.departments?.[department]?.surface || alpha(departmentColor, 0.05);
  
  // Time-based greeting
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };
  
  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };
  
  // Get shift indicator
  const getShiftIndicator = () => {
    const shiftColors = {
      day: theme.palette.success.main,
      evening: theme.palette.warning.main,
      night: theme.palette.info.main
    };
    
    return (
      <Chip
        size="small"
        label={`${clinicalContext.shift.charAt(0).toUpperCase() + clinicalContext.shift.slice(1)} Shift`}
        sx={{
          backgroundColor: alpha(shiftColors[clinicalContext.shift], 0.1),
          color: shiftColors[clinicalContext.shift],
          border: `1px solid ${alpha(shiftColors[clinicalContext.shift], 0.3)}`,
          fontWeight: 500
        }}
      />
    );
  };
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Enhanced App Bar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: theme.zIndex.drawer + 1,
          background: `linear-gradient(135deg, ${departmentColor} 0%, ${alpha(departmentColor, 0.8)} 100%)`,
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          transition: `all ${headerAnimation.duration}ms ${headerAnimation.easing}`
        }}
      >
        <Toolbar sx={{ gap: spacing }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <HospitalIcon sx={{ mr: 1 }} />
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" noWrap component="div">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          
          {/* Clinical Context Information */}
          <Stack direction="row" spacing={1} alignItems="center">
            {showTimeInfo && (
              <Fade in timeout={1000}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimeIcon fontSize="small" />
                  <Typography variant="body2">
                    {formatTime(currentTime)}
                  </Typography>
                  {getShiftIndicator()}
                </Box>
              </Fade>
            )}
            
            {showDepartmentInfo && department !== 'general' && (
              <Slide direction="left" in timeout={800}>
                <StatusChip
                  status={department}
                  variant="clinical"
                  size="small"
                  showIcon={true}
                  department={department}
                  sx={{
                    backgroundColor: alpha(theme.palette.common.white, 0.2),
                    color: theme.palette.common.white,
                    border: `1px solid ${alpha(theme.palette.common.white, 0.3)}`
                  }}
                />
              </Slide>
            )}
            
            {urgency === 'urgent' && (
              <Chip
                size="small"
                label="URGENT"
                color="error"
                sx={{
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 }
                  }
                }}
              />
            )}
            
            <IconButton color="inherit" size="small">
              <NotificationsIcon />
            </IconButton>
            
            <ThemeSwitcher
              currentTheme={currentTheme}
              currentMode={currentMode}
              onThemeChange={onThemeChange}
              onModeChange={onModeChange}
              department={department}
              clinicalContext={clinicalContext}
            />
          </Stack>
        </Toolbar>
      </AppBar>
      
      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: spacing,
          overflowY: 'auto', // Enable scrolling
          mt: '64px', // Fixed AppBar height
          backgroundColor: clinicalTheme.palette.background.default,
          minHeight: 'calc(100vh - 64px)', // Subtract AppBar height
          transition: `all ${headerAnimation.duration}ms ${headerAnimation.easing}`
        }}
      >
        {/* Patient Context Bar - Removed as redundant with EnhancedPatientHeader */}
        
        {/* Removed Welcome Message to save space and focus on clinical data */}
        
        {/* Main Content - Removed fade animation for faster rendering */}
        <Box>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default ClinicalLayout;