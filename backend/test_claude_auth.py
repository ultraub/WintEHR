#!/usr/bin/env python3
"""Test Claude Code authentication"""

import os
import json
import subprocess
import asyncio
from pathlib import Path

async def test_claude_auth():
    """Test various authentication methods"""
    
    # 1. Check IDE lock file
    print("1. Checking IDE lock file...")
    ide_dir = Path.home() / ".claude" / "ide"
    lock_files = list(ide_dir.glob("*.lock"))
    
    auth_token = None
    for lock_file in lock_files:
        try:
            with open(lock_file) as f:
                data = json.load(f)
                print(f"   Found lock file: {lock_file.name}")
                print(f"   PID: {data.get('pid')}")
                print(f"   Auth token: {data.get('authToken')[:8]}...")
                print(f"   Workspace: {data.get('workspaceFolders', [])}")
                auth_token = data.get('authToken')
        except Exception as e:
            print(f"   Error reading {lock_file}: {e}")
    
    # 2. Test environment variables
    print("\n2. Checking environment variables...")
    claude_env_vars = {k: v for k, v in os.environ.items() if 'CLAUDE' in k}
    for key, value in claude_env_vars.items():
        print(f"   {key}: {value}")
    
    # 3. Test Claude CLI with auth token
    print("\n3. Testing Claude CLI with auth token...")
    if auth_token:
        # Set auth token in environment
        env = os.environ.copy()
        env['CLAUDE_AUTH_TOKEN'] = auth_token
        env['ANTHROPIC_AUTH_TOKEN'] = auth_token
        
        try:
            # Test with auth token
            result = await asyncio.create_subprocess_exec(
                'claude', '--version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=5)
            
            if result.returncode == 0:
                print(f"   ✓ Version with auth token: {stdout.decode().strip()}")
            else:
                print(f"   ✗ Version failed: {stderr.decode().strip()}")
        except asyncio.TimeoutError:
            print("   ✗ Timeout with auth token")
        except Exception as e:
            print(f"   ✗ Error: {e}")
    
    # 4. Test WebSocket connection
    print("\n4. Checking WebSocket port...")
    ws_port = os.environ.get('CLAUDE_CODE_SSE_PORT')
    if ws_port:
        print(f"   WebSocket port: {ws_port}")
        # Check if port is listening
        try:
            result = subprocess.run(
                ['lsof', '-i', f':{ws_port}'],
                capture_output=True,
                text=True
            )
            if result.stdout:
                print("   ✓ Port is active")
                print(f"   Process info: {result.stdout.splitlines()[1] if len(result.stdout.splitlines()) > 1 else 'N/A'}")
            else:
                print("   ✗ Port not active")
        except Exception as e:
            print(f"   Error checking port: {e}")
    
    # 5. Test direct CLI call
    print("\n5. Testing direct CLI call...")
    try:
        # Try with explicit non-interactive mode
        env = os.environ.copy()
        env['CLAUDE_NON_INTERACTIVE'] = 'true'
        if auth_token:
            env['CLAUDE_AUTH_TOKEN'] = auth_token
        
        result = await asyncio.create_subprocess_exec(
            'claude', '--print', '--output-format', 'text', 'Say hello',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=10)
            
            if result.returncode == 0:
                print(f"   ✓ Response: {stdout.decode()[:100]}...")
            else:
                print(f"   ✗ Failed with code {result.returncode}")
                print(f"   stderr: {stderr.decode()[:200]}")
        except asyncio.TimeoutError:
            print("   ✗ Timeout after 10 seconds")
            result.kill()
            await result.wait()
    except Exception as e:
        print(f"   ✗ Error: {e}")

if __name__ == "__main__":
    print("Testing Claude Code authentication state...\n")
    asyncio.run(test_claude_auth())