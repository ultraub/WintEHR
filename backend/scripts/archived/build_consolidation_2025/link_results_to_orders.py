#!/usr/bin/env python3
"""
Link Results to Orders Script

This script matches existing Observation resources with ServiceRequest resources
and adds basedOn references to complete the order-to-result workflow.

Matching logic:
1. Same patient
2. Same test code (LOINC)
3. Date proximity (result within reasonable timeframe of order)
4. ServiceRequest status is 'active' or 'completed'
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import asyncpg
from collections import defaultdict
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database configuration
import os

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'postgres'),  # Use 'postgres' when inside container
    'port': 5432,
    'database': 'emr_db',
    'user': 'emr_user',
    'password': 'emr_password'
}

# Matching configuration
MAX_DAYS_BETWEEN_ORDER_AND_RESULT = 7  # Maximum days between order and result
BATCH_SIZE = 100  # Process in batches to avoid memory issues


class ResultOrderLinker:
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
        self.stats = {
            'observations_processed': 0,
            'observations_linked': 0,
            'observations_already_linked': 0,
            'observations_no_match': 0,
            'service_requests_completed': 0,
            'errors': 0
        }
        
    async def run(self):
        """Main execution method"""
        logger.info("Starting Result-Order linking process...")
        
        # Get unlinked observations
        unlinked_observations = await self.get_unlinked_observations()
        logger.info(f"Found {len(unlinked_observations)} unlinked observations")
        
        # Get active service requests
        service_requests = await self.get_linkable_service_requests()
        logger.info(f"Found {len(service_requests)} linkable service requests")
        
        # Build index for efficient matching
        service_request_index = self.build_service_request_index(service_requests)
        
        # Process observations in batches
        for i in range(0, len(unlinked_observations), BATCH_SIZE):
            batch = unlinked_observations[i:i + BATCH_SIZE]
            await self.process_observation_batch(batch, service_request_index)
            logger.info(f"Processed batch {i//BATCH_SIZE + 1}/{(len(unlinked_observations) + BATCH_SIZE - 1)//BATCH_SIZE}")
        
        # Print summary
        self.print_summary()
    
    async def get_unlinked_observations(self) -> List[Dict]:
        """Get all lab observations without basedOn references"""
        query = """
        SELECT 
            id,
            fhir_id,
            resource,
            last_updated
        FROM fhir.resources
        WHERE resource_type = 'Observation'
        AND (resource->>'basedOn' IS NULL OR resource->'basedOn' = '[]'::jsonb)
        AND resource->'category' @> '[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}]'::jsonb
        ORDER BY last_updated DESC
        """
        
        rows = await self.conn.fetch(query)
        return [dict(row) for row in rows]
    
    async def get_linkable_service_requests(self) -> List[Dict]:
        """Get service requests that could be linked to results"""
        query = """
        SELECT 
            id,
            fhir_id,
            resource,
            last_updated
        FROM fhir.resources
        WHERE resource_type = 'ServiceRequest'
        AND resource->>'status' IN ('active', 'completed')
        AND (
            resource->'category' @> '[{"coding": [{"code": "laboratory"}]}]'::jsonb
            OR resource->'category' @> '[{"coding": [{"system": "http://snomed.info/sct", "code": "108252007"}]}]'::jsonb
        )
        ORDER BY last_updated DESC
        """
        
        rows = await self.conn.fetch(query)
        return [dict(row) for row in rows]
    
    def build_service_request_index(self, service_requests: List[Dict]) -> Dict:
        """Build an index for efficient matching by patient and code"""
        index = defaultdict(list)
        
        for sr in service_requests:
            resource = sr['resource']
            
            # Handle if resource is a string (JSON)
            if isinstance(resource, str):
                resource = json.loads(resource)
            
            # Extract patient reference
            patient_ref = resource.get('subject', {}).get('reference', '')
            patient_id = patient_ref.split('/')[-1] if patient_ref else None
            if not patient_id:
                continue
            
            # Extract test codes
            codes = self.extract_codes(resource.get('code', {}))
            
            # Store the parsed resource back in the sr dict
            sr['resource'] = resource
            
            # Index by patient and each code
            for code in codes:
                key = (patient_id, code)
                index[key].append(sr)
        
        return index
    
    def extract_codes(self, code_obj: Dict) -> List[str]:
        """Extract all codes from a CodeableConcept"""
        codes = []
        
        if 'coding' in code_obj:
            for coding in code_obj['coding']:
                if 'code' in coding:
                    # Include system to make code unique
                    system = coding.get('system', 'unknown')
                    codes.append(f"{system}|{coding['code']}")
        
        return codes
    
    async def process_observation_batch(self, observations: List[Dict], service_request_index: Dict):
        """Process a batch of observations"""
        updates = []
        
        for obs in observations:
            self.stats['observations_processed'] += 1
            
            # Handle if resource is a string (JSON)
            resource = obs['resource']
            if isinstance(resource, str):
                resource = json.loads(resource)
            
            # Skip if already has basedOn
            if resource.get('basedOn') and len(resource.get('basedOn', [])) > 0:
                self.stats['observations_already_linked'] += 1
                continue
            
            # Find matching service request
            match = self.find_matching_service_request(obs, service_request_index)
            
            if match:
                # Prepare update
                updates.append((obs['fhir_id'], match['fhir_id']))
                self.stats['observations_linked'] += 1
            else:
                self.stats['observations_no_match'] += 1
        
        # Execute updates
        if updates:
            await self.update_observations(updates)
    
    def find_matching_service_request(self, observation: Dict, service_request_index: Dict) -> Optional[Dict]:
        """Find a matching service request for an observation"""
        obs_resource = observation['resource']
        
        # Handle if resource is a string (JSON)
        if isinstance(obs_resource, str):
            obs_resource = json.loads(obs_resource)
        
        # Extract patient reference
        patient_ref = obs_resource.get('subject', {}).get('reference', '')
        patient_id = patient_ref.split('/')[-1] if patient_ref else None
        if not patient_id:
            return None
        
        # Extract observation codes
        obs_codes = self.extract_codes(obs_resource.get('code', {}))
        
        # Get observation date
        obs_date = self.extract_observation_date(obs_resource)
        if not obs_date:
            return None
        
        # Look for matches
        best_match = None
        best_time_diff = timedelta(days=MAX_DAYS_BETWEEN_ORDER_AND_RESULT)
        
        for code in obs_codes:
            key = (patient_id, code)
            if key in service_request_index:
                for sr in service_request_index[key]:
                    # Check date proximity
                    sr_resource = sr['resource']
                    if isinstance(sr_resource, str):
                        sr_resource = json.loads(sr_resource)
                    sr_date = self.extract_service_request_date(sr_resource)
                    if not sr_date:
                        continue
                    
                    # Result should come after order
                    if obs_date < sr_date:
                        continue
                    
                    time_diff = obs_date - sr_date
                    
                    # Check if within acceptable timeframe and better than current best
                    if time_diff <= timedelta(days=MAX_DAYS_BETWEEN_ORDER_AND_RESULT) and time_diff < best_time_diff:
                        best_match = sr
                        best_time_diff = time_diff
        
        return best_match
    
    def extract_observation_date(self, obs_resource: Dict) -> Optional[datetime]:
        """Extract date from observation"""
        date_str = obs_resource.get('effectiveDateTime') or obs_resource.get('issued')
        if date_str:
            try:
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except:
                pass
        return None
    
    def extract_service_request_date(self, sr_resource: Dict) -> Optional[datetime]:
        """Extract date from service request"""
        date_str = sr_resource.get('authoredOn') or sr_resource.get('occurrenceDateTime')
        if date_str:
            try:
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except:
                pass
        return None
    
    async def update_observations(self, updates: List[Tuple[str, str]]):
        """Update observations with basedOn references"""
        for obs_fhir_id, sr_fhir_id in updates:
            try:
                # Get current observation data
                obs_row = await self.conn.fetchrow(
                    "SELECT resource FROM fhir.resources WHERE fhir_id = $1 AND resource_type = 'Observation'",
                    obs_fhir_id
                )
                
                if not obs_row:
                    continue
                
                obs_resource = obs_row['resource']
                
                # Handle if resource is a string (JSON)
                if isinstance(obs_resource, str):
                    obs_resource = json.loads(obs_resource)
                
                # Add basedOn reference
                obs_resource['basedOn'] = [{
                    'reference': f'ServiceRequest/{sr_fhir_id}',
                    'type': 'ServiceRequest'
                }]
                
                # Update the observation
                await self.conn.execute(
                    """
                    UPDATE fhir.resources 
                    SET resource = $1, last_updated = CURRENT_TIMESTAMP
                    WHERE fhir_id = $2 AND resource_type = 'Observation'
                    """,
                    json.dumps(obs_resource),
                    obs_fhir_id
                )
                
                # Also update the service request status to completed if it's active
                sr_row = await self.conn.fetchrow(
                    "SELECT resource FROM fhir.resources WHERE fhir_id = $1 AND resource_type = 'ServiceRequest'",
                    sr_fhir_id
                )
                
                if sr_row:
                    sr_resource = sr_row['resource']
                    
                    # Handle if resource is a string (JSON)
                    if isinstance(sr_resource, str):
                        sr_resource = json.loads(sr_resource)
                    
                    if sr_resource.get('status') == 'active':
                        sr_resource['status'] = 'completed'
                        
                        await self.conn.execute(
                            """
                            UPDATE fhir.resources 
                            SET resource = $1, last_updated = CURRENT_TIMESTAMP
                            WHERE fhir_id = $2 AND resource_type = 'ServiceRequest'
                            """,
                            json.dumps(sr_resource),
                            sr_fhir_id
                        )
                        
                        self.stats['service_requests_completed'] += 1
                
            except Exception as e:
                logger.error(f"Error updating observation {obs_fhir_id}: {e}")
                self.stats['errors'] += 1
    
    def print_summary(self):
        """Print summary statistics"""
        logger.info("\n" + "="*50)
        logger.info("LINKING SUMMARY")
        logger.info("="*50)
        logger.info(f"Observations processed: {self.stats['observations_processed']}")
        logger.info(f"Observations linked: {self.stats['observations_linked']}")
        logger.info(f"Observations already linked: {self.stats['observations_already_linked']}")
        logger.info(f"Observations without match: {self.stats['observations_no_match']}")
        logger.info(f"Service requests completed: {self.stats['service_requests_completed']}")
        logger.info(f"Errors: {self.stats['errors']}")
        
        if self.stats['observations_processed'] > 0:
            link_rate = (self.stats['observations_linked'] / self.stats['observations_processed']) * 100
            logger.info(f"\nLink rate: {link_rate:.1f}%")


async def main():
    """Main entry point"""
    conn = None
    try:
        # Connect to database
        conn = await asyncpg.connect(**DB_CONFIG)
        
        # Create and run linker
        linker = ResultOrderLinker(conn)
        await linker.run()
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise
    finally:
        if conn:
            await conn.close()


if __name__ == "__main__":
    asyncio.run(main())