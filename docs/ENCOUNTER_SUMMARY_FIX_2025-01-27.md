# Encounter Summary Enhancement - Function Hoisting Fix
## Date: 2025-01-27

### Issue
The EncounterSummaryDialogEnhanced component had a runtime error:
```
Cannot access 'getEncounterTypeLabel' before initialization
```

This was caused by a function being used in a `useMemo` hook before it was defined.

### Root Cause
The `getEncounterTypeLabel` function was defined at line 323, but it was being used in the `timelineEvents` useMemo hook starting at line 238. JavaScript function declarations are hoisted, but when using `const` with arrow functions inside React components, they are not hoisted.

### Solution
Moved the `getEncounterTypeLabel` function definition to line 238, right after the `encounterMetrics` useMemo and before the `timelineEvents` useMemo that uses it.

### Changes Made
1. Cut the entire `getEncounterTypeLabel` function definition from its original location (after line 320)
2. Pasted it between the `encounterMetrics` and `timelineEvents` useMemo hooks
3. Removed the duplicate definition

### File Modified
- `/frontend/src/components/clinical/workspace/dialogs/EncounterSummaryDialogEnhanced.js`

### Result
The function is now properly defined before all its usages:
- Line 238: Function definition
- Line 267: First usage in `timelineEvents` useMemo
- Line 323: Usage in end event
- Line 360: Usage in print handler
- Line 427: Usage in render

The encounter summary dialog should now render without errors.