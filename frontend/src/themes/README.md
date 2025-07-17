# WintEHR Theme System Documentation

## Overview

WintEHR uses a sophisticated theme system based on Material-UI with extensive customizations for healthcare applications. The theme provides semantic tokens, consistent styling, and comprehensive component coverage.

## Theme Structure

### Base Configuration
```javascript
import { createMedicalTheme } from './medicalTheme';
const theme = createMedicalTheme('professional', 'light');
```

### Available Themes
- **professional**: Clean, professional medical interface (default)
- **dark**: Dark theme optimized for medical professionals
- **accessible**: High contrast theme with WCAG AAA compliance
- **warm**: Warm, approachable clinical interface

### Theme Modes
- **light**: Default light mode
- **dark**: Dark mode with adjusted colors

## Clinical Semantic Tokens

### Surface Colors
Use these for consistent background colors throughout the application:

```javascript
// Usage in components
sx={{
  backgroundColor: theme.clinical.surfaces.primary,    // Primary surface
  backgroundColor: theme.clinical.surfaces.secondary,  // Secondary surface
  backgroundColor: theme.clinical.surfaces.warning,    // Warning surface
  backgroundColor: theme.clinical.surfaces.error,      // Error surface
  backgroundColor: theme.clinical.surfaces.info,       // Info surface
  backgroundColor: theme.clinical.surfaces.success,    // Success surface
}}
```

### Interaction States
For consistent hover, focus, and selection states:

```javascript
sx={{
  '&:hover': {
    backgroundColor: theme.clinical.interactions.hover,
  },
  '&:focus': {
    backgroundColor: theme.clinical.interactions.focus,
  },
  '&:active': {
    backgroundColor: theme.clinical.interactions.pressed,
  },
  '&.selected': {
    backgroundColor: theme.clinical.interactions.selected,
  }
}}
```

### Clinical Status Colors
For medication status, condition status, and workflow states:

```javascript
// Available status colors
theme.clinical.status.active      // '#4CAF50' - Active items
theme.clinical.status.inactive    // '#9E9E9E' - Inactive items
theme.clinical.status.pending     // '#FF9800' - Pending items
theme.clinical.status.completed   // '#2196F3' - Completed items
theme.clinical.status.cancelled   // '#F44336' - Cancelled items
theme.clinical.status.draft       // '#757575' - Draft items
theme.clinical.status.inProgress  // '#3F51B5' - In progress items
```

### Severity Levels
For clinical severity indicators:

```javascript
theme.clinical.severity.normal     // '#4CAF50' - Normal
theme.clinical.severity.mild       // '#8BC34A' - Mild
theme.clinical.severity.moderate   // '#FF9800' - Moderate
theme.clinical.severity.severe     // '#FF5722' - Severe
theme.clinical.severity.critical   // '#F44336' - Critical
```

## Spacing System

### Clinical Spacing Tokens
Use these instead of hardcoded spacing values:

```javascript
// Available spacing tokens
theme.clinicalSpacing.xs     // 4px
theme.clinicalSpacing.sm     // 8px
theme.clinicalSpacing.md     // 16px
theme.clinicalSpacing.lg     // 24px
theme.clinicalSpacing.xl     // 32px
theme.clinicalSpacing.xxl    // 48px

// Usage
sx={{
  padding: theme.clinicalSpacing.md,
  margin: theme.clinicalSpacing.lg,
  gap: theme.clinicalSpacing.sm
}}
```

## Animation System

### Duration Tokens
```javascript
theme.animations.duration.shortest    // 150ms
theme.animations.duration.shorter     // 200ms
theme.animations.duration.short       // 250ms
theme.animations.duration.standard    // 300ms
theme.animations.duration.complex     // 375ms
```

### Easing Functions
```javascript
theme.animations.easing.easeInOut  // 'cubic-bezier(0.4, 0, 0.2, 1)'
theme.animations.easing.easeOut    // 'cubic-bezier(0.0, 0, 0.2, 1)'
theme.animations.easing.easeIn     // 'cubic-bezier(0.4, 0, 1, 1)'
theme.animations.easing.sharp      // 'cubic-bezier(0.4, 0, 0.6, 1)'
```

### Usage Example
```javascript
sx={{
  transition: `all ${theme.animations.duration.standard}ms ${theme.animations.easing.easeInOut}`,
  '&:hover': {
    transform: 'translateY(-2px)',
  }
}}
```

## Component Sizing

### Standardized Sizes
```javascript
theme.components.cardPadding    // 24px
theme.components.buttonHeight   // 40px
theme.components.iconSize       // 20px
theme.components.avatarSize     // 32px
theme.components.chipHeight     // 24px
theme.components.inputHeight    // 56px
```

## Reusable Components

### StatusChip
A themed status indicator component:

```javascript
import StatusChip from '../components/clinical/common/StatusChip';

<StatusChip 
  status="active"           // Required: status value
  variant="clinical"        // Optional: 'clinical' or 'standard'
  size="small"             // Optional: 'small' or 'medium'
  showIcon={true}          // Optional: show status icon
/>
```

### MetricCard
A themed metric display card:

```javascript
import MetricCard from '../components/clinical/common/MetricCard';

<MetricCard
  title="Active Problems"      // Required: card title
  value={42}                   // Required: main value
  icon={<ProblemIcon />}       // Optional: icon
  color="warning"              // Optional: color theme
  trend="up"                   // Optional: 'up', 'down', 'flat'
  trendValue={15}              // Optional: trend value
  subtitle="Last 30 days"     // Optional: subtitle
  onClick={handleClick}        // Optional: click handler
  variant="clinical"           // Optional: 'clinical', 'gradient', 'default'
  loading={false}              // Optional: loading state
/>
```

## Migration Guide

### Replacing Hardcoded Values

#### Before (Hardcoded):
```javascript
sx={{
  backgroundColor: alpha(theme.palette.primary.main, 0.05),
  borderRadius: 1,
  mb: 2,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1)
  }
}}
```

#### After (Theme Tokens):
```javascript
sx={{
  backgroundColor: theme.clinical.surfaces.primary,
  borderRadius: theme.shape.borderRadius / 8,
  mb: theme.clinicalSpacing.md,
  transition: `all ${theme.animations.duration.short}ms ${theme.animations.easing.easeInOut}`,
  '&:hover': {
    backgroundColor: theme.clinical.interactions.hover,
    transform: 'translateY(-1px)'
  }
}}
```

### Common Patterns

#### List Items with Hover Effects
```javascript
sx={{
  borderRadius: theme.shape.borderRadius / 8,
  mb: theme.clinicalSpacing.sm,
  transition: `all ${theme.animations.duration.short}ms ${theme.animations.easing.easeInOut}`,
  '&:hover': {
    backgroundColor: theme.clinical.interactions.hover,
    transform: 'translateY(-1px)'
  }
}}
```

#### Clinical Cards
```javascript
sx={{
  backgroundColor: theme.clinical.surfaces.primary,
  border: 1,
  borderColor: alpha(theme.palette.primary.main, 0.2),
  borderRadius: theme.shape.borderRadius,
  transition: `all ${theme.animations.duration.standard}ms ${theme.animations.easing.easeInOut}`,
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
  }
}}
```

## Best Practices

1. **Always use theme tokens** instead of hardcoded values
2. **Prefer semantic tokens** over direct palette access
3. **Use consistent spacing** from the clinicalSpacing scale
4. **Apply smooth transitions** for better user experience
5. **Leverage reusable components** to maintain consistency
6. **Test across all theme variants** to ensure compatibility

## Theme Customization

### Creating Custom Themes
```javascript
// Extend existing theme
const customTheme = createMedicalTheme('professional', 'light');
customTheme.clinical.surfaces.custom = 'rgba(124, 77, 255, 0.05)';

// Or create completely new theme
const newTheme = createTheme({
  ...customTheme,
  clinical: {
    ...customTheme.clinical,
    // Custom overrides
  }
});
```

### Department-Specific Themes
```javascript
// Example: Emergency Department theme
const emergencyTheme = createMedicalTheme('professional', 'light');
emergencyTheme.clinical.surfaces.primary = 'rgba(229, 57, 53, 0.05)';
emergencyTheme.clinical.status.urgent = '#D32F2F';
```

This documentation ensures consistent theming across the entire WintEHR application while providing flexibility for future enhancements and customizations.