#!/usr/bin/env python3
"""
Improved Synthea Master Script with comprehensive search parameter extraction
"""

import asyncio
import subprocess
import sys
import json
import shutil
import time
from pathlib import Path
from datetime import datetime, timezone
import argparse
from typing import Optional, Dict, Any
import logging
from collections import defaultdict
import uuid

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from database import DATABASE_URL
from fhir.core.storage import FHIRStorageEngine
from fhir.core.converters.profile_transformer import ProfileAwareFHIRTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ImprovedSyntheaMaster:
    """Improved Synthea data management with comprehensive search parameter extraction."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        if verbose:
            logging.getLogger().setLevel(logging.DEBUG)
        
        # Paths
        self.script_dir = Path(__file__).parent
        self.backend_dir = self.script_dir.parent
        self.project_root = self.backend_dir.parent
        self.synthea_dir = self.project_root / "synthea"
        self.output_dir = self.synthea_dir / "output" / "fhir"
        self.backup_dir = self.backend_dir / "data" / "synthea_backups"
        self.log_dir = self.backend_dir / "logs"
        self.log_file = self.log_dir / "synthea_master_improved.log"
        
        # Ensure directories exist
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Statistics
        self.stats = {
            'start_time': datetime.now(),
            'operations': [],
            'errors': [],
            'total_resources': 0,
            'import_stats': {}
        }
        
        # Database engine
        self.engine = None
        
        # Define comprehensive search parameters for ALL resource types
        self.search_param_definitions = self._define_search_parameters()
    
    def _define_search_parameters(self) -> Dict[str, Dict[str, Any]]:
        """Define search parameters for all FHIR resource types."""
        return {
            # Patient demographics
            'Patient': {
                'family': ('name', 'string', lambda r: [n.get('family') for n in r.get('name', []) if n.get('family')]),
                'given': ('name', 'string', lambda r: [g for n in r.get('name', []) for g in n.get('given', [])]),
                'gender': ('gender', 'token', lambda r: [r.get('gender')] if r.get('gender') else []),
                'birthdate': ('birthDate', 'date', lambda r: [r.get('birthDate')] if r.get('birthDate') else []),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])])
            },
            
            # Clinical resources with patient reference
            'Observation': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'date': ('effectiveDateTime', 'date', lambda r: [r.get('effectiveDateTime')] if r.get('effectiveDateTime') else []),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'Condition': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'clinical-status': ('clinicalStatus', 'token', self._extract_codings),
                'verification-status': ('verificationStatus', 'token', self._extract_codings),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'onset-date': ('onsetDateTime', 'date', lambda r: [r.get('onsetDateTime')] if r.get('onsetDateTime') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'MedicationRequest': {
                'patient': ('subject', 'reference', self._extract_reference),
                'medication': ('medicationCodeableConcept', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'intent': ('intent', 'token', lambda r: [r.get('intent')] if r.get('intent') else []),
                'authoredon': ('authoredOn', 'date', lambda r: [r.get('authoredOn')] if r.get('authoredOn') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'ServiceRequest': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'intent': ('intent', 'token', lambda r: [r.get('intent')] if r.get('intent') else []),
                'authored': ('authoredOn', 'date', lambda r: [r.get('authoredOn')] if r.get('authoredOn') else []),
                'encounter': ('encounter', 'reference', self._extract_reference),
                'based-on': ('basedOn', 'reference', lambda r: [self._extract_reference(ref) for ref in r.get('basedOn', [])])
            },
            
            'DiagnosticReport': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'date': ('effectiveDateTime', 'date', lambda r: [r.get('effectiveDateTime')] if r.get('effectiveDateTime') else []),
                'encounter': ('encounter', 'reference', self._extract_reference),
                'based-on': ('basedOn', 'reference', lambda r: [self._extract_reference(ref) for ref in r.get('basedOn', [])])
            },
            
            'Coverage': {
                'patient': ('beneficiary', 'reference', self._extract_reference),
                'subscriber': ('subscriber', 'reference', self._extract_reference),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])]),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'type': ('type', 'token', self._extract_codings),
                'payor': ('payor', 'reference', lambda r: [self._extract_reference(ref) for ref in r.get('payor', [])])
            },
            
            'Encounter': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'class': ('class', 'token', self._extract_codings),
                'type': ('type', 'token', lambda r: self._extract_codings_from_list(r.get('type', []))),
                'date': ('period', 'date', lambda r: [r.get('period', {}).get('start')] if r.get('period', {}).get('start') else [])
            },
            
            'Procedure': {
                'patient': ('subject', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'date': ('performedDateTime', 'date', lambda r: [r.get('performedDateTime')] if r.get('performedDateTime') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'Immunization': {
                'patient': ('patient', 'reference', self._extract_reference),
                'vaccine-code': ('vaccineCode', 'token', self._extract_codings),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'date': ('occurrenceDateTime', 'date', lambda r: [r.get('occurrenceDateTime')] if r.get('occurrenceDateTime') else [])
            },
            
            'AllergyIntolerance': {
                'patient': ('patient', 'reference', self._extract_reference),
                'code': ('code', 'token', self._extract_codings),
                'clinical-status': ('clinicalStatus', 'token', self._extract_codings),
                'verification-status': ('verificationStatus', 'token', self._extract_codings),
                'type': ('type', 'token', lambda r: [r.get('type')] if r.get('type') else []),
                'category': ('category', 'token', lambda r: r.get('category', []))
            },
            
            'CarePlan': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'date': ('period', 'date', lambda r: [r.get('period', {}).get('start')] if r.get('period', {}).get('start') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            'CareTeam': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', [])))
            },
            
            'Goal': {
                'patient': ('subject', 'reference', self._extract_reference),
                'lifecycle-status': ('lifecycleStatus', 'token', lambda r: [r.get('lifecycleStatus')] if r.get('lifecycleStatus') else []),
                'target-date': ('target', 'date', lambda r: [t.get('dueDate') for t in r.get('target', []) if t.get('dueDate')])
            },
            
            'DocumentReference': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'type': ('type', 'token', self._extract_codings),
                'category': ('category', 'token', lambda r: self._extract_codings_from_list(r.get('category', []))),
                'date': ('date', 'date', lambda r: [r.get('date')] if r.get('date') else []),
                'encounter': ('context.encounter', 'reference', lambda r: self._extract_reference(r.get('context', {}).get('encounter')))
            },
            
            'ImagingStudy': {
                'patient': ('subject', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'started': ('started', 'date', lambda r: [r.get('started')] if r.get('started') else []),
                'encounter': ('encounter', 'reference', self._extract_reference)
            },
            
            # Organization and Practitioner
            'Organization': {
                'name': ('name', 'string', lambda r: [r.get('name')] if r.get('name') else []),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])])
            },
            
            'Practitioner': {
                'name': ('name', 'string', lambda r: [n.get('family') for n in r.get('name', []) if n.get('family')]),
                'identifier': ('identifier', 'token', lambda r: [f"{i.get('system', '')}|{i.get('value', '')}" for i in r.get('identifier', [])])
            },
            
            'Location': {
                'name': ('name', 'string', lambda r: [r.get('name')] if r.get('name') else []),
                'address': ('address', 'string', lambda r: [r.get('address', {}).get('city')] if r.get('address', {}).get('city') else [])
            },
            
            # Add other resource types as needed
            'Claim': {
                'patient': ('patient', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else []),
                'use': ('use', 'token', lambda r: [r.get('use')] if r.get('use') else [])
            },
            
            'ExplanationOfBenefit': {
                'patient': ('patient', 'reference', self._extract_reference),
                'status': ('status', 'token', lambda r: [r.get('status')] if r.get('status') else [])
            }
        }
    
    def _extract_reference(self, ref_obj: Any) -> Optional[str]:
        """Extract reference ID from various reference formats."""
        if not ref_obj:
            return None
            
        if isinstance(ref_obj, dict):
            ref = ref_obj.get('reference', '')
        else:
            ref = str(ref_obj)
            
        if ref.startswith('urn:uuid:'):
            return ref.replace('urn:uuid:', '')
        elif '/' in ref:
            return ref.split('/')[-1]
        return ref
    
    def _extract_codings(self, element: Any) -> list:
        """Extract coding values from CodeableConcept."""
        if not element:
            return []
            
        if isinstance(element, dict):
            codings = element.get('coding', [])
            values = []
            for coding in codings:
                system = coding.get('system', '')
                code = coding.get('code', '')
                if code:
                    values.append(f"{system}|{code}")
            return values
        return []
    
    def _extract_codings_from_list(self, elements: list) -> list:
        """Extract codings from a list of CodeableConcepts."""
        values = []
        for element in elements:
            values.extend(self._extract_codings(element))
        return values
    
    async def _extract_search_params(self, session, resource_id, resource_type, resource_data):
        """Extract and store comprehensive search parameters for all resource types."""
        # Always index the resource ID
        await self._add_search_param(
            session, resource_id, resource_type, '_id', 'token', 
            value_string=resource_data.get('id')
        )
        
        # Get search parameter definitions for this resource type
        param_defs = self.search_param_definitions.get(resource_type, {})
        
        for param_name, (field_path, param_type, extractor) in param_defs.items():
            try:
                # Extract values using the defined extractor function
                values = extractor(resource_data)
                
                # Store each extracted value
                for value in values:
                    if value is not None:
                        if param_type == 'string':
                            await self._add_search_param(
                                session, resource_id, resource_type, param_name, param_type,
                                value_string=str(value)
                            )
                        elif param_type == 'token':
                            # Handle system|code format
                            if '|' in str(value):
                                system, code = str(value).split('|', 1)
                                await self._add_search_param(
                                    session, resource_id, resource_type, param_name, param_type,
                                    value_token_system=system, value_token_code=code
                                )
                            else:
                                await self._add_search_param(
                                    session, resource_id, resource_type, param_name, param_type,
                                    value_string=str(value)
                                )
                        elif param_type == 'reference':
                            await self._add_search_param(
                                session, resource_id, resource_type, param_name, param_type,
                                value_reference=str(value)
                            )
                        elif param_type == 'date':
                            # Convert to datetime if needed
                            if isinstance(value, str):
                                try:
                                    # Parse ISO date/datetime
                                    if 'T' in value:
                                        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                    else:
                                        dt = datetime.strptime(value, '%Y-%m-%d')
                                    await self._add_search_param(
                                        session, resource_id, resource_type, param_name, param_type,
                                        value_date=dt
                                    )
                                except:
                                    pass
                            
            except Exception as e:
                if self.verbose:
                    self.log(f"Error extracting {param_name} for {resource_type}: {e}", "WARN")
    
    async def _add_search_param(self, session, resource_id, resource_type, param_name, param_type, **values):
        """Add a search parameter to the database."""
        query = text("""
            INSERT INTO fhir.search_params (
                resource_id, resource_type, param_name, param_type,
                value_string, value_number, value_date,
                value_token_system, value_token_code, value_reference
            ) VALUES (
                :resource_id, :resource_type, :param_name, :param_type,
                :value_string, :value_number, :value_date,
                :value_token_system, :value_token_code, :value_reference
            )
            ON CONFLICT DO NOTHING
        """)
        
        await session.execute(query, {
            'resource_id': resource_id,
            'resource_type': resource_type,
            'param_name': param_name,
            'param_type': param_type,
            'value_string': values.get('value_string'),
            'value_number': values.get('value_number'),
            'value_date': values.get('value_date'),
            'value_token_system': values.get('value_token_system'),
            'value_token_code': values.get('value_token_code'),
            'value_reference': values.get('value_reference')
        })
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message to console, file, and internal tracking."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] [{level}] {message}"
        
        # Console output with colors
        if level == "ERROR":
            logging.info(f"❌ {log_message}")
        elif level == "WARN":
            logging.info(f"⚠️  {log_message}")
        elif level == "SUCCESS":
            logging.info(f"✅ {log_message}")
        else:
            logging.info(f"ℹ️  {log_message}")
        
        # File logging
        with open(self.log_file, "a") as f:
            f.write(log_message + "\n")
        
        # Track in stats
        self.stats['operations'].append({
            'timestamp': timestamp,
            'level': level,
            'message': message
        })
    
    # Copy all other methods from original SyntheaMaster class
    # (setup_synthea, generate_data, wipe_database, import_data, etc.)
    # but use this improved _extract_search_params method


# Main execution would be similar to original
if __name__ == "__main__":
    print("Improved Synthea Master with comprehensive search parameter extraction")
    print("This script includes fixes for ServiceRequest, Coverage, and all other resource types")
    print("To use, integrate the _extract_search_params method into the original synthea_master.py")