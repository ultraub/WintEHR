# WintEHR Scripts Directory

This directory contains utility scripts for managing the WintEHR system. Many scripts have been consolidated for better maintainability.

## Primary Scripts

### `synthea_workflow.py` ⭐ **MAIN WORKFLOW**
**Consolidated Synthea workflow management** - The primary tool for synthetic patient data.

```bash
# Full workflow - generate and import patients
python synthea_workflow.py full --count 10 --clear-db

# Just generate patients
python synthea_workflow.py generate --count 5 --state California

# Import existing FHIR files
python synthea_workflow.py import --files patient1.json patient2.json

# Clear database and setup schema
python synthea_workflow.py clear
```

### `init_database_tables.py` ⭐ **DATABASE SETUP**
**Initialize all database tables** - Creates complete database schema.

```bash
# Initialize all tables (Patients, Observations, Devices, ImagingStudy, etc.)
python init_database_tables.py
```

### `sample_data.py` ⭐ **NEW - CONSOLIDATED**
**Create sample test data** - Replaces multiple individual scripts.

```bash
# Create all types of sample data
python sample_data.py --all

# Create specific types
python sample_data.py --patients 10 --providers 5 --communications 3
```

### `imaging_tools.py` ⭐ **NEW - CONSOLIDATED**
**DICOM and imaging utilities** - All imaging-related functionality.

```bash
# Generate DICOM files for existing studies
python imaging_tools.py generate

# Create generic test DICOM files
python imaging_tools.py generic --count 5

# Add imaging studies to patients
python imaging_tools.py add --count 2
```

## Specialized Scripts

### Database Management
- `init_fhir_schema.py` - Initialize FHIR-specific schema
- `update_fhir_schema.py` - Update FHIR schema tables
- `optimize_fhir_indexes.py` - Optimize database performance
- `clear_database.py` - Clear all database data

### Clinical Setup
- `populate_clinical_catalogs.py` - Populate medication, lab, imaging catalogs
- `assign_patients_to_providers.py` - Assign patients to providers
- `create_order_sets.py` - Create clinical order sets
- `create_drug_interactions.py` - Create drug interaction data

### Clinical Data Enhancement
- `add_clinical_notes.py` - Add clinical notes to patients
- `add_reference_ranges.py` - Add lab reference ranges

### Utilities
- `analyze_validation_errors.py` - Debug FHIR validation issues
- `comprehensive_setup.py` - Complete system setup (legacy)
- `populate_clinical_catalogs.py` - Populate clinical reference data

### DICOM and Imaging
- `generate_dicom_for_synthea.py` - Generate sample DICOM files
- `create_generic_dicoms.py` - Create generic DICOM test data

### Analysis and Reporting
- `hypertension_patient_report.py` - Generate hypertension patient reports
- `analyze_validation_errors.py` - Analyze FHIR validation issues

## Legacy Scripts (Deprecated)

The following scripts are deprecated and functionality has been moved to `synthea_workflow.py`:

- ~~`comprehensive_setup.py`~~ → Use `synthea_workflow.py full`
- ~~`comprehensive_refresh.py`~~ → Use `synthea_workflow.py full --clear-db`
- ~~`optimized_synthea_import.py`~~ → Use `synthea_workflow.py import`
- ~~`optimized_synthea_import_with_dicom.py`~~ → Use `synthea_workflow.py full`
- ~~`optimized_comprehensive_setup.py`~~ → Use `synthea_workflow.py full`

## Quick Start

For new users, the recommended workflow is:

```bash
# 1. Generate and import 5 patients with full workflow
cd backend
python scripts/synthea_workflow.py full --count 5

# 2. Validate the imported data
python scripts/synthea_workflow.py validate
```

## Environment Setup

Before running scripts, ensure:

1. **Synthea is installed** in `backend/synthea/`
2. **Database is configured** with proper connection string
3. **Python dependencies** are installed: `pip install -r requirements.txt`
4. **Java** is available for Synthea execution

## Script Categories

### Recent Consolidation (December 2024)

To improve maintainability, we've consolidated many scripts:

**New Consolidated Scripts:**
- `sample_data.py` - Combines all sample data creation functionality
- `imaging_tools.py` - Combines all DICOM and imaging utilities

**Removed Scripts (functionality moved to consolidated scripts):**
- Individual sample creation scripts → `sample_data.py`
- Individual imaging scripts → `imaging_tools.py`
- Various import scripts → `synthea_workflow.py`
- Redundant provider scripts → `sample_data.py`

**Archived Scripts:**
- `clean_patient_names.py` → `archive/` (one-time fix)

## Contributing

When adding new scripts:
1. Consider if functionality belongs in `synthea_workflow.py`
2. Document the script purpose in this README
3. Use consistent error handling and logging
4. Include docstrings and help text

## Troubleshooting

**Common Issues:**

1. **Synthea not found**: Ensure `backend/synthea/` directory exists with built Synthea
2. **Database connection**: Check `DATABASE_URL` environment variable
3. **Permission errors**: Make sure scripts are executable (`chmod +x script.py`)
4. **Java issues**: Ensure Java 11+ is available for Synthea