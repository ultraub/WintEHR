#!/usr/bin/env python3
"""
Fix storage.py Reference Parameter Extraction

This script updates the storage.py file to ensure all reference parameters
are stored in value_reference instead of value_string.
"""

import re
import shutil
from datetime import datetime

# Backup the original file
storage_file = "/Users/robertbarrett/Library/Mobile Documents/com~apple~CloudDocs/dev/MedGenEMR/backend/fhir/core/storage.py"
backup_file = f"{storage_file}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"

print(f"Creating backup: {backup_file}")
shutil.copy2(storage_file, backup_file)

# Read the file
with open(storage_file, 'r') as f:
    content = f.read()

# Pattern to find reference parameters using value_string
pattern = r"(\s+'param_type':\s*'reference',\s*\n\s*)'value_string':"

# Count occurrences
occurrences = len(re.findall(pattern, content))
print(f"Found {occurrences} reference parameters using value_string")

# Replace value_string with value_reference for reference type parameters
content_fixed = re.sub(pattern, r"\1'value_reference':", content)

# Verify the changes
occurrences_after = len(re.findall(pattern, content_fixed))
print(f"After fix: {occurrences_after} reference parameters using value_string (should be 0)")

# Write the fixed content back
with open(storage_file, 'w') as f:
    f.write(content_fixed)

print(f"✓ Fixed {occurrences} occurrences in storage.py")
print(f"✓ Backup saved as: {backup_file}")

# Verify no reference params use value_string anymore
remaining = len(re.findall(r"'param_type':\s*'reference'.*?'value_string':", content_fixed, re.DOTALL))
if remaining > 0:
    print(f"WARNING: {remaining} reference parameters might still use value_string")
else:
    print("✓ All reference parameters now use value_reference")