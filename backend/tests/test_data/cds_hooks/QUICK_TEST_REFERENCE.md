# CDS Hooks Quick Test Reference

**Quick commands for testing all condition types**

---

## Unit Tests (5 minutes)

```bash
# Run all CDS hooks unit tests
docker exec emr-backend pytest backend/tests/api/test_cds_hooks_conditions_comprehensive.py -v

# Quick smoke test (just age and medication)
docker exec emr-backend pytest backend/tests/api/test_cds_hooks_conditions_comprehensive.py::TestAgeConditions::test_age_operators -v
docker exec emr-backend pytest backend/tests/api/test_cds_hooks_conditions_comprehensive.py::TestMedicationConditions::test_medication_parameter_formats -v
```

---

## Integration Tests (10 minutes)

### 1. Create All Test Hooks (One Command)

```bash
# Create all test hooks at once
for hook in age medication diagnosis lab_value vital_sign combined; do
  curl -X POST http://localhost:8000/api/cds-services/services \
    -H "Content-Type: application/json" \
    -d @backend/tests/test_data/cds_hooks/test_${hook}_conditions.json
done
```

### 2. Test with Known Patients

```bash
# Test Age (Patient 13532)
curl -X POST http://localhost:8000/cds-services/test-age-gt-65 \
  -H "Content-Type: application/json" \
  -d '{"hookInstance":"550e8400-e29b-41d4-a716-446655440001","hook":"patient-view","fhirServer":"https://localhost:8000/fhir/R4","context":{"patientId":"13532"}}'

# Test Medication (Patient 10913 - has Simvastatin)
curl -X POST http://localhost:8000/cds-services/test-medication-simvastatin \
  -H "Content-Type: application/json" \
  -d '{"hookInstance":"550e8400-e29b-41d4-a716-446655440002","hook":"medication-prescribe","fhirServer":"https://localhost:8000/fhir/R4","context":{"patientId":"10913"}}'

# Test Diagnosis (Patient 13532 - has stress disorder)
curl -X POST http://localhost:8000/cds-services/test-diagnosis-stress \
  -H "Content-Type: application/json" \
  -d '{"hookInstance":"550e8400-e29b-41d4-a716-446655440003","hook":"patient-view","fhirServer":"https://localhost:8000/fhir/R4","context":{"patientId":"13532"}}'

# Test Combined (Patient 13532 - age 65+ AND has condition)
curl -X POST http://localhost:8000/cds-services/test-combined-elderly-diabetic \
  -H "Content-Type: application/json" \
  -d '{"hookInstance":"550e8400-e29b-41d4-a716-446655440006","hook":"patient-view","fhirServer":"https://localhost:8000/fhir/R4","context":{"patientId":"13532"}}'
```

### 3. Expected Results

| Test | Patient | Should Return Card? | Why |
|------|---------|---------------------|-----|
| Age > 65 | 13532 | ✅ YES | Patient is over 65 |
| Medication | 10913 | ✅ YES | Has Simvastatin (312961) |
| Diagnosis | 13532 | ✅ YES | Has stress disorder (73211009) |
| Combined | 13532 | ✅ YES | Age 65+ AND has condition |

---

## Verification Commands

```bash
# List all created hooks
curl http://localhost:8000/api/cds-services/services | jq '.[] | {id, title, hook, conditions: .conditions | length}'

# Check backend logs for errors
docker-compose logs backend --tail=50 | grep -i error

# Verify patient data
curl "http://localhost:8000/fhir/R4/Patient/13532" | jq '.birthDate, .gender'
curl "http://localhost:8000/fhir/R4/MedicationRequest?patient=10913&status=active" | jq '.total'
curl "http://localhost:8000/fhir/R4/Condition?patient=13532" | jq '.total'
```

---

## Test Coverage Summary

✅ **Age Conditions**: gt, ge, lt, le, eq operators
✅ **Gender Conditions**: Case-insensitive matching
✅ **Diagnosis Conditions**: in, equals, not-in operators
✅ **Medication Conditions**: All parameter formats (codes, medication, medications, drugClass)
✅ **Lab Value Conditions**: All operators + legacy 'labTest' parameter
✅ **Vital Sign Conditions**: All operators + blood pressure components
✅ **Combined Conditions**: Multiple conditions with AND logic
✅ **Edge Cases**: Empty parameters, malformed data, network errors

**Total Coverage**: 75 unit tests + 6 integration test hooks

---

## Troubleshooting

**No cards returned?**
```bash
# Check if condition matched
docker-compose logs backend | grep "Condition check result"

# Verify patient has data
curl "http://localhost:8000/fhir/R4/Patient/{patientId}"
```

**Hook not found?**
```bash
# Recreate the hook
curl -X POST http://localhost:8000/api/cds-services/services \
  -H "Content-Type: application/json" \
  -d @backend/tests/test_data/cds_hooks/test_age_conditions.json
```

**Unit tests fail?**
```bash
# Install test dependencies
docker exec emr-backend pip install pytest pytest-asyncio pytest-cov

# Run with verbose output
docker exec emr-backend pytest backend/tests/api/test_cds_hooks_conditions_comprehensive.py -vv
```

---

## Success Criteria

✅ All 75 unit tests pass
✅ All 6 integration hooks return correct cards
✅ No errors in backend logs
✅ Response time < 2 seconds per hook
✅ Proper parameter handling for all formats
✅ Consistent operator behavior across condition types

---

**For detailed testing procedures, see**: `CDS_HOOKS_TESTING_GUIDE.md`
