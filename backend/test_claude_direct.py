#!/usr/bin/env python3
"""Test Claude CLI directly"""

import asyncio
import subprocess
import os

async def test_claude():
    # Test if Claude CLI works at all
    cmd = ['claude', '--version']
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        print(f"Version check - stdout: {stdout.decode()}")
        print(f"Version check - stderr: {stderr.decode()}")
        print(f"Version check - returncode: {process.returncode}")
    except Exception as e:
        print(f"Error checking version: {e}")
    
    # Now test with a simple prompt that contains 'code'
    prompt = "Write a simple function that prints hello world"
    cmd2 = ['claude', '--print', prompt]
    
    try:
        print(f"\nTesting prompt with 'code' reference...")
        process2 = await asyncio.create_subprocess_exec(
            *cmd2,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "CLAUDE_NON_INTERACTIVE": "true"}
        )
        
        stdout2, stderr2 = await process2.communicate()
        print(f"Prompt test - returncode: {process2.returncode}")
        print(f"Prompt test - stdout length: {len(stdout2.decode())}")
        print(f"Prompt test - stderr: {stderr2.decode()[:200]}")
        
        # Check if response contains certain patterns
        response = stdout2.decode()
        if 'code' in response:
            print("Response contains 'code'")
        if 'def ' in response or 'function' in response:
            print("Response contains function definition")
            
    except Exception as e:
        print(f"Error with prompt test: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test_claude())