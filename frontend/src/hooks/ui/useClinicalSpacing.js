/**
 * useClinicalSpacing Hook
 * Provides consistent spacing values throughout the clinical application
 */
import { useTheme } from '@mui/material';
import { SPACING, spacing, spacingPx } from '../../components/clinical/theme/clinicalThemeConstants';

export const useClinicalSpacing = () => {
  const theme = useTheme();
  
  // Get spacing value (numeric)
  const getSpacing = (value) => {
    // Use theme spacing if available
    if (theme.spacing && typeof value === 'number') {
      return theme.spacing(value);
    }
    // Otherwise use our spacing function
    return spacing(value);
  };
  
  // Get spacing value with px unit
  const getSpacingPx = (value) => {
    return spacingPx(value);
  };
  
  // Get component-specific spacing
  const getComponentSpacing = (component, property) => {
    return spacing(`${component}.${property}`);
  };
  
  // Get responsive spacing
  const getResponsiveSpacing = (values) => {
    if (typeof values === 'object' && !Array.isArray(values)) {
      return {
        xs: getSpacing(values.xs || values.default || 0),
        sm: getSpacing(values.sm || values.xs || values.default || 0),
        md: getSpacing(values.md || values.sm || values.xs || values.default || 0),
        lg: getSpacing(values.lg || values.md || values.sm || values.xs || values.default || 0),
        xl: getSpacing(values.xl || values.lg || values.md || values.sm || values.xs || values.default || 0),
      };
    }
    return getSpacing(values);
  };
  
  // Common spacing patterns
  const patterns = {
    // Page layouts
    pageContainer: {
      padding: { xs: getSpacing(2), md: getSpacing(3) },
      maxWidth: theme.breakpoints.values.lg,
    },
    
    // Card layouts
    cardContent: {
      padding: getSpacing('card.padding'),
      gap: getSpacing('card.gap'),
    },
    
    // Form layouts
    formField: {
      marginBottom: getSpacing('form.fieldGap'),
    },
    formSection: {
      marginBottom: getSpacing('form.sectionGap'),
    },
    
    // List layouts
    listItem: {
      padding: getSpacing('list.itemPadding'),
      gap: getSpacing('list.itemGap'),
    },
    
    // Table layouts
    tableCell: {
      padding: getSpacing('table.cellPadding'),
    },
    tableCellCompact: {
      padding: getSpacing('table.compactCellPadding'),
    },
  };
  
  return {
    spacing: SPACING,
    getSpacing,
    getSpacingPx,
    getComponentSpacing,
    getResponsiveSpacing,
    patterns,
    
    // Shorthand methods
    p: (value) => ({ padding: getSpacing(value) }),
    pt: (value) => ({ paddingTop: getSpacing(value) }),
    pr: (value) => ({ paddingRight: getSpacing(value) }),
    pb: (value) => ({ paddingBottom: getSpacing(value) }),
    pl: (value) => ({ paddingLeft: getSpacing(value) }),
    px: (value) => ({ paddingLeft: getSpacing(value), paddingRight: getSpacing(value) }),
    py: (value) => ({ paddingTop: getSpacing(value), paddingBottom: getSpacing(value) }),
    
    m: (value) => ({ margin: getSpacing(value) }),
    mt: (value) => ({ marginTop: getSpacing(value) }),
    mr: (value) => ({ marginRight: getSpacing(value) }),
    mb: (value) => ({ marginBottom: getSpacing(value) }),
    ml: (value) => ({ marginLeft: getSpacing(value) }),
    mx: (value) => ({ marginLeft: getSpacing(value), marginRight: getSpacing(value) }),
    my: (value) => ({ marginTop: getSpacing(value), marginBottom: getSpacing(value) }),
    
    gap: (value) => ({ gap: getSpacing(value) }),
    rowGap: (value) => ({ rowGap: getSpacing(value) }),
    columnGap: (value) => ({ columnGap: getSpacing(value) }),
  };
};

export default useClinicalSpacing;