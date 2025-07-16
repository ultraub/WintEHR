# Pagination Patterns Guide

## Key Principles

When implementing server-side pagination, consider these patterns:

### 1. Search Functionality
- **Server-side search**: Pass search terms as query parameters
- **Client-side search**: Only for small, static datasets
- **Hybrid approach**: Show paginated results with total count

### 2. Features Requiring Complete Datasets

#### Trend Analysis
- Lab trends need ALL historical values for a specific test
- Vital sign trends need complete time series
- Solution: Separate API call when trend view is activated

#### Data Export
- Users expect to export ALL matching results, not just current page
- Solution: Separate export endpoint that bypasses pagination

#### Aggregations
- Summary statistics (averages, counts, ranges)
- Solution: Server provides aggregated data separately from paginated results

#### Cross-References
- Finding related resources across different types
- Solution: Use FHIR _include and _revinclude parameters

### 3. Component-Specific Patterns

#### Results Tab
```javascript
// Paginated for viewing
const { observations, goToPage } = usePaginatedObservations(patientId, { 
  pageSize: 10,
  code: searchTerm // Server-side search
});

// Full data for trends
const fetchTrendData = async (loincCode) => {
  return await fhirClient.search('Observation', {
    patient: patientId,
    code: loincCode,
    _count: 1000 // Get all
  });
};
```

#### Orders Tab
- Need to search across ALL orders (active, completed, cancelled)
- Solution: Server-side search with status aggregation

#### Medications Tab
- Drug interaction checking needs ALL active medications
- Solution: Load all active meds separately for interaction checking

#### Chart Review
- Problem list shows summaries across all conditions
- Solution: Aggregate endpoint for summaries

### 4. Implementation Checklist

For each component implementing pagination:

- [ ] Identify features needing complete datasets
- [ ] Determine search scope (current page vs all data)
- [ ] Plan export functionality approach
- [ ] Consider filtering location (client vs server)
- [ ] Handle edge cases (empty results, single page)
- [ ] Maintain performance with large datasets
- [ ] Preserve existing functionality

### 5. User Experience Considerations

- Show total count even with pagination
- Clear indication of filtered vs total results
- Loading states for separate data fetches
- Graceful degradation if server doesn't support advanced queries