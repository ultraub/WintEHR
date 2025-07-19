#!/usr/bin/env python3
"""
Consolidated Search Parameter Indexing Script

This script handles all search parameter indexing operations without external dependencies.
It can be used during builds, for maintenance, or for fixing indexing issues.

Features:
- No import dependencies on other modules (self-contained)
- Handles both initial indexing and re-indexing
- Supports different modes: index, reindex, verify, fix
- Robust error handling and recovery
- Progress tracking and detailed reporting

Usage:
    # Index all resources (default mode)
    python consolidated_search_indexing.py
    
    # Reindex specific resource type
    python consolidated_search_indexing.py --mode reindex --resource-type Condition
    
    # Verify search parameters
    python consolidated_search_indexing.py --mode verify
    
    # Fix missing parameters
    python consolidated_search_indexing.py --mode fix
    
    # Monitor health
    python consolidated_search_indexing.py --mode monitor
"""

import asyncio
import json
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import asyncpg
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SearchParameterIndexer:
    """Consolidated search parameter indexing without external dependencies."""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
        self.conn = None
        self.stats = {
            'processed': 0,
            'indexed': 0,
            'errors': 0,
            'skipped': 0
        }
        
        # Define search parameter mappings for each resource type
        self.search_param_mappings = {
            'AllergyIntolerance': {
                'patient': ['patient.reference'],
                'clinical-status': ['clinicalStatus.coding[*].code'],
                'type': ['type'],
                'category': ['category[*]'],
                'criticality': ['criticality'],
                'code': ['code.coding[*].code'],
                'date': ['recordedDate'],
                'last-date': ['lastOccurrence'],
                'severity': ['reaction[*].severity'],
                'manifestation': ['reaction[*].manifestation[*].coding[*].code']
            },
            'CarePlan': {
                'patient': ['subject.reference'],
                'status': ['status'],
                'intent': ['intent'],
                'category': ['category[*].coding[*].code'],
                'date': ['period.start'],
                'activity-code': ['activity[*].detail.code.coding[*].code'],
                'activity-date': ['activity[*].detail.scheduled.timing.event[*]'],
                'condition': ['addresses[*].reference'],
                'encounter': ['encounter.reference'],
                'goal': ['goal[*].reference'],
                'subject': ['subject.reference']
            },
            'CareTeam': {
                'patient': ['subject.reference'],
                'status': ['status'],
                'category': ['category[*].coding[*].code'],
                'participant': ['participant[*].member.reference'],
                'encounter': ['encounter.reference'],
                'subject': ['subject.reference']
            },
            'Claim': {
                'patient': ['patient.reference'],
                'status': ['status'],
                'use': ['use'],
                'created': ['created'],
                'provider': ['provider.reference'],
                'priority': ['priority.coding[*].code'],
                'payee': ['payee.party.reference'],
                'facility': ['facility.reference'],
                'care-team': ['careTeam[*].provider.reference'],
                'encounter': ['item[*].encounter[*].reference'],
                'procedure-udi': ['procedure[*].udi[*].reference'],
                'insurer': ['insurer.reference']
            },
            'Condition': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'clinical-status': ['clinicalStatus.coding[*].code'],
                'verification-status': ['verificationStatus.coding[*].code'],
                'category': ['category[*].coding[*].code'],
                'severity': ['severity.coding[*].code'],
                'code': ['code.coding[*].code'],
                'body-site': ['bodySite[*].coding[*].code'],
                'encounter': ['encounter.reference'],
                'onset-date': ['onsetDateTime', 'onsetPeriod.start'],
                'abatement-date': ['abatementDateTime', 'abatementPeriod.start'],
                'recorded-date': ['recordedDate'],
                'asserter': ['asserter.reference'],
                'stage': ['stage[*].summary.coding[*].code'],
                'evidence': ['evidence[*].code[*].coding[*].code']
            },
            'Coverage': {
                'patient': ['beneficiary.reference'],
                'status': ['status'],
                'type': ['type.coding[*].code'],
                'subscriber': ['subscriber.reference'],
                'beneficiary': ['beneficiary.reference'],
                'payor': ['payor[*].reference'],
                'class-type': ['class[*].type.coding[*].code'],
                'class-value': ['class[*].value'],
                'dependent': ['dependent'],
                'identifier': ['identifier[*].value']
            },
            'Device': {
                'patient': ['patient.reference'],
                'organization': ['owner.reference'],
                'location': ['location.reference'],
                'manufacturer': ['manufacturer'],
                'model': ['modelNumber'],
                'status': ['status'],
                'type': ['type.coding[*].code'],
                'udi-carrier': ['udiCarrier[*].carrierHRF'],
                'udi-di': ['udiCarrier[*].deviceIdentifier'],
                'url': ['url']
            },
            'DiagnosticReport': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'category': ['category[*].coding[*].code'],
                'code': ['code.coding[*].code'],
                'date': ['effectiveDateTime', 'effectivePeriod.start'],
                'encounter': ['encounter.reference'],
                'issued': ['issued'],
                'performer': ['performer[*].reference'],
                'identifier': ['identifier[*].value'],
                'result': ['result[*].reference'],
                'conclusion-code': ['conclusionCode[*].coding[*].code'],
                'media': ['media[*].link.reference'],
                'specimen': ['specimen[*].reference']
            },
            'DocumentReference': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'type': ['type.coding[*].code'],
                'category': ['category[*].coding[*].code'],
                'date': ['date'],
                'authenticator': ['authenticator.reference'],
                'author': ['author[*].reference'],
                'created': ['content[*].attachment.creation'],
                'custodian': ['custodian.reference'],
                'description': ['description'],
                'encounter': ['context.encounter[*].reference'],
                'event': ['context.event[*].coding[*].code'],
                'facility': ['context.facilityType.coding[*].code'],
                'format': ['content[*].format.coding[*].code'],
                'identifier': ['masterIdentifier.value', 'identifier[*].value'],
                'language': ['content[*].attachment.language'],
                'location': ['content[*].attachment.url'],
                'period': ['context.period.start', 'context.period.end'],
                'related': ['context.related[*].reference'],
                'relatesto': ['relatesTo[*].target.reference'],
                'relation': ['relatesTo[*].code'],
                'security-label': ['securityLabel[*].coding[*].code'],
                'setting': ['context.practiceSetting.coding[*].code']
            },
            'Encounter': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'class': ['class.code'],
                'type': ['type[*].coding[*].code'],
                'date': ['period.start'],
                'diagnosis': ['diagnosis[*].condition.reference'],
                'episode-of-care': ['episodeOfCare[*].reference'],
                'identifier': ['identifier[*].value'],
                'length': ['length.value'],
                'location': ['location[*].location.reference'],
                'location-period': ['location[*].period.start'],
                'part-of': ['partOf.reference'],
                'participant': ['participant[*].individual.reference'],
                'participant-type': ['participant[*].type[*].coding[*].code'],
                'practitioner': ['participant[*].individual.reference'],
                'reason-code': ['reasonCode[*].coding[*].code'],
                'reason-reference': ['reasonReference[*].reference'],
                'service-provider': ['serviceProvider.reference'],
                'special-arrangement': ['hospitalization.specialArrangement[*].coding[*].code'],
                'appointment': ['appointment[*].reference'],
                'account': ['account[*].reference']
            },
            'ExplanationOfBenefit': {
                'patient': ['patient.reference'],
                'status': ['status'],
                'created': ['created'],
                'insurer': ['insurer.reference'],
                'provider': ['provider.reference'],
                'care-team': ['careTeam[*].provider.reference'],
                'coverage': ['insurance[*].coverage.reference'],
                'claim': ['claim.reference'],
                'detail-udi': ['item[*].detail[*].udi[*].reference'],
                'disposition': ['disposition'],
                'encounter': ['item[*].encounter[*].reference'],
                'enterer': ['enterer.reference'],
                'facility': ['facility.reference'],
                'identifier': ['identifier[*].value'],
                'item-udi': ['item[*].udi[*].reference'],
                'payee': ['payee.party.reference'],
                'procedure-udi': ['procedure[*].udi[*].reference'],
                'subdetail-udi': ['item[*].detail[*].subDetail[*].udi[*].reference']
            },
            'Goal': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'achievement-status': ['achievementStatus.coding[*].code'],
                'category': ['category[*].coding[*].code'],
                'identifier': ['identifier[*].value'],
                'lifecycle-status': ['lifecycleStatus'],
                'start-date': ['startDate', 'startCodeableConcept.coding[*].code'],
                'target-date': ['target[*].dueDate']
            },
            'ImagingStudy': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'modality': ['modality[*].code', 'series[*].modality.code'],
                'bodysite': ['series[*].bodySite.code'],
                'dicom-class': ['series[*].instance[*].sopClass.code'],
                'encounter': ['encounter.reference'],
                'endpoint': ['endpoint[*].reference', 'series[*].endpoint[*].reference'],
                'identifier': ['identifier[*].value'],
                'instance': ['series[*].instance[*].uid'],
                'interpreter': ['interpreter[*].reference'],
                'performer': ['series[*].performer[*].actor.reference'],
                'reason': ['reasonCode[*].coding[*].code', 'reasonReference[*].reference'],
                'referrer': ['referrer.reference'],
                'series': ['series[*].uid'],
                'started': ['started']
            },
            'Immunization': {
                'patient': ['patient.reference'],
                'status': ['status'],
                'status-reason': ['statusReason.coding[*].code'],
                'vaccine-code': ['vaccineCode.coding[*].code'],
                'date': ['occurrenceDateTime'],
                'identifier': ['identifier[*].value'],
                'location': ['location.reference'],
                'lot-number': ['lotNumber'],
                'manufacturer': ['manufacturer.reference'],
                'performer': ['performer[*].actor.reference'],
                'reaction': ['reaction[*].detail.reference'],
                'reaction-date': ['reaction[*].date'],
                'reason-code': ['reasonCode[*].coding[*].code'],
                'reason-reference': ['reasonReference[*].reference'],
                'route': ['route.coding[*].code'],
                'series': ['protocolApplied[*].series'],
                'target-disease': ['protocolApplied[*].targetDisease[*].coding[*].code']
            },
            'MedicationAdministration': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'medication': ['medicationCodeableConcept.coding[*].code', 'medicationReference.reference'],
                'code': ['medicationCodeableConcept.coding[*].code'],
                'context': ['context.reference'],
                'device': ['device[*].reference'],
                'effective-time': ['effectiveDateTime', 'effectivePeriod.start'],
                'identifier': ['identifier[*].value'],
                'performer': ['performer[*].actor.reference'],
                'reason-given': ['reasonCode[*].coding[*].code'],
                'reason-not-given': ['statusReason[*].coding[*].code'],
                'request': ['request.reference']
            },
            'MedicationDispense': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'medication': ['medicationCodeableConcept.coding[*].code', 'medicationReference.reference'],
                'code': ['medicationCodeableConcept.coding[*].code'],
                'context': ['context.reference'],
                'destination': ['destination.reference'],
                'identifier': ['identifier[*].value'],
                'performer': ['performer[*].actor.reference'],
                'prescription': ['authorizingPrescription[*].reference'],
                'receiver': ['receiver[*].reference'],
                'responsibleparty': ['substitution.responsibleParty[*].reference'],
                'type': ['type.coding[*].code'],
                'whenhandedover': ['whenHandedOver'],
                'whenprepared': ['whenPrepared']
            },
            'MedicationRequest': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'intent': ['intent'],
                'medication': ['medicationCodeableConcept.coding[*].code', 'medicationReference.reference'],
                'code': ['medicationCodeableConcept.coding[*].code'],
                'authoredon': ['authoredOn'],
                'category': ['category[*].coding[*].code'],
                'date': ['dosageInstruction[*].timing.event[*]'],
                'encounter': ['encounter.reference'],
                'identifier': ['identifier[*].value'],
                'intended-dispenser': ['dispenseRequest.performer.reference'],
                'intended-performer': ['performer.reference'],
                'intended-performertype': ['performerType.coding[*].code'],
                'priority': ['priority'],
                'requester': ['requester.reference']
            },
            'MedicationStatement': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'medication': ['medicationCodeableConcept.coding[*].code', 'medicationReference.reference'],
                'code': ['medicationCodeableConcept.coding[*].code'],
                'category': ['category.coding[*].code'],
                'context': ['context.reference'],
                'effective': ['effectiveDateTime', 'effectivePeriod.start'],
                'identifier': ['identifier[*].value'],
                'part-of': ['partOf[*].reference'],
                'source': ['informationSource.reference']
            },
            'Observation': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'category': ['category[*].coding[*].code'],
                'code': ['code.coding[*].code'],
                'combo-code': ['code.coding[*].code', 'component[*].code.coding[*].code'],
                'combo-code-value-quantity': ['code.coding[*].code', 'component[*].code.coding[*].code'],
                'combo-data-absent-reason': ['dataAbsentReason.coding[*].code'],
                'combo-value-concept': ['valueCodeableConcept.coding[*].code'],
                'combo-value-quantity': ['valueQuantity.value'],
                'component-code': ['component[*].code.coding[*].code'],
                'component-data-absent-reason': ['component[*].dataAbsentReason.coding[*].code'],
                'component-value-concept': ['component[*].valueCodeableConcept.coding[*].code'],
                'component-value-quantity': ['component[*].valueQuantity.value'],
                'data-absent-reason': ['dataAbsentReason.coding[*].code'],
                'date': ['effectiveDateTime', 'effectivePeriod.start', 'effectiveTiming.event[*]', 'effectiveInstant'],
                'derived-from': ['derivedFrom[*].reference'],
                'device': ['device.reference'],
                'encounter': ['encounter.reference'],
                'focus': ['focus[*].reference'],
                'has-member': ['hasMember[*].reference'],
                'identifier': ['identifier[*].value'],
                'method': ['method.coding[*].code'],
                'part-of': ['partOf[*].reference'],
                'performer': ['performer[*].reference'],
                'specimen': ['specimen.reference'],
                'value-concept': ['valueCodeableConcept.coding[*].code'],
                'value-date': ['valueDateTime', 'valuePeriod.start'],
                'value-quantity': ['valueQuantity.value'],
                'value-string': ['valueString']
            },
            'Organization': {
                'active': ['active'],
                'address': ['address[*].line[*]', 'address[*].city', 'address[*].state', 'address[*].postalCode', 'address[*].country'],
                'address-city': ['address[*].city'],
                'address-country': ['address[*].country'],
                'address-postalcode': ['address[*].postalCode'],
                'address-state': ['address[*].state'],
                'address-use': ['address[*].use'],
                'endpoint': ['endpoint[*].reference'],
                'identifier': ['identifier[*].value'],
                'name': ['name', 'alias[*]'],
                'partof': ['partOf.reference'],
                'phonetic': ['name'],
                'type': ['type[*].coding[*].code']
            },
            'Patient': {
                'active': ['active'],
                'address': ['address[*].line[*]', 'address[*].city', 'address[*].state', 'address[*].postalCode', 'address[*].country'],
                'address-city': ['address[*].city'],
                'address-country': ['address[*].country'],
                'address-postalcode': ['address[*].postalCode'],
                'address-state': ['address[*].state'],
                'address-use': ['address[*].use'],
                'birthdate': ['birthDate'],
                'death-date': ['deceasedDateTime'],
                'deceased': ['deceasedBoolean', 'deceasedDateTime'],
                'email': ['telecom[?(@.system=="email")].value'],
                'family': ['name[*].family'],
                'gender': ['gender'],
                'general-practitioner': ['generalPractitioner[*].reference'],
                'given': ['name[*].given[*]'],
                'identifier': ['identifier[*].value'],
                'language': ['communication[*].language.coding[*].code'],
                'link': ['link[*].other.reference'],
                'name': ['name[*].text', 'name[*].family', 'name[*].given[*]'],
                'organization': ['managingOrganization.reference'],
                'phone': ['telecom[?(@.system=="phone")].value'],
                'phonetic': ['name[*].text', 'name[*].family', 'name[*].given[*]'],
                'telecom': ['telecom[*].value']
            },
            'Practitioner': {
                'active': ['active'],
                'address': ['address[*].line[*]', 'address[*].city', 'address[*].state', 'address[*].postalCode', 'address[*].country'],
                'address-city': ['address[*].city'],
                'address-country': ['address[*].country'],
                'address-postalcode': ['address[*].postalCode'],
                'address-state': ['address[*].state'],
                'address-use': ['address[*].use'],
                'communication': ['communication[*].coding[*].code'],
                'email': ['telecom[?(@.system=="email")].value'],
                'family': ['name[*].family'],
                'gender': ['gender'],
                'given': ['name[*].given[*]'],
                'identifier': ['identifier[*].value'],
                'name': ['name[*].text', 'name[*].family', 'name[*].given[*]'],
                'phone': ['telecom[?(@.system=="phone")].value'],
                'phonetic': ['name[*].text', 'name[*].family', 'name[*].given[*]'],
                'telecom': ['telecom[*].value']
            },
            'Procedure': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'category': ['category.coding[*].code'],
                'code': ['code.coding[*].code'],
                'date': ['performedDateTime', 'performedPeriod.start'],
                'encounter': ['encounter.reference'],
                'identifier': ['identifier[*].value'],
                'instantiates-canonical': ['instantiatesCanonical[*]'],
                'instantiates-uri': ['instantiatesUri[*]'],
                'location': ['location.reference'],
                'part-of': ['partOf[*].reference'],
                'performer': ['performer[*].actor.reference'],
                'reason-code': ['reasonCode[*].coding[*].code'],
                'reason-reference': ['reasonReference[*].reference'],
                'based-on': ['basedOn[*].reference']
            },
            'Provenance': {
                'patient': ['target[*].reference[?(@.startsWith("Patient/"))]'],
                'agent': ['agent[*].who.reference'],
                'agent-role': ['agent[*].role[*].coding[*].code'],
                'agent-type': ['agent[*].type.coding[*].code'],
                'entity': ['entity[*].what.reference'],
                'location': ['location.reference'],
                'recorded': ['recorded'],
                'signature-type': ['signature[*].type[*].code'],
                'target': ['target[*].reference'],
                'when': ['occurredDateTime', 'occurredPeriod.start']
            },
            'ServiceRequest': {
                'patient': ['subject.reference'],
                'subject': ['subject.reference'],
                'status': ['status'],
                'intent': ['intent'],
                'priority': ['priority'],
                'code': ['code.coding[*].code'],
                'authored': ['authoredOn'],
                'based-on': ['basedOn[*].reference'],
                'body-site': ['bodySite[*].coding[*].code'],
                'category': ['category[*].coding[*].code'],
                'encounter': ['encounter.reference'],
                'identifier': ['identifier[*].value'],
                'instantiates-canonical': ['instantiatesCanonical[*]'],
                'instantiates-uri': ['instantiatesUri[*]'],
                'occurrence': ['occurrenceDateTime', 'occurrencePeriod.start', 'occurrenceTiming.event[*]'],
                'performer': ['performer[*].reference'],
                'performer-type': ['performerType.coding[*].code'],
                'replaces': ['replaces[*].reference'],
                'requester': ['requester.reference'],
                'requisition': ['requisition.value'],
                'specimen': ['specimen[*].reference']
            }
        }
    
    async def connect(self):
        """Connect to the database."""
        try:
            self.conn = await asyncpg.connect(self.database_url)
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from the database."""
        if self.conn:
            await self.conn.close()
            logger.info("Disconnected from database")
    
    def extract_value_from_path(self, data: dict, path: str) -> List[Any]:
        """Extract values from nested JSON using path notation."""
        if not data or not path:
            return []
        
        results = []
        
        def traverse(obj, parts):
            if not parts:
                if obj is not None:
                    results.append(obj)
                return
            
            part = parts[0]
            remaining = parts[1:]
            
            # Handle array notation
            if '[*]' in part:
                field = part.replace('[*]', '')
                if isinstance(obj, dict) and field in obj:
                    items = obj[field]
                    if isinstance(items, list):
                        for item in items:
                            traverse(item, remaining)
                    else:
                        traverse(items, remaining)
            # Handle conditional notation (JSONPath style)
            elif '[?(' in part and ')]' in part:
                # Simple implementation for telecom system filtering
                if isinstance(obj, list):
                    for item in obj:
                        if isinstance(item, dict):
                            # Extract condition
                            if 'system=="email"' in part and item.get('system') == 'email':
                                traverse(item, remaining)
                            elif 'system=="phone"' in part and item.get('system') == 'phone':
                                traverse(item, remaining)
            else:
                if isinstance(obj, dict) and part in obj:
                    traverse(obj[part], remaining)
                elif isinstance(obj, list):
                    for item in obj:
                        traverse(item, [part] + remaining)
        
        parts = path.split('.')
        traverse(data, parts)
        
        return results
    
    async def extract_search_parameters(self, resource_id: int, resource_type: str, resource_data: dict) -> List[Tuple[str, Any]]:
        """Extract search parameters from a resource."""
        params = []
        
        # Get mappings for this resource type
        mappings = self.search_param_mappings.get(resource_type, {})
        
        for param_name, paths in mappings.items():
            values = []
            for path in paths:
                extracted = self.extract_value_from_path(resource_data, path)
                values.extend(extracted)
            
            # Deduplicate and add parameters
            seen = set()
            for value in values:
                if value:
                    # Convert to string for hashing if it's a dict/list
                    value_key = str(value) if isinstance(value, (dict, list)) else value
                    if value_key not in seen:
                        seen.add(value_key)
                        params.append((param_name, value))
        
        # Always add _id parameter
        if 'id' in resource_data:
            params.append(('_id', resource_data['id']))
        
        return params
    
    async def index_resource(self, resource_id: int, resource_type: str, resource_data: dict) -> bool:
        """Index a single resource."""
        try:
            # Extract search parameters
            params = await self.extract_search_parameters(resource_id, resource_type, resource_data)
            
            if params:
                # Insert search parameters
                # Note: We don't use ON CONFLICT as there's no unique constraint
                # First delete existing params for this resource to avoid duplicates
                await self.conn.execute("""
                    DELETE FROM fhir.search_params 
                    WHERE resource_id = $1
                """, resource_id)
                
                # Now insert the new params
                # Patient references are stored as reference type, others as string
                await self.conn.executemany("""
                    INSERT INTO fhir.search_params (resource_id, resource_type, param_name, param_type, value_string)
                    VALUES ($1, $2, $3, $4, $5)
                """, [(resource_id, resource_type, name, 'reference' if name in ['patient', 'subject'] else 'string', str(value)) for name, value in params])
                
                self.stats['indexed'] += 1
                return True
            else:
                self.stats['skipped'] += 1
                return False
                
        except Exception as e:
            logger.error(f"Error indexing resource {resource_type}/{resource_id}: {e}")
            self.stats['errors'] += 1
            return False
    
    async def index_all_resources(self):
        """Index all resources in the database."""
        logger.info("Starting full resource indexing...")
        
        # Get resource types
        resource_types = await self.conn.fetch("""
            SELECT DISTINCT resource_type, COUNT(*) as count
            FROM fhir.resources
            WHERE deleted = false OR deleted IS NULL
            GROUP BY resource_type
            ORDER BY count DESC
        """)
        
        total_resources = sum(rt['count'] for rt in resource_types)
        logger.info(f"Found {total_resources} resources across {len(resource_types)} types")
        
        # Process each resource type
        for rt in resource_types:
            resource_type = rt['resource_type']
            count = rt['count']
            
            logger.info(f"Indexing {resource_type} ({count} resources)...")
            
            # Process in batches
            batch_size = 100
            for offset in range(0, count, batch_size):
                resources = await self.conn.fetch("""
                    SELECT id, resource
                    FROM fhir.resources
                    WHERE resource_type = $1
                    AND (deleted = false OR deleted IS NULL)
                    ORDER BY id
                    LIMIT $2 OFFSET $3
                """, resource_type, batch_size, offset)
                
                for resource in resources:
                    self.stats['processed'] += 1
                    # Parse JSON if it's a string
                    resource_data = resource['resource']
                    if isinstance(resource_data, str):
                        resource_data = json.loads(resource_data)
                    await self.index_resource(resource['id'], resource_type, resource_data)
                
                # Progress update
                progress = min(offset + len(resources), count)
                pct = (progress / count) * 100
                logger.info(f"  {resource_type}: {progress}/{count} ({pct:.1f}%)")
    
    async def reindex_resource_type(self, resource_type: str):
        """Reindex a specific resource type."""
        logger.info(f"Reindexing {resource_type}...")
        
        # Delete existing parameters
        await self.conn.execute("""
            DELETE FROM fhir.search_params
            WHERE resource_type = $1
        """, resource_type)
        
        # Get resources
        resources = await self.conn.fetch("""
            SELECT id, resource
            FROM fhir.resources
            WHERE resource_type = $1
            AND (deleted = false OR deleted IS NULL)
            ORDER BY id
        """, resource_type)
        
        logger.info(f"Found {len(resources)} {resource_type} resources to reindex")
        
        for i, resource in enumerate(resources):
            self.stats['processed'] += 1
            # Parse JSON if it's a string
            resource_data = resource['resource']
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            await self.index_resource(resource['id'], resource_type, resource_data)
            
            if (i + 1) % 100 == 0:
                logger.info(f"  Progress: {i + 1}/{len(resources)}")
    
    async def verify_indexing(self):
        """Verify search parameter indexing."""
        logger.info("Verifying search parameter indexing...")
        
        # Check critical parameters
        critical_checks = [
            ('Patient references', """
                SELECT r.resource_type, COUNT(DISTINCT r.id) as total_resources,
                       COUNT(DISTINCT sp.resource_id) as indexed_resources
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id 
                    AND sp.param_name IN ('patient', 'subject')
                WHERE r.resource_type IN ('Condition', 'Observation', 'MedicationRequest', 
                                         'Procedure', 'AllergyIntolerance', 'DiagnosticReport')
                AND (r.deleted = false OR r.deleted IS NULL)
                GROUP BY r.resource_type
                ORDER BY r.resource_type
            """),
            ('Code parameters', """
                SELECT r.resource_type, COUNT(DISTINCT r.id) as total_resources,
                       COUNT(DISTINCT sp.resource_id) as indexed_resources
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'code'
                WHERE r.resource_type IN ('Condition', 'Observation', 'MedicationRequest', 
                                         'Procedure', 'DiagnosticReport')
                AND (r.deleted = false OR r.deleted IS NULL)
                GROUP BY r.resource_type
                ORDER BY r.resource_type
            """),
            ('Status parameters', """
                SELECT r.resource_type, COUNT(DISTINCT r.id) as total_resources,
                       COUNT(DISTINCT sp.resource_id) as indexed_resources
                FROM fhir.resources r
                LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'status'
                WHERE r.resource_type IN ('Condition', 'Observation', 'MedicationRequest', 
                                         'Procedure', 'Encounter', 'ServiceRequest')
                AND (r.deleted = false OR r.deleted IS NULL)
                GROUP BY r.resource_type
                ORDER BY r.resource_type
            """)
        ]
        
        all_good = True
        for check_name, query in critical_checks:
            logger.info(f"\nChecking {check_name}:")
            results = await self.conn.fetch(query)
            
            for row in results:
                resource_type = row['resource_type']
                total = row['total_resources']
                indexed = row['indexed_resources']
                pct = (indexed / total * 100) if total > 0 else 0
                
                if pct < 90:  # Alert if less than 90% indexed
                    logger.warning(f"  ⚠️  {resource_type}: {indexed}/{total} ({pct:.1f}%) indexed")
                    all_good = False
                else:
                    logger.info(f"  ✅ {resource_type}: {indexed}/{total} ({pct:.1f}%) indexed")
        
        if all_good:
            logger.info("\n✅ All critical search parameters are properly indexed")
        else:
            logger.warning("\n⚠️  Some search parameters need attention")
        
        return all_good
    
    async def fix_missing_parameters(self):
        """Fix missing search parameters."""
        logger.info("Fixing missing search parameters...")
        
        # Find resources missing critical parameters
        missing = await self.conn.fetch("""
            SELECT r.id, r.resource_type, r.resource
            FROM fhir.resources r
            WHERE r.resource_type IN ('Condition', 'Observation', 'MedicationRequest', 
                                     'Procedure', 'AllergyIntolerance', 'DiagnosticReport',
                                     'Encounter', 'ServiceRequest', 'CarePlan', 'CareTeam')
            AND (r.deleted = false OR r.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
                AND sp.param_name IN ('patient', 'subject')
            )
            ORDER BY r.resource_type, r.id
        """)
        
        logger.info(f"Found {len(missing)} resources missing patient/subject parameters")
        
        fixed = 0
        for resource in missing:
            # Parse JSON if it's a string
            resource_data = resource['resource']
            if isinstance(resource_data, str):
                resource_data = json.loads(resource_data)
            if await self.index_resource(resource['id'], resource['resource_type'], resource_data):
                fixed += 1
            
            if fixed % 100 == 0:
                logger.info(f"  Fixed {fixed}/{len(missing)} resources")
        
        logger.info(f"✅ Fixed {fixed} resources")
        
        # Verify the fix
        await self.verify_indexing()
    
    async def monitor_health(self):
        """Monitor search parameter health."""
        logger.info("Search Parameter Health Report")
        logger.info("=" * 50)
        
        # Overall statistics
        total_resources = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.resources 
            WHERE deleted = false OR deleted IS NULL
        """)
        
        total_params = await self.conn.fetchval("""
            SELECT COUNT(*) FROM fhir.search_params
        """)
        
        logger.info(f"Total resources: {total_resources}")
        logger.info(f"Total search parameters: {total_params}")
        logger.info(f"Average parameters per resource: {total_params/total_resources:.1f}")
        
        # Resource type breakdown
        logger.info("\nResource Type Breakdown:")
        breakdown = await self.conn.fetch("""
            SELECT r.resource_type, 
                   COUNT(DISTINCT r.id) as resource_count,
                   COUNT(DISTINCT sp.resource_id) as indexed_count,
                   COUNT(sp.*) as param_count
            FROM fhir.resources r
            LEFT JOIN fhir.search_params sp ON r.id = sp.resource_id
            WHERE r.deleted = false OR r.deleted IS NULL
            GROUP BY r.resource_type
            ORDER BY resource_count DESC
        """)
        
        for row in breakdown:
            resource_type = row['resource_type']
            resources = row['resource_count']
            indexed = row['indexed_count']
            params = row['param_count']
            avg_params = params / resources if resources > 0 else 0
            coverage = indexed / resources * 100 if resources > 0 else 0
            
            logger.info(f"  {resource_type:<25} Resources: {resources:>6}  Indexed: {indexed:>6} ({coverage:>5.1f}%)  Params: {params:>8}  Avg/Resource: {avg_params:>4.1f}")
        
        # Critical parameter coverage
        logger.info("\nCritical Parameter Coverage:")
        critical_params = await self.conn.fetch("""
            SELECT param_name, COUNT(DISTINCT resource_id) as coverage
            FROM fhir.search_params
            WHERE param_name IN ('patient', 'subject', 'code', 'status', 'date', '_id')
            GROUP BY param_name
            ORDER BY coverage DESC
        """)
        
        for row in critical_params:
            logger.info(f"  {row['param_name']:<20} {row['coverage']:>8} resources")
        
        # Recent indexing activity
        logger.info("\nRecent Activity:")
        recent = await self.conn.fetch("""
            SELECT DATE(created_at) as index_date, COUNT(*) as params_added
            FROM fhir.search_params
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY index_date DESC
            LIMIT 7
        """)
        
        if recent:
            for row in recent:
                logger.info(f"  {row['index_date']}: {row['params_added']} parameters added")
        else:
            logger.info("  No recent indexing activity")
        
        # Recommendations
        logger.info("\nRecommendations:")
        
        # Check for resources with no parameters
        no_params = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources r
            WHERE (r.deleted = false OR r.deleted IS NULL)
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
            )
        """)
        
        if no_params > 0:
            logger.warning(f"  ⚠️  {no_params} resources have no search parameters - run with --mode fix")
        
        # Check for old resources without recent indexing
        old_unindexed = await self.conn.fetchval("""
            SELECT COUNT(*)
            FROM fhir.resources r
            WHERE (r.deleted = false OR r.deleted IS NULL)
            AND r.created_at < NOW() - INTERVAL '1 day'
            AND NOT EXISTS (
                SELECT 1 FROM fhir.search_params sp
                WHERE sp.resource_id = r.id
                AND sp.created_at > r.created_at - INTERVAL '1 hour'
            )
        """)
        
        if old_unindexed > 0:
            logger.warning(f"  ⚠️  {old_unindexed} older resources may need reindexing")
        
        if no_params == 0 and old_unindexed == 0:
            logger.info("  ✅ Search parameter indexing is healthy")
    
    async def run(self, mode: str = 'index', resource_type: Optional[str] = None):
        """Run the indexer in the specified mode."""
        await self.connect()
        
        try:
            if mode == 'index':
                await self.index_all_resources()
                logger.info(f"\nIndexing complete: {self.stats['indexed']} indexed, {self.stats['skipped']} skipped, {self.stats['errors']} errors")
            
            elif mode == 'reindex':
                if resource_type:
                    await self.reindex_resource_type(resource_type)
                else:
                    await self.index_all_resources()
                logger.info(f"\nReindexing complete: {self.stats['indexed']} indexed, {self.stats['errors']} errors")
            
            elif mode == 'verify':
                await self.verify_indexing()
            
            elif mode == 'fix':
                await self.fix_missing_parameters()
            
            elif mode == 'monitor':
                await self.monitor_health()
            
            else:
                logger.error(f"Unknown mode: {mode}")
                
        finally:
            await self.disconnect()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Consolidated Search Parameter Indexing')
    parser.add_argument('--mode', choices=['index', 'reindex', 'verify', 'fix', 'monitor'], 
                       default='index', help='Operation mode')
    parser.add_argument('--resource-type', help='Specific resource type for reindex mode')
    parser.add_argument('--database-url', help='Database connection URL')
    
    args = parser.parse_args()
    
    indexer = SearchParameterIndexer(database_url=args.database_url)
    await indexer.run(mode=args.mode, resource_type=args.resource_type)


if __name__ == '__main__':
    asyncio.run(main())