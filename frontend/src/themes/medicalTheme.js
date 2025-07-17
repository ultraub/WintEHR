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

// Dark Medical Theme
const darkMedicalPalette = {
  mode: 'dark',
  primary: {
    main: '#42A5F5',
    light: '#64B5F6',
    dark: '#1976D2',
    contrastText: '#000000'
  },
  secondary: {
    main: '#66BB6A',
    light: '#81C784',
    dark: '#4CAF50',
    contrastText: '#000000'
  },
  error: {
    main: '#EF5350',
    light: '#F44336',
    dark: '#D32F2F',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FFB74D',
    light: '#FFC107',
    dark: '#F57C00',
    contrastText: '#000000'
  },
  info: {
    main: '#4FC3F7',
    light: '#03A9F4',
    dark: '#0288D1',
    contrastText: '#000000'
  },
  success: {
    main: '#81C784',
    light: '#4CAF50',
    dark: '#388E3C',
    contrastText: '#000000'
  },
  background: {
    default: '#0A0E13',
    paper: '#1A202C',
    surface: '#2D3748'
  },
  text: {
    primary: '#F7FAFC',
    secondary: '#E2E8F0',
    disabled: '#718096'
  },
  divider: '#4A5568',
  action: {
    active: '#42A5F5',
    hover: 'rgba(66, 165, 245, 0.08)',
    selected: 'rgba(66, 165, 245, 0.12)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)'
  },
  // Clinical-specific semantic tokens (dark mode)
  clinical: {
    surfaces: {
      primary: 'rgba(66, 165, 245, 0.08)',
      secondary: 'rgba(102, 187, 106, 0.08)',
      warning: 'rgba(255, 183, 77, 0.08)',
      error: 'rgba(239, 83, 80, 0.08)',
      info: 'rgba(79, 195, 247, 0.08)',
      success: 'rgba(129, 199, 132, 0.08)'
    },
    interactions: {
      hover: 'rgba(66, 165, 245, 0.12)',
      pressed: 'rgba(66, 165, 245, 0.16)',
      focus: 'rgba(66, 165, 245, 0.20)',
      selected: 'rgba(66, 165, 245, 0.12)'
    },
    status: {
      active: '#81C784',
      inactive: '#9E9E9E',
      pending: '#FFB74D',
      completed: '#4FC3F7',
      cancelled: '#EF5350',
      draft: '#B0BEC5',
      inProgress: '#7986CB'
    },
    severity: {
      normal: '#81C784',
      mild: '#AED581',
      moderate: '#FFB74D',
      severe: '#FF7043',
      critical: '#EF5350'
    },
    // Department-specific color themes (dark mode)
    departments: {
      emergency: {
        primary: '#EF5350',
        surface: 'rgba(239, 83, 80, 0.08)',
        accent: '#F44336'
      },
      cardiology: {
        primary: '#F06292',
        surface: 'rgba(240, 98, 146, 0.08)',
        accent: '#E91E63'
      },
      pediatrics: {
        primary: '#FFB74D',
        surface: 'rgba(255, 183, 77, 0.08)',
        accent: '#FF9800'
      },
      oncology: {
        primary: '#BA68C8',
        surface: 'rgba(186, 104, 200, 0.08)',
        accent: '#9C27B0'
      },
      neurology: {
        primary: '#7986CB',
        surface: 'rgba(121, 134, 203, 0.08)',
        accent: '#3F51B5'
      }
    },
    // Time-based themes for clinical shifts (dark mode)
    shifts: {
      day: {
        background: '#1A202C',
        surface: '#2D3748',
        text: '#F7FAFC'
      },
      night: {
        background: '#0A0E13',
        surface: '#1A202C',
        text: '#E2E8F0'
      },
      emergency: {
        background: '#2D1B14',
        surface: '#4A2C17',
        text: '#FFB74D'
      }
    },
    // Enhanced severity with psychological comfort levels (dark mode)
    comfort: {
      reassuring: '#81C784',
      concerning: '#FFB74D',
      alarming: '#EF5350',
      neutral: '#B0BEC5'
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
        transition: 'all 0.2s ease-in-out',
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
        transition: 'all 0.2s ease-in-out',
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
          transition: 'all 0.2s ease-in-out',
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
  
  switch (themeName) {
    case 'dark':
      palette = darkMedicalPalette;
      break;
    case 'accessible':
      palette = accessiblePalette;
      break;
    case 'warm':
      palette = warmClinicalPalette;
      break;
    case 'professional':
    default:
      palette = professionalMedicalPalette;
      break;
  }

  // Override mode if specified
  if (mode) {
    palette = { ...palette, mode };
  }

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
  }
};

export default createMedicalTheme;