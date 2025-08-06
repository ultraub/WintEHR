/**
 * Clinical Theme System Extension
 * Enhanced design tokens for clinical workspace components
 */
import { createTheme } from '@mui/material/styles';
import { createMedicalTheme } from './medicalTheme';

// Clinical-specific design tokens - Enhanced with modern aesthetics
export const clinicalTokens = {
  // Modern gradients for visual depth
  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    error: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    info: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    neutral: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    // Subtle background gradients
    backgroundSubtle: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
    backgroundCard: 'linear-gradient(145deg, #ffffff, #f8f9fa)',
    // Severity gradients
    severityCritical: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
    severityHigh: 'linear-gradient(135deg, #ff9a00 0%, #ff7643 100%)',
    severityModerate: 'linear-gradient(135deg, #ffd93d 0%, #f9ca24 100%)',
    severityLow: 'linear-gradient(135deg, #6bcf7f 0%, #47b784 100%)',
    severityNormal: 'linear-gradient(135deg, #e0e7ff 0%, #cfd9f3 100%)'
  },
  
  // Clean shadows for professional medical UI - matching older design
  modernShadows: {
    xs: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.04)',
    md: '0 1px 3px rgba(0,0,0,0.08)',
    lg: '0 2px 4px rgba(0,0,0,0.10)',
    xl: '0 4px 8px rgba(0,0,0,0.12)',
    // Minimal colored shadows
    primary: '0 1px 3px rgba(41, 121, 255, 0.1)',
    success: '0 1px 3px rgba(76, 175, 80, 0.1)',
    warning: '0 1px 3px rgba(255, 152, 0, 0.1)',
    error: '0 1px 3px rgba(244, 67, 54, 0.1)',
    // Elevation shadows - Very subtle
    elevation0: 'none',
    elevation1: '0 1px 2px rgba(0,0,0,0.04)',
    elevation2: '0 1px 3px rgba(0,0,0,0.08)',
    elevation3: '0 2px 4px rgba(0,0,0,0.10)',
    elevation4: '0 4px 8px rgba(0,0,0,0.12)',
    // Inner shadows for inputs
    inner: 'inset 0 1px 2px rgba(0,0,0,0.02)',
    innerDeep: 'inset 0 1px 3px rgba(0,0,0,0.04)'
  },
  
  // Animation presets
  animations: {
    // Durations
    duration: {
      instant: 0,
      fast: 150,
      normal: 250,
      slow: 350,
      complex: 500
    },
    // Easings
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    },
    // Presets
    presets: {
      fadeIn: 'fadeIn 0.25s ease-out',
      slideUp: 'slideUp 0.3s ease-out',
      slideDown: 'slideDown 0.3s ease-out',
      scaleIn: 'scaleIn 0.2s ease-out',
      rotate: 'rotate 0.3s ease-in-out',
      pulse: 'pulse 2s infinite',
      shimmer: 'shimmer 2s infinite linear'
    }
  },
  
  // Density modes for clinical data display
  density: {
    compact: { 
      padding: 4, 
      rowHeight: 32,
      fontSize: '0.75rem',
      iconSize: 16,
      borderRadius: 4
    },
    comfortable: { 
      padding: 8, 
      rowHeight: 48,
      fontSize: '0.875rem',
      iconSize: 20,
      borderRadius: 8
    },
    spacious: { 
      padding: 16, 
      rowHeight: 64,
      fontSize: '1rem',
      iconSize: 24,
      borderRadius: 12
    }
  },
  
  // Clinical severity colors - Professional medical standards
  severity: {
    critical: { 
      bg: '#FEF2F2',  // Very light red background
      gradient: 'none',  // No gradients for professional look
      color: '#DC2626',  // red-600 - Strong but not alarming
      icon: '●',
      borderColor: '#DC2626',  // Same as text color for consistency
      hoverBg: '#FEE2E2',
      shadow: '0 1px 2px 0 rgba(220, 38, 38, 0.05)',
      animation: 'pulse 2s infinite'  // Keep for critical alerts
    },
    high: { 
      bg: '#FFF7ED',  // Very light orange
      gradient: 'none',
      color: '#EA580C',  // orange-600
      icon: '●',
      borderColor: '#EA580C',
      hoverBg: '#FED7AA',
      shadow: '0 1px 2px 0 rgba(234, 88, 12, 0.05)'
    },
    moderate: { 
      bg: '#FFFBEB',  // Very light amber
      gradient: 'none',
      color: '#D97706',  // amber-600
      icon: '●',
      borderColor: '#D97706',
      hoverBg: '#FEF3C7',
      shadow: '0 1px 2px 0 rgba(217, 119, 6, 0.05)'
    },
    low: { 
      bg: '#F0FDF4',  // Very light emerald
      gradient: 'none',
      color: '#059669',  // emerald-600
      icon: '●',
      borderColor: '#059669',
      hoverBg: '#D1FAE5',
      shadow: '0 1px 2px 0 rgba(5, 150, 105, 0.05)'
    },
    normal: { 
      bg: '#F9FAFB',  // gray-50
      gradient: 'none',
      color: '#6B7280',  // gray-500
      icon: '●',
      borderColor: '#E5E7EB',  // gray-200
      hoverBg: '#F3F4F6',  // gray-100
      shadow: 'none'
    }
  },
  
  // Animation timings for clinical interactions
  transitions: {
    instant: '0ms',
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    complex: '500ms'
  },

  // Clinical data visualization colors
  dataViz: {
    vitals: {
      heartRate: '#E91E63',
      bloodPressure: '#F44336',
      temperature: '#FF9800',
      oxygenSaturation: '#2196F3',
      respiratoryRate: '#00BCD4'
    },
    labs: {
      normal: '#4CAF50',
      abnormalLow: '#2196F3',
      abnormalHigh: '#FF5722',
      critical: '#F44336',
      pending: '#9E9E9E'
    },
    trends: {
      improving: '#4CAF50',
      stable: '#2196F3',
      worsening: '#FF5722',
      variable: '#FF9800'
    }
  },

  // Spacing system for clinical layouts
  spacing: {
    xs: 4,   // 4px - Inline elements
    sm: 8,   // 8px - Related items
    md: 16,  // 16px - Standard spacing
    lg: 24,  // 24px - Section spacing
    xl: 32,  // 32px - Major sections
    xxl: 48  // 48px - Page sections
  },

  // Border radius for clinical components - Professional medical UI design
  borderRadius: {
    xs: 0,    // 0px - Clinical cards, data tables (sharp corners)
    sm: 2,    // 2px - Buttons, input fields (subtle softness)
    md: 4,    // 4px - Chips, tags, modals (slight rounding)
    lg: 4,    // 4px - Larger components (consistent with md)
    xl: 4,    // 4px - Maximum rounding for any component
    pill: 9999,
    sharp: 0  // 0px - Explicit sharp corners for clinical cards
  },

  // Shadow depths for elevation - Subtle professional shadows
  shadows: {
    xs: 'none',  // No shadow for background surfaces
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',  // Subtle shadow for cards
    md: '0 2px 4px rgba(0, 0, 0, 0.06)',  // Hover states
    lg: '0 4px 8px rgba(0, 0, 0, 0.08)',  // Dropdowns and floating elements
    xl: '0 8px 16px rgba(0, 0, 0, 0.10)'  // Modals and overlays
  },

  // Clinical status indicators
  status: {
    active: { color: '#1976D2', bg: '#E3F2FD', icon: '●' },
    inactive: { color: '#757575', bg: '#F5F5F5', icon: '○' },
    pending: { color: '#F57C00', bg: '#FFF3E0', icon: '◐' },
    completed: { color: '#388E3C', bg: '#E8F5E9', icon: '✓' },
    cancelled: { color: '#D32F2F', bg: '#FFEBEE', icon: '✗' },
    draft: { color: '#9E9E9E', bg: '#FAFAFA', icon: '▫' },
    inProgress: { color: '#1976D2', bg: '#E3F2FD', icon: '◔' }
  },

  // Clinical workflow states
  workflow: {
    notStarted: { color: '#9E9E9E', label: 'Not Started' },
    inProgress: { color: '#2196F3', label: 'In Progress' },
    review: { color: '#FF9800', label: 'Under Review' },
    approved: { color: '#4CAF50', label: 'Approved' },
    rejected: { color: '#F44336', label: 'Rejected' },
    onHold: { color: '#9C27B0', label: 'On Hold' }
  },

  // Clinical priority levels
  priority: {
    stat: { color: '#F44336', label: 'STAT', weight: 1000 },
    urgent: { color: '#FF5722', label: 'Urgent', weight: 100 },
    high: { color: '#FF9800', label: 'High', weight: 10 },
    routine: { color: '#2196F3', label: 'Routine', weight: 1 },
    low: { color: '#9E9E9E', label: 'Low', weight: 0 }
  },

  // Typography variants for clinical data
  clinicalTypography: {
    metric: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.2
    },
    metricLabel: {
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    },
    dataValue: {
      fontSize: '1rem',
      fontWeight: 600,
      fontFamily: 'monospace'
    },
    dataLabel: {
      fontSize: '0.875rem',
      fontWeight: 400,
      color: 'text.secondary'
    },
    timestamp: {
      fontSize: '0.75rem',
      fontWeight: 400,
      fontStyle: 'italic',
      color: 'text.secondary'
    }
  }
};

// Extend the medical theme with clinical-specific customizations
export const createClinicalTheme = (baseTheme = 'professional', mode = 'light') => {
  const medicalTheme = createMedicalTheme(baseTheme, mode);
  
  return createTheme(medicalTheme, {
    // Merge clinical tokens into the theme
    clinical: clinicalTokens,
    
    // Override components with clinical-specific styles
    components: {
      ...medicalTheme.components,
      
      // Clinical Card Component - Professional medical UI
      MuiCard: {
        ...medicalTheme.components?.MuiCard,
        styleOverrides: {
          ...medicalTheme.components?.MuiCard?.styleOverrides,
          root: {
            ...medicalTheme.components?.MuiCard?.styleOverrides?.root,
            borderRadius: 0,  // Sharp corners for professional look
            boxShadow: clinicalTokens.shadows.sm,  // Subtle shadow
            border: '1px solid #E5E7EB',  // Light gray border
            '&.ClinicalCard-severity-critical': {
              borderLeft: `4px solid ${clinicalTokens.severity.critical.color}`,
              backgroundColor: clinicalTokens.severity.critical.bg,
              borderLeftWidth: 4
            },
            '&.ClinicalCard-severity-high': {
              borderLeft: `4px solid ${clinicalTokens.severity.high.color}`,
              backgroundColor: clinicalTokens.severity.high.bg,
              borderLeftWidth: 4
            },
            '&.ClinicalCard-severity-moderate': {
              borderLeft: `4px solid ${clinicalTokens.severity.moderate.color}`,
              backgroundColor: clinicalTokens.severity.moderate.bg,
              borderLeftWidth: 4
            },
            '&.ClinicalCard-severity-low': {
              borderLeft: `4px solid ${clinicalTokens.severity.low.color}`,
              backgroundColor: clinicalTokens.severity.low.bg,
              borderLeftWidth: 4
            },
            '&.ClinicalCard-severity-normal': {
              borderLeft: `4px solid ${clinicalTokens.severity.normal.borderColor}`,
              backgroundColor: clinicalTokens.severity.normal.bg,
              borderLeftWidth: 4
            }
          }
        }
      },
      
      // Clinical List Component
      MuiList: {
        styleOverrides: {
          root: {
            '&.ClinicalList-density-compact': {
              padding: clinicalTokens.density.compact.padding
            },
            '&.ClinicalList-density-comfortable': {
              padding: clinicalTokens.density.comfortable.padding
            },
            '&.ClinicalList-density-spacious': {
              padding: clinicalTokens.density.spacious.padding
            }
          }
        }
      },
      
      MuiListItem: {
        styleOverrides: {
          root: {
            transition: `all ${clinicalTokens.transitions.fast} ease-in-out`,
            '&.ClinicalListItem-density-compact': {
              minHeight: clinicalTokens.density.compact.rowHeight,
              paddingTop: clinicalTokens.density.compact.padding,
              paddingBottom: clinicalTokens.density.compact.padding
            },
            '&.ClinicalListItem-density-comfortable': {
              minHeight: clinicalTokens.density.comfortable.rowHeight,
              paddingTop: clinicalTokens.density.comfortable.padding,
              paddingBottom: clinicalTokens.density.comfortable.padding
            },
            '&.ClinicalListItem-density-spacious': {
              minHeight: clinicalTokens.density.spacious.rowHeight,
              paddingTop: clinicalTokens.density.spacious.padding,
              paddingBottom: clinicalTokens.density.spacious.padding
            }
          }
        }
      },

      // Clinical Chip Component
      MuiChip: {
        styleOverrides: {
          root: {
            '&.ClinicalChip-status-active': {
              backgroundColor: clinicalTokens.status.active.bg,
              color: clinicalTokens.status.active.color
            },
            '&.ClinicalChip-status-inactive': {
              backgroundColor: clinicalTokens.status.inactive.bg,
              color: clinicalTokens.status.inactive.color
            },
            '&.ClinicalChip-priority-stat': {
              backgroundColor: clinicalTokens.priority.stat.color,
              color: '#FFFFFF',
              fontWeight: 700
            },
            '&.ClinicalChip-priority-urgent': {
              backgroundColor: clinicalTokens.priority.urgent.color,
              color: '#FFFFFF',
              fontWeight: 600
            }
          }
        }
      },

      // Clinical Data Grid
      MuiDataGrid: {
        styleOverrides: {
          root: {
            '&.ClinicalDataGrid-density-compact': {
              '& .MuiDataGrid-row': {
                minHeight: `${clinicalTokens.density.compact.rowHeight}px !important`
              },
              '& .MuiDataGrid-cell': {
                padding: `${clinicalTokens.density.compact.padding}px`,
                fontSize: clinicalTokens.density.compact.fontSize
              }
            },
            '&.ClinicalDataGrid-density-comfortable': {
              '& .MuiDataGrid-row': {
                minHeight: `${clinicalTokens.density.comfortable.rowHeight}px !important`
              },
              '& .MuiDataGrid-cell': {
                padding: `${clinicalTokens.density.comfortable.padding}px`,
                fontSize: clinicalTokens.density.comfortable.fontSize
              }
            },
            '&.ClinicalDataGrid-density-spacious': {
              '& .MuiDataGrid-row': {
                minHeight: `${clinicalTokens.density.spacious.rowHeight}px !important`
              },
              '& .MuiDataGrid-cell': {
                padding: `${clinicalTokens.density.spacious.padding}px`,
                fontSize: clinicalTokens.density.spacious.fontSize
              }
            }
          }
        }
      }
    }
  });
};

// Helper functions for clinical styling
export const getClinicalSeverityStyles = (severity) => {
  const severityConfig = clinicalTokens.severity[severity] || clinicalTokens.severity.normal;
  return {
    backgroundColor: severityConfig.bg,
    borderColor: severityConfig.borderColor,
    color: severityConfig.color,
    '&:hover': {
      backgroundColor: severityConfig.hoverBg
    }
  };
};

export const getClinicalStatusStyles = (status) => {
  const statusConfig = clinicalTokens.status[status] || clinicalTokens.status.draft;
  return {
    backgroundColor: statusConfig.bg,
    color: statusConfig.color,
    '&::before': {
      content: `"${statusConfig.icon}"`,
      marginRight: '8px'
    }
  };
};

export const getClinicalDensityStyles = (density = 'comfortable') => {
  const densityConfig = clinicalTokens.density[density];
  return {
    padding: densityConfig.padding,
    minHeight: densityConfig.rowHeight,
    fontSize: densityConfig.fontSize,
    '& .MuiSvgIcon-root': {
      fontSize: densityConfig.iconSize
    }
  };
};

// Export individual token groups for component use
export const {
  density,
  severity,
  transitions,
  dataViz,
  spacing,
  borderRadius,
  shadows,
  status,
  workflow,
  priority,
  clinicalTypography
} = clinicalTokens;

// Animation keyframes
export const clinicalKeyframes = {
  fadeIn: {
    '@keyframes fadeIn': {
      from: { opacity: 0 },
      to: { opacity: 1 }
    }
  },
  slideUp: {
    '@keyframes slideUp': {
      from: { transform: 'translateY(20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 }
    }
  },
  slideDown: {
    '@keyframes slideDown': {
      from: { transform: 'translateY(-20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 }
    }
  },
  scaleIn: {
    '@keyframes scaleIn': {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 }
    }
  },
  pulse: {
    '@keyframes pulse': {
      '0%': { opacity: 1 },
      '50%': { opacity: 0.6 },
      '100%': { opacity: 1 }
    }
  },
  shimmer: {
    '@keyframes shimmer': {
      '0%': { backgroundPosition: '-200% 0' },
      '100%': { backgroundPosition: '200% 0' }
    }
  },
  rotate: {
    '@keyframes rotate': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' }
    }
  }
};

export default createClinicalTheme;