# Phase 2 Migration Testing Guide

## Overview
This guide provides instructions for testing the Phase 2 FHIR schema migration on the Azure VM.

**Date**: 2025-10-06
**Migration**: Replace fhir.* schema tables with HAPI FHIR services

## Files Modified

### 1. AuditEventService (`backend/api/services/audit_event_service.py`)
- **New Service**: Replaces `audit_service.py`
- **Storage**: HAPI FHIR AuditEvent resources instead of fhir.audit_logs table
- **Fix Applied**: Uses display format for references to avoid validation errors

### 2. Search Values API (`backend/api/fhir/search_values.py`)
- **Updated**: Queries HAPI JPA index tables instead of fhir.search_params
- **Tables Used**: hfj_spidx_token, hfj_spidx_string, hfj_spidx_date, hfj_spidx_number, hfj_spidx_quantity, hfj_spidx_uri

## Testing on Azure VM

### Prerequisites
- SSH access to wintehr.eastus2.cloudapp.azure.com
- Git repository cloned and up to date on VM
- All Docker containers running

### Step 1: Update Code on VM

```bash
# SSH to VM
ssh azureuser@wintehr.eastus2.cloudapp.azure.com

# Navigate to project
cd WintEHR

# Pull latest changes
git pull origin cleanup/remove-old-fhir

# Check current branch and status
git branch
git log --oneline -5
```

### Step 2: Copy Test Files to Container

```bash
# Copy simple test to backend container
docker cp backend/test_audit_simple.py wintehr-backend:/app/test_audit_simple.py

# Verify file copied
docker exec wintehr-backend ls -la /app/test_audit_simple.py
```

### Step 3: Run AuditEventService Test

```bash
# Run the test inside the container
docker exec wintehr-backend python /app/test_audit_simple.py

# Expected output:
# ============================================================
# Testing AuditEventService with HAPI FHIR
# ============================================================
# ✅ AuditEventService initialized
#
# 1. Testing login event creation...
# ✅ Login event created (no errors)
#
# 2. Testing failed login event...
# ✅ Failed login event created (no errors)
#
# 3. Testing resource access event...
# ✅ Resource access event created (no errors)
#
# ============================================================
# ✅ ALL TESTS PASSED - AuditEventService working correctly!
# ============================================================
```

### Step 4: Verify AuditEvents in HAPI FHIR

```bash
# Query HAPI FHIR for created audit events
curl -s "http://localhost:8080/fhir/AuditEvent?_sort=-date&_count=5" | jq '.total, .entry[].resource | {id, type, action, recorded}'

# Expected: Should see recent AuditEvent resources created by test
```

### Step 5: Test Search Values API

```bash
# Test getting searchable parameters for Patient
curl -s "http://localhost/api/fhir/search-values/Patient" | jq '.parameters | length, .parameters[:5]'

# Test getting distinct gender values
curl -s "http://localhost/api/fhir/search-values/Patient/gender" | jq '.values'

# Expected: Should return parameters and values from HAPI JPA indexes
```

## Troubleshooting

### Issue: Reference Validation Errors
**Symptom**: HAPI-1094 errors about resources not found
**Solution**: Already fixed - AuditEventService now uses display format instead of references

### Issue: Database Connection Errors
**Symptom**: Can't connect to PostgreSQL
**Check**: Ensure database container is running
```bash
docker ps | grep postgres
docker logs wintehr-postgres --tail 50
```

### Issue: HAPI FHIR Not Responding
**Symptom**: Connection refused to hapi-fhir:8080
**Check**: Ensure HAPI container is running
```bash
docker ps | grep hapi-fhir
docker logs hapi-fhir --tail 50
```

### Issue: Import Errors
**Symptom**: ModuleNotFoundError when running tests
**Check**: Verify files are properly deployed
```bash
docker exec wintehr-backend ls -la /app/api/services/audit_event_service.py
docker exec wintehr-backend python -c "from services.audit_event_service import AuditEventService; print('OK')"
```

## Validation Checklist

- [ ] AuditEventService test passes without errors
- [ ] AuditEvent resources created in HAPI FHIR
- [ ] Search values API returns HAPI JPA index data
- [ ] No reference validation errors in logs
- [ ] All Docker containers remain stable during tests

## Next Steps After Testing

Once all tests pass:

1. **Update Imports** - Change all files importing `audit_service.py` to use `audit_event_service.py`
2. **Clean Up Scripts** - Delete obsolete validation scripts in `scripts/testing/*` and `scripts/active/*`
3. **Drop Old Tables** - Remove fhir.* schema tables from PostgreSQL
4. **Update Documentation** - Mark migration as complete

## Success Criteria

✅ AuditEventService creates events in HAPI FHIR without validation errors
✅ Search values API returns data from HAPI JPA indexes
✅ No dependencies remain on fhir.audit_logs or fhir.search_params tables
✅ System continues to function normally with new services

---

**Created**: 2025-10-06
**Status**: Ready for testing
**Next**: Deploy and test on VM
