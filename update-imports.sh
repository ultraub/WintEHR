#!/bin/bash
cd /Users/robertbarrett/Library/Mobile\ Documents/com~apple~CloudDocs/dev/MedGenEMR

# Update ui/ imports to shared/
find frontend/src/components/clinical -name "*.js" -type f -exec sed -i '' \
  -e 's|from '\''\.\.\/\.\.\/ui\/DensityControl'\''|from '\''../../shared/layout'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/MetricsBar'\''|from '\''../../shared/display'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/ResourceTimeline'\''|from '\''../../shared/display'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/SmartTable'\''|from '\''../../shared/tables'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/QuickActionFAB'\''|from '\''../../shared/layout'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/TrendSparkline'\''|from '\''../../shared/display'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/ClinicalList'\''|from '\''../../shared/display'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/CompactPatientHeader'\''|from '\''../../shared/layout'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/QuickActionsBar'\''|from '\''../../shared/layout'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/ui\/KeyboardShortcutsDialog'\''|from '\''../../shared/dialogs'\''|g' {} \;

# Update common/ imports to shared/
find frontend/src/components/clinical -name "*.js" -type f -exec sed -i '' \
  -e 's|from '\''\.\.\/\.\.\/common\/ClinicalDataList'\''|from '\''../../shared/tables'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/ClinicalDataTable'\''|from '\''../../shared/tables'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/StatusChip'\''|from '\''../../shared/display'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/ClinicalSelect'\''|from '\''../../shared/inputs'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/ClinicalTextField'\''|from '\''../../shared/inputs'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/ResourceSearchAutocomplete'\''|from '\''../../shared/inputs'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/ClinicalFilterBar'\''|from '\''../../shared/inputs'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/SimplifiedClinicalDialog'\''|from '\''../../shared/dialogs'\''|g' \
  -e 's|from '\''\.\.\/\.\.\/common\/BatchOperationsDialog'\''|from '\''../../shared/dialogs'\''|g' {} \;

# Fix default imports to use destructuring
find frontend/src/components/clinical -name "*.js" -type f -exec sed -i '' \
  -e 's|import MetricsBar from|import { MetricsBar } from|g' \
  -e 's|import ResourceTimeline from|import { ResourceTimeline } from|g' \
  -e 's|import SmartTable from|import { SmartTable } from|g' \
  {} \;

echo "Import updates completed"