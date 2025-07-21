#!/bin/bash

# Script to update all fhirClient imports to use the consolidated location

echo "Updating fhirClient imports..."

# Find all JavaScript/TypeScript files and update imports
find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -exec grep -l "from.*fhirClient" {} \; | while read -r file; do
    # Get the relative path from the file to the new fhirClient location
    dir=$(dirname "$file")
    
    # Calculate the relative path to core/fhir/services/fhirClient
    relative_path=$(python3 -c "
import os
file_dir = '$dir'
target_path = './core/fhir/services/fhirClient'
rel_path = os.path.relpath(target_path, file_dir)
print(rel_path)
")
    
    echo "Processing: $file"
    
    # Update imports - handle different import patterns
    sed -i '' "s|from '\./fhirClient'|from '$relative_path'|g" "$file"
    sed -i '' "s|from '\.\./services/fhirClient'|from '$relative_path'|g" "$file"
    sed -i '' "s|from '\.\./\.\./services/fhirClient'|from '$relative_path'|g" "$file"
    sed -i '' "s|from '\.\./\.\./\.\./services/fhirClient'|from '$relative_path'|g" "$file"
    sed -i '' "s|from '\.\./\.\./\.\./\.\./services/fhirClient'|from '$relative_path'|g" "$file"
done

echo "Import updates complete!"