# Collapsible Patient Header Implementation

**Date**: 2025-01-23  
**Implementation Status**: ✅ Completed

## Overview

Implemented a dynamic collapsible patient header that automatically compresses when scrolling to maximize screen real estate. The header shows full patient details when at the top of the page and minimal information when scrolled, with smooth transitions between states.

## Key Features

### 1. Scroll-Based Behavior
- **Collapse Threshold**: Header collapses after 100px of scrolling
- **Smooth Transitions**: Fade effects between expanded and collapsed states
- **Auto-Expand**: Clicking expand button scrolls to top and shows full details
- **Shadow on Scroll**: Visual indication when header is in collapsed state

### 2. Collapsed State (Minimal View)
- Compact height of 56px
- Shows essential info only:
  - Patient avatar (32x32)
  - Name, gender, age
  - MRN
  - Critical alert badges (allergies, medications)
  - Latest BP reading (desktop only)
  - Quick actions (expand, print)

### 3. Expanded State (Full View)
- Larger avatar (56x56)
- Complete demographics
- Clinical summary chips (conditions, medications, allergies)
- Expandable details section
- Quick action buttons

### 4. Expandable Details Section
- Contact information (phone, address)
- Recent vitals (BP, HR, Temperature)
- Clinical alerts summary
- Toggleable with expand/collapse button
- Auto-collapses when scrolling begins

## Technical Implementation

### Component Structure
```javascript
CollapsiblePatientHeader
├── State Management
│   ├── isCollapsed (scroll state)
│   ├── isDetailsExpanded (details visibility)
│   └── scrollY (scroll position)
├── Scroll Handling
│   ├── useEffect with scroll listener
│   ├── scrollContainerRef integration
│   └── Passive event listeners
└── Render Methods
    ├── renderCollapsedHeader()
    └── renderExpandedHeader()
```

### Integration Points

1. **EnhancedClinicalLayout**
   - Replaced `EnhancedPatientHeaderV2` with `CollapsiblePatientHeader`
   - Added `scrollContainerRef` to track scroll events
   - Passed ref to main content area

2. **Scroll Container**
   - Main content Box component has the ref
   - Scroll events bubble up to header
   - Works with both window and container scrolling

3. **Sticky Positioning**
   - Header uses `position: sticky` with `top: 0`
   - Z-index ensures it stays above content
   - Box shadow appears when scrolled

## User Experience Improvements

### Mobile Optimization
- Smaller padding and font sizes
- Hidden elements on mobile (vitals in collapsed view)
- Touch-friendly expand/collapse buttons

### Performance
- Uses React.memo for optimization
- Passive scroll event listeners
- Debounced scroll handling
- Minimal re-renders with state batching

### Accessibility
- Keyboard navigation support
- ARIA labels for interactive elements
- Proper heading hierarchy
- Focus management on expand/collapse

## Visual Design

### Transitions
```css
transition: height 300ms, box-shadow 300ms
fade: in/out 200ms
```

### Color Scheme
- Uses theme colors for consistency
- Alpha transparency for subtle backgrounds
- Severity-based colors for clinical alerts

### Spacing
- Responsive padding based on breakpoints
- Consistent spacing using MUI spacing system
- Compact layout in collapsed state

## Testing Scenarios

1. **Scroll Behavior**
   - Scroll down > 100px → header collapses
   - Scroll to top → header expands
   - Click expand in collapsed state → scrolls to top

2. **Details Toggle**
   - Click expand details → shows additional info
   - Start scrolling with details open → auto-closes
   - Toggle works in both collapsed/expanded states

3. **Responsive Design**
   - Test on mobile, tablet, desktop
   - Verify element visibility at each breakpoint
   - Check touch interactions on mobile

4. **Data Handling**
   - Works with missing patient data
   - Handles null/undefined gracefully
   - Shows appropriate fallbacks

## Related Files

- `/frontend/src/components/clinical/workspace/CollapsiblePatientHeader.js` - Main component
- `/frontend/src/components/clinical/layouts/EnhancedClinicalLayout.js` - Integration point
- `/frontend/src/components/clinical/workspace/EnhancedPatientHeaderV2.js` - Previous version (reference)

## Future Enhancements

1. **Customization Options**
   - User preference for collapse threshold
   - Option to disable auto-collapse
   - Configurable minimal view content

2. **Advanced Features**
   - Persist expanded/collapsed state
   - Animation easing curves
   - Swipe gestures on mobile

3. **Integration**
   - Sync with keyboard shortcuts
   - Integration with patient photo service
   - Quick actions customization

## Migration Notes

To use the collapsible header in other layouts:

```javascript
import CollapsiblePatientHeader from './workspace/CollapsiblePatientHeader';

// Add ref for scroll container
const scrollContainerRef = useRef(null);

// Replace existing header
<CollapsiblePatientHeader
  patientId={patient.id}
  onPrint={handlePrint}
  onNavigateToTab={handleTabChange}
  dataLoading={loading}
  scrollContainerRef={scrollContainerRef}
/>

// Add ref to scrollable container
<Box ref={scrollContainerRef} sx={{ overflow: 'auto' }}>
  {/* Content */}
</Box>
```