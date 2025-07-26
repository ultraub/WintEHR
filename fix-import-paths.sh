#!/bin/bash

# Fix import paths for files in clinical/shared subdirectories
# These need an extra ../ to reach the project root

echo "Fixing import paths in clinical/shared components..."

# Fix imports in shared/dialogs
find frontend/src/components/clinical/shared/dialogs -name "*.js" -exec sed -i '' \
  -e 's|from '\''../../../core/fhir/services/fhirClient'\''|from '\''../../../../core/fhir/services/fhirClient'\''|g' \
  -e 's|from '\''../../../contexts/ClinicalContext'\''|from '\''../../../../contexts/ClinicalContext'\''|g' \
  -e 's|from '\''../../../contexts/AuthContext'\''|from '\''../../../../contexts/AuthContext'\''|g' \
  -e 's|from '\''../../../constants/clinicalEvents'\''|from '\''../../../../constants/clinicalEvents'\''|g' {} \;

# Fix imports in shared/display
find frontend/src/components/clinical/shared/display -name "*.js" -exec sed -i '' \
  -e 's|from '\''../../../themes/clinicalTheme'\''|from '\''../../../../themes/clinicalTheme'\''|g' \
  -e 's|from '\''../../../themes/clinicalThemeUtils'\''|from '\''../../../../themes/clinicalThemeUtils'\''|g' {} \;

# Fix imports in shared/inputs
find frontend/src/components/clinical/shared/inputs -name "*.js" -exec sed -i '' \
  -e 's|from '\''../../../themes/clinicalThemeUtils'\''|from '\''../../../../themes/clinicalThemeUtils'\''|g' \
  -e 's|from '\''../../../core/fhir/services/fhirClient'\''|from '\''../../../../core/fhir/services/fhirClient'\''|g' \
  -e 's|from '\''../../../services/cdsClinicalDataService'\''|from '\''../../../../services/cdsClinicalDataService'\''|g' {} \;

# Fix imports in shared/tables
find frontend/src/components/clinical/shared/tables -name "*.js" -exec sed -i '' \
  -e 's|from '\''../../../hooks/clinical'\''|from '\''../../../../hooks/clinical'\''|g' \
  -e 's|from '\''../../../utils/clinicalHelpers'\''|from '\''../../../../utils/clinicalHelpers'\''|g' \
  -e 's|from '\''../../../themes/clinicalThemeUtils'\''|from '\''../../../../themes/clinicalThemeUtils'\''|g' \
  -e 's|from '\''../../../themes/clinicalTheme'\''|from '\''../../../../themes/clinicalTheme'\''|g' {} \;

# Fix imports in shared/templates
find frontend/src/components/clinical/shared/templates -name "*.js" -exec sed -i '' \
  -e 's|from '\''../ClinicalResourceCard'\''|from '\''../cards/ClinicalResourceCard'\''|g' {} \;

# Fix internal references in shared components
sed -i '' 's|from '\''\./ClinicalEmptyState'\''|from '\''../display/ClinicalEmptyState'\''|g' \
  frontend/src/components/clinical/shared/tables/ClinicalDataList.js 2>/dev/null || true

sed -i '' 's|from '\''\./StatusChip'\''|from '\''../display/StatusChip'\''|g' \
  frontend/src/components/clinical/shared/tables/ClinicalDataTable.js 2>/dev/null || true

sed -i '' 's|from '\''\./TrendSparkline'\''|from '\''../display/TrendSparkline'\''|g' \
  frontend/src/components/clinical/shared/layout/CompactPatientHeader.js 2>/dev/null || true

sed -i '' 's|from '\''\./TrendSparkline'\''|from '\''../display/TrendSparkline'\''|g' \
  frontend/src/components/clinical/shared/tables/SmartTable.js 2>/dev/null || true

echo "Import paths fixed!"