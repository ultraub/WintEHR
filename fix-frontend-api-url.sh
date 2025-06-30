#!/bin/bash
# Fix Frontend API URL Script
# This script fixes the common issue where frontend tries to connect to localhost:8000

set -e

echo "Frontend API URL Fix Script"
echo "=========================="
echo ""
echo "This script fixes the issue where the frontend tries to connect to localhost:8000"
echo "instead of using relative URLs for API calls."
echo ""

# Check if running in Docker or directly
if command -v docker &> /dev/null && docker ps | grep -q emr-frontend; then
    echo "Detected Docker deployment..."
    
    # Fix in the Docker container
    echo "Fixing API URLs in Docker container..."
    docker exec emr-frontend sh -c '
        # Find and replace localhost URLs in built JavaScript files
        find /usr/share/nginx/html/static/js -name "*.js" -type f -exec sed -i "s|http://localhost:8000||g" {} \;
        echo "Fixed API URLs in built files"
    '
    
    echo "Restarting nginx..."
    docker exec emr-frontend nginx -s reload
    
elif [ -d "frontend/build" ]; then
    echo "Detected local deployment..."
    
    # Fix in local build directory
    echo "Fixing API URLs in build directory..."
    find frontend/build/static/js -name "*.js" -type f -exec sed -i.bak 's|http://localhost:8000||g' {} \;
    
    echo "Fixed API URLs in built files"
    
    # If nginx is running locally
    if pgrep nginx > /dev/null; then
        echo "Reloading nginx..."
        nginx -s reload
    fi
    
else
    echo "Error: Could not detect deployment type"
    echo ""
    echo "For manual fix, update frontend/src/services/api.js:"
    echo "Change: const API_BASE_URL = process.env.REACT_APP_API_URL === undefined ? 'http://localhost:8000' : process.env.REACT_APP_API_URL;"
    echo "To: const API_BASE_URL = process.env.REACT_APP_API_URL || '';"
    echo ""
    echo "Then rebuild with: REACT_APP_API_URL='' npm run build"
    exit 1
fi

echo ""
echo "Testing API connection..."
if curl -s http://localhost/api/health | grep -q "healthy"; then
    echo "✓ API is accessible"
else
    echo "✗ API health check failed"
    echo "Please check that the backend is running"
fi

echo ""
echo "Fix complete!"
echo ""
echo "If you still see localhost errors:"
echo "1. Clear your browser cache"
echo "2. Try an incognito/private window"
echo "3. Check the browser console for any remaining localhost references"