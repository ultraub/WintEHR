#!/bin/bash
# WintEHR Main Deployment Orchestrator
# Single-command deployment for WintEHR with HAPI FHIR
#
# Usage:
#   ./deploy.sh                    # Deploy with config.yaml settings
#   ./deploy.sh --environment dev  # Deploy with dev environment
#   ./deploy.sh --validate-only    # Only validate configuration
#   ./deploy.sh --help             # Show help

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Handle special commands first
case "$1" in
    stop)
        echo -e "${YELLOW}Stopping WintEHR services...${NC}"
        docker-compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        exit 0
        ;;
    clean)
        echo -e "${YELLOW}Cleaning WintEHR deployment (removing all data)...${NC}"
        docker-compose down -v
        docker system prune -f
        echo -e "${GREEN}✓ Clean complete${NC}"
        exit 0
        ;;
    status)
        # Load config for container names and ports
        if [ -f "deploy/load_config.sh" ]; then
            source deploy/load_config.sh 2>/dev/null || true
        fi

        echo -e "${BLUE}WintEHR Service Status:${NC}"
        docker-compose ps
        echo ""
        echo -e "${BLUE}Resource Summary:${NC}"
        docker exec ${WINTEHR_SERVICES_CONTAINER_NAMES_POSTGRES:-emr-postgres} psql -U ${POSTGRES_USER:-emr_user} -d ${POSTGRES_DB:-emr_db} -c "
            SELECT res_type as resource_type, COUNT(*) as count
            FROM hfj_resource
            WHERE res_deleted_at IS NULL
            GROUP BY res_type
            ORDER BY count DESC
            LIMIT 10;" 2>/dev/null || echo "Database not accessible"
        exit 0
        ;;
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose logs -f --tail=100
        else
            docker-compose logs -f --tail=100 "$SERVICE"
        fi
        exit 0
        ;;
esac

# Default options
VALIDATE_ONLY=false
ENVIRONMENT=""
SKIP_BUILD=false
SKIP_DATA=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-data)
            SKIP_DATA=true
            shift
            ;;
        --help|-h)
            cat << EOF
WintEHR Deployment Script

Usage:
  ./deploy.sh [OPTIONS]

Options:
  --environment, -e ENV    Specify environment (dev, staging, production)
  --validate-only          Validate configuration without deploying
  --skip-build             Skip Docker image builds
  --skip-data              Skip patient data generation
  --help, -h               Show this help message

Examples:
  ./deploy.sh                          # Full deployment
  ./deploy.sh --environment dev        # Deploy in dev mode
  ./deploy.sh --validate-only          # Only validate config
  ./deploy.sh --skip-data              # Deploy without generating data

Configuration:
  1. Copy config.example.yaml to config.yaml
  2. Copy .env.example to .env
  3. Edit both files with your settings
  4. Run: ./deploy.sh

For more information, see docs/CONFIGURATION.md
EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run './deploy.sh --help' for usage information"
            exit 1
            ;;
    esac
done

# Print header
echo "=============================================================================="
echo "                    WintEHR Deployment Orchestrator"
echo "=============================================================================="
echo ""

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Error: docker-compose is not installed${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Error: python3 is not installed${NC}"
    exit 1
fi

# Check Python dependencies
if ! python3 -c "import yaml" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Installing required Python packages...${NC}"
    pip3 install pyyaml python-dotenv
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Check for config files
echo -e "${BLUE}📋 Checking configuration files...${NC}"

if [ ! -f "config.yaml" ]; then
    echo -e "${RED}❌ Error: config.yaml not found${NC}"
    echo "   Copy config.example.yaml to config.yaml and customize it"
    echo "   Run: cp config.example.yaml config.yaml"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "   Copy .env.example to .env and set your secrets"
    echo "   Run: cp .env.example .env"
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Configuration files found${NC}"
echo ""

# Load configuration
echo -e "${BLUE}📋 Loading configuration...${NC}"

# Source the config loader
source deploy/load_config.sh ${ENVIRONMENT:+"$ENVIRONMENT"}

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to load configuration${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration loaded${NC}"
echo "   Environment: $WINTEHR_DEPLOYMENT_ENVIRONMENT"
echo "   Patient Count: $WINTEHR_DEPLOYMENT_PATIENT_COUNT"
echo "   SSL Enabled: $WINTEHR_DEPLOYMENT_ENABLE_SSL"
echo ""

# Validate configuration
echo -e "${BLUE}🔍 Validating configuration...${NC}"

if ! python3 deploy/validate_config.py ${ENVIRONMENT:+--environment "$ENVIRONMENT"}; then
    echo -e "${RED}❌ Configuration validation failed${NC}"
    echo "   Fix the errors above and try again"
    exit 1
fi

echo -e "${GREEN}✅ Configuration validation passed${NC}"
echo ""

# Stop here if validate-only
if [ "$VALIDATE_ONLY" = true ]; then
    echo -e "${GREEN}✅ Validation complete (--validate-only mode)${NC}"
    exit 0
fi

# Start deployment
echo "=============================================================================="
echo "                         Starting Deployment"
echo "=============================================================================="
echo ""

# Step 1: Build images (if not skipped)
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BLUE}🔨 Building Docker images...${NC}"

    if [ "$WINTEHR_DEPLOYMENT_ENABLE_SSL" = "true" ]; then
        docker-compose -f docker-compose.yml -f docker-compose-ssl.yml build
    else
        docker-compose build
    fi

    echo -e "${GREEN}✅ Docker images built${NC}"
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping Docker image build${NC}"
    echo ""
fi

# Step 2: Start services
echo -e "${BLUE}🚀 Starting services...${NC}"

if [ "$WINTEHR_DEPLOYMENT_ENABLE_SSL" = "true" ]; then
    docker-compose -f docker-compose.yml -f docker-compose-ssl.yml up -d
else
    docker-compose up -d
fi

echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 3: Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"

# Wait for HAPI FHIR (takes 5-6 minutes on first startup)
echo "   Waiting for HAPI FHIR (this may take several minutes on first startup)..."
for i in {1..180}; do
    if curl -sf "http://localhost:${WINTEHR_SERVICES_PORTS_HAPI_FHIR}/fhir/metadata" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ HAPI FHIR is ready${NC}"
        break
    fi
    if [ $i -eq 180 ]; then
        echo -e "   ${RED}✗ HAPI FHIR failed to start after 9 minutes${NC}"
        echo "   Check logs: docker-compose logs hapi-fhir"
        exit 1
    fi
    # Show progress every 30 seconds
    if [ $((i % 15)) -eq 0 ]; then
        echo "   Still waiting... ($((i * 3 / 60)) minutes elapsed)"
    fi
    sleep 3
done

# Wait for backend
echo "   Waiting for backend..."
for i in {1..30}; do
    if curl -sf "http://localhost:${WINTEHR_SERVICES_PORTS_BACKEND}/health" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "   ${YELLOW}⚠️  Backend may not be fully ready${NC}"
        break
    fi
    sleep 2
done

echo -e "${GREEN}✅ Services are healthy${NC}"
echo ""

# Step 4: Load patient data (if not skipped)
if [ "$SKIP_DATA" = false ]; then
    echo -e "${BLUE}👥 Loading patient data (${WINTEHR_DEPLOYMENT_PATIENT_COUNT} patients)...${NC}"
    echo "   This may take several minutes..."

    # Run the Synthea to HAPI pipeline
    # Syntax: synthea_to_hapi_pipeline.py <count> <state>
    if docker exec emr-backend \
        python scripts/synthea_to_hapi_pipeline.py \
        ${WINTEHR_DEPLOYMENT_PATIENT_COUNT} \
        "${WINTEHR_SYNTHEA_STATE}"; then
        echo -e "${GREEN}✅ Patient data loaded successfully${NC}"
        echo "   Generated ${WINTEHR_DEPLOYMENT_PATIENT_COUNT} synthetic patients"
    else
        echo -e "${RED}❌ Failed to load patient data${NC}"
        echo "   Check logs: docker-compose logs backend"
        echo "   Or run manually: docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py ${WINTEHR_DEPLOYMENT_PATIENT_COUNT} ${WINTEHR_SYNTHEA_STATE}"
        exit 1
    fi

    # Generate DICOM files for ImagingStudy resources
    echo -e "${BLUE}🏥 Generating DICOM files for imaging studies...${NC}"
    if docker exec emr-backend \
        python scripts/active/generate_dicom_from_hapi.py; then
        echo -e "${GREEN}✅ DICOM files generated successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  DICOM generation had issues (non-critical)${NC}"
        echo "   Imaging studies will be available without DICOM files"
    fi
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping patient data generation (--skip-data flag)${NC}"
    echo ""
fi

# Step 5: Configure Azure NSG (if Azure deployment)
if [ -n "$WINTEHR_AZURE_RESOURCE_GROUP" ]; then
    echo -e "${BLUE}🔒 Configuring Azure Network Security Group...${NC}"

    if [ -f "deploy/configure-azure-nsg.sh" ]; then
        bash deploy/configure-azure-nsg.sh
        echo -e "${GREEN}✅ Azure NSG configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Azure NSG configuration script not found${NC}"
    fi
    echo ""
fi

# Step 6: Setup SSL (if enabled)
if [ "$WINTEHR_DEPLOYMENT_ENABLE_SSL" = "true" ]; then
    echo -e "${BLUE}🔒 Setting up SSL certificate...${NC}"

    if [ -f "deploy/setup-ssl.sh" ]; then
        bash deploy/setup-ssl.sh
        echo -e "${GREEN}✅ SSL certificate configured${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL setup script not found${NC}"
        echo "   Manually configure SSL certificate for: $WINTEHR_SSL_DOMAIN_NAME"
    fi
    echo ""
fi

# Step 7: Verification
echo -e "${BLUE}🔍 Verifying deployment...${NC}"

# Check resource counts
echo "   Checking FHIR resources..."
for resource_type in Patient Condition Observation MedicationRequest; do
    count=$(curl -s "http://localhost:${WINTEHR_SERVICES_PORTS_HAPI_FHIR}/fhir/${resource_type}?_summary=count" | \
            grep -o '"total":[0-9]*' | cut -d: -f2 || echo "0")
    printf "   %-20s %s\n" "$resource_type:" "$count"
done

echo ""
echo -e "${GREEN}✅ Verification complete${NC}"
echo ""

# Deployment complete
echo "=============================================================================="
echo "                      Deployment Complete! 🎉"
echo "=============================================================================="
echo ""
echo "Service URLs:"
echo "  Frontend:    http://localhost:${WINTEHR_SERVICES_PORTS_FRONTEND}"
echo "  Backend API: http://localhost:${WINTEHR_SERVICES_PORTS_BACKEND}"
echo "  HAPI FHIR:   http://localhost:${WINTEHR_SERVICES_PORTS_HAPI_FHIR}/fhir"
echo ""

if [ "$WINTEHR_DEPLOYMENT_ENABLE_SSL" = "true" ]; then
    echo "Public URL:  https://${WINTEHR_SSL_DOMAIN_NAME}"
    echo ""
fi

echo "Useful commands:"
echo "  View logs:       docker-compose logs -f"
echo "  Stop services:   docker-compose down"
echo "  Restart:         docker-compose restart"
echo "  Status:          docker-compose ps"
echo ""
echo "For troubleshooting, see documentation in docs/"
echo "=============================================================================="