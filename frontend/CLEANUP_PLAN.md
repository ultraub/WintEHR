# Frontend Repository Cleanup Plan

## Overview
After the comprehensive FHIR-native redesign, this document outlines the cleanup of legacy components and ensures all functionality is properly migrated to use FHIR resource state management.

## ✅ Successfully Migrated Components

### Core Components
- ✅ **PatientDashboardV2** - Now uses FHIR hooks and state management
- ✅ **FHIRResourceTimeline** - FHIR-native timeline visualization
- ✅ **Clinical Tab Components** - All using FHIR resource hooks
  - ChartReviewTab, OrdersResultsTab, CareManagementTab, FinancialTab
- ✅ **VitalSignsFlowsheet** - FHIR Observation resources
- ✅ **MedicationReconciliation** - FHIR MedicationRequest/Statement
- ✅ **Navigation Structure** - Streamlined and FHIR-focused

### State Management
- ✅ **FHIRResourceContext** - Centralized FHIR resource management
- ✅ **Custom FHIR Hooks** - Simplified resource access patterns
- ✅ **App.js** - Wrapped with FHIRResourceProvider

## 🗑️ Legacy Files to Remove

### 1. Deprecated Page Components
```bash
# These pages are replaced by the new FHIR-native components
rm /frontend/src/pages/PatientDetail.js           # Replaced by PatientDashboardV2
rm /frontend/src/pages/PatientViewRefined.js      # Replaced by PatientDashboardV2
rm /frontend/src/pages/CDSDemo.js                 # Legacy CDS demo
rm /frontend/src/pages/CDSHooksBuilderEnhanced.js # Legacy CDS hooks
rm /frontend/src/pages/UnifiedCQLMeasures.js      # Legacy quality measures
rm /frontend/src/pages/EncounterList.js           # Replaced by clinical workspace
rm /frontend/src/pages/LabResults.js              # Replaced by OrdersResultsTab
rm /frontend/src/pages/Alerts.js                  # Legacy alerts system
rm /frontend/src/pages/PatientNew.js              # Legacy patient creation
rm /frontend/src/pages/EncounterSchedule.js       # Legacy encounter scheduling
rm /frontend/src/pages/AuditTrailPage.js          # Legacy audit trail
rm /frontend/src/pages/Notifications.js           # Legacy notifications
rm /frontend/src/pages/Reports.js                 # Legacy reporting
rm /frontend/src/pages/Billing.js                 # Legacy billing
rm /frontend/src/pages/Medications.js             # Replaced by MedicationReconciliation
rm /frontend/src/pages/Messaging.js               # Legacy messaging
rm /frontend/src/pages/Tasks.js                   # Legacy task management
rm /frontend/src/pages/PatientMedications.js      # Replaced by clinical workspace tabs
rm /frontend/src/pages/PatientProblems.js         # Replaced by clinical workspace tabs
rm /frontend/src/pages/PatientAllergies.js        # Replaced by clinical workspace tabs
rm /frontend/src/pages/PatientEncounters.js       # Replaced by clinical workspace tabs
rm /frontend/src/pages/NewEncounter.js            # Legacy encounter creation
rm /frontend/src/pages/Imaging.js                 # Legacy imaging system
```

### 2. Legacy Components
```bash
# Old dashboard and clinical components
rm /frontend/src/components/PatientDashboard.jsx  # Replaced by PatientDashboardV2
rm /frontend/src/components/VitalSignsTab.js      # Replaced by VitalSignsFlowsheet
rm /frontend/src/components/LaboratoryTab.js      # Replaced by OrdersResultsTab
```

### 3. Mixed API Usage Files
```bash
# Files that use non-FHIR API calls - need review and update
# /frontend/src/services/api.js - Non-FHIR API calls
# /frontend/src/services/emrClient.js - EMR-specific endpoints
```

## 🔧 Files Requiring Updates

### 1. ClinicalWorkspace Component
- **Status**: Needs update to use new FHIR hooks
- **Location**: `/frontend/src/components/clinical/ClinicalWorkspace.js`
- **Action**: Update to integrate with new tab components

### 2. Layout Component  
- **Status**: May need navigation updates
- **Location**: `/frontend/src/components/Layout.js`
- **Action**: Update navigation menu to reflect new routes

### 3. Legacy Context Providers
- **Status**: Review for redundancy
- **Files**: 
  - `/frontend/src/contexts/ClinicalContext.js`
  - `/frontend/src/contexts/DocumentationContext.js`
  - `/frontend/src/contexts/OrderContext.js`
  - `/frontend/src/contexts/TaskContext.js`
  - `/frontend/src/contexts/InboxContext.js`
  - `/frontend/src/contexts/AppointmentContext.js`
- **Action**: Evaluate if still needed or can be replaced by FHIRResourceContext

## 🧪 Testing Updates Required

### 1. Component Tests
- Update tests for PatientDashboardV2 to use mock FHIR hooks
- Add tests for new clinical tab components
- Update integration tests for new navigation structure

### 2. Test Data
- Ensure test FHIR resources are available
- Update mock data to match FHIR R4 structure

## 📝 Documentation Updates

### 1. README Updates
- Update installation and setup instructions
- Document new navigation structure
- Add FHIR resource management guide

### 2. API Documentation
- Document new FHIR hooks usage
- Update component prop documentation
- Add migration guide for developers

## 🛠️ Implementation Steps

### Phase 1: Remove Deprecated Files
1. Back up current state with git commit
2. Remove legacy page components
3. Remove unused imports from App.js
4. Test that application still builds

### Phase 2: Update Dependencies
1. Review package.json for unused dependencies
2. Update dependencies to latest compatible versions
3. Remove any packages only used by deleted components

### Phase 3: Context Cleanup
1. Evaluate legacy context providers
2. Remove or consolidate redundant contexts
3. Update components to use FHIRResourceContext where appropriate

### Phase 4: Testing Updates
1. Update existing tests
2. Add tests for new components
3. Ensure all FHIR workflows are tested

### Phase 5: Documentation
1. Update all documentation
2. Create migration guide
3. Update deployment instructions

## 🚀 Post-Cleanup Validation

### Functional Tests
- [ ] Patient dashboard loads with FHIR data
- [ ] All clinical tabs function correctly
- [ ] Navigation works as expected
- [ ] Timeline displays patient resources
- [ ] Medication reconciliation workflow works
- [ ] Vital signs display properly
- [ ] No console errors or warnings

### Performance Tests
- [ ] Initial page load time
- [ ] FHIR resource loading performance
- [ ] Memory usage optimization
- [ ] Bundle size analysis

### Code Quality
- [ ] No unused imports
- [ ] No dead code
- [ ] ESLint passes
- [ ] TypeScript compilation (if applicable)
- [ ] All components properly documented

## 📊 Metrics to Track

### Before Cleanup
- Total files: ~50+ page/component files
- Bundle size: ~2.5MB
- Legacy API calls: ~15 different endpoints

### After Cleanup (Target)
- Total files: ~25 focused components
- Bundle size: ~1.8MB
- API calls: Pure FHIR R4 only

## 🔄 Rollback Plan

If issues arise during cleanup:
1. Git checkout to pre-cleanup commit
2. Restore specific files as needed
3. Gradual re-cleanup with more testing

## ✅ Success Criteria

1. **Functionality**: All clinical workflows work correctly
2. **Performance**: No degradation in loading times
3. **Maintainability**: Cleaner, more focused codebase
4. **FHIR Compliance**: 100% FHIR R4 API usage
5. **User Experience**: Seamless transition for end users
6. **Developer Experience**: Simplified development with consistent patterns

## 📝 Notes

- This cleanup aligns with the goal of creating a truly FHIR-native EMR system
- The new architecture provides better separation of concerns
- Educational features are preserved and enhanced in the Training Center
- All legacy functionality is replaced with modern, maintainable equivalents