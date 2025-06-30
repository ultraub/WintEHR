#!/bin/bash
#
# Complete Setup Script for EMR Training System
# Incorporates all lessons learned from AWS deployment
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🏥 EMR Training System - Complete Setup${NC}"
echo "==========================================="

# Configuration
PYTHON_CMD=${PYTHON_CMD:-python3}
PATIENT_COUNT=${PATIENT_COUNT:-25}
USE_DOCKER=${USE_DOCKER:-false}

# Check if we're on EC2 or local
detect_environment() {
    if [ -f /etc/os-release ] && grep -q "Amazon Linux" /etc/os-release; then
        echo "EC2"
    else
        echo "LOCAL"
    fi
}

ENV_TYPE=$(detect_environment)
echo -e "${YELLOW}Environment: $ENV_TYPE${NC}"

# Install system dependencies based on environment
install_dependencies() {
    echo -e "${YELLOW}Installing system dependencies...${NC}"
    
    if [ "$ENV_TYPE" = "EC2" ]; then
        # Amazon Linux 2 specific
        sudo yum update -y
        sudo yum install -y git docker nginx
        
        # Install Node.js 18
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
        
        # Install Python 3.9 via Docker since AL2 only has 3.7
        echo -e "${YELLOW}Note: Will use Docker for Python backend due to AL2 limitations${NC}"
        USE_DOCKER=true
        
        # Start services
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -a -G docker ec2-user
        
        sudo systemctl start nginx
        sudo systemctl enable nginx
        
    elif [ "$ENV_TYPE" = "LOCAL" ]; then
        # Check Python version
        PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
        MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        
        if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 8 ]); then
            echo -e "${RED}Error: Python 3.8+ is required (found $PYTHON_VERSION)${NC}"
            echo "Python 3.7 will NOT work with FastAPI/Pydantic v2"
            exit 1
        fi
        
        # Check Node.js
        if ! command -v node &> /dev/null; then
            echo -e "${RED}Error: Node.js is not installed${NC}"
            exit 1
        fi
        
        # Check Java for Synthea
        if ! command -v java &> /dev/null; then
            echo -e "${YELLOW}Warning: Java not found - needed for Synthea${NC}"
        fi
    fi
}

# Fix common file issues
fix_file_issues() {
    echo -e "${YELLOW}Fixing common file issues...${NC}"
    
    # Fix line endings
    find . -name "*.sh" -type f -exec dos2unix {} \; 2>/dev/null || true
    
    # Fix Python forward references
    if [ -f "backend/api/app/schemas.py" ]; then
        if ! grep -q "from __future__ import annotations" backend/api/app/schemas.py; then
            sed -i '1i from __future__ import annotations' backend/api/app/schemas.py
        fi
    fi
    
    # Ensure all scripts are executable
    chmod +x *.sh backend/scripts/*.py 2>/dev/null || true
    
    echo -e "${GREEN}✓ File issues fixed${NC}"
}

# Setup backend (local)
setup_backend_local() {
    echo -e "${YELLOW}Setting up backend (local)...${NC}"
    
    cd backend
    
    # Create virtual environment
    if [ ! -d "venv" ]; then
        $PYTHON_CMD -m venv venv
    fi
    
    # Activate and install
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Create necessary directories
    mkdir -p data logs data/synthea_output
    
    # Download Synthea if needed
    if [ ! -f "synthea-with-dependencies.jar" ]; then
        echo "Downloading Synthea..."
        curl -L https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar \
            -o synthea-with-dependencies.jar
    fi
    
    cd ..
    echo -e "${GREEN}✓ Backend setup complete${NC}"
}

# Setup backend (Docker)
setup_backend_docker() {
    echo -e "${YELLOW}Setting up backend (Docker)...${NC}"
    
    # Create data directories
    mkdir -p backend/data backend/logs backend/data/synthea_output
    
    # Fix permissions
    chmod -R 777 backend/data backend/logs
    
    # Create Docker network
    docker network create emr-network 2>/dev/null || true
    
    # Run backend container
    docker run -d \
        --name emr-backend \
        --network emr-network \
        -p 8000:8000 \
        -v $(pwd)/backend:/app \
        -w /app \
        python:3.9-slim \
        bash -c "
            apt-get update && apt-get install -y curl default-jre-headless &&
            pip install -r requirements.txt &&
            python main.py
        "
    
    echo -e "${GREEN}✓ Backend Docker container started${NC}"
}

# Setup frontend
setup_frontend() {
    echo -e "${YELLOW}Setting up frontend...${NC}"
    
    cd frontend
    
    # Clean previous builds
    rm -rf node_modules package-lock.json build
    
    # Install dependencies (use npm install, NOT npm ci)
    npm install
    
    # Set API URL based on environment
    if [ "$ENV_TYPE" = "EC2" ]; then
        # For EC2, use relative path so it works with any IP
        export REACT_APP_API_URL=/api
    else
        export REACT_APP_API_URL=http://localhost:8000/api
    fi
    
    # Build for production
    npm run build
    
    cd ..
    echo -e "${GREEN}✓ Frontend built${NC}"
}

# Initialize database
init_database() {
    echo -e "${YELLOW}Initializing database...${NC}"
    
    cd backend
    
    if [ "$USE_DOCKER" = "true" ]; then
        # Run scripts in Docker container
        docker exec emr-backend python scripts/create_sample_providers.py
        docker exec emr-backend python scripts/populate_clinical_catalogs.py
        
        # Download Synthea in container if needed
        docker exec emr-backend bash -c "
            if [ ! -f synthea-with-dependencies.jar ]; then
                curl -L https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar \
                    -o synthea-with-dependencies.jar
            fi
        "
        
        # Generate patients
        docker exec emr-backend python scripts/optimized_synthea_import.py --patients $PATIENT_COUNT
        
        # Add reference ranges if available
        if [ -f "scripts/add_reference_ranges.py" ]; then
            docker exec emr-backend python scripts/add_reference_ranges.py
        fi
    else
        source venv/bin/activate
        
        python scripts/create_sample_providers.py
        python scripts/populate_clinical_catalogs.py
        
        # Generate and import patients
        if [ -f "scripts/optimized_synthea_import.py" ]; then
            python scripts/optimized_synthea_import.py --patients $PATIENT_COUNT
        fi
        
        # Add reference ranges
        if [ -f "scripts/add_reference_ranges.py" ]; then
            python scripts/add_reference_ranges.py
        fi
    fi
    
    cd ..
    echo -e "${GREEN}✓ Database initialized${NC}"
}

# Configure nginx for EC2
configure_nginx() {
    echo -e "${YELLOW}Configuring nginx...${NC}"
    
    # Create nginx config
    sudo tee /etc/nginx/conf.d/emr.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Backend API
    location ~ ^/(api|fhir|docs|openapi.json|redoc) {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Frontend
    location / {
        root /home/ec2-user/EMR/frontend/build;
        try_files $uri /index.html;
    }
    
    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    # Remove default config if exists
    sudo rm -f /etc/nginx/conf.d/default.conf
    
    # Test and reload nginx
    sudo nginx -t && sudo systemctl reload nginx
    
    echo -e "${GREEN}✓ Nginx configured${NC}"
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    
    if [ "$ENV_TYPE" = "EC2" ]; then
        # Backend already running in Docker
        # Just need to configure nginx
        configure_nginx
        
        # Wait for backend
        echo "Waiting for backend..."
        for i in {1..60}; do
            if curl -f http://localhost:8000/health &> /dev/null; then
                echo -e "${GREEN}✓ Backend is ready${NC}"
                break
            fi
            sleep 2
        done
        
    else
        # Local development
        if [ "$USE_DOCKER" = "true" ]; then
            echo "Backend running in Docker..."
        else
            cd backend
            source venv/bin/activate
            nohup python main.py > logs/backend.log 2>&1 &
            BACKEND_PID=$!
            echo "Backend started (PID: $BACKEND_PID)"
            cd ..
        fi
        
        # Start frontend dev server
        cd frontend
        nohup npm start > ../backend/logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        echo "Frontend started (PID: $FRONTEND_PID)"
        cd ..
    fi
    
    echo -e "${GREEN}✓ All services started${NC}"
}

# Show access information
show_access_info() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✓ EMR System Setup Complete!${NC}"
    echo "=========================================="
    
    if [ "$ENV_TYPE" = "EC2" ]; then
        PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")
        echo ""
        echo "Access the system at:"
        echo "  Main Application: http://$PUBLIC_IP/"
        echo "  API Documentation: http://$PUBLIC_IP/docs"
        echo "  Backend Health: http://$PUBLIC_IP/api/health"
        echo ""
        echo "To check logs:"
        echo "  docker logs emr-backend"
        echo "  sudo journalctl -u nginx"
    else
        echo ""
        echo "Access the system at:"
        echo "  Frontend: http://localhost:3000"
        echo "  Backend API: http://localhost:8000"
        echo "  API Docs: http://localhost:8000/docs"
        echo ""
        if [ ! -z "$BACKEND_PID" ]; then
            echo "To stop services:"
            echo "  kill $BACKEND_PID $FRONTEND_PID"
        fi
    fi
    echo ""
}

# Main execution
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --docker)
                USE_DOCKER=true
                shift
                ;;
            --patients)
                PATIENT_COUNT="$2"
                shift 2
                ;;
            --skip-data)
                SKIP_DATA=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run setup steps
    install_dependencies
    fix_file_issues
    
    # Backend setup
    if [ "$USE_DOCKER" = "true" ] || [ "$ENV_TYPE" = "EC2" ]; then
        setup_backend_docker
    else
        setup_backend_local
    fi
    
    # Frontend setup
    setup_frontend
    
    # Initialize database unless skipped
    if [ "$SKIP_DATA" != "true" ]; then
        # Wait for backend to be ready
        echo "Waiting for backend to start..."
        for i in {1..60}; do
            if curl -f http://localhost:8000/health &> /dev/null; then
                break
            fi
            sleep 2
        done
        
        init_database
    fi
    
    # Start services
    start_services
    
    # Show access info
    show_access_info
}

# Handle script termination
trap 'echo -e "\n${YELLOW}Setup interrupted${NC}"; exit 1' INT TERM

# Run main
main "$@"