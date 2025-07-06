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
echo -e "${BLUE}🔧 Initializing database and search tables...${NC}"

# Ensure all schemas and tables exist
PGPASSWORD=emr_password psql -h localhost -p 5432 -U emr_user -d emr_db <<SQL >/dev/null 2>&1 || echo -e "${YELLOW}⚠️  Some database initialization skipped${NC}"
-- Create schemas
CREATE SCHEMA IF NOT EXISTS fhir;
CREATE SCHEMA IF NOT EXISTS cds_hooks;

-- Add deleted column if missing
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fhir' 
        AND table_name = 'resources' 
        AND column_name = 'deleted'
    ) THEN
        ALTER TABLE fhir.resources ADD COLUMN deleted BOOLEAN DEFAULT FALSE;
    END IF;
END\$\$;

-- Create search_params table if not exists
CREATE TABLE IF NOT EXISTS fhir.search_params (
    id SERIAL PRIMARY KEY,
    resource_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    param_name VARCHAR(100) NOT NULL,
    param_type VARCHAR(20) NOT NULL,
    value_string TEXT,
    value_token VARCHAR(500),
    value_reference VARCHAR(500),
    value_date TIMESTAMP,
    value_number NUMERIC,
    value_quantity_value NUMERIC,
    value_quantity_unit VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
);

-- Create resource_history table if not exists
CREATE TABLE IF NOT EXISTS fhir.resource_history (
    id SERIAL PRIMARY KEY,
    resource_id INTEGER NOT NULL,
    version_id INTEGER NOT NULL,
    operation VARCHAR(20) NOT NULL,
    resource JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resource_history_resource FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE,
    CONSTRAINT idx_resource_history_unique UNIQUE (resource_id, version_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_search_params_resource ON fhir.search_params(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_search_params_token ON fhir.search_params(param_name, value_token) WHERE value_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_params_reference ON fhir.search_params(param_name, value_reference) WHERE value_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resource_history_resource_id ON fhir.resource_history(resource_id);
SQL

# Initialize search tables if needed
python scripts/init_search_tables.py >/dev/null 2>&1 || echo -e "${YELLOW}⚠️  Search tables initialization skipped${NC}"

# Run main database initialization
python scripts/init_database.py >/dev/null 2>&1 || echo -e "${YELLOW}⚠️  Database initialization skipped (may already be initialized)${NC}"

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