#!/usr/bin/env python3
"""
Fix Patient resource search parameter extraction.
This script adds comprehensive search parameter extraction for Patient resources
according to FHIR R4 specification.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from urllib.parse import unquote

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = "postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"


class PatientSearchParameterFixer:
    """Fix and enhance Patient search parameter extraction."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def extract_patient_search_params(self, resource_id: int, resource_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract comprehensive search parameters for Patient resource."""
        params = []
        
        # 1. _id (already handled in common params)
        if 'id' in resource_data:
            params.append({
                'param_name': '_id',
                'param_type': 'token',
                'value_token_code': resource_data['id']
            })
        
        # 2. identifier
        if 'identifier' in resource_data:
            for identifier in resource_data['identifier']:
                if 'value' in identifier:
                    params.append({
                        'param_name': 'identifier',
                        'param_type': 'token',
                        'value_token_system': identifier.get('system'),
                        'value_token_code': identifier['value']
                    })
        
        # 3. name (composite search)
        if 'name' in resource_data:
            for name in resource_data['name']:
                # Full name for general search
                name_parts = []
                if 'text' in name:
                    params.append({
                        'param_name': 'name',
                        'param_type': 'string',
                        'value_string': name['text'].lower()
                    })
                else:
                    # Build from parts
                    if 'given' in name:
                        name_parts.extend(name['given'])
                    if 'family' in name:
                        name_parts.append(name['family'])
                    if name_parts:
                        full_name = ' '.join(name_parts)
                        params.append({
                            'param_name': 'name',
                            'param_type': 'string',
                            'value_string': full_name.lower()
                        })
                
                # Family name
                if 'family' in name:
                    params.append({
                        'param_name': 'family',
                        'param_type': 'string',
                        'value_string': name['family'].lower()
                    })
                
                # Given names
                if 'given' in name:
                    for given in name['given']:
                        params.append({
                            'param_name': 'given',
                            'param_type': 'string',
                            'value_string': given.lower()
                        })
                
                # Phonetic search
                if 'family' in name or 'given' in name:
                    # Simple phonetic - just store lowercase for now
                    # In production, use metaphone or soundex
                    phonetic_parts = []
                    if 'given' in name:
                        phonetic_parts.extend([g.lower() for g in name['given']])
                    if 'family' in name:
                        phonetic_parts.append(name['family'].lower())
                    if phonetic_parts:
                        params.append({
                            'param_name': 'phonetic',
                            'param_type': 'string',
                            'value_string': ' '.join(phonetic_parts)
                        })
        
        # 4. gender (token)
        if 'gender' in resource_data:
            params.append({
                'param_name': 'gender',
                'param_type': 'token',
                'value_token_system': 'http://hl7.org/fhir/administrative-gender',
                'value_token_code': resource_data['gender']
            })
        
        # 5. birthdate (date)
        if 'birthDate' in resource_data:
            try:
                birth_date = datetime.strptime(resource_data['birthDate'], '%Y-%m-%d')
                params.append({
                    'param_name': 'birthdate',
                    'param_type': 'date',
                    'value_date': birth_date
                })
            except Exception as e:
                logger.warning(f"Could not parse birthDate: {resource_data['birthDate']} - {e}")
        
        # 6. deceased (token - boolean or dateTime)
        if 'deceasedBoolean' in resource_data:
            params.append({
                'param_name': 'deceased',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['deceasedBoolean'] else 'false'
            })
        elif 'deceasedDateTime' in resource_data:
            params.append({
                'param_name': 'deceased',
                'param_type': 'token',
                'value_token_code': 'true'
            })
            try:
                death_date = datetime.fromisoformat(resource_data['deceasedDateTime'].replace('Z', '+00:00'))
                params.append({
                    'param_name': 'death-date',
                    'param_type': 'date',
                    'value_date': death_date
                })
            except Exception as e:
                logger.warning(f"Could not parse deceasedDateTime: {resource_data['deceasedDateTime']} - {e}")
        
        # 7. address (string - any part of address)
        if 'address' in resource_data:
            for address in resource_data['address']:
                # Full address text
                if 'text' in address:
                    params.append({
                        'param_name': 'address',
                        'param_type': 'string',
                        'value_string': address['text'].lower()
                    })
                else:
                    # Build from parts
                    addr_parts = []
                    for field in ['line', 'city', 'state', 'postalCode', 'country']:
                        if field in address:
                            if field == 'line' and isinstance(address[field], list):
                                addr_parts.extend(address[field])
                            elif field != 'line':
                                addr_parts.append(address[field])
                    if addr_parts:
                        params.append({
                            'param_name': 'address',
                            'param_type': 'string',
                            'value_string': ' '.join(addr_parts).lower()
                        })
                
                # Specific address components
                if 'city' in address:
                    params.append({
                        'param_name': 'address-city',
                        'param_type': 'string',
                        'value_string': address['city'].lower()
                    })
                
                if 'state' in address:
                    params.append({
                        'param_name': 'address-state',
                        'param_type': 'string',
                        'value_string': address['state'].lower()
                    })
                
                if 'postalCode' in address:
                    params.append({
                        'param_name': 'address-postalcode',
                        'param_type': 'string',
                        'value_string': address['postalCode']
                    })
                
                if 'country' in address:
                    params.append({
                        'param_name': 'address-country',
                        'param_type': 'string',
                        'value_string': address['country'].lower()
                    })
                
                # address-use
                if 'use' in address:
                    params.append({
                        'param_name': 'address-use',
                        'param_type': 'token',
                        'value_token_code': address['use']
                    })
        
        # 8. telecom (token)
        if 'telecom' in resource_data:
            for telecom in resource_data['telecom']:
                if 'value' in telecom:
                    params.append({
                        'param_name': 'telecom',
                        'param_type': 'token',
                        'value_token_system': telecom.get('system'),
                        'value_token_code': telecom['value']
                    })
                    
                    # Also index specific types
                    if telecom.get('system') == 'phone':
                        params.append({
                            'param_name': 'phone',
                            'param_type': 'token',
                            'value_token_code': telecom['value']
                        })
                    elif telecom.get('system') == 'email':
                        params.append({
                            'param_name': 'email',
                            'param_type': 'token',
                            'value_token_code': telecom['value']
                        })
        
        # 9. language (token)
        if 'communication' in resource_data:
            for comm in resource_data['communication']:
                if 'language' in comm and 'coding' in comm['language']:
                    for coding in comm['language']['coding']:
                        if 'code' in coding:
                            params.append({
                                'param_name': 'language',
                                'param_type': 'token',
                                'value_token_system': coding.get('system'),
                                'value_token_code': coding['code']
                            })
        
        # 10. active (token)
        if 'active' in resource_data:
            params.append({
                'param_name': 'active',
                'param_type': 'token',
                'value_token_code': 'true' if resource_data['active'] else 'false'
            })
        
        # 11. link (reference to other patient)
        if 'link' in resource_data:
            for link in resource_data['link']:
                if 'other' in link and 'reference' in link['other']:
                    params.append({
                        'param_name': 'link',
                        'param_type': 'reference',
                        'value_reference': link['other']['reference']
                    })
        
        # 12. general-practitioner (reference)
        if 'generalPractitioner' in resource_data:
            for gp in resource_data['generalPractitioner']:
                if 'reference' in gp:
                    params.append({
                        'param_name': 'general-practitioner',
                        'param_type': 'reference',
                        'value_reference': gp['reference']
                    })
        
        # 13. organization (reference via managingOrganization)
        if 'managingOrganization' in resource_data and 'reference' in resource_data['managingOrganization']:
            params.append({
                'param_name': 'organization',
                'param_type': 'reference',
                'value_reference': resource_data['managingOrganization']['reference']
            })
        
        return params
    
    async def fix_existing_patients(self):
        """Re-index all existing Patient resources with proper search parameters."""
        # First, delete existing Patient search params
        logger.info("Deleting existing Patient search parameters...")
        await self.session.execute(
            text("DELETE FROM fhir.search_params WHERE resource_type = 'Patient'")
        )
        await self.session.commit()
        
        # Get all Patient resources
        result = await self.session.execute(
            text("SELECT id, resource FROM fhir.resources WHERE resource_type = 'Patient'")
        )
        patients = result.fetchall()
        logger.info(f"Found {len(patients)} Patient resources to re-index")
        
        # Process each patient
        for patient_id, patient_json in patients:
            try:
                patient_data = json.loads(patient_json) if isinstance(patient_json, str) else patient_json
                
                # Extract search parameters
                params = await self.extract_patient_search_params(patient_id, patient_data)
                
                # Insert search parameters
                for param in params:
                    query = text("""
                        INSERT INTO fhir.search_params (
                            resource_id, resource_type, param_name, param_type,
                            value_string, value_number, value_date, value_quantity_value,
                            value_quantity_unit,
                            value_token_system, value_token_code, value_reference
                        ) VALUES (
                            :resource_id, 'Patient', :param_name, :param_type,
                            :value_string, :value_number, :value_date, :value_quantity_value,
                            :value_quantity_unit,
                            :value_token_system, :value_token_code, :value_reference
                        )
                    """)
                    
                    await self.session.execute(query, {
                        'resource_id': patient_id,
                        'param_name': param['param_name'],
                        'param_type': param['param_type'],
                        'value_string': param.get('value_string'),
                        'value_number': param.get('value_number'),
                        'value_date': param.get('value_date'),
                        'value_quantity_value': param.get('value_quantity_value'),
                        'value_quantity_unit': param.get('value_quantity_unit'),
                        'value_token_system': param.get('value_token_system'),
                        'value_token_code': param.get('value_token_code'),
                        'value_reference': param.get('value_reference')
                    })
                
                await self.session.commit()
                logger.info(f"Indexed {len(params)} search parameters for Patient/{patient_data.get('id', patient_id)}")
                
            except Exception as e:
                logger.error(f"Error processing patient {patient_id}: {e}")
                await self.session.rollback()
    
    async def verify_fix(self):
        """Verify the fix worked."""
        # Check gender parameters
        result = await self.session.execute(
            text("""
                SELECT param_name, value_token_system, value_token_code, COUNT(*) 
                FROM fhir.search_params 
                WHERE resource_type = 'Patient' AND param_name = 'gender'
                GROUP BY param_name, value_token_system, value_token_code
            """)
        )
        gender_params = result.fetchall()
        
        logger.info("\nGender search parameters:")
        for param in gender_params:
            logger.info(f"  {param[0]}: system={param[1]}, code={param[2]}, count={param[3]}")
        
        # Check overall parameter counts
        result = await self.session.execute(
            text("""
                SELECT param_name, COUNT(*) 
                FROM fhir.search_params 
                WHERE resource_type = 'Patient' 
                GROUP BY param_name 
                ORDER BY COUNT(*) DESC
            """)
        )
        param_counts = result.fetchall()
        
        logger.info("\nPatient search parameter counts:")
        for param, count in param_counts:
            logger.info(f"  {param}: {count}")


async def main():
    """Main function."""
    # Use environment variables if in Docker
    import os
    if os.environ.get('DOCKER_ENV'):
        db_url = "postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db"
    else:
        db_url = DATABASE_URL
    
    engine = create_async_engine(db_url)
    
    async with AsyncSession(engine) as session:
        fixer = PatientSearchParameterFixer(session)
        
        logger.info("Starting Patient search parameter fix...")
        await fixer.fix_existing_patients()
        
        logger.info("\nVerifying fix...")
        await fixer.verify_fix()
    
    await engine.dispose()
    logger.info("\nPatient search parameter fix completed!")


if __name__ == "__main__":
    asyncio.run(main())