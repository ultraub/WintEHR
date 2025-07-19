# WintEHR Frontend Improvement Tasks

## Phase 1: Cleanup & Critical Fixes 🚨

### Task 1.1: Remove Duplicate and Dead Components
**Objective**: Clean up codebase by removing unused, duplicate, and test components

**Pre-execution Review:**
1. Analyze component dependencies with grep/Task tool
2. Check for any imports of components to be removed
3. Document any functionality that needs to be preserved
4. Create backup branch before deletion

**Subtasks:**
- [ ] 1.1.1 Remove duplicate ChartReviewTab versions
  - Delete `ChartReviewTab_backup.js`
  - Delete `ChartReviewTab_v2.js`
  - Verify `ChartReviewTab.js` has all needed features
  - Update any imports if necessary
  
- [ ] 1.1.2 Remove test/demo components
  - Delete `ErrorBoundaryDemo.js`
  - Delete `PrototypeMode.js`
  - Delete `Storybook.js`
  - Delete `TutorialMode.js`
  - Remove any related test files
  
- [ ] 1.1.3 Remove redundant directories
  - Analyze `fhir-canvas/` for any unique features
  - Migrate any useful code to main components
  - Delete `fhir-canvas/` directory
  - Repeat for `clinical-canvas/`
  
- [ ] 1.1.4 Clean up imports and references
  - Search for imports of deleted components
  - Update or remove dead imports
  - Run build to verify no broken dependencies

**Validation (Hot Reload):**
- Component deletions auto-refresh in browser
- Check browser console for import errors
- Navigate through app to verify no broken routes
- Check React DevTools for error boundaries
- Run `npm test -- --watch` in terminal for continuous validation
- Document components removed in CHANGELOG

### Task 1.2: Fix Notification System
**Objective**: Implement proper notification system with backend support

**Pre-execution Review:**
1. Analyze current notification stub implementation
2. Review WebSocket infrastructure
3. Check notification requirements in UI
4. Design notification data model

**Subtasks:**
- [ ] 1.2.1 Backend notification implementation
  - Create notification model/schema
  - Implement notification CRUD endpoints
  - Add notification WebSocket events
  - Create notification service layer
  - Add database migrations for notifications
  
- [ ] 1.2.2 Frontend notification service
  - Create proper `notificationService.js`
  - Implement WebSocket subscription for notifications
  - Add notification state management
  - Create notification queue/buffer
  
- [ ] 1.2.3 UI notification components
  - Fix `NotificationCenter.js` to use real data
  - Implement notification badges
  - Add notification preferences
  - Create notification history view
  
- [ ] 1.2.4 Integration testing
  - Test notification creation from various sources
  - Verify real-time delivery
  - Test notification acknowledgment
  - Verify persistence and history

**Validation (Hot Reload):**
- Create test notifications via API
- Hot reload updates notification badge immediately
- Open notification center - should update without refresh
- Test WebSocket reconnection on hot reload
- Verify notification state persists through hot reloads
- Test with multiple browser tabs (same user)

### Task 1.3: Fix Authentication System
**Objective**: Replace cached/hardcoded auth with proper FHIR-based authentication

**Pre-execution Review:**
1. Audit all hardcoded user references
2. Review current auth flow
3. Understand SMART on FHIR requirements
4. Plan migration strategy

**Subtasks:**
- [ ] 1.3.1 Remove hardcoded user references
  - Search for hardcoded practitioner IDs
  - Search for hardcoded "Dr. Smith" references
  - Create dynamic user resolution
  - Update all affected components
  
- [ ] 1.3.2 Implement proper user context
  - Create proper user service
  - Fetch user's Practitioner resource
  - Store in auth context properly
  - Add user profile endpoint
  
- [ ] 1.3.3 Fix login flow
  - Update login to fetch real user data
  - Properly store JWT tokens
  - Implement token refresh
  - Add logout cleanup
  
- [ ] 1.3.4 Update components to use auth context
  - Replace localStorage user access
  - Use context for current user
  - Update API calls to include auth
  - Fix user display throughout app

**Validation (Hot Reload):**
- Add auth debug component (see HOT_RELOAD_VALIDATION_GUIDE.md)
- Login with different users - watch console for token updates
- Navigate to Orders - verify requester updates without refresh
- Check React DevTools for auth context changes
- Test token expiration with shortened timeout in dev
- Monitor Network tab for Authorization headers

### Task 1.4: Fix ServiceRequest Import
**Objective**: Ensure all ServiceRequests are properly imported and available

**Pre-execution Review:**
1. Analyze why only 5/529 ServiceRequests imported
2. Check synthea data generation
3. Review import scripts
4. Understand ServiceRequest requirements

**Subtasks:**
- [ ] 1.4.1 Debug import issue
  - Run import with verbose logging
  - Identify validation failures
  - Check for missing references
  - Document root cause
  
- [ ] 1.4.2 Fix import script
  - Update validation rules if needed
  - Handle missing references gracefully
  - Add retry logic for failures
  - Improve error reporting
  
- [ ] 1.4.3 Re-import ServiceRequests
  - Create cleanup script for bad data
  - Run fresh import
  - Verify all 529 imported
  - Update import documentation
  
- [ ] 1.4.4 Update Orders module
  - Ensure Orders tab uses ServiceRequests
  - Add proper status tracking
  - Implement order lifecycle
  - Test order workflows

**Validation (Hot Reload):**
- Run import script - keep Orders tab open
- Add console logging to Orders component for count
- Orders should auto-populate as import completes
- Test order status updates - UI reflects immediately
- Use browser console to verify ServiceRequest count:
  `await window.__fhirService.search('ServiceRequest', {_count: 0})`
- Check Network tab for proper API calls

## Phase 2: Quick Wins & Low-Hanging Fruit 🎯

### Task 2.1: Expand Lab Results Display
**Objective**: Show all lab categories, not just vital signs

**Pre-execution Review:**
1. Analyze available Observation categories in data
2. Review current Results tab implementation
3. Plan UI layout for multiple categories
4. Consider performance with large datasets

**Subtasks:**
- [ ] 2.1.1 Update Observation fetching
  - Remove `category=vital-signs` filter
  - Implement category-based fetching
  - Add pagination for large results
  - Cache results appropriately
  
- [ ] 2.1.2 Categorize and organize results
  - Create category mapping
  - Design tabbed/accordion UI
  - Implement category filters
  - Add search within results
  
- [ ] 2.1.3 Enhance result display
  - Show all observation fields
  - Display reference ranges
  - Add interpretation flags
  - Show trending indicators
  
- [ ] 2.1.4 Add advanced features
  - Implement graphing for trends
  - Add abnormal value highlighting
  - Create result comparison view
  - Export functionality

**Validation (Hot Reload):**
- Add debug toggle to show observation categories
- Switch between patients - results update instantly
- Use React Profiler to measure render performance
- Add temporary category counter to UI:
  ```javascript
  {process.env.NODE_ENV === 'development' && (
    <div>Categories: {Object.keys(categorizedObs).join(', ')}</div>
  )}
  ```
- Monitor Network tab for efficient queries

### Task 2.2: Add Social History Display
**Objective**: Display social history observations in Chart Review

**Pre-execution Review:**
1. Identify social history observations in data
2. Review Chart Review tab layout
3. Plan integration approach
4. Consider privacy/sensitivity

**Subtasks:**
- [ ] 2.2.1 Create social history service
  - Query observations with social-history category
  - Parse smoking status, alcohol use, etc.
  - Handle missing/null values
  - Create data model
  
- [ ] 2.2.2 Design social history component
  - Create SocialHistoryCard component
  - Design clear, clinical layout
  - Add edit capabilities
  - Include last updated dates
  
- [ ] 2.2.3 Integrate into Chart Review
  - Add section to Chart Review
  - Maintain responsive layout
  - Add expand/collapse
  - Include in patient summary
  
- [ ] 2.2.4 Add documentation features
  - Allow updating social history
  - Create observation on edit
  - Add history tracking
  - Include in reports

**Validation (Hot Reload):**
- Add social history debug panel during dev
- Navigate between patients - social data loads instantly
- Edit social history - saves without page refresh
- Check WebSocket for real-time updates to other users
- Verify FHIR Observation structure in Network tab
- Use React DevTools to inspect observation state

### Task 2.3: Implement Procedure History
**Objective**: Create comprehensive procedure history display

**Pre-execution Review:**
1. Analyze Procedure resources in database
2. Review current procedure references
3. Plan timeline visualization
4. Consider procedure-condition linking

**Subtasks:**
- [ ] 2.3.1 Create procedure service
  - Implement procedure fetching
  - Add search/filter capabilities
  - Include related resources
  - Handle procedure outcomes
  
- [ ] 2.3.2 Design procedure components
  - Create ProcedureList component
  - Design ProcedureDetail view
  - Add timeline visualization
  - Include outcome display
  
- [ ] 2.3.3 Integrate procedures
  - Add to Chart Review
  - Create dedicated Procedures tab
  - Link to related conditions
  - Show in encounter context
  
- [ ] 2.3.4 Add clinical features
  - Group by body site
  - Show complications
  - Display technique/approach
  - Include operative notes

**Validation (Hot Reload):**
- Add procedure count badge during development
- Timeline component updates as you modify data
- Click procedure - related conditions highlight instantly
- Test date filtering - timeline redraws immediately
- Add debug view for procedure-condition relationships
- Monitor performance with many procedures

### Task 2.4: Add Basic Financial Display
**Objective**: Show insurance coverage and basic financial info

**Pre-execution Review:**
1. Check Coverage resources in data
2. Review Claims/EOB if available
3. Plan simple financial display
4. Consider privacy requirements

**Subtasks:**
- [ ] 2.4.1 Create coverage service
  - Fetch Coverage resources
  - Parse insurance details
  - Handle multiple coverages
  - Format for display
  
- [ ] 2.4.2 Design insurance card
  - Create InsuranceCard component
  - Show policy details
  - Display coverage period
  - Include copay/deductible
  
- [ ] 2.4.3 Add to patient header
  - Integrate into PatientHeader
  - Add to demographics view
  - Create coverage modal
  - Show eligibility status
  
- [ ] 2.4.4 Basic claims display
  - Show claim summaries if available
  - Display authorization status
  - Add billing alerts
  - Create simple reports

**Validation (Hot Reload):**
- Add coverage debug info to patient header
- Switch patients - insurance cards update instantly
- Test multiple coverage - UI adapts without refresh
- Add dev-only "Show All Fields" toggle
- Verify sensitive data properly masked
- Check console for no leaked financial data

## Phase 3: Architecture & Standardization 🏗️

### Task 3.1: Standardize FHIR Service Usage
**Objective**: Ensure all FHIR operations go through fhirService.js

**Pre-execution Review:**
1. Audit all direct fetch() calls
2. Review fhirService.js capabilities
3. Identify missing service methods
4. Plan migration approach

**Subtasks:**
- [ ] 3.1.1 Enhance fhirService.js
  - Add missing FHIR operations
  - Implement batch operations
  - Add caching layer
  - Improve error handling
  
- [ ] 3.1.2 Find and fix direct API calls
  - Search for fetch() calls to /fhir
  - List all components needing update
  - Create migration checklist
  - Document patterns to avoid
  
- [ ] 3.1.3 Migrate components systematically
  - Update one module at a time
  - Test thoroughly after each
  - Update error handling
  - Add loading states
  
- [ ] 3.1.4 Add development guards
  - Create ESLint rule for fetch()
  - Add code review checklist
  - Document in standards guide
  - Create helper utilities

**Validation (Hot Reload):**
- Add ESLint rule to flag direct fetch() calls
- Browser console warnings for violations during dev
- Add API call counter to dev toolbar:
  ```javascript
  window.__apiCallCount = 0; // Increment in service
  ```
- Test error scenarios - consistent toast messages
- Monitor Network tab for reduced duplicate calls
- Check batch operations consolidate requests

### Task 3.2: Complete Event System Integration
**Objective**: Ensure all clinical actions use event system

**Pre-execution Review:**
1. Map all clinical workflows
2. Identify missing event triggers
3. Review event subscribers
4. Plan event standardization

**Subtasks:**
- [ ] 3.2.1 Audit event usage
  - List all clinical actions
  - Check for event publishing
  - Find orphaned actions
  - Document event flow
  
- [ ] 3.2.2 Add missing event publishers
  - Orders placement/updates
  - Result acknowledgment
  - Medication changes
  - Documentation events
  
- [ ] 3.2.3 Ensure proper subscribers
  - Verify all relevant components subscribe
  - Add missing subscriptions
  - Remove duplicate handlers
  - Test event propagation
  
- [ ] 3.2.4 Create event documentation
  - Document all event types
  - Create event flow diagrams
  - Add developer guide
  - Include testing patterns

**Validation (Hot Reload):**
- Add event monitor panel during development
- Trigger events - see real-time in monitor
- Open multiple tabs - events sync across all
- Hot reload maintains event subscriptions
- Test workflow: Order → Pharmacy → Results
- Use console to manually trigger test events:
  ```javascript
  window.__eventBus.emit('ORDER_PLACED', testOrder)
  ```

### Task 3.3: Implement Advanced Search Features
**Objective**: Leverage backend's advanced search capabilities

**Pre-execution Review:**
1. Review available search parameters
2. Identify UI search needs
3. Plan search UI enhancements
4. Consider performance impact

**Subtasks:**
- [ ] 3.3.1 Add search parameter support
  - Implement modifier support (:exact, :contains)
  - Add _include/_revinclude UI
  - Create composite search builder
  - Add search templates
  
- [ ] 3.3.2 Enhance search UI components
  - Create AdvancedSearch component
  - Add search builder interface
  - Implement saved searches
  - Add search history
  
- [ ] 3.3.3 Optimize search performance
  - Implement search result caching
  - Add progressive loading
  - Use batch operations
  - Add search analytics
  
- [ ] 3.3.4 Add clinical search features
  - Problem list search
  - Medication interaction search
  - Similar patient search
  - Cohort building

**Validation (Hot Reload):**
- Add search query debugger to UI
- Build complex searches - see FHIR query in real-time
- Test modifiers - results update instantly
- Add result count and timing display:
  ```javascript
  Search completed: 127 results in 234ms
  ```
- Use Network tab to verify _include params
- Test saved searches persist through reload

### Task 3.4: Add Loading States and Error Handling
**Objective**: Consistent UX with proper feedback

**Pre-execution Review:**
1. Audit components missing states
2. Review current patterns
3. Design consistent approach
4. Plan implementation order

**Subtasks:**
- [ ] 3.4.1 Create standard components
  - Build LoadingSpinner component
  - Create ErrorBoundary wrapper
  - Design EmptyState component
  - Add SkeletonLoader patterns
  
- [ ] 3.4.2 Implement in data-fetching components
  - Add to all tabs
  - Update list components
  - Fix modal loading
  - Add to search results
  
- [ ] 3.4.3 Standardize error handling
  - Create error types/codes
  - Design error messages
  - Add retry mechanisms
  - Include error reporting
  
- [ ] 3.4.4 Add progressive enhancement
  - Implement optimistic updates
  - Add offline indicators
  - Create sync status
  - Show partial results

**Validation (Hot Reload):**
- Use Chrome DevTools Network throttling
- Loading skeletons appear immediately
- Trigger API errors - error boundaries catch
- Add debug panel showing component states:
  ```javascript
  State: {loading ? 'Loading' : error ? 'Error' : 'Ready'}
  ```
- Test retry button - no page refresh needed
- Verify empty states for no data scenarios

## Phase 4: Major Feature Development 🚀

### Task 4.1: Build Complete Encounters Module
**Objective**: Create comprehensive encounter management

**Pre-execution Review:**
1. Analyze Encounter resources
2. Review clinical workflows
3. Design encounter-centric navigation
4. Plan integration points

**Subtasks:**
- [ ] 4.1.1 Create encounter services
- [ ] 4.1.2 Build encounter list view
- [ ] 4.1.3 Design encounter details
- [ ] 4.1.4 Add encounter documentation
- [ ] 4.1.5 Integrate with other modules

### Task 4.2: Implement Medication Administration Record (MAR)
**Objective**: Complete medication administration workflow

**Pre-execution Review:**
1. Review MedicationAdministration resources
2. Understand nursing workflows
3. Design MAR interface
4. Plan safety features

**Subtasks:**
- [ ] 4.2.1 Create MAR services
- [ ] 4.2.2 Build MAR interface
- [ ] 4.2.3 Add administration workflow
- [ ] 4.2.4 Implement safety checks
- [ ] 4.2.5 Add reporting features

### Task 4.3: Enhanced Observation Display
**Objective**: Rich visualization of all observation types

**Pre-execution Review:**
1. Catalog all observation types
2. Plan visualization strategies
3. Design component architecture
4. Consider performance

**Subtasks:**
- [ ] 4.3.1 Create observation components
- [ ] 4.3.2 Add body site visualization
- [ ] 4.3.3 Implement multi-component display
- [ ] 4.3.4 Add trending and analytics
- [ ] 4.3.5 Create observation entry

### Task 4.4: Device Tracking Module
**Objective**: Track and display medical devices

**Pre-execution Review:**
1. Analyze Device resources
2. Review device-patient associations
3. Plan tracking interface
4. Consider integration needs

**Subtasks:**
- [ ] 4.4.1 Create device services
- [ ] 4.4.2 Build device list/details
- [ ] 4.4.3 Add device metrics
- [ ] 4.4.4 Implement alerts
- [ ] 4.4.5 Create reports

## Execution Guidelines

### For Each Task:
1. **Pre-execution Review** (30 min - 1 hour)
   - Deep dive into current implementation
   - Identify all dependencies
   - Review FHIR specifications
   - Create detailed plan

2. **Implementation** 
   - Follow subtasks sequentially
   - Test after each subtask
   - Document as you go
   - Commit frequently

3. **Testing**
   - Unit tests for new services
   - Integration tests for workflows
   - Manual testing scenarios
   - Performance testing

4. **Documentation**
   - Update component docs
   - Add to developer guide
   - Update API documentation
   - Create user guides

5. **Review**
   - Code review checklist
   - Clinical accuracy review
   - Performance review
   - Security review

### Success Criteria for Each Phase:
- **Phase 1**: All critical issues resolved, app stable
- **Phase 2**: Enhanced usability, more complete data display  
- **Phase 3**: Consistent architecture, improved performance
- **Phase 4**: Full-featured EMR with comprehensive workflows

### Risk Mitigation:
- Create feature branches for each task
- Maintain backward compatibility
- Progressive rollout capabilities
- Rollback plans for each phase