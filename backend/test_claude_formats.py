#!/usr/bin/env python3
"""Test different Claude CLI formats"""

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
            auth_token = json.load(f).get('authToken')
            break
    except:
        pass

if not auth_token:
    print("No auth token!")
    exit(1)

env = os.environ.copy()
env['CLAUDE_AUTH_TOKEN'] = auth_token
env['CLAUDE_NON_INTERACTIVE'] = 'true'

print("Testing different Claude CLI formats...\n")

# Test 1: Simple text
print("1. Simple text prompt:")
result = subprocess.run(
    ['claude', '--print', 'Say hello'],
    capture_output=True, text=True, timeout=10, env=env
)
print(f"   Result: {result.stdout.strip()[:50]}...")
print(f"   Success: {result.returncode == 0}")

# Test 2: With output format
print("\n2. With --output-format text:")
result = subprocess.run(
    ['claude', '--print', '--output-format', 'text', 'Say hello'],
    capture_output=True, text=True, timeout=10, env=env
)
print(f"   Result: {result.stdout.strip()[:50]}...")
print(f"   Success: {result.returncode == 0}")

# Test 3: JSON output format
print("\n3. With --output-format json:")
result = subprocess.run(
    ['claude', '--print', '--output-format', 'json', 'Say hello'],
    capture_output=True, text=True, timeout=10, env=env
)
print(f"   Result: {result.stdout.strip()[:100]}...")
if result.returncode == 0:
    try:
        parsed = json.loads(result.stdout)
        print(f"   ✓ Valid JSON with keys: {list(parsed.keys())[:5]}")
    except:
        print("   ✗ Not valid JSON")

# Test 4: Complex prompt via stdin
print("\n4. Complex prompt via stdin:")
complex_prompt = """Analyze this request and respond with JSON:
{
  "intent": "what the user wants",
  "components": ["list of UI components needed"]
}

Request: Show patient vital signs"""

proc = subprocess.Popen(
    ['claude', '--print', '--output-format', 'text'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    env=env
)

try:
    stdout, stderr = proc.communicate(input=complex_prompt, timeout=15)
    print(f"   Success: {proc.returncode == 0}")
    print(f"   Output length: {len(stdout)}")
    if stdout:
        print(f"   First 200 chars: {stdout[:200]}...")
except subprocess.TimeoutExpired:
    print("   ✗ Timeout!")
    proc.kill()