#!/usr/bin/env python3
"""
Fix the references INSERT query in storage.py to match the actual table structure.
"""

import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def fix_storage_references_insert():
    """Fix the references INSERT query in storage.py"""
    
    storage_path = "/app/fhir/core/storage.py"
    
    # Read the current file
    try:
        with open(storage_path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        logger.error(f"File not found: {storage_path}")
        return False
    
    # Fix the INSERT query to match the actual table structure
    old_insert = """                    query = text(\"\"\"
                        INSERT INTO fhir.references (
                            source_id, source_type, target_type, target_id,
                            reference_path, reference_value
                        ) VALUES (
                            :source_id, :source_type, :target_type, :target_id,
                            :reference_path, :reference_value
                        )
                    \"\"\")
                    
                    await self.session.execute(query, {
                        'source_id': resource_id,
                        'source_type': source_type,
                        'target_type': target_type,
                        'target_id': target_id,
                        'reference_path': path,  # Remove the .reference part for cleaner paths
                        'reference_value': value
                    })"""
    
    new_insert = """                    query = text(\"\"\"
                        INSERT INTO fhir.references (
                            source_resource_id, source_id, source_type, target_type, target_id,
                            reference_path, reference_value
                        ) VALUES (
                            :source_resource_id, :source_id, :source_type, :target_type, :target_id,
                            :reference_path, :reference_value
                        )
                    \"\"\")
                    
                    await self.session.execute(query, {
                        'source_resource_id': resource_id,
                        'source_id': resource_id,
                        'source_type': source_type,
                        'target_type': target_type,
                        'target_id': target_id,
                        'reference_path': path,  # Remove the .reference part for cleaner paths
                        'reference_value': value
                    })"""
    
    if old_insert in content:
        content = content.replace(old_insert, new_insert)
        logger.info("✅ Fixed references INSERT query")
    else:
        logger.info("⚠️ Could not find exact match for INSERT query, attempting partial fix...")
        
        # Try a more flexible approach
        if "INSERT INTO fhir.references (" in content and "source_id, source_type, target_type, target_id," in content:
            # Find and replace the INSERT statement
            import re
            
            # Pattern to match the INSERT statement
            pattern = r'(INSERT INTO fhir\.references \(\s*)(source_id, source_type, target_type, target_id,\s*reference_path, reference_value\s*\))'
            replacement = r'\1source_resource_id, source_id, source_type, target_type, target_id,\n                            reference_path, reference_value\n                        )'
            
            content = re.sub(pattern, replacement, content)
            
            # Also fix the VALUES part
            pattern2 = r'(:source_id, :source_type, :target_type, :target_id,\s*:reference_path, :reference_value\s*\))'
            replacement2 = r':source_resource_id, :source_id, :source_type, :target_type, :target_id,\n                            :reference_path, :reference_value\n                        )'
            
            content = re.sub(pattern2, replacement2, content)
            
            # Fix the parameters dict
            pattern3 = r"'source_id': resource_id,\s*\n\s*'source_type': source_type,"
            replacement3 = "'source_resource_id': resource_id,\n                        'source_id': resource_id,\n                        'source_type': source_type,"
            
            content = re.sub(pattern3, replacement3, content)
            
            logger.info("✅ Applied partial fixes to references INSERT query")
    
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
    logger.info("Fixing FHIR storage references INSERT query...")
    
    if fix_storage_references_insert():
        logger.info("✅ References INSERT fix completed successfully")
        logger.info("⚠️  Note: You should restart the backend after this fix")
    else:
        logger.error("❌ Failed to apply fix")