#!/usr/bin/env python3
"""
Enhanced Lab Results Script

Adds reference ranges and interpretation codes to lab Observation resources
if they don't already have them from Synthea.

This script:
1. Queries all Observation resources with lab LOINC codes
2. Checks if referenceRange already exists
3. If not, adds appropriate reference ranges based on LOINC code
4. Adds interpretation codes (High/Low/Normal) based on value comparison
5. Updates the resources in the database

Usage:
    python scripts/enhance_lab_results.py
    python scripts/enhance_lab_results.py --dry-run
    python scripts/enhance_lab_results.py --patient-id <id>
"""

import asyncio
import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import logging
from datetime import datetime, timezone

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database import DATABASE_URL

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Reference ranges for common lab tests (LOINC code -> reference range)
REFERENCE_RANGES = {
    # Complete Blood Count
    '6690-2': {'low': 4.5, 'high': 11.0, 'unit': '10*3/uL', 'display': 'Leukocytes'},
    '789-8': {'low': 4.5, 'high': 5.5, 'unit': '10*6/uL', 'display': 'Erythrocytes'},
    '718-7': {'low': 12.0, 'high': 17.5, 'unit': 'g/dL', 'display': 'Hemoglobin'},
    '4544-3': {'low': 36.0, 'high': 50.0, 'unit': '%', 'display': 'Hematocrit'},
    '787-2': {'low': 80.0, 'high': 100.0, 'unit': 'fL', 'display': 'Mean Corpuscular Volume'},
    '777-3': {'low': 150, 'high': 450, 'unit': '10*3/uL', 'display': 'Platelets'},
    
    # Basic Metabolic Panel
    '2339-0': {'low': 136, 'high': 145, 'unit': 'mmol/L', 'display': 'Sodium'},
    '2823-3': {'low': 3.5, 'high': 5.1, 'unit': 'mmol/L', 'display': 'Potassium'},
    '2069-3': {'low': 98, 'high': 107, 'unit': 'mmol/L', 'display': 'Chloride'},
    '20565-8': {'low': 22, 'high': 29, 'unit': 'mmol/L', 'display': 'Carbon Dioxide'},
    '49765-1': {'low': 8.4, 'high': 10.2, 'unit': 'mg/dL', 'display': 'Calcium'},
    '2345-7': {'low': 70, 'high': 100, 'unit': 'mg/dL', 'display': 'Glucose'},
    '3094-0': {'low': 7, 'high': 20, 'unit': 'mg/dL', 'display': 'Urea Nitrogen'},
    '2160-0': {'low': 0.6, 'high': 1.2, 'unit': 'mg/dL', 'display': 'Creatinine'},
    
    # Lipid Panel
    '2093-3': {'low': 0, 'high': 200, 'unit': 'mg/dL', 'display': 'Total Cholesterol'},
    '2571-8': {'low': 0, 'high': 150, 'unit': 'mg/dL', 'display': 'Triglycerides'},
    '2085-9': {'low': 40, 'high': 1000, 'unit': 'mg/dL', 'display': 'HDL Cholesterol'},
    '13457-7': {'low': 0, 'high': 100, 'unit': 'mg/dL', 'display': 'LDL Cholesterol (Calculated)'},
    '18262-6': {'low': 0, 'high': 100, 'unit': 'mg/dL', 'display': 'LDL Cholesterol (Direct)'},
    
    # Liver Function
    '1742-6': {'low': 6.0, 'high': 8.3, 'unit': 'g/dL', 'display': 'Alanine Aminotransferase'},
    '1920-8': {'low': 10, 'high': 40, 'unit': 'U/L', 'display': 'Aspartate Aminotransferase'},
    '6768-6': {'low': 44, 'high': 147, 'unit': 'U/L', 'display': 'Alkaline Phosphatase'},
    '1975-2': {'low': 0.1, 'high': 1.2, 'unit': 'mg/dL', 'display': 'Total Bilirubin'},
    
    # Thyroid Function
    '3016-3': {'low': 0.45, 'high': 4.5, 'unit': 'mIU/L', 'display': 'TSH'},
    '3053-6': {'low': 0.8, 'high': 1.8, 'unit': 'ng/dL', 'display': 'Free T4'},
    
    # Hemoglobin A1c
    '4548-4': {'low': 0, 'high': 5.7, 'unit': '%', 'display': 'Hemoglobin A1c'},
    
    # Urinalysis
    '5811-5': {'low': 1.003, 'high': 1.030, 'unit': '{ratio}', 'display': 'Specific Gravity'},
    '5803-2': {'low': 4.6, 'high': 8.0, 'unit': 'pH', 'display': 'pH'},
    '5792-7': {'text': 'negative', 'display': 'Glucose [Presence]'},
    '5797-6': {'text': 'negative', 'display': 'Ketones [Presence]'},
    '5799-2': {'text': 'negative', 'display': 'Leukocyte Esterase'},
    
    # Coagulation
    '5902-2': {'low': 11.0, 'high': 13.5, 'unit': 's', 'display': 'Prothrombin Time'},
    '5964-2': {'low': 0.8, 'high': 1.2, 'unit': '{INR}', 'display': 'INR'},
    '3173-2': {'low': 25.0, 'high': 35.0, 'unit': 's', 'display': 'aPTT'},
    
    # Other Common Tests
    '2028-9': {'low': 22, 'high': 28, 'unit': 'mmol/L', 'display': 'CO2'},
    '17861-6': {'low': 8.4, 'high': 10.2, 'unit': 'mg/dL', 'display': 'Calcium'},
}


class LabResultsEnhancer:
    """Enhances lab Observation resources with reference ranges and interpretations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stats = {
            'observations_processed': 0,
            'observations_updated': 0,
            'already_has_range': 0,
            'no_range_available': 0,
            'errors': []
        }
    
    def get_interpretation(self, value: float, low: float, high: float) -> Dict[str, Any]:
        """Generate interpretation code based on value comparison to reference range."""
        if value < low:
            return {
                'coding': [{
                    'system': 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                    'code': 'L',
                    'display': 'Low'
                }],
                'text': 'Low'
            }
        elif value > high:
            return {
                'coding': [{
                    'system': 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                    'code': 'H',
                    'display': 'High'
                }],
                'text': 'High'
            }
        else:
            return {
                'coding': [{
                    'system': 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                    'code': 'N',
                    'display': 'Normal'
                }],
                'text': 'Normal'
            }
    
    def extract_numeric_value(self, observation: Dict) -> Optional[float]:
        """Extract numeric value from Observation resource."""
        if 'valueQuantity' in observation:
            value = observation['valueQuantity'].get('value')
            if value is not None:
                try:
                    return float(value)
                except (ValueError, TypeError):
                    pass
        return None
    
    def get_loinc_code(self, observation: Dict) -> Optional[str]:
        """Extract LOINC code from Observation resource."""
        if 'code' in observation and 'coding' in observation['code']:
            for coding in observation['code']['coding']:
                if coding.get('system') == 'http://loinc.org':
                    return coding.get('code')
        return None
    
    async def enhance_observation(self, fhir_id: str, resource_data: Dict, version_id: int, dry_run: bool) -> bool:
        """Enhance a single Observation with reference range and interpretation."""
        try:
            # Check if it already has a reference range
            if 'referenceRange' in resource_data and resource_data['referenceRange']:
                self.stats['already_has_range'] += 1
                return False
            
            # Get LOINC code
            loinc_code = self.get_loinc_code(resource_data)
            if not loinc_code or loinc_code not in REFERENCE_RANGES:
                self.stats['no_range_available'] += 1
                return False
            
            # Get reference range
            ref_range = REFERENCE_RANGES[loinc_code]
            
            # Build reference range structure
            if 'low' in ref_range and 'high' in ref_range:
                # Numeric range
                reference_range = [{
                    'low': {
                        'value': ref_range['low'],
                        'unit': ref_range.get('unit', ''),
                        'system': 'http://unitsofmeasure.org',
                        'code': ref_range.get('unit', '')
                    },
                    'high': {
                        'value': ref_range['high'],
                        'unit': ref_range.get('unit', ''),
                        'system': 'http://unitsofmeasure.org',
                        'code': ref_range.get('unit', '')
                    }
                }]
                
                # Add interpretation if we have a numeric value
                value = self.extract_numeric_value(resource_data)
                if value is not None:
                    interpretation = self.get_interpretation(value, ref_range['low'], ref_range['high'])
                    resource_data['interpretation'] = [interpretation]
            
            elif 'text' in ref_range:
                # Text-based range (e.g., "negative")
                reference_range = [{
                    'text': ref_range['text']
                }]
            else:
                return False
            
            # Add reference range
            resource_data['referenceRange'] = reference_range
            
            # Update meta.lastUpdated
            if 'meta' not in resource_data:
                resource_data['meta'] = {}
            resource_data['meta']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
            
            # Increment version
            if 'versionId' in resource_data['meta']:
                try:
                    current_version = int(resource_data['meta']['versionId'])
                    resource_data['meta']['versionId'] = str(current_version + 1)
                except ValueError:
                    resource_data['meta']['versionId'] = "2"
            else:
                resource_data['meta']['versionId'] = "2"
            
            if not dry_run:
                # Update the resource
                new_version = version_id + 1
                await self.session.execute(
                    text("""
                        UPDATE fhir.resources 
                        SET resource = :resource,
                            version_id = :version_id,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE fhir_id = :fhir_id 
                        AND resource_type = 'Observation'
                    """),
                    {
                        "resource": json.dumps(resource_data),
                        "version_id": new_version,
                        "fhir_id": fhir_id
                    }
                )
                
                logger.info(f"Enhanced Observation {fhir_id} with {ref_range['display']} reference range")
            else:
                logger.info(f"[DRY RUN] Would enhance Observation {fhir_id} with {ref_range['display']} reference range")
            
            self.stats['observations_updated'] += 1
            return True
            
        except Exception as e:
            error_msg = f"Error enhancing observation {fhir_id}: {str(e)}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
            return False
    
    async def enhance_all_observations(self, patient_id: Optional[str] = None, dry_run: bool = False):
        """Enhance all lab Observation resources."""
        logger.info("Starting lab results enhancement...")
        
        # Build query
        query = """
            SELECT fhir_id, resource, version_id 
            FROM fhir.resources 
            WHERE resource_type = 'Observation' 
            AND deleted = false
            AND resource->'category' @> '[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}]'
        """
        
        params = {}
        if patient_id:
            query += " AND resource->'subject'->>'reference' LIKE :patient_ref"
            params['patient_ref'] = f'%{patient_id}'
        
        result = await self.session.execute(text(query), params)
        observations = result.fetchall()
        
        logger.info(f"Found {len(observations)} laboratory observations to process")
        
        for fhir_id, resource_data, version_id in observations:
            self.stats['observations_processed'] += 1
            await self.enhance_observation(fhir_id, resource_data, version_id, dry_run)
        
        if not dry_run:
            await self.session.commit()
    
    def print_summary(self):
        """Print enhancement summary."""
        print("\n" + "=" * 50)
        print("LAB RESULTS ENHANCEMENT SUMMARY")
        print("=" * 50)
        print(f"Observations processed: {self.stats['observations_processed']}")
        print(f"Observations updated: {self.stats['observations_updated']}")
        print(f"Already had reference range: {self.stats['already_has_range']}")
        print(f"No reference range available: {self.stats['no_range_available']}")
        
        if self.stats['errors']:
            print(f"\nErrors encountered: {len(self.stats['errors'])}")
            for error in self.stats['errors'][:5]:  # Show first 5 errors
                print(f"  - {error}")
            if len(self.stats['errors']) > 5:
                print(f"  ... and {len(self.stats['errors']) - 5} more errors")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Enhance lab results with reference ranges')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without updating database')
    parser.add_argument('--patient-id', help='Process only observations for specific patient')
    args = parser.parse_args()
    
    # Create async engine
    engine = create_async_engine(DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        enhancer = LabResultsEnhancer(session)
        await enhancer.enhance_all_observations(
            patient_id=args.patient_id,
            dry_run=args.dry_run
        )
        enhancer.print_summary()
        
        if args.dry_run:
            print("\nThis was a DRY RUN. No changes were made.")
            print("Run without --dry-run to apply changes.")


if __name__ == "__main__":
    asyncio.run(main())