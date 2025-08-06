#!/bin/bash

# WintEHR Light Deployment Script for Resource-Constrained Servers
# Optimized for servers with <4GB RAM

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Timestamp function
timestamp() {
    date +"%H:%M:%S"
}

# Logging function
log() {
    echo -e "${2:-$CYAN}[$(timestamp)]${NC} $1"
}

# Default values
MODE="prod"
PATIENT_COUNT=20
OPTIMIZE_MEMORY=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        dev|prod)
            MODE=$1
            shift
            ;;
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --no-optimize)
            OPTIMIZE_MEMORY=false
            shift
            ;;
        *)
            log "Unknown option: $1" $RED
            exit 1
            ;;
    esac
done

log "🏥 WintEHR Light Deployment - $MODE mode with $PATIENT_COUNT patients" $BLUE

# ===== STEP 1: System Preparation =====
log "===== Preparing System for Light Deployment =====" $MAGENTA

# Check available memory
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')
log "System Memory: ${TOTAL_MEM}MB total, ${AVAILABLE_MEM}MB available" $CYAN

# Create swap if needed and not exists
if [ "$OPTIMIZE_MEMORY" = true ] && [ "$TOTAL_MEM" -lt 4096 ]; then
    log "Low memory detected. Setting up swap space..." $YELLOW
    
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 4G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        log "✅ 4GB swap space created" $GREEN
    else
        sudo swapon /swapfile 2>/dev/null || true
        log "✅ Swap space already exists" $GREEN
    fi
fi

# ===== STEP 2: Docker Optimization =====
log "===== Optimizing Docker Settings =====" $MAGENTA

# Clean Docker to free space
log "Cleaning Docker artifacts..." $CYAN
docker system prune -f --volumes || true
docker builder prune -f || true

# ===== STEP 3: Environment Setup =====
log "===== Setting Up Environment =====" $MAGENTA

# Create .env file
cat > .env << EOF
# Deployment Configuration
NODE_ENV=production
JWT_ENABLED=$([ "$MODE" = "prod" ] && echo "true" || echo "false")
JWT_SECRET=your-secret-key-change-in-production-$(openssl rand -hex 32)

# Memory Optimization
NODE_OPTIONS=--max-old-space-size=1536
GENERATE_SOURCEMAP=false

# Database
POSTGRES_DB=emr_db
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=emr_password_$(openssl rand -hex 16)

# Patient Data
PATIENT_COUNT=$PATIENT_COUNT
EOF

log "✅ Environment configured for $MODE mode" $GREEN

# ===== STEP 4: Build Strategy =====
log "===== Building Containers (Memory-Optimized) =====" $MAGENTA

# Create docker-compose override for light deployment
cat > docker-compose.light.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    mem_limit: 512m
    environment:
      - POSTGRES_SHARED_BUFFERS=128MB
      - POSTGRES_WORK_MEM=4MB
      - POSTGRES_MAINTENANCE_WORK_MEM=64MB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=256MB
    
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        - BUILDKIT_INLINE_CACHE=1
    mem_limit: 1g
    environment:
      - PYTHONUNBUFFERED=1
      - WEB_CONCURRENCY=2
      - WORKERS=2
    
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NODE_OPTIONS=--max-old-space-size=1536
        - GENERATE_SOURCEMAP=false
    mem_limit: 1g
EOF

# Build in stages to manage memory
log "Building backend (this may take 5-10 minutes)..." $CYAN
DOCKER_BUILDKIT=1 docker-compose -f docker-compose.yml -f docker-compose.light.yml build --no-parallel backend

log "Backend built. Cleaning temporary files..." $CYAN
docker builder prune -f

log "Building frontend (this may take 10-15 minutes)..." $CYAN
DOCKER_BUILDKIT=1 docker-compose -f docker-compose.yml -f docker-compose.light.yml build frontend

log "✅ Containers built successfully" $GREEN

# ===== STEP 5: Start Services =====
log "===== Starting Services =====" $MAGENTA

# Start database first
log "Starting database..." $CYAN
docker-compose -f docker-compose.yml -f docker-compose.light.yml up -d postgres

# Wait for database
log "Waiting for database to be ready..." $CYAN
sleep 10

# Start backend
log "Starting backend..." $CYAN
docker-compose -f docker-compose.yml -f docker-compose.light.yml up -d backend

# Wait for backend
log "Waiting for backend to initialize..." $CYAN
for i in {1..60}; do
    if curl -s http://localhost:8000/health > /dev/null; then
        log "✅ Backend is ready" $GREEN
        break
    fi
    sleep 2
done

# Start frontend
log "Starting frontend..." $CYAN
docker-compose -f docker-compose.yml -f docker-compose.light.yml up -d frontend

log "✅ All services started" $GREEN

# ===== STEP 6: Load Patient Data =====
log "===== Loading Patient Data =====" $MAGENTA

# Load data in smaller batches to avoid memory issues
log "Loading $PATIENT_COUNT patients in batches..." $CYAN

if [ "$PATIENT_COUNT" -le 20 ]; then
    docker exec emr-backend python scripts/manage_data.py load --patients $PATIENT_COUNT
else
    # Load in batches of 20
    LOADED=0
    while [ $LOADED -lt $PATIENT_COUNT ]; do
        BATCH_SIZE=$((PATIENT_COUNT - LOADED))
        if [ $BATCH_SIZE -gt 20 ]; then
            BATCH_SIZE=20
        fi
        
        log "Loading batch: $BATCH_SIZE patients (Total: $((LOADED + BATCH_SIZE))/$PATIENT_COUNT)" $CYAN
        docker exec emr-backend python scripts/manage_data.py load --patients $BATCH_SIZE
        
        LOADED=$((LOADED + BATCH_SIZE))
        
        # Give system time to process
        sleep 5
    done
fi

log "✅ Patient data loaded" $GREEN

# ===== STEP 7: Verification =====
log "===== Verifying Deployment =====" $MAGENTA

# Check all services
SERVICES_OK=true

if ! docker-compose ps | grep -q "emr-postgres.*Up"; then
    log "❌ PostgreSQL is not running" $RED
    SERVICES_OK=false
fi

if ! docker-compose ps | grep -q "emr-backend.*Up"; then
    log "❌ Backend is not running" $RED
    SERVICES_OK=false
fi

if ! docker-compose ps | grep -q "emr-frontend.*Up"; then
    log "❌ Frontend is not running" $RED
    SERVICES_OK=false
fi

if [ "$SERVICES_OK" = true ]; then
    log "✅ All services are running" $GREEN
    
    # Get IP address
    PUBLIC_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo "localhost")
    
    log "
🎉 WintEHR Light Deployment Complete! 🎉

Access the application:
- Local: http://localhost
- Public: http://$PUBLIC_IP

$( [ "$MODE" = "dev" ] && echo "Demo credentials:
- Username: demo
- Password: password" || echo "Production mode enabled - use secure credentials" )

Monitor resources:
- Memory usage: docker stats
- Logs: docker-compose logs -f
- Health: curl http://localhost:8000/health
" $GREEN
else
    log "⚠️ Some services failed to start. Check logs with: docker-compose logs" $YELLOW
    exit 1
fi

# ===== Optimization Tips =====
log "
💡 Memory Optimization Tips:
- Monitor with: watch -n 2 'free -h && docker stats --no-stream'
- If OOM occurs: Increase swap or reduce PATIENT_COUNT
- Clear logs periodically: docker-compose logs --tail 0 -f
- Restart services if needed: docker-compose restart
" $CYAN