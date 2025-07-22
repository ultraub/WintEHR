/**
 * Chart Colors Utility
 * Provides theme-aware color palettes for data visualization
 * Supports all medical themes: professional, accessible (high contrast), warm
 */

import { alpha } from '@mui/material/styles';

/**
 * Get chart colors based on current theme
 * @param {object} theme - Material-UI theme object
 * @returns {object} Chart color palettes
 */
export const getChartColors = (theme) => {
  const mode = theme.palette.mode;
  const themeName = theme.palette.themeName || 'professional';
  
  // Base colors that work well for data visualization
  const baseColors = {
    professional: {
      primary: ['#1976D2', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9'],
      secondary: ['#388E3C', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7'],
      accent: ['#F57C00', '#FF9800', '#FFB74D', '#FFCC80', '#FFE0B2'],
      danger: ['#D32F2F', '#F44336', '#EF5350', '#E57373', '#EF9A9A'],
      info: ['#7B1FA2', '#9C27B0', '#AB47BC', '#BA68C8', '#CE93D8']
    },
    accessible: {
      // High contrast colors for better visibility
      primary: ['#0066CC', '#0080FF', '#3399FF', '#66B2FF', '#99CCFF'],
      secondary: ['#006600', '#009900', '#00CC00', '#33FF33', '#66FF66'],
      accent: ['#CC6600', '#FF8800', '#FF9933', '#FFAA55', '#FFBB77'],
      danger: ['#CC0000', '#FF0000', '#FF3333', '#FF6666', '#FF9999'],
      info: ['#6600CC', '#8800FF', '#9933FF', '#AA66FF', '#BB99FF']
    },
    warm: {
      // Warmer, more comfortable colors
      primary: ['#6A4C93', '#7C4DFF', '#9575CD', '#B085F5', '#D1A3FF'],
      secondary: ['#FF6B6B', '#EE6C4D', '#F38D68', '#F4A261', '#F4B266'],
      accent: ['#4ECDC4', '#45B7AA', '#3FA196', '#388B82', '#32756E'],
      danger: ['#E63946', '#F44336', '#F66D6D', '#F8898F', '#FAA5AA'],
      info: ['#457B9D', '#5A9FBD', '#6FB4D0', '#84C9E3', '#99DEF6']
    }
  };

  // Get colors for current theme
  const colors = baseColors[themeName] || baseColors.professional;
  
  // Adjust for dark mode
  if (mode === 'dark') {
    // Slightly brighten colors for dark mode
    Object.keys(colors).forEach(key => {
      colors[key] = colors[key].map(color => 
        alpha(color, 0.9)
      );
    });
  }

  return {
    // Vitals chart colors
    vitals: {
      heartRate: colors.danger[1],
      bloodPressureSystolic: colors.primary[1],
      bloodPressureDiastolic: colors.primary[3],
      temperature: colors.accent[1],
      respiratoryRate: colors.secondary[1],
      oxygenSaturation: colors.info[1],
      weight: colors.accent[3],
      height: colors.secondary[3],
      bmi: colors.info[3]
    },
    
    // Lab results colors
    labs: {
      glucose: colors.accent[0],
      cholesterol: colors.danger[0],
      hemoglobin: colors.primary[0],
      creatinine: colors.secondary[0],
      sodium: colors.info[0],
      potassium: colors.accent[2],
      calcium: colors.primary[2],
      albumin: colors.secondary[2],
      bilirubin: colors.danger[2]
    },
    
    // Timeline colors for different resource types
    timeline: {
      Encounter: colors.primary[0],
      Condition: colors.secondary[0],
      Procedure: colors.accent[0],
      Observation: colors.info[0],
      MedicationRequest: colors.danger[0],
      Immunization: colors.primary[2],
      AllergyIntolerance: colors.danger[2],
      DiagnosticReport: colors.secondary[2],
      CarePlan: colors.info[2]
    },
    
    // General purpose chart palette
    palette: [
      ...colors.primary,
      ...colors.secondary,
      ...colors.accent,
      ...colors.danger,
      ...colors.info
    ],
    
    // Categorical colors for charts
    categorical: colors.primary,
    
    // Sequential colors for gradients
    sequential: colors.primary,
    
    // Diverging colors for bipolar data
    diverging: [
      colors.danger[0],
      colors.danger[2],
      theme.palette.grey[500],
      colors.secondary[2],
      colors.secondary[0]
    ],
    
    // Status colors
    status: {
      normal: colors.secondary[1],
      warning: colors.accent[1],
      critical: colors.danger[1],
      info: colors.info[1]
    }
  };
};

/**
 * Get a specific color from the chart palette
 * @param {object} theme - Material-UI theme object
 * @param {string} category - Color category (vitals, labs, timeline, etc.)
 * @param {string} item - Specific item within category
 * @returns {string} Hex color value
 */
export const getChartColor = (theme, category, item) => {
  const colors = getChartColors(theme);
  return colors[category]?.[item] || theme.palette.primary.main;
};

/**
 * Get reference line colors for charts
 * @param {object} theme - Material-UI theme object
 * @returns {object} Reference line colors
 */
export const getReferenceColors = (theme) => ({
  normal: alpha(theme.palette.success.main, 0.3),
  warning: alpha(theme.palette.warning.main, 0.3),
  critical: alpha(theme.palette.error.main, 0.3),
  grid: theme.palette.divider,
  axis: theme.palette.text.secondary
});