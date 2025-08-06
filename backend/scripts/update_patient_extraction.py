#!/usr/bin/env python3
"""
Update the Patient search parameter extraction in storage.py
"""

import os

# The comprehensive Patient extraction code
PATIENT_EXTRACTION_CODE = '''        if resource_type == 'Patient':
            # 1. _id (handled in common params above)
            
            # 2. identifier
            if 'identifier' in resource_data:
                for identifier in resource_data['identifier']:
                    if 'value' in identifier:
                        params_to_extract.append({
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
                        params_to_extract.append({
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
                            params_to_extract.append({
                                'param_name': 'name',
                                'param_type': 'string',
                                'value_string': full_name.lower()
                            })
                    
                    # Family name
                    if 'family' in name:
                        params_to_extract.append({
                            'param_name': 'family',
                            'param_type': 'string',
                            'value_string': name['family'].lower()
                        })
                    
                    # Given names
                    if 'given' in name:
                        for given in name['given']:
                            params_to_extract.append({
                                'param_name': 'given',
                                'param_type': 'string',
                                'value_string': given.lower()
                            })
                    
                    # Phonetic search (simple lowercase for now)
                    phonetic_parts = []
                    if 'given' in name:
                        phonetic_parts.extend([g.lower() for g in name['given']])
                    if 'family' in name:
                        phonetic_parts.append(name['family'].lower())
                    if phonetic_parts:
                        params_to_extract.append({
                            'param_name': 'phonetic',
                            'param_type': 'string',
                            'value_string': ' '.join(phonetic_parts)
                        })
            
            # 4. gender (token with system)
            if 'gender' in resource_data:
                params_to_extract.append({
                    'param_name': 'gender',
                    'param_type': 'token',
                    'value_token_system': 'http://hl7.org/fhir/administrative-gender',
                    'value_token_code': resource_data['gender']
                })
            
            # 5. birthdate (date)
            if 'birthDate' in resource_data:
                try:
                    birth_date = datetime.strptime(resource_data['birthDate'], '%Y-%m-%d')
                    params_to_extract.append({
                        'param_name': 'birthdate',
                        'param_type': 'date',
                        'value_date': birth_date
                    })
                except Exception as e:
                    logging.warning(f"Could not parse birthDate: {resource_data['birthDate']} - {e}")
            
            # 6. deceased (token - boolean or dateTime)
            if 'deceasedBoolean' in resource_data:
                params_to_extract.append({
                    'param_name': 'deceased',
                    'param_type': 'token',
                    'value_token_code': 'true' if resource_data['deceasedBoolean'] else 'false'
                })
            elif 'deceasedDateTime' in resource_data:
                params_to_extract.append({
                    'param_name': 'deceased',
                    'param_type': 'token',
                    'value_token_code': 'true'
                })
                try:
                    death_date = datetime.fromisoformat(resource_data['deceasedDateTime'].replace('Z', '+00:00'))
                    params_to_extract.append({
                        'param_name': 'death-date',
                        'param_type': 'date',
                        'value_date': death_date
                    })
                except Exception as e:
                    logging.warning(f"Could not parse deceasedDateTime: {resource_data['deceasedDateTime']} - {e}")
            
            # 7. address (string - any part of address)
            if 'address' in resource_data:
                for address in resource_data['address']:
                    # Full address text
                    if 'text' in address:
                        params_to_extract.append({
                            'param_name': 'address',
                            'param_type': 'string',
                            'value_string': address['text'].lower()
                        })
                    else:
                        # Build from parts
                        addr_parts = []
                        if 'line' in address and isinstance(address['line'], list):
                            addr_parts.extend(address['line'])
                        for field in ['city', 'state', 'postalCode', 'country']:
                            if field in address:
                                addr_parts.append(address[field])
                        if addr_parts:
                            params_to_extract.append({
                                'param_name': 'address',
                                'param_type': 'string',
                                'value_string': ' '.join(addr_parts).lower()
                            })
                    
                    # Specific address components
                    if 'city' in address:
                        params_to_extract.append({
                            'param_name': 'address-city',
                            'param_type': 'string',
                            'value_string': address['city'].lower()
                        })
                    
                    if 'state' in address:
                        params_to_extract.append({
                            'param_name': 'address-state',
                            'param_type': 'string',
                            'value_string': address['state'].lower()
                        })
                    
                    if 'postalCode' in address:
                        params_to_extract.append({
                            'param_name': 'address-postalcode',
                            'param_type': 'string',
                            'value_string': address['postalCode']
                        })
                    
                    if 'country' in address:
                        params_to_extract.append({
                            'param_name': 'address-country',
                            'param_type': 'string',
                            'value_string': address['country'].lower()
                        })
                    
                    # address-use
                    if 'use' in address:
                        params_to_extract.append({
                            'param_name': 'address-use',
                            'param_type': 'token',
                            'value_token_code': address['use']
                        })
            
            # 8. telecom (token)
            if 'telecom' in resource_data:
                for telecom in resource_data['telecom']:
                    if 'value' in telecom:
                        params_to_extract.append({
                            'param_name': 'telecom',
                            'param_type': 'token',
                            'value_token_system': telecom.get('system'),
                            'value_token_code': telecom['value']
                        })
                        
                        # Also index specific types
                        if telecom.get('system') == 'phone':
                            params_to_extract.append({
                                'param_name': 'phone',
                                'param_type': 'token',
                                'value_token_code': telecom['value']
                            })
                        elif telecom.get('system') == 'email':
                            params_to_extract.append({
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
                                params_to_extract.append({
                                    'param_name': 'language',
                                    'param_type': 'token',
                                    'value_token_system': coding.get('system'),
                                    'value_token_code': coding['code']
                                })
            
            # 10. active (token)
            if 'active' in resource_data:
                params_to_extract.append({
                    'param_name': 'active',
                    'param_type': 'token',
                    'value_token_code': 'true' if resource_data.get('active', True) else 'false'
                })
            
            # 11. link (reference to other patient)
            if 'link' in resource_data:
                for link in resource_data['link']:
                    if 'other' in link and 'reference' in link['other']:
                        params_to_extract.append({
                            'param_name': 'link',
                            'param_type': 'reference',
                            'value_reference': link['other']['reference']
                        })
            
            # 12. general-practitioner (reference)
            if 'generalPractitioner' in resource_data:
                for gp in resource_data['generalPractitioner']:
                    if 'reference' in gp:
                        params_to_extract.append({
                            'param_name': 'general-practitioner',
                            'param_type': 'reference',
                            'value_reference': gp['reference']
                        })
            
            # 13. organization (reference via managingOrganization)
            if 'managingOrganization' in resource_data and 'reference' in resource_data['managingOrganization']:
                params_to_extract.append({
                    'param_name': 'organization',
                    'param_type': 'reference',
                    'value_reference': resource_data['managingOrganization']['reference']
                })'''

def main():
    storage_path = '/app/fhir/core/storage.py'
    
    # Read the file
    with open(storage_path, 'r') as f:
        content = f.read()
    
    # Find the Patient extraction section
    start_marker = "        if resource_type == 'Patient':"
    end_marker = "        elif resource_type == 'Observation':"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find Patient extraction section!")
        return
    
    # Replace the Patient extraction code
    new_content = content[:start_idx] + PATIENT_EXTRACTION_CODE + "\n        \n" + content[end_idx:]
    
    # Write back
    with open(storage_path, 'w') as f:
        f.write(new_content)
    
    print("Updated Patient extraction in storage.py!")

if __name__ == "__main__":
    main()