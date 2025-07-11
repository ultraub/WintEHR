#!/usr/bin/env python3
"""Import new patients without wiping existing data."""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from scripts.synthea_master import SyntheaMaster

async def main():
    """Import new patients to existing database."""
    master = SyntheaMaster(verbose=True)
    
    # Just import without wiping
    print("Starting import of new patients...")
    success = await master.import_data(
        validation_mode="transform_only",
        batch_size=25
    )
    
    if success:
        print("\n✅ Import completed successfully!")
        await master.validate_data()
    else:
        print("\n❌ Import failed!")
    
    await master.cleanup()

if __name__ == "__main__":
    asyncio.run(main())