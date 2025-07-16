#!/usr/bin/env python3
"""
Catalog Extraction Demo Script

Demonstrates the catalog extraction functionality by showing:
1. Current patient data statistics
2. Extracted medications with occurrence counts
3. Extracted conditions with activity status
4. Extracted lab tests with specimen types
"""

import asyncio
import sys
import os
from typing import Dict, Any

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DATABASE_URL
from api.services.clinical.catalog_extractor import CatalogExtractor
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import json


async def demo_catalog_extraction():
    """
    Demonstrate catalog extraction capabilities.
    """
    print("=" * 60)
    print("CATALOG EXTRACTION DEMO")
    print("=" * 60)
    
    # Create async engine and session
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("\n1. Extracting catalogs from patient FHIR data...")
        extractor = CatalogExtractor(session)
        extracted_data = await extractor.extract_all_catalogs()
        
        # Show summary
        print("\n2. EXTRACTION SUMMARY")
        print("-" * 40)
        summary = extractor.get_extraction_summary()
        
        print(f"Patient Count: {summary['metadata']['patient_count']}")
        print(f"Last Extraction: {summary['metadata']['last_extraction']}")
        print()
        print(f"Medications:")
        print(f"  - Unique medications: {summary['medications']['total']}")
        print(f"  - Total prescriptions: {summary['medications']['total_occurrences']}")
        print()
        print(f"Conditions:")
        print(f"  - Unique conditions: {summary['conditions']['total']}")
        print(f"  - Total occurrences: {summary['conditions']['total_occurrences']}")
        print(f"  - Currently active: {summary['conditions']['active_conditions']}")
        print()
        print(f"Lab Tests:")
        print(f"  - Unique tests: {summary['lab_tests']['total']}")
        print(f"  - Total results: {summary['lab_tests']['total_occurrences']}")
        print(f"  - Tests with values: {summary['lab_tests']['tests_with_values']}")
        
        # Show top medications
        print("\n3. TOP MEDICATIONS (by frequency)")
        print("-" * 40)
        top_meds = extractor.get_medications_list(limit=10)
        for i, med in enumerate(top_meds, 1):
            print(f"{i:2d}. {med['display_name']}")
            print(f"     RxNorm: {med['rxnorm_code']} | Used {med['occurrence_count']} times")
            if med['strength'] != 'Unknown' and med['dosage_form'] != 'Unknown':
                print(f"     Strength: {med['strength']} | Form: {med['dosage_form']}")
            print()
        
        # Show top conditions
        print("\n4. TOP CONDITIONS (by frequency)")
        print("-" * 40)
        top_conditions = extractor.get_conditions_list(limit=10)
        for i, cond in enumerate(top_conditions, 1):
            active_info = f" ({cond['active_count']} active)" if cond['active_count'] > 0 else " (resolved)"
            print(f"{i:2d}. {cond['condition_name']}")
            print(f"     SNOMED: {cond['snomed_code']} | Seen {cond['occurrence_count']} times{active_info}")
            if cond['is_disorder']:
                print("     Type: Disorder")
            elif cond['is_finding']:
                print("     Type: Clinical Finding")
            print()
        
        # Show lab tests by specimen type
        print("\n5. LAB TESTS BY SPECIMEN TYPE")
        print("-" * 40)
        
        specimen_types = ['Blood', 'Urine', 'Serum', 'Plasma']
        for specimen in specimen_types:
            tests = extractor.get_lab_tests_list(specimen_type=specimen, limit=5)
            if tests:
                print(f"\n{specimen.upper()} TESTS:")
                for test in tests:
                    print(f"  • {test['test_name']}")
                    print(f"    LOINC: {test['loinc_code']} | Used {test['occurrence_count']} times")
                    if test['reference_range']:
                        ref_text = test['reference_range'].get('text', 'N/A')
                        print(f"    Reference: {ref_text}")
        
        # Show search examples
        print("\n6. SEARCH EXAMPLES")
        print("-" * 40)
        
        # Search for diabetes medications
        diabetes_meds = extractor.get_medications_list(search_term="metformin")
        if diabetes_meds:
            print("\nDIABETES MEDICATIONS (search: 'metformin'):")
            for med in diabetes_meds:
                print(f"  • {med['display_name']} (used {med['occurrence_count']} times)")
        
        # Search for diabetes conditions
        diabetes_conditions = extractor.get_conditions_list(search_term="diabetes")
        if diabetes_conditions:
            print("\nDIABETES-RELATED CONDITIONS (search: 'diabetes'):")
            for cond in diabetes_conditions:
                print(f"  • {cond['condition_name']} (seen {cond['occurrence_count']} times)")
        
        # Search for glucose tests
        glucose_tests = extractor.get_lab_tests_list(search_term="glucose")
        if glucose_tests:
            print("\nGLUCOSE TESTS (search: 'glucose'):")
            for test in glucose_tests:
                print(f"  • {test['test_name']} (performed {test['occurrence_count']} times)")
        
        print("\n" + "=" * 60)
        print("DEMO COMPLETE")
        print("\nThese catalogs are now available via API endpoints:")
        print("- GET /api/catalogs/extracted/medications")
        print("- GET /api/catalogs/extracted/conditions")
        print("- GET /api/catalogs/extracted/lab-tests")
        print("- GET /api/catalogs/extracted/summary")
        print("=" * 60)


async def main():
    """Main function"""
    try:
        await demo_catalog_extraction()
    except Exception as e:
        print(f"Error during demo: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())