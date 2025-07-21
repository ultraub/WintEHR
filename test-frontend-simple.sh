#!/bin/bash

echo "🧪 Simple Frontend Test Script"
echo "=============================="
echo ""

# Test if frontend is accessible
echo "1️⃣  Testing frontend accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")

if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "304" ]; then
    echo "✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
    echo "❌ Frontend not accessible (HTTP $FRONTEND_STATUS)"
fi

# Check container health
echo ""
echo "2️⃣  Checking container health..."
HEALTH_STATUS=$(docker inspect emr-frontend-dev --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
echo "Container health: $HEALTH_STATUS"

# Get recent logs
echo ""
echo "3️⃣  Recent frontend logs (errors only):"
docker logs emr-frontend-dev --tail 50 2>&1 | grep -i "error\|failed\|warning" | tail -10 || echo "No recent errors found"

# Check if webpack compiled successfully
echo ""
echo "4️⃣  Checking webpack compilation..."
WEBPACK_STATUS=$(docker logs emr-frontend-dev --tail 100 2>&1 | grep "webpack compiled" | tail -1)
if echo "$WEBPACK_STATUS" | grep -q "successfully"; then
    echo "✅ Webpack compiled successfully"
else
    echo "❌ Webpack compilation has errors:"
    echo "$WEBPACK_STATUS"
fi

# List enhanced dialog files
echo ""
echo "5️⃣  Enhanced dialog files status:"
DIALOGS=(
    "AllergyDialogEnhanced.js"
    "ImmunizationDialogEnhanced.js"
    "ProcedureDialogEnhanced.js"
    "ObservationDialogEnhanced.js"
    "DiagnosticReportDialogEnhanced.js"
    "ServiceRequestDialogEnhanced.js"
    "MedicationDialogEnhanced.js"
    "ConditionDialogEnhanced.js"
)

for dialog in "${DIALOGS[@]}"; do
    if [ -f "frontend/src/components/clinical/workspace/dialogs/$dialog" ]; then
        echo "✅ $dialog exists"
    else
        echo "❌ $dialog missing"
    fi
done

# Test API endpoints
echo ""
echo "6️⃣  Testing key API endpoints..."
API_ENDPOINTS=(
    "http://localhost:8000/docs"
    "http://localhost:8000/fhir/R4/metadata"
    "http://localhost:8000/fhir/R4/Patient"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "000")
    if [ "$STATUS" = "200" ]; then
        echo "✅ $endpoint - OK"
    else
        echo "❌ $endpoint - Failed (HTTP $STATUS)"
    fi
done

echo ""
echo "📊 Test Summary"
echo "==============="
echo "Frontend Status: $FRONTEND_STATUS"
echo "Container Health: $HEALTH_STATUS"
echo ""
echo "To run comprehensive tests with Playwright:"
echo "1. cd frontend && npm install playwright"
echo "2. node ../test-all-pages.js"