# Consolidated Scripts Guide

This directory contains consolidated scripts for managing the MedGenEMR system. Old scripts have been archived to the `archive/` directory.

## Main Consolidated Scripts

### 1. synthea_workflow.py
**Purpose**: Complete workflow for Synthea data generation and import

**Commands**:
```bash
# Run complete workflow (generate, reset DB, import, validate)
python synthea_workflow.py full

# Generate 20 patients
python synthea_workflow.py full --count 20

# Only generate data (no import)
python synthea_workflow.py generate --count 10

# Import existing Synthea data
python synthea_workflow.py import

# Validate imported data
python synthea_workflow.py validate
```

### 2. reset_and_init_database.py
**Purpose**: Reset database and initialize FHIR schema

```bash
# Reset and initialize database
python reset_and_init_database.py
```

### 3. synthea_import.py
**Purpose**: Import Synthea FHIR bundles with transformation

```bash
# Import from default directory
python synthea_import.py

# Import from custom directory
python synthea_import.py /path/to/fhir/bundles

# Adjust batch size
python synthea_import.py --batch-size 100
```

## Additional Utility Scripts

### generate_dicom_for_synthea.py
Generate DICOM images for imported imaging studies

### populate_clinical_catalogs.py
Populate clinical catalogs (lab tests, medications, etc.)

### create_order_sets.py
Create clinical order sets

### create_drug_interactions.py
Populate drug interaction database

## Archived Scripts

Old scripts have been moved to the `archive/` directory:

- **archive/database_scripts/**: Old database management scripts
  - clear_database.py
  - clear_fhir_data.py
  - init_fhir_schema.py
  - setup_fhir_storage.py
  - init_database_tables.py
  - update_fhir_schema.py
  - optimize_fhir_indexes.py

- **archive/import_scripts/**: Old import scripts
  - import_synthea_fixed.py
  - import_synthea_improved.py

- **archive/validation_scripts/**: Old validation scripts
  - analyze_validation_errors.py

## Recommended Workflow

For a fresh setup with synthetic data:

```bash
# 1. Complete workflow with 10 patients
python synthea_workflow.py full --count 10

# 2. Generate additional clinical data
python populate_clinical_catalogs.py
python create_order_sets.py
python create_drug_interactions.py

# 3. Generate DICOM images
python generate_dicom_for_synthea.py
```

For importing existing Synthea data:

```bash
# 1. Reset database
python reset_and_init_database.py

# 2. Import Synthea data
python synthea_import.py

# 3. Validate import
python synthea_workflow.py validate
```

## Notes

- The consolidated scripts use the new FHIR-native storage (fhir.resources table)
- Profile-aware transformation is applied during import
- Search parameters are automatically extracted
- All scripts include proper error handling and progress reporting