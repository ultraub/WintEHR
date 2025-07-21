#!/usr/bin/env python3
"""
Fix the FHIR router to properly pass _sort parameter to storage engine.

Created: 2025-01-21
"""

import sys
from pathlib import Path

# Path to the router.py file
ROUTER_FILE = Path(__file__).parent.parent.parent / "fhir/api/router.py"

def fix_sort_in_router():
    """Add _sort parameter handling to the FHIR router."""
    
    with open(ROUTER_FILE, 'r') as f:
        content = f.read()
    
    # First, add _sort to the function parameters
    old_params = '''    _has: Optional[List[str]] = Query(None, alias="_has")
):'''
    
    new_params = '''    _has: Optional[List[str]] = Query(None, alias="_has"),
    _sort: Optional[List[str]] = Query(None, alias="_sort")
):'''
    
    if old_params in content:
        content = content.replace(old_params, new_params)
        print("✅ Added _sort parameter to function signature")
    else:
        print("⚠️  Could not find expected function parameters")
    
    # Now add _sort to the search params before calling search_resources
    old_search_call = '''    # Try to get from cache first (only for GET requests without _include/_revinclude)
    cache = get_search_cache()'''
    
    new_search_call = '''    # Add _sort to search params if provided
    if _sort:
        search_params['_sort'] = _sort
    
    # Try to get from cache first (only for GET requests without _include/_revinclude)
    cache = get_search_cache()'''
    
    if old_search_call in content:
        content = content.replace(old_search_call, new_search_call)
        print("✅ Added _sort parameter passing to search_params")
    else:
        print("⚠️  Could not find expected cache initialization code")
    
    # Write the updated content
    with open(ROUTER_FILE, 'w') as f:
        f.write(content)
    
    print("\n📝 Summary:")
    print("The router now properly accepts and passes the _sort parameter to the storage engine.")
    print("This enables sorting of search results by specified fields.")

if __name__ == "__main__":
    fix_sort_in_router()