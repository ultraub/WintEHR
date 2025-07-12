#!/bin/bash

# MedGenEMR Development Mode Script
# Switches between production and development configurations

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[DEV]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check command argument
if [ "$1" == "start" ]; then
    print_status "Starting development environment with hot reload..."
    
    # Stop any running containers
    docker-compose down
    
    # Start with development override
    print_status "Starting services with hot reload enabled..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    
    print_status "Waiting for services to be ready..."
    sleep 5
    
    print_status "Development environment started!"
    echo ""
    echo "  Frontend (with hot reload): http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  Database: localhost:5432"
    echo ""
    print_status "To view logs: docker-compose logs -f frontend"
    
elif [ "$1" == "stop" ]; then
    print_status "Stopping development environment..."
    docker-compose down
    print_status "Development environment stopped."
    
elif [ "$1" == "restart" ]; then
    print_status "Restarting development environment..."
    docker-compose down
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    print_status "Development environment restarted."
    
elif [ "$1" == "logs" ]; then
    # Show logs for frontend with hot reload
    docker-compose logs -f frontend
    
elif [ "$1" == "test" ]; then
    print_status "Opening Cypress for workflow testing..."
    cd e2e-tests
    npm run cypress:open
    
elif [ "$1" == "prod" ]; then
    print_status "Switching to production mode..."
    docker-compose down
    docker-compose up -d
    print_status "Production environment started."
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:8000"
    
else
    echo "MedGenEMR Development Mode Manager"
    echo ""
    echo "Usage: ./dev-mode.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Start development environment with hot reload"
    echo "  stop     - Stop development environment"
    echo "  restart  - Restart development environment"
    echo "  logs     - View frontend logs (with hot reload)"
    echo "  test     - Open Cypress for workflow testing"
    echo "  prod     - Switch back to production mode"
    echo ""
    echo "Example:"
    echo "  ./dev-mode.sh start"
fi