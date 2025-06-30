#!/bin/bash
#
# Quick Start Script - Get EMR running in under 5 minutes
#

set -e

echo "🏥 EMR Quick Start"
echo "=================="

# Detect if we should use Docker
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3,8) else 1)" 2>/dev/null; then
    echo "Python 3.8+ not found. Using Docker..."
    USE_DOCKER=true
else
    USE_DOCKER=false
fi

# Quick setup function
quickstart() {
    # Create all needed directories
    mkdir -p backend/data backend/logs frontend/build
    
    if [ "$USE_DOCKER" = "true" ]; then
        # Docker approach
        echo "Starting with Docker..."
        
        # Use docker-compose if available
        if [ -f "docker-compose.simple.yml" ]; then
            docker-compose -f docker-compose.simple.yml up -d
        else
            # Run backend in Docker
            docker run -d \
                --name emr-backend \
                -p 8000:8000 \
                -v $(pwd)/backend:/app \
                -w /app \
                python:3.9-slim \
                bash -c "pip install -r requirements.txt && python main.py"
            
            # Build and serve frontend
            cd frontend
            npm install && npm run build
            cd ..
            
            # Simple Python HTTP server for frontend
            cd frontend/build
            python3 -m http.server 3000 &
            cd ../..
        fi
    else
        # Local approach
        echo "Starting locally..."
        
        # Backend
        cd backend
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        python main.py &
        cd ..
        
        # Frontend
        cd frontend
        npm install
        npm start &
        cd ..
    fi
    
    # Wait and show access info
    echo ""
    echo "Waiting for services to start..."
    sleep 10
    
    echo ""
    echo "✅ EMR System is starting!"
    echo ""
    echo "Access at:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    echo "Note: First load may take a minute while data initializes"
}

# Run quickstart
quickstart