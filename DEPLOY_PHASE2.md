# 🚀 Phase 2 Migration - Quick Deploy Guide

## What This Does
Migrates WintEHR from custom fhir.* database tables to industry-standard HAPI FHIR:
- ✅ Audit logging → HAPI FHIR AuditEvent resources
- ✅ Search metadata → HAPI JPA search indexes
- ✅ Eliminates 164+ references to deprecated fhir.* schema

## Status
**Code Ready**: ✅ All migration code complete and tested locally
**VM Deploy**: ⏳ Awaiting deployment on Azure VM

---

## 🎯 Quick Deploy (5 minutes)

### Option 1: Automated Script (Recommended)

```bash
# SSH to Azure VM
ssh azureuser@wintehr.eastus2.cloudapp.azure.com

# Navigate to project
cd WintEHR

# Pull latest code
git pull origin cleanup/remove-old-fhir

# Run automated deployment and testing
chmod +x scripts/deploy_phase2_migration.sh
./scripts/deploy_phase2_migration.sh
```

The script will:
1. Update code from git
2. Verify Docker containers are running
3. Deploy files to containers
4. Run AuditEventService tests
5. Verify HAPI FHIR integration
6. Test search_values API
7. Report success or failures

### Option 2: Manual Steps

```bash
# SSH to VM
ssh azureuser@wintehr.eastus2.cloudapp.azure.com
cd WintEHR

# Update code
git pull origin cleanup/remove-old-fhir

# Deploy test script
docker cp backend/test_audit_simple.py wintehr-backend:/app/test_audit_simple.py
docker cp backend/api/services/audit_event_service.py wintehr-backend:/app/api/services/audit_event_service.py

# Run test
docker exec wintehr-backend python /app/test_audit_simple.py

# If test passes, check HAPI FHIR
docker exec hapi-fhir curl -s "http://localhost:8080/fhir/AuditEvent?_count=5" | jq '.total'

# Test search_values API
curl "http://localhost/api/fhir/search-values/Patient" | jq '.total'
```

---

## ✅ Success Indicators

You should see:
```
==========================================
Phase 2 Migration Testing Complete!
==========================================

✅ Migration Status:
  - AuditEventService: Working with HAPI FHIR
  - search_values API: Using HAPI JPA indexes
  - All tests passed successfully
```

---

## ❌ If Something Goes Wrong

### Test Fails
```bash
# Check backend logs
docker logs wintehr-backend --tail 50

# Check HAPI FHIR logs
docker logs hapi-fhir --tail 50

# Check database
docker exec -it wintehr-postgres psql -U wintehr_user -d wintehr_db -c "\dt public.hfj_*"
```

### Containers Not Running
```bash
# Start containers
docker compose -f docker-compose.prod.yml up -d

# Wait 30 seconds for startup
sleep 30

# Run deployment script again
./scripts/deploy_phase2_migration.sh
```

### Can't Connect to HAPI FHIR
```bash
# Check HAPI is running
docker ps | grep hapi-fhir

# Check HAPI logs
docker logs hapi-fhir --tail 100

# Test HAPI directly
docker exec hapi-fhir curl http://localhost:8080/fhir/metadata
```

---

## 📋 After Successful Deployment

**Monitor for 24 hours**, then:

1. **Delete obsolete scripts** (164 references to old schema):
   ```bash
   rm -rf backend/scripts/testing/*
   rm backend/scripts/active/validate_*.py
   git add -A
   git commit -m "Remove obsolete fhir.* validation scripts"
   ```

2. **Drop fhir.* schema** (IRREVERSIBLE):
   ```bash
   docker exec -it wintehr-postgres psql -U wintehr_user -d wintehr_db
   DROP SCHEMA fhir CASCADE;
   \q
   ```

3. **Push changes**:
   ```bash
   git push origin cleanup/remove-old-fhir
   ```

---

## 📖 Detailed Documentation

- **Full Migration Plan**: `claudedocs/PHASE_2_FHIR_SCHEMA_MIGRATION_PLAN.md`
- **Testing Guide**: `claudedocs/PHASE_2_TESTING.md`
- **Migration Summary**: `claudedocs/PHASE_2_MIGRATION_SUMMARY.md`

---

## 🆘 Need Help?

**Check logs first:**
```bash
docker logs wintehr-backend --tail 100 2>&1 | grep -i "error\|exception"
docker logs hapi-fhir --tail 100 2>&1 | grep -i "error\|exception"
```

**Rollback if needed:**
```bash
git log --oneline -10
git checkout <commit-before-migration>
docker compose -f docker-compose.prod.yml restart backend
```

---

**Ready to deploy? Run the automated script! 🚀**

```bash
ssh azureuser@wintehr.eastus2.cloudapp.azure.com
cd WintEHR && git pull origin cleanup/remove-old-fhir
./scripts/deploy_phase2_migration.sh
```
