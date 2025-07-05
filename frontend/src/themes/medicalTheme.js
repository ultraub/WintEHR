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