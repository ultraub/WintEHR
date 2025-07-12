# Clinical Workflows Usage Guide

**Status**: Production-Ready Features Implemented  
**Last Updated**: 2025-01-12  
**Phases Completed**: 1.1, 1.2, 2.1, 2.2, 3.1  
**Total Features**: 20+ Clinical Workflow Enhancements

## 🎯 Overview

This document provides comprehensive guidance on using the clinical workflow features implemented in MedGenEMR. All features are production-ready and follow FHIR R4 standards with integrated clinical decision support.

## 📋 Phase Summary

### ✅ Phase 1.1: Enhanced Chart Review (Completed)
**Location**: `frontend/src/components/clinical/workspace/tabs/ChartReviewTab.js`

**Features Implemented**:
- Enhanced problem list management with CRUD operations
- Advanced medication management with reconciliation
- Allergy management with severity tracking
- Clinical safety panels with real-time alerts
- Export functionality (CSV, JSON, PDF) for all clinical data
- Print-ready clinical documents

### ✅ Phase 1.2: Clinical Safety & CDS Integration (Completed)
**Location**: `frontend/src/components/clinical/medications/` (multiple components)

**Features Implemented**:
- Real-time medication safety checking
- Drug-drug interaction detection
- Allergy contraindication alerts
- Age-based prescribing guidelines
- Clinical decision support integration
- Safety alert dashboard

### ✅ Phase 2.1: Advanced Medication Management (Completed)
**Location**: `frontend/src/services/` and `frontend/src/components/clinical/medications/`

**Features Implemented**:
- Prescription refill management system
- Medication discontinuation workflow
- Medication effectiveness monitoring
- Prescription status tracking
- Automated refill processing
- Clinical workflow validation

### ✅ Phase 2.2: Medication Management Integration (Completed)
**Location**: Multiple components with cross-module integration

**Features Implemented**:
- Cross-tab medication workflow orchestration
- Real-time prescription status updates
- Integrated medication list management
- Workflow validation and data consistency checking
- Enhanced medication reconciliation
- Complete medication lifecycle tracking

### ✅ Phase 3.1: Enhanced Lab Ordering (Completed)
**Location**: `frontend/src/services/enhancedLabOrderingService.js` and CPOE dialog

**Features Implemented**:
- Comprehensive lab panel definitions (10+ panels)
- Condition-based lab ordering sets
- Routine care templates
- Lab appropriateness checking
- Real-time duplicate order detection
- Lab result prediction timeline
- Enhanced CPOE integration

## 🚀 How to Use Each Feature

### 📊 Enhanced Chart Review

**Access**: Clinical Workspace → Chart Review Tab

#### Problem List Management
1. **View Problems**: All patient conditions displayed with status, onset date, and severity
2. **Add New Problem**: Click "Add Problem" button → Search conditions → Set status and notes
3. **Edit Problem**: Click pencil icon → Modify details → Save changes
4. **Export Data**: Click export button → Choose format (CSV/JSON/PDF)

**Key Features**:
- Real-time condition search with ICD-10 codes
- Problem status tracking (active, resolved, inactive)
- Clinical notes and provider documentation
- Export ready for external systems

#### Enhanced Medication Management
1. **View Medications**: Current and historical medications with status
2. **Prescribe New**: Click "Prescribe" → Enhanced medication search → Dosing guidance
3. **Medication Reconciliation**: Click "Reconcile" → Review all medications → Resolve discrepancies
4. **Refill Management**: View refill status → Process refills → Track prescription lifecycle
5. **Discontinue Medications**: Click "Discontinue" → Select reason → Document clinical rationale

**Key Features**:
- Enhanced medication search with dosing guidance
- Drug interaction checking
- Allergy contraindication alerts
- Prescription status tracking (ORDERED → DISPENSED → COMPLETED)
- Automatic medication list updates

#### Allergy Management
1. **View Allergies**: All known allergies with severity and reactions
2. **Add Allergy**: Click "Add Allergy" → Search allergens → Set severity and reactions
3. **Edit Allergy**: Click edit icon → Modify details → Update severity/reactions

**Safety Features**:
- Real-time allergen search with categories (drug, food, environmental)
- Severity tracking (mild, moderate, severe, life-threatening)
- Reaction documentation
- Cross-reference with prescribing system

### 🔒 Clinical Safety & CDS

**Access**: Integrated throughout clinical workflows

#### Medication Safety Checking
- **Automatic Activation**: Triggered when prescribing or reviewing medications
- **Drug Interactions**: Real-time alerts for moderate/severe interactions
- **Allergy Checks**: Immediate contraindication warnings
- **Age-Based Guidelines**: Pediatric/geriatric prescribing alerts

#### CDS Alert Management
1. **View Alerts**: Safety panel shows active alerts with severity levels
2. **Review Recommendations**: Click alert → View detailed guidance → Apply suggestions
3. **Acknowledge Alerts**: Mark as reviewed → Document clinical decision

### 💊 Advanced Medication Management

**Access**: Chart Review Tab → Medications Section

#### Prescription Refill Management
1. **View Refill Status**: Medications list shows refill information
2. **Process Refills**: 
   - Click "Refill" button on medication
   - Review refill eligibility
   - Select refill quantity and pharmacy
   - Submit refill request
3. **Track Refill History**: View all refill attempts and statuses

**Refill Features**:
- Automatic eligibility checking (timing, refills remaining)
- Pharmacy integration
- Insurance verification simulation
- Refill history tracking

#### Medication Discontinuation
1. **Initiate Discontinuation**:
   - Click "Discontinue" on active medication
   - Select discontinuation reason
   - Document clinical rationale
2. **Tapering Protocols**: System suggests tapering schedules for appropriate medications
3. **Follow-up Monitoring**: Automatic monitoring plan creation

#### Effectiveness Monitoring
1. **View Monitoring Plans**: Active medications show monitoring status
2. **Complete Assessments**:
   - Click "Assessment Due" alert
   - Answer effectiveness questions
   - Document clinical response
   - Schedule next review
3. **Track Outcomes**: View effectiveness trends and medication responses

### 🔬 Enhanced Lab Ordering

**Access**: Clinical Workspace → Orders Tab → Laboratory

#### Common Lab Panels
1. **Access CPOE**: Click "New Lab Order" → Select Laboratory tab
2. **Choose Common Panels**:
   - **CMP**: Comprehensive metabolic panel
   - **CBC with Diff**: Complete blood count with differential
   - **Lipid Panel**: Cholesterol and triglyceride screening
   - **Thyroid Panel**: TSH, T3, T4 testing
   - **Liver Function**: ALT, AST, bilirubin panel
   - **Kidney Function**: BUN, creatinine, GFR panel
   - **Coagulation**: PT/INR, PTT studies
   - **Inflammatory**: ESR, CRP markers
   - **Cardiac**: Troponin, BNP markers
   - **Tumor Markers**: PSA, CEA, CA-125

#### Condition-Based Lab Sets
1. **Select Condition Set**:
   - **Diabetes Monitoring**: A1C, glucose, microalbumin, lipid panel
   - **Hypertension Management**: BMP, lipid panel, microalbumin, thyroid panel
   - **Chronic Kidney Disease**: BMP, CBC, phosphorus, PTH, vitamin D
   - **Cardiac Assessment**: Lipid panel, BNP, troponin, BMP

#### Routine Care Templates
1. **Choose Template**:
   - **Annual Physical**: CBC, CMP, lipid panel, TSH, PSA/mammogram screening
   - **Pre-operative Clearance**: CBC, CMP, PT/INR, type & screen
   - **Wellness Screening**: Age-appropriate screening tests

#### Lab Appropriateness Checking
- **Automatic Validation**: System checks for duplicate orders
- **Clinical Recommendations**: Suggests appropriate tests based on patient conditions
- **Timing Alerts**: Warns about tests ordered too frequently
- **Age-Based Screening**: Recommends age-appropriate screening tests

#### Enhanced Order Features
1. **Order Details**:
   - Test priority (routine, urgent, STAT)
   - Specimen type and collection requirements
   - Fasting requirements and patient preparation
   - Estimated turnaround time
   - Clinical indication documentation

2. **Panel Components**: View individual components of complex panels
3. **Result Timeline**: Predicted result availability
4. **Collection Instructions**: Patient preparation guidance

## 📁 File Locations

### Core Services
```
frontend/src/services/
├── enhancedLabOrderingService.js          # Lab ordering with panels and appropriateness
├── medicationDiscontinuationService.js    # Medication discontinuation workflows
├── medicationEffectivenessService.js      # Effectiveness monitoring and assessment
├── medicationListManagementService.js     # Medication list reconciliation
├── prescriptionRefillService.js           # Refill management and processing
├── prescriptionStatusService.js           # Prescription lifecycle tracking
└── medicationWorkflowValidator.js         # Cross-workflow validation
```

### Clinical Components
```
frontend/src/components/clinical/
├── workspace/tabs/
│   └── ChartReviewTab.js                  # Enhanced chart review with all features
├── workspace/dialogs/
│   └── CPOEDialog.js                      # Enhanced lab ordering integration
├── medications/
│   ├── RefillManagement.js                # Prescription refill interface
│   ├── MedicationDiscontinuationDialog.js # Discontinuation workflow
│   ├── EffectivenessMonitoringPanel.js   # Effectiveness tracking
│   ├── WorkflowValidationPanel.js        # Validation and consistency checking
│   └── ClinicalSafetyPanel.js            # Safety alerts and CDS integration
└── prescribing/
    ├── PrescriptionStatusDashboard.js     # Status tracking dashboard
    └── EnhancedMedicationSearch.js        # Advanced medication search
```

### Utility Services
```
frontend/src/utils/
├── exportUtils.js                         # Multi-format data export
├── printUtils.js                         # Clinical document printing
└── intelligentCache.js                   # Performance optimization
```

## 🧪 Testing Guide

### Before Testing
1. **Start System**: `./start.sh`
2. **Verify Data**: Ensure Synthea patients are loaded
3. **Authentication**: Use demo/demo or nurse/password
4. **Browser Console**: Open dev tools to monitor for errors

### Test Scenarios

#### 1. Enhanced Chart Review Testing
```bash
# Test Steps:
1. Navigate to Clinical Workspace → Chart Review
2. Select patient with multiple conditions
3. Test problem list: Add/Edit/Delete conditions
4. Test medication management: Prescribe/Refill/Discontinue
5. Test allergy management: Add/Edit allergies
6. Test export: Export problem list, medications, allergies
7. Test print: Print clinical summaries
```

#### 2. Medication Safety Testing
```bash
# Test Steps:
1. Prescribe medication with known drug interaction
2. Verify drug interaction alert appears
3. Prescribe medication contraindicated by allergy
4. Verify allergy alert appears
5. Test age-based prescribing guidelines
6. Verify CDS recommendations display
```

#### 3. Prescription Workflow Testing
```bash
# Test Steps:
1. Prescribe new medication
2. Track prescription status progression
3. Process refill when eligible
4. Test refill denial scenarios
5. Discontinue medication with tapering
6. Complete effectiveness assessment
7. Verify workflow validation
```

#### 4. Lab Ordering Testing
```bash
# Test Steps:
1. Open CPOE → Laboratory tab
2. Test common lab panels (CMP, CBC, Lipid)
3. Test condition-based sets (Diabetes, Hypertension)
4. Test routine templates (Annual Physical)
5. Verify appropriateness checking
6. Test duplicate order detection
7. Submit lab orders and verify FHIR compliance
```

#### 5. Cross-Module Integration Testing
```bash
# Test Steps:
1. Prescribe medication in Chart Review
2. Verify prescription appears in Orders tab
3. Check medication list updates in real-time
4. Test cross-tab event communication
5. Verify workflow validation across modules
6. Test data consistency checking
```

### Common Test Data

#### Test Patients
- Use existing Synthea patients with multiple conditions
- Patient with diabetes for condition-based lab testing
- Patient with hypertension for cardiovascular monitoring
- Elderly patient for age-based prescribing guidelines

#### Test Medications
- **Metformin**: Diabetes medication with monitoring
- **Lisinopril**: Hypertension medication with lab monitoring
- **Warfarin**: Anticoagulant requiring INR monitoring
- **Amoxicillin**: Antibiotic for allergy interaction testing

#### Test Lab Orders
- **Basic Panel**: Order CMP for routine monitoring
- **Condition-Specific**: Order diabetes monitoring panel
- **Duplicate Test**: Attempt duplicate A1C order
- **Inappropriate Order**: Order pediatric test on adult

### Error Monitoring

#### Console Errors to Watch For
```javascript
// Expected: No errors for normal operations
// Acceptable: Network timeouts (retry mechanisms in place)
// Report: Any React component errors or FHIR validation failures
```

#### Performance Benchmarks
- **Page Load**: Chart Review should load within 2 seconds
- **Search Response**: Medication search under 500ms
- **Order Submission**: CPOE submission under 3 seconds
- **Data Export**: Export completion under 10 seconds

### Validation Checklist

#### ✅ Feature Functionality
- [ ] All CRUD operations work correctly
- [ ] Real-time updates function properly
- [ ] Cross-module communication works
- [ ] Export/print functions generate correct output
- [ ] CDS alerts display appropriately
- [ ] FHIR resources validate correctly

#### ✅ User Experience
- [ ] Intuitive navigation between features
- [ ] Clear error messages and guidance
- [ ] Responsive design on different screen sizes
- [ ] Loading states display properly
- [ ] No console errors during normal use

#### ✅ Data Integrity
- [ ] All changes persist correctly
- [ ] No data loss during operations
- [ ] Workflow validation catches inconsistencies
- [ ] Cross-references maintain integrity
- [ ] FHIR compliance maintained

## 🚨 Known Issues & Troubleshooting

### Common Issues
1. **Slow Loading**: Clear browser cache, restart backend
2. **Missing Data**: Verify Synthea data is properly loaded
3. **Authentication Issues**: Check JWT_ENABLED environment variable
4. **Export Failures**: Ensure sufficient data exists for export

### Performance Tips
- Use real patient data (not mock data)
- Test with multiple patients to verify scalability
- Monitor network requests in browser dev tools
- Check backend logs for any service errors

### Support
- Check CLAUDE.md for development guidelines
- Review component documentation for implementation details
- Use TodoWrite for tracking any issues found
- Refer to FHIR R4 specification for data validation

---

**Remember**: All features are production-ready and follow MedGenEMR coding standards. Report any issues through the established workflow validation system.