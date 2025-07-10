#!/usr/bin/env python3
"""Test Claude CLI completely standalone"""

import subprocess
import os
import json
from pathlib import Path

# Get auth token
auth_token = None
ide_dir = Path.home() / ".claude" / "ide"
for lock_file in ide_dir.glob("*.lock"):
    try:
        with open(lock_file) as f:
            auth_token = json.load(f).get('authToken')
            if auth_token:
                break
    except:
        pass

if not auth_token:
    print("No auth token found!")
    exit(1)

env = os.environ.copy()
env['CLAUDE_AUTH_TOKEN'] = auth_token
env['CLAUDE_NON_INTERACTIVE'] = 'true'

print("Testing Claude CLI standalone (no backend dependencies)...\n")

# Test 1: Very simple prompt
print("1. Simple test:")
cmd = ['claude', '--print', 'Respond with only: WORKING']
try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10, env=env)
    print(f"   Success: {result.returncode == 0}")
    print(f"   Output: {result.stdout.strip()}")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout!")

# Test 2: JSON analysis
print("\n2. JSON analysis (like UI Composer):")
prompt = '''Return ONLY this JSON:
{
  "intent": "show vital signs",
  "components": [{"type": "chart", "purpose": "display vitals"}]
}'''

cmd = ['claude', '--print', prompt]
try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15, env=env)
    if result.returncode == 0:
        print(f"   Success: True")
        output = result.stdout.strip()
        # Try to parse
        try:
            # Remove markdown if present
            if '```' in output:
                import re
                match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', output, re.DOTALL)
                if match:
                    output = match.group(1).strip()
            parsed = json.loads(output)
            print(f"   Valid JSON: {list(parsed.keys())}")
        except:
            print(f"   JSON parse failed")
            print(f"   Raw output: {output[:100]}...")
    else:
        print(f"   Failed with code: {result.returncode}")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout!")

# Test 3: Component generation (simplified)
print("\n3. Simple component generation:")
prompt = '''Return ONLY React code:
import React from 'react';
const TestComponent = () => <div>Test</div>;
export default TestComponent;'''

cmd = ['claude', '--print', prompt]
try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15, env=env)
    if result.returncode == 0:
        print(f"   Success: True")
        print(f"   Output length: {len(result.stdout)}")
        print(f"   Has React import: {'import React' in result.stdout}")
    else:
        print(f"   Failed with code: {result.returncode}")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout!")

print("\nConclusion: If these tests pass, the issue is likely with backend/async interactions.")