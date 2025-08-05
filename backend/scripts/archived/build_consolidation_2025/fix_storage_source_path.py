#!/usr/bin/env python3
"""
Fix the references INSERT query in storage.py to include source_path column.
"""

import os
import logging
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def fix_storage_source_path():
    """Fix the references INSERT query to include source_path"""
    
    storage_path = "/app/fhir/core/storage.py"
    
    # Read the current file
    try:
        with open(storage_path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        logger.error(f"File not found: {storage_path}")
        return False
    
    # Find and replace the INSERT statement to include source_path
    # Pattern to match the current INSERT
    pattern = r'(INSERT INTO fhir\.references \(\s*' \
              r'source_resource_id, source_id, source_type, target_type, target_id,\s*' \
              r'reference_path, reference_value\s*\))'
    
    replacement = 'INSERT INTO fhir.references (\n' \
                  '                            source_resource_id, source_id, source_type, target_type, target_id,\n' \
                  '                            source_path, reference_path, reference_value\n' \
                  '                        )'
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        logger.info("✅ Updated INSERT column list to include source_path")
    else:
        logger.warning("⚠️ Could not find INSERT column pattern, trying alternative approach...")
    
    # Also update the VALUES clause
    pattern2 = r'(\:source_resource_id, \:source_id, \:source_type, \:target_type, \:target_id,\s*' \
               r'\:reference_path, \:reference_value)'
    
    replacement2 = ':source_resource_id, :source_id, :source_type, :target_type, :target_id,\n' \
                   '                            :source_path, :reference_path, :reference_value'
    
    if re.search(pattern2, content):
        content = re.sub(pattern2, replacement2, content)
        logger.info("✅ Updated VALUES clause to include :source_path")
    else:
        logger.warning("⚠️ Could not find VALUES pattern")
    
    # Update the parameters dict to include source_path
    # Find the execute call with parameters
    pattern3 = r"('reference_path': path,.*?# Remove the .reference part for cleaner paths\s*\n\s*'reference_value': value)"
    
    replacement3 = "'source_path': path,\n" \
                   "                        'reference_path': path,  # Remove the .reference part for cleaner paths\n" \
                   "                        'reference_value': value"
    
    if re.search(pattern3, content, re.DOTALL):
        content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)
        logger.info("✅ Updated parameters dict to include source_path")
    else:
        logger.warning("⚠️ Could not find parameters pattern")
    
    # Write the fixed content back
    try:
        with open(storage_path, 'w') as f:
            f.write(content)
        logger.info("✅ Successfully updated storage.py")
        return True
    except Exception as e:
        logger.error(f"Failed to write file: {e}")
        return False

if __name__ == "__main__":
    logger.info("Fixing FHIR storage references INSERT to include source_path...")
    
    if fix_storage_source_path():
        logger.info("✅ Source path fix completed successfully")
        logger.info("⚠️  Note: You should restart the backend after this fix")
    else:
        logger.error("❌ Failed to apply fix")