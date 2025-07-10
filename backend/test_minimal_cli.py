#!/usr/bin/env python3
"""Minimal test to isolate the CLI issue"""

import asyncio
import subprocess
import os

async def test_subprocess_with_code():
    """Test if subprocess with 'code' in prompt causes issues"""
    
    # Test 1: Simple echo with 'code'
    print("Test 1: Echo with 'code' word")
    try:
        process = await asyncio.create_subprocess_exec(
            'echo', 'This contains the word code',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        print(f"✓ Result: {stdout.decode().strip()}")
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Test 2: Echo with JavaScript-like code
    print("\nTest 2: Echo with JavaScript code")
    js_code = """const data = { 'code': '12345' };"""
    try:
        process = await asyncio.create_subprocess_exec(
            'echo', js_code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        print(f"✓ Result: {stdout.decode().strip()}")
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Test 3: Check if the Claude CLI itself has issues
    print("\nTest 3: Check Claude CLI availability")
    claude_path = "/Users/robertbarrett/.claude/local/claude"
    
    if os.path.exists(claude_path):
        print(f"✓ Claude CLI found at: {claude_path}")
        
        # Test version command
        try:
            process = await asyncio.create_subprocess_exec(
                claude_path, '--version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            print(f"✓ Version: {stdout.decode().strip()}")
        except Exception as e:
            print(f"✗ Version check error: {e}")
        
        # Test 4: Try a simple prompt with Claude
        print("\nTest 4: Simple Claude prompt")
        try:
            process = await asyncio.create_subprocess_exec(
                claude_path, '--print', 'Say hello',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, "CLAUDE_NON_INTERACTIVE": "true"}
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
            
            if process.returncode == 0:
                print(f"✓ Claude responded (length: {len(stdout.decode())})")
            else:
                print(f"✗ Claude returned error code: {process.returncode}")
                print(f"stderr: {stderr.decode()[:200]}")
        except asyncio.TimeoutError:
            print("✗ Claude CLI timed out")
        except Exception as e:
            print(f"✗ Claude prompt error: {e}")
    else:
        print(f"✗ Claude CLI not found at: {claude_path}")

if __name__ == "__main__":
    print("Testing subprocess and Claude CLI...\n")
    asyncio.run(test_subprocess_with_code())