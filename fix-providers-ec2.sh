#!/bin/bash
#
# Quick fix for provider list loading issue on EC2
#

echo "🔧 Fixing Provider List Issue"
echo "============================="

# Function to create providers in Docker
create_providers_docker() {
    echo "Creating providers in Docker container..."
    sudo docker exec emr-backend bash -c "
        cd /app && python scripts/create_sample_providers.py
    "
}

# Function to check if providers exist
check_providers() {
    RESPONSE=$(curl -s http://localhost:8000/api/auth/providers 2>/dev/null)
    if echo "$RESPONSE" | grep -q '"id"'; then
        COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
        echo "✓ Found $COUNT providers"
        return 0
    else
        echo "❌ No providers found"
        return 1
    fi
}

# Main fix process
echo "1. Checking current status..."
if ! check_providers; then
    echo -e "\n2. Creating sample providers..."
    
    # Check if using Docker
    if sudo docker ps | grep -q emr-backend; then
        create_providers_docker
    else
        # Try direct method
        if [ -d "backend" ]; then
            cd backend
            if [ -f "venv/bin/activate" ]; then
                source venv/bin/activate
                python scripts/create_sample_providers.py
                cd ..
            else
                echo "❌ Virtual environment not found"
            fi
        else
            echo "❌ Backend directory not found"
        fi
    fi
    
    # Wait for changes
    sleep 3
    
    echo -e "\n3. Verifying fix..."
    if check_providers; then
        echo "✅ Success! Providers created."
        echo ""
        echo "Please refresh your browser and try logging in again."
        echo ""
        echo "Sample providers created:"
        curl -s http://localhost:8000/api/auth/providers | \
            python3 -c "import sys, json; data=json.load(sys.stdin); [print(f'  - {p[\"display_name\"]} ({p[\"specialty\"]})') for p in data[:5]]" 2>/dev/null || \
            echo "  (Could not parse provider list)"
    else
        echo "❌ Fix failed. Manual intervention needed."
        echo ""
        echo "Try these commands:"
        echo "  1. sudo docker logs emr-backend --tail 50"
        echo "  2. sudo docker exec -it emr-backend bash"
        echo "  3. python scripts/create_sample_providers.py"
    fi
else
    echo "✓ Providers already exist!"
    echo ""
    echo "The issue might be:"
    echo "  1. Frontend can't reach backend API"
    echo "  2. CORS configuration issue"
    echo "  3. Nginx routing problem"
    echo ""
    echo "Check browser console for errors (F12 -> Console tab)"
fi

# Additional diagnostics
echo -e "\n4. API Endpoint Tests:"
echo "Direct backend: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/auth/providers)"
echo "Through nginx: $(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/auth/providers)"

echo -e "\n✅ Diagnostic complete"