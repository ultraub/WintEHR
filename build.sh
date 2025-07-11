#!/bin/bash

# MedGenEMR Build Script
# This script builds and prepares the MedGenEMR system for deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}🏥 MedGenEMR Build Script${NC}"
echo "=============================="

# Function to check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker found${NC}"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker Compose found${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}⚠️  Node.js not found (needed for frontend development)${NC}"
    else
        echo -e "${GREEN}✓ Node.js found ($(node --version))${NC}"
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}⚠️  Python 3 not found (needed for backend development)${NC}"
    else
        echo -e "${GREEN}✓ Python 3 found ($(python3 --version))${NC}"
    fi
}

# Function to create environment files
create_env_files() {
    echo -e "\n${YELLOW}Setting up environment files...${NC}"
    
    # Create root .env if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=emr_password
POSTGRES_DB=emr_db

# Authentication
JWT_SECRET_KEY=$(openssl rand -hex 32)
JWT_ENABLED=false

# Optional API Keys
OPENAI_API_KEY=
GOOGLE_API_KEY=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000
EOF
        echo -e "${GREEN}✓ Created .env file${NC}"
    else
        echo -e "${GREEN}✓ .env file already exists${NC}"
    fi
    
    # Create frontend .env if it doesn't exist
    if [ ! -f frontend/.env ]; then
        cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
EOF
        echo -e "${GREEN}✓ Created frontend/.env file${NC}"
    else
        echo -e "${GREEN}✓ frontend/.env file already exists${NC}"
    fi
}

# Function to build Docker images
build_docker_images() {
    echo -e "\n${YELLOW}Building Docker images...${NC}"
    
    # Build all images
    docker-compose build --parallel
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker images built successfully${NC}"
    else
        echo -e "${RED}❌ Failed to build Docker images${NC}"
        exit 1
    fi
}

# Function to prepare frontend
prepare_frontend() {
    echo -e "\n${YELLOW}Preparing frontend...${NC}"
    
    if [ -d "frontend/node_modules" ]; then
        echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
    else
        echo "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
        echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    fi
}

# Function to prepare backend
prepare_backend() {
    echo -e "\n${YELLOW}Preparing backend...${NC}"
    
    # Check if we need to create virtual environment
    if [ ! -d "backend/venv" ]; then
        echo "Creating Python virtual environment..."
        cd backend
        python3 -m venv venv
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        deactivate
        cd ..
        echo -e "${GREEN}✓ Backend virtual environment created${NC}"
    else
        echo -e "${GREEN}✓ Backend virtual environment already exists${NC}"
    fi
}

# Function to validate build
validate_build() {
    echo -e "\n${YELLOW}Validating build...${NC}"
    
    # Check if images exist
    if docker images | grep -q "medgenemr_backend"; then
        echo -e "${GREEN}✓ Backend image found${NC}"
    else
        echo -e "${RED}❌ Backend image not found${NC}"
        return 1
    fi
    
    if docker images | grep -q "medgenemr_frontend"; then
        echo -e "${GREEN}✓ Frontend image found${NC}"
    else
        echo -e "${RED}❌ Frontend image not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Build validation passed${NC}"
}

# Function to show next steps
show_next_steps() {
    echo -e "\n${GREEN}✅ Build completed successfully!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Start the system:"
    echo "   ./start.sh"
    echo ""
    echo "2. Or for a fresh deployment with sample data:"
    echo "   ./fresh-deploy.sh"
    echo ""
    echo "3. Access the application:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:8000"
    echo "   - API Documentation: http://localhost:8000/docs"
    echo ""
    echo "4. Default credentials (training mode):"
    echo "   - Username: demo"
    echo "   - Password: password"
}

# Main execution
main() {
    check_prerequisites
    create_env_files
    build_docker_images
    prepare_frontend
    prepare_backend
    validate_build
    show_next_steps
}

# Parse command line arguments
case "$1" in
    --docker-only)
        check_prerequisites
        create_env_files
        build_docker_images
        validate_build
        echo -e "${GREEN}✅ Docker build completed!${NC}"
        ;;
    --frontend-only)
        prepare_frontend
        echo -e "${GREEN}✅ Frontend build completed!${NC}"
        ;;
    --backend-only)
        prepare_backend
        echo -e "${GREEN}✅ Backend build completed!${NC}"
        ;;
    --help)
        echo "Usage: $0 [OPTION]"
        echo "Build MedGenEMR system components"
        echo ""
        echo "Options:"
        echo "  --docker-only    Build only Docker images"
        echo "  --frontend-only  Prepare only frontend dependencies"
        echo "  --backend-only   Prepare only backend environment"
        echo "  --help          Show this help message"
        echo ""
        echo "With no options, performs complete build"
        ;;
    *)
        main
        ;;
esac