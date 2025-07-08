#!/usr/bin/env python3
"""
Migrate fhirService to fhirClient in all files
"""
import os
import re
import sys

def migrate_fhir_service(directory):
    """Replace fhirService with fhirClient in all JavaScript files"""
    updated_count = 0
    file_count = 0
    
    # Patterns to replace
    replacements = [
        # Import statements
        (r'import fhirService from [\'"](.*)fhirService[\'"];?', r'import fhirClient from \1fhirClient\';'),
        (r'const fhirService = require\([\'"](.*)fhirService[\'"]\);?', r'const fhirClient = require(\'\1fhirClient\');'),
        # Method calls
        (r'fhirService\.', r'fhirClient.'),
        # Destructured imports
        (r'import \{ fhirService \}', r'import { fhirClient }'),
    ]
    
    # Walk through all files
    for root, dirs, files in os.walk(directory):
        # Skip node_modules and build directories
        if 'node_modules' in root or 'build' in root:
            continue
            
        for file in files:
            if file.endswith(('.js', '.jsx')) and file != 'fhirService.js' and file != 'fhirServiceMigration.js':
                filepath = os.path.join(root, file)
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Skip if no fhirService references
                    if 'fhirService' not in content:
                        continue
                    
                    original_content = content
                    
                    # Apply all replacements
                    for pattern, replacement in replacements:
                        content = re.sub(pattern, replacement, content)
                    
                    # Only write if changes were made
                    if content != original_content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        
                        file_count += 1
                        # Count number of replacements
                        count = original_content.count('fhirService') - content.count('fhirService')
                        updated_count += count
                        print(f"Updated {count} references in {filepath}")
                        
                except Exception as e:
                    print(f"Error processing {filepath}: {str(e)}")
    
    return updated_count, file_count

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_fhir_service.py <directory>")
        sys.exit(1)
    
    directory = sys.argv[1]
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist")
        sys.exit(1)
    
    print(f"Migrating fhirService to fhirClient in {directory}...")
    updated, files = migrate_fhir_service(directory)
    print(f"\nTotal: Updated {updated} references in {files} files")