#!/usr/bin/env python3
"""Test Claude CLI synchronously"""

import subprocess
import os
import json
from pathlib import Path

# Get auth token
ide_dir = Path.home() / ".claude" / "ide"
auth_token = None

for lock_file in ide_dir.glob("*.lock"):
    try:
        with open(lock_file) as f:
            data = json.load(f)
            auth_token = data.get('authToken')
            print(f"Found auth token: {auth_token[:8]}...")
            break
    except:
        pass

if not auth_token:
    print("No auth token found!")
    exit(1)

# Test 1: Version check
print("\n1. Testing version check...")
cmd = ['claude', '--version']
env = os.environ.copy()
env['CLAUDE_AUTH_TOKEN'] = auth_token

try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=5, env=env)
    print(f"   Return code: {result.returncode}")
    print(f"   Output: {result.stdout.strip()}")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout!")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test 2: Simple prompt
print("\n2. Testing simple prompt...")
simple_prompt = "Respond with only: OK"
cmd = ['claude', '--print', '--output-format', 'text', simple_prompt]

try:
    print(f"   Running: {' '.join(cmd[:3])}... '{simple_prompt}'")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10, env=env)
    print(f"   Return code: {result.returncode}")
    print(f"   Output: {result.stdout.strip()}")
    if result.stderr:
        print(f"   Stderr: {result.stderr.strip()}")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout after 10 seconds!")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test 3: JSON analysis prompt
print("\n3. Testing JSON analysis...")
json_prompt = 'Respond with only this JSON: {"status": "ok", "message": "test"}'
cmd = ['claude', '--print', '--output-format', 'text', json_prompt]

try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10, env=env)
    print(f"   Return code: {result.returncode}")
    if result.returncode == 0:
        print(f"   Output: {result.stdout.strip()}")
        try:
            parsed = json.loads(result.stdout.strip())
            print(f"   ✓ Valid JSON: {parsed}")
        except:
            print("   ✗ Not valid JSON")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout!")
except Exception as e:
    print(f"   ✗ Error: {e}")