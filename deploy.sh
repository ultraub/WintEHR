#!/bin/bash
# WintEHR Main Deployment Orchestrator
# Single-command deployment for WintEHR with HAPI FHIR
#
# Usage:
#   ./deploy.sh                      # Deploy with dev profile (default)
#   ./deploy.sh --environment prod   # Deploy with prod profile
#   ./deploy.sh --validate-only      # Only validate configuration
#   ./deploy.sh --help               # Show help
#
# Uses Docker Compose profiles: dev (default), prod

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

# Read environment from config.yaml if present (before setting PROFILE)
# Maps: production -> prod, development -> dev
if [ -z "$ENVIRONMENT" ] && [ -f "config.yaml" ]; then
    CONFIG_ENV=$(grep -E "^\s*environment:" config.yaml | head -1 | sed 's/.*environment:\s*//' | tr -d ' "'"'"'')
    if [ -n "$CONFIG_ENV" ]; then
        case "$CONFIG_ENV" in
            production) ENVIRONMENT="prod" ;;
            development) ENVIRONMENT="dev" ;;
            prod|dev) ENVIRONMENT="$CONFIG_ENV" ;;
        esac
    fi
fi

# Default profile (now respects config.yaml)
PROFILE="${ENVIRONMENT:-dev}"

# Docker compose command with profile
docker_compose() {
    docker compose --profile "$PROFILE" "$@"
}

# Handle special commands first
case "$1" in
    stop)
        echo -e "${YELLOW}Stopping WintEHR services...${NC}"
        # Stop all profiles
        docker compose --profile dev --profile prod down 2>/dev/null || docker compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        exit 0
        ;;
    clean)
        echo -e "${YELLOW}Cleaning WintEHR deployment (removing all data)...${NC}"
        docker compose --profile dev --profile prod down -v 2>/dev/null || docker compose down -v
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
        docker compose ps
        echo ""
        echo -e "${BLUE}Resource Summary:${NC}"
        docker exec emr-postgres psql -U ${POSTGRES_USER:-emr_user} -d ${POSTGRES_DB:-emr_db} -c "
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
            docker compose logs -f --tail=100
        else
            docker compose logs -f --tail=100 "$SERVICE"
        fi
        exit 0
        ;;
esac

# Default options
VALIDATE_ONLY=false
ENVIRONMENT=""
SKIP_BUILD=false
SKIP_DATA=false
CLEAN_FIRST=false
BASE_URL=""

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
        --clean-first)
            CLEAN_FIRST=true
            shift
            ;;
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        --help|-h)
            cat << EOF
WintEHR Deployment Script

Usage:
  ./deploy.sh [COMMAND] [OPTIONS]

Commands:
  (default)     Full deployment
  stop          Stop all services
  clean         Complete cleanup (removes all data)
  status        Show service status and resource counts
  logs [svc]    View service logs (optional: specify service name)

Options:
  --environment, -e ENV    Docker Compose profile: dev (default), prod
  --validate-only          Validate configuration without deploying
  --skip-build             Skip Docker image builds
  --skip-data              Skip patient data generation
  --clean-first            Wipe server completely before deployment
  --base-url URL           Base URL for DICOM endpoints (e.g., https://server.com)
  --help, -h               Show this help message

Examples:
  ./deploy.sh                          # Dev deployment (default)
  ./deploy.sh --environment prod       # Production deployment
  ./deploy.sh --validate-only          # Only validate config
  ./deploy.sh --skip-data              # Deploy without generating data
  ./deploy.sh stop                     # Stop all services
  ./deploy.sh clean                    # Remove all containers and data
  ./deploy.sh logs backend             # View backend logs

Configuration:
  1. Copy .env.example to .env
  2. Edit .env with your settings
  3. Run: ./deploy.sh

Docker Compose Profiles:
  dev  - Development mode with hot reload, all ports exposed
  prod - Production mode with nginx, SSL, optimized settings

For more information, see docs/DEPLOYMENT.md
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

# Set profile from environment argument
if [ -n "$ENVIRONMENT" ]; then
    PROFILE="$ENVIRONMENT"
fi

# Validate profile
if [[ ! "$PROFILE" =~ ^(dev|prod)$ ]]; then
    echo -e "${RED}❌ Invalid environment: $PROFILE${NC}"
    echo "   Valid options: dev, prod"
    exit 1
fi

# Print header
echo "=============================================================================="
echo "                    WintEHR Deployment Orchestrator"
echo "=============================================================================="
echo ""
echo "Profile: $PROFILE"
echo ""

# Execute cleanup if --clean-first flag is set
if [ "$CLEAN_FIRST" = true ]; then
    echo -e "${YELLOW}CLEANUP MODE: Wiping server before deployment${NC}"
    echo ""

    if [ -f "./cleanup-server.sh" ]; then
        echo -e "${BLUE}Executing cleanup script...${NC}"
        bash ./cleanup-server.sh
        echo ""
        echo -e "${GREEN}✅ Server wiped - ready for fresh deployment${NC}"
        echo ""
    else
        echo -e "${YELLOW}⚠️  No cleanup script found, using docker compose clean${NC}"
        docker compose --profile dev --profile prod down -v
        docker system prune -f
        echo -e "${GREEN}✅ Server wiped - ready for fresh deployment${NC}"
        echo ""
    fi
fi

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker is not installed${NC}"
    exit 1
fi

# Check for docker compose (v2) or docker-compose (v1)
if docker compose version &> /dev/null; then
    echo "   Using Docker Compose v2"
elif command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose v1 detected, please upgrade to v2${NC}"
    # Create alias for compatibility
    docker_compose() {
        docker-compose "$@"
    }
else
    echo -e "${RED}❌ Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Check for .env file
echo -e "${BLUE}📋 Checking configuration...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}⚠️  .env file not found - creating from .env.example${NC}"
        cp .env.example .env
        echo "   Created .env from .env.example"
        echo "   Please review and update settings as needed"
    else
        echo -e "${RED}❌ Error: No .env or .env.example found${NC}"
        exit 1
    fi
fi

# Load .env file
set -a
source .env
set +a

echo -e "${GREEN}✅ Configuration loaded${NC}"
echo "   Profile: $PROFILE"
echo "   Environment: ${ENVIRONMENT:-dev}"
echo ""

# Optional: Load additional config from config.yaml if present
if [ -f "config.yaml" ] && [ -f "deploy/load_config.sh" ]; then
    echo -e "${BLUE}📋 Loading additional configuration from config.yaml...${NC}"
    source deploy/load_config.sh ${ENVIRONMENT:+"$ENVIRONMENT"} 2>/dev/null || true
    echo -e "${GREEN}✅ Additional configuration loaded${NC}"
    echo ""
fi

# Validate configuration (if validator exists)
if [ -f "deploy/validate_config.py" ]; then
    echo -e "${BLUE}🔍 Validating configuration...${NC}"
    if python3 deploy/validate_config.py ${ENVIRONMENT:+--environment "$ENVIRONMENT"} 2>/dev/null; then
        echo -e "${GREEN}✅ Configuration validation passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Configuration validation skipped or had warnings${NC}"
    fi
    echo ""
fi

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
    echo -e "${BLUE}🔨 Building Docker images for profile: $PROFILE...${NC}"

    docker_compose build

    echo -e "${GREEN}✅ Docker images built${NC}"
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping Docker image build${NC}"
    echo ""
fi

# Step 2: Start services
echo -e "${BLUE}🚀 Starting services with profile: $PROFILE...${NC}"

docker_compose up -d

echo -e "${GREEN}✅ Services started${NC}"
echo ""

# Step 2.5: Sync PostgreSQL password with .env
# This fixes an issue where PostgreSQL was initialized with a different password
# than what's currently in .env (init scripts only run on first database creation)
echo -e "${BLUE}🔐 Syncing database credentials...${NC}"

# Wait for PostgreSQL to be ready
for i in {1..30}; do
    if docker exec emr-postgres pg_isready -U ${POSTGRES_USER:-emr_user} -d ${POSTGRES_DB:-emr_db} > /dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  PostgreSQL not ready, skipping password sync${NC}"
    fi
    sleep 1
done

# Sync password to match .env (runs via Unix socket which doesn't require password)
if [ -n "${POSTGRES_PASSWORD}" ]; then
    docker exec emr-postgres psql -U ${POSTGRES_USER:-emr_user} -d ${POSTGRES_DB:-emr_db} \
        -c "ALTER USER ${POSTGRES_USER:-emr_user} WITH PASSWORD '${POSTGRES_PASSWORD}';" > /dev/null 2>&1 && \
        echo -e "   ${GREEN}✓ Database credentials synchronized${NC}" || \
        echo -e "   ${YELLOW}⚠️  Password sync skipped (may already be in sync)${NC}"
fi
echo ""

# Step 3: Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"

# Use port variables from .env or defaults
HAPI_PORT="${HAPI_FHIR_PORT:-8888}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# Wait for HAPI FHIR (takes 5-6 minutes on first startup)
echo "   Waiting for HAPI FHIR on port $HAPI_PORT (this may take several minutes on first startup)..."
for i in {1..180}; do
    if curl -sf "http://localhost:${HAPI_PORT}/fhir/metadata" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ HAPI FHIR is ready${NC}"
        break
    fi
    if [ $i -eq 180 ]; then
        echo -e "   ${RED}✗ HAPI FHIR failed to start after 9 minutes${NC}"
        echo "   Check logs: docker compose logs hapi-fhir"
        exit 1
    fi
    # Show progress every 30 seconds
    if [ $((i % 15)) -eq 0 ]; then
        echo "   Still waiting... ($((i * 3 / 60)) minutes elapsed)"
    fi
    sleep 3
done

# Wait for backend
echo "   Waiting for backend on port $BACKEND_PORT..."
for i in {1..30}; do
    if curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
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
# Use environment variable or config, or default to 20 for dev, 100 for prod
PATIENT_COUNT="${WINTEHR_DEPLOYMENT_PATIENT_COUNT:-${PATIENT_COUNT:-20}}"
if [ "$PROFILE" = "prod" ] && [ "$PATIENT_COUNT" = "20" ]; then
    PATIENT_COUNT=100
fi
SYNTHEA_STATE="${WINTEHR_SYNTHEA_STATE:-${SYNTHEA_STATE:-Massachusetts}}"

if [ "$SKIP_DATA" = false ]; then
    echo -e "${BLUE}👥 Loading patient data (${PATIENT_COUNT} patients)...${NC}"
    echo "   This may take several minutes..."

    # Run the Synthea to HAPI pipeline
    # Syntax: synthea_to_hapi_pipeline.py <count> <state>
    if docker exec emr-backend \
        python scripts/synthea_to_hapi_pipeline.py \
        ${PATIENT_COUNT} \
        "${SYNTHEA_STATE}"; then
        echo -e "${GREEN}✅ Patient data loaded successfully${NC}"
        echo "   Generated ${PATIENT_COUNT} synthetic patients"
    else
        echo -e "${RED}❌ Failed to load patient data${NC}"
        echo "   Check logs: docker compose logs emr-backend"
        echo "   Or run manually: docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py ${PATIENT_COUNT} ${SYNTHEA_STATE}"
        exit 1
    fi

    # Load CDS services as PlanDefinition resources
    echo -e "${BLUE}🤖 Loading CDS services to HAPI FHIR...${NC}"
    if docker exec emr-backend \
        python scripts/active/load_cds_services_to_hapi.py; then
        echo -e "${GREEN}✅ CDS services loaded successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  CDS service loading had issues (non-critical)${NC}"
        echo "   CDS Studio may not show pre-configured services"
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

    # Create DICOM Endpoint resources and link to ImagingStudy resources
    echo -e "${BLUE}🔗 Creating DICOM Endpoint resources...${NC}"

    # Build DICOM endpoint creation command with optional base URL
    DICOM_ENDPOINT_CMD="python scripts/active/create_dicom_endpoints.py"
    if [ -n "$BASE_URL" ]; then
        DICOM_ENDPOINT_CMD="$DICOM_ENDPOINT_CMD --base-url $BASE_URL"
        echo "   Using base URL: $BASE_URL"
    fi

    if docker exec emr-backend $DICOM_ENDPOINT_CMD; then
        echo -e "${GREEN}✅ DICOM Endpoints created and linked successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  DICOM Endpoint creation had issues (non-critical)${NC}"
        echo "   DICOM files may not be accessible through the imaging tab"
    fi

    # Create demo Practitioner resources
    echo -e "${BLUE}👨‍⚕️ Creating demo Practitioner resources...${NC}"
    if docker exec emr-backend \
        python scripts/active/create_demo_practitioners.py; then
        echo -e "${GREEN}✅ Demo Practitioners created successfully${NC}"
        echo "   Demo users (physician, nurse, pharmacist, admin) now have valid Practitioner resources"
    else
        echo -e "${YELLOW}⚠️  Demo Practitioner creation had issues (non-critical)${NC}"
        echo "   Demo users may need to be created manually"
    fi
    echo ""
else
    echo -e "${YELLOW}⏭️  Skipping patient data generation (--skip-data flag)${NC}"
    echo ""
fi

# Step 5: Configure Azure NSG (if Azure deployment and prod profile)
AZURE_RESOURCE_GROUP="${WINTEHR_AZURE_RESOURCE_GROUP:-${AZURE_RESOURCE_GROUP:-}}"
if [ -n "$AZURE_RESOURCE_GROUP" ] && [ "$PROFILE" = "prod" ]; then
    echo -e "${BLUE}🔒 Configuring Azure Network Security Group...${NC}"

    if [ -f "deploy/configure-azure-nsg.sh" ]; then
        bash deploy/configure-azure-nsg.sh
        echo -e "${GREEN}✅ Azure NSG configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Azure NSG configuration script not found${NC}"
    fi
    echo ""
fi

# Step 6: Setup SSL (for prod profile with domain configured)
SSL_DOMAIN="${WINTEHR_SSL_DOMAIN_NAME:-${DOMAIN:-localhost}}"
if [ "$PROFILE" = "prod" ] && [ "$SSL_DOMAIN" != "localhost" ]; then
    echo -e "${BLUE}🔒 Setting up SSL certificate for ${SSL_DOMAIN}...${NC}"

    if [ -f "deploy/setup-ssl.sh" ]; then
        bash deploy/setup-ssl.sh
        echo -e "${GREEN}✅ SSL certificate configured${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL setup script not found${NC}"
        echo "   Manually configure SSL certificate for: $SSL_DOMAIN"
    fi
    echo ""
fi

# Step 7: Verification
echo -e "${BLUE}🔍 Verifying deployment...${NC}"

# Check resource counts
echo "   Checking FHIR resources..."
for resource_type in Patient Condition Observation MedicationRequest; do
    count=$(curl -s "http://localhost:${HAPI_PORT}/fhir/${resource_type}?_summary=count" | \
            grep -o '"total":[0-9]*' | cut -d: -f2 || echo "0")
    printf "   %-20s %s\n" "$resource_type:" "$count"
done

echo ""
echo -e "${GREEN}✅ Verification complete${NC}"
echo ""

# Deployment complete
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

echo "=============================================================================="
echo "                      Deployment Complete! 🎉"
echo "=============================================================================="
echo ""
echo "Profile: $PROFILE"
echo ""
echo "Service URLs:"
echo "  Frontend:    http://localhost:${FRONTEND_PORT}"
echo "  Backend API: http://localhost:${BACKEND_PORT}"
echo "  HAPI FHIR:   http://localhost:${HAPI_PORT}/fhir"
echo ""

if [ "$PROFILE" = "prod" ] && [ "$SSL_DOMAIN" != "localhost" ]; then
    echo "Public URL:  https://${SSL_DOMAIN}"
    echo ""
fi

echo "Useful commands:"
echo "  View logs:       ./deploy.sh logs"
echo "  Stop services:   ./deploy.sh stop"
echo "  Restart:         docker compose restart"
echo "  Status:          ./deploy.sh status"
echo ""
echo "For troubleshooting, see documentation in docs/DEPLOYMENT.md"
echo "=============================================================================="