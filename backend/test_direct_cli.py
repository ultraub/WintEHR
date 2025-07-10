#!/usr/bin/env python3
"""Direct test of Claude CLI with auth"""

import subprocess
import json
from pathlib import Path

# Get auth token from lock file
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

if auth_token:
    # Test direct CLI call with auth
    cmd = [
        '/Users/robertbarrett/.nvm/versions/node/v22.17.0/bin/claude',
        '--print',
        '--output-format', 'text',
        'Return only: Hello World'
    ]
    
    import os
    env = os.environ.copy()
    env.update({
        'CLAUDE_AUTH_TOKEN': auth_token,
        'CLAUDE_NON_INTERACTIVE': 'true'
    })
    
    print(f"\nRunning: {' '.join(cmd)}")
    print("With auth token in env")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=15,
            env=env
        )
        
        print(f"\nReturn code: {result.returncode}")
        print(f"Stdout ({len(result.stdout)} chars): {result.stdout[:200]}")
        print(f"Stderr: {result.stderr[:200] if result.stderr else '(empty)'}")
        
    except subprocess.TimeoutExpired:
        print("\n✗ Command timed out after 15 seconds")
    except Exception as e:
        print(f"\n✗ Error: {e}")
else:
    print("No auth token found!")