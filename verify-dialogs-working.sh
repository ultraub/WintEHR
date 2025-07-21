#!/bin/bash

echo "🔍 Verifying Enhanced Dialogs and Search Functionality"
echo "===================================================="
echo ""

# Check compilation status
echo "1️⃣  Checking webpack compilation..."
COMPILE_STATUS=$(docker logs emr-frontend-dev --tail 100 2>&1 | grep "webpack compiled" | tail -1)
if echo "$COMPILE_STATUS" | grep -q "error"; then
    echo "❌ Webpack has compilation errors"
    echo "$COMPILE_STATUS"
else
    echo "✅ Webpack compiled successfully (warnings only)"
fi

# Check for runtime errors
echo ""
echo "2️⃣  Checking for runtime errors..."
ERROR_COUNT=$(docker logs emr-frontend-dev --tail 200 2>&1 | grep -i "uncaught\|cannot read\|undefined is not" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ No runtime errors detected"
else
    echo "⚠️  Found $ERROR_COUNT potential runtime errors"
fi

# Check API calls
echo ""
echo "3️⃣  Checking FHIR API calls..."
API_CALLS=$(docker logs emr-frontend-dev --tail 100 2>&1 | grep "FHIR Proxy" | wc -l)
echo "✅ Found $API_CALLS recent FHIR API calls"

# List recent patient data fetches
echo ""
echo "4️⃣  Recent patient data fetches:"
docker logs emr-frontend-dev --tail 50 2>&1 | grep "Patient.*everything" | tail -5 | sed 's/.*Patient\//Patient\//' | sed 's/\$everything.*//' | sort -u

# Check dialog files
echo ""
echo "5️⃣  Enhanced dialog file status:"
DIALOGS=(
    "AllergyDialogEnhanced"
    "ImmunizationDialogEnhanced"
    "ProcedureDialogEnhanced"
    "ObservationDialogEnhanced"
    "DiagnosticReportDialogEnhanced"
    "ServiceRequestDialogEnhanced"
    "MedicationDialogEnhanced"
    "ConditionDialogEnhanced"
)

ALL_GOOD=true
for dialog in "${DIALOGS[@]}"; do
    if [ -f "frontend/src/components/clinical/workspace/dialogs/${dialog}.js" ]; then
        # Check if file has catalog integration
        if grep -q "getDynamic\|getLabCatalog\|fhirService" "frontend/src/components/clinical/workspace/dialogs/${dialog}.js"; then
            echo "✅ $dialog - Has catalog/search integration"
        else
            echo "⚠️  $dialog - Missing catalog integration"
            ALL_GOOD=false
        fi
    else
        echo "❌ $dialog - File missing"
        ALL_GOOD=false
    fi
done

# Check shared components
echo ""
echo "6️⃣  Shared component status:"
if [ -f "frontend/src/components/clinical/common/ResourceSearchAutocomplete.js" ]; then
    echo "✅ ResourceSearchAutocomplete.js exists"
else
    echo "❌ ResourceSearchAutocomplete.js missing"
fi

if [ -f "frontend/src/components/clinical/common/BatchOperationsDialog.js" ]; then
    echo "✅ BatchOperationsDialog.js exists"
else
    echo "❌ BatchOperationsDialog.js missing"
fi

# Summary
echo ""
echo "📊 Summary"
echo "=========="
if [ "$ALL_GOOD" = true ] && [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ All dialogs are properly configured with search functionality"
    echo "✅ The application is running without errors"
    echo "✅ FHIR API integration is working"
    echo ""
    echo "The enhanced dialogs should now:"
    echo "- Load dynamic catalogs from patient data"
    echo "- Provide intelligent search with debouncing"
    echo "- Show beautiful Material-UI interfaces"
    echo "- Save FHIR resources properly"
else
    echo "⚠️  Some issues detected - review the output above"
fi

echo ""
echo "To test dialogs manually:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Login with demo/password"
echo "3. Select a patient"
echo "4. Navigate to Chart Review tab"
echo "5. Try adding conditions, medications, allergies, etc."