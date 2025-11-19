# PostgreSQL Initialization Scripts

**Purpose**: Automatically initialize database schemas and tables during PostgreSQL container startup

---

## How It Works

### Automatic Execution
These scripts are automatically executed by the PostgreSQL Docker container on **first startup**:

1. `docker-compose up` starts the `postgres` service
2. PostgreSQL executes all `.sql` files in `/docker-entrypoint-initdb.d/` (this directory)
3. Scripts run in alphabetical order
4. Execution happens **only once** - when the database volume is first created

### Script Execution Order

| Script | Purpose | Status |
|--------|---------|--------|
| `01-init-wintehr.sql` | Main WintEHR schema and tables | ✅ Active |
| `05_external_services.sql` | External service registry | ✅ Active |
| `06_cds_visual_builder.sql` | CDS Visual Builder schema | ✅ Active |

---

## CDS Visual Builder Schema (06_cds_visual_builder.sql)

**Created**: 2025-10-19
**Last Updated**: 2025-11-19

### What It Creates
- **Schema**: `cds_visual_builder`
- **Tables**:
  - `service_configs` - Visual CDS service configurations
  - `service_versions` - Version history
  - `service_analytics` - Performance metrics
  - `execution_logs` - Execution debugging logs
- **Triggers**: Auto-update timestamps, auto-increment versions
- **Indexes**: Optimized lookups for service discovery

### Important Notes
⚠️ **This is the authoritative schema definition** - the Python SQLAlchemy model MUST match this schema

📚 **Full Documentation**: See `backend/api/cds_hooks/VISUAL_BUILDER_SCHEMA.md`

---

## Adding New Initialization Scripts

### Step 1: Create SQL File
```bash
# Use sequential numbering
touch postgres-init/07_my_new_feature.sql
```

### Step 2: Write SQL
```sql
-- 07_my_new_feature.sql
CREATE SCHEMA IF NOT EXISTS my_schema;

CREATE TABLE IF NOT EXISTS my_schema.my_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'My new feature schema created successfully';
END
$$;
```

### Step 3: Test on Fresh Database
```bash
# Stop and remove volumes
docker-compose down -v

# Restart (scripts will run)
docker-compose up -d

# Check logs
docker logs emr-postgres | grep "my_new_feature"
```

### Step 4: Migrate Existing Deployments
```bash
# For existing systems, run manually
docker exec emr-postgres psql -U emr_user -d emr_db -f /docker-entrypoint-initdb.d/07_my_new_feature.sql
```

---

## Troubleshooting

### Scripts Not Running
**Symptom**: New `.sql` file not executed

**Cause**: Database volume already exists

**Solution**:
```bash
# Option 1: Fresh start (destroys data)
docker-compose down -v
docker-compose up -d

# Option 2: Manual execution (preserves data)
docker exec emr-postgres psql -U emr_user -d emr_db -f /docker-entrypoint-initdb.d/YOUR_SCRIPT.sql
```

### Schema Already Exists Error
**Symptom**: `ERROR: schema "..." already exists`

**Solution**: Use `CREATE SCHEMA IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` in scripts

### Permission Errors
**Symptom**: `ERROR: permission denied for schema`

**Solution**: Grant permissions at end of script:
```sql
GRANT USAGE ON SCHEMA my_schema TO emr_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA my_schema TO emr_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA my_schema TO emr_user;
```

---

## Verification

### Check Schemas
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "\dn"
```

### Check Tables
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "\dt cds_visual_builder.*"
```

### Check Script Execution
```bash
# View PostgreSQL logs
docker logs emr-postgres | grep "NOTICE"

# Should show messages like:
# NOTICE: CDS Visual Builder schema created successfully
```

---

## Best Practices

### 1. Idempotent Scripts
Always use `IF NOT EXISTS`:
```sql
CREATE SCHEMA IF NOT EXISTS my_schema;
CREATE TABLE IF NOT EXISTS my_schema.my_table (...);
```

### 2. Sequential Numbering
Use zero-padded numbers for proper ordering:
- `01_init.sql`
- `05_external.sql`
- `06_visual_builder.sql`
- `07_new_feature.sql`

### 3. Success Messages
Add NOTICE at end of script:
```sql
DO $$
BEGIN
    RAISE NOTICE 'Feature initialized successfully';
END
$$;
```

### 4. Grant Permissions
Always grant to `emr_user`:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA my_schema TO emr_user;
```

### 5. Document Schema
Create corresponding documentation:
- `backend/api/MODULE/SCHEMA_NAME.md`

---

## Migration Workflow

### For New Deployments
1. Add `.sql` file to `postgres-init/`
2. Scripts run automatically on first startup
3. No manual intervention needed

### For Existing Deployments
1. Add `.sql` file to `postgres-init/`
2. Run migration manually:
   ```bash
   docker exec emr-postgres psql -U emr_user -d emr_db \
     -f /docker-entrypoint-initdb.d/07_new_feature.sql
   ```
3. Verify with `\dt schema.*`
4. Update deployment documentation

---

## Schema Synchronization

### Problem: Model-Schema Mismatch
**Date Discovered**: 2025-11-19
**Issue**: Python SQLAlchemy models didn't match SQL schema

**Prevention**:
1. ✅ SQL migration is source of truth
2. ✅ Update Python models to match SQL
3. ✅ Document schema in dedicated .md file
4. ✅ Test endpoints after schema changes

**See**: `backend/api/cds_hooks/VISUAL_BUILDER_SCHEMA.md` for full analysis

---

## References

- **Docker Compose**: `docker-compose.yml` (mounts this directory)
- **PostgreSQL Image**: Official postgres image handles `/docker-entrypoint-initdb.d/`
- **Schema Docs**: `backend/api/*/SCHEMA_*.md` files
- **Architecture**: `claudedocs/CDS_HOOKS_ARCHITECTURE_ANALYSIS.md`

---

**Last Updated**: 2025-11-19
