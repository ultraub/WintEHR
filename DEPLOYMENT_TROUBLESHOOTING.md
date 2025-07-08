# MedGenEMR Deployment Troubleshooting Guide

This guide helps troubleshoot common deployment issues and provides solutions to prevent the problems we encountered.

## Quick Fixes Summary

### Problem: Missing `resource_history` Table
**Symptoms:**
- FHIR API returns 500 errors with "relation 'fhir.resource_history' does not exist"
- Patient creation fails
- Search functionality broken

**Root Cause:**
The `resource_history` table was not being created during Docker initialization.

**Solution Applied:**
1. ✅ Updated `init_complete.sql` to include `resource_history` table
2. ✅ Enhanced `start.sh` with database validation
3. ✅ Improved `fresh-deploy.sh` with comprehensive validation
4. ✅ Created `validate_deployment.py` for thorough testing

## Deployment Scripts Improvements

### Enhanced `start.sh`
**What we added:**
- Database connectivity validation before proceeding
- Schema validation with required table checking
- Fallback initialization if primary method fails
- Detailed error reporting with cleanup on failure

**Prevention:**
- No longer fails silently on database issues
- Validates critical tables exist before starting services
- Provides clear error messages for troubleshooting

### Enhanced `fresh-deploy.sh`
**What we added:**
- Comprehensive deployment validation using new script
- FHIR API endpoint testing
- Database schema verification
- Better error handling with container logs

**Prevention:**
- Catches deployment issues before data generation
- Validates entire stack is working before proceeding
- Provides verbose output for debugging

### New `validate_deployment.py`
**Comprehensive validation script that checks:**
- Database connectivity and schema
- All required tables and columns
- FHIR API endpoints and functionality
- Search parameter configuration
- Basic resource creation/retrieval

**Usage:**
```bash
# For local development
python scripts/validate_deployment.py --verbose

# For Docker deployment
docker-compose exec backend python scripts/validate_deployment.py --docker --verbose
```

## Common Issues and Solutions

### Issue: Database Not Accessible
**Symptoms:**
- Connection errors to PostgreSQL
- Backend fails to start
- Database validation errors

**Solutions:**
1. Check Docker containers: `docker-compose ps`
2. Verify PostgreSQL is healthy: `docker-compose logs postgres`
3. Wait for initialization: PostgreSQL may take time to initialize
4. Check database credentials in environment variables

### Issue: Backend Health Check Fails
**Symptoms:**
- `curl http://localhost:8000/health` returns errors
- Backend container exits or restarts
- Frontend can't connect to API

**Solutions:**
1. Check backend logs: `docker-compose logs backend`
2. Verify Python dependencies are installed
3. Check database connectivity from backend
4. Ensure correct environment variables are set

### Issue: Frontend Build Fails
**Symptoms:**
- Frontend container exits during build
- npm install errors
- Build process hangs or fails

**Solutions:**
1. Clear node_modules: `rm -rf frontend/node_modules`
2. Update npm: `docker-compose exec frontend npm install`
3. Check for syntax errors in React components
4. Verify all dependencies in package.json

### Issue: Search Functionality Not Working
**Symptoms:**
- Patient search returns empty results
- FHIR search parameters don't work
- Search boxes don't respond

**Solutions:**
1. Run database initialization: `docker-compose exec backend python scripts/init_database.py`
2. Check search parameters: `SELECT COUNT(*) FROM fhir.search_params`
3. Validate data exists: `SELECT COUNT(*) FROM fhir.resources`
4. Test FHIR API directly: `curl "http://localhost:8000/fhir/R4/Patient?_count=5"`

## Prevention Best Practices

### 1. Always Use Validation Scripts
```bash
# Before starting development
python scripts/validate_deployment.py --verbose

# After any schema changes
docker-compose exec backend python scripts/validate_deployment.py --docker
```

### 2. Check Logs Regularly
```bash
# Monitor all services
docker-compose logs -f

# Check specific service
docker-compose logs backend -f
docker-compose logs postgres -f
```

### 3. Use Clean Deployments
```bash
# Full clean deployment
./fresh-deploy.sh

# Quick restart with validation
docker-compose restart
python scripts/validate_deployment.py --docker
```

### 4. Verify Data Integrity
```bash
# Check resource counts
docker-compose exec backend python -c "
import asyncio, asyncpg
async def check():
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources WHERE deleted = false')
    print(f'Active resources: {count}')
    await conn.close()
asyncio.run(check())
"
```

## Quick Recovery Commands

### Full System Reset
```bash
# Stop everything
docker-compose down -v

# Clean up
docker system prune -f

# Fresh start
./fresh-deploy.sh
```

### Database Only Reset
```bash
# Stop and remove database
docker-compose stop postgres
docker-compose rm -f postgres
docker volume rm medgenemr_postgres_data

# Restart with fresh database
docker-compose up -d postgres
# Wait for initialization, then restart backend
docker-compose restart backend
```

### Backend Only Reset
```bash
# Restart backend with validation
docker-compose restart backend
docker-compose exec backend python scripts/validate_deployment.py --docker
```

## Development Workflow

### 1. Starting Development Session
```bash
# Check if system is running
docker-compose ps

# Start if needed
./start.sh

# Validate everything is working
python scripts/validate_deployment.py --verbose
```

### 2. Making Database Changes
```bash
# Test changes
docker-compose exec backend python scripts/init_database_definitive.py

# Validate schema
docker-compose exec backend python scripts/validate_deployment.py --docker

# Run full validation
python scripts/validate_deployment.py --verbose
```

### 3. Debugging Issues
```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs backend --tail=50

# Test API directly
curl -s http://localhost:8000/health | jq
curl -s "http://localhost:8000/fhir/R4/Patient?_count=1" | jq '.total'

# Validate deployment
python scripts/validate_deployment.py --verbose
```

## Environment-Specific Notes

### Local Development (start.sh)
- Uses local Python virtual environment
- Connects to localhost database
- Includes database validation
- Provides fallback initialization

### Docker Development (fresh-deploy.sh)
- Uses containerized services
- Includes comprehensive validation
- Generates test data automatically
- Provides container logs on failure

### Production Deployment
- Use enhanced validation before going live
- Monitor logs for any schema issues
- Run periodic health checks
- Keep database backups

## Contact and Support

If you encounter issues not covered here:
1. Check the logs first: `docker-compose logs -f`
2. Run validation script: `python scripts/validate_deployment.py --verbose`
3. Review recent changes to database schema or API endpoints
4. Check the main CLAUDE.md file for additional context

This troubleshooting guide ensures that future deployments will be much more reliable and issues will be caught early in the process.