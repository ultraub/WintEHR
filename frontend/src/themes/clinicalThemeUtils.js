/**
 * Clinical Theme Utilities
 * Advanced theming utilities for clinical contexts and enhanced user experience
 */

import { alpha, darken, lighten } from '@mui/material/styles';

// Clinical context detection utilities
export const getClinicalContext = (location, timeOfDay, department) => {
  const context = {
    shift: getShiftContext(timeOfDay),
    department: getDepartmentContext(department),
    urgency: getUrgencyContext(location)
  };
  
  return context;
};

// Shift context based on time of day
export const getShiftContext = (timeOfDay) => {
  const hour = timeOfDay || new Date().getHours();
  
  if (hour >= 6 && hour < 18) {
    return 'day';
  } else if (hour >= 18 && hour < 22) {
    return 'evening';
  } else {
    return 'night';
  }
};

// Department context detection
export const getDepartmentContext = (department) => {
  const deptMap = {
    'emergency': 'emergency',
    'ed': 'emergency',
    'cardiology': 'cardiology',
    'cardiac': 'cardiology',
    'pediatrics': 'pediatrics',
    'peds': 'pediatrics',
    'oncology': 'oncology',
    'cancer': 'oncology',
    'neurology': 'neurology',
    'neuro': 'neurology'
  };
  
  return deptMap[department?.toLowerCase()] || 'general';
};

// Urgency context based on location or situation
export const getUrgencyContext = (location) => {
  const urgentAreas = ['emergency', 'icu', 'trauma', 'or', 'operating room'];
  return urgentAreas.some(area => location?.toLowerCase().includes(area)) ? 'urgent' : 'normal';
};

// Dynamic color generation based on clinical context
export const getClinicalColors = (theme, context) => {
  const { shift, department, urgency } = context;
  
  // Base colors from theme
  let colors = { ...theme.palette };
  
  // Apply department-specific colors
  if (theme.clinical?.departments?.[department]) {
    const deptColor = theme.clinical.departments[department].primary;
    // Ensure we maintain the full color structure that MUI expects
    colors.primary = {
      main: deptColor,
      light: theme.palette.primary?.light || deptColor,
      dark: theme.palette.primary?.dark || deptColor,
      contrastText: theme.palette.primary?.contrastText || '#FFFFFF'
    };
    colors.clinical = {
      ...colors.clinical,
      surface: theme.clinical.departments[department].surface
    };
  }
  
  // Apply shift-based adjustments
  if (shift === 'night') {
    colors.background = {
      ...colors.background,
      default: darken(colors.background.default, 0.1),
      paper: darken(colors.background.paper, 0.05)
    };
  }
  
  // Apply urgency adjustments
  if (urgency === 'urgent') {
    colors.error = {
      main: lighten(colors.error.main, 0.1),
      light: colors.error.light ? lighten(colors.error.light, 0.1) : lighten(colors.error.main, 0.2),
      dark: colors.error.dark ? lighten(colors.error.dark, 0.1) : colors.error.main,
      contrastText: colors.error.contrastText || '#FFFFFF'
    };
  }
  
  return colors;
};

// Smart color selection based on clinical severity
export const getSeverityColor = (theme, severity, context = {}) => {
  const severityLevel = severity?.toLowerCase();
  
  // Base severity colors
  const severityColors = {
    critical: theme.clinical?.severity?.critical || '#F44336',
    severe: theme.clinical?.severity?.severe || '#FF5722',
    moderate: theme.clinical?.severity?.moderate || '#FF9800',
    mild: theme.clinical?.severity?.mild || '#8BC34A',
    normal: theme.clinical?.severity?.normal || '#4CAF50'
  };
  
  // Adjust for department context
  if (context.department === 'emergency') {
    return darken(severityColors[severityLevel] || severityColors.normal, 0.1);
  }
  
  return severityColors[severityLevel] || severityColors.normal;
};

// Enhanced status color with clinical context
export const getStatusColor = (theme, status, context = {}) => {
  const statusColors = {
    active: theme.clinical?.status?.active || '#4CAF50',
    inactive: theme.clinical?.status?.inactive || '#9E9E9E',
    pending: theme.clinical?.status?.pending || '#FF9800',
    completed: theme.clinical?.status?.completed || '#2196F3',
    cancelled: theme.clinical?.status?.cancelled || '#F44336',
    draft: theme.clinical?.status?.draft || '#757575',
    inProgress: theme.clinical?.status?.inProgress || '#3F51B5'
  };
  
  let color = statusColors[status] || statusColors.inactive;
  
  // Adjust for urgency
  if (context.urgency === 'urgent' && status === 'pending') {
    color = darken(color, 0.2);
  }
  
  return color;
};

// Clinical typography selection
export const getClinicalTypography = (theme, variant) => {
  const clinicalTypography = {
    label: {
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      lineHeight: 1.4
    },
    data: {
      fontSize: '0.875rem',
      fontWeight: 500,
      fontFamily: theme.typography.monospace || 'monospace',
      lineHeight: 1.5
    },
    critical: {
      fontSize: '1rem',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0.01em'
    },
    clinical: {
      fontSize: '0.875rem',
      fontWeight: 400,
      fontFamily: theme.typography.clinical || theme.typography.fontFamily,
      lineHeight: 1.6
    }
  };
  
  return clinicalTypography[variant] || clinicalTypography.clinical;
};

// Smart spacing based on clinical context
export const getClinicalSpacing = (theme, context, variant = 'comfortable') => {
  const spacingMap = {
    compact: theme.clinicalSpacing?.clinical?.compact || 4,
    comfortable: theme.clinicalSpacing?.clinical?.comfortable || 8,
    spacious: theme.clinicalSpacing?.clinical?.spacious || 16,
    section: theme.clinicalSpacing?.clinical?.section || 24,
    page: theme.clinicalSpacing?.clinical?.page || 32
  };
  
  // Adjust for urgency - more compact in urgent situations
  if (context.urgency === 'urgent' && variant !== 'compact') {
    return spacingMap.compact;
  }
  
  return spacingMap[variant] || spacingMap.comfortable;
};

// Animation configuration based on clinical context
export const getClinicalAnimation = (theme, animationType, context = {}) => {
  const animations = {
    dataUpdate: {
      duration: 300,
      easing: 'cubic-bezier(0.0, 0, 0.2, 1)',
      transform: 'translateY(-2px)'
    },
    criticalAlert: {
      duration: 600,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      animation: 'pulse',
      iterations: 3
    },
    success: {
      duration: 400,
      easing: 'cubic-bezier(0.0, 0, 0.2, 1)',
      transform: 'scale(1.02)'
    },
    hover: {
      duration: 150,
      easing: 'cubic-bezier(0.0, 0, 0.2, 1)',
      transform: 'translateY(-1px)'
    }
  };
  
  // Reduce animation intensity for urgent contexts
  if (context.urgency === 'urgent') {
    return {
      ...animations[animationType],
      duration: Math.max(animations[animationType].duration * 0.7, 100)
    };
  }
  
  return animations[animationType] || animations.hover;
};

// Accessibility helpers
export const getAccessibleColor = (theme, color, background) => {
  const contrastRatio = getContrastRatio(color, background);
  
  if (contrastRatio < 4.5) {
    // Adjust color for better contrast
    return theme.palette.mode === 'dark' ? lighten(color, 0.3) : darken(color, 0.3);
  }
  
  return color;
};

// Simple contrast ratio calculation
export const getContrastRatio = (color1, color2) => {
  // Simplified contrast ratio calculation
  // In a real implementation, you'd use proper color space calculations
  const getLuminance = (color) => {
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map(x => parseInt(x) / 255);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
};

// Theme builder for clinical contexts
export const buildClinicalTheme = (baseTheme, clinicalContext) => {
  const colors = getClinicalColors(baseTheme, clinicalContext);
  
  return {
    ...baseTheme,
    palette: colors,
    clinical: {
      ...baseTheme.clinical,
      context: clinicalContext,
      getCurrentSeverityColor: (severity) => getSeverityColor(baseTheme, severity, clinicalContext),
      getCurrentStatusColor: (status) => getStatusColor(baseTheme, status, clinicalContext),
      getCurrentTypography: (variant) => getClinicalTypography(baseTheme, variant),
      getCurrentSpacing: (variant) => getClinicalSpacing(baseTheme, clinicalContext, variant),
      getCurrentAnimation: (type) => getClinicalAnimation(baseTheme, type, clinicalContext)
    }
  };
};

// Apply department-specific theme enhancements
export const applyDepartmentTheme = (theme, department) => {
  const deptContext = getDepartmentContext(department);
  const deptColors = getClinicalColors(theme, { department });
  
  // getClinicalColors returns just the colors object, not { palette: colors }
  // So we need to use deptColors directly
  return {
    ...theme,
    palette: deptColors,
    clinical: {
      ...theme.clinical,
      department: deptContext,
      currentDepartment: department
    }
  };
};

// Apply shift-based theme adjustments
export const applyShiftTheme = (theme, shift) => {
  const shiftContext = getShiftContext(shift);
  
  // Adjust brightness and contrast based on shift
  const adjustments = {
    day: { brightness: 1, contrast: 1 },
    night: { brightness: 0.85, contrast: 1.1 },
    emergency: { brightness: 1.1, contrast: 1.2 }
  };
  
  const adjustment = adjustments[shiftContext.type] || adjustments.day;
  
  return {
    ...theme,
    clinical: {
      ...theme.clinical,
      shift: shiftContext,
      currentShift: shift
    }
  };
};

export default {
  getClinicalContext,
  getShiftContext,
  getDepartmentContext,
  getUrgencyContext,
  getClinicalColors,
  getSeverityColor,
  getStatusColor,
  getClinicalTypography,
  getClinicalSpacing,
  getClinicalAnimation,
  getAccessibleColor,
  getContrastRatio,
  buildClinicalTheme,
  applyDepartmentTheme,
  applyShiftTheme
};