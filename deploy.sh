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
        --domain)
            DEPLOY_DOMAIN="$2"
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
  --domain DOMAIN          Domain name for production (auto-configures .env)
  --validate-only          Validate configuration without deploying
  --skip-build             Skip Docker image builds
  --skip-data              Skip patient data generation
  --clean-first            Wipe server completely before deployment
  --base-url URL           Base URL for DICOM endpoints (e.g., https://server.com)
  --help, -h               Show this help message

Examples:
  ./deploy.sh                          # Dev deployment (default)
  ./deploy.sh --environment prod       # Production deployment
  ./deploy.sh -e prod --domain example.com  # Production with auto-configured domain
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

# Auto-configure production settings if needed
if [ "$PROFILE" = "prod" ]; then
    CURRENT_DOMAIN="${DOMAIN:-localhost}"

    # If --domain was provided, use it
    if [ -n "$DEPLOY_DOMAIN" ]; then
        CURRENT_DOMAIN="$DEPLOY_DOMAIN"
    fi

    # Check if domain needs configuration
    if [ "$CURRENT_DOMAIN" = "localhost" ]; then
        echo -e "${YELLOW}⚠️  Production deployment requires a domain name${NC}"
        echo "   Current DOMAIN in .env: localhost"
        echo ""

        if [ -t 0 ]; then
            # Interactive mode - prompt for domain
            read -p "Enter your domain name (e.g., example.com): " DEPLOY_DOMAIN
            if [ -z "$DEPLOY_DOMAIN" ]; then
                echo -e "${RED}❌ Domain name is required for production deployment${NC}"
                exit 1
            fi
            CURRENT_DOMAIN="$DEPLOY_DOMAIN"
        else
            # Non-interactive mode - fail
            echo -e "${RED}❌ Error: Production deployment requires --domain flag${NC}"
            echo "   Usage: ./deploy.sh -e prod --domain example.com"
            exit 1
        fi
    fi

    # Update .env with production values if domain changed or is new
    if [ "$CURRENT_DOMAIN" != "localhost" ]; then
        echo -e "${BLUE}🔧 Configuring production settings for: $CURRENT_DOMAIN${NC}"

        # Update all production values in .env
        sed -i.bak \
            -e "s|^DOMAIN=.*|DOMAIN=$CURRENT_DOMAIN|" \
            -e "s|^ENVIRONMENT=.*|ENVIRONMENT=prod|" \
            -e "s|^REACT_APP_API_URL=.*|REACT_APP_API_URL=https://$CURRENT_DOMAIN|" \
            -e "s|^REACT_APP_FHIR_ENDPOINT=.*|REACT_APP_FHIR_ENDPOINT=https://$CURRENT_DOMAIN/fhir/R4|" \
            -e "s|^REACT_APP_EMR_API=.*|REACT_APP_EMR_API=https://$CURRENT_DOMAIN/api/emr|" \
            -e "s|^REACT_APP_CLINICAL_CANVAS_API=.*|REACT_APP_CLINICAL_CANVAS_API=https://$CURRENT_DOMAIN/api/clinical-canvas|" \
            -e "s|^REACT_APP_WS_URL=.*|REACT_APP_WS_URL=wss://$CURRENT_DOMAIN/ws|" \
            .env
        rm -f .env.bak

        # Update nginx-prod.conf SSL certificate paths
        if [ -f "nginx-prod.conf" ]; then
            sed -i.bak \
                -e "s|/etc/letsencrypt/live/[^/]*/fullchain.pem|/etc/letsencrypt/live/$CURRENT_DOMAIN/fullchain.pem|g" \
                -e "s|/etc/letsencrypt/live/[^/]*/privkey.pem|/etc/letsencrypt/live/$CURRENT_DOMAIN/privkey.pem|g" \
                nginx-prod.conf
            rm -f nginx-prod.conf.bak
        fi

        # Reload .env with updated values
        set -a
        source .env
        set +a

        echo -e "${GREEN}✅ Production configuration updated${NC}"
        echo "   Domain: $CURRENT_DOMAIN"
        echo "   API URL: https://$CURRENT_DOMAIN"
        echo "   FHIR: https://$CURRENT_DOMAIN/fhir/R4"
        echo ""
    fi
fi

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

# Step 0: Ensure bind-mount directories are writable by the non-root container
# user (UID 1000 / emruser). Without this, the backend entrypoint fails on
# pre-existing host files owned by root from earlier deployments.
EMRUSER_UID=1000
BIND_MOUNTS=("data" "logs" "backend/data/generated_dicoms")
NEEDS_CHOWN=false
for d in "${BIND_MOUNTS[@]}"; do
    if [ -e "$d" ]; then
        OWNER=$(stat -c '%u' "$d" 2>/dev/null || stat -f '%u' "$d" 2>/dev/null)
        if [ "$OWNER" != "$EMRUSER_UID" ]; then
            NEEDS_CHOWN=true
            break
        fi
    fi
done
if [ "$NEEDS_CHOWN" = true ]; then
    echo -e "${BLUE}🔐 Aligning bind-mount ownership to container UID ${EMRUSER_UID}...${NC}"
    for d in "${BIND_MOUNTS[@]}"; do
        mkdir -p "$d"
        if [ "$(id -u)" -eq 0 ]; then
            chown -R "${EMRUSER_UID}:${EMRUSER_UID}" "$d"
        else
            sudo -n chown -R "${EMRUSER_UID}:${EMRUSER_UID}" "$d" 2>/dev/null || \
                chown -R "${EMRUSER_UID}:${EMRUSER_UID}" "$d" 2>/dev/null || \
                echo -e "${YELLOW}   ⚠️  Could not chown $d (non-root sudo unavailable)${NC}"
        fi
    done
    echo -e "${GREEN}✅ Bind-mount ownership aligned${NC}"
    echo ""
fi

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

# Use port variables from .env or defaults (these only apply in the dev
# profile — prod doesn't publish these ports externally).
HAPI_PORT="${HAPI_FHIR_PORT:-8888}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# Health checks work under both profiles. The HAPI FHIR image is minimal Java
# (no curl), so we probe it through the backend container which is on the same
# Docker network and has curl installed. Backend's own health probe goes to
# its local port 8000 inside its own container.
echo "   Waiting for HAPI FHIR (this may take several minutes on first startup)..."
for i in {1..180}; do
    if docker exec emr-backend curl -sf "http://hapi-fhir:8080/fhir/metadata" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ HAPI FHIR is ready${NC}"
        break
    fi
    if [ $i -eq 180 ]; then
        echo -e "   ${RED}✗ HAPI FHIR failed to start after 9 minutes${NC}"
        echo "   Check logs: docker compose logs hapi-fhir-${PROFILE}"
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
    if docker exec emr-backend curl -sf "http://localhost:8000/health" > /dev/null 2>&1; then
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

    # Create DICOM Endpoint resources and link to ImagingStudy resources.
    # The FHIR Endpoint.address must be an absolute URL that the browser can
    # resolve — not the container-internal http://localhost:8000. Derive from
    # $BASE_URL if set, otherwise from $DOMAIN (prod) or fall back to the dev
    # localhost default used by the script.
    echo -e "${BLUE}🔗 Creating DICOM Endpoint resources...${NC}"

    DICOM_ENDPOINT_CMD="python scripts/active/create_dicom_endpoints.py"
    EFFECTIVE_BASE_URL="$BASE_URL"
    if [ -z "$EFFECTIVE_BASE_URL" ] && [ "$PROFILE" = "prod" ] && [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
        EFFECTIVE_BASE_URL="https://$DOMAIN"
    fi
    if [ -n "$EFFECTIVE_BASE_URL" ]; then
        DICOM_ENDPOINT_CMD="$DICOM_ENDPOINT_CMD --base-url $EFFECTIVE_BASE_URL"
        echo "   Using base URL: $EFFECTIVE_BASE_URL"
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

# ============================================================================
# Terminology loading (optional)
# ============================================================================
# If HAPI has no CodeSystems yet, try to populate it from one of three sources,
# in order of preference. All paths run in background — the load itself takes
# 1-4 hours and we don't want deploy.sh to block. Progress is in ./terminology_load.log.
#
#   1. Pre-extracted JSON at ~/fhir_vocabularies/terminology/*.json exists
#      → load directly (fastest, no download)
#   2. UMLS_API_KEY is set in .env
#      → download UMLS MRCONSO → extract → load
#   3. Neither → skip silently; operator runs manually when ready
echo -e "${BLUE}📚 Checking terminology state...${NC}"
HAPI_CS_COUNT=$(docker exec emr-backend curl -sf \
    "http://hapi-fhir:8080/fhir/CodeSystem?url=http://www.nlm.nih.gov/research/umls/rxnorm&_summary=count" \
    2>/dev/null | python3 -c "import json,sys
try:
    print(json.load(sys.stdin).get('total', 0))
except Exception:
    print(0)" 2>/dev/null || echo 0)

if [ "$HAPI_CS_COUNT" != "0" ]; then
    echo -e "${GREEN}✓ Terminology already loaded (RxNorm CodeSystem present in HAPI)${NC}"
elif [ -d "$HOME/fhir_vocabularies/terminology" ] && \
     [ -n "$(ls -A $HOME/fhir_vocabularies/terminology/*.json 2>/dev/null)" ]; then
    echo -e "${BLUE}   Found pre-extracted JSON at ~/fhir_vocabularies/terminology/${NC}"
    echo -e "${BLUE}   Loading in background — tail terminology_load.log for progress${NC}"
    nohup python3 scripts/load_terminology.py "$HOME/fhir_vocabularies" \
        --hapi-url http://localhost:8080/fhir \
        --timeout 600 \
        > terminology_load.log 2>&1 &
    LOAD_PID=$!
    echo "   PID $LOAD_PID, logging to ./terminology_load.log"
elif [ -n "$UMLS_API_KEY" ]; then
    echo -e "${BLUE}   Found UMLS_API_KEY — downloading and loading in background${NC}"
    echo -e "${BLUE}   Full pipeline (~3 hours); tail terminology_load.log for progress${NC}"
    nohup bash -c "
        set -e
        python3 scripts/download_umls.py \$HOME/umls_source && \\
        python3 scripts/extract_vocabularies.py \$HOME/umls_source \$HOME/fhir_vocabularies && \\
        python3 scripts/load_terminology.py \$HOME/fhir_vocabularies \\
            --hapi-url http://localhost:8080/fhir --timeout 600
    " > terminology_load.log 2>&1 &
    LOAD_PID=$!
    echo "   PID $LOAD_PID, logging to ./terminology_load.log"
else
    echo -e "${YELLOW}   No pre-extracted JSON and no UMLS_API_KEY set — skipping terminology load${NC}"
    echo "   To enable: set UMLS_API_KEY in .env (see docs/TERMINOLOGY_SETUP.md)"
fi
echo ""

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

    # Check if certificates already exist
    CERT_FILE="./certbot/conf/live/$SSL_DOMAIN/fullchain.pem"
    if [ -f "$CERT_FILE" ]; then
        # Check if it's a real cert or placeholder
        ISSUER=$(openssl x509 -issuer -noout -in "$CERT_FILE" 2>/dev/null || echo "")
        if echo "$ISSUER" | grep -q "Let's Encrypt\|R3\|E1"; then
            echo -e "${GREEN}✅ Valid SSL certificate already exists${NC}"
        else
            echo -e "${YELLOW}⚠️  Placeholder certificate detected - obtaining real certificate...${NC}"
            if [ -f "deploy/init-ssl.sh" ]; then
                bash deploy/init-ssl.sh "$SSL_DOMAIN"
            fi
        fi
    else
        # No certificate exists - run full SSL setup
        if [ -f "deploy/init-ssl.sh" ]; then
            bash deploy/init-ssl.sh "$SSL_DOMAIN"
            echo -e "${GREEN}✅ SSL certificate configured${NC}"
        elif [ -f "deploy/setup-ssl.sh" ]; then
            bash deploy/setup-ssl.sh
            echo -e "${GREEN}✅ SSL certificate configured${NC}"
        else
            echo -e "${YELLOW}⚠️  SSL setup script not found${NC}"
            echo "   Run: ./deploy/init-ssl.sh $SSL_DOMAIN"
        fi
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