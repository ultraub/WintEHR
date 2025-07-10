#!/usr/bin/env python3
"""Test if the issue is with async subprocess"""

import asyncio
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

env = os.environ.copy()
env['CLAUDE_AUTH_TOKEN'] = auth_token
env['CLAUDE_NON_INTERACTIVE'] = 'true'

print("Testing subprocess methods...\n")

# Test 1: Sync subprocess (known to work)
print("1. Sync subprocess.run:")
try:
    result = subprocess.run(
        ['claude', '--print', 'Say TEST'],
        capture_output=True,
        text=True,
        timeout=10,
        env=env
    )
    print(f"   Success: {result.returncode == 0}")
    print(f"   Output: {result.stdout.strip()[:50]}...")
except Exception as e:
    print(f"   Error: {e}")

# Test 2: Async subprocess
async def test_async():
    print("\n2. Async subprocess:")
    try:
        process = await asyncio.create_subprocess_exec(
            'claude', '--print', 'Say TEST',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=10
        )
        
        print(f"   Success: {process.returncode == 0}")
        print(f"   Output: {stdout.decode()[:50]}...")
        
    except asyncio.TimeoutError:
        print("   ✗ Timeout!")
        process.kill()
        await process.wait()
    except Exception as e:
        print(f"   Error: {e}")

# Test 3: Async with stdin
async def test_async_stdin():
    print("\n3. Async with stdin:")
    try:
        process = await asyncio.create_subprocess_exec(
            'claude', '--print',
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        stdout, stderr = await asyncio.wait_for(
            process.communicate(input=b'Say TEST'),
            timeout=10
        )
        
        print(f"   Success: {process.returncode == 0}")
        print(f"   Output: {stdout.decode()[:50]}...")
        
    except asyncio.TimeoutError:
        print("   ✗ Timeout!")
        process.kill()
        await process.wait()
    except Exception as e:
        print(f"   Error: {e}")

# Test 4: Check if it's the event loop
async def test_with_new_loop():
    print("\n4. Testing with explicit event loop policy:")
    # Try with a different event loop policy
    if hasattr(asyncio, 'WindowsSelectorEventLoopPolicy'):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        process = await asyncio.create_subprocess_exec(
            'echo', 'TEST',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        print(f"   Echo test success: {stdout.decode().strip()}")
        
    except Exception as e:
        print(f"   Error: {e}")

# Run async tests
asyncio.run(test_async())
asyncio.run(test_async_stdin())
asyncio.run(test_with_new_loop())