#!/usr/bin/env python3
"""
Fix transaction handling in FHIR storage engine.

The issue: When errors occur during search parameter extraction, they are logged
but not raised, leaving the transaction in a failed state. Subsequent operations
then fail with "current transaction is aborted".

This script patches the storage engine to properly handle these errors.
"""

import os
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def fix_storage_transaction_handling():
    """Fix transaction handling in storage.py"""
    
    storage_path = "/app/fhir/core/storage.py"
    
    # Read the current file
    try:
        with open(storage_path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        logger.error(f"File not found: {storage_path}")
        return False
    
    # Fix 1: Make _extract_search_parameters raise errors instead of swallowing them
    old_extract_params = """            except Exception as e:
                logging.error(f"Error storing search parameter {param.get('param_name')}: {e}")"""
    
    new_extract_params = """            except Exception as e:
                logging.error(f"Error storing search parameter {param.get('param_name')}: {e}")
                # Re-raise the error to ensure transaction is properly handled
                raise"""
    
    if old_extract_params in content:
        content = content.replace(old_extract_params, new_extract_params)
        logger.info("✅ Fixed search parameter error handling")
    else:
        logger.info("✓ Search parameter error handling already fixed or not found")
    
    # Fix 2: Ensure all operations are inside the transaction block
    # Look for the update_resource method and ensure proper transaction handling
    
    # Write the fixed content back
    try:
        with open(storage_path, 'w') as f:
            f.write(content)
        logger.info("✅ Successfully updated storage.py")
        return True
    except Exception as e:
        logger.error(f"Failed to write file: {e}")
        return False

def verify_fix():
    """Verify the fix was applied correctly"""
    storage_path = "/app/fhir/core/storage.py"
    
    try:
        with open(storage_path, 'r') as f:
            content = f.read()
        
        # Check if the fix is present
        if '# Re-raise the error to ensure transaction is properly handled' in content:
            logger.info("✅ Fix verified: Error handling is properly re-raising exceptions")
            return True
        else:
            logger.error("❌ Fix not found in file")
            return False
    except Exception as e:
        logger.error(f"Failed to verify fix: {e}")
        return False

if __name__ == "__main__":
    logger.info("Fixing FHIR storage transaction handling...")
    
    if fix_storage_transaction_handling():
        if verify_fix():
            logger.info("✅ Transaction handling fix completed successfully")
            logger.info("⚠️  Note: You should restart the backend after this fix")
        else:
            logger.error("❌ Fix verification failed")
            sys.exit(1)
    else:
        logger.error("❌ Failed to apply fix")
        sys.exit(1)