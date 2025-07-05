# Synthea Data Workflow Guide

This guide documents the consolidated workflow for generating and importing synthetic patient data using Synthea.

## Quick Start

For a complete setup with 10 patients:
```bash
cd scripts
python synthea_workflow.py full --count 10
```

## Prerequisites

1. **Synthea Installation**:
   ```bash
   # From backend directory
   git clone https://github.com/synthetichealth/synthea.git synthea
   cd synthea
   ./gradlew build
   ```

2. **PostgreSQL** running on localhost:5432 with:
   - Database: `emr_db`
   - User: `emr_user`
   - Password: `emr_password`

3. **Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Main Workflow Script

### `scripts/synthea_workflow.py`

This is the primary script for managing Synthea data generation and import.

#### Commands:

1. **Full Workflow** (Recommended):
   ```bash
   python synthea_workflow.py full --count 10
   ```
   This will:
   - Generate 10 synthetic patients
   - Reset and initialize the database
   - Import all generated data
   - Validate the import

2. **Generate Only**:
   ```bash
   python synthea_workflow.py generate --count 20 --state Massachusetts --city Boston
   ```

3. **Import Only**:
   ```bash
   python synthea_workflow.py import
   ```

4. **Validate Only**:
   ```bash
   python synthea_workflow.py validate
   ```

## Additional Scripts

### Database Management

**`scripts/reset_and_init_database.py`**
- Drops and recreates the database
- Initializes FHIR schema and tables
- Sets up search parameter indexes

```bash
python scripts/reset_and_init_database.py
```

### Import Script

**`scripts/synthea_import.py`**
- Imports FHIR bundles with profile-aware transformation
- Extracts search parameters automatically
- Provides detailed progress reporting

```bash
python scripts/synthea_import.py [directory] [--batch-size 50]
```

### Clinical Data Population

After importing Synthea data, populate additional clinical catalogs:

```bash
python scripts/populate_clinical_catalogs.py
python scripts/create_order_sets.py
python scripts/create_drug_interactions.py
```

### DICOM Generation

Generate DICOM images for imported imaging studies:

```bash
python scripts/generate_dicom_for_synthea.py
```

## Data Flow

1. **Synthea Generation** → FHIR bundles in `synthea/output/fhir/`
2. **Profile Transformation** → FHIR R4 compliant resources
3. **Database Storage** → PostgreSQL JSONB in `fhir.resources` table
4. **Search Indexing** → Extracted parameters in `fhir.search_params`

## Troubleshooting

### Common Issues

1. **Synthea not found**:
   - Ensure Synthea is cloned to `backend/synthea/`
   - Run `./gradlew build` in the Synthea directory

2. **Import errors**:
   - Check `logs/synthea_workflow.log` for details
   - Verify database connection settings
   - Ensure FHIR schema is initialized

3. **Validation failures**:
   - Run `python synthea_workflow.py validate` to check data
   - Review transformation logs in import output

### Logs and Backups

- Workflow logs: `logs/synthea_workflow.log`
- Data backups: `data/synthea_backups/`
- Import progress: `scripts/synthea_import_progress.json`

## Best Practices

1. **Always use the full workflow** for new setups
2. **Backup existing data** before regenerating
3. **Validate after import** to ensure data integrity
4. **Use consistent seeds** for reproducible data

## Archive

Old scripts have been moved to `archive/` subdirectories:
- `archive/database_scripts/` - Old database management
- `archive/import_scripts/` - Previous import implementations
- `archive/test_scripts/` - Test and validation scripts

Use the consolidated scripts instead of archived versions.