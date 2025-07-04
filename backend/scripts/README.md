# MedGenEMR Scripts Directory

This directory contains utility scripts for managing the MedGenEMR system. Many scripts have been consolidated for better maintainability.

## Primary Scripts

### `synthea_workflow.py` ⭐ **RECOMMENDED**
**Consolidated Synthea workflow management script** - Replaces multiple scattered scripts with a unified tool.

```bash
# Full workflow - generate and import patients
python synthea_workflow.py full --count 10 --clear-db

# Just generate patients
python synthea_workflow.py generate --count 5 --state California

# Import existing FHIR files
python synthea_workflow.py import --files patient1.json patient2.json

# Validate imported data
python synthea_workflow.py validate

# Clear database
python synthea_workflow.py clear

# Setup Synthea environment
python synthea_workflow.py setup
```

**Features:**
- Generates synthetic patients using Synthea
- Validates and imports FHIR data
- Sets up database schema
- Manages data integrity
- Provides comprehensive logging

## Specialized Scripts

### Database Management
- `clear_database.py` - Clear all database data
- `init_fhir_schema.py` - Initialize FHIR database schema

### Data Import/Export
- `direct_synthea_import.py` - Direct import bypassing validation
- `import_all_synthea_resources.py` - Comprehensive resource import

### Clinical Data Generation
- `create_sample_providers.py` - Generate sample healthcare providers
- `assign_patients_to_providers_auto.py` - Auto-assign patients to providers
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

### 🟢 **Active & Maintained**
- `synthea_workflow.py` - Primary workflow tool
- `direct_synthea_import.py` - Emergency import tool
- `clear_database.py` - Database management

### 🟡 **Specialized Use Cases**
- DICOM generation scripts
- Clinical catalog population
- Provider management scripts

### 🔴 **Deprecated**
- Multiple `optimized_*` scripts (use `synthea_workflow.py`)
- Multiple `comprehensive_*` scripts (use `synthea_workflow.py`)

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