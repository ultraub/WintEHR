# MedGenEMR Cleanup Plan

**Generated**: 2025-01-19  
**Type**: Safe Cleanup (Conservative)  
**Risk Level**: Low to Medium

## 📊 Analysis Summary

### 1. Console.log Statements
- **Frontend**: 72 console.log statements in 13 files
- **Backend**: 1,282 print statements (mostly in scripts/tests)
- **Priority Files**:
  - `CDSContext.js` - 31 console.logs (HIGH PRIORITY)
  - `ServiceSelector.js` - 9 console.logs
  - `FHIRExplorerApp.jsx` - 8 console.logs

### 2. TODO Comments
- **Total**: 30 TODO/FIXME comments found
- **Categories**:
  - Auth context integration - 4 occurrences
  - API implementation - 8 occurrences
  - Feature completion - 18 occurrences

### 3. Code Quality Issues
- Debugging code left in production
- Hardcoded values that should use context
- Missing error handling in some areas

## 🎯 Cleanup Plan

### Phase 1: High Priority - Console.log Cleanup (SAFE)

#### Files to Clean:
1. **frontend/src/contexts/CDSContext.js**
   - Remove 31 console.log statements
   - Replace with proper error handling where needed
   - Risk: LOW - These are debug statements

2. **frontend/src/services/ServiceSelector.js**
   - Remove 9 console.log statements
   - Risk: LOW

3. **frontend/src/pages/CDSHooksStudio.js**
   - Remove 6 console.log statements
   - Risk: LOW

4. **frontend/src/components/fhir-explorer-v4/core/FHIRExplorerApp.jsx**
   - Remove 8 console.log statements
   - Risk: LOW

5. **backend/fhir/core/storage.py**
   - Replace 6 print statements with proper logging
   - Risk: MEDIUM - Core storage component

### Phase 2: TODO Comment Resolution (MEDIUM PRIORITY)

#### Critical TODOs to Address:
1. **Auth Context Integration** (4 files)
   - Replace hardcoded 'current-user' with actual auth context
   - Files: CDSContext.js, ImagingReportDialog.js, DashboardManager.js

2. **API Implementation Gaps** (3 files)
   - Implement notifications endpoint
   - Complete provider directory search
   - Add procedures API

### Phase 3: Code Improvements (LOW PRIORITY)

1. **Error Handling**
   - Add try-catch blocks where missing
   - Implement proper error boundaries

2. **Performance**
   - Remove duplicate API calls
   - Optimize re-renders

## 🛡️ Risk Assessment

### Safe to Clean (Low Risk):
- Console.log statements in UI components
- Debug print statements in non-critical paths
- Commented-out code blocks
- Unused imports in component files

### Moderate Risk:
- Console.logs in service files (might be used for debugging)
- Print statements in core backend modules
- TODO comments that affect functionality

### High Risk (Not Recommended):
- Console.logs in service worker
- Print statements in migration scripts
- Debug code in authentication flow

## 📋 Execution Steps

### Step 1: Create Backup Branch
```bash
git checkout -b cleanup/remove-console-logs-2025-01-19
```

### Step 2: Clean Frontend Console.logs
- Use automated script to remove console.log statements
- Manually review service files
- Test each module after cleanup

### Step 3: Clean Backend Print Statements
- Replace with proper logging using Python's logging module
- Keep print statements in scripts and migrations

### Step 4: Address Critical TODOs
- Implement auth context usage
- Add missing API endpoints
- Update hardcoded values

### Step 5: Testing
- Run full test suite
- Manual testing of affected modules
- Check for regression issues

## 🚀 Recommended Actions

### Immediate (Today):
1. Clean console.logs from top 5 files
2. Test affected components
3. Commit changes

### Short-term (This Week):
1. Address auth context TODOs
2. Implement missing APIs
3. Add proper logging

### Long-term (This Month):
1. Complete all TODO items
2. Add ESLint rules to prevent console.logs
3. Implement structured logging

## 📊 Expected Impact

- **Code Quality**: +25% improvement
- **Performance**: Minor improvement (less console output)
- **Maintainability**: Significant improvement
- **Risk**: Low with proper testing

## ⚠️ Do NOT Clean:
- Service worker console.logs (sw.js)
- Setup proxy logs (setupProxy.js)
- Test file console.logs
- Migration script prints
- Build/deployment scripts

---

**Note**: This plan focuses on safe, incremental improvements. Each phase should be tested thoroughly before proceeding to the next.