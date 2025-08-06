/**
 * Medical Theme System
 * Professional color schemes and typography for healthcare applications
 */
import { createTheme } from '@mui/material/styles';

// Base typography configuration
const baseTypography = {
  fontFamily: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"'
  ].join(','),
  
  // Medical-specific font stacks
  monospace: [
    'JetBrains Mono',
    'SF Mono',
    'Monaco',
    'Inconsolata',
    '"Liberation Mono"',
    '"Courier New"',
    'monospace'
  ].join(','),
  
  // Clinical data font (optimized for readability)
  clinical: [
    'Source Sans Pro',
    'Inter',
    '-apple-system',
    'sans-serif'
  ].join(','),

  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em'
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em'
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.3
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.5
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.6
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.5
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '0.01em'
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0.01em',
    textTransform: 'none'
  }
};

// Professional Medical Theme (Primary)
const professionalMedicalPalette = {
  mode: 'light',
  primary: {
    main: '#1565C0', // Medical blue
    light: '#42A5F5',
    dark: '#0D47A1',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#2E7D32', // Medical green
    light: '#66BB6A',
    dark: '#1B5E20',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#D32F2F',
    light: '#EF5350',
    dark: '#C62828',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#F57C00',
    light: '#FFB74D',
    dark: '#E65100',
    contrastText: '#FFFFFF'
  },
  info: {
    main: '#0288D1',
    light: '#4FC3F7',
    dark: '#01579B',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#388E3C',
    light: '#81C784',
    dark: '#1B5E20',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#FAFBFC',
    paper: '#FFFFFF',
    surface: '#F5F7FA'
  },
  text: {
    primary: '#1A202C',
    secondary: '#4A5568',
    disabled: '#A0AEC0'
  },
  divider: '#E2E8F0',
  action: {
    active: '#1565C0',
    hover: 'rgba(21, 101, 192, 0.04)',
    selected: 'rgba(21, 101, 192, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  // Clinical-specific semantic tokens
  clinical: {
    surfaces: {
      primary: 'rgba(21, 101, 192, 0.05)',
      secondary: 'rgba(46, 125, 50, 0.05)',
      warning: 'rgba(245, 124, 0, 0.05)',
      error: 'rgba(211, 47, 47, 0.05)',
      info: 'rgba(2, 136, 209, 0.05)',
      success: 'rgba(56, 142, 60, 0.05)'
    },
    interactions: {
      hover: 'rgba(21, 101, 192, 0.08)',
      pressed: 'rgba(21, 101, 192, 0.12)',
      focus: 'rgba(21, 101, 192, 0.16)',
      selected: 'rgba(21, 101, 192, 0.08)'
    },
    status: {
      active: '#4CAF50',
      inactive: '#9E9E9E',
      pending: '#FF9800',
      completed: '#2196F3',
      cancelled: '#F44336',
      draft: '#757575',
      inProgress: '#3F51B5'
    },
    severity: {
      normal: '#4CAF50',
      mild: '#8BC34A',
      moderate: '#FF9800',
      severe: '#FF5722',
      critical: '#F44336'
    },
    // Department-specific color themes
    departments: {
      emergency: {
        primary: '#D32F2F',
        surface: 'rgba(211, 47, 47, 0.05)',
        accent: '#F44336'
      },
      cardiology: {
        primary: '#E91E63',
        surface: 'rgba(233, 30, 99, 0.05)',
        accent: '#F06292'
      },
      pediatrics: {
        primary: '#FF9800',
        surface: 'rgba(255, 152, 0, 0.05)',
        accent: '#FFB74D'
      },
      oncology: {
        primary: '#9C27B0',
        surface: 'rgba(156, 39, 176, 0.05)',
        accent: '#BA68C8'
      },
      neurology: {
        primary: '#3F51B5',
        surface: 'rgba(63, 81, 181, 0.05)',
        accent: '#7986CB'
      }
    },
    // Time-based themes for clinical shifts
    shifts: {
      day: {
        background: '#FAFBFC',
        surface: '#F5F7FA',
        text: '#1A202C'
      },
      night: {
        background: '#1A202C',
        surface: '#2D3748',
        text: '#F7FAFC'
      },
      emergency: {
        background: '#FFF3E0',
        surface: '#FFCC80',
        text: '#E65100'
      }
    },
    // Enhanced severity with psychological comfort levels
    comfort: {
      reassuring: '#4CAF50',
      concerning: '#FF9800',
      alarming: '#F44336',
      neutral: '#9E9E9E'
    }
  }
};

// Dark Medical Theme (Enhanced for better contrast and readability)
const darkMedicalPalette = {
  mode: 'dark',
  primary: {
    main: '#60A5FA', // Brighter blue for better contrast
    light: '#93BBFC',
    dark: '#2563EB',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#86EFAC', // Brighter green
    light: '#BBF7D0',
    dark: '#22C55E',
    contrastText: '#000000'
  },
  error: {
    main: '#F87171', // Softer red that's easier on eyes in dark mode
    light: '#FCA5A5',
    dark: '#DC2626',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FCD34D', // Brighter yellow
    light: '#FDE68A',
    dark: '#F59E0B',
    contrastText: '#000000'
  },
  info: {
    main: '#60A5FA',
    light: '#93BBFC',
    dark: '#2563EB',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#86EFAC',
    light: '#BBF7D0',
    dark: '#16A34A',
    contrastText: '#000000'
  },
  background: {
    default: '#0F172A', // Slightly lighter for better layering
    paper: '#1E293B',   // Better contrast with default
    surface: '#334155'   // Third level for nested components
  },
  text: {
    primary: '#F8FAFC',   // Slightly brighter
    secondary: '#CBD5E1', // Better contrast
    disabled: '#64748B'   // More visible disabled state
  },
  divider: '#334155', // Better visibility
  action: {
    active: '#60A5FA',
    hover: 'rgba(96, 165, 250, 0.12)',
    selected: 'rgba(96, 165, 250, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)'
  },
  // Clinical-specific semantic tokens (dark mode - enhanced)
  clinical: {
    surfaces: {
      primary: 'rgba(96, 165, 250, 0.08)',
      secondary: 'rgba(134, 239, 172, 0.08)',
      warning: 'rgba(252, 211, 77, 0.08)',
      error: 'rgba(248, 113, 113, 0.08)',
      info: 'rgba(96, 165, 250, 0.08)',
      success: 'rgba(134, 239, 172, 0.08)'
    },
    interactions: {
      hover: 'rgba(96, 165, 250, 0.16)',
      pressed: 'rgba(96, 165, 250, 0.20)',
      focus: 'rgba(96, 165, 250, 0.24)',
      selected: 'rgba(96, 165, 250, 0.16)'
    },
    status: {
      active: '#86EFAC',
      inactive: '#64748B',
      pending: '#FCD34D',
      completed: '#60A5FA',
      cancelled: '#F87171',
      draft: '#94A3B8',
      inProgress: '#A78BFA'
    },
    severity: {
      normal: '#86EFAC',
      mild: '#BBF7D0',
      moderate: '#FCD34D',
      severe: '#FB923C',
      critical: '#F87171'
    },
    // Department-specific color themes (dark mode - enhanced)
    departments: {
      emergency: {
        primary: '#F87171',
        surface: 'rgba(248, 113, 113, 0.08)',
        accent: '#FCA5A5'
      },
      cardiology: {
        primary: '#F472B6',
        surface: 'rgba(244, 114, 182, 0.08)',
        accent: '#FBCFE8'
      },
      pediatrics: {
        primary: '#FCD34D',
        surface: 'rgba(252, 211, 77, 0.08)',
        accent: '#FDE68A'
      },
      oncology: {
        primary: '#C084FC',
        surface: 'rgba(192, 132, 252, 0.08)',
        accent: '#E9D5FF'
      },
      neurology: {
        primary: '#A78BFA',
        surface: 'rgba(167, 139, 250, 0.08)',
        accent: '#C4B5FD'
      }
    },
    // Time-based themes for clinical shifts (dark mode - enhanced)
    shifts: {
      day: {
        background: '#1E293B',
        surface: '#334155',
        text: '#F8FAFC'
      },
      night: {
        background: '#0F172A',
        surface: '#1E293B',
        text: '#E2E8F0'
      },
      emergency: {
        background: '#27171A',
        surface: '#3F1F24',
        text: '#FCD34D'
      }
    },
    // Enhanced severity with psychological comfort levels (dark mode)
    comfort: {
      reassuring: '#86EFAC',
      concerning: '#FCD34D',
      alarming: '#F87171',
      neutral: '#94A3B8'
    }
  },
  // Animation tokens
  animations: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }
  }
};

// Accessible High Contrast Theme
const accessiblePalette = {
  mode: 'light',
  primary: {
    main: '#0066CC',
    light: '#3399FF',
    dark: '#004499',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#006600',
    light: '#339933',
    dark: '#004400',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#CC0000',
    light: '#FF3333',
    dark: '#990000',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FF6600',
    light: '#FF9933',
    dark: '#CC3300',
    contrastText: '#FFFFFF'
  },
  info: {
    main: '#0099CC',
    light: '#33CCFF',
    dark: '#006699',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#009900',
    light: '#33CC33',
    dark: '#006600',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
    surface: '#F8F9FA'
  },
  text: {
    primary: '#000000',
    secondary: '#333333',
    disabled: '#666666'
  },
  divider: '#000000',
  action: {
    active: '#0066CC',
    hover: 'rgba(0, 102, 204, 0.08)',
    selected: 'rgba(0, 102, 204, 0.12)',
    disabled: 'rgba(0, 0, 0, 0.38)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  // Clinical-specific semantic tokens (accessible)
  clinical: {
    surfaces: {
      primary: 'rgba(0, 102, 204, 0.05)',
      secondary: 'rgba(0, 102, 0, 0.05)',
      warning: 'rgba(255, 102, 0, 0.05)',
      error: 'rgba(204, 0, 0, 0.05)',
      info: 'rgba(0, 153, 204, 0.05)',
      success: 'rgba(0, 153, 0, 0.05)'
    },
    interactions: {
      hover: 'rgba(0, 102, 204, 0.08)',
      pressed: 'rgba(0, 102, 204, 0.12)',
      focus: 'rgba(0, 102, 204, 0.16)',
      selected: 'rgba(0, 102, 204, 0.08)'
    },
    status: {
      active: '#009900',
      inactive: '#666666',
      pending: '#FF6600',
      completed: '#0099CC',
      cancelled: '#CC0000',
      draft: '#666666',
      inProgress: '#0066CC'
    },
    severity: {
      normal: '#009900',
      mild: '#66CC00',
      moderate: '#FF6600',
      severe: '#FF3300',
      critical: '#CC0000'
    }
  },
  // Animation tokens
  animations: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }
  }
};

// Warm Clinical Theme
const warmClinicalPalette = {
  mode: 'light',
  primary: {
    main: '#7C4DFF',
    light: '#B085F5',
    dark: '#512DA8',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#FF7043',
    light: '#FFAB91',
    dark: '#D84315',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#E53E3E',
    light: '#FC8181',
    dark: '#C53030',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#DD6B20',
    light: '#F6AD55',
    dark: '#C05621',
    contrastText: '#FFFFFF'
  },
  info: {
    main: '#3182CE',
    light: '#63B3ED',
    dark: '#2C5282',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#38A169',
    light: '#68D391',
    dark: '#2F855A',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#FFFEF7',
    paper: '#FFFFFF',
    surface: '#F7FAFC'
  },
  text: {
    primary: '#2D3748',
    secondary: '#4A5568',
    disabled: '#A0AEC0'
  },
  divider: '#E2E8F0',
  action: {
    active: '#7C4DFF',
    hover: 'rgba(124, 77, 255, 0.04)',
    selected: 'rgba(124, 77, 255, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  default: {
    main: '#718096', // A neutral gray for default badges in warm mode
    light: '#A0AEC0',
    dark: '#4A5568',
    contrastText: '#FFFFFF'
  },
  // Clinical-specific semantic tokens (warm)
  clinical: {
    surfaces: {
      primary: 'rgba(124, 77, 255, 0.05)',
      secondary: 'rgba(255, 112, 67, 0.05)',
      warning: 'rgba(221, 107, 32, 0.05)',
      error: 'rgba(229, 62, 62, 0.05)',
      info: 'rgba(49, 130, 206, 0.05)',
      success: 'rgba(56, 161, 105, 0.05)'
    },
    interactions: {
      hover: 'rgba(124, 77, 255, 0.08)',
      pressed: 'rgba(124, 77, 255, 0.12)',
      focus: 'rgba(124, 77, 255, 0.16)',
      selected: 'rgba(124, 77, 255, 0.08)'
    },
    status: {
      active: '#38A169',
      inactive: '#A0AEC0',
      pending: '#DD6B20',
      completed: '#3182CE',
      cancelled: '#E53E3E',
      draft: '#718096',
      inProgress: '#7C4DFF'
    },
    severity: {
      normal: '#38A169',
      mild: '#68D391',
      moderate: '#DD6B20',
      severe: '#F56500',
      critical: '#E53E3E'
    }
  },
  // Animation tokens
  animations: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }
  }
};

// Ocean Health Theme
const oceanHealthPalette = {
  mode: 'light',
  primary: {
    main: '#0097A7',
    light: '#4DD0E1',
    dark: '#006064',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#00ACC1',
    light: '#5DDEF4',
    dark: '#007C91',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#E53935',
    light: '#FF6F60',
    dark: '#AB000D',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FFB300',
    light: '#FFE54C',
    dark: '#C68400',
    contrastText: '#000000'
  },
  info: {
    main: '#039BE5',
    light: '#63CCFF',
    dark: '#006DB3',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#00897B',
    light: '#4EBAAA',
    dark: '#005B4F',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#F0F7F8',
    paper: '#FFFFFF',
    surface: '#E0F2F1'
  },
  text: {
    primary: '#263238',
    secondary: '#607D8B',
    disabled: '#B0BEC5'
  },
  divider: '#CFD8DC',
  action: {
    active: '#0097A7',
    hover: 'rgba(0, 151, 167, 0.04)',
    selected: 'rgba(0, 151, 167, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  clinical: {
    surfaces: {
      primary: 'rgba(0, 151, 167, 0.05)',
      secondary: 'rgba(0, 172, 193, 0.05)',
      warning: 'rgba(255, 179, 0, 0.05)',
      error: 'rgba(229, 57, 53, 0.05)',
      info: 'rgba(3, 155, 229, 0.05)',
      success: 'rgba(0, 137, 123, 0.05)'
    },
    severity: {
      normal: '#00897B',
      mild: '#26A69A',
      moderate: '#FFB300',
      severe: '#FF6F00',
      critical: '#E53935'
    }
  }
};

// Forest Wellness Theme
const forestWellnessPalette = {
  mode: 'light',
  primary: {
    main: '#2E7D32',
    light: '#60AD5E',
    dark: '#005005',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#558B2F',
    light: '#85BB5C',
    dark: '#255D00',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#C62828',
    light: '#F05545',
    dark: '#8E0000',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#F9A825',
    light: '#FFD95A',
    dark: '#C17900',
    contrastText: '#000000'
  },
  info: {
    main: '#1976D2',
    light: '#63A4FF',
    dark: '#004BA0',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#43A047',
    light: '#76D275',
    dark: '#00701A',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#F1F8E9',
    paper: '#FFFFFF',
    surface: '#E8F5E9'
  },
  text: {
    primary: '#1B5E20',
    secondary: '#388E3C',
    disabled: '#81C784'
  },
  divider: '#C8E6C9',
  action: {
    active: '#2E7D32',
    hover: 'rgba(46, 125, 50, 0.04)',
    selected: 'rgba(46, 125, 50, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  clinical: {
    surfaces: {
      primary: 'rgba(46, 125, 50, 0.05)',
      secondary: 'rgba(85, 139, 47, 0.05)',
      warning: 'rgba(249, 168, 37, 0.05)',
      error: 'rgba(198, 40, 40, 0.05)',
      info: 'rgba(25, 118, 210, 0.05)',
      success: 'rgba(67, 160, 71, 0.05)'
    },
    severity: {
      normal: '#43A047',
      mild: '#66BB6A',
      moderate: '#F9A825',
      severe: '#FF6F00',
      critical: '#C62828'
    }
  }
};

// Sunrise Care Theme
const sunriseCarePalette = {
  mode: 'light',
  primary: {
    main: '#F57C00',
    light: '#FFB74D',
    dark: '#BB4D00',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#FFD54F',
    light: '#FFFF81',
    dark: '#C8A415',
    contrastText: '#000000'
  },
  error: {
    main: '#D32F2F',
    light: '#FF6659',
    dark: '#9A0007',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FFA000',
    light: '#FFD149',
    dark: '#C67100',
    contrastText: '#000000'
  },
  info: {
    main: '#1E88E5',
    light: '#6AB7FF',
    dark: '#005CB2',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#689F38',
    light: '#9CCC65',
    dark: '#387002',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#FFF8E1',
    paper: '#FFFFFF',
    surface: '#FFECB3'
  },
  text: {
    primary: '#3E2723',
    secondary: '#6D4C41',
    disabled: '#A1887F'
  },
  divider: '#FFE0B2',
  action: {
    active: '#F57C00',
    hover: 'rgba(245, 124, 0, 0.04)',
    selected: 'rgba(245, 124, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  clinical: {
    surfaces: {
      primary: 'rgba(245, 124, 0, 0.05)',
      secondary: 'rgba(255, 213, 79, 0.05)',
      warning: 'rgba(255, 160, 0, 0.05)',
      error: 'rgba(211, 47, 47, 0.05)',
      info: 'rgba(30, 136, 229, 0.05)',
      success: 'rgba(104, 159, 56, 0.05)'
    },
    severity: {
      normal: '#689F38',
      mild: '#8BC34A',
      moderate: '#FFA000',
      severe: '#FF6F00',
      critical: '#D32F2F'
    }
  }
};

// Midnight Shift Theme (Ultra-dark)
const midnightShiftPalette = {
  mode: 'dark',
  primary: {
    main: '#5C6BC0',
    light: '#8E99F3',
    dark: '#26418F',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#7E57C2',
    light: '#B085F5',
    dark: '#4D2C91',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#EF5350',
    light: '#FF867C',
    dark: '#B61827',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FFA726',
    light: '#FFD95B',
    dark: '#C77800',
    contrastText: '#000000'
  },
  info: {
    main: '#42A5F5',
    light: '#80D6FF',
    dark: '#0077C2',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#66BB6A',
    light: '#98EE99',
    dark: '#338A3E',
    contrastText: '#000000'
  },
  background: {
    default: '#0A0E13',
    paper: '#1A1F2E',
    surface: '#151922'
  },
  text: {
    primary: '#F7FAFC',
    secondary: '#CBD5E0',
    disabled: '#718096'
  },
  divider: 'rgba(255, 255, 255, 0.08)',
  action: {
    active: '#5C6BC0',
    hover: 'rgba(92, 107, 192, 0.08)',
    selected: 'rgba(92, 107, 192, 0.12)',
    disabled: 'rgba(255, 255, 255, 0.26)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)'
  },
  clinical: {
    surfaces: {
      primary: 'rgba(92, 107, 192, 0.08)',
      secondary: 'rgba(126, 87, 194, 0.08)',
      warning: 'rgba(255, 167, 38, 0.08)',
      error: 'rgba(239, 83, 80, 0.08)',
      info: 'rgba(66, 165, 245, 0.08)',
      success: 'rgba(102, 187, 106, 0.08)'
    },
    severity: {
      normal: '#66BB6A',
      mild: '#81C784',
      moderate: '#FFA726',
      severe: '#FF7043',
      critical: '#EF5350'
    }
  }
};

// Monochrome Clinical Theme
const monochromeClinicalPalette = {
  mode: 'light',
  primary: {
    main: '#616161',
    light: '#8E8E8E',
    dark: '#373737',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#424242',
    light: '#6D6D6D',
    dark: '#1B1B1B',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#D32F2F',
    light: '#EF5350',
    dark: '#C62828',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#F57C00',
    light: '#FFB74D',
    dark: '#E65100',
    contrastText: '#FFFFFF'
  },
  info: {
    main: '#757575',
    light: '#A4A4A4',
    dark: '#494949',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#4CAF50',
    light: '#81C784',
    dark: '#388E3C',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#FAFAFA',
    paper: '#FFFFFF',
    surface: '#F5F5F5'
  },
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD'
  },
  divider: '#E0E0E0',
  action: {
    active: '#616161',
    hover: 'rgba(97, 97, 97, 0.04)',
    selected: 'rgba(97, 97, 97, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  clinical: {
    surfaces: {
      primary: 'rgba(97, 97, 97, 0.05)',
      secondary: 'rgba(66, 66, 66, 0.05)',
      warning: 'rgba(245, 124, 0, 0.05)',
      error: 'rgba(211, 47, 47, 0.05)',
      info: 'rgba(117, 117, 117, 0.05)',
      success: 'rgba(76, 175, 80, 0.05)'
    },
    severity: {
      normal: '#4CAF50',
      mild: '#66BB6A',
      moderate: '#F57C00',
      severe: '#FF5722',
      critical: '#D32F2F'
    }
  }
};

// Pediatric Friendly Theme
const pediatricFriendlyPalette = {
  mode: 'light',
  primary: {
    main: '#E91E63',
    light: '#F8BBD0',
    dark: '#AD1457',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#00BCD4',
    light: '#B2EBF2',
    dark: '#0097A7',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#F44336',
    light: '#FFCDD2',
    dark: '#C62828',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FF9800',
    light: '#FFE0B2',
    dark: '#F57C00',
    contrastText: '#000000'
  },
  info: {
    main: '#2196F3',
    light: '#BBDEFB',
    dark: '#1976D2',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#4CAF50',
    light: '#C8E6C9',
    dark: '#388E3C',
    contrastText: '#FFFFFF'
  },
  background: {
    default: '#FFF3E0',
    paper: '#FFFFFF',
    surface: '#FCE4EC'
  },
  text: {
    primary: '#311B92',
    secondary: '#5E35B1',
    disabled: '#9575CD'
  },
  divider: '#E1BEE7',
  action: {
    active: '#E91E63',
    hover: 'rgba(233, 30, 99, 0.04)',
    selected: 'rgba(233, 30, 99, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  clinical: {
    surfaces: {
      primary: 'rgba(233, 30, 99, 0.05)',
      secondary: 'rgba(0, 188, 212, 0.05)',
      warning: 'rgba(255, 152, 0, 0.05)',
      error: 'rgba(244, 67, 54, 0.05)',
      info: 'rgba(33, 150, 243, 0.05)',
      success: 'rgba(76, 175, 80, 0.05)'
    },
    severity: {
      normal: '#4CAF50',
      mild: '#81C784',
      moderate: '#FF9800',
      severe: '#FF5722',
      critical: '#F44336'
    }
  }
};

// Base component customizations
const getComponentOverrides = (palette) => ({
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        scrollbarWidth: 'thin',
        scrollbarColor: `${palette.action.active} transparent`,
        '&::-webkit-scrollbar': {
          width: 8,
          height: 8
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: palette.action.active,
          borderRadius: 4,
          '&:hover': {
            backgroundColor: palette.action.selected
          }
        }
      }
    }
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        border: `1px solid ${palette.divider}`,
        transition: `all ${palette.animations?.duration?.shorter || 200}ms ${palette.animations?.easing?.easeInOut || 'ease-in-out'}`,
        '&:hover': {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)'
        }
      }
    }
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        backgroundImage: 'none'
      },
      elevation1: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)'
      },
      elevation2: {
        boxShadow: '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)'
      },
      elevation3: {
        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)'
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.875rem',
        padding: '8px 16px',
        transition: `all ${palette.animations?.duration?.shorter || 200}ms ${palette.animations?.easing?.easeInOut || 'ease-in-out'}`,
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)'
        }
      },
      contained: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
        }
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        fontSize: '0.75rem',
        fontWeight: 500,
        height: 24
      }
    }
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
          transition: `all ${palette.animations?.duration?.shorter || 200}ms ${palette.animations?.easing?.easeInOut || 'ease-in-out'}`,
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          },
          '&.Mui-focused': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)'
          }
        }
      }
    }
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        border: '1px solid',
        '& .MuiAlert-icon': {
          marginRight: 12
        }
      },
      standardSuccess: {
        borderColor: palette.success.light,
        backgroundColor: palette.mode === 'dark' ? 'rgba(102, 187, 106, 0.1)' : 'rgba(102, 187, 106, 0.05)'
      },
      standardError: {
        borderColor: palette.error.light,
        backgroundColor: palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)'
      },
      standardWarning: {
        borderColor: palette.warning.light,
        backgroundColor: palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.05)'
      },
      standardInfo: {
        borderColor: palette.info.light,
        backgroundColor: palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)'
      }
    }
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        height: 6
      }
    }
  },
  MuiAccordion: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        border: `1px solid ${palette.divider}`,
        '&:before': {
          display: 'none'
        },
        '&.Mui-expanded': {
          margin: 0
        }
      }
    }
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 12
      }
    }
  },
  MuiDataGrid: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        border: `1px solid ${palette.divider}`,
        '& .MuiDataGrid-cell': {
          borderBottom: `1px solid ${palette.divider}`
        },
        '& .MuiDataGrid-columnHeaders': {
          borderBottom: `2px solid ${palette.divider}`,
          backgroundColor: palette.background.surface
        }
      }
    }
  }
});

// Create theme function
export const createMedicalTheme = (themeName = 'professional', mode = 'light') => {
  let palette;
  
  // For dark mode, use the enhanced dark medical palette as base
  if (mode === 'dark') {
    // Special case: midnight is already a dark theme
    if (themeName === 'midnight') {
      palette = { ...midnightShiftPalette };
    } else {
      palette = { ...darkMedicalPalette };
      
      // Apply theme-specific adjustments to dark mode
      switch (themeName) {
        case 'accessible':
          // High contrast adjustments for dark mode
          palette.primary.main = '#66B2FF';
          palette.secondary.main = '#66FF66';
          palette.text.primary = '#FFFFFF';
          palette.text.secondary = '#E0E0E0';
          palette.divider = '#666666';
          break;
        case 'warm':
          // Warm adjustments for dark mode
          palette.primary.main = '#B794F4';
          palette.secondary.main = '#F6AD55';
          break;
        case 'ocean':
          // Ocean adjustments for dark mode
          palette.primary.main = '#4DD0E1';
          palette.secondary.main = '#5DDEF4';
          palette.clinical.severity.normal = '#4EBAAA';
          break;
        case 'forest':
          // Forest adjustments for dark mode
          palette.primary.main = '#81C784';
          palette.secondary.main = '#A5D6A7';
          palette.clinical.severity.normal = '#66BB6A';
          break;
        case 'sunrise':
          // Sunrise adjustments for dark mode
          palette.primary.main = '#FFB74D';
          palette.secondary.main = '#FFFF81';
          palette.clinical.severity.normal = '#9CCC65';
          break;
        case 'monochrome':
          // Monochrome adjustments for dark mode
          palette.primary.main = '#BDBDBD';
          palette.secondary.main = '#9E9E9E';
          palette.clinical.severity = {
            normal: '#81C784',
            mild: '#A5D6A7',
            moderate: '#FFB74D',
            severe: '#FF8A65',
            critical: '#EF5350'
          };
          break;
        case 'pediatric':
          // Pediatric adjustments for dark mode
          palette.primary.main = '#F8BBD0';
          palette.secondary.main = '#B2EBF2';
          palette.clinical.severity.normal = '#81C784';
          break;
      }
    }
  } else {
    // Light mode themes
    switch (themeName) {
      case 'accessible':
        palette = accessiblePalette;
        break;
      case 'warm':
        palette = warmClinicalPalette;
        break;
      case 'ocean':
        palette = oceanHealthPalette;
        break;
      case 'forest':
        palette = forestWellnessPalette;
        break;
      case 'sunrise':
        palette = sunriseCarePalette;
        break;
      case 'midnight':
        palette = midnightShiftPalette;
        break;
      case 'monochrome':
        palette = monochromeClinicalPalette;
        break;
      case 'pediatric':
        palette = pediatricFriendlyPalette;
        break;
      case 'professional':
      default:
        palette = professionalMedicalPalette;
        break;
    }
  }

  // Ensure mode is set correctly
  palette.mode = mode;

  const theme = createTheme({
    palette,
    typography: baseTypography,
    shape: {
      borderRadius: 8
    },
    spacing: 8,
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920
      }
    },
    // Enhanced clinical spacing system
    clinicalSpacing: {
      xs: 4,    // 0.25rem
      sm: 8,    // 0.5rem
      md: 16,   // 1rem
      lg: 24,   // 1.5rem
      xl: 32,   // 2rem
      xxl: 48,  // 3rem
      // Clinical-specific spacing
      clinical: {
        compact: 4,     // Dense data lists
        comfortable: 8, // Standard spacing
        spacious: 16,   // Important sections
        section: 24,    // Between major sections
        page: 32        // Page-level spacing
      }
    },
    // Animation system
    animations: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
      },
      // Clinical-specific animations
      clinical: {
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
      }
    },
    // Component sizing tokens
    components: {
      cardPadding: 24,
      buttonHeight: 40,
      iconSize: 20,
      avatarSize: 32,
      chipHeight: 24,
      inputHeight: 56
    },
    // Clinical typography system
    clinicalTypography: {
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
        fontFamily: 'JetBrains Mono, SF Mono, Monaco, monospace',
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
        fontFamily: 'Source Sans Pro, Inter, -apple-system, sans-serif',
        lineHeight: 1.6
      }
    },
    shadows: [
      'none',
      '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
      '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
      '0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)',
      '0 15px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.05)',
      '0 20px 40px rgba(0, 0, 0, 0.2)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)',
      '0 25px 50px rgba(0, 0, 0, 0.25)'
    ]
  });

  // Add component overrides
  theme.components = getComponentOverrides(palette);

  return theme;
};

// Theme presets
export const themePresets = {
  professional: {
    name: 'Professional Medical',
    description: 'Clean, professional medical interface',
    preview: '#1565C0'
  },
  dark: {
    name: 'Dark Medical',
    description: 'Dark theme optimized for medical professionals',
    preview: '#42A5F5'
  },
  accessible: {
    name: 'High Contrast',
    description: 'Maximum accessibility and contrast',
    preview: '#0066CC'
  },
  warm: {
    name: 'Warm Clinical',
    description: 'Warm, approachable clinical interface',
    preview: '#7C4DFF'
  },
  ocean: {
    name: 'Ocean Health',
    description: 'Calming blues and teals for therapeutic environments',
    preview: '#0097A7'
  },
  forest: {
    name: 'Forest Wellness',
    description: 'Natural greens promoting healing and wellness',
    preview: '#2E7D32'
  },
  sunrise: {
    name: 'Sunrise Care',
    description: 'Warm oranges and yellows for optimistic healthcare',
    preview: '#F57C00'
  },
  midnight: {
    name: 'Midnight Shift',
    description: 'Ultra-dark theme for night shift workers',
    preview: '#1A237E'
  },
  monochrome: {
    name: 'Monochrome Clinical',
    description: 'Grayscale theme for minimal color distraction',
    preview: '#616161'
  },
  pediatric: {
    name: 'Pediatric Friendly',
    description: 'Bright, cheerful colors for pediatric departments',
    preview: '#E91E63'
  }
};

export default createMedicalTheme;