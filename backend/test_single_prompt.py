#!/usr/bin/env python3
"""Test a single prompt"""

import subprocess
import os
import json
from pathlib import Path
import sys

# Get auth token
ide_dir = Path.home() / ".claude" / "ide"
auth_token = None

for lock_file in ide_dir.glob("*.lock"):
    try:
        with open(lock_file) as f:
            auth_token = json.load(f).get('authToken')
            break
    except:
        pass

if not auth_token:
    print("No auth token!")
    sys.exit(1)

env = os.environ.copy()
env['CLAUDE_AUTH_TOKEN'] = auth_token
env['CLAUDE_NON_INTERACTIVE'] = 'true'

# Test a simple JSON request
prompt = 'Please respond with only this JSON (no markdown, no explanation): {"intent": "show vital signs", "components": [{"type": "chart"}]}'

print(f"Testing prompt: {prompt[:80]}...")
print(f"Prompt length: {len(prompt)}")

try:
    result = subprocess.run(
        ['claude', '--print', prompt],
        capture_output=True,
        text=True,
        timeout=20,
        env=env
    )
    
    print(f"\nReturn code: {result.returncode}")
    print(f"Output length: {len(result.stdout)}")
    
    if result.returncode == 0:
        print(f"\nRaw output:\n{result.stdout}")
        
        # Try to extract JSON
        output = result.stdout.strip()
        
        # Remove markdown if present
        if '```' in output:
            print("\nDetected markdown, cleaning...")
            import re
            json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', output, re.DOTALL)
            if json_match:
                output = json_match.group(1).strip()
                print(f"Cleaned output:\n{output}")
        
        # Try to parse
        try:
            parsed = json.loads(output)
            print(f"\n✓ Valid JSON: {parsed}")
        except json.JSONDecodeError as e:
            print(f"\n✗ JSON parse error: {e}")
            
    else:
        print(f"\nError output:\n{result.stderr}")
        
except subprocess.TimeoutExpired:
    print("\n✗ Timeout after 20 seconds!")
except Exception as e:
    print(f"\n✗ Error: {e}")