#!/bin/bash
#
# Troubleshooting script for provider list loading issue
# Run this on the EC2 server to diagnose the problem
#

echo "🔍 EMR Provider List Troubleshooting"
echo "===================================="

# 1. Check backend is running
echo -e "\n1. Checking backend status..."
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✓ Backend is responding at port 8000"
else
    echo "❌ Backend is not responding"
    echo "   Checking Docker containers..."
    sudo docker ps
fi

# 2. Test the providers endpoint directly
echo -e "\n2. Testing providers endpoint..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8000/api/auth/providers)
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v HTTP_CODE)

echo "   HTTP Status Code: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Endpoint is responding correctly"
    echo "   Provider count: $(echo "$BODY" | grep -o '"id"' | wc -l)"
    echo "   Sample response: $(echo "$BODY" | head -c 200)..."
else
    echo "❌ Endpoint returned error"
    echo "   Response: $BODY"
fi

# 3. Check if providers exist in database
echo -e "\n3. Checking database for providers..."
if [ -f "$(pwd)/backend/data/emr.db" ]; then
    echo "✓ Database file exists"
    
    # Try to query providers
    if command -v sqlite3 &> /dev/null; then
        PROVIDER_COUNT=$(sqlite3 backend/data/emr.db "SELECT COUNT(*) FROM providers;" 2>/dev/null || echo "Error")
        if [ "$PROVIDER_COUNT" != "Error" ]; then
            echo "   Provider count in database: $PROVIDER_COUNT"
            
            if [ "$PROVIDER_COUNT" = "0" ]; then
                echo "❌ No providers in database!"
                echo "   Running provider creation script..."
            else
                echo "✓ Providers exist in database"
                # Show sample providers
                echo "   Sample providers:"
                sqlite3 backend/data/emr.db "SELECT id, first_name, last_name, specialty FROM providers LIMIT 3;" 2>/dev/null
            fi
        else
            echo "⚠️  Could not query database (table might not exist)"
        fi
    else
        echo "⚠️  sqlite3 not installed, can't check database directly"
    fi
else
    echo "❌ Database file not found at $(pwd)/backend/data/emr.db"
fi

# 4. Check backend logs
echo -e "\n4. Checking backend logs for errors..."
if [ -d "backend/logs" ]; then
    if [ -f "backend/logs/backend.log" ]; then
        echo "Recent errors in backend log:"
        grep -i error backend/logs/backend.log | tail -5
    fi
fi

# Check Docker logs if using Docker
if sudo docker ps | grep -q emr-backend; then
    echo -e "\nRecent Docker logs:"
    sudo docker logs emr-backend --tail 20 2>&1 | grep -E "(error|ERROR|Error)"
fi

# 5. Test from frontend perspective
echo -e "\n5. Testing from frontend's perspective..."
# Check what URL the frontend is actually using
if [ -f "frontend/build/static/js/main*.js" ]; then
    echo "Checking frontend API configuration..."
    grep -o 'REACT_APP_API_URL[^,]*' frontend/build/static/js/main*.js | head -1 || echo "Could not find API URL in build"
fi

# 6. Check nginx configuration
echo -e "\n6. Checking nginx routing..."
if [ -f "/etc/nginx/conf.d/emr.conf" ]; then
    echo "✓ Nginx configuration exists"
    grep -A2 "location.*api" /etc/nginx/conf.d/emr.conf
else
    echo "⚠️  No custom nginx config found"
fi

# Test through nginx
NGINX_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost/api/auth/providers)
NGINX_CODE=$(echo "$NGINX_RESPONSE" | grep HTTP_CODE | cut -d: -f2)
echo -e "\nTesting through nginx (port 80):"
echo "   HTTP Status Code: $NGINX_CODE"

# 7. Provide fix commands
echo -e "\n7. Suggested fixes:"
echo "-------------------"

if [ "$PROVIDER_COUNT" = "0" ] || [ "$PROVIDER_COUNT" = "Error" ]; then
    echo "To create providers:"
    echo "  Option 1 (Docker):"
    echo "    sudo docker exec emr-backend python scripts/create_sample_providers.py"
    echo ""
    echo "  Option 2 (Direct):"
    echo "    cd backend"
    echo "    source venv/bin/activate"
    echo "    python scripts/create_sample_providers.py"
fi

if [ "$HTTP_CODE" != "200" ]; then
    echo "To restart backend:"
    echo "  Option 1 (Docker):"
    echo "    sudo docker restart emr-backend"
    echo ""
    echo "  Option 2 (Direct):"
    echo "    pkill -f 'python main.py'"
    echo "    cd backend && nohup python main.py > logs/backend.log 2>&1 &"
fi

echo -e "\n8. Quick fix attempt..."
echo "Attempting to fix the issue automatically..."

# Try to fix by creating providers if missing
if [ "$PROVIDER_COUNT" = "0" ] || [ "$PROVIDER_COUNT" = "Error" ]; then
    if sudo docker ps | grep -q emr-backend; then
        echo "Creating providers via Docker..."
        sudo docker exec emr-backend python scripts/create_sample_providers.py
        echo "Waiting for changes to take effect..."
        sleep 2
        
        # Test again
        FINAL_TEST=$(curl -s http://localhost:8000/api/auth/providers)
        FINAL_COUNT=$(echo "$FINAL_TEST" | grep -o '"id"' | wc -l)
        echo "Final provider count: $FINAL_COUNT"
        
        if [ "$FINAL_COUNT" -gt 0 ]; then
            echo "✅ Success! Providers created. Please refresh the login page."
        fi
    fi
fi

echo -e "\n✅ Troubleshooting complete"