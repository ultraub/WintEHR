#!/bin/bash
echo "Checking Frontend for Errors"
echo "============================"

# Check if containers are running
echo "1. Checking Docker containers..."
if docker ps | grep -q emr-frontend; then
    echo "Frontend container is running"
else
    echo "Frontend container not running. Starting..."
    docker-compose up -d frontend
    sleep 10
fi

# Check for linting errors
echo ""
echo "2. Running lint check..."
docker exec emr-frontend npm run lint || echo "Lint check failed"

# Check if all dialog files exist
echo ""
echo "3. Checking dialog files..."
DIALOGS="AllergyDialogEnhanced ImmunizationDialogEnhanced ProcedureDialogEnhanced ObservationDialogEnhanced DiagnosticReportDialogEnhanced ServiceRequestDialogEnhanced MedicationDialogEnhanced ConditionDialogEnhanced"

for dialog in $DIALOGS; do
    if docker exec emr-frontend test -f "src/components/clinical/workspace/dialogs/${dialog}.js"; then
        echo "  Found: ${dialog}.js"
    else
        echo "  Missing: ${dialog}.js"
    fi
done

# Check for console errors
echo ""
echo "4. Recent frontend logs:"
docker logs emr-frontend --tail 20 2>&1 | grep -i "error\|warning" || echo "No errors in recent logs"

# Test frontend accessibility
echo ""
echo "5. Testing frontend accessibility..."
curl -s -o /dev/null -w "Frontend HTTP status: %{http_code}\n" http://localhost:3000

echo ""
echo "Check complete!"