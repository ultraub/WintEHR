#!/usr/bin/env python3
"""
Non-interactive version of the migration script
"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent))

from scripts.migrations.migrate_search_params import SearchParamMigrator


async def main():
    """Run the migration without confirmation prompt."""
    print("Search Parameter Migration Tool")
    print("==============================\n")
    print("Re-indexing all FHIR resources with comprehensive search parameters...\n")
    
    migrator = SearchParamMigrator(batch_size=100)
    await migrator.migrate()


if __name__ == "__main__":
    asyncio.run(main())