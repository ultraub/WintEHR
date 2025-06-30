#!/bin/bash
#
# Fresh Setup Script for EMR Training System
# This script sets up the system from scratch with all lessons learned
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🏥 EMR Training System - Fresh Setup${NC}"
echo "====================================="

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Python version
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
        MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        
        if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 8 ]); then
            echo -e "${RED}Error: Python 3.8+ is required (found $PYTHON_VERSION)${NC}"
            echo "Python 3.7 will NOT work due to dependency requirements"
            exit 1
        fi
        echo -e "${GREEN}✓ Python $PYTHON_VERSION${NC}"
    else
        echo -e "${RED}Error: Python 3 is not installed${NC}"
        exit 1
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d. -f1 | sed 's/v//')
        if [ "$NODE_VERSION" -lt 16 ]; then
            echo -e "${YELLOW}Warning: Node.js 16+ recommended (found v$NODE_VERSION)${NC}"
        else
            echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
        fi
    else
        echo -e "${RED}Error: Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✓ npm $(npm --version)${NC}"
    else
        echo -e "${RED}Error: npm is not installed${NC}"
        exit 1
    fi
    
    # Check Java (for Synthea)
    if command -v java &> /dev/null; then
        echo -e "${GREEN}✓ Java installed${NC}"
    else
        echo -e "${YELLOW}Warning: Java not found - needed for Synthea${NC}"
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓ Docker installed (optional)${NC}"
    else
        echo -e "${YELLOW}Note: Docker not found (optional)${NC}"
    fi
}

# Fix common issues in files
fix_common_issues() {
    echo -e "${YELLOW}Fixing common issues...${NC}"
    
    # Fix line endings in all shell scripts
    find . -name "*.sh" -type f -exec sed -i 's/\r$//' {} \;
    
    # Ensure all Python files use proper imports
    if [ -f "backend/api/app/schemas.py" ]; then
        if ! grep -q "from __future__ import annotations" backend/api/app/schemas.py; then
            sed -i '1i from __future__ import annotations' backend/api/app/schemas.py
        fi
    fi
    
    # Fix Dockerfile issues
    if [ -f "Dockerfile.standalone" ]; then
        # Replace npm ci with npm install
        sed -i 's/npm ci/npm install/g' Dockerfile.standalone
        
        # If there's a fixed version, use it
        if [ -f "Dockerfile.standalone.fixed" ]; then
            cp Dockerfile.standalone.fixed Dockerfile.standalone
            echo -e "${GREEN}✓ Using fixed Dockerfile${NC}"
        fi
    fi
    
    echo -e "${GREEN}✓ Common issues fixed${NC}"
}

# Setup backend
setup_backend() {
    echo -e "${YELLOW}Setting up backend...${NC}"
    
    cd backend
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        echo -e "${GREEN}✓ Virtual environment created${NC}"
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
    
    # Create necessary directories
    mkdir -p data logs
    
    # Download Synthea if not present
    if [ ! -f "synthea-with-dependencies.jar" ]; then
        echo "Downloading Synthea..."
        curl -L https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar \
            -o synthea-with-dependencies.jar
        echo -e "${GREEN}✓ Synthea downloaded${NC}"
    fi
    
    cd ..
}

# Setup frontend
setup_frontend() {
    echo -e "${YELLOW}Setting up frontend...${NC}"
    
    cd frontend
    
    # Clean any existing node_modules or lock files that might cause issues
    rm -rf node_modules package-lock.json
    
    # Install dependencies using npm install (NOT npm ci)
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    
    # Build frontend for production
    if [ "$1" == "build" ]; then
        npm run build
        echo -e "${GREEN}✓ Frontend built for production${NC}"
    fi
    
    cd ..
}

# Initialize database
init_database() {
    echo -e "${YELLOW}Initializing database...${NC}"
    
    cd backend
    source venv/bin/activate
    
    # Run initialization scripts
    python scripts/create_sample_providers.py
    echo -e "${GREEN}✓ Sample providers created${NC}"
    
    python scripts/populate_clinical_catalogs.py
    echo -e "${GREEN}✓ Clinical catalogs populated${NC}"
    
    # Generate and import patient data
    if [ -f "scripts/optimized_synthea_import.py" ]; then
        echo "Generating synthetic patients..."
        python scripts/optimized_synthea_import.py --patients ${PATIENT_COUNT:-25}
        echo -e "${GREEN}✓ Patient data imported${NC}"
    fi
    
    # Add reference ranges if script exists
    if [ -f "scripts/add_reference_ranges.py" ]; then
        python scripts/add_reference_ranges.py
        echo -e "${GREEN}✓ Reference ranges added${NC}"
    fi
    
    cd ..
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    
    # Start backend
    cd backend
    source venv/bin/activate
    nohup python main.py > logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started (PID: $BACKEND_PID)"
    cd ..
    
    # Wait for backend to be ready
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -f http://localhost:8000/health &> /dev/null; then
            echo -e "${GREEN}✓ Backend is running${NC}"
            break
        fi
        sleep 1
    done
    
    # Start frontend
    cd frontend
    nohup npm start > ../backend/logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend started (PID: $FRONTEND_PID)"
    cd ..
    
    echo -e "${GREEN}✓ All services started${NC}"
    echo ""
    echo "Access the system at:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    echo "To stop services:"
    echo "  kill $BACKEND_PID $FRONTEND_PID"
}

# Docker setup option
setup_docker() {
    echo -e "${YELLOW}Setting up with Docker...${NC}"
    
    # Use simple docker-compose if available
    if [ -f "docker-compose.simple.yml" ]; then
        docker-compose -f docker-compose.simple.yml up -d
        echo -e "${GREEN}✓ Services started with Docker${NC}"
    else
        # Use fixed Dockerfile if available
        if [ -f "Dockerfile.standalone.fixed" ]; then
            cp Dockerfile.standalone.fixed Dockerfile.standalone
        fi
        
        # Fix common Docker issues
        sed -i 's/npm ci/npm install/g' Dockerfile.standalone 2>/dev/null || true
        
        docker-compose -f docker-compose.standalone.yml up -d --build
        echo -e "${GREEN}✓ Services started with Docker${NC}"
    fi
}

# Main menu
main() {
    check_prerequisites
    fix_common_issues
    
    echo ""
    echo "Select setup method:"
    echo "1) Local development (Python/Node.js)"
    echo "2) Docker deployment"
    echo "3) Full setup (local + initialize database)"
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1)
            setup_backend
            setup_frontend
            start_services
            ;;
        2)
            setup_docker
            ;;
        3)
            setup_backend
            setup_frontend
            init_database
            start_services
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac
}

# Run main function
main

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"