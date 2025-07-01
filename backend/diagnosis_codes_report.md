# Diagnosis Codes in EMR Database

## Summary

Based on my analysis of the EMR database, here's what I found regarding diagnosis codes:

### Database Schema

The `Condition` model (in `backend/models/synthea_models.py`) has the following code fields:
- **`snomed_code`** - SNOMED CT codes (primary coding system)
- **`icd10_code`** - ICD-10 codes (available but not populated)
- **`description`** - Human-readable description of the condition

### Current Data

- **Total conditions in database**: 1,482
- **Unique SNOMED codes**: 130
- **Unique ICD-10 codes**: 0 (field exists but not populated)

### Code System Used

The system exclusively uses **SNOMED CT (Systematized Nomenclature of Medicine Clinical Terms)** codes. These are imported from Synthea-generated patient data during the data import process.

### Sample Diagnosis Codes

Here are some examples of SNOMED codes stored in the database:

| SNOMED Code | Description |
|-------------|-------------|
| 314529007 | Medication review due (situation) |
| 73595000 | Stress (finding) |
| 66383009 | Gingivitis (disorder) |
| 44054006 | Type 2 diabetes mellitus (disorder) |
| 38341003 | Hypertensive disorder (disorder) |
| 15777000 | Prediabetes (finding) |
| 195662009 | Acute viral pharyngitis (disorder) |
| 444814009 | Viral sinusitis (disorder) |
| 10509002 | Acute bronchitis (disorder) |
| 127013003 | Disorder of kidney due to diabetes mellitus (disorder) |

### Most Common Conditions

The top 10 most frequently occurring conditions in the database:

1. Medication review due (314529007) - 281 occurrences
2. Stress (73595000) - 127 occurrences
3. Gingivitis (66383009) - 122 occurrences
4. Full-time employment (160903007) - 109 occurrences
5. Part-time employment (160904001) - 79 occurrences
6. Social isolation (422650009) - 47 occurrences
7. Limited social contact (423315002) - 40 occurrences
8. Gingival disease (18718003) - 35 occurrences
9. Viral sinusitis (444814009) - 35 occurrences
10. Not in labor force (741062008) - 34 occurrences

### API Access

Currently, there is **no dedicated API endpoint** to retrieve the list of available diagnosis codes. The conditions can be accessed through:

1. **`GET /api/app/conditions`** - Lists conditions with filters (returns actual patient conditions, not a catalog)
2. **`POST /api/app/conditions`** - Creates a new condition (requires manual entry of SNOMED code)

### Recommendations

1. **No Diagnosis Catalog**: Unlike medications, lab tests, and imaging studies, there's no diagnosis code catalog table in the system.

2. **Dynamic List**: The available diagnosis codes are dynamically determined by what's been imported from Synthea data.

3. **Missing Endpoint**: To improve the user experience, consider adding an endpoint like:
   ```
   GET /api/clinical/catalogs/diagnosis-codes
   ```
   This could return the unique SNOMED codes and descriptions from the conditions table.

4. **ICD-10 Support**: The `icd10_code` field exists but is not populated. If ICD-10 support is needed, this would require:
   - Mapping SNOMED codes to ICD-10 codes
   - Updating the import process
   - Potentially creating a diagnosis code catalog table

### Data Source

All diagnosis codes come from Synthea-generated synthetic patient data. The import process (`optimized_synthea_import.py`) extracts SNOMED codes from FHIR Condition resources where the coding system is "http://snomed.info/sct".