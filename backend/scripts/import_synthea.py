#!/usr/bin/env python3
"""
Import Synthea FHIR Data

Command-line script to import Synthea-generated FHIR bundles into MedGenEMR.

Usage:
    python import_synthea.py <synthea_output_directory>
    python import_synthea.py --single <patient_bundle.json>
    python import_synthea.py --validate
"""

import sys
import os
import asyncio
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from importers.synthea_fhir import SyntheaFHIRImporter


async def import_directory(directory: str):
    """Import all bundles from a directory."""
    importer = SyntheaFHIRImporter()
    
    print(f"Importing FHIR bundles from: {directory}")
    print("=" * 60)
    
    try:
        stats = await importer.import_directory(directory)
        
        print("\n✅ Import Complete!")
        print("=" * 60)
        print(f"Bundles processed: {stats['bundles_processed']}")
        print(f"Resources imported: {stats['resources_imported']}")
        
        print("\nResource counts by type:")
        for resource_type, count in sorted(stats['resource_counts'].items()):
            print(f"  {resource_type:.<30} {count:>6}")
        
        if stats['errors']:
            print(f"\n⚠️  Errors encountered: {len(stats['errors'])}")
            for i, error in enumerate(stats['errors'][:10], 1):
                print(f"\n  Error {i}:")
                print(f"    File: {error.get('file', error.get('resource', 'Unknown'))}")
                print(f"    Error: {error['error']}")
            
            if len(stats['errors']) > 10:
                print(f"\n  ... and {len(stats['errors']) - 10} more errors")
        
        # Run validation
        print("\n🔍 Validating imported data...")
        validation = await importer.validate_import()
        
        print("\nDatabase resource counts:")
        total = 0
        for resource_type, count in sorted(validation['resource_counts'].items()):
            print(f"  {resource_type:.<30} {count:>6}")
            total += count
        print(f"  {'TOTAL':.<30} {total:>6}")
        
        if validation['broken_references']:
            print(f"\n⚠️  Broken references found: {len(validation['broken_references'])}")
            for ref in validation['broken_references'][:5]:
                print(f"  {ref['source']} -> {ref['target']}")
        else:
            print("\n✅ No broken references found!")
        
        print("\nSearch index coverage:")
        for resource_type, coverage in sorted(validation['search_index_coverage'].items()):
            print(f"  {resource_type:.<30} {coverage['coverage']:>6}")
            
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        return 1
    
    return 0


async def import_single(file_path: str):
    """Import a single patient bundle."""
    importer = SyntheaFHIRImporter()
    
    print(f"Importing single bundle: {file_path}")
    print("=" * 60)
    
    try:
        stats = await importer.import_single_patient(file_path)
        
        print("\n✅ Import Complete!")
        print(f"Resources imported: {stats['resources_imported']}")
        
        if stats['resource_counts']:
            print("\nResource counts:")
            for resource_type, count in sorted(stats['resource_counts'].items()):
                print(f"  {resource_type:.<30} {count:>6}")
                
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        return 1
    
    return 0


async def validate_only():
    """Just run validation on existing data."""
    importer = SyntheaFHIRImporter()
    
    print("🔍 Validating existing FHIR data...")
    print("=" * 60)
    
    try:
        validation = await importer.validate_import()
        
        print("\nDatabase resource counts:")
        total = 0
        for resource_type, count in sorted(validation['resource_counts'].items()):
            print(f"  {resource_type:.<30} {count:>6}")
            total += count
        print(f"  {'TOTAL':.<30} {total:>6}")
        
        if validation['broken_references']:
            print(f"\n⚠️  Broken references found: {len(validation['broken_references'])}")
            for ref in validation['broken_references'][:10]:
                print(f"  {ref['source']} -> {ref['target']}")
        else:
            print("\n✅ No broken references found!")
        
        print("\nSearch index coverage:")
        for resource_type, coverage in sorted(validation['search_index_coverage'].items()):
            indexed = coverage['indexed']
            total = coverage['total']
            pct = coverage['coverage']
            bar_width = 20
            filled = int(bar_width * indexed / total) if total > 0 else 0
            bar = "█" * filled + "░" * (bar_width - filled)
            
            print(f"  {resource_type:<20} [{bar}] {pct:>6} ({indexed}/{total})")
            
    except Exception as e:
        print(f"\n❌ Validation failed: {e}")
        return 1
    
    return 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Import Synthea FHIR data into MedGenEMR"
    )
    
    parser.add_argument(
        "directory",
        nargs="?",
        help="Directory containing Synthea FHIR bundles"
    )
    
    parser.add_argument(
        "--single",
        help="Import a single patient bundle file"
    )
    
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate existing data without importing"
    )
    
    args = parser.parse_args()
    
    # Determine what to do
    if args.validate:
        return asyncio.run(validate_only())
    elif args.single:
        if not os.path.exists(args.single):
            print(f"❌ File not found: {args.single}")
            return 1
        return asyncio.run(import_single(args.single))
    elif args.directory:
        if not os.path.exists(args.directory):
            print(f"❌ Directory not found: {args.directory}")
            return 1
        return asyncio.run(import_directory(args.directory))
    else:
        # Default: look for common Synthea output locations
        common_paths = [
            "./synthea_output/fhir",
            "../synthea/output/fhir",
            "./data/synthea/fhir",
            "./synthea/output/fhir"
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                print(f"Found Synthea output at: {path}")
                return asyncio.run(import_directory(path))
        
        print("❌ No Synthea output directory found.")
        print("\nPlease specify the directory containing FHIR bundles:")
        print(f"  {sys.argv[0]} <directory>")
        print("\nOr run Synthea first to generate data:")
        print("  cd synthea")
        print("  ./run_synthea -p 10")
        return 1


if __name__ == "__main__":
    sys.exit(main())