# Encounter Notes Temporal Linking Enhancement - January 27, 2025

## Overview

Enhanced the Encounter Summary and Encounter Card components to include clinical notes based on temporal association, not just explicit encounter references. This addresses the limitation where Synthea-generated DocumentReferences lack encounter links.

## Implementation Details

### Enhanced Filtering Logic

The system now uses a two-stage approach to associate notes with encounters:

1. **Explicit Reference Check** (Primary)
   - Checks if DocumentReference has encounter reference in `context.encounter`
   - This is the FHIR-compliant way and takes precedence

2. **Temporal Association** (Fallback)
   - If no explicit reference, checks if note was created during encounter period
   - For completed encounters: Note date must be within encounter start and end times
   - For ongoing encounters: Note date must be within 24 hours of encounter start

### Code Changes

#### EncounterSummaryDialogEnhanced.js
```javascript
documents: documentReferences.filter(doc => {
  // First check for explicit encounter reference
  if (Array.isArray(doc.context?.encounter)) {
    const hasEncounterRef = doc.context.encounter.some(enc => isEncounterMatch(enc.reference));
    if (hasEncounterRef) return true;
  }
  if (doc.context?.encounter?.reference) {
    if (isEncounterMatch(doc.context.encounter.reference)) return true;
  }
  
  // Fallback: Check if document was created during encounter period
  if (encounter.period && doc.date) {
    const docDate = parseISO(doc.date);
    const encounterStart = encounter.period.start ? parseISO(encounter.period.start) : null;
    const encounterEnd = encounter.period.end ? parseISO(encounter.period.end) : null;
    
    if (encounterStart) {
      // If encounter has ended, check if doc is within the period
      if (encounterEnd) {
        return docDate >= encounterStart && docDate <= encounterEnd;
      }
      // If encounter is ongoing, check if doc is after start and within 24 hours
      else {
        const twentyFourHoursAfterStart = new Date(encounterStart);
        twentyFourHoursAfterStart.setHours(twentyFourHoursAfterStart.getHours() + 24);
        return docDate >= encounterStart && docDate <= twentyFourHoursAfterStart;
      }
    }
  }
  
  return false;
})
```

#### EncounterCard.js
Similar logic applied to the notes count in encounter cards, ensuring consistency across the UI.

## Benefits

1. **Immediate Value**: Synthea-generated notes now appear in encounter summaries
2. **Backward Compatibility**: Existing explicit references continue to work
3. **Clinical Relevance**: Notes created during encounters are logically associated
4. **User Experience**: No manual intervention needed to see historical notes

## Considerations

### Accuracy
- Temporal association may occasionally include notes not directly related to the encounter
- The 24-hour window for ongoing encounters is a reasonable clinical assumption
- Explicit references remain the preferred method

### Performance
- Additional date comparisons have minimal performance impact
- Filtering happens client-side on already-loaded resources

### Future Enhancements
1. Make the time window configurable (e.g., 12, 24, or 48 hours)
2. Add user preference to enable/disable temporal linking
3. Show visual indicator for temporally-linked vs explicitly-linked notes
4. Consider encounter type when determining time windows (e.g., longer for inpatient)

## Testing

To verify the enhancement:
1. Open an encounter that has a defined period
2. Check the Encounter Summary - notes created during that period should appear
3. The encounter card should show a non-zero note count
4. Create a new note - it should still be explicitly linked and appear immediately

## Technical Notes

- Uses date-fns `parseISO` for consistent date parsing
- Handles both completed and ongoing encounters appropriately
- Maintains FHIR compliance while adding practical functionality
- No database changes required - purely a UI enhancement