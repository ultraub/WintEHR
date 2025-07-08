#!/bin/bash

# MedGenEMR - Complete Deployment Script
# Works on local development and AWS EC2 instances
# Handles database initialization, patient data generation, DICOM images, and server startup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PATIENT_COUNT=${PATIENT_COUNT:-5}
VALIDATION_MODE=${VALIDATION_MODE:-light}
INCLUDE_DICOM=${INCLUDE_DICOM:-true}
SKIP_DATA_GENERATION=${SKIP_DATA_GENERATION:-false}
ENVIRONMENT=${ENVIRONMENT:-local}

echo -e "${PURPLE}🏥 MedGenEMR Complete Deployment${NC}"
echo -e "${PURPLE}===============================================${NC}"
echo -e "${BLUE}Configuration:${NC}"
echo -e "  📊 Patient Count: ${PATIENT_COUNT}"
echo -e "  🔍 Validation Mode: ${VALIDATION_MODE}"
echo -e "  🩻 Include DICOM: ${INCLUDE_DICOM}"
echo -e "  🌍 Environment: ${ENVIRONMENT}"
echo ""

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
        echo -e "${RED}Error: Please run this script from the MedGenEMR root directory${NC}"
        exit 1
    fi
}

# Function to detect environment
detect_environment() {
    if [ -f "/etc/os-release" ] && grep -q "Amazon Linux" /etc/os-release; then
        ENVIRONMENT="aws"
        echo -e "${CYAN}📍 Detected AWS EC2 environment${NC}"
    elif [ "$(uname)" = "Darwin" ]; then
        ENVIRONMENT="macos"
        echo -e "${CYAN}📍 Detected macOS environment${NC}"
    else
        ENVIRONMENT="linux"
        echo -e "${CYAN}📍 Detected Linux environment${NC}"
    fi
}

# Function to install dependencies based on environment
install_dependencies() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    
    case $ENVIRONMENT in
        "aws")
            # AWS EC2 setup
            sudo yum update -y
            sudo yum install -y docker git curl
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -a -G docker ec2-user
            
            # Install Docker Compose
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            ;;
        "macos")
            # macOS setup - ensure Docker Desktop is running
            if ! docker info >/dev/null 2>&1; then
                echo -e "${YELLOW}🚀 Starting Docker Desktop...${NC}"
                open -a Docker
                echo -e "${YELLOW}⏳ Waiting for Docker to start...${NC}"
                while ! docker info >/dev/null 2>&1; do
                    sleep 2
                done
            fi
            ;;
        "linux")
            # Generic Linux setup
            sudo apt-get update
            sudo apt-get install -y docker.io docker-compose git curl
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -a -G docker $USER
            ;;
    esac
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to stop existing services
stop_existing_services() {
    echo -e "${YELLOW}🔄 Stopping existing services...${NC}"
    
    # Stop Docker containers
    if docker-compose ps >/dev/null 2>&1; then
        docker-compose down -v --remove-orphans >/dev/null 2>&1 || true
    fi
    
    # Stop any standalone processes
    pkill -f "uvicorn.*main:app" >/dev/null 2>&1 || true
    pkill -f "npm start" >/dev/null 2>&1 || true
    
    # Kill processes on our ports
    lsof -ti:3000 | xargs kill -9 >/dev/null 2>&1 || true
    lsof -ti:8000 | xargs kill -9 >/dev/null 2>&1 || true
    lsof -ti:5432 | xargs kill -9 >/dev/null 2>&1 || true
    
    echo -e "${GREEN}✅ Existing services stopped${NC}"
}

# Function to start containers
start_containers() {
    echo -e "${BLUE}🚀 Starting Docker containers...${NC}"
    
    docker-compose up -d
    
    # Wait for PostgreSQL to be healthy
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    while ! docker exec emr-postgres pg_isready -U emr_user -d emr_db >/dev/null 2>&1; do
        sleep 2
    done
    
    # Wait for backend to be healthy
    echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
    while ! curl -s http://localhost:8000/health >/dev/null 2>&1; do
        sleep 2
    done
    
    echo -e "${GREEN}✅ Containers started and healthy${NC}"
}

# Function to initialize database with definitive schema
initialize_database() {
    echo -e "${BLUE}🗄️  Initializing database schema...${NC}"
    
    if docker exec emr-backend python scripts/init_database_definitive.py; then
        echo -e "${GREEN}✅ Database schema initialized${NC}"
    else
        echo -e "${RED}❌ Database initialization failed${NC}"
        exit 1
    fi
}

# Function to setup Synthea if needed
setup_synthea() {
    echo -e "${BLUE}🧬 Setting up Synthea patient generator...${NC}"
    
    # Check if Synthea is already built
    if ! docker exec emr-backend test -f /app/synthea/build/libs/synthea-with-dependencies.jar; then
        echo -e "${YELLOW}📦 Building Synthea (this may take a few minutes)...${NC}"
        if docker exec emr-backend python scripts/synthea_master.py setup; then
            echo -e "${GREEN}✅ Synthea setup complete${NC}"
        else
            echo -e "${RED}❌ Synthea setup failed${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Synthea already set up${NC}"
    fi
}

# Function to generate patient data
generate_patient_data() {
    if [ "$SKIP_DATA_GENERATION" = "true" ]; then
        echo -e "${YELLOW}⏭️  Skipping patient data generation${NC}"
        return
    fi
    
    echo -e "${BLUE}👥 Generating ${PATIENT_COUNT} patients...${NC}"
    
    # Generate patients
    if docker exec emr-backend python scripts/synthea_master.py generate --count $PATIENT_COUNT; then
        echo -e "${GREEN}✅ Patient generation complete${NC}"
    else
        echo -e "${RED}❌ Patient generation failed${NC}"
        exit 1
    fi
    
    # Import patients
    echo -e "${BLUE}📥 Importing patient data...${NC}"
    if docker exec emr-backend python scripts/synthea_master.py import --validation-mode $VALIDATION_MODE; then
        echo -e "${GREEN}✅ Patient data imported${NC}"
    else
        echo -e "${RED}❌ Patient data import failed${NC}"
        exit 1
    fi
}

# Function to generate DICOM images
generate_dicom_images() {
    if [ "$INCLUDE_DICOM" = "false" ]; then
        echo -e "${YELLOW}⏭️  Skipping DICOM image generation${NC}"
        return
    fi
    
    echo -e "${BLUE}🩻 Generating DICOM images...${NC}"
    
    if docker exec emr-backend python scripts/enhance_imaging_import.py; then
        echo -e "${GREEN}✅ DICOM images generated${NC}"
    else
        echo -e "${YELLOW}⚠️  DICOM generation completed with warnings${NC}"
    fi
}

# Function to validate deployment
validate_deployment() {
    echo -e "${BLUE}🔍 Validating deployment...${NC}"
    
    # Check backend health
    if ! curl -s http://localhost:8000/health | grep -q "healthy"; then
        echo -e "${RED}❌ Backend health check failed${NC}"
        return 1
    fi
    
    # Check frontend
    if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo -e "${RED}❌ Frontend not accessible${NC}"
        return 1
    fi
    
    # Check database resources
    RESOURCE_COUNT=$(docker exec emr-backend psql postgresql://emr_user:emr_password@postgres:5432/emr_db -c "SELECT COUNT(*) FROM fhir.resources;" -t | tr -d ' ')
    if [ "$RESOURCE_COUNT" -gt "0" ]; then
        echo -e "${GREEN}✅ Database contains ${RESOURCE_COUNT} resources${NC}"
    else
        echo -e "${YELLOW}⚠️  No resources found in database${NC}"
    fi
    
    # Check FHIR endpoints
    PATIENT_COUNT_API=$(curl -s "http://localhost:8000/fhir/R4/Patient" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total', 0))" 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ FHIR API reports ${PATIENT_COUNT_API} patients${NC}"
    
    echo -e "${GREEN}✅ Deployment validation complete${NC}"
}

# Function to display final status
display_status() {
    echo ""
    echo -e "${GREEN}🎉 MedGenEMR Deployment Complete!${NC}"
    echo -e "${GREEN}=====================================${NC}"
    echo ""
    echo -e "${CYAN}📋 Access Points:${NC}"
    echo -e "   🌐 Frontend:    http://localhost:3000"
    echo -e "   🔧 Backend:     http://localhost:8000"
    echo -e "   📚 API Docs:    http://localhost:8000/docs"
    echo -e "   🔍 FHIR API:    http://localhost:8000/fhir/R4"
    echo ""
    echo -e "${CYAN}✨ Features Available:${NC}"
    echo -e "   💊 Pharmacy Workflows with Medication Dispensing"
    echo -e "   🩻 DICOM Imaging Viewer with Real Images"
    echo -e "   📊 Lab Results with Reference Ranges & Trends"
    echo -e "   🔄 Cross-Module Clinical Workflow Integration"
    echo -e "   🔐 Dual-Mode Authentication (Simple + JWT)"
    echo -e "   🔍 Enhanced FHIR Search with Reference Resolution"
    echo ""
    echo -e "${CYAN}🛠️  Management Commands:${NC}"
    echo -e "   Stop services:     docker-compose down"
    echo -e "   View logs:         docker-compose logs -f"
    echo -e "   Restart:           ./deploy.sh"
    echo -e "   Generate more data: docker exec emr-backend python scripts/synthea_master.py generate --count 10"
    echo ""
    
    if [ "$ENVIRONMENT" = "aws" ]; then
        # Get EC2 instance public IP
        PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")
        echo -e "${YELLOW}🌍 AWS Deployment Notes:${NC}"
        echo -e "   External Frontend: http://${PUBLIC_IP}:3000"
        echo -e "   External Backend:  http://${PUBLIC_IP}:8000"
        echo -e "   🔥 Security Groups: Ensure ports 3000, 8000 are open"
        echo ""
    fi
    
    echo -e "${YELLOW}💡 Tip: Press Ctrl+C to stop all services${NC}"
}

# Function to save deployment configuration
save_deployment_config() {
    cat > .deployment-config << EOF
# MedGenEMR Deployment Configuration
# Generated: $(date)
PATIENT_COUNT=$PATIENT_COUNT
VALIDATION_MODE=$VALIDATION_MODE
INCLUDE_DICOM=$INCLUDE_DICOM
ENVIRONMENT=$ENVIRONMENT
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    echo -e "${GREEN}✅ Deployment configuration saved to .deployment-config${NC}"
}

# Main deployment flow
main() {
    echo -e "${PURPLE}Starting deployment process...${NC}"
    
    check_directory
    detect_environment
    install_dependencies
    stop_existing_services
    start_containers
    initialize_database
    setup_synthea
    generate_patient_data
    generate_dicom_images
    validate_deployment
    save_deployment_config
    display_status
    
    echo -e "${GREEN}🚀 Deployment completed successfully!${NC}"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --skip-data)
            SKIP_DATA_GENERATION=true
            shift
            ;;
        --no-dicom)
            INCLUDE_DICOM=false
            shift
            ;;
        --validation)
            VALIDATION_MODE="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --help)
            echo "MedGenEMR Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --patients N       Number of patients to generate (default: 5)"
            echo "  --skip-data        Skip patient data generation"
            echo "  --no-dicom         Skip DICOM image generation"
            echo "  --validation MODE  Validation mode: light|strict (default: light)"
            echo "  --environment ENV  Force environment: local|aws|linux (auto-detect)"
            echo "  --help             Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  PATIENT_COUNT      Number of patients (default: 5)"
            echo "  SKIP_DATA_GENERATION  true|false (default: false)"
            echo "  INCLUDE_DICOM      true|false (default: true)"
            echo "  VALIDATION_MODE    light|strict (default: light)"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh                           # Default deployment"
            echo "  ./deploy.sh --patients 10             # Generate 10 patients"
            echo "  ./deploy.sh --skip-data --no-dicom    # Infrastructure only"
            echo "  PATIENT_COUNT=20 ./deploy.sh          # Environment variable"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main deployment
main