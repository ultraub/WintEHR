#!/usr/bin/env python3
"""Test with actual UI Composer prompts"""

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

# Test with progressively longer prompts
prompts = [
    # 1. Very simple
    "Say OK",
    
    # 2. Simple JSON
    'Return this JSON: {"status": "ok"}',
    
    # 3. Short analysis prompt
    '''Analyze "show patient data" and return JSON with these fields: intent, components''',
    
    # 4. Medium prompt (similar to UI composer)
    '''You are a UI design expert. Analyze this request: "show patient vital signs"
    
Respond with a JSON object containing:
{
  "intent": "what the user wants",
  "components": [{"type": "chart", "purpose": "show data"}]
}''',
    
    # 5. Longer prompt with context
    '''You are a UI design expert for a clinical EMR system. Analyze the following natural language request and create a detailed UI specification.

Request: "show patient vital signs"
Generation Mode: mixed

Please analyze this request and respond with a JSON object containing:
{
  "intent": "brief description of what the user wants",
  "scope": "patient",
  "layoutType": "focused-view",
  "components": [
    {
      "type": "chart",
      "purpose": "what this component will show"
    }
  ]
}'''
]

async def test_prompt(idx, prompt):
    """Test a single prompt"""
    print(f"\n{idx}. Testing prompt length {len(prompt)}:")
    print(f"   First 50 chars: {prompt[:50].replace(chr(10), ' ')}...")
    
    try:
        # First try sync (known to work)
        result = subprocess.run(
            ['claude', '--print', prompt],
            capture_output=True,
            text=True,
            timeout=30,
            env=env
        )
        
        if result.returncode == 0:
            print(f"   ✓ Sync success, output length: {len(result.stdout)}")
            
            # If sync works, try async
            process = await asyncio.create_subprocess_exec(
                'claude', '--print', prompt,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=30
                )
                
                if process.returncode == 0:
                    print(f"   ✓ Async success, output length: {len(stdout.decode())}")
                else:
                    print(f"   ✗ Async failed with code {process.returncode}")
                    print(f"   stderr: {stderr.decode()[:100]}")
                    
            except asyncio.TimeoutError:
                print(f"   ✗ Async timeout!")
                process.kill()
                await process.wait()
                
        else:
            print(f"   ✗ Sync failed with code {result.returncode}")
            print(f"   stderr: {result.stderr[:100]}")
            
    except subprocess.TimeoutExpired:
        print(f"   ✗ Sync timeout!")
    except Exception as e:
        print(f"   ✗ Error: {e}")

async def main():
    """Test all prompts"""
    for idx, prompt in enumerate(prompts, 1):
        await test_prompt(idx, prompt)
        await asyncio.sleep(1)  # Small delay between tests

if __name__ == "__main__":
    print("Testing actual UI Composer prompts...\n")
    asyncio.run(main())