# Deprecated Middleware Components

**Date**: 2025-10-04
**Reason**: HAPI FHIR Migration

## Files in This Directory

### reference_normalizer.py
**Status**: Deprecated and unused
**Date Deprecated**: 2025-10-04
**Reason**: No longer needed after HAPI FHIR migration

This middleware was designed to normalize URN format references (`urn:uuid:xxx`) to standard FHIR references (`ResourceType/id`) in API responses. It queried the PostgreSQL `fhir.resources` table to resolve UUIDs.

**Why Deprecated**:
1. HAPI FHIR returns standard FHIR references natively
2. The backend now proxies HAPI FHIR responses directly
3. PostgreSQL FHIR tables have been deprecated
4. URN references only existed in legacy Synthea data

**Replacement**: None needed - HAPI FHIR handles references correctly

**Safe to Delete**: Yes - this middleware was never registered in the application

---

## Migration Notes

These files are kept for historical reference only. They can be safely deleted after:
1. Confirming no legacy code references them
2. Verifying HAPI FHIR integration is stable
3. Completing full system testing

For migration details, see:
- `/backend/HAPI_FHIR_MIGRATION_COMPLETE_2025-10-04.md`
- `/backend/fhir/core/archived_storage_engine/README.md`
