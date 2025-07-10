#!/usr/bin/env python3
"""Debug UI Composer Error"""

import sys
sys.path.append('.')

# Directly test the line that's failing
try:
    # Test if 'code' is defined
    print(code)
except NameError as e:
    print(f"NameError: {e}")

# Check the actual claude_cli_service.py file around line 534
with open('api/ui_composer/claude_cli_service.py', 'r') as f:
    lines = f.readlines()
    print(f"\nLine 534 content: {lines[533].strip()}")
    print(f"Lines 530-540:")
    for i in range(530, min(540, len(lines))):
        print(f"{i}: {lines[i-1].rstrip()}")

# Import and check the module
from api.ui_composer.claude_cli_service import ClaudeCLIService

# Check if there's a syntax error in the prompts
prompt_test = """Test prompt with
multiple lines
and variables"""

print(f"\nPrompt test successful")

# Look for any bare 'code' references
import re
with open('api/ui_composer/claude_cli_service.py', 'r') as f:
    content = f.read()
    # Find bare 'code' (not in strings, not as property)
    pattern = r'(?<!["\'])(?<!\.)(?<!_)\bcode\b(?!["\'])'
    matches = re.finditer(pattern, content)
    for match in matches:
        line_num = content[:match.start()].count('\n') + 1
        print(f"\nFound bare 'code' at line {line_num}")
        # Get context
        lines = content.split('\n')
        start = max(0, line_num - 3)
        end = min(len(lines), line_num + 2)
        for i in range(start, end):
            marker = ">>>" if i == line_num - 1 else "   "
            print(f"{marker} {i+1}: {lines[i]}")