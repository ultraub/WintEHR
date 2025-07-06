# MedGenEMR Testing Guide

## Overview

This guide consolidates testing procedures for the MedGenEMR FHIR-native system.

## Test Patients

The system includes 6 test patients with comprehensive clinical data:

| Patient Name | MRN | Gender | Age | Key Conditions |
|--------------|-----|--------|-----|----------------|
| John Q Test | MRN001 | Male | 45 | Hypertension, Type 2 Diabetes |
| David Williams | MRN002 | Male | 62 | Coronary artery disease, Hyperlipidemia |
| Linda Brown | MRN003 | Female | 38 | Asthma, Anxiety disorder |
| Michael Brown | MRN004 | Male | 55 | COPD, Osteoarthritis |
| Patricia Brown | MRN005 | Female | 42 | Hypothyroidism, Depression |
| Mary Brown | MRN006 | Female | 68 | Atrial fibrillation, Osteoporosis |

## Testing Checklist

### 1. FHIR API Testing

- [ ] **Capability Statement**: `GET /fhir/R4/metadata`
- [ ] **Patient Search**: `GET /fhir/R4/Patient`
- [ ] **Patient Read**: `GET /fhir/R4/Patient/{id}`
- [ ] **Encounter Search**: `GET /fhir/R4/Encounter?patient={id}`
- [ ] **Condition Search**: `GET /fhir/R4/Condition?patient={id}`
- [ ] **MedicationRequest Search**: `GET /fhir/R4/MedicationRequest?patient={id}`
- [ ] **Observation Search**: `GET /fhir/R4/Observation?patient={id}`
- [ ] **AllergyIntolerance Search**: `GET /fhir/R4/AllergyIntolerance?patient={id}`

### 2. Frontend Testing

#### Login Flow
- [ ] Access http://localhost:3000
- [ ] Select provider from dropdown
- [ ] Verify successful login and redirect

#### Patient List
- [ ] All 6 test patients appear
- [ ] Search functionality works
- [ ] Patient cards show correct demographics

#### Clinical Workspace
- [ ] Patient header shows correct information
- [ ] Medications tab displays current medications
- [ ] Conditions tab shows active problems
- [ ] Vitals tab displays recent measurements
- [ ] Lab results show with reference ranges
- [ ] Allergies display correctly

### 3. Data Integrity Testing

Run the validation script:
```bash
docker exec emr-backend python validate_system.py
```

### 4. Performance Testing

Check response times for common operations:
- Patient list load: < 500ms
- Patient detail load: < 1s
- Clinical data tabs: < 500ms

## Automated Testing

### Backend Tests
```bash
# Run FHIR API tests
docker exec emr-backend pytest tests/test_fhir_endpoints.py -v

# Run comprehensive FHIR tests
docker exec emr-backend pytest tests/test_fhir_api_comprehensive.py -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Manual Testing Scenarios

### Scenario 1: New Patient Encounter
1. Login as Dr. Sarah Johnson
2. Select John Test (Hypertension patient)
3. Review current medications
4. Check latest blood pressure readings
5. Verify medication adherence

### Scenario 2: Lab Result Review
1. Select any patient with diabetes
2. Navigate to Lab Results tab
3. Find HbA1c results
4. Verify values display with units
5. Check trend visualization

### Scenario 3: Allergy Alert
1. Select Linda Brown (has drug allergies)
2. Navigate to Allergies section
3. Verify penicillin allergy is prominently displayed
4. Check allergy severity indicators

## Browser Cleanup

If experiencing issues with cached data:

1. **Clear Application Data**:
   - Open Developer Tools (F12)
   - Go to Application tab
   - Clear Local Storage
   - Clear Session Storage
   - Clear Cookies

2. **Hard Refresh**:
   - Windows/Linux: Ctrl + Shift + R
   - Mac: Cmd + Shift + R

## Troubleshooting

### Common Issues

1. **Legacy API Calls (404 errors)**
   - Clear browser cache completely
   - Ensure using latest frontend build
   - Check docker logs: `docker logs emr-frontend`

2. **Missing Clinical Data**
   - Verify test data loaded: `docker exec emr-backend python scripts/database_summary.py`
   - Check FHIR resource count in database

3. **Login Issues**
   - Verify providers exist in database
   - Check backend logs: `docker logs emr-backend`
   - Ensure auth service is running

### Debug Commands

```bash
# Check all containers running
docker ps

# View backend logs
docker logs emr-backend -f

# View frontend logs
docker logs emr-frontend -f

# Database query
docker exec emr-postgres psql -U postgres -d medgenemr -c "SELECT COUNT(*) FROM fhir.resources;"
```

## Test Data Generation

To regenerate test patients:
```bash
docker exec emr-backend python scripts/generate_test_patients.py
```

## Verification Summary

After deployment, verify:
- ✅ All 6 test patients visible
- ✅ Clinical data loads for each patient
- ✅ FHIR API responds correctly
- ✅ No console errors in browser
- ✅ All Docker containers healthy