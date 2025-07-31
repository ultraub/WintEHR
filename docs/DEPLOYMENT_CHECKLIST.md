# WintEHR Deployment Checklist

**Last Updated**: 2025-01-26  
**Purpose**: Comprehensive checklist for fresh deployments of WintEHR

## Pre-Deployment Requirements

### System Requirements
- [ ] Docker Desktop installed and running
- [ ] Docker Compose installed
- [ ] Minimum 4GB RAM available for Docker
- [ ] Minimum 10GB disk space available
- [ ] Ports 80, 3000, 8000, 5432 available

### Required Files
All files must exist before deployment:

#### Core Configuration
- [ ] `/docker-compose.yml`
- [ ] `/backend/requirements.txt`
- [ ] `/frontend/package.json`

#### Database Scripts
- [ ] `/backend/scripts/setup/init_database_definitive.py` - Creates all 6 FHIR tables

#### Data Management Scripts
- [ ] `/backend/scripts/active/synthea_master.py` - Data generation and import
- [ ] `/backend/scripts/active/consolidated_search_indexing.py` - Search parameter indexing
- [ ] `/backend/scripts/fix_allergy_intolerance_search_params_v2.py` - URN reference fix
- [ ] `/backend/scripts/setup/populate_compartments.py` - Patient compartment population
- [ ] `/backend/scripts/migrations/fix_cds_hooks_enabled_column.py` - CDS hooks schema fix
- [ ] `/backend/scripts/verify_all_fhir_tables.py` - Comprehensive validation

#### Validation Scripts
- [ ] `/scripts/validate_deployment.py` - General deployment validation
- [ ] `/backend/scripts/verify_search_params_after_import.py` - Search parameter verification

## Deployment Methods

### Simplified Deployment (Recommended)
```bash
./deploy.sh dev              # Development mode with 20 patients
./deploy.sh dev --patients 50    # Custom patient count
./deploy.sh prod             # Production mode
./deploy.sh prod --patients 100  # Production with 100 patients
./scripts/master-deploy.sh --patients=50 --production
```

## Deployment Process

### Phase 1: Environment Setup
1. [ ] Docker containers stopped and cleaned
2. [ ] Data directories created
3. [ ] Environment variables set
4. [ ] Docker images built

### Phase 2: Database Initialization
1. [ ] PostgreSQL container started
2. [ ] Database connection verified
3. [ ] FHIR schema created with 6 tables:
   - [ ] `fhir.resources` - Main resource storage
   - [ ] `fhir.resource_history` - Version tracking
   - [ ] `fhir.search_params` - Search indexes
   - [ ] `fhir.references` - Resource relationships
   - [ ] `fhir.compartments` - Patient compartments
   - [ ] `fhir.audit_logs` - Audit trail
4. [ ] CDS Hooks schema created
5. [ ] All indexes created

### Phase 3: Data Generation
1. [ ] Synthea setup completed
2. [ ] Patient data generated
3. [ ] FHIR bundles created
4. [ ] Data validated

### Phase 4: Data Import
1. [ ] FHIR resources imported
2. [ ] Search parameters extracted during import
3. [ ] Resource history initialized
4. [ ] References extracted

### Phase 5: Data Processing
1. [ ] Patient/provider names cleaned
2. [ ] Lab results enhanced
3. [ ] CDS hooks created
4. [ ] Search parameters re-indexed
5. [ ] URN format references fixed (for AllergyIntolerance, Condition, Observation, etc.)
6. [ ] Compartments populated
7. [ ] CDS hooks schema fixed
8. [ ] DICOM files generated

### Phase 6: System Configuration
1. [ ] Nginx configured
2. [ ] Frontend built and started
3. [ ] Static files served

### Phase 7: Validation
1. [ ] Database schema verified
2. [ ] FHIR API endpoints tested
3. [ ] Search functionality confirmed
4. [ ] All 6 FHIR tables populated
5. [ ] Services health checked

## Post-Deployment Verification

### Service Health
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Database Verification
```bash
# Verify all FHIR tables
docker exec emr-backend python scripts/verify_all_fhir_tables.py

# Check search parameters
docker exec emr-backend python scripts/monitor_search_params.py

# Manual table counts
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 'resources' as table_name, COUNT(*) FROM fhir.resources
UNION ALL SELECT 'search_params', COUNT(*) FROM fhir.search_params
UNION ALL SELECT 'compartments', COUNT(*) FROM fhir.compartments
UNION ALL SELECT 'resource_history', COUNT(*) FROM fhir.resource_history
UNION ALL SELECT 'references', COUNT(*) FROM fhir.references
UNION ALL SELECT 'audit_logs', COUNT(*) FROM fhir.audit_logs;"
```

### API Testing
```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Test FHIR metadata
curl http://localhost:8000/fhir/R4/metadata

# Test patient search
curl "http://localhost:8000/fhir/R4/Patient?_count=5"
```

### Frontend Access
- Main UI: http://localhost:3000
- API Docs: http://localhost:8000/docs
- FHIR API: http://localhost:8000/fhir/R4

### Default Credentials (Development)
- Username: demo / Password: password
- Username: nurse / Password: password
- Username: admin / Password: password

## Troubleshooting

### Common Issues

#### Missing Search Parameters
```bash
# Re-index all search parameters
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix

# Fix URN format references (if AllergyIntolerance or other resources not showing)
docker exec emr-backend python scripts/fix_allergy_intolerance_search_params_v2.py --docker

# Verify fix
docker exec emr-backend python scripts/monitor_search_params.py
```

#### Missing Compartments
```bash
# Populate compartments
docker exec emr-backend python scripts/populate_compartments.py

# Verify
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT COUNT(*) FROM fhir.compartments;"
```

#### CDS Hooks Errors
```bash
# Fix missing column
docker exec emr-backend python scripts/fix_cds_hooks_enabled_column.py
```

#### Port Conflicts
```bash
# Find processes using ports
lsof -i :80
lsof -i :3000
lsof -i :8000
lsof -i :5432

# Kill conflicting processes or change ports in docker-compose.yml
```

#### Docker Resource Issues
```bash
# Check Docker resources
docker system df

# Clean up if needed
docker system prune -a
```

## Maintenance Commands

### Daily Monitoring
```bash
# Check system health
docker exec emr-backend python scripts/verify_all_fhir_tables.py

# Monitor search parameters
docker exec emr-backend python scripts/monitor_search_params.py
```

### Data Management
```bash
# Generate more patients
docker exec emr-backend python scripts/active/synthea_master.py generate --count 10

# Wipe and regenerate
docker exec emr-backend python scripts/active/synthea_master.py wipe
docker exec emr-backend python scripts/active/synthea_master.py full --count 20
```

### Performance Optimization
```bash
# Update PostgreSQL statistics
docker exec emr-postgres psql -U emr_user -d emr_db -c "ANALYZE;"

# Vacuum database
docker exec emr-postgres psql -U emr_user -d emr_db -c "VACUUM ANALYZE;"
```

## Build Script Locations

All build scripts are modular and located in `/scripts/modules/`:
- `00-environment-setup.sh` - Docker and environment preparation
- `01-database-init.sh` - Database schema creation
- `02-data-generation.sh` - Synthea patient generation
- `03-data-import.sh` - FHIR resource import
- `04-data-processing.sh` - Data enhancement and indexing
- `05-nginx-config.sh` - Web server configuration
- `06-validation.sh` - Comprehensive validation

## Success Criteria

A successful deployment will have:
- ✅ All services running (postgres, backend, frontend)
- ✅ 6 FHIR tables created and accessible
- ✅ Patient data imported and searchable
- ✅ Search parameters indexed for all resources
- ✅ Compartments populated for Patient/$everything
- ✅ Frontend accessible at http://localhost:3000
- ✅ API responsive at http://localhost:8000
- ✅ No errors in validation scripts

## Notes

- The deployment process is idempotent - it can be run multiple times safely
- Search parameter indexing and compartment population are now automated
- The system includes self-healing capabilities for common issues
- All scripts include proper error handling and logging
- Production deployments should use JWT authentication (`JWT_ENABLED=true`)