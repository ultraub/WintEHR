# State Management Fix - Execution Plan

## Quick Reference Guide

### 🚨 CRITICAL FIXES FIRST (Day 1)
These are causing immediate user-facing issues:

1. **EncountersTab** - Remove `setLoading(false)` on line 282
2. **ChartReviewTab** - Consolidate 3 loading states into 1
3. **Event Subscriptions** - Add cleanup functions (memory leaks!)

---

## Day 1: Stop the Bleeding (4-6 hours)

### Morning (2-3 hours)
**Owner: Frontend Lead**

#### Task 1: Fix EncountersTab Race Condition
```bash
# Branch: fix/encounters-loading-state
git checkout -b fix/encounters-loading-state
```

**File**: `frontend/src/components/clinical/workspace/tabs/EncountersTab.js`

1. **Delete lines 281-283** (the problematic useEffect)
2. **Update loading logic** to use actual data state
3. **Test**:
   - Open Network tab, set to "Slow 3G"
   - Navigate to Encounters tab
   - Verify loading spinner shows until data loads
   - Check console for no warnings

#### Task 2: Fix ChartReviewTab Loading States
**File**: `frontend/src/components/clinical/workspace/tabs/ChartReviewTab.js`

1. **Remove** `loading` and `loadingOptimized` state declarations
2. **Use only** `isLoading` from context
3. **Replace all** loading checks with single source
4. **Test** all three sections load properly

### Afternoon (2-3 hours)
**Owner: Senior Developer**

#### Task 3: Add Event Cleanup Functions
**Files to fix**:
- `EncountersTab.js` (lines 286-310)
- `PharmacyTab.js` (event subscriptions)
- `OrdersTab.js` (workflow events)

**Pattern to implement**:
```javascript
useEffect(() => {
  const unsub1 = subscribe(EVENT, handler);
  const unsub2 = subscribe(EVENT2, handler2);
  
  return () => {
    unsub1();
    unsub2();
  };
}, [dependencies]);
```

**Test**: Open Memory Profiler, switch tabs 20 times, verify no memory increase

---

## Day 2: Fix Dependencies & Optimize (6-8 hours)

### Morning (3-4 hours)
**Owner: Performance Engineer**

#### Task 4: Fix useEffect Dependencies
**Files with eslint-disable to fix**:
1. `SummaryTab.js` - loadDashboardData
2. `FHIRResourceContext.js` - refresh listener
3. `ChartReviewTab.js` - CDS alerts

**Process**:
1. Remove eslint-disable comments
2. Add proper dependencies
3. Use useCallback for stable functions
4. Test for infinite loops

#### Task 5: Memoize Expensive Operations
**Priority files**:
1. `ChartReviewTab.js` - filteredAndSortedConditions
2. `ResultsTab.js` - filtered results
3. `SummaryTab.js` - stats calculations

**Add console.log to verify memoization**:
```javascript
const filtered = useMemo(() => {
  console.log('Recomputing...'); // Remove after testing
  return expensiveOperation();
}, [deps]);
```

### Afternoon (3-4 hours)
**Owner: Frontend Team**

#### Task 6: Consolidate State Variables
**Start with ChartReviewTab.js** (has 20+ states):

1. Group related states into objects
2. Consider useReducer for complex state
3. Update all references
4. Test all functionality

---

## Day 3: Architecture & Testing (4-6 hours)

### Morning (2-3 hours)
**Owner: Tech Lead**

#### Task 7: Create Custom Hooks
**Create these files**:
1. `hooks/useAsyncResource.js` - For data loading
2. `hooks/useDebounce.js` - For search inputs
3. `hooks/useMemoizedFilter.js` - For list filtering

#### Task 8: Optimize Context
**File**: `contexts/FHIRResourceContext.js`

1. Memoize context value
2. Ensure callbacks are stable
3. Test consumer re-renders

### Afternoon (2-3 hours)
**Owner: QA Engineer**

#### Task 9: Add Tests & Monitoring
1. Add performance tests
2. Set up render tracking
3. Create debug helpers
4. Document patterns

---

## Validation Checklist

### After Each Fix:
- [ ] Hot reload still works
- [ ] No console errors/warnings
- [ ] Loading states accurate
- [ ] Memory usage stable
- [ ] Performance improved

### Before Merging:
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Performance measured
- [ ] Documentation updated

---

## Rollback Plan

If any fix causes issues:

1. **Immediate**: Revert the specific commit
2. **Feature flag**: Add flag to toggle new behavior
3. **Hotfix**: Apply minimal fix to stop issues
4. **Monitor**: Watch error rates for 24 hours

---

## Success Metrics

### Day 1 Goals:
- ✅ No more instant loading=false
- ✅ No memory leaks from events
- ✅ Single loading state source

### Day 2 Goals:
- ✅ No eslint-disable for deps
- ✅ 50% fewer re-renders
- ✅ Memoized expensive operations

### Day 3 Goals:
- ✅ Reusable patterns established
- ✅ Performance monitoring active
- ✅ Team trained on patterns

---

## Common Pitfalls to Avoid

1. **Don't fix everything at once** - One component at a time
2. **Don't skip testing** - Every fix needs validation
3. **Don't ignore TypeScript** - Update types as you go
4. **Don't forget cleanup** - Always return cleanup functions
5. **Don't over-optimize** - Measure first, optimize second

---

## Emergency Contacts

- **Performance Issues**: [Performance Team Slack]
- **Breaking Changes**: [On-Call Engineer]
- **Architecture Questions**: [Tech Lead]
- **Testing Help**: [QA Team]

---

## Daily Standup Topics

### Day 1 Standup:
- "Fixed encounters loading race condition"
- "Working on event cleanup functions"
- "Blocker: Need clarification on X"

### Day 2 Standup:
- "Memoized all expensive filters"
- "Fixed 15 useEffect dependencies"
- "Found infinite loop in Y, fixing"

### Day 3 Standup:
- "Custom hooks ready for review"
- "Performance improved by 60%"
- "Ready to document patterns"

---

## Code Review Checklist

- [ ] No loading race conditions
- [ ] All effects have cleanup
- [ ] Dependencies are correct
- [ ] Expensive ops memoized
- [ ] Context value memoized
- [ ] Tests added/updated
- [ ] Performance measured
- [ ] Docs updated

---

## After Action Report Template

```markdown
## State Management Fixes - AAR

### What We Fixed:
- [List specific fixes]

### Performance Improvements:
- Before: X ms average render
- After: Y ms average render
- Improvement: Z%

### Lessons Learned:
- [Key insights]

### Remaining Work:
- [Any deferred items]

### Recommendations:
- [Process improvements]
```