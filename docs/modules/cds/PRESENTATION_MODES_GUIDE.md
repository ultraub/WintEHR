# CDS Presentation Modes Guide

**Last Updated**: 2025-08-05  
**Version**: 1.0

## Overview

The CDS (Clinical Decision Support) system in WintEHR supports multiple presentation modes to display alerts in ways that are appropriate for their severity and context. Each mode is designed for specific use cases and provides different levels of user interaction.

## Available Presentation Modes

### 1. INLINE Mode (Default)
**Purpose**: Standard display within the clinical workflow  
**Use Case**: General alerts and recommendations  
**Behavior**: 
- Displays alerts as inline Alert components
- Integrates naturally with the page content
- Non-intrusive, allows normal workflow to continue
- Dismissible with standard close button

### 2. MODAL Mode (Hard Stop)
**Purpose**: Critical alerts requiring immediate attention  
**Use Case**: Patient safety alerts, critical drug interactions  
**Behavior**:
- Blocks all interaction until acknowledged
- Cannot be closed without acknowledgment
- Supports override reasons when configured
- Shows visual feedback for acknowledged alerts
- Only closes when all alerts are acknowledged

### 3. BANNER Mode
**Purpose**: Important system-wide alerts  
**Use Case**: Critical patient information, system alerts  
**Behavior**:
- Displays as a sticky banner at the top of the workspace
- Only shows critical severity alerts
- Remains visible as user scrolls
- Can be dismissed individually

### 4. TOAST Mode
**Purpose**: Temporary notifications  
**Use Case**: Informational updates, non-critical alerts  
**Behavior**:
- Appears as stacked notifications in bottom-right
- Each alert can be dismissed independently
- Smooth slide-in animation
- Supports auto-hide functionality

### 5. POPUP Mode
**Purpose**: Important alerts needing attention  
**Use Case**: Warnings, important recommendations  
**Behavior**:
- Opens as a modal dialog
- Can be closed with the close button
- Shows all alerts in a scrollable list
- Less intrusive than MODAL mode

### 6. DRAWER Mode
**Purpose**: Detailed alert review  
**Use Case**: Multiple alerts needing review  
**Behavior**:
- Slides out from the right side
- 400px wide panel
- Scrollable list of alerts
- Can be closed to continue workflow

### 7. SIDEBAR Mode
**Purpose**: Persistent alert display  
**Use Case**: Ongoing monitoring, multiple alerts  
**Behavior**:
- Fixed panel on the right side
- Remains visible during workflow
- Shows below the app bar
- Scrollable alert list

### 8. CARD Mode
**Purpose**: Rich, detailed alert display  
**Use Case**: Complex alerts with multiple actions  
**Behavior**:
- Enhanced card display with hover effects
- Shows source and timestamp information
- Color-coded borders by severity
- Elevated on hover for better visibility

### 9. COMPACT Mode
**Purpose**: Minimal space usage  
**Use Case**: Dense interfaces, toolbar integration  
**Behavior**:
- Shows as an icon with badge count
- Click opens a popover with full alerts
- Pulses animation for critical alerts
- Color changes based on highest severity

## Configuration

### Setting Presentation Mode

Presentation modes are configured through the display behavior settings:

```javascript
// In hook configuration
{
  displayBehavior: {
    defaultMode: 'popup',  // Default presentation mode
    indicatorOverrides: {
      critical: 'modal',   // Override for critical alerts
      warning: 'banner',   // Override for warnings
      info: 'toast'        // Override for info alerts
    }
  }
}
```

### Mode Selection by Severity

Recommended mode selection based on alert severity:

| Severity | Recommended Mode | Rationale |
|----------|-----------------|-----------|
| Critical | MODAL | Requires immediate attention and acknowledgment |
| Warning | POPUP or BANNER | Important but allows workflow continuation |
| Info | TOAST or INLINE | Non-intrusive, informational only |

## Implementation Details

### Z-Index Hierarchy

The presentation modes use specific z-index values to ensure proper layering:

- TOAST: 1400 (highest, above modals)
- MODAL/POPUP: 1300 (dialog level)
- BANNER: 1200 (below dialogs)
- SIDEBAR: 1100 (below banner)
- DRAWER: MUI default (1200)
- Others: Inherit from parent

### Responsive Behavior

- **Mobile**: TOAST and COMPACT modes work best
- **Tablet**: All modes supported, DRAWER recommended
- **Desktop**: All modes fully supported

### Accessibility

All presentation modes support:
- Keyboard navigation
- Screen reader announcements
- ARIA labels and roles
- Focus management
- High contrast themes

## Best Practices

1. **Choose Appropriate Modes**
   - Use MODAL only for truly critical alerts
   - Prefer TOAST for transient information
   - Use INLINE for standard clinical recommendations

2. **Consider User Workflow**
   - Don't interrupt unnecessarily
   - Group related alerts when possible
   - Provide clear dismissal options

3. **Test Thoroughly**
   - Verify mode behavior in different screen sizes
   - Test with multiple simultaneous alerts
   - Ensure proper cleanup on dismissal

4. **Performance Considerations**
   - Limit number of simultaneous TOAST alerts
   - Use COMPACT mode for high-frequency updates
   - Consider pagination for large alert sets

## Troubleshooting

### Common Issues

1. **Alerts not displaying**
   - Check presentation mode configuration
   - Verify alert severity matches mode requirements
   - Ensure proper z-index layering

2. **Layout issues**
   - BANNER mode requires sticky positioning support
   - SIDEBAR mode needs adequate screen width
   - Check for CSS conflicts

3. **Interaction problems**
   - MODAL mode intentionally blocks interaction
   - Ensure proper event handlers are configured
   - Check for JavaScript errors in console

## Examples

### Critical Drug Interaction (MODAL)
```javascript
{
  indicator: 'critical',
  summary: 'Severe Drug Interaction',
  displayBehavior: {
    presentationMode: 'modal',
    acknowledgment: {
      required: true,
      reasonRequired: true
    }
  }
}
```

### Lab Result Available (TOAST)
```javascript
{
  indicator: 'info',
  summary: 'New lab results available',
  displayBehavior: {
    presentationMode: 'toast',
    autoHide: true,
    hideDelay: 5000
  }
}
```

### Clinical Reminder (INLINE)
```javascript
{
  indicator: 'warning',
  summary: 'Patient due for HbA1c',
  displayBehavior: {
    presentationMode: 'inline'
  }
}
```

## Future Enhancements

- Custom presentation modes via plugins
- Animation customization options
- Sound/haptic feedback support
- Multi-language support for system messages
- A/B testing framework for mode effectiveness

---

**Note**: This guide covers the presentation modes as implemented in WintEHR. For CDS Hooks specification compliance, refer to the official CDS Hooks documentation.