#!/bin/bash

# EMR System AWS Update Script
# Updates existing deployment to production-ready-v1.0 with 100+ patients

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}EMR System AWS Update Script${NC}"
echo -e "${GREEN}============================${NC}"

# Configuration
GITHUB_REPO="https://github.com/ultraub/MedGenEMR.git"
BRANCH="production-ready-v1.0"
DEPLOYMENT_PROFILE="production"

# Step 1: Backup current data
echo -e "${YELLOW}Step 1: Backing up current data...${NC}"
sudo docker exec emr-backend sqlite3 /app/data/emr.db ".backup /app/data/backup_$(date +%Y%m%d_%H%M%S).db" || echo "Backup failed, continuing..."
sudo docker exec emr-backend ls -la /app/data/backup_*.db | tail -5

# Step 2: Stop current containers
echo -e "${YELLOW}Step 2: Stopping current containers...${NC}"
sudo docker stop emr-nginx emr-backend || true
sudo docker rm emr-nginx emr-backend || true

# Step 3: Clone or update repository
echo -e "${YELLOW}Step 3: Setting up repository...${NC}"
if [ -d "MedGenEMR" ]; then
    cd MedGenEMR
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
else
    git clone $GITHUB_REPO MedGenEMR
    cd MedGenEMR
    git checkout $BRANCH
fi

# Step 4: Copy deployment configuration
echo -e "${YELLOW}Step 4: Setting up deployment configuration...${NC}"
cat > deployment.config.json << 'EOF'
{
  "deployment_profiles": {
    "production": {
      "patient_count": 100,
      "provider_count": 20,
      "enable_clinical_notes": true,
      "enable_imaging": true,
      "enable_labs_with_ranges": true,
      "enable_cds_hooks": true,
      "enable_fhir": true,
      "database_type": "sqlite"
    }
  }
}
EOF

# Step 5: Create environment file
echo -e "${YELLOW}Step 5: Creating environment configuration...${NC}"
cat > .env << EOF
DEPLOYMENT_PROFILE=production
DATABASE_URL=sqlite:///./data/emr.db
SECRET_KEY=$(openssl rand -hex 32)
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
CORS_ORIGINS=*
REACT_APP_API_URL=
LOG_LEVEL=INFO
EOF

# Step 6: Build backend with production Dockerfile
echo -e "${YELLOW}Step 6: Building backend...${NC}"
cd backend

# Create a combined Dockerfile if production one doesn't exist
if [ ! -f "Dockerfile.production" ]; then
    cat > Dockerfile << 'DOCKERFILE'
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ git curl default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download Synthea
RUN curl -L https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar \
    -o synthea-with-dependencies.jar

# Create necessary directories
RUN mkdir -p data logs dicom_storage

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
DOCKERFILE
fi

# Build backend
sudo docker build -t emr-backend:production .

# Step 7: Build frontend
echo -e "${YELLOW}Step 7: Building frontend...${NC}"
cd ../frontend

# Fix API URL in production
sed -i 's|process.env.REACT_APP_API_URL === undefined ? "http://localhost:8000" : process.env.REACT_APP_API_URL|process.env.REACT_APP_API_URL || ""|g' src/services/api.js || true

# Build frontend
sudo docker run --rm \
    -v $(pwd):/app \
    -w /app \
    -e REACT_APP_API_URL="" \
    node:18-alpine \
    sh -c "npm install && npm run build"

# Step 8: Setup nginx
echo -e "${YELLOW}Step 8: Setting up nginx...${NC}"
cd ..

# Create nginx configuration
cat > nginx.conf << 'NGINX'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name _;
        
        root /usr/share/nginx/html;
        index index.html;

        # Frontend routes
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy
        location /api {
            proxy_pass http://emr-backend:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # FHIR proxy - direct routing (no /api prefix)
        location /fhir {
            proxy_pass http://emr-backend:8000/fhir;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # CDS Hooks proxy
        location /cds-hooks {
            proxy_pass http://emr-backend:8000/cds-hooks;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
NGINX

# Step 9: Create Docker network
echo -e "${YELLOW}Step 9: Creating Docker network...${NC}"
sudo docker network create emr-network || true

# Step 10: Start backend
echo -e "${YELLOW}Step 10: Starting backend...${NC}"
sudo docker run -d \
    --name emr-backend \
    --network emr-network \
    -v emr-data:/app/data \
    -v emr-logs:/app/logs \
    -e DATABASE_URL=sqlite:///./data/emr.db \
    -e SECRET_KEY=$(grep SECRET_KEY .env | cut -d= -f2) \
    -e CORS_ORIGINS="*" \
    emr-backend:production

# Wait for backend to be healthy
echo "Waiting for backend to start..."
for i in {1..30}; do
    if sudo docker exec emr-backend curl -f http://localhost:8000/api/health &>/dev/null; then
        echo -e "${GREEN}Backend is healthy!${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 5
done

# Step 11: Initialize data with 100+ patients
echo -e "${YELLOW}Step 11: Initializing data with 100+ patients...${NC}"

# Check if database already has data
PATIENT_COUNT=$(sudo docker exec emr-backend python -c "
from database.database import SessionLocal
from models.models import Patient
db = SessionLocal()
count = db.query(Patient).count()
print(count)
" 2>/dev/null || echo "0")

echo "Current patient count: $PATIENT_COUNT"

if [ "$PATIENT_COUNT" -lt "100" ]; then
    echo "Initializing with production data..."
    
    # Copy deployment config into container
    sudo docker cp deployment.config.json emr-backend:/app/
    
    # Run the unified deployment setup
    sudo docker exec emr-backend python scripts/unified_deployment_setup.py --profile production || {
        echo "Unified setup failed, trying manual setup..."
        # Fallback to manual setup
        sudo docker exec emr-backend python scripts/create_sample_providers.py
        sudo docker exec emr-backend python scripts/populate_clinical_catalogs.py
        sudo docker exec emr-backend python scripts/optimized_synthea_import.py --patients 100
        sudo docker exec emr-backend python scripts/add_reference_ranges.py
    }
else
    echo "Database already has $PATIENT_COUNT patients, skipping initialization"
fi

# Step 12: Start nginx
echo -e "${YELLOW}Step 12: Starting nginx...${NC}"
sudo docker run -d \
    --name emr-nginx \
    --network emr-network \
    -p 80:80 \
    -v $(pwd)/frontend/build:/usr/share/nginx/html:ro \
    -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
    nginx:alpine

# Step 13: Verify deployment
echo -e "${YELLOW}Step 13: Verifying deployment...${NC}"

# Check services
echo "Checking services..."
sudo docker ps | grep emr

# Check patient count
FINAL_COUNT=$(sudo docker exec emr-backend python -c "
from database.database import SessionLocal
from models.models import Patient
db = SessionLocal()
count = db.query(Patient).count()
print(count)
" 2>/dev/null || echo "0")

echo -e "${GREEN}Final patient count: $FINAL_COUNT${NC}"

# Check API health
echo "Checking API health..."
curl -f http://localhost/api/health || echo "API health check failed"

# Step 14: Show access information
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo -e "${GREEN}============================${NC}"
echo -e "${GREEN}Update Complete!${NC}"
echo -e "${GREEN}============================${NC}"
echo -e "${GREEN}Access the system at: http://$PUBLIC_IP${NC}"
echo -e "${GREEN}Patient count: $FINAL_COUNT${NC}"
echo -e "${GREEN}============================${NC}"

# Save update log
cat > update-log-$(date +%Y%m%d_%H%M%S).txt << LOG
EMR System Update Log
====================
Date: $(date)
Branch: $BRANCH
Previous Patients: $PATIENT_COUNT
Final Patients: $FINAL_COUNT
Public IP: $PUBLIC_IP
LOG

echo -e "${YELLOW}Update log saved${NC}"