#!/bin/bash

# MedGenEMR - Complete System Startup Script
# Starts the entire EMR system with backend and frontend

set -e

echo "🏥 Starting MedGenEMR System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo -e "${RED}Error: Please run this script from the MedGenEMR root directory${NC}"
    exit 1
fi

# Kill any existing processes on our ports
echo -e "${YELLOW}🔄 Stopping any existing services...${NC}"
pkill -f "uvicorn.*main:app" || true
pkill -f "npm start" || true
pkill -f "node.*scripts/start.js" || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Start backend
echo -e "${BLUE}🚀 Starting Backend (Python/FastAPI)...${NC}"
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install -r requirements.txt >/dev/null 2>&1

# Start backend in background
python main.py &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend started successfully on http://localhost:8000${NC}"
        break
    fi
    sleep 2
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start after 60 seconds${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
done

# Run database initialization and table creation
echo -e "${BLUE}🔧 Initializing database with definitive schema...${NC}"

# Check if database is accessible
if ! python -c "import asyncio; import asyncpg; asyncio.run(asyncpg.connect('postgresql://emr_user:emr_password@localhost:5432/emr_db').close())" 2>/dev/null; then
    echo -e "${RED}❌ Database not accessible. Please ensure PostgreSQL is running.${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Run database schema validation and setup
python scripts/init_database_definitive.py || {
    echo -e "${YELLOW}⚠️  Definitive initialization failed, trying fallback...${NC}"
    python scripts/init_database.py || echo -e "${YELLOW}⚠️  Database initialization skipped (may already be initialized)${NC}"
}

# Validate critical tables exist
echo -e "${YELLOW}🔍 Validating database schema...${NC}"
python -c "
import asyncio
import asyncpg
import sys

async def validate_schema():
    try:
        conn = await asyncpg.connect('postgresql://emr_user:emr_password@localhost:5432/emr_db')
        
        # Check critical tables
        tables = await conn.fetch('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'fhir\\'')
        table_names = {row['table_name'] for row in tables}
        required_tables = {'resources', 'search_params', 'resource_history'}
        
        missing = required_tables - table_names
        if missing:
            print(f'❌ Missing critical tables: {missing}')
            return False
            
        print(f'✅ All critical tables present: {sorted(table_names)}')
        await conn.close()
        return True
    except Exception as e:
        print(f'❌ Schema validation failed: {e}')
        return False

success = asyncio.run(validate_schema())
sys.exit(0 if success else 1)
" || {
    echo -e "${RED}❌ Database schema validation failed${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
}

cd ..

# Start frontend
echo -e "${BLUE}🎨 Starting Frontend (React)...${NC}"
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install >/dev/null 2>&1
fi

# Start frontend in background
BROWSER=none npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend started successfully on http://localhost:3000${NC}"
        break
    fi
    sleep 2
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start after 60 seconds${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
done

cd ..

echo ""
echo -e "${GREEN}🎉 MedGenEMR System Started Successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Access Points:${NC}"
echo -e "   🌐 Frontend:    http://localhost:3000"
echo -e "   🔧 Backend:     http://localhost:8000"
echo -e "   📚 API Docs:    http://localhost:8000/docs"
echo -e "   🔍 FHIR API:    http://localhost:8000/fhir/R4"
echo ""
echo -e "${BLUE}✨ New Features Included:${NC}"
echo -e "   💊 Pharmacy Workflows with Medication Dispensing"
echo -e "   🩻 DICOM Imaging Viewer with Real Images"
echo -e "   📊 Lab Results with Reference Ranges & Trends"
echo -e "   🔄 Cross-Module Clinical Workflow Integration"
echo -e "   🔐 Optional JWT Authentication (disabled by default)"
echo -e "   🔍 Enhanced FHIR Search with Reference Resolution"
echo ""
echo -e "${YELLOW}💡 Tip: Use Ctrl+C to stop all services${NC}"
echo ""

# Handle shutdown
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down MedGenEMR...${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    pkill -f "uvicorn.*main:app" || true
    pkill -f "npm start" || true
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep the script running
wait