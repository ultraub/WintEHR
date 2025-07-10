#!/usr/bin/env python3
"""Test async subprocess issue"""

import asyncio
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

async def test_simple_async():
    """Test very simple async subprocess"""
    print("1. Testing simple async echo:")
    
    process = await asyncio.create_subprocess_exec(
        'echo', 'TEST',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await process.communicate()
    print(f"   Result: {stdout.decode().strip()}")

async def test_claude_async():
    """Test Claude with async subprocess"""
    print("\n2. Testing Claude async (minimal):")
    
    env = os.environ.copy()
    env['CLAUDE_AUTH_TOKEN'] = auth_token
    env['CLAUDE_NON_INTERACTIVE'] = 'true'
    
    # Use shell=False (exec)
    process = await asyncio.create_subprocess_exec(
        'claude', '--print', 'Say OK',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )
    
    try:
        # Try with short timeout
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=10.0
        )
        
        print(f"   Success: {process.returncode == 0}")
        print(f"   Output: {stdout.decode()[:50]}")
        
    except asyncio.TimeoutError:
        print("   ✗ Timeout after 10s")
        # Try to terminate
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            print("   Had to kill process")
            process.kill()
            await process.wait()

async def test_with_shell():
    """Test using shell=True"""
    print("\n3. Testing with shell command:")
    
    env = os.environ.copy()
    env['CLAUDE_AUTH_TOKEN'] = auth_token
    env['CLAUDE_NON_INTERACTIVE'] = 'true'
    
    # Try with shell
    process = await asyncio.create_subprocess_shell(
        'claude --print "Say OK"',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )
    
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=10.0
        )
        
        print(f"   Success: {process.returncode == 0}")
        print(f"   Output: {stdout.decode()[:50]}")
        
    except asyncio.TimeoutError:
        print("   ✗ Timeout with shell too")
        process.kill()
        await process.wait()

# Test different event loop implementations
async def main():
    await test_simple_async()
    await test_claude_async()
    await test_with_shell()

if __name__ == "__main__":
    print("Testing async subprocess variations...\n")
    
    # Try with different event loop policy on macOS
    if hasattr(asyncio, 'WindowsSelectorEventLoopPolicy'):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main())