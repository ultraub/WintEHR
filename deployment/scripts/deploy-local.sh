#!/bin/bash

# Simplified Local Deployment Script for MedGenEMR
# This script handles all the common deployment issues we've encountered

set -e

echo "🏥 MedGenEMR Local Deployment Script"
echo "===================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Function to wait for container to be healthy
wait_for_health() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $container to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec $container curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo "✅ $container is healthy!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $container failed to become healthy"
    return 1
}

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down 2>/dev/null || true

# Build frontend first
echo "📦 Building frontend..."
cd frontend
npm install
REACT_APP_API_URL="" npm run build
cd ..

# Update requirements.txt to fix pandas version issue
echo "🔧 Fixing Python dependencies..."
sed -i.bak 's/pandas==2.1.3/pandas>=2.2.0/g' backend/requirements.txt

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for backend to be healthy
wait_for_health emr-backend

# Initialize database
echo "💾 Initializing database..."

# Create providers
echo "👨‍⚕️ Creating sample providers..."
docker exec emr-backend python scripts/create_sample_providers.py || echo "Providers may already exist"

# Populate clinical catalogs
echo "📋 Populating clinical catalogs..."
docker exec emr-backend python scripts/populate_clinical_catalogs.py

# Install faker in the container for patient generation
echo "📦 Installing required packages..."
docker exec emr-backend pip install faker

# Create sample patients
echo "👥 Creating sample patients..."
docker exec emr-backend python scripts/create_sample_patients.py 25

# Add reference ranges
echo "📊 Adding reference ranges..."
docker exec emr-backend python scripts/add_reference_ranges.py || echo "Reference ranges may already exist"

echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "🌐 Access the system at:"
echo "   EMR Application: http://localhost"
echo "   API Documentation: http://localhost:8000/docs"
echo ""
echo "📝 Login credentials:"
echo "   Check the providers in the database"
echo "   Default password: password123"
echo ""
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: docker-compose up -d"
echo ""