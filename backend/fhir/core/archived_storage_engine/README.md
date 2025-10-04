# Archived FHIR Storage Engine

**Date Archived**: 2025-10-04
**Reason**: Migration to HAPI FHIR JPA Server completed

## Contents

This directory contains the original WintEHR custom FHIR storage engine that has been replaced by HAPI FHIR JPA Server.

### Archived Files

1. **storage.py** (2000+ lines) - Main FHIRStorageEngine class
   - CRUD operations for FHIR resources
   - Search parameter extraction
   - Reference handling
   - Patient compartments

2. **operations.py** - FHIR operations implementation
   - Patient/$everything
   - Observation/$lastn
   - Bundle processing

3. **operations_optimized.py** - Performance-optimized operations
   - Optimized query patterns
   - Batch processing

4. **utils.py** - Utility functions
   - Reference resolution
   - Helper functions

## Migration Summary

### What Replaced This

**HAPI FHIR JPA Server** (running on port 8888)
- Industry-standard FHIR R4 server
- Java-based with PostgreSQL backend
- Full FHIR specification compliance
- Better performance and scalability

**Python FHIR Client** (fhirclient library v4.2.1)
- Standard SMART on FHIR client
- Used via `services/fhir_client_config.py` wrapper
- HTTP-based FHIR operations

### All Services Migrated

- ✅ API services (ui_composer, debug_router, etc.)
- ✅ Clinical workflows (emr_api/clinical.py)
- ✅ Data processing (synthea_master.py)
- ✅ Frontend services (all use fhirclient)

## Historical Reference Only

**DO NOT** re-enable or import these files. They are kept for:
- Historical reference
- Understanding legacy implementation decisions
- Potential data migration troubleshooting

## See Also

- [HAPI_FHIR_FULL_REPLACEMENT_PLAN.md](../../HAPI_FHIR_FULL_REPLACEMENT_PLAN.md)
- [MIGRATION_SUMMARY_2025-10-04.md](../../MIGRATION_SUMMARY_2025-10-04.md)
- [services/fhir_client_config.py](../../services/fhir_client_config.py)
