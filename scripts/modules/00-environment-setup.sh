#!/bin/bash

# =============================================================================
# Module 00: Environment Setup
# =============================================================================
# Handles Docker cleanup, permissions, and environment preparation

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
MODE="development"
ROOT_DIR=""
FORCE_CLEAN=false
SKIP_BUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --root-dir=*)
            ROOT_DIR="${1#*=}"
            shift
            ;;
        --force-clean=*)
            FORCE_CLEAN="${1#*=}"
            shift
            ;;
        --skip-build=*)
            SKIP_BUILD="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

log() {
    echo -e "${BLUE}[ENV-SETUP]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Change to root directory
cd "$ROOT_DIR"

log "🧹 Starting environment cleanup and setup..."

# Step 1: Stop and clean existing containers
log "Stopping existing containers..."
docker-compose down -v --remove-orphans || true

if [ "$FORCE_CLEAN" = "true" ]; then
    log "Force clean enabled - removing all Docker resources..."
    docker system prune -af || true
    
    # Remove specific volumes if they exist
    docker volume rm wintehr_postgres_data 2>/dev/null || true
    
    # Clean up synthea and data directories
    rm -rf backend/synthea || true
    rm -rf backend/data/synthea_backups/* 2>/dev/null || true
    rm -rf backend/data/generated_dicoms/* 2>/dev/null || true
    rm -rf backend/data/dicom_uploads/* 2>/dev/null || true
    
    success "Force clean completed"
else
    log "Standard cleanup (preserving cached images)..."
    docker system prune -f || true
fi

# Step 2: Fix permissions and line endings
log "Setting up file permissions..."

# Make all shell scripts executable
find . -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Fix Python scripts permissions
find backend/scripts -name "*.py" -exec chmod +x {} \; 2>/dev/null || true

# Fix Docker entrypoint
chmod +x backend/docker-entrypoint.sh 2>/dev/null || true

# Fix line endings for shell scripts (handles Windows/Mac compatibility)
log "Fixing line endings..."
if command -v dos2unix > /dev/null 2>&1; then
    find . -name "*.sh" -exec dos2unix {} \; 2>/dev/null || true
else
    # Manual fix for systems without dos2unix
    find . -name "*.sh" -exec sed -i.bak 's/\r$//' {} \; 2>/dev/null || true
    # Clean up backup files
    find . -name "*.bak" -delete 2>/dev/null || true
fi

success "File permissions and line endings fixed"

# Step 3: Verify Docker environment
log "Verifying Docker environment..."

# Check Docker version
DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
log "Docker version: $DOCKER_VERSION"

# Check available resources
DOCKER_MEMORY=$(docker system info --format '{{.MemTotal}}' 2>/dev/null || echo "unknown")
AVAILABLE_SPACE=$(df -h . | tail -1 | awk '{print $4}')

log "Available disk space: $AVAILABLE_SPACE"
if [ "$DOCKER_MEMORY" != "unknown" ]; then
    MEMORY_GB=$((DOCKER_MEMORY / 1024 / 1024 / 1024))
    log "Docker memory limit: ${MEMORY_GB}GB"
    
    if [ $MEMORY_GB -lt 4 ]; then
        warning "Docker memory is less than 4GB. Consider increasing for better performance."
    fi
fi

# Check for port conflicts
log "Checking for port conflicts..."
PORTS_IN_USE=""
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORTS_IN_USE="$PORTS_IN_USE 80"
fi
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORTS_IN_USE="$PORTS_IN_USE 8000"
fi
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORTS_IN_USE="$PORTS_IN_USE 5432"
fi

if [ -n "$PORTS_IN_USE" ]; then
    warning "Ports in use:$PORTS_IN_USE"
    log "Attempting to free ports..."
    
    # Kill processes on our ports
    for port in $PORTS_IN_USE; do
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        log "Freed port $port"
    done
fi

# Step 4: Create necessary directories
log "Creating directory structure..."

# Backend directories
mkdir -p backend/data/generated_dicoms
mkdir -p backend/data/dicom_uploads
mkdir -p backend/data/synthea_backups
mkdir -p backend/logs
mkdir -p backend/exports

# Frontend directories
mkdir -p frontend/build
mkdir -p logs

# Set proper ownership (if running as non-root)
if [ "$(id -u)" != "0" ]; then
    # Ensure current user owns the directories
    chown -R "$(id -u):$(id -g)" backend/data/ 2>/dev/null || true
    chown -R "$(id -u):$(id -g)" logs/ 2>/dev/null || true
fi

success "Directory structure created"

# Step 5: Environment-specific setup
log "Configuring for $MODE mode..."

if [ "$MODE" = "production" ]; then
    # Production-specific setup
    export JWT_ENABLED=true
    export NODE_ENV=production
    log "Production mode: JWT authentication enabled"
    
    # Verify SSL certificates if needed
    # (Add SSL setup here if required)
    
else
    # Development mode setup
    export JWT_ENABLED=false
    export NODE_ENV=development
    log "Development mode: Simple authentication enabled"
fi

# Step 6: Docker network setup
log "Setting up Docker networks..."

# Ensure our network exists (docker-compose will create it, but this helps with debugging)
docker network ls | grep -q emr-network || {
    log "Creating Docker network..."
    # Docker compose will handle this, but we can pre-create if needed
}

# Step 7: Build containers (unless skipped)
if [ "$SKIP_BUILD" = "false" ]; then
    log "Building Docker containers..."
    
    if [ "$MODE" = "production" ]; then
        log "Building for production with optimizations..."
        docker-compose build --no-cache --parallel
    else
        log "Building for development..."
        docker-compose build --parallel
    fi
    
    success "Docker containers built successfully"
else
    log "Skipping Docker build as requested"
fi

# Step 8: Final validation
log "Validating environment setup..."

# Check Docker Compose file exists and is valid
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml not found"
fi

if ! docker-compose config >/dev/null 2>&1; then
    error "docker-compose.yml is invalid"
fi

# Check for required files
REQUIRED_FILES=(
    "backend/main.py"
    "backend/requirements.txt"
    "frontend/package.json"
    "backend/scripts/init_database_definitive.py"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Required file missing: $file"
    fi
done

success "Environment validation passed"

# Step 9: Start base services
log "Starting core services..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to start..."
timeout=60
while ! docker exec emr-postgres pg_isready -U emr_user -d emr_db >/dev/null 2>&1; do
    if [ $timeout -eq 0 ]; then
        error "PostgreSQL failed to start within 60 seconds"
    fi
    sleep 1
    ((timeout--))
done

success "PostgreSQL is ready"

log "🎉 Environment setup completed successfully!"
log "Mode: $MODE"
log "Skip Build: $SKIP_BUILD"
log "Force Clean: $FORCE_CLEAN"