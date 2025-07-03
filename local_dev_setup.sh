#!/bin/bash

# Local Development Setup Script for MedGenEMR
# This script sets up a complete local development environment

set -e  # Exit on any error

echo "🏥 MedGenEMR Local Development Setup"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from the MedGenEMR root directory"
    exit 1
fi

# Stop any running Docker containers
echo "🛑 Stopping Docker containers..."
docker-compose down 2>/dev/null || true

# Create backend virtual environment
echo "🐍 Setting up Python backend environment..."
cd backend

# Remove existing venv if it exists
if [ -d "venv" ]; then
    echo "   Removing existing virtual environment..."
    rm -rf venv
fi

# Create new virtual environment
echo "   Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "   Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "   Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "   Installing Python dependencies..."
pip install -r requirements.txt

# Set up database
echo "🗄️  Setting up PostgreSQL database..."

# Check if PostgreSQL is running locally
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "   Starting PostgreSQL with Docker..."
    # Start only the PostgreSQL container for local development
    docker run -d \
        --name emr-postgres-local \
        -e POSTGRES_DB=emr_db \
        -e POSTGRES_USER=emr_user \
        -e POSTGRES_PASSWORD=emr_password \
        -p 5432:5432 \
        --health-cmd="pg_isready -U emr_user -d emr_db" \
        --health-interval=5s \
        --health-timeout=3s \
        --health-retries=5 \
        postgres:15-alpine

    echo "   Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Wait for health check
    until docker exec emr-postgres-local pg_isready -U emr_user -d emr_db; do
        echo "   Waiting for PostgreSQL..."
        sleep 2
    done
else
    echo "   PostgreSQL is already running locally"
fi

# Run database migrations
echo "   Running database migrations..."
export DATABASE_URL="postgresql://emr_user:emr_password@localhost:5432/emr_db"
alembic upgrade head

# Generate and import Synthea data
echo "🧬 Setting up Synthea data (5 patients)..."

# Make sure Synthea is configured for 5 patients
if [ -f "scripts/setup_synthea.sh" ]; then
    echo "   Configuring Synthea for 5 patients..."
    chmod +x scripts/setup_synthea.sh
    cd scripts
    
    # Update synthea properties for 5 patients
    echo "   Updating Synthea configuration..."
    if [ -d "../synthea" ]; then
        cd ../synthea
        echo "exporter.fhir.export = true" > src/main/resources/synthea.properties
        echo "exporter.baseDirectory = ./output/" >> src/main/resources/synthea.properties
        echo "generate.default_population = 5" >> src/main/resources/synthea.properties
        echo "generate.only_alive_patients = true" >> src/main/resources/synthea.properties
        echo "generate.log_patients.detail = simple" >> src/main/resources/synthea.properties
        cd ..
    fi
    
    cd scripts
    ./setup_synthea.sh
    
    # Import the generated data
    echo "   Importing Synthea data..."
    if [ -f "import_synthea.py" ]; then
        python import_synthea.py
    fi
    
    cd ..
else
    echo "   ⚠️  Synthea setup script not found, skipping data generation"
fi

cd ..  # Back to root directory

# Set up frontend
echo "🌐 Setting up frontend environment..."
cd frontend

# Install frontend dependencies
echo "   Installing Node.js dependencies..."
npm install

# Create .env file for frontend if it doesn't exist
if [ ! -f ".env" ]; then
    echo "   Creating frontend .env file..."
    cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FHIR_URL=http://localhost:8000/fhir
EOF
fi

cd ..  # Back to root directory

# Create startup scripts
echo "📝 Creating startup scripts..."

# Create backend startup script
cat > start_backend.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting backend development server..."
cd backend
source venv/bin/activate
export DATABASE_URL="postgresql://emr_user:emr_password@localhost:5432/emr_db"
export ENVIRONMENT="development"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
EOF

# Create frontend startup script
cat > start_frontend.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting frontend development server..."
cd frontend
npm start
EOF

# Create combined startup script
cat > start_dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting MedGenEMR Local Development Environment"
echo "=================================================="

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Shutting down development servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "Starting backend server..."
cd backend
source venv/bin/activate
export DATABASE_URL="postgresql://emr_user:emr_password@localhost:5432/emr_db"
export ENVIRONMENT="development"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 5

# Start frontend in background
echo "Starting frontend server..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Development servers started!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo "   Database: postgresql://emr_user:emr_password@localhost:5432/emr_db"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
EOF

# Make scripts executable
chmod +x start_backend.sh
chmod +x start_frontend.sh
chmod +x start_dev.sh

# Update todos
echo ""
echo "✅ Local development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Run './start_dev.sh' to start both servers"
echo "   2. Or run './start_backend.sh' and './start_frontend.sh' separately"
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo "🔧 Development URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "   Database: postgresql://emr_user:emr_password@localhost:5432/emr_db"
echo ""
echo "📊 The system includes 5 Synthea-generated test patients"