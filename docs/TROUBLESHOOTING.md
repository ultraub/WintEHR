# WintEHR Troubleshooting Guide

**Version**: 1.0.0  
**Last Updated**: 2025-08-06

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Deployment Issues](#deployment-issues)
- [Database Issues](#database-issues)
- [Frontend Issues](#frontend-issues)
- [Backend Issues](#backend-issues)
- [FHIR API Issues](#fhir-api-issues)
- [Performance Issues](#performance-issues)
- [Data Import Issues](#data-import-issues)
- [Authentication Issues](#authentication-issues)
- [Recovery Procedures](#recovery-procedures)

## Quick Diagnostics

### System Health Check
```bash
# Check all services status
docker-compose ps

# Quick health check
curl http://localhost:8000/health/status

# Check logs for errors
docker-compose logs --tail=50 | grep -i error

# Database connectivity
docker exec emr-backend python -c "from database import check_connection; check_connection()"

# Redis connectivity
docker exec emr-backend python -c "import redis; r = redis.Redis(host='redis'); print(r.ping())"
```

### Resource Usage Check
```bash
# Docker resource usage
docker stats --no-stream

# Disk space
df -h

# Database size
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT pg_database_size('emr_db')/1024/1024 as size_mb;"
```

## Common Issues

### Issue: Services Won't Start

**Symptoms:**
- `docker-compose up` fails
- Containers exit immediately
- Port already in use errors

**Solutions:**
```bash
# 1. Check for port conflicts
lsof -i :80
lsof -i :8000
lsof -i :5432

# 2. Stop conflicting services
sudo service postgresql stop  # If local PostgreSQL is running
sudo service nginx stop       # If local Nginx is running

# 3. Clean Docker environment
docker-compose down
docker system prune -a
docker volume prune

# 4. Restart Docker Desktop
# On macOS: Quit and restart Docker Desktop
# On Linux: sudo systemctl restart docker

# 5. Rebuild containers
docker-compose build --no-cache
docker-compose up
```

### Issue: Cannot Access Application

**Symptoms:**
- Browser shows "Cannot connect"
- 502 Bad Gateway error
- Connection refused

**Solutions:**
```bash
# 1. Verify services are running
docker-compose ps
# All services should show "Up" status

# 2. Check nginx configuration
docker exec emr-nginx nginx -t

# 3. Verify backend is responding
curl http://localhost:8000/health/live

# 4. Check frontend build
docker exec emr-frontend ls -la /usr/share/nginx/html

# 5. Restart services
docker-compose restart

# 6. Check firewall rules (Linux)
sudo iptables -L
sudo ufw status
```

### Issue: Slow Performance

**Symptoms:**
- Pages load slowly
- API requests timeout
- High CPU/memory usage

**Solutions:**
```bash
# 1. Check resource usage
docker stats

# 2. Increase Docker resources
# Docker Desktop > Preferences > Resources
# Increase CPUs to 4+
# Increase Memory to 8GB+

# 3. Optimize database
docker exec emr-postgres psql -U emr_user -d emr_db -c "VACUUM ANALYZE;"

# 4. Clear Redis cache
docker exec emr-redis redis-cli FLUSHALL

# 5. Check for slow queries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 5;"

# 6. Scale services
docker-compose up --scale backend=3
```

## Deployment Issues

### Issue: Deployment Script Fails

**Symptoms:**
- `./deploy.sh` exits with error
- Database initialization fails
- Patient data not loading

**Solutions:**
```bash
# 1. Check script permissions
chmod +x deploy.sh

# 2. Run with verbose output
bash -x ./deploy.sh dev --patients 20

# 3. Check Docker daemon
docker version
docker-compose version

# 4. Manual deployment steps
docker-compose down -v
docker-compose up -d postgres
sleep 10
docker exec emr-backend python scripts/setup/init_database_definitive.py
docker exec emr-backend python scripts/active/synthea_master.py full --count 20
docker-compose up -d
```

### Issue: AWS Deployment Errors

**Symptoms:**
- EC2 instance issues
- Security group problems
- RDS connection failures

**Solutions:**
```bash
# 1. Verify AWS credentials
aws sts get-caller-identity

# 2. Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# 3. Test RDS connectivity
docker exec emr-backend python -c "
import psycopg2
conn = psycopg2.connect(
    host='your-rds-endpoint.amazonaws.com',
    database='emr_db',
    user='emr_user',
    password='password'
)
print('Connected!')
conn.close()"

# 4. Check EC2 instance logs
aws ec2 get-console-output --instance-id i-xxxxx
```

## Database Issues

### Issue: Database Connection Failed

**Symptoms:**
- "could not connect to database" error
- "FATAL: password authentication failed"
- Connection timeout

**Solutions:**
```bash
# 1. Check PostgreSQL is running
docker-compose ps postgres
docker-compose logs postgres

# 2. Verify credentials
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT 1;"

# 3. Reset database
docker-compose down -v
docker volume rm wintehr_postgres_data
docker-compose up -d postgres
docker exec emr-backend python scripts/setup/init_database_definitive.py

# 4. Check connection string
docker exec emr-backend python -c "
from config import settings
print(settings.database_url)"
```

### Issue: Missing FHIR Tables

**Symptoms:**
- "relation does not exist" errors
- Search parameters not working
- Patient compartments empty

**Solutions:**
```bash
# 1. Verify tables exist
docker exec emr-postgres psql -U emr_user -d emr_db -c "\dt fhir.*"

# 2. Recreate FHIR schema
docker exec emr-backend python scripts/setup/init_database_definitive.py

# 3. Verify all 6 tables
docker exec emr-backend python scripts/testing/verify_all_fhir_tables.py

# 4. Re-index search parameters
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index

# 5. Populate compartments
docker exec emr-backend python scripts/setup/populate_compartments.py
```

### Issue: Database Disk Full

**Symptoms:**
- "could not extend file" errors
- Write operations failing
- Database becoming read-only

**Solutions:**
```bash
# 1. Check disk usage
df -h
docker system df

# 2. Clean up old data
docker exec emr-postgres psql -U emr_user -d emr_db -c "
DELETE FROM fhir.resource_history 
WHERE created_at < NOW() - INTERVAL '30 days';"

# 3. Vacuum database
docker exec emr-postgres psql -U emr_user -d emr_db -c "VACUUM FULL;"

# 4. Clean Docker resources
docker system prune -a --volumes

# 5. Increase disk space or move to larger volume
```

## Frontend Issues

### Issue: Blank Page or Loading Forever

**Symptoms:**
- White screen
- Spinner never stops
- No error messages

**Solutions:**
```javascript
// 1. Check browser console for errors
// Press F12 > Console tab

// 2. Verify API connectivity
fetch('http://localhost:8000/health/live')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);

// 3. Check localStorage for corrupted data
localStorage.clear();
location.reload();

// 4. Verify environment variables
console.log(process.env.REACT_APP_API_URL);
```

```bash
# 5. Rebuild frontend
docker-compose stop frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Issue: CORS Errors

**Symptoms:**
- "Access-Control-Allow-Origin" errors
- "CORS policy" blocked requests
- API calls failing

**Solutions:**
```bash
# 1. Check backend CORS settings
docker exec emr-backend python -c "
from config import settings
print(settings.cors_origins)"

# 2. Update CORS configuration
# Edit backend/config.py
CORS_ORIGINS = ["http://localhost:3000", "http://localhost"]

# 3. Restart backend
docker-compose restart backend

# 4. Use proxy in development
# Edit frontend/package.json
"proxy": "http://localhost:8000"
```

### Issue: Components Not Rendering

**Symptoms:**
- Missing UI elements
- Broken layout
- Style issues

**Solutions:**
```bash
# 1. Check for JavaScript errors
# Browser console (F12)

# 2. Verify component imports
grep -r "import.*from" frontend/src/components/

# 3. Check Material-UI installation
docker exec emr-frontend npm list @mui/material

# 4. Rebuild node_modules
docker exec emr-frontend rm -rf node_modules
docker exec emr-frontend npm install

# 5. Clear build cache
docker exec emr-frontend npm run clean
docker exec emr-frontend npm run build
```

## Backend Issues

### Issue: API Returns 500 Errors

**Symptoms:**
- Internal server error responses
- Stack traces in logs
- Intermittent failures

**Solutions:**
```bash
# 1. Check backend logs
docker-compose logs --tail=100 backend

# 2. Enable debug mode
docker exec emr-backend python -c "
from config import settings
settings.debug = True"

# 3. Test specific endpoint
curl -X GET http://localhost:8000/api/health/status

# 4. Check database connectivity
docker exec emr-backend python -c "
from database import get_db
import asyncio
async def test():
    async with get_db() as db:
        result = await db.execute('SELECT 1')
        print(result.scalar())
asyncio.run(test())"

# 5. Restart backend with verbose logging
docker-compose stop backend
docker-compose run -e LOG_LEVEL=DEBUG backend
```

### Issue: WebSocket Connection Fails

**Symptoms:**
- "WebSocket connection failed"
- Real-time updates not working
- Socket.io errors

**Solutions:**
```javascript
// 1. Test WebSocket manually
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Error:', e);
```

```bash
# 2. Check WebSocket logs
docker-compose logs backend | grep -i websocket

# 3. Verify nginx WebSocket proxy
docker exec emr-nginx cat /etc/nginx/nginx.conf | grep -A5 "location /ws"

# 4. Test with wscat
npm install -g wscat
wscat -c ws://localhost:8000/ws
```

## FHIR API Issues

### Issue: FHIR Search Returns Empty

**Symptoms:**
- Search queries return no results
- Patient compartment empty
- Missing search parameters

**Solutions:**
```bash
# 1. Verify resources exist
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) 
FROM fhir.resources 
GROUP BY resource_type;"

# 2. Check search parameters
docker exec emr-backend python scripts/testing/verify_search_params_after_import.py

# 3. Re-index search parameters
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix

# 4. Test specific search
curl "http://localhost:8000/fhir/R4/Patient?name=Smith"

# 5. Check for URN reference issues
docker exec emr-backend python scripts/setup/fix_allergy_intolerance_search_params_v2.py
```

### Issue: FHIR Validation Errors

**Symptoms:**
- "Invalid FHIR resource" errors
- Schema validation failures
- Missing required fields

**Solutions:**
```python
# 1. Validate resource structure
from fhir.resources.patient import Patient

try:
    patient = Patient.parse_obj(resource_data)
    print("Valid FHIR resource")
except Exception as e:
    print(f"Validation error: {e}")

# 2. Check resource requirements
# Ensure resourceType field is present
# Ensure id is not included in POST requests
# Ensure meta.versionId is not modified
```

```bash
# 3. Test with FHIR validator
curl -X POST http://localhost:8000/fhir/R4/Patient/$validate \
  -H "Content-Type: application/fhir+json" \
  -d @patient.json
```

## Performance Issues

### Issue: Slow FHIR Queries

**Symptoms:**
- Search operations timeout
- Bundle operations slow
- High database CPU usage

**Solutions:**
```bash
# 1. Analyze slow queries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC;"

# 2. Check missing indexes
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'fhir'
AND n_distinct > 100;"

# 3. Optimize indexes
docker exec emr-backend python scripts/setup/optimize_database_indexes.py

# 4. Increase work_mem for complex queries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
ALTER SYSTEM SET work_mem = '256MB';
SELECT pg_reload_conf();"
```

### Issue: High Memory Usage

**Symptoms:**
- Container killed (OOM)
- Swap usage high
- System becoming unresponsive

**Solutions:**
```bash
# 1. Check memory usage
docker stats --no-stream

# 2. Limit container memory
# Edit docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G

# 3. Optimize Python memory
# Use generators instead of lists
# Clear caches periodically
# Use connection pooling

# 4. Monitor memory leaks
docker exec emr-backend pip install memory_profiler
docker exec emr-backend python -m memory_profiler your_script.py
```

## Data Import Issues

### Issue: Synthea Import Fails

**Symptoms:**
- "No such file or directory" errors
- Import stuck or hanging
- Partial data import

**Solutions:**
```bash
# 1. Check Synthea output
ls -la output/fhir/

# 2. Verify Java installation (for Synthea)
java -version

# 3. Generate fresh data
cd synthea
./run_synthea -p 10

# 4. Import manually
docker exec emr-backend python scripts/active/synthea_master.py import --count 10

# 5. Check import logs
tail -f backend/scripts/logs/synthea_master.log

# 6. Verify import progress
cat backend/scripts/synthea_import_progress.json
```

### Issue: DICOM Generation Fails

**Symptoms:**
- No DICOM files created
- ImagingStudy resources without images
- DICOM viewer showing errors

**Solutions:**
```bash
# 1. Check for ImagingStudy resources
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'ImagingStudy';"

# 2. Generate DICOM files
docker exec emr-backend python scripts/active/generate_dicom_for_studies.py

# 3. Verify DICOM files
docker exec emr-backend ls -la /data/dicom/

# 4. Check DICOM metadata
docker exec emr-backend python -c "
import pydicom
ds = pydicom.dcmread('/data/dicom/study_1/series_1/instance_1.dcm')
print(ds.PatientName, ds.StudyDate)"

# 5. Fix permissions
docker exec emr-backend chmod -R 755 /data/dicom/
```

## Authentication Issues

### Issue: Cannot Login

**Symptoms:**
- "Invalid credentials" error
- JWT token errors
- Session expired immediately

**Solutions:**
```bash
# 1. Verify JWT is disabled for development
docker exec emr-backend python -c "
from config import settings
print(f'JWT Enabled: {settings.jwt_enabled}')"

# 2. Check default users
# demo/password, nurse/password, admin/password

# 3. Reset authentication
docker-compose restart backend

# 4. Clear browser data
# Clear cookies and localStorage for localhost

# 5. Test authentication directly
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"password"}'
```

### Issue: JWT Token Expired

**Symptoms:**
- 401 Unauthorized after some time
- "Token expired" errors
- Need to login repeatedly

**Solutions:**
```javascript
// 1. Implement token refresh
const refreshToken = async () => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    }
  });
  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
};

// 2. Auto-refresh before expiry
setInterval(refreshToken, 50 * 60 * 1000); // Refresh every 50 minutes
```

```bash
# 3. Increase token expiry
# Edit backend/config.py
JWT_EXPIRY = 7200  # 2 hours

# 4. Restart backend
docker-compose restart backend
```

## Recovery Procedures

### Complete System Reset
```bash
#!/bin/bash
# save as reset-system.sh

echo "⚠️  This will delete all data. Continue? (y/n)"
read confirm
if [ "$confirm" != "y" ]; then exit 1; fi

# Stop all services
docker-compose down -v

# Remove all volumes
docker volume rm $(docker volume ls -q | grep wintehr)

# Clean Docker system
docker system prune -a --volumes -f

# Rebuild everything
docker-compose build --no-cache

# Start fresh
./deploy.sh dev --patients 20

echo "✅ System reset complete"
```

### Database Recovery
```bash
#!/bin/bash
# save as recover-database.sh

# 1. Backup current state (if possible)
docker exec emr-postgres pg_dump -U emr_user emr_db > backup_$(date +%Y%m%d).sql

# 2. Stop backend services
docker-compose stop backend frontend

# 3. Restore from backup
docker exec -i emr-postgres psql -U emr_user -d emr_db < last_known_good.sql

# 4. Re-index search parameters
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index

# 5. Verify data integrity
docker exec emr-backend python scripts/testing/validate_fhir_data.py

# 6. Restart services
docker-compose up -d

echo "✅ Database recovery complete"
```

### Emergency Diagnostics
```bash
#!/bin/bash
# save as diagnose.sh

echo "=== System Diagnostics ==="
echo "Date: $(date)"
echo ""

echo "=== Docker Status ==="
docker version
docker-compose version
docker system df
echo ""

echo "=== Service Status ==="
docker-compose ps
echo ""

echo "=== Resource Usage ==="
docker stats --no-stream
echo ""

echo "=== Recent Errors ==="
docker-compose logs --tail=20 | grep -i error
echo ""

echo "=== Database Status ==="
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
  (SELECT COUNT(*) FROM fhir.resources) as resources,
  (SELECT COUNT(*) FROM fhir.search_params) as search_params,
  (SELECT COUNT(DISTINCT compartment_id) FROM fhir.compartments) as patients,
  pg_database_size('emr_db')/1024/1024 as db_size_mb;"
echo ""

echo "=== API Health ==="
curl -s http://localhost:8000/health/status | python -m json.tool
echo ""

echo "=== Disk Usage ==="
df -h
echo ""

echo "Diagnostics complete. Check output above for issues."
```

## Getting Help

### Log Collection for Support
```bash
# Collect all logs for support ticket
docker-compose logs > support_logs.txt
docker exec emr-backend cat /var/log/app.log >> support_logs.txt
docker exec emr-postgres psql -U emr_user -d emr_db -c "\d+ fhir.*" >> support_logs.txt

# Create support bundle
tar -czf support_bundle.tar.gz support_logs.txt docker-compose.yml .env
```

### Useful Commands Reference
```bash
# Service management
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose restart        # Restart all services
docker-compose logs -f        # Follow logs

# Database queries
docker exec emr-postgres psql -U emr_user -d emr_db  # SQL prompt
docker exec emr-backend python                        # Python prompt

# File management
docker cp file.json emr-backend:/tmp/        # Copy file to container
docker exec emr-backend cat /path/to/file    # View file in container

# Network debugging
docker network ls                             # List networks
docker port emr-backend                       # Show port mappings
```

---

Built with ❤️ for the healthcare community.