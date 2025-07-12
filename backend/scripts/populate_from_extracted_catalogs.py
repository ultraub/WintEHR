#!/usr/bin/env python3
"""
Populate Database Catalogs from Extracted FHIR Data

This script takes the extracted catalog data from patient FHIR resources
and populates the database catalog tables (MedicationCatalog, LabTestCatalog).
"""

import asyncio
import sys
import os
from typing import Dict, Any

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import DATABASE_URL, get_db_session
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, Base
from services.catalog_extractor import CatalogExtractor
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def populate_database_catalogs():
    """
    Populate database catalog tables with extracted FHIR data.
    """
    # Create async engine and session
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        logger.info("Starting database catalog population from extracted FHIR data...")
        
        # Extract catalogs from FHIR data
        extractor = CatalogExtractor(session)
        extracted_data = await extractor.extract_all_catalogs()
        
        # Get summary
        summary = extractor.get_extraction_summary()
        logger.info(f"Extracted {summary['medications']['total']} medications, "
                   f"{summary['conditions']['total']} conditions, "
                   f"{summary['lab_tests']['total']} lab tests")
        
        # Clear existing catalog data
        logger.info("Clearing existing catalog data...")
        await session.execute(text("DELETE FROM medication_catalog"))
        await session.execute(text("DELETE FROM lab_test_catalog"))
        
        # Populate medication catalog
        logger.info("Populating medication catalog...")
        medication_count = 0
        for med_data in extracted_data['medications'].values():
            # Convert extracted data to catalog format
            catalog_med = MedicationCatalog(
                generic_name=med_data['generic_name'],
                brand_name=None,  # Not extracted from FHIR display names
                strength=med_data['strength'] if med_data['strength'] != 'Unknown' else None,
                dosage_form=med_data['dosage_form'] if med_data['dosage_form'] != 'Unknown' else None,
                drug_class=None,  # Could be enhanced with RxNorm API lookup
                therapeutic_category=None,  # Could be enhanced with RxNorm API lookup
                route="oral" if "Oral" in med_data['dosage_form'] else None,
                frequency_options=["once daily", "twice daily", "three times daily", "as needed"],
                standard_doses=[med_data['strength']] if med_data['strength'] != 'Unknown' else [],
                rxnorm_code=med_data['rxnorm_code'],
                is_formulary=True,
                is_active=True
            )
            session.add(catalog_med)
            medication_count += 1
        
        # Populate lab test catalog
        logger.info("Populating lab test catalog...")
        lab_test_count = 0
        for test_data in extracted_data['lab_tests'].values():
            # Convert extracted data to catalog format
            catalog_test = LabTestCatalog(
                test_name=test_data['test_name'],
                test_code=f"LOINC_{test_data['loinc_code']}",
                test_description=test_data['display_name'],
                test_category=_classify_lab_test(test_data['display_name']),
                specimen_type=test_data['specimen_type'] if test_data['specimen_type'] != 'Unknown' else None,
                loinc_code=test_data['loinc_code'],
                reference_range_text=test_data['reference_range'].get('text') if test_data['reference_range'] else None,
                reference_range_low=test_data['reference_range'].get('low') if test_data['reference_range'] else None,
                reference_range_high=test_data['reference_range'].get('high') if test_data['reference_range'] else None,
                reference_units=test_data['unit'] if test_data['unit'] != 'Unknown' else None,
                fasting_required=False,  # Would need clinical knowledge base
                stat_available=True,
                typical_turnaround_time="2-4 hours",
                is_active=True
            )
            session.add(catalog_test)
            lab_test_count += 1
        
        # Commit changes
        await session.commit()
        
        logger.info(f"✓ Successfully populated catalogs:")
        logger.info(f"  - {medication_count} medications")
        logger.info(f"  - {lab_test_count} lab tests")
        logger.info(f"Database catalog tables are now populated with real patient data!")


def _classify_lab_test(test_name: str) -> str:
    """
    Classify lab test into category based on test name.
    This is a simple classification - could be enhanced with medical ontologies.
    """
    test_lower = test_name.lower()
    
    # Blood chemistry tests
    if any(term in test_lower for term in ['glucose', 'creatinine', 'bun', 'sodium', 'potassium', 
                                          'chloride', 'carbon dioxide', 'albumin', 'protein']):
        return "Chemistry"
    
    # Hematology tests
    if any(term in test_lower for term in ['hemoglobin', 'hematocrit', 'platelet', 'wbc', 'rbc',
                                          'mcv', 'mch', 'mchc', 'rdw']):
        return "Hematology"
    
    # Lipid tests
    if any(term in test_lower for term in ['cholesterol', 'hdl', 'ldl', 'triglyceride']):
        return "Lipids"
    
    # Cardiac markers
    if any(term in test_lower for term in ['troponin', 'ck-mb', 'bnp', 'nt-probnp']):
        return "Cardiac Markers"
    
    # Liver function
    if any(term in test_lower for term in ['alt', 'ast', 'alkaline phosphatase', 'bilirubin']):
        return "Liver Function"
    
    # Urinalysis
    if 'urine' in test_lower or any(term in test_lower for term in ['ketones', 'leukocyte', 'nitrite']):
        return "Urinalysis"
    
    # Endocrine
    if any(term in test_lower for term in ['tsh', 'thyroid', 'insulin', 'cortisol', 'testosterone']):
        return "Endocrinology"
    
    # Coagulation
    if any(term in test_lower for term in ['pt', 'ptt', 'inr', 'fibrinogen']):
        return "Coagulation"
    
    # Default
    return "Laboratory"


async def main():
    """Main function"""
    try:
        await populate_database_catalogs()
    except Exception as e:
        logger.error(f"Error populating catalogs: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())