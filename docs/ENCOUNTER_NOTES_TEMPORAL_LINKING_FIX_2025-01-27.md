# Encounter Notes Temporal Linking Fix - January 27, 2025

## Issue

The temporal linking of DocumentReferences to Encounters was not working because:
1. Synthea-generated encounters use `actualPeriod` instead of `period`
2. The temporal linking code was only checking `encounter.period`

## Solution

Updated `EncounterSummaryDialogEnhanced.js` to check both `actualPeriod` and `period`:

```javascript
// Before
if (encounter.period && doc.date) {
  const encounterStart = encounter.period.start ? parseISO(encounter.period.start) : null;
  const encounterEnd = encounter.period.end ? parseISO(encounter.period.end) : null;

// After  
const period = encounter.actualPeriod || encounter.period;
if (period && doc.date) {
  const encounterStart = period.start ? parseISO(period.start) : null;
  const encounterEnd = period.end ? parseISO(period.end) : null;
```

Note: `EncounterCard.js` already had this fix in place.

## Verification

Database query confirmed:
- 1476 encounters exist, 0 have `period` field
- All Synthea encounters use `actualPeriod` instead
- DocumentReference dates align with encounter `actualPeriod` times

Example match found:
- DocumentReference date: `2006-06-04T00:26:38.259+00:00`
- Encounter period: `2006-06-04T00:26:38+00:00` to `2006-06-04T00:41:38+00:00`

The temporal linking should now work correctly for Synthea data.