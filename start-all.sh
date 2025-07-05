#!/bin/bash

# MedGenEMR Complete System Startup Script
# This script starts all services: database, backend, frontend, and optionally synthea data generation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_USER=${POSTGRES_USER:-emr_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-emr_password}
POSTGRES_DB=${POSTGRES_DB:-emr_db}
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
ENVIRONMENT=${ENVIRONMENT:-development}

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
SYNTHEA_DIR="$SCRIPT_DIR/synthea"

# Log files
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

print_banner() {
    echo -e "${BLUE}"
    echo "=================================="
    echo "     MedGenEMR System Startup"
    echo "=================================="
    echo -e "${NC}"
}

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

check_dependencies() {
    log "Checking system dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is required but not installed"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is required but not installed"
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        warn "PostgreSQL client not found. Make sure PostgreSQL is accessible"
    fi
    
    # Check Java (for Synthea)
    if ! command -v java &> /dev/null; then
        warn "Java not found. Synthea data generation will not be available"
    fi
    
    log "Dependencies check completed"
}

setup_database() {
    log "Setting up PostgreSQL database..."
    
    # Create database if it doesn't exist
    if command -v psql &> /dev/null; then
        export PGPASSWORD="$POSTGRES_PASSWORD"
        
        # Check if database exists
        if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -qw "$POSTGRES_DB"; then
            log "Database '$POSTGRES_DB' already exists"
        else
            log "Creating database '$POSTGRES_DB'..."
            createdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB" || warn "Could not create database. It may already exist."
        fi
    else
        warn "PostgreSQL client not available. Assuming database is set up externally."
    fi
}

setup_backend() {
    log "Setting up backend environment..."
    
    cd "$BACKEND_DIR"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        log "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install/update requirements
    log "Installing Python dependencies..."
    pip install -r requirements.txt
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log "Creating backend .env file..."
        cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

# Server Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=${BACKEND_PORT}
ENVIRONMENT=${ENVIRONMENT}

# Security
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Synthea Configuration
SYNTHEA_PATH=${SYNTHEA_DIR}

# Logging
LOG_LEVEL=INFO
SQL_ECHO=false

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://127.0.0.1:3000"]

# WebSocket
WEBSOCKET_ENABLED=true
EOF
    fi
    
    log "Backend setup completed"
}

setup_frontend() {
    log "Setting up frontend environment..."
    
    cd "$FRONTEND_DIR"
    
    # Install npm dependencies
    if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
        log "Installing Node.js dependencies..."
        npm install
    else
        log "Node.js dependencies already installed"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log "Creating frontend .env file..."
        cat > .env << EOF
# Backend API Configuration
REACT_APP_API_BASE_URL=http://localhost:${BACKEND_PORT}
REACT_APP_FHIR_BASE_URL=http://localhost:${BACKEND_PORT}/fhir/R4
REACT_APP_WEBSOCKET_URL=ws://localhost:${BACKEND_PORT}/ws

# Environment
REACT_APP_ENVIRONMENT=${ENVIRONMENT}

# Feature Flags
REACT_APP_ENABLE_SYNTHEA=true
REACT_APP_ENABLE_DICOM=true
REACT_APP_ENABLE_CDS_HOOKS=true

# Development
GENERATE_SOURCEMAP=true
ESLINT_NO_DEV_ERRORS=true
EOF
    fi
    
    log "Frontend setup completed"
}

setup_synthea() {
    log "Setting up Synthea..."
    
    if [ ! -d "$SYNTHEA_DIR" ]; then
        log "Cloning Synthea repository..."
        git clone https://github.com/synthetichealth/synthea.git "$SYNTHEA_DIR"
    fi
    
    cd "$SYNTHEA_DIR"
    
    # Check if Synthea is already built
    if [ ! -f "build/libs/synthea-with-dependencies.jar" ]; then
        if command -v java &> /dev/null && command -v ./gradlew &> /dev/null; then
            log "Building Synthea (this may take a while)..."
            ./gradlew build -x test
        else
            warn "Java or Gradle not available. Synthea will not be built."
            return
        fi
    fi
    
    log "Synthea setup completed"
}

start_backend() {
    log "Starting backend server..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Run database migrations
    log "Running database migrations..."
    python -c "
import asyncio
import sys
sys.path.append('.')
from database import engine, Base
from sqlalchemy import text

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print('Database tables created/updated')

asyncio.run(create_tables())
" || warn "Could not run database migrations"
    
    # Start the server
    log "Starting FastAPI server on port $BACKEND_PORT..."
    nohup uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$LOG_DIR/backend.pid"
    
    # Wait for backend to start
    sleep 5
    if curl -s "http://localhost:$BACKEND_PORT/docs" > /dev/null; then
        log "Backend server started successfully"
    else
        error "Backend server failed to start. Check $LOG_DIR/backend.log"
    fi
}

start_frontend() {
    log "Starting frontend development server..."
    
    cd "$FRONTEND_DIR"
    
    # Start the development server
    log "Starting React development server on port $FRONTEND_PORT..."
    nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$LOG_DIR/frontend.pid"
    
    # Wait for frontend to start
    sleep 10
    if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null; then
        log "Frontend server started successfully"
    else
        warn "Frontend server may be starting. Check $LOG_DIR/frontend.log"
    fi
}

generate_test_data() {
    if [ "$1" = "--skip-data" ]; then
        return
    fi
    
    log "Generating test data with Synthea..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    if [ -f "$SYNTHEA_DIR/build/libs/synthea-with-dependencies.jar" ]; then
        log "Running Synthea workflow to generate test patients..."
        python scripts/synthea_workflow.py full --count 5 || warn "Could not generate Synthea data"
    else
        warn "Synthea not available. Skipping test data generation."
    fi
}

stop_services() {
    log "Stopping services..."
    
    # Stop backend
    if [ -f "$LOG_DIR/backend.pid" ]; then
        kill $(cat "$LOG_DIR/backend.pid") 2>/dev/null || true
        rm -f "$LOG_DIR/backend.pid"
    fi
    
    # Stop frontend
    if [ -f "$LOG_DIR/frontend.pid" ]; then
        kill $(cat "$LOG_DIR/frontend.pid") 2>/dev/null || true
        rm -f "$LOG_DIR/frontend.pid"
    fi
    
    # Kill any remaining processes
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "npm start" 2>/dev/null || true
    
    log "Services stopped"
}

show_status() {
    echo -e "${BLUE}Service Status:${NC}"
    
    # Check backend
    if curl -s "http://localhost:$BACKEND_PORT/docs" > /dev/null; then
        echo -e "Backend:  ${GREEN}Running${NC} (http://localhost:$BACKEND_PORT)"
    else
        echo -e "Backend:  ${RED}Not running${NC}"
    fi
    
    # Check frontend
    if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null; then
        echo -e "Frontend: ${GREEN}Running${NC} (http://localhost:$FRONTEND_PORT)"
    else
        echo -e "Frontend: ${RED}Not running${NC}"
    fi
    
    # Check database
    export PGPASSWORD="$POSTGRES_PASSWORD"
    if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "Database: ${GREEN}Connected${NC} ($POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB)"
    else
        echo -e "Database: ${RED}Not accessible${NC}"
    fi
}

print_urls() {
    echo -e "${BLUE}Access URLs:${NC}"
    echo "Frontend:     http://localhost:$FRONTEND_PORT"
    echo "Backend API:  http://localhost:$BACKEND_PORT/docs"
    echo "FHIR API:     http://localhost:$BACKEND_PORT/fhir/R4/metadata"
    echo ""
    echo "Logs directory: $LOG_DIR"
}

# Main execution
case "${1:-start}" in
    "start")
        print_banner
        check_dependencies
        setup_database
        setup_backend
        setup_frontend
        setup_synthea
        start_backend
        start_frontend
        generate_test_data "$2"
        show_status
        print_urls
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        stop_services
        sleep 2
        "$0" start "$2"
        ;;
    "status")
        show_status
        ;;
    "setup")
        print_banner
        check_dependencies
        setup_database
        setup_backend
        setup_frontend
        setup_synthea
        log "Setup completed. Run './start-all.sh start' to start services."
        ;;
    "data")
        generate_test_data
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|setup|data} [--skip-data]"
        echo ""
        echo "Commands:"
        echo "  start      - Start all services (default)"
        echo "  stop       - Stop all services"
        echo "  restart    - Restart all services"
        echo "  status     - Show service status"
        echo "  setup      - Setup environment without starting"
        echo "  data       - Generate test data only"
        echo ""
        echo "Options:"
        echo "  --skip-data - Skip test data generation on start"
        exit 1
        ;;
esac