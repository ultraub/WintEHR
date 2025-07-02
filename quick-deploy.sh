#!/bin/bash

# Quick Deploy - The simplest way to run MedGenEMR with Synthea patients

echo "🏥 MedGenEMR Quick Deploy"
echo "========================"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Set patient count (default 50)
PATIENT_COUNT=${1:-50}

echo "📋 Deploying with $PATIENT_COUNT Synthea patients..."
echo ""

# Stop any existing containers
docker-compose -f docker-compose.simple-synthea.yml down -v 2>/dev/null || true

# Start the all-in-one container
PATIENT_COUNT=$PATIENT_COUNT docker-compose -f docker-compose.simple-synthea.yml up -d --build

echo ""
echo "⏳ Deployment in progress..."
echo "   This will take 3-5 minutes on first run while Synthea generates patients."
echo ""
echo "   You can monitor progress with:"
echo "   docker logs -f emr-all-in-one"
echo ""
echo "🌐 The system will be available at:"
echo "   http://localhost"
echo ""
echo "📝 Default credentials:"
echo "   Username: john.smith@hospital.org"
echo "   Password: password123"
echo ""