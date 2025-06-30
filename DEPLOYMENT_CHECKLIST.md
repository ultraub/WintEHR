# EMR System Deployment Checklist

## Pre-Deployment Verification

### System Requirements
- [ ] Python 3.8+ (NOT 3.7 - will fail with FastAPI/Pydantic v2)
- [ ] Node.js 16+ (18+ recommended)
- [ ] Java 8+ (for Synthea)
- [ ] Minimum 4GB RAM
- [ ] 30GB disk space

### Repository Checks
- [ ] All shell scripts have Unix line endings (LF not CRLF)
- [ ] `backend/api/app/schemas.py` has `from __future__ import annotations`
- [ ] All Dockerfiles use `npm install` NOT `npm ci`
- [ ] File permissions are correct (scripts executable)

## Deployment Methods

### 1. Quick Local Development
```bash
./quickstart.sh
```

### 2. Full Local Setup
```bash
./setup-complete.sh
```

### 3. Docker Deployment
```bash
./setup-complete.sh --docker
```

### 4. AWS EC2 Deployment
```bash
# On EC2 instance
curl -O https://raw.githubusercontent.com/your-repo/EMR/master/deploy-ec2-simple.sh
chmod +x deploy-ec2-simple.sh
./deploy-ec2-simple.sh
```

## Common Issues & Solutions

### 1. Python Version Issues
**Symptom**: Import errors, syntax errors, or "Python 3.8+ required"
**Solution**: 
- Use Docker deployment: `./setup-complete.sh --docker`
- Or upgrade Python to 3.8+

### 2. npm Lock File Errors
**Symptom**: `npm ci can only install packages when package.json and package-lock.json are in sync`
**Solution**:
- Delete `package-lock.json`
- Use `npm install` instead of `npm ci`
- All updated scripts now use `npm install`

### 3. Docker Build Context Errors
**Symptom**: `failed to compute cache key` during Docker build
**Solution**:
- Use `Dockerfile.standalone.fixed`
- Ensure correct build context (no EMR/ prefix in COPY commands)
- Build from repository root, not subdirectory

### 4. 500 Internal Server Error
**Symptom**: Nginx returns 500 error
**Checks**:
```bash
# Check backend logs
docker logs emr-backend
# or
tail -f backend/logs/backend.log

# Check backend health
curl http://localhost:8000/health

# Check database exists
ls -la backend/data/emr.db

# Check permissions
ls -la backend/data/
```

### 5. Frontend Not Loading Data
**Symptom**: Empty clinical workspace
**Solution**:
```bash
# Initialize database
cd backend
source venv/bin/activate
python scripts/create_sample_providers.py
python scripts/populate_clinical_catalogs.py
python scripts/optimized_synthea_import.py --patients 25
```

### 6. EC2 Specific Issues

#### Python 3.7 on Amazon Linux 2
**Problem**: AL2 only has Python 3.7
**Solution**: Use Docker for backend:
```bash
docker run -d \
  --name emr-backend \
  -p 8000:8000 \
  -v $(pwd)/backend:/app \
  -w /app \
  python:3.9-slim \
  bash -c "pip install -r requirements.txt && python main.py"
```

#### Nginx Configuration
**File**: `/etc/nginx/conf.d/emr.conf`
```nginx
server {
    listen 80;
    server_name _;
    
    location ~ ^/(api|fhir|docs|openapi.json|redoc) {
        proxy_pass http://localhost:8000;
    }
    
    location / {
        root /home/ec2-user/EMR/frontend/build;
        try_files $uri /index.html;
    }
}
```

## Post-Deployment Verification

### Health Checks
```bash
# Backend API
curl http://localhost:8000/health
curl http://localhost:8000/api/health

# Frontend
curl http://localhost:3000

# Database
curl http://localhost:8000/api/patients
```

### Check Logs
```bash
# Backend
tail -f backend/logs/backend.log

# Docker
docker logs -f emr-backend

# Nginx (on EC2)
sudo tail -f /var/log/nginx/error.log
```

### Verify Data
1. Check provider count: Should have sample providers
2. Check patient count: Should match --patients parameter
3. Check clinical catalogs: Medications and diagnoses populated
4. Check reference ranges: Lab values have normal ranges

## Production Checklist

### Security
- [ ] Change default passwords
- [ ] Configure HTTPS (use ALB or nginx SSL)
- [ ] Restrict security groups to known IPs
- [ ] Enable CloudWatch logging
- [ ] Rotate any exposed secrets

### Performance
- [ ] Use production build for frontend: `npm run build`
- [ ] Enable nginx caching
- [ ] Configure appropriate instance size (t3.medium minimum)
- [ ] Set up CloudWatch alarms

### Backup
- [ ] Schedule EBS snapshots
- [ ] Backup SQLite database regularly
- [ ] Document restore procedures

## Troubleshooting Commands

```bash
# Check all running processes
ps aux | grep -E "python|node|java"

# Check port usage
sudo lsof -i :8000
sudo lsof -i :3000
sudo lsof -i :80

# Check disk space
df -h

# Check memory
free -m

# Restart everything
docker-compose down && docker-compose up -d
# or
pkill -f "python main.py" && pkill -f "npm start"
./setup-complete.sh

# Clean Docker resources
docker system prune -a

# Reset database
rm -f backend/data/emr.db
cd backend && python scripts/create_sample_providers.py
```

## Contact for Issues

If you encounter issues not covered here:
1. Check the logs first
2. Review this checklist
3. Create an issue with:
   - Error messages
   - Deployment method used
   - System information
   - Steps to reproduce