#!/usr/bin/env python3
"""
Generate ServiceRequest resources from existing Observations and Procedures

This script creates realistic ServiceRequest resources to populate the Orders module.
It generates orders that would have preceded existing lab results and procedures,
creating a complete clinical workflow.

Strategy:
1. For each lab Observation, create a corresponding lab ServiceRequest
2. For each Procedure, create a corresponding procedure ServiceRequest
3. Set appropriate dates (1-3 days before the result/procedure)
4. Link via basedOn references
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import asyncpg
import logging
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database configuration
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, '/app')

from database import DATABASE_URL
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from fhir.core.storage import FHIRStorageEngine

# Common lab test orderable codes mapping
LAB_ORDER_MAPPING = {
    # CBC
    "58410-2": {"display": "CBC with Differential", "category": "hematology"},
    "26464-8": {"display": "WBC Count", "category": "hematology"},
    "26515-7": {"display": "Platelet Count", "category": "hematology"},
    "718-7": {"display": "Hemoglobin", "category": "hematology"},
    "20570-8": {"display": "Hematocrit", "category": "hematology"},
    
    # Chemistry
    "24323-8": {"display": "Comprehensive Metabolic Panel", "category": "chemistry"},
    "2345-7": {"display": "Glucose", "category": "chemistry"},
    "2160-0": {"display": "Creatinine", "category": "chemistry"},
    "3094-0": {"display": "BUN", "category": "chemistry"},
    "2951-2": {"display": "Sodium", "category": "chemistry"},
    "2823-3": {"display": "Potassium", "category": "chemistry"},
    "2075-0": {"display": "Chloride", "category": "chemistry"},
    "2028-9": {"display": "CO2", "category": "chemistry"},
    
    # Cardiac
    "10839-9": {"display": "Troponin I", "category": "cardiac"},
    "2157-6": {"display": "CK-MB", "category": "cardiac"},
    "33762-6": {"display": "NT-proBNP", "category": "cardiac"},
    
    # Lipids
    "57698-3": {"display": "Lipid Panel", "category": "chemistry"},
    "2093-3": {"display": "Total Cholesterol", "category": "chemistry"},
    "2571-8": {"display": "Triglycerides", "category": "chemistry"},
    "2085-9": {"display": "HDL Cholesterol", "category": "chemistry"},
    "13457-7": {"display": "LDL Cholesterol", "category": "chemistry"},
    
    # Coagulation
    "5902-2": {"display": "PT", "category": "coagulation"},
    "3173-2": {"display": "aPTT", "category": "coagulation"},
    "5794-3": {"display": "INR", "category": "coagulation"},
    
    # Urinalysis
    "5778-6": {"display": "Urinalysis", "category": "urinalysis"},
    "5770-3": {"display": "Urine Culture", "category": "microbiology"},
    
    # Blood gases
    "24336-0": {"display": "Arterial Blood Gas", "category": "blood-gas"},
    "2703-7": {"display": "pH Arterial", "category": "blood-gas"},
    "2019-8": {"display": "pCO2 Arterial", "category": "blood-gas"},
    "2708-6": {"display": "pO2 Arterial", "category": "blood-gas"},
}

# Procedure to ServiceRequest mapping
PROCEDURE_ORDER_MAPPING = {
    # Imaging
    "169069000": {"display": "CT Chest with Contrast", "category": "imaging"},
    "399208008": {"display": "Chest X-ray", "category": "imaging"},
    "45036003": {"display": "CT Abdomen/Pelvis", "category": "imaging"},
    "241615005": {"display": "MRI Brain", "category": "imaging"},
    "16310003": {"display": "Ultrasound Abdomen", "category": "imaging"},
    
    # Cardiac procedures
    "18286008": {"display": "Cardiac Catheterization", "category": "cardiology"},
    "252416005": {"display": "Echocardiogram", "category": "cardiology"},
    "164847006": {"display": "EKG", "category": "cardiology"},
    "251013000": {"display": "Stress Test", "category": "cardiology"},
    
    # Surgical procedures
    "387713003": {"display": "Surgical Procedure", "category": "surgery"},
    "73761001": {"display": "Colonoscopy", "category": "gastroenterology"},
    "44441009": {"display": "Upper Endoscopy", "category": "gastroenterology"},
}


class ServiceRequestGenerator:
    def __init__(self):
        self.engine = None
        self.stats = {
            'observations_processed': 0,
            'procedures_processed': 0,
            'service_requests_created': 0,
            'basedOn_links_created': 0,
            'errors': 0
        }
    
    async def run(self):
        """Main execution method"""
        logger.info("Starting ServiceRequest generation...")
        
        self.engine = create_async_engine(DATABASE_URL, echo=False)
        
        async with AsyncSession(self.engine) as session:
            storage = FHIRStorageEngine(session)
            
            # Process lab observations
            await self.process_lab_observations(session, storage)
            
            # Process procedures
            await self.process_procedures(session, storage)
            
            await session.commit()
        
        await self.engine.dispose()
        self.print_summary()
    
    async def process_lab_observations(self, session: AsyncSession, storage: FHIRStorageEngine):
        """Create ServiceRequests for lab observations"""
        logger.info("Processing lab observations...")
        
        # Get all lab observations
        result = await session.execute(text("""
            SELECT id, fhir_id, resource, last_updated
            FROM fhir.resources
            WHERE resource_type = 'Observation'
            AND resource->'category' @> '[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}]'::jsonb
            AND (resource->>'basedOn' IS NULL OR resource->'basedOn' = '[]'::jsonb)
            ORDER BY last_updated DESC
        """))
        
        observations = result.fetchall()
        logger.info(f"Found {len(observations)} lab observations to process")
        
        for obs in observations:
            try:
                # Convert resource from JSON string to dict if needed
                resource = obs.resource
                if isinstance(resource, str):
                    resource = json.loads(resource)
                
                await self.create_service_request_for_observation(
                    session, storage, resource, obs.fhir_id
                )
                self.stats['observations_processed'] += 1
            except Exception as e:
                logger.error(f"Error processing observation {obs.fhir_id}: {e}")
                self.stats['errors'] += 1
    
    async def process_procedures(self, session: AsyncSession, storage: FHIRStorageEngine):
        """Create ServiceRequests for procedures"""
        logger.info("Processing procedures...")
        
        # Get all procedures without basedOn
        result = await session.execute(text("""
            SELECT id, fhir_id, resource, last_updated
            FROM fhir.resources
            WHERE resource_type = 'Procedure'
            AND (resource->>'basedOn' IS NULL OR resource->'basedOn' = '[]'::jsonb)
            ORDER BY last_updated DESC
        """))
        
        procedures = result.fetchall()
        logger.info(f"Found {len(procedures)} procedures to process")
        
        for proc in procedures:
            try:
                # Convert resource from JSON string to dict if needed
                resource = proc.resource
                if isinstance(resource, str):
                    resource = json.loads(resource)
                
                await self.create_service_request_for_procedure(
                    session, storage, resource, proc.fhir_id
                )
                self.stats['procedures_processed'] += 1
            except Exception as e:
                logger.error(f"Error processing procedure {proc.fhir_id}: {e}")
                self.stats['errors'] += 1
    
    async def create_service_request_for_observation(
        self, session: AsyncSession, storage: FHIRStorageEngine, 
        observation: dict, obs_id: str
    ):
        """Create a ServiceRequest for a lab observation"""
        # Extract key information
        patient_ref = observation.get('subject', {}).get('reference')
        if not patient_ref:
            return
        
        # Get observation code
        obs_code = observation.get('code', {})
        loinc_code = None
        for coding in obs_code.get('coding', []):
            if coding.get('system') == 'http://loinc.org':
                loinc_code = coding.get('code')
                break
        
        if not loinc_code:
            return
        
        # Get observation date and calculate order date (1-3 days before)
        obs_date_str = observation.get('effectiveDateTime', observation.get('issued'))
        if not obs_date_str:
            return
        
        try:
            obs_date = datetime.fromisoformat(obs_date_str.replace('Z', '+00:00'))
            order_date = obs_date - timedelta(days=1, hours=4)  # Ordered ~28 hours before
        except:
            return
        
        # Get encounter reference
        encounter_ref = observation.get('encounter', {}).get('reference') if observation.get('encounter') else None
        
        # Get order details from mapping
        order_info = LAB_ORDER_MAPPING.get(loinc_code, {
            "display": obs_code.get('text', 'Laboratory Test'),
            "category": "laboratory"
        })
        
        # Create ServiceRequest
        service_request_id = str(uuid.uuid4())
        service_request = {
            "resourceType": "ServiceRequest",
            "id": service_request_id,
            "status": "completed",
            "intent": "order",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "108252007",
                    "display": "Laboratory procedure"
                }]
            }],
            "priority": "routine",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": loinc_code,
                    "display": order_info.get('display', obs_code.get('text', ''))
                }],
                "text": order_info.get('display', obs_code.get('text', ''))
            },
            "subject": {"reference": patient_ref},
            "authoredOn": order_date.isoformat(),
            "requester": {
                "reference": "Practitioner/synthea-provider-1",
                "display": "Dr. Clinical"
            },
            "performer": [{
                "reference": "Organization/synthea-hospital-1",
                "display": "General Hospital Lab"
            }],
            "note": [{
                "text": f"Auto-generated order for completed lab test"
            }]
        }
        
        # Add encounter if available
        if encounter_ref:
            service_request["encounter"] = {"reference": encounter_ref}
        
        # Store the ServiceRequest
        await storage.create_resource("ServiceRequest", service_request)
        self.stats['service_requests_created'] += 1
        
        # Update the observation with basedOn reference
        observation['basedOn'] = [{
            "reference": f"ServiceRequest/{service_request_id}",
            "display": order_info.get('display', 'Lab Order')
        }]
        
        # Update the observation
        await session.execute(text("""
            UPDATE fhir.resources
            SET resource = :resource,
                last_updated = :last_updated
            WHERE fhir_id = :fhir_id AND resource_type = 'Observation'
        """), {
            "resource": json.dumps(observation),
            "last_updated": datetime.utcnow(),
            "fhir_id": obs_id
        })
        
        self.stats['basedOn_links_created'] += 1
    
    async def create_service_request_for_procedure(
        self, session: AsyncSession, storage: FHIRStorageEngine,
        procedure: dict, proc_id: str
    ):
        """Create a ServiceRequest for a procedure"""
        # Extract key information
        patient_ref = procedure.get('subject', {}).get('reference')
        if not patient_ref:
            return
        
        # Get procedure code
        proc_code = procedure.get('code', {})
        snomed_code = None
        for coding in proc_code.get('coding', []):
            if coding.get('system') == 'http://snomed.info/sct':
                snomed_code = coding.get('code')
                break
        
        # Get procedure date and calculate order date
        proc_date_str = procedure.get('performedDateTime', procedure.get('performedPeriod', {}).get('start'))
        if not proc_date_str:
            return
        
        try:
            proc_date = datetime.fromisoformat(proc_date_str.replace('Z', '+00:00'))
            order_date = proc_date - timedelta(days=2)  # Ordered 2 days before
        except:
            return
        
        # Get encounter reference
        encounter_ref = procedure.get('encounter', {}).get('reference') if procedure.get('encounter') else None
        
        # Get order details
        order_info = PROCEDURE_ORDER_MAPPING.get(snomed_code, {
            "display": proc_code.get('text', 'Procedure'),
            "category": "procedure"
        })
        
        # Determine appropriate category based on procedure type
        category_code = "387713003"  # Default: Surgical procedure
        category_display = "Surgical procedure"
        
        if "imaging" in order_info.get('category', '').lower():
            category_code = "363679005"
            category_display = "Imaging"
        elif "cardio" in order_info.get('category', '').lower():
            category_code = "182836005"
            category_display = "Cardiovascular procedure"
        
        # Create ServiceRequest
        service_request_id = str(uuid.uuid4())
        service_request = {
            "resourceType": "ServiceRequest",
            "id": service_request_id,
            "status": "completed",
            "intent": "order",
            "category": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": category_code,
                    "display": category_display
                }]
            }],
            "priority": "routine" if "routine" in procedure.get('category', {}).get('text', '').lower() else "urgent",
            "code": proc_code,
            "subject": {"reference": patient_ref},
            "authoredOn": order_date.isoformat(),
            "requester": {
                "reference": "Practitioner/synthea-provider-2",
                "display": "Dr. Surgeon"
            },
            "performer": [{
                "reference": "Organization/synthea-hospital-1",
                "display": "General Hospital"
            }],
            "note": [{
                "text": f"Auto-generated order for completed procedure"
            }]
        }
        
        # Add encounter if available
        if encounter_ref:
            service_request["encounter"] = {"reference": encounter_ref}
        
        # Store the ServiceRequest
        await storage.create_resource("ServiceRequest", service_request)
        self.stats['service_requests_created'] += 1
        
        # Update the procedure with basedOn reference
        procedure['basedOn'] = [{
            "reference": f"ServiceRequest/{service_request_id}",
            "display": order_info.get('display', 'Procedure Order')
        }]
        
        # Update the procedure
        await session.execute(text("""
            UPDATE fhir.resources
            SET resource = :resource,
                last_updated = :last_updated
            WHERE fhir_id = :fhir_id AND resource_type = 'Procedure'
        """), {
            "resource": json.dumps(procedure),
            "last_updated": datetime.utcnow(),
            "fhir_id": proc_id
        })
        
        self.stats['basedOn_links_created'] += 1
    
    def print_summary(self):
        """Print execution summary"""
        logger.info("\n" + "="*60)
        logger.info("ServiceRequest Generation Summary")
        logger.info("="*60)
        logger.info(f"Observations processed: {self.stats['observations_processed']}")
        logger.info(f"Procedures processed: {self.stats['procedures_processed']}")
        logger.info(f"ServiceRequests created: {self.stats['service_requests_created']}")
        logger.info(f"BasedOn links created: {self.stats['basedOn_links_created']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info("="*60)
        
        if self.stats['service_requests_created'] > 0:
            logger.info("\n✅ ServiceRequests successfully generated!")
            logger.info("The Orders module should now display these orders.")
        else:
            logger.warning("\n⚠️ No ServiceRequests were created. Check the logs for errors.")


async def main():
    """Main entry point"""
    generator = ServiceRequestGenerator()
    await generator.run()


if __name__ == "__main__":
    asyncio.run(main())