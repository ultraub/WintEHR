#!/bin/bash

# MedGenEMR Development Mode Startup Script
# This script starts the application in development mode with hot reload

set -e

echo "🔥 Starting MedGenEMR in Development Mode with Hot Reload"
echo "=================================================="

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install Docker Compose."
    exit 1
fi

# Check if .env file exists, create if not
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Development Environment Variables
JWT_ENABLED=false
ANTHROPIC_API_KEY=
JWT_SECRET=dev-secret-key-change-in-production

# Database
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=emr_password
POSTGRES_DB=emr_db

# Development specific
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
CHOKIDAR_USEPOLLING=true
WATCHPACK_POLLING=true
FAST_REFRESH=true
EOF
    echo "✅ Created .env file with development defaults"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.yml down 2>/dev/null || true
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

# Clean up any orphaned containers
docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true

# Build development images
echo "🔨 Building development images..."
docker-compose -f docker-compose.dev.yml build

# Start services
echo "🚀 Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
echo "   - Waiting for PostgreSQL..."
while ! docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U emr_user -d emr_db 2>/dev/null; do
    sleep 2
done

echo "   - Waiting for Backend API..."
for i in {1..30}; do
    if curl -f http://localhost:8000/api/health &>/dev/null; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start"
        docker-compose -f docker-compose.dev.yml logs backend
        exit 1
    fi
    sleep 2
done

echo "   - Waiting for Frontend..."
for i in {1..60}; do
    if curl -f http://localhost:3000 &>/dev/null; then
        break
    fi
    if [ $i -eq 60 ]; then
        echo "❌ Frontend failed to start"
        docker-compose -f docker-compose.dev.yml logs frontend
        exit 1
    fi
    sleep 2
done

echo ""
echo "🎉 Development environment is ready!"
echo "=================================================="
echo "Frontend (React):    http://localhost:3000"
echo "Backend API:         http://localhost:8000"
echo "FHIR Endpoint:       http://localhost:8000/fhir/R4"
echo "API Documentation:   http://localhost:8000/docs"
echo "PostgreSQL:          localhost:5432"
echo ""
echo "💡 Hot Reload Features:"
echo "   ✅ Frontend: Changes to React files will reload automatically"
echo "   ✅ Backend: Changes to Python files will reload the API server"
echo "   ✅ Database: Persistent data across restarts"
echo ""
echo "📊 Monitor logs:"
echo "   docker-compose -f docker-compose.dev.yml logs -f"
echo ""
echo "🛑 Stop development environment:"
echo "   docker-compose -f docker-compose.dev.yml down"
echo ""
echo "Happy coding! 🚀"