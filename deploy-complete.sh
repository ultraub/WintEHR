#!/bin/bash

# Complete Deployment Script for MedGenEMR with Synthea
# This script deploys the entire system with realistic patient data

set -e

echo "🏥 MedGenEMR Complete Deployment with Synthea"
echo "============================================="

# Parse command line arguments
PATIENT_COUNT=${1:-50}
COMPOSE_FILE="docker-compose.complete.yml"

echo "📋 Configuration:"
echo "   Patient Count: $PATIENT_COUNT"
echo "   Compose File: $COMPOSE_FILE"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f $COMPOSE_FILE down -v 2>/dev/null || true

# Build and start services
echo "🚀 Starting services..."
PATIENT_COUNT=$PATIENT_COUNT docker-compose -f $COMPOSE_FILE up -d --build

# Wait for backend to be healthy
echo "⏳ Waiting for backend to be healthy..."
attempt=1
max_attempts=30

while [ $attempt -le $max_attempts ]; do
    if docker exec emr-backend curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Backend failed to become healthy"
    echo "Check logs with: docker-compose -f $COMPOSE_FILE logs backend"
    exit 1
fi

# Run data initialization
echo ""
echo "💾 Initializing database with Synthea patients..."
PATIENT_COUNT=$PATIENT_COUNT docker-compose -f $COMPOSE_FILE --profile init run --rm data-init

# Copy frontend build to nginx
echo "📦 Deploying frontend..."
docker cp emr-frontend:/app/build/. emr-nginx:/usr/share/nginx/html/

# Restart nginx to pick up the files
docker-compose -f $COMPOSE_FILE restart nginx

echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "🌐 Access the system at:"
echo "   EMR Application: http://localhost"
echo "   API Documentation: http://localhost:8000/docs"
echo ""
echo "📊 Database contains:"
docker exec emr-backend python -c "
from database.database import get_db
from models.synthea_models import Patient, Provider
db = next(get_db())
print(f'   Providers: {db.query(Provider).count()}')
print(f'   Patients: {db.query(Patient).count()}')
"
echo ""
echo "📝 Login credentials:"
echo "   Username: Any provider's email from the database"
echo "   Password: password123"
echo ""
echo "🛑 To stop: docker-compose -f $COMPOSE_FILE down"
echo "🔄 To restart: docker-compose -f $COMPOSE_FILE up -d"
echo "🗑️  To reset: docker-compose -f $COMPOSE_FILE down -v"
echo ""