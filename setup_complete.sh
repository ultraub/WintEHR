#!/bin/bash
set -e

echo "🏥 MedGenEMR Complete Setup (PostgreSQL Edition)"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.9+${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 14+${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Step 1: Start PostgreSQL
echo -e "\n${BLUE}🐘 Setting up PostgreSQL...${NC}"
if ! docker ps | grep -q emr-postgres-local; then
    docker run -d \
        --name emr-postgres-local \
        -e POSTGRES_USER=emr_user \
        -e POSTGRES_PASSWORD=emr_password \
        -e POSTGRES_DB=emr_db \
        -p 5432:5432 \
        -v emr_postgres_data:/var/lib/postgresql/data \
        postgres:15-alpine
    
    echo "⏳ Waiting for PostgreSQL to start..."
    sleep 10
else
    echo -e "${GREEN}✅ PostgreSQL already running${NC}"
fi

# Step 2: Backend Setup
echo -e "\n${BLUE}🔧 Setting up backend...${NC}"
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt
pip install asyncpg  # PostgreSQL async driver

# Set up environment
if [ ! -f ".env" ]; then
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db

# Clinical Canvas
ANTHROPIC_API_KEY=your-api-key-here
CLAUDE_MODEL=claude-3-haiku-20240307

# Server
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
else
    echo "ℹ️  Using existing .env file"
fi

# Run migrations
echo "📊 Running database migrations..."
alembic upgrade head

# Step 3: Generate Synthea Data
echo -e "\n${BLUE}🧬 Setting up Synthea test data...${NC}"
if [ ! -d "synthea" ]; then
    ./scripts/setup_synthea_local.sh
fi

if [ ! -d "synthea/output/fhir" ] || [ -z "$(ls -A synthea/output/fhir 2>/dev/null)" ]; then
    echo "Generating 5 test patients..."
    ./scripts/run_synthea_local.sh
else
    echo -e "${GREEN}✅ Synthea data already generated${NC}"
fi

# Step 4: Start Backend
echo -e "\n${BLUE}🚀 Starting backend server...${NC}"
# Kill any existing backend process
pkill -f "uvicorn main:app" || true

# Start backend in background
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!

echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:8000/fhir/R4/metadata > /dev/null; then
    echo -e "${GREEN}✅ Backend running on http://localhost:8000${NC}"
else
    echo -e "${RED}❌ Backend failed to start. Check backend.log${NC}"
    exit 1
fi

# Step 5: Import Synthea Data
echo -e "\n${BLUE}📥 Importing Synthea data...${NC}"
python scripts/import_synthea_postgres.py

# Step 6: Frontend Setup
echo -e "\n${BLUE}🎨 Setting up frontend...${NC}"
cd ../frontend

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
else
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi

# Create .env if needed
if [ ! -f ".env" ]; then
    cat > .env << EOF
# FHIR Configuration
REACT_APP_FHIR_ENDPOINT=http://localhost:8000/fhir/R4
REACT_APP_API_URL=http://localhost:8000

# Features
REACT_APP_ENABLE_SEARCH=true
REACT_APP_ENABLE_HISTORY=true
REACT_APP_ENABLE_OPERATIONS=true
REACT_APP_ENABLE_BATCH=true
EOF
    echo -e "${GREEN}✅ Created frontend .env file${NC}"
fi

# Step 7: Start Frontend
echo -e "\n${BLUE}🌐 Starting frontend...${NC}"
# Kill any existing frontend process
pkill -f "react-scripts start" || true

# Start frontend
npm start &
FRONTEND_PID=$!

echo "⏳ Waiting for frontend to start..."
sleep 10

# Summary
echo -e "\n${GREEN}=============================================="
echo "🎉 MedGenEMR Setup Complete!"
echo "=============================================="
echo -e "${NC}"
echo "📍 Access Points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "   FHIR API: http://localhost:8000/fhir/R4"
echo ""
echo "📊 Database:"
echo "   PostgreSQL: localhost:5432/emr_db"
echo "   User: emr_user"
echo "   Password: emr_password"
echo ""
echo "🔍 Useful Commands:"
echo "   View logs: tail -f backend/backend.log"
echo "   Database console: docker exec -it emr-postgres-local psql -U emr_user -d emr_db"
echo "   Stop all: pkill -f 'uvicorn|react-scripts'"
echo ""
echo "📚 Documentation:"
echo "   PostgreSQL Migration: POSTGRES_MIGRATION.md"
echo "   Local Development: LOCAL_DEVELOPMENT.md"
echo ""

# Keep script running
echo "Press Ctrl+C to stop all services..."
wait