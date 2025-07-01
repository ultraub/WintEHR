#!/usr/bin/env python3
"""
Optimized Synthea FHIR Bundle Import Script with DICOM Generation
Memory-efficient import with streaming, batching, name cleaning, and automatic DICOM generation
"""

import json
import os
import sys
import gc
import logging
import base64
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional, Generator
from contextlib import contextmanager
import random
import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from database.database import SessionLocal, engine, Base
from models.models import (
    Patient, Provider, Organization, Location, Encounter, Condition, 
    Medication, Observation, Procedure, Immunization, Allergy,
    CarePlan, Payer, Claim, Device, DiagnosticReport, ImagingStudy
)
from models.dicom_models import DICOMStudy, DICOMSeries, DICOMInstance

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import DICOM generation utilities from generate_dicom_for_synthea
from generate_dicom_for_synthea import (
    MODALITY_CONFIG, 
    generate_dicom_pixel_data,
    create_dicom_file,
    process_imaging_study
)

class OptimizedSyntheaImporterWithDICOM:
    """Memory-optimized Synthea importer with streaming, batching, and DICOM generation"""
    
    def __init__(self, batch_size: int = 50, generate_dicom: bool = True):
        self.batch_size = batch_size
        self.generate_dicom = generate_dicom
        self.resource_map = {}  # Maps reference to database ID
        self.resource_objects = {}  # Maps reference to object (for current session only)
        self.stats = {
            'patients': 0, 'providers': 0, 'organizations': 0, 'encounters': 0, 
            'conditions': 0, 'medications': 0, 'observations': 0, 'procedures': 0, 
            'immunizations': 0, 'documents': 0, 'imaging_studies': 0, 'dicom_studies': 0,
            'errors': 0, 'batches_processed': 0
        }
        
        # Setup DICOM upload directory
        self.dicom_upload_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'data', 
            'dicom_uploads'
        )
        os.makedirs(self.dicom_upload_dir, exist_ok=True)
        
        # Name cleaning data
        self.realistic_first_names = [
            'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
            'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
            'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Helen', 'Daniel', 'Nancy',
            'Matthew', 'Betty', 'Anthony', 'Ruth', 'Mark', 'Sharon', 'Donald', 'Michelle',
            'Steven', 'Laura', 'Paul', 'Emily', 'Andrew', 'Kimberly', 'Joshua', 'Deborah',
            'Kenneth', 'Dorothy', 'Kevin', 'Lisa', 'Brian', 'Nancy', 'George', 'Karen'
        ]
        
        self.realistic_last_names = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
            'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
            'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
            'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
        ]
    
    @contextmanager
    def get_session(self):
        """Context manager for database sessions with proper cleanup"""
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
    
    def clean_names(self, first_name: str, last_name: str) -> tuple[str, str]:
        """Clean names to be more realistic (for patients and providers)"""
        # Replace obviously synthetic names with realistic ones
        cleaned_first = first_name
        cleaned_last = last_name
        
        # Replace generic/synthetic patterns
        if first_name.lower().startswith('patient') or len(first_name) < 2:
            cleaned_first = random.choice(self.realistic_first_names)
        
        if last_name.lower().startswith('patient') or len(last_name) < 2:
            cleaned_last = random.choice(self.realistic_last_names)
            
        # Handle weird Synthea patterns with numbers
        if any(char.isdigit() for char in first_name):
            cleaned_first = random.choice(self.realistic_first_names)
            
        if any(char.isdigit() for char in last_name):
            cleaned_last = random.choice(self.realistic_last_names)
            
        return cleaned_first, cleaned_last
    
    def clean_patient_name(self, first_name: str, last_name: str) -> tuple[str, str]:
        """Clean patient names to be more realistic (legacy method)"""
        return self.clean_names(first_name, last_name)
    
    def resolve_reference(self, session: Session, reference: str, model_class):
        """Resolve a reference to an object in the current session"""
        if not reference:
            return None
            
        # Check if we have this reference mapped to an ID
        resource_id = self.resource_map.get(reference)
        if not resource_id:
            return None
            
        # Query the object from the current session
        return session.query(model_class).filter(model_class.id == resource_id).first()
    
    def stream_bundle_files(self, directory: Path) -> Generator[Dict[str, Any], None, None]:
        """Stream FHIR bundle files one at a time to avoid memory issues"""
        json_files = list(directory.glob("*.json"))
        logger.info(f"Found {len(json_files)} JSON files to process")
        
        for file_path in json_files:
            try:
                with open(file_path, 'r') as f:
                    bundle = json.load(f)
                    
                if bundle.get('resourceType') == 'Bundle':
                    yield bundle
                    
                # Force garbage collection after each file
                gc.collect()
                
            except Exception as e:
                logger.error(f"Error reading {file_path}: {e}")
                self.stats['errors'] += 1
    
    def process_in_batches(self, resources: List[Dict], resource_type: str) -> None:
        """Process resources in memory-efficient batches"""
        batch = []
        
        for resource in resources:
            batch.append(resource)
            
            if len(batch) >= self.batch_size:
                with self.get_session() as session:
                    self._process_batch(session, batch, resource_type)
                batch = []
                self.stats['batches_processed'] += 1
                
                # Force garbage collection after each batch
                gc.collect()
        
        # Process remaining items
        if batch:
            with self.get_session() as session:
                self._process_batch(session, batch, resource_type)
            self.stats['batches_processed'] += 1
    
    def _process_batch(self, session: Session, batch: List[Dict], resource_type: str) -> None:
        """Process a batch of resources"""
        try:
            if resource_type == 'Organization':
                self._import_organization_batch(session, batch)
            elif resource_type == 'Practitioner':
                self._import_practitioner_batch(session, batch)
            elif resource_type == 'Patient':
                self._import_patient_batch(session, batch)
            elif resource_type == 'Encounter':
                self._import_encounter_batch(session, batch)
            elif resource_type == 'Condition':
                self._import_condition_batch(session, batch)
            elif resource_type == 'Medication':
                self._import_medication_batch(session, batch)
            elif resource_type == 'Observation':
                self._import_observation_batch(session, batch)
            elif resource_type == 'DocumentReference':
                self._import_document_batch(session, batch)
            elif resource_type == 'ImagingStudy':
                self._import_imaging_study_batch(session, batch)
            
            logger.info(f"Processed batch of {len(batch)} {resource_type} resources")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error processing {resource_type} batch: {e}")
            self.stats['errors'] += 1
    
    def _import_organization_batch(self, session: Session, organizations: List[Dict]) -> None:
        """Import a batch of organizations"""
        from models.models import Organization
        
        for resource in organizations:
            try:
                org_id = resource.get('id')
                
                # Check if organization already exists
                existing_org = session.query(Organization).filter(Organization.synthea_id == org_id).first()
                if existing_org:
                    # Store mapping for existing organization
                    self.resource_map[f"Organization/{org_id}"] = existing_org.id
                    self.resource_map[f"urn:uuid:{org_id}"] = existing_org.id
                    continue
                
                # Extract name and type
                name = resource.get('name', 'Unknown Organization')
                org_type = 'Hospital'  # Default type
                
                if resource.get('type'):
                    for type_coding in resource.get('type', []):
                        for coding in type_coding.get('coding', []):
                            if coding.get('display'):
                                org_type = coding['display']
                                break
                
                # Extract address
                address_data = resource.get('address', [{}])[0]
                
                organization = Organization(
                    synthea_id=org_id,
                    name=name,
                    type=org_type,
                    address=address_data.get('line', [''])[0] if address_data.get('line') else '',
                    city=address_data.get('city', ''),
                    state=address_data.get('state', ''),
                    zip_code=address_data.get('postalCode', ''),
                    phone='(555) 000-0000',  # Default phone
                    active=True
                )
                
                session.add(organization)
                session.flush()  # Ensure organization gets an ID
                # Store both possible reference formats (map to database ID)
                self.resource_map[f"Organization/{org_id}"] = organization.id
                self.resource_map[f"urn:uuid:{org_id}"] = organization.id
                self.stats.setdefault('organizations', 0)
                self.stats['organizations'] += 1
                
            except Exception as e:
                logger.error(f"Error importing organization {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_practitioner_batch(self, session: Session, practitioners: List[Dict]) -> None:
        """Import a batch of practitioners"""
        from models.models import Provider
        
        for resource in practitioners:
            try:
                practitioner_id = resource.get('id')
                
                # Check if practitioner already exists
                existing_provider = session.query(Provider).filter(Provider.synthea_id == practitioner_id).first()
                if existing_provider:
                    # Store mapping for existing provider
                    self.resource_map[f"Practitioner/{practitioner_id}"] = existing_provider.id
                    self.resource_map[f"urn:uuid:{practitioner_id}"] = existing_provider.id
                    continue
                
                # Extract name data
                name_data = resource.get('name', [{}])[0]
                given_names = name_data.get('given', ['Unknown'])
                family_name = name_data.get('family', 'Unknown')
                prefix = name_data.get('prefix', [''])[0] if name_data.get('prefix') else ''
                
                first_name = given_names[0] if given_names else 'Unknown'
                
                # Clean provider names for realism
                cleaned_first, cleaned_last = self.clean_names(first_name, family_name)
                
                # Extract NPI
                npi = None
                for identifier in resource.get('identifier', []):
                    if identifier.get('system') == 'http://hl7.org/fhir/sid/us-npi':
                        npi = identifier.get('value')
                        break
                
                # Extract contact info
                address_data = resource.get('address', [{}])[0]
                
                email = None
                phone = None
                for telecom in resource.get('telecom', []):
                    if telecom.get('system') == 'email':
                        email = telecom.get('value')
                    elif telecom.get('system') == 'phone':
                        phone = telecom.get('value')
                
                provider = Provider(
                    synthea_id=practitioner_id,
                    npi=npi,
                    first_name=cleaned_first,
                    last_name=cleaned_last,
                    specialty='General Practice',  # Default specialty
                    address=address_data.get('line', [''])[0] if address_data.get('line') else '',
                    city=address_data.get('city', ''),
                    state=address_data.get('state', ''),
                    zip_code=address_data.get('postalCode', ''),
                    phone=phone or '(555) 000-0000',
                    email=email,
                    gender=resource.get('gender', 'unknown'),
                    active=resource.get('active', True)
                )
                
                session.add(provider)
                session.flush()  # Ensure provider gets an ID  
                # Store both possible reference formats (map to database ID)
                self.resource_map[f"Practitioner/{practitioner_id}"] = provider.id
                self.resource_map[f"urn:uuid:{practitioner_id}"] = provider.id
                self.stats.setdefault('providers', 0)
                self.stats['providers'] += 1
                
            except Exception as e:
                logger.error(f"Error importing practitioner {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_patient_batch(self, session: Session, patients: List[Dict]) -> None:
        """Import a batch of patients with name cleaning"""
        for resource in patients:
            try:
                patient_id = resource.get('id')
                
                # Extract name data
                name_data = resource.get('name', [{}])[0]
                given_names = name_data.get('given', ['Unknown'])
                family_name = name_data.get('family', 'Unknown')
                
                first_name = given_names[0] if given_names else 'Unknown'
                
                # Clean names for realism
                cleaned_first, cleaned_last = self.clean_patient_name(first_name, family_name)
                
                # Extract other demographics
                birth_date = None
                if resource.get('birthDate'):
                    birth_date = datetime.strptime(resource['birthDate'], '%Y-%m-%d').date()
                
                deceased_date = None
                if resource.get('deceasedDateTime'):
                    deceased_date = datetime.fromisoformat(resource['deceasedDateTime'].replace('Z', '+00:00')).date()
                
                # Extract address
                address_data = resource.get('address', [{}])[0]
                
                # Generate MRN (Medical Record Number)
                mrn = f"MRN{patient_id[-8:]}"  # Use last 8 chars of patient ID
                
                patient = Patient(
                    synthea_id=patient_id,
                    mrn=mrn,
                    first_name=cleaned_first,
                    last_name=cleaned_last,
                    date_of_birth=birth_date,
                    date_of_death=deceased_date,
                    gender=resource.get('gender', 'unknown'),
                    address=address_data.get('line', [''])[0] if address_data.get('line') else '',
                    city=address_data.get('city', ''),
                    state=address_data.get('state', ''),
                    zip_code=address_data.get('postalCode', '')
                )
                
                session.add(patient)
                session.flush()  # Ensure patient gets an ID
                # Store both possible reference formats (map to database ID)
                self.resource_map[f"Patient/{patient_id}"] = patient.id
                self.resource_map[f"urn:uuid:{patient_id}"] = patient.id
                self.stats['patients'] += 1
                
            except Exception as e:
                logger.error(f"Error importing patient {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_encounter_batch(self, session: Session, encounters: List[Dict]) -> None:
        """Import a batch of encounters"""
        for resource in encounters:
            try:
                encounter_id = resource.get('id')
                
                # Get patient reference
                patient_ref = resource.get('subject', {}).get('reference')
                patient = self.resolve_reference(session, patient_ref, Patient)
                if not patient:
                    logger.debug(f"Patient reference {patient_ref} not found for encounter {encounter_id}")
                    continue
                
                # Get provider reference from participants
                provider = None
                for participant in resource.get('participant', []):
                    individual_ref = participant.get('individual', {}).get('reference')
                    if individual_ref:
                        provider = self.resolve_reference(session, individual_ref, Provider)
                        if provider:
                            break
                
                # Parse period
                period = resource.get('period', {})
                start_time = None
                end_time = None
                
                if period.get('start'):
                    start_time = datetime.fromisoformat(period['start'].replace('Z', '+00:00'))
                if period.get('end'):
                    end_time = datetime.fromisoformat(period['end'].replace('Z', '+00:00'))
                
                encounter = Encounter(
                    synthea_id=encounter_id,
                    patient_id=patient.id,
                    provider_id=provider.id if provider else None,
                    encounter_class=resource.get('class', {}).get('code', 'ambulatory'),
                    encounter_type=resource.get('type', [{}])[0].get('text', 'General'),
                    status=resource.get('status', 'finished'),
                    encounter_date=start_time,
                    encounter_end=end_time
                )
                
                session.add(encounter)
                session.flush()  # Ensure encounter gets an ID
                # Store both possible reference formats (map to database ID)
                self.resource_map[f"Encounter/{encounter_id}"] = encounter.id
                self.resource_map[f"urn:uuid:{encounter_id}"] = encounter.id
                self.stats['encounters'] += 1
                
            except Exception as e:
                logger.error(f"Error importing encounter {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_condition_batch(self, session: Session, conditions: List[Dict]) -> None:
        """Import a batch of conditions"""
        for resource in conditions:
            try:
                condition_id = resource.get('id')
                
                # Get patient reference
                patient_ref = resource.get('subject', {}).get('reference')
                patient = self.resolve_reference(session, patient_ref, Patient)
                if not patient:
                    logger.debug(f"Patient reference {patient_ref} not found for condition {condition_id}")
                    continue
                
                # Get encounter reference (optional)
                encounter = None
                encounter_ref = resource.get('encounter', {}).get('reference')
                if encounter_ref:
                    encounter = self.resolve_reference(session, encounter_ref, Encounter)
                
                # Parse condition code
                code_data = resource.get('code', {})
                condition_code = None
                condition_name = code_data.get('text', 'Unknown condition')
                
                for coding in code_data.get('coding', []):
                    if coding.get('system') == 'http://snomed.info/sct':
                        condition_code = coding.get('code')
                        if coding.get('display'):
                            condition_name = coding.get('display')
                        break
                
                # Parse onset
                onset_date = None
                if resource.get('onsetDateTime'):
                    onset_date = datetime.fromisoformat(resource['onsetDateTime'].replace('Z', '+00:00')).date()
                
                condition = Condition(
                    synthea_id=condition_id,
                    patient_id=patient.id,
                    encounter_id=encounter.id if encounter else None,
                    snomed_code=condition_code,
                    description=condition_name,
                    onset_date=onset_date,
                    clinical_status=resource.get('clinicalStatus', {}).get('coding', [{}])[0].get('code', 'active')
                )
                
                session.add(condition)
                self.stats['conditions'] += 1
                
            except Exception as e:
                logger.error(f"Error importing condition {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_medication_batch(self, session: Session, medications: List[Dict]) -> None:
        """Import batch of medications"""
        for resource in medications:
            try:
                med_id = resource.get('id')
                
                # Get patient reference
                patient_ref = resource.get('subject', {}).get('reference')
                patient = self.resolve_reference(session, patient_ref, Patient)
                if not patient:
                    logger.debug(f"Patient reference {patient_ref} not found for medication {med_id}")
                    continue
                
                # Get encounter reference (optional)
                encounter = None
                encounter_ref = resource.get('encounter', {}).get('reference')
                if encounter_ref:
                    encounter = self.resolve_reference(session, encounter_ref, Encounter)
                
                # Parse medication
                med_data = resource.get('medicationCodeableConcept', {})
                rxnorm_code = None
                medication_name = med_data.get('text', 'Unknown medication')
                
                for coding in med_data.get('coding', []):
                    if coding.get('system') == 'http://www.nlm.nih.gov/research/umls/rxnorm':
                        rxnorm_code = coding.get('code')
                        if coding.get('display'):
                            medication_name = coding.get('display')
                        break
                
                # Parse dosage
                dosage_text = 'As directed'
                if resource.get('dosageInstruction'):
                    dosage = resource['dosageInstruction'][0]
                    if dosage.get('text'):
                        dosage_text = dosage['text']
                
                authored_on = None
                if resource.get('authoredOn'):
                    authored_on = datetime.fromisoformat(resource['authoredOn'].replace('Z', '+00:00'))
                
                medication = Medication(
                    synthea_id=med_id,
                    patient_id=patient.id,
                    encounter_id=encounter.id if encounter else None,
                    rxnorm_code=rxnorm_code,
                    medication_name=medication_name,
                    dosage=dosage_text,
                    start_date=authored_on.date() if authored_on else None,
                    status=resource.get('status', 'active')
                )
                
                session.add(medication)
                self.stats['medications'] += 1
                
            except Exception as e:
                logger.error(f"Error importing medication {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_observation_batch(self, session: Session, observations: List[Dict]) -> None:
        """Import batch of observations"""
        for resource in observations:
            try:
                obs_id = resource.get('id')
                
                # Get patient reference
                patient_ref = resource.get('subject', {}).get('reference')
                patient = self.resolve_reference(session, patient_ref, Patient)
                if not patient:
                    logger.debug(f"Patient reference {patient_ref} not found for observation {obs_id}")
                    continue
                
                # Get encounter reference (optional)
                encounter = None
                encounter_ref = resource.get('encounter', {}).get('reference')
                if encounter_ref:
                    encounter = self.resolve_reference(session, encounter_ref, Encounter)
                
                # Parse observation code
                code_data = resource.get('code', {})
                loinc_code = None
                display = code_data.get('text', 'Unknown observation')
                
                for coding in code_data.get('coding', []):
                    if coding.get('system') == 'http://loinc.org':
                        loinc_code = coding.get('code')
                        if coding.get('display'):
                            display = coding.get('display')
                        break
                
                # Determine observation type from category
                obs_type = 'laboratory'  # default
                for category in resource.get('category', []):
                    for coding in category.get('coding', []):
                        if coding.get('code') == 'vital-signs':
                            obs_type = 'vital-signs'
                            break
                
                # Parse value
                value = None
                value_quantity = None
                value_unit = None
                
                # Handle FHIR components for complex observations
                if resource.get('component'):
                    if loinc_code == '85354-9':
                        # Blood pressure panel - extract systolic and diastolic
                        systolic = None
                        diastolic = None
                        
                        for component in resource.get('component', []):
                            comp_code = component.get('code', {})
                            for coding in comp_code.get('coding', []):
                                if coding.get('code') == '8480-6':  # Systolic
                                    if component.get('valueQuantity'):
                                        systolic = component.get('valueQuantity').get('value')
                                elif coding.get('code') == '8462-4':  # Diastolic
                                    if component.get('valueQuantity'):
                                        diastolic = component.get('valueQuantity').get('value')
                        
                        if systolic and diastolic:
                            value = f"{systolic}/{diastolic}"
                            value_unit = "mmHg"
                    elif loinc_code == '93025-5':
                        # PRAPARE questionnaire - store as JSON summary
                        components = []
                        for component in resource.get('component', []):
                            comp_code = component.get('code', {})
                            comp_display = comp_code.get('text', '')
                            
                            comp_value = None
                            if component.get('valueCodeableConcept'):
                                comp_value = component.get('valueCodeableConcept', {}).get('text')
                            elif component.get('valueQuantity'):
                                val = component.get('valueQuantity', {})
                                comp_value = f"{val.get('value')} {val.get('unit', '')}"
                                
                            if comp_display and comp_value:
                                components.append(f"{comp_display}: {comp_value}")
                        
                        if components:
                            value = "; ".join(components[:3])  # Store first 3 components as summary
                    else:
                        # Generic component handling - store first component
                        first_comp = resource.get('component', [{}])[0]
                        if first_comp.get('valueQuantity'):
                            val = first_comp.get('valueQuantity', {})
                            value_quantity = val.get('value')
                            value_unit = val.get('unit')
                            value = f"{value_quantity} {value_unit}"
                        elif first_comp.get('valueCodeableConcept'):
                            value = first_comp.get('valueCodeableConcept', {}).get('text')
                elif resource.get('valueQuantity'):
                    value_q = resource.get('valueQuantity', {})
                    value_quantity = value_q.get('value')
                    value_unit = value_q.get('unit')
                    value = f"{value_quantity} {value_unit}" if value_quantity else None
                elif resource.get('valueString'):
                    value = resource.get('valueString')
                elif resource.get('valueCodeableConcept'):
                    value = resource.get('valueCodeableConcept', {}).get('text')
                
                # Parse effective date
                effective_date = None
                if resource.get('effectiveDateTime'):
                    effective_date = datetime.fromisoformat(resource['effectiveDateTime'].replace('Z', '+00:00'))
                
                observation = Observation(
                    synthea_id=obs_id,
                    patient_id=patient.id,
                    encounter_id=encounter.id if encounter else None,
                    observation_date=effective_date,
                    observation_type=obs_type,
                    loinc_code=loinc_code,
                    display=display,
                    value=value,
                    value_quantity=value_quantity,
                    value_unit=value_unit,
                    status=resource.get('status', 'final')
                )
                
                session.add(observation)
                self.stats['observations'] += 1
                
            except Exception as e:
                logger.error(f"Error importing observation {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_document_batch(self, session: Session, documents: List[Dict]) -> None:
        """Import batch of document references (clinical notes)"""
        for resource in documents:
            try:
                doc_id = resource.get('id')
                
                # Get patient reference - we don't need patient for notes
                patient_ref = resource.get('subject', {}).get('reference')
                
                # Get encounter reference
                encounter = None
                if resource.get('context', {}).get('encounter'):
                    enc_ref = resource.get('context', {}).get('encounter', [{}])[0].get('reference')
                    if enc_ref:
                        encounter = self.resolve_reference(session, enc_ref, Encounter)
                
                if not encounter:
                    # Skip documents without encounters
                    continue
                
                # Extract clinical note content
                for content in resource.get('content', []):
                    attachment = content.get('attachment', {})
                    if attachment.get('data'):
                        try:
                            # Decode base64 content
                            note_content = base64.b64decode(attachment.get('data')).decode('utf-8')
                            
                            # Update encounter with clinical notes
                            if encounter.notes:
                                encounter.notes += "\n\n---\n\n" + note_content
                            else:
                                encounter.notes = note_content
                            
                            self.stats['documents'] += 1
                            logger.debug(f"Added clinical note to encounter {encounter.synthea_id}")
                        except Exception as e:
                            logger.error(f"Error decoding clinical note: {e}")
                
            except Exception as e:
                logger.error(f"Error importing document {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def _import_imaging_study_batch(self, session: Session, imaging_studies: List[Dict]) -> None:
        """Import batch of imaging studies and generate DICOM files if enabled"""
        for resource in imaging_studies:
            try:
                study_id = resource.get('id')
                
                # Get patient reference
                patient_ref = resource.get('subject', {}).get('reference')
                patient = self.resolve_reference(session, patient_ref, Patient)
                if not patient:
                    logger.debug(f"Patient reference {patient_ref} not found for imaging study {study_id}")
                    continue
                
                # Parse study date
                study_date = None
                if resource.get('started'):
                    study_date = datetime.fromisoformat(resource['started'].replace('Z', '+00:00'))
                
                # Extract study description
                description = 'Unknown Imaging Study'
                
                # Try to get description from procedureCode
                if resource.get('procedureCode'):
                    for code in resource['procedureCode']:
                        if code.get('text'):
                            description = code['text']
                            break
                        elif code.get('coding'):
                            for coding in code['coding']:
                                if coding.get('display'):
                                    description = coding['display']
                                    break
                
                # Determine modality
                modality_code = 'OT'  # Other (default)
                body_part = ''
                
                # Extract modality from series
                if resource.get('series'):
                    first_series = resource['series'][0]
                    if first_series.get('modality'):
                        modality_code = first_series['modality'].get('code', 'OT')
                    
                    # Try to extract body part from series
                    if first_series.get('bodySite'):
                        body_part_coding = first_series['bodySite'].get('coding', [{}])[0]
                        body_part = body_part_coding.get('display', '')
                
                # Map DICOM modality codes to internal format
                modality_map = {
                    'CT': 'CT',
                    'MR': 'MR', 
                    'US': 'US',
                    'CR': 'XR',  # Computed Radiography -> X-Ray
                    'DX': 'XR',  # Digital Radiography -> X-Ray
                    'XR': 'XR'
                }
                modality = modality_map.get(modality_code, 'CT')
                
                # Create ImagingStudy record
                imaging_study = ImagingStudy(
                    synthea_id=study_id,
                    patient_id=patient.id,
                    study_date=study_date,
                    description=description,
                    modality=modality,
                    body_part=body_part or None,
                    number_of_series=len(resource.get('series', [])),
                    number_of_instances=resource.get('numberOfInstances', 0),
                    status='available'
                )
                
                session.add(imaging_study)
                session.flush()  # Ensure it gets an ID
                
                self.stats['imaging_studies'] += 1
                
                # Generate DICOM files if enabled
                if self.generate_dicom:
                    try:
                        dicom_study = process_imaging_study(session, imaging_study, self.dicom_upload_dir)
                        logger.info(f"Generated DICOM study with {dicom_study.number_of_instances} images for {description}")
                        self.stats['dicom_studies'] += 1
                    except Exception as e:
                        logger.error(f"Error generating DICOM for imaging study {study_id}: {e}")
                
            except Exception as e:
                logger.error(f"Error importing imaging study {resource.get('id')}: {e}")
                self.stats['errors'] += 1
    
    def import_directory(self, synthea_output_dir: Path) -> bool:
        """Import all FHIR bundles from a directory with memory optimization"""
        if not synthea_output_dir.exists():
            logger.error(f"Synthea output directory not found: {synthea_output_dir}")
            return False
        
        logger.info(f"Starting optimized import from {synthea_output_dir}")
        if self.generate_dicom:
            logger.info("DICOM generation is enabled - will create DICOM files for imaging studies")
        
        try:
            # Collect all resources by type for batch processing
            all_patients = []
            all_practitioners = []
            all_organizations = []
            all_encounters = []
            all_conditions = []
            all_medications = []
            all_observations = []
            all_documents = []
            all_imaging_studies = []
            
            # Stream through files to collect resources
            for bundle in self.stream_bundle_files(synthea_output_dir):
                for entry in bundle.get('entry', []):
                    resource = entry.get('resource', {})
                    resource_type = resource.get('resourceType')
                    
                    if resource_type == 'Patient':
                        all_patients.append(resource)
                    elif resource_type == 'Practitioner':
                        all_practitioners.append(resource)
                    elif resource_type == 'Organization':
                        all_organizations.append(resource)
                    elif resource_type == 'Encounter':
                        all_encounters.append(resource)
                    elif resource_type == 'Condition':
                        all_conditions.append(resource)
                    elif resource_type == 'MedicationRequest':
                        all_medications.append(resource)
                    elif resource_type == 'Observation':
                        all_observations.append(resource)
                    elif resource_type == 'DocumentReference':
                        all_documents.append(resource)
                    elif resource_type == 'ImagingStudy':
                        all_imaging_studies.append(resource)
            
            # Process each resource type in order (dependencies first)
            logger.info(f"Processing {len(all_organizations)} organizations...")
            self.process_in_batches(all_organizations, 'Organization')
            
            logger.info(f"Processing {len(all_practitioners)} practitioners...")
            self.process_in_batches(all_practitioners, 'Practitioner')
            
            logger.info(f"Processing {len(all_patients)} patients...")
            self.process_in_batches(all_patients, 'Patient')
            
            logger.info(f"Processing {len(all_encounters)} encounters...")
            self.process_in_batches(all_encounters, 'Encounter')
            
            logger.info(f"Processing {len(all_conditions)} conditions...")
            self.process_in_batches(all_conditions, 'Condition')
            
            logger.info(f"Processing {len(all_medications)} medications...")
            self.process_in_batches(all_medications, 'Medication')
            
            logger.info(f"Processing {len(all_observations)} observations...")
            self.process_in_batches(all_observations, 'Observation')
            
            logger.info(f"Processing {len(all_documents)} document references...")
            self.process_in_batches(all_documents, 'DocumentReference')
            
            logger.info(f"Processing {len(all_imaging_studies)} imaging studies...")
            self.process_in_batches(all_imaging_studies, 'ImagingStudy')
            
            logger.info("Import completed successfully!")
            self._print_stats()
            return True
            
        except Exception as e:
            logger.error(f"Import failed: {e}")
            return False
    
    def _print_stats(self):
        """Print import statistics"""
        logger.info("Import Statistics:")
        logger.info(f"  Organizations: {self.stats['organizations']}")
        logger.info(f"  Providers: {self.stats['providers']}")
        logger.info(f"  Patients: {self.stats['patients']}")
        logger.info(f"  Encounters: {self.stats['encounters']}")
        logger.info(f"  Conditions: {self.stats['conditions']}")
        logger.info(f"  Medications: {self.stats['medications']}")
        logger.info(f"  Observations: {self.stats['observations']}")
        logger.info(f"  Documents: {self.stats['documents']}")
        logger.info(f"  Imaging Studies: {self.stats['imaging_studies']}")
        logger.info(f"  DICOM Studies Generated: {self.stats['dicom_studies']}")
        logger.info(f"  Batches processed: {self.stats['batches_processed']}")
        logger.info(f"  Errors: {self.stats['errors']}")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Optimized Synthea FHIR Bundle Importer with DICOM Generation')
    parser.add_argument('--input-dir', type=str, required=True,
                       help='Directory containing Synthea FHIR bundles')
    parser.add_argument('--batch-size', type=int, default=50,
                       help='Number of resources to process per batch')
    parser.add_argument('--no-dicom', action='store_true',
                       help='Disable automatic DICOM generation')
    
    args = parser.parse_args()
    
    importer = OptimizedSyntheaImporterWithDICOM(
        batch_size=args.batch_size,
        generate_dicom=not args.no_dicom
    )
    input_path = Path(args.input_dir)
    
    success = importer.import_directory(input_path)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())