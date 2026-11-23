/**
 * Medical Theme System
 * Professional color schemes and typography for healthcare applications
 */
import { createTheme } from '@mui/material/styles';
import { auroraFor } from './auroraPalette';

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
  // Clinical values, counts and dates: one numeral style everywhere.
  fontFamilyMonospace: '"JetBrains Mono", "SF Mono", Monaco, monospace',
  
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
    main: '#6366F1', // Indigo
    light: '#818CF8',
    dark: '#4F46E5',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#F97316', // Coral/orange
    light: '#FB923C',
    dark: '#EA580C',
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
    main: '#6366F1',
    light: '#818CF8',
    dark: '#4F46E5',
    contrastText: '#FFFFFF'
  },
  // Positive is a teal, from the same family as the shell's indigo and the
  // aurora's ribbon, rather than a grass green that sat apart from both.
  success: {
    main: '#0F8A7E',
    light: '#5ED6BF',
    dark: '#0B5F57',
    contrastText: '#FFFFFF'
  },
  // Two categorical series colours for charts (checked for colour-vision
  // separation and 3:1 against the paper surface; see themes/README.md).
  chart: {
    series: ['#6366F1', '#EB6834']
  },
  background: {
    default: '#FAFAF9',
    paper: '#FFFFFF',
    surface: '#F5F5F4'
  },
  text: {
    primary: '#1C1917',
    secondary: '#78716C',
    disabled: '#A8A29E'
  },
  divider: '#E7E5E4',
  // Sidebar palette tokens for dark sidebar
  sidebar: {
    bg: '#1F1D2B',
    hover: 'rgba(99, 102, 241, 0.12)',
    text: '#A8A29E',
    textActive: '#6366F1',
    bgActive: 'rgba(99, 102, 241, 0.1)',
    divider: 'rgba(255, 255, 255, 0.08)',
    brand: '#FAFAF9',
    sectionLabel: '#78716C',
  },
  action: {
    active: '#6366F1',
    hover: 'rgba(99, 102, 241, 0.04)',
    selected: 'rgba(99, 102, 241, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)'
  },
  // Clinical-specific semantic tokens
  clinical: {
    surfaces: {
      primary: 'rgba(99, 102, 241, 0.05)',
      secondary: 'rgba(249, 115, 22, 0.05)',
      warning: 'rgba(245, 124, 0, 0.05)',
      error: 'rgba(211, 47, 47, 0.05)',
      info: 'rgba(99, 102, 241, 0.05)',
      success: 'rgba(56, 142, 60, 0.05)'
    },
    interactions: {
      hover: 'rgba(99, 102, 241, 0.08)',
      pressed: 'rgba(99, 102, 241, 0.12)',
      focus: 'rgba(99, 102, 241, 0.16)',
      selected: 'rgba(99, 102, 241, 0.08)'
    },
    status: {
      active: '#4CAF50',
      inactive: '#9E9E9E',
      pending: '#FF9800',
      completed: '#6366F1',
      cancelled: '#F44336',
      draft: '#78716C',
      inProgress: '#6366F1'
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
        background: '#FAFAF9',
        surface: '#F5F5F4',
        text: '#1C1917'
      },
      night: {
        background: '#1C1917',
        surface: '#292524',
        text: '#F5F5F4'
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
      neutral: '#78716C'
    }
  }
};

// Dark Medical Theme (Enhanced for better contrast and readability)
const darkMedicalPalette = {
  mode: 'dark',
  primary: {
    main: '#818CF8', // Indigo-300 for dark mode (lighter indigo for contrast)
    light: '#A5B4FC',
    dark: '#6366F1',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#FB923C', // Coral-400 for dark mode
    light: '#FDBA74',
    dark: '#F97316',
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
    main: '#818CF8',
    light: '#A5B4FC',
    dark: '#6366F1',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#5ED6BF',
    light: '#A7F0E1',
    dark: '#0F8A7E',
    contrastText: '#000000'
  },
  // Chart series, stepped for the dark paper surface.
  chart: {
    series: ['#7479F2', '#D95926']
  },
  background: {
    default: '#1A1A2E', // Warm dark with slight indigo undertone
    paper: '#222236',   // Elevated surfaces
    surface: '#2A2A40'  // Third level for nested components
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    disabled: '#64748B'
  },
  divider: '#2A2A40',
  action: {
    active: '#818CF8',
    hover: 'rgba(129, 140, 248, 0.12)',
    selected: 'rgba(129, 140, 248, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)'
  },
  // Clinical-specific semantic tokens (dark mode - enhanced)
  clinical: {
    surfaces: {
      primary: 'rgba(129, 140, 248, 0.08)',
      secondary: 'rgba(251, 146, 60, 0.08)',
      warning: 'rgba(252, 211, 77, 0.08)',
      error: 'rgba(248, 113, 113, 0.08)',
      info: 'rgba(129, 140, 248, 0.08)',
      success: 'rgba(134, 239, 172, 0.08)'
    },
    interactions: {
      hover: 'rgba(129, 140, 248, 0.16)',
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
      spring: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
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
  // Chart series for High contrast.
  chart: {
    series: ['#0066CC', '#C2470A']
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
    },
    departments: {
      emergency: {
        primary: '#CC0000',
        surface: 'rgba(204, 0, 0, 0.05)',
        accent: '#FF3333'
      },
      cardiology: {
        primary: '#CC0066',
        surface: 'rgba(204, 0, 102, 0.05)',
        accent: '#FF3399'
      },
      pediatrics: {
        primary: '#FF6600',
        surface: 'rgba(255, 102, 0, 0.05)',
        accent: '#FF9933'
      },
      oncology: {
        primary: '#9900CC',
        surface: 'rgba(153, 0, 204, 0.05)',
        accent: '#CC33FF'
      },
      neurology: {
        primary: '#3333CC',
        surface: 'rgba(51, 51, 204, 0.05)',
        accent: '#6666FF'
      }
    },
    shifts: {
      day: {
        background: '#FFFFFF',
        surface: '#F8F9FA',
        text: '#000000'
      },
      night: {
        background: '#1A202C',
        surface: '#2D3748',
        text: '#FFFFFF'
      },
      emergency: {
        background: '#FFF3E0',
        surface: '#FFCC80',
        text: '#CC3300'
      }
    },
    comfort: {
      reassuring: '#009900',
      concerning: '#FF6600',
      alarming: '#CC0000',
      neutral: '#666666'
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
      spring: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    }
  }
};

// Base component customizations
const getComponentOverrides = (palette) => ({
  MuiCssBaseline: {
    styleOverrides: {
      // Switching between light and dark cross-fades instead of snapping.
      // App.js sets this class on <html> for the length of the fade.
      '.theme-switching, .theme-switching *, .theme-switching *::before, .theme-switching *::after': {
        transition: 'background-color 350ms ease, color 350ms ease, border-color 350ms ease, box-shadow 350ms ease, fill 350ms ease, stroke 350ms ease !important',
      },
      '@media (prefers-reduced-motion: reduce)': {
        '.theme-switching, .theme-switching *, .theme-switching *::before, .theme-switching *::after': {
          transition: 'none !important',
        },
      },
      // Brand colour in the small places: selection, caret, focus ring.
      '::selection': {
        backgroundColor: `color-mix(in srgb, ${palette.primary.main} ${palette.mode === 'dark' ? 45 : 24}%, transparent)`,
      },
      'input, textarea, [contenteditable]': {
        caretColor: palette.primary.main,
      },
      ':focus-visible': {
        outlineColor: palette.primary.main,
      },
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
        borderRadius: 8,
        border: `1px solid ${palette.divider}`,
        transition: 'box-shadow 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }
    }
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        backgroundImage: 'none'
      },
      outlined: {
        boxShadow: palette.mode === 'dark'
          ? '0 1px 3px rgba(0,0,0,0.25)'
          : '0 1px 3px rgba(0,0,0,0.06)',
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.875rem',
        padding: '8px 16px',
        transition: 'all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 1px 3px rgba(28, 25, 23, 0.08)'
        },
        // a button gives slightly when pressed
        '&:active': {
          transform: 'translateY(1px)'
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:active': { transform: 'none' }
        }
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.10)'
        }
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 22,
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
          transition: 'border-color 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px ${palette.action?.selected || 'rgba(99, 102, 241, 0.08)'}`
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
        borderRadius: 16,
        ...(palette.mode === 'dark' && {
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${palette.primary.main} 7%, transparent) 0%, transparent 200px)`,
        }),
      }
    }
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        backgroundColor: palette.mode === 'dark'
          ? (palette.background?.surface || '#2A2A40')
          : '#F5F5F4',
        '& .MuiTableCell-head': {
          fontWeight: 600,
        }
      }
    }
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500
      }
    }
  },
  MuiDataGrid: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        border: `1px solid ${palette.divider}`,
        '& .MuiDataGrid-cell': {
          borderBottom: `0.5px solid ${palette.divider}`
        },
        '& .MuiDataGrid-columnHeaders': {
          borderBottom: `1px solid ${palette.divider}`,
          backgroundColor: palette.background?.default || '#F5F5F7'
        }
      }
    }
  }
});

// Create theme function
export const createMedicalTheme = (themeName = 'professional', mode = 'light', phase) => {
  // Two themes are offered (see themePresets): Standard and High contrast,
  // each in light and dark. An unknown or retired name resolves to Standard.
  const highContrast = themeName === 'accessible';
  let palette;

  if (mode === 'dark') {
    // Deep copy: the high-contrast adjustments below used to be written into
    // the shared darkMedicalPalette object, so they leaked into Standard dark
    // for the rest of the session once High contrast had been shown.
    palette = structuredClone(darkMedicalPalette);
    if (highContrast) {
      palette.primary.main = '#66B2FF';
      palette.secondary.main = '#66FF66';
      palette.text.primary = '#FFFFFF';
      palette.text.secondary = '#E0E0E0';
      palette.divider = '#666666';
    }
  } else {
    // Deep copy for the same reason: the phase overrides below must not be
    // written into the shared light palette.
    palette = structuredClone(highContrast ? accessiblePalette : professionalMedicalPalette);
  }

  // The time-of-day phase (themes/auroraPalette.js) tints the Standard
  // theme's surfaces, so cards on every page take the phase's character.
  // High contrast keeps its own surfaces and only carries the phase name.
  const phaseTheme = phase ? auroraFor(phase).theme : null;
  if (phaseTheme && !highContrast) {
    Object.entries(phaseTheme).forEach(([key, value]) => {
      palette[key] = value && typeof value === 'object' ? { ...palette[key], ...value } : value;
    });
  }

  // Ensure mode is set correctly
  palette.mode = mode;

  const theme = createTheme({
    palette,
    // read by useAuroraPalette(); undefined on a theme built without one
    phase,
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
        easeInOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        easeOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
      },
      // Clinical-specific animations
      clinical: {
        dataUpdate: {
          duration: 300,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: 'none'
        },
        criticalAlert: {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          animation: 'pulse',
          iterations: 3
        },
        success: {
          duration: 400,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: 'scale(1.01)'
        },
        hover: {
          duration: 150,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: 'none'
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
    shadows: mode === 'dark' ? [
      'none',                                                                        // 0
      '0 1px 3px rgba(0,0,0,0.30), 0 0 0 1px rgba(99,102,241,0.08)',               // 1 - default Paper
      '0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.10)',               // 2 - elevated
      '0 4px 12px rgba(0,0,0,0.40), 0 0 0 1px rgba(99,102,241,0.08)',              // 3 - prominent
      '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.06)',              // 4 - cards
      '0 6px 12px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.20)',                   // 5
      '0 8px 16px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.20)',                   // 6 - elevated
      '0 12px 24px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.20)',                  // 7
      '0 20px 25px rgba(0,0,0,0.50), 0 8px 10px rgba(0,0,0,0.20)',                 // 8 - modals
    ] : [
      'none',                                                                        // 0
      '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',                    // 1 - default Paper
      '0 2px 6px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',                    // 2 - elevated
      '0 4px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',                   // 3 - prominent
      '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)',                   // 4 - cards
      '0 6px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',                   // 5
      '0 8px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',                   // 6 - elevated
      '0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)',                  // 7
      '0 20px 25px rgba(0,0,0,0.10), 0 8px 10px rgba(0,0,0,0.04)',                 // 8 - modals
      '0 20px 40px rgba(0, 0, 0, 0.10), 0 6px 12px rgba(0, 0, 0, 0.04)', // 9
      '0 24px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.04)', // 10
      '0 28px 56px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.04)', // 11
      '0 32px 64px rgba(0, 0, 0, 0.14), 0 10px 20px rgba(0, 0, 0, 0.04)', // 12
      '0 32px 64px rgba(0, 0, 0, 0.14), 0 10px 20px rgba(0, 0, 0, 0.04)', // 13
      '0 36px 72px rgba(0, 0, 0, 0.14), 0 12px 24px rgba(0, 0, 0, 0.04)', // 14
      '0 36px 72px rgba(0, 0, 0, 0.14), 0 12px 24px rgba(0, 0, 0, 0.04)', // 15
      '0 40px 80px rgba(0, 0, 0, 0.16), 0 14px 28px rgba(0, 0, 0, 0.04)', // 16
      '0 40px 80px rgba(0, 0, 0, 0.16), 0 14px 28px rgba(0, 0, 0, 0.04)', // 17
      '0 44px 88px rgba(0, 0, 0, 0.16), 0 16px 32px rgba(0, 0, 0, 0.04)', // 18
      '0 44px 88px rgba(0, 0, 0, 0.16), 0 16px 32px rgba(0, 0, 0, 0.04)', // 19
      '0 48px 96px rgba(0, 0, 0, 0.18), 0 18px 36px rgba(0, 0, 0, 0.04)', // 20
      '0 48px 96px rgba(0, 0, 0, 0.18), 0 18px 36px rgba(0, 0, 0, 0.04)', // 21
      '0 52px 104px rgba(0, 0, 0, 0.18), 0 20px 40px rgba(0, 0, 0, 0.04)', // 22
      '0 52px 104px rgba(0, 0, 0, 0.18), 0 20px 40px rgba(0, 0, 0, 0.04)', // 23
      '0 56px 112px rgba(0, 0, 0, 0.20), 0 22px 44px rgba(0, 0, 0, 0.04)'  // 24
    ]
  });

  // Add component overrides
  theme.components = getComponentOverrides(palette);

  return theme;
};

// Theme presets: the themes a user can pick.
//
// Two themes, each in light and dark mode, give the three looks the app
// supports: standard light, standard dark and high contrast. There used to
// be ten; every extra theme multiplied the surface that had to be checked
// for contrast and consistency, and none was maintained. The other palettes
// are still defined above but are no longer offered.
export const themePresets = {
  professional: {
    name: 'Standard',
    description: 'The default WintEHR look',
    preview: '#6366F1'
  },
  accessible: {
    name: 'High contrast',
    description: 'Stronger contrast for readability',
    preview: '#0066CC'
  }
};

export const DEFAULT_THEME = 'professional';

/** A stored theme that is no longer offered falls back to the default. */
export const resolveThemeName = (name) => (name && themePresets[name] ? name : DEFAULT_THEME);

export default createMedicalTheme;