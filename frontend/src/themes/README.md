# WintEHR Enhanced Theme System Documentation

## Overview

WintEHR uses a sophisticated, clinically-aware theme system based on Material-UI with extensive customizations for healthcare applications. The enhanced theme provides semantic tokens, clinical context awareness, department-specific theming, and comprehensive component coverage optimized for medical education and clinical workflows.

## 🚀 New Features (v2.0)

### Clinical Context Awareness
- **Department-specific theming**: Emergency, Cardiology, Pediatrics, Oncology, Neurology
- **Shift-based adaptations**: Day, Evening, Night modes with optimal colors for each shift
- **Urgency indicators**: Visual cues for urgent clinical situations
- **Severity-based coloring**: Smart color selection based on clinical severity levels

### Enhanced Animations
- **Clinical-appropriate transitions**: Smooth, professional animations that don't distract from clinical workflow
- **Context-aware timing**: Faster animations in urgent situations, slower in routine care
- **Micro-interactions**: Subtle feedback for user actions

### Advanced Typography
- **Clinical data font**: Optimized monospace fonts for lab values and clinical data
- **Accessibility improvements**: Better contrast ratios and legibility
- **Hierarchical text styles**: Clear visual hierarchy for clinical information

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

### Department-Specific Colors
Access department-specific color schemes for contextual theming:

```javascript
// Department color usage
sx={{
  backgroundColor: theme.clinical.departments.emergency.surface,
  color: theme.clinical.departments.emergency.primary,
  borderColor: theme.clinical.departments.cardiology.accent,
}}

// Available departments: emergency, cardiology, pediatrics, oncology, neurology
```

### Shift-Based Theming
Optimize interface colors based on time of day:

```javascript
// Shift-aware styling
sx={{
  backgroundColor: theme.clinical.shifts.night.background,
  color: theme.clinical.shifts.night.text,
  // Automatically adapts to current shift context
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

## Clinical Theme Utilities

### Context-Aware Theming
Use the clinical theme utilities for intelligent, context-aware styling:

```javascript
import { 
  getClinicalContext, 
  getSeverityColor, 
  getClinicalAnimation,
  getClinicalSpacing,
  buildClinicalTheme 
} from '../themes/clinicalThemeUtils';

// Get clinical context automatically
const context = getClinicalContext(
  window.location.pathname,
  new Date().getHours(),
  'emergency'
);

// Get severity-based colors
const severityColor = getSeverityColor(theme, 'critical', context);

// Get context-aware animations
const animation = getClinicalAnimation(theme, 'hover', context);

// Get adaptive spacing
const spacing = getClinicalSpacing(theme, context, 'comfortable');
```

### Enhanced Component Usage

#### MetricCard with Clinical Context
```javascript
<MetricCard
  title="Blood Pressure"
  value={140}
  severity="moderate"
  department="cardiology"
  urgency="urgent"
  variant="clinical"
  trend="up"
  trendValue={10}
/>
```

#### StatusChip with Department Context
```javascript
<StatusChip
  status="pending"
  variant="clinical"
  department="emergency"
  urgency="urgent"
  clinicalContext={context}
/>
```

#### ClinicalCard with Full Context
```javascript
<ClinicalCard
  title="Patient Assessment"
  status="completed"
  severity="normal"
  department="cardiology"
  urgent={false}
  expandable={true}
  timestamp={new Date().toISOString()}
>
  Clinical content here...
</ClinicalCard>
```

### ClinicalLayout Integration
```javascript
<ClinicalLayout
  department="emergency"
  urgency="urgent"
  patientContext={patientData}
  currentTheme="professional"
  currentMode="light"
  onThemeChange={handleThemeChange}
  onModeChange={handleModeChange}
>
  {/* Your clinical content */}
</ClinicalLayout>
```

## Performance Optimizations

### Intelligent Caching
- **Context caching**: Clinical contexts are cached to avoid recalculation
- **Theme memoization**: Computed theme values are memoized for performance
- **Animation optimization**: Reduced animation complexity in urgent situations

### Memory Management
- **Cleanup mechanisms**: Automatic cleanup of theme listeners and timers
- **Optimized re-renders**: Minimal re-renders when theme context changes
- **Efficient calculations**: Optimized color and spacing calculations

## Migration Guide

### From v1.0 to v2.0

#### Enhanced Components
Update your existing components to use the new clinical context features:

```javascript
// Before (v1.0)
<MetricCard title="Lab Result" value={120} color="warning" />

// After (v2.0)
<MetricCard 
  title="Lab Result" 
  value={120} 
  severity="moderate"
  department="cardiology"
  variant="clinical"
/>
```

#### Theme Provider Updates
Wrap your app with the enhanced theme provider:

```javascript
import { buildClinicalTheme } from './themes/clinicalThemeUtils';

const clinicalTheme = buildClinicalTheme(baseTheme, clinicalContext);

<ThemeProvider theme={clinicalTheme}>
  <YourApp />
</ThemeProvider>
```

## Testing Your Themes

### Design System Showcase
Use the built-in showcase component to test your theme implementations:

```javascript
import DesignSystemShowcase from './components/clinical/demo/DesignSystemShowcase';

<DesignSystemShowcase />
```

### Accessibility Testing
- **WCAG compliance**: All themes meet WCAG 2.1 AA standards
- **Contrast ratios**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Color blindness**: Compatible with common color vision deficiencies

## Best Practices

1. **Use clinical context**: Always provide department and urgency context when possible
2. **Leverage semantic tokens**: Use clinical semantic tokens instead of hardcoded values
3. **Test across themes**: Ensure components work well in all theme variants
4. **Consider accessibility**: Use the accessibility helpers for optimal contrast
5. **Performance awareness**: Use memoization for expensive theme calculations

This enhanced documentation ensures consistent, context-aware theming across the entire WintEHR application while providing powerful new capabilities for clinical workflows.