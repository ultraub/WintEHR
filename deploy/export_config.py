#!/usr/bin/env python3
"""
Export configuration as shell environment variables.
Used by deploy/load_config.sh to make config available to bash scripts.
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from deploy.config_loader import load_config, ConfigurationError


def flatten_dict(d, parent_key='', sep='_'):
    """Flatten nested dictionary into environment variable format."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key.upper(), sep=sep).items())
        elif isinstance(v, list):
            # Convert list to comma-separated string
            items.append((new_key.upper(), ','.join(str(x) for x in v)))
        elif isinstance(v, bool):
            # Convert boolean to string
            items.append((new_key.upper(), 'true' if v else 'false'))
        elif v is not None:
            items.append((new_key.upper(), str(v)))
    return dict(items)


try:
    # Load configuration
    env = sys.argv[1] if len(sys.argv) > 1 else None
    config = load_config(environment=env)

    # Flatten configuration
    flat_config = flatten_dict(config)

    # Print export statements
    for key, value in flat_config.items():
        # Escape single quotes in value
        escaped_value = value.replace("'", "'\\''")
        print(f"export WINTEHR_{key}='{escaped_value}'")

except ConfigurationError as e:
    print(f"echo '❌ Configuration error: {e}' >&2", file=sys.stderr)
    print("return 1 2>/dev/null || exit 1", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"echo '❌ Unexpected error: {e}' >&2", file=sys.stderr)
    print("return 1 2>/dev/null || exit 1", file=sys.stderr)
    sys.exit(1)
