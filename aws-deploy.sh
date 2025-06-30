#!/bin/bash
# AWS Deployment Script for EMR System

set -e

echo "EMR System AWS Deployment"
echo "========================"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo yum update -y
    sudo yum install -y docker git
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    echo "Docker installed. Please log out and back in, then run this script again."
    exit 0
fi

# Clone repository
if [ ! -d "/opt/EMR" ]; then
    echo "Cloning repository..."
    sudo git clone https://github.com/your-repo/EMR.git /opt/EMR
    sudo chown -R ec2-user:ec2-user /opt/EMR
fi

cd /opt/EMR

# Create docker-compose.production.yml
cat > docker-compose.production.yml << 'EOF'
version: '3.8'

services:
  emr-backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: emr-backend
    volumes:
      - ./backend/data:/app/data
    environment:
      - PYTHONUNBUFFERED=1
      - DATABASE_URL=sqlite:////app/data/emr.db
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  emr-nginx:
    image: nginx:alpine
    container_name: emr-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend/build:/usr/share/nginx/html:ro
    depends_on:
      - emr-backend
EOF

# Create Dockerfile.backend
cat > Dockerfile.backend << 'EOF'
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc curl wget default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Ensure scripts are executable
RUN chmod +x scripts/*.sh scripts/*.py

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# Create nginx.conf
cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }
    
    location /api/ {
        proxy_pass http://emr-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /fhir/ {
        proxy_pass http://emr-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /cds-hooks/ {
        proxy_pass http://emr-backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /docs {
        proxy_pass http://emr-backend:8000/docs;
        proxy_set_header Host $host;
    }
    
    location /openapi.json {
        proxy_pass http://emr-backend:8000/openapi.json;
        proxy_set_header Host $host;
    }
}
EOF

# Fix main.py CORS
echo "Configuring CORS..."
sed -i 's/allow_origins=\[[^]]*\]/allow_origins=["*"]/' backend/main.py

# Build frontend
echo "Building frontend..."
cd frontend
npm install

# Fix api.js to use relative URLs in production
echo "Fixing frontend API configuration..."
cat > src/services/api.js << 'EOF'
import axios from 'axios';

// Use relative URLs when deployed (no localhost)
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
EOF

# Build with proper environment variable
REACT_APP_API_URL="" npm run build
cd ..

# Start services
echo "Starting services..."
docker-compose -f docker-compose.production.yml up -d --build

# Wait for services
echo "Waiting for services to start..."
sleep 30

# Import data if needed
PATIENT_COUNT=$(docker exec emr-backend python3 -c "
from database.database import SessionLocal
from models.synthea_models import Patient
print(SessionLocal().query(Patient).count())
" 2>/dev/null || echo "0")

if [ "$PATIENT_COUNT" -eq "0" ]; then
    echo "Importing sample data..."
    docker exec emr-backend bash -c "
        cd scripts && 
        python optimized_comprehensive_setup.py --patients 25 &&
        python add_clinical_notes.py
    "
fi

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

# Final checks
echo ""
echo "Deployment Status"
echo "================"
curl -s http://localhost/api/health | grep -q "healthy" && echo "✓ API is healthy" || echo "✗ API health check failed"
curl -s http://localhost/fhir/R4/metadata | grep -q "CapabilityStatement" && echo "✓ FHIR API is working" || echo "✗ FHIR API check failed"
curl -s http://localhost/cds-hooks/ | grep -q "services" && echo "✓ CDS Hooks are working" || echo "✗ CDS Hooks check failed"

echo ""
echo "Deployment complete!"
echo "==================="
echo ""
echo "Access your EMR at: http://$PUBLIC_IP"
echo ""
echo "To view logs: docker-compose -f docker-compose.production.yml logs -f"
echo "To stop: docker-compose -f docker-compose.production.yml down"