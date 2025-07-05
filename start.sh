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