#!/bin/bash

# Startup script for MedGenEMR FHIR-native implementation

echo "🚀 Starting MedGenEMR FHIR-native implementation"
echo "=============================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cat > .env << EOF
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/medgenemr

# Security
JWT_SECRET=your-secret-key-change-in-production-$(openssl rand -hex 32)

# Anthropic API (for Clinical Canvas)
ANTHROPIC_API_KEY=

# FHIR Configuration
FHIR_BASE_URL=http://localhost:8000/fhir/R4
EOF
    echo "✓ .env file created (please add your Anthropic API key if using Clinical Canvas)"
fi

# Check if frontend .env exists
if [ ! -f frontend/.env ]; then
    echo "Creating frontend/.env file..."
    cp frontend/.env.example frontend/.env
    echo "✓ frontend/.env file created"
fi

# Build and start services
echo -e "\n📦 Building and starting services..."
docker-compose build

echo -e "\n🐳 Starting containers..."
docker-compose up -d

# Wait for services to be ready
echo -e "\n⏳ Waiting for services to be ready..."
sleep 10

# Run health check
echo -e "\n🏥 Running health check..."
./scripts/health_check.sh

echo -e "\n✅ Startup complete!"
echo ""
echo "Services available at:"
echo "  - Frontend: http://localhost:3000"
echo "  - FHIR API: http://localhost:8000/fhir/R4"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - EMR API: http://localhost:8000/api/emr"
echo ""
echo "To import sample data:"
echo "  docker exec -it emr-backend python scripts/import_synthea.py /path/to/synthea/output"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f [service_name]"
echo ""
echo "To stop all services:"
echo "  docker-compose down"