#!/bin/bash
# Quick setup script for local development

set -e

echo "EMR System Quick Setup"
echo "====================="

# Check Docker
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Build and start containers
echo "Building containers..."
docker-compose -f docker-compose.yml up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Check if data exists
PATIENT_COUNT=$(docker exec emr-backend python3 -c "
from database.database import SessionLocal
from models.synthea_models import Patient
print(SessionLocal().query(Patient).count())
" 2>/dev/null || echo "0")

if [ "$PATIENT_COUNT" -eq "0" ]; then
    echo "Importing sample patient data..."
    docker exec emr-backend python scripts/optimized_comprehensive_setup.py --patients 25
    
    echo "Adding clinical notes..."
    docker exec emr-backend python scripts/add_clinical_notes.py
fi

# Health check
echo ""
echo "Verifying deployment..."
curl -s http://localhost/api/health | grep -q "healthy" && echo "✓ API is healthy" || echo "✗ API health check failed"
curl -s http://localhost/fhir/R4/metadata | grep -q "CapabilityStatement" && echo "✓ FHIR API is working" || echo "✗ FHIR API check failed"
curl -s http://localhost/cds-hooks/ | grep -q "services" && echo "✓ CDS Hooks are working" || echo "✗ CDS Hooks check failed"

echo ""
echo "Setup complete!"
echo "=============="
echo ""
echo "Access the EMR at: http://localhost"
echo "Login with any provider from the list"
echo ""
echo "Features available:"
echo "- Patient management and clinical documentation"
echo "- FHIR API: http://localhost/fhir/R4/"
echo "- CDS Hooks: http://localhost/cds-hooks/"
echo "- API Docs: http://localhost/docs"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"