#!/bin/bash
# Fresh start script for WintEHR with consolidated build system

set -e  # Exit on error

# Default options
WIPE_DB=true
STOP_SERVICES=true
CLEAN_FILES=false
PATIENT_COUNT=20
SKIP_CONFIRM=false
BUILD_TYPE=quick

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-wipe)
            WIPE_DB=false
            shift
            ;;
        --no-stop)
            STOP_SERVICES=false
            shift
            ;;
        --clean-files)
            CLEAN_FILES=true
            shift
            ;;
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --build-type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --yes|-y)
            SKIP_CONFIRM=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-wipe       Don't wipe the database (default: wipe)"
            echo "  --no-stop       Don't stop existing services (default: stop)"
            echo "  --clean-files   Clean generated files (default: don't clean)"
            echo "  --patients N    Number of patients to generate (default: 20)"
            echo "  --yes, -y       Skip confirmation prompts"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help to see available options"
            exit 1
            ;;
    esac
done

echo "🚀 WintEHR Fresh Start Script"
echo "==============================="
echo ""
echo "Configuration:"
echo "  - Wipe database: $WIPE_DB"
echo "  - Stop services: $STOP_SERVICES"
echo "  - Clean files: $CLEAN_FILES"
echo "  - Patient count: $PATIENT_COUNT"
echo ""

# Confirmation prompt
if [ "$SKIP_CONFIRM" = false ]; then
    read -p "Continue with these settings? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Stop existing services
if [ "$STOP_SERVICES" = true ]; then
    echo -e "\n🛑 Stopping existing services..."
    docker-compose down || true
    pkill -f "python.*main.py" || true
    pkill -f "npm.*start" || true
    echo "✓ Services stopped"
fi

# Clean generated files
if [ "$CLEAN_FILES" = true ]; then
    echo -e "\n🧹 Cleaning generated files..."
    rm -rf ../synthea/output/fhir/*.json 2>/dev/null || true
    rm -rf data/generated_dicoms/* 2>/dev/null || true
    rm -rf data/synthea_backups/* 2>/dev/null || true
    echo "✓ Files cleaned"
fi

# Start database
echo -e "\n🗄️  Starting database..."
docker-compose up -d db
sleep 5  # Wait for database to be ready

# Initialize database (with optional wipe)
if [ "$WIPE_DB" = true ]; then
    echo -e "\n💣 Wiping database..."
    PGPASSWORD=emr_password psql -h localhost -p 5432 -U postgres -c "DROP DATABASE IF EXISTS emr_db;" || true
    PGPASSWORD=emr_password psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE emr_db OWNER emr_user;"
    echo "✓ Database wiped and recreated"
fi

# Run consolidated build process
echo -e "\n🏥 Running consolidated build process..."
cd scripts/active

if [ "$BUILD_TYPE" = "full" ]; then
    echo "🔧 Running full build with $PATIENT_COUNT patients..."
    python master_build.py --full-build --patient-count $PATIENT_COUNT --environment production
elif [ "$BUILD_TYPE" = "quick" ]; then
    echo "⚡ Running quick build with $PATIENT_COUNT patients..."
    python master_build.py --quick-build --patient-count $PATIENT_COUNT --environment production
else
    echo "❌ Unknown build type: $BUILD_TYPE"
    echo "Available types: full, quick"
    exit 1
fi

cd ../..

# Start all services
echo -e "\n🚀 Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo -e "\n⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo -e "\n🏥 Checking service health..."
curl -s http://localhost:8000/health || echo "Backend not ready yet"
curl -s http://localhost:3000 || echo "Frontend not ready yet"

echo -e "\n✅ Fresh start complete!"
echo ""
echo "Services running at:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:8000"
echo "  - FHIR API: http://localhost:8000/fhir/R4/"
echo "  - API Docs: http://localhost:8000/docs"
echo ""
echo "Default credentials:"
echo "  - Username: testuser"
echo "  - Password: testpass"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"