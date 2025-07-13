# Catalog Extraction System

The MedGenEMR system now includes a comprehensive catalog extraction service that automatically builds searchable catalogs from real patient FHIR data. This eliminates the need for manually maintaining static catalog files and ensures that your catalogs reflect actual medications, conditions, and lab tests used in your patient population.

## Overview

### What Does It Do?

The catalog extraction system:
- **Analyzes all patient FHIR resources** in the database
- **Extracts unique medications** from MedicationRequest resources
- **Extracts unique conditions** from Condition resources  
- **Extracts unique lab tests** from Observation resources
- **Provides frequency data** showing how often each item is used
- **Offers searchable APIs** for frontend integration

### Current Data (as of extraction)

From **5 patients** in the system, we've extracted:
- **28 unique medications** (99 total prescriptions)
- **57 unique conditions** (221 total occurrences, 35 currently active)
- **90 unique lab tests** (898 total results)

## API Endpoints

### Base URL: `/api/catalogs/extracted`

### 1. Extraction Management

**Trigger Extraction** (runs in background)
```bash
POST /api/catalogs/extracted/extract
```

**Get Extraction Summary**
```bash
GET /api/catalogs/extracted/summary
```

### 2. Medication Catalog

**Get All Medications**
```bash
GET /api/catalogs/extracted/medications
```

**Search Medications**
```bash
GET /api/catalogs/extracted/medications?search=amoxicillin&limit=10
```

**Filter by Frequency**
```bash
GET /api/catalogs/extracted/medications?min_occurrences=5
```

### 3. Conditions Catalog

**Get All Conditions**
```bash
GET /api/catalogs/extracted/conditions
```

**Search Conditions**
```bash
GET /api/catalogs/extracted/conditions?search=diabetes
```

**Active Conditions Only**
```bash
GET /api/catalogs/extracted/conditions?active_only=true
```

### 4. Lab Tests Catalog

**Get All Lab Tests**
```bash
GET /api/catalogs/extracted/lab-tests
```

**Search Lab Tests**
```bash
GET /api/catalogs/extracted/lab-tests?search=glucose
```

**Filter by Specimen Type**
```bash
GET /api/catalogs/extracted/lab-tests?specimen_type=Blood
```

### 5. Utility Endpoints

**Get Specimen Types**
```bash
GET /api/catalogs/extracted/specimen-types
# Returns: ["Blood", "Urine", "Serum", "Plasma"]
```

**Get Dosage Forms**
```bash
GET /api/catalogs/extracted/dosage-forms  
# Returns: ["Oral Tablet", "Topical Cream", "Solution", ...]
```

**Clear Cache** (force re-extraction)
```bash
DELETE /api/catalogs/extracted/cache
```

## Data Structure

### Extracted Medication
```json
{
  "id": "med_308136",
  "rxnorm_code": "308136", 
  "display_name": "amLODIPine 2.5 MG Oral Tablet",
  "generic_name": "amLODIPine",
  "strength": "2.5 MG",
  "dosage_form": "Oral Tablet", 
  "occurrence_count": 13,
  "last_seen": "2025-07-11T15:27:02.330075"
}
```

### Extracted Condition
```json
{
  "id": "cond_66383009",
  "snomed_code": "66383009",
  "display_name": "Gingivitis (disorder)",
  "condition_name": "Gingivitis",
  "is_disorder": true,
  "is_finding": false,
  "occurrence_count": 15,
  "active_count": 1,
  "last_seen": "2025-07-11T15:27:02.330075"
}
```

### Extracted Lab Test
```json
{
  "id": "lab_2339-0",
  "loinc_code": "2339-0",
  "display_name": "Glucose [Mass/volume] in Blood",
  "test_name": "Glucose [Mass/volume] in Blood",
  "specimen_type": "Blood",
  "unit": "Mass/volume",
  "reference_range": {"low": 70, "high": 99, "text": "70-99 mg/dL"},
  "occurrence_count": 24,
  "has_values": true,
  "last_seen": "2025-07-11T15:27:02.330075"
}
```

## Example Usage

### Get Top Prescribed Medications
```bash
curl "http://localhost:8000/api/catalogs/extracted/medications?limit=5"
```

### Search for Diabetes-Related Items
```bash
# Find diabetes medications
curl "http://localhost:8000/api/catalogs/extracted/medications?search=metformin"

# Find diabetes conditions  
curl "http://localhost:8000/api/catalogs/extracted/conditions?search=diabetes"

# Find glucose tests
curl "http://localhost:8000/api/catalogs/extracted/lab-tests?search=glucose"
```

### Get Lab Tests by Type
```bash
curl "http://localhost:8000/api/catalogs/extracted/lab-tests?specimen_type=Urine&limit=10"
```

## Real-World Examples

### Top Medications in System
1. **Acetaminophen/Oxycodone (Percocet)** - 13 prescriptions
2. **Albuterol Inhalation Solution** - 13 prescriptions  
3. **Amlodipine 2.5 MG** - 13 prescriptions
4. **Budesonide Inhalation** - 13 prescriptions
5. **Hydrochlorothiazide 25 MG** - 12 prescriptions

### Top Conditions in System
1. **Medication review due** - 46 occurrences (4 currently active)
2. **Full-time employment** - 15 occurrences (4 active)
3. **Gingivitis** - 15 occurrences (1 active)
4. **Stress** - 13 occurrences (1 active)
5. **Viral sinusitis** - 12 occurrences (all resolved)

### Common Lab Tests
1. **Basic Chemistry Panel** (Blood) - 24 tests each:
   - Calcium, CO2, Chloride, Creatinine, Glucose
2. **Urinalysis Components** - 13 tests each:
   - Glucose, Hemoglobin, Ketones, Leukocyte esterase, Nitrite

## Technical Implementation

### Caching Strategy
- **Cache Duration**: 1 hour by default
- **Auto-refresh**: Triggered when cache expires
- **Manual Refresh**: Use `POST /extract?force=true`
- **Background Processing**: Extraction runs asynchronously

### Data Parsing
- **Medications**: Extracts from `medicationCodeableConcept` in MedicationRequest
- **Conditions**: Extracts from `code` in Condition resources
- **Lab Tests**: Extracts from Observation resources with `category=laboratory`

### Coding Systems Used
- **Medications**: RxNorm codes (`http://www.nlm.nih.gov/research/umls/rxnorm`)
- **Conditions**: SNOMED CT codes (`http://snomed.info/sct`)
- **Lab Tests**: LOINC codes (`http://loinc.org`)

## Integration with Frontend

### React Component Example
```javascript
// Get extracted medications for order entry
const { data: medications } = useFetch('/api/catalogs/extracted/medications?limit=50');

// Search medications as user types
const searchMedications = async (searchTerm) => {
  const response = await fetch(
    `/api/catalogs/extracted/medications?search=${searchTerm}&limit=20`
  );
  return response.json();
};
```

### CPOE Integration
The extracted catalogs can be used for:
- **Medication Order Entry**: Search real medications with dosages
- **Problem List Management**: Add conditions seen in your patient population
- **Lab Order Entry**: Order tests that are actually performed in your facility

## Demo Script

Run the demonstration script to see extraction in action:

```bash
cd backend
python3 scripts/demo_catalog_extraction.py
```

This will show:
- Extraction summary with counts
- Top medications by frequency
- Top conditions with activity status  
- Lab tests organized by specimen type
- Search examples

## Benefits

### Over Static Catalogs
1. **Always Current**: Reflects actual usage patterns
2. **No Maintenance**: Automatically updates from patient data
3. **Usage-Based**: Shows frequency to guide clinical decisions
4. **Real Codes**: Uses actual RxNorm, SNOMED, and LOINC codes

### For Clinical Decision Support
1. **Evidence-Based**: Catalogs based on real patient care
2. **Frequency Weighting**: Popular items appear first
3. **Context Aware**: See what's actually being prescribed/ordered
4. **Quality Insights**: Identify overused or underused medications/tests

## Extending the System

### Add New Resource Types
Extend `CatalogExtractor` to include:
- **Procedures** from Procedure resources
- **Imaging Studies** from ImagingStudy resources
- **Allergies** from AllergyIntolerance resources

### Enhanced Parsing
- **Drug Interactions**: Add RxNorm API lookups
- **Clinical Guidelines**: Map conditions to care protocols
- **Reference Ranges**: Enhance lab test metadata

### Advanced Features
- **Machine Learning**: Predict commonly ordered combinations
- **Clinical Pathways**: Build order sets from usage patterns
- **Quality Metrics**: Track catalog compliance and effectiveness

---

The catalog extraction system transforms your EMR from using static, generic catalogs to dynamic, evidence-based catalogs built from your actual patient population. This ensures clinical relevance and improves the accuracy of computerized provider order entry (CPOE) systems.