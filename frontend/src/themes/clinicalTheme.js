/**
 * Clinical Theme System Extension
 * Enhanced design tokens for clinical workspace components
 */
import { createTheme } from '@mui/material/styles';
import { createMedicalTheme } from './medicalTheme';

// Clinical-specific design tokens
export const clinicalTokens = {
  // Density modes for clinical data display
  density: {
    compact: { 
      padding: 4, 
      rowHeight: 32,
      fontSize: '0.75rem',
      iconSize: 16
    },
    comfortable: { 
      padding: 8, 
      rowHeight: 48,
      fontSize: '0.875rem',
      iconSize: 20
    },
    spacious: { 
      padding: 16, 
      rowHeight: 64,
      fontSize: '1rem',
      iconSize: 24
    }
  },
  
  // Clinical severity colors with semantic meaning
  severity: {
    critical: { 
      bg: '#FFEBEE', 
      color: '#D32F2F', 
      icon: '🔴',
      borderColor: '#EF5350',
      hoverBg: '#FFCDD2'
    },
    high: { 
      bg: '#FFF3E0', 
      color: '#F57C00', 
      icon: '🟠',
      borderColor: '#FFB74D',
      hoverBg: '#FFE0B2'
    },
    moderate: { 
      bg: '#FFF8E1', 
      color: '#FBC02D', 
      icon: '🟡',
      borderColor: '#FFD54F',
      hoverBg: '#FFF59D'
    },
    low: { 
      bg: '#E8F5E9', 
      color: '#388E3C', 
      icon: '🟢',
      borderColor: '#81C784',
      hoverBg: '#C8E6C9'
    },
    normal: { 
      bg: '#F5F5F5', 
      color: '#616161', 
      icon: '⚪',
      borderColor: '#E0E0E0',
      hoverBg: '#EEEEEE'
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

  // Border radius for clinical components
  borderRadius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 9999
  },

  // Shadow depths for elevation
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)'
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
      
      // Clinical Card Component
      MuiCard: {
        ...medicalTheme.components?.MuiCard,
        styleOverrides: {
          ...medicalTheme.components?.MuiCard?.styleOverrides,
          root: {
            ...medicalTheme.components?.MuiCard?.styleOverrides?.root,
            '&.ClinicalCard-severity-critical': {
              borderLeft: `4px solid ${clinicalTokens.severity.critical.color}`,
              backgroundColor: clinicalTokens.severity.critical.bg
            },
            '&.ClinicalCard-severity-high': {
              borderLeft: `4px solid ${clinicalTokens.severity.high.color}`,
              backgroundColor: clinicalTokens.severity.high.bg
            },
            '&.ClinicalCard-severity-moderate': {
              borderLeft: `4px solid ${clinicalTokens.severity.moderate.color}`,
              backgroundColor: clinicalTokens.severity.moderate.bg
            },
            '&.ClinicalCard-severity-low': {
              borderLeft: `4px solid ${clinicalTokens.severity.low.color}`,
              backgroundColor: clinicalTokens.severity.low.bg
            },
            '&.ClinicalCard-severity-normal': {
              borderLeft: `4px solid ${clinicalTokens.severity.normal.color}`,
              backgroundColor: clinicalTokens.severity.normal.bg
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

export default createClinicalTheme;