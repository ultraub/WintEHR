"""
Test FHIR R4 Chained Search Implementation

Tests cover:
- Simple chained searches (e.g., Patient?general-practitioner.name=Smith)
- Type-specific chains (e.g., Observation?subject:Patient.name=John)
- Multi-level chains (e.g., Organization?partOf.name=Hospital)
- Various parameter types in chains
"""

import pytest
import json
from datetime import datetime
from sqlalchemy.orm import Session
from fhir.models.resource import FHIRResource
from fhir.core.search.basic import SearchParameterHandler
from fhir.core.fhir_store import FHIRStore
from tests.test_utils import create_test_patient, create_test_practitioner, create_test_organization


class TestChainedSearches:
    """Test suite for FHIR chained search functionality."""
    
    @pytest.fixture
    def search_handler(self):
        """Create a search parameter handler with common definitions."""
        definitions = {
            'Patient': {
                'general-practitioner': {'type': 'reference', 'target': ['Practitioner', 'Organization']},
                'organization': {'type': 'reference', 'target': ['Organization']},
                'link': {'type': 'reference', 'target': ['Patient', 'RelatedPerson']}
            },
            'Observation': {
                'patient': {'type': 'reference', 'target': ['Patient']},
                'subject': {'type': 'reference', 'target': ['Patient', 'Group', 'Device', 'Location']},
                'performer': {'type': 'reference', 'target': ['Practitioner', 'Organization']},
                'encounter': {'type': 'reference', 'target': ['Encounter']}
            },
            'MedicationRequest': {
                'patient': {'type': 'reference', 'target': ['Patient']},
                'subject': {'type': 'reference', 'target': ['Patient', 'Group']},
                'requester': {'type': 'reference', 'target': ['Practitioner', 'Organization']},
                'encounter': {'type': 'reference', 'target': ['Encounter']}
            },
            'Organization': {
                'partOf': {'type': 'reference', 'target': ['Organization']}
            },
            'Practitioner': {
                'name': {'type': 'string'},
                'family': {'type': 'string'},
                'given': {'type': 'string'},
                'identifier': {'type': 'token'}
            }
        }
        return SearchParameterHandler(definitions)
    
    @pytest.fixture
    def setup_test_data(self, db_session: Session):
        """Set up test data for chained searches."""
        # Create practitioners
        practitioner1 = FHIRResource(
            id="prac-1",
            fhir_id="practitioner-1",
            resource_type="Practitioner",
            resource={
                "resourceType": "Practitioner",
                "id": "practitioner-1",
                "name": [{
                    "family": "Smith",
                    "given": ["John"],
                    "text": "Dr. John Smith"
                }],
                "identifier": [{
                    "system": "http://hospital.org/practitioners",
                    "value": "12345"
                }]
            }
        )
        
        practitioner2 = FHIRResource(
            id="prac-2",
            fhir_id="practitioner-2",
            resource_type="Practitioner",
            resource={
                "resourceType": "Practitioner",
                "id": "practitioner-2",
                "name": [{
                    "family": "Johnson",
                    "given": ["Sarah"],
                    "text": "Dr. Sarah Johnson"
                }]
            }
        )
        
        # Create organizations
        org1 = FHIRResource(
            id="org-1",
            fhir_id="organization-1",
            resource_type="Organization",
            resource={
                "resourceType": "Organization",
                "id": "organization-1",
                "name": "City Hospital",
                "identifier": [{
                    "system": "http://hospital.org",
                    "value": "CH001"
                }]
            }
        )
        
        org2 = FHIRResource(
            id="org-2",
            fhir_id="organization-2",
            resource_type="Organization",
            resource={
                "resourceType": "Organization",
                "id": "organization-2",
                "name": "Regional Health Network",
                "partOf": {
                    "reference": "Organization/organization-1"
                }
            }
        )
        
        # Create patients
        patient1 = FHIRResource(
            id="pat-1",
            fhir_id="patient-1",
            resource_type="Patient",
            resource={
                "resourceType": "Patient",
                "id": "patient-1",
                "name": [{
                    "family": "Doe",
                    "given": ["John"],
                    "text": "John Doe"
                }],
                "birthDate": "1970-01-01",
                "generalPractitioner": [{
                    "reference": "Practitioner/practitioner-1"
                }]
            }
        )
        
        patient2 = FHIRResource(
            id="pat-2",
            fhir_id="patient-2",
            resource_type="Patient",
            resource={
                "resourceType": "Patient",
                "id": "patient-2",
                "name": [{
                    "family": "Doe",
                    "given": ["Jane"],
                    "text": "Jane Doe"
                }],
                "birthDate": "1975-05-15",
                "generalPractitioner": [{
                    "reference": "Practitioner/practitioner-2"
                }],
                "managingOrganization": {
                    "reference": "Organization/organization-2"
                }
            }
        )
        
        # Create observations
        obs1 = FHIRResource(
            id="obs-1",
            fhir_id="observation-1",
            resource_type="Observation",
            resource={
                "resourceType": "Observation",
                "id": "observation-1",
                "status": "final",
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8867-4",
                        "display": "Heart rate"
                    }]
                },
                "subject": {
                    "reference": "Patient/patient-1"
                },
                "performer": [{
                    "reference": "Practitioner/practitioner-1"
                }],
                "valueQuantity": {
                    "value": 72,
                    "unit": "beats/minute"
                }
            }
        )
        
        obs2 = FHIRResource(
            id="obs-2",
            fhir_id="observation-2",
            resource_type="Observation",
            resource={
                "resourceType": "Observation",
                "id": "observation-2",
                "status": "final",
                "code": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "8867-4",
                        "display": "Heart rate"
                    }]
                },
                "subject": {
                    "reference": "Patient/patient-2"
                },
                "performer": [{
                    "reference": "Practitioner/practitioner-2"
                }],
                "valueQuantity": {
                    "value": 68,
                    "unit": "beats/minute"
                }
            }
        )
        
        # Create medication requests
        med_req1 = FHIRResource(
            id="med-1",
            fhir_id="medicationrequest-1",
            resource_type="MedicationRequest",
            resource={
                "resourceType": "MedicationRequest",
                "id": "medicationrequest-1",
                "status": "active",
                "intent": "order",
                "subject": {
                    "reference": "Patient/patient-1"
                },
                "requester": {
                    "reference": "Practitioner/practitioner-1"
                },
                "medicationCodeableConcept": {
                    "coding": [{
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "1049502",
                        "display": "Aspirin 81 MG"
                    }]
                }
            }
        )
        
        # Add all resources to database
        db_session.add_all([
            practitioner1, practitioner2,
            org1, org2,
            patient1, patient2,
            obs1, obs2,
            med_req1
        ])
        db_session.commit()
        
        return {
            'practitioners': [practitioner1, practitioner2],
            'organizations': [org1, org2],
            'patients': [patient1, patient2],
            'observations': [obs1, obs2],
            'medication_requests': [med_req1]
        }
    
    def test_parse_simple_chained_parameter(self, search_handler):
        """Test parsing simple chained parameters."""
        # Test simple chain
        chain_parts, resource_type = search_handler._parse_chained_parameter('general-practitioner.name')
        assert chain_parts == ['general-practitioner', 'name']
        assert resource_type is None
        
        # Test multiple levels
        chain_parts, resource_type = search_handler._parse_chained_parameter('organization.partOf.name')
        assert chain_parts == ['organization', 'partOf', 'name']
        assert resource_type is None
        
        # Test non-chained parameter
        chain_parts, resource_type = search_handler._parse_chained_parameter('name')
        assert chain_parts == ['name']
        assert resource_type is None
    
    def test_parse_type_specific_chained_parameter(self, search_handler):
        """Test parsing type-specific chained parameters."""
        # Test with resource type modifier
        chain_parts, resource_type = search_handler._parse_chained_parameter('subject:Patient.name')
        assert chain_parts == ['subject', 'name']
        assert resource_type == 'Patient'
        
        # Test with different resource type
        chain_parts, resource_type = search_handler._parse_chained_parameter('performer:Practitioner.identifier')
        assert chain_parts == ['performer', 'identifier']
        assert resource_type == 'Practitioner'
    
    def test_simple_chained_search_by_name(self, search_handler, setup_test_data, db_session):
        """Test simple chained search: Patient?general-practitioner.name=Smith"""
        # Parse parameters
        params = {'general-practitioner.name': 'Smith'}
        parsed_params, _ = search_handler.parse_search_params('Patient', params)
        
        # Verify parsing
        assert 'general-practitioner.name' in parsed_params
        param_data = parsed_params['general-practitioner.name']
        assert param_data['type'] == 'chained'
        assert param_data['name'] == 'general-practitioner'
        assert param_data['chain'] == ['name']
        
        # Build query
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Patient', parsed_params)
        
        # Execute query
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find patient-1 who has Dr. Smith as GP
        assert len(results) == 1
        assert results[0].fhir_id == 'patient-1'
    
    def test_type_specific_chained_search(self, search_handler, setup_test_data, db_session):
        """Test type-specific chained search: Observation?subject:Patient.name=John"""
        params = {'subject:Patient.name': 'John'}
        parsed_params, _ = search_handler.parse_search_params('Observation', params)
        
        # Verify parsing
        param_data = parsed_params['subject:Patient.name']
        assert param_data['type'] == 'chained'
        assert param_data['resource_type_modifier'] == 'Patient'
        
        # Build and execute query
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Observation', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find observation-1 for patient John Doe
        assert len(results) == 1
        assert results[0].fhir_id == 'observation-1'
    
    def test_chained_search_by_family_name(self, search_handler, setup_test_data, db_session):
        """Test chained search by family name: Observation?patient.family=Doe"""
        params = {'patient.family': 'Doe'}
        parsed_params, _ = search_handler.parse_search_params('Observation', params)
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Observation', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find both observations for Doe patients
        assert len(results) == 2
        fhir_ids = {r.fhir_id for r in results}
        assert fhir_ids == {'observation-1', 'observation-2'}
    
    def test_chained_search_by_birthdate(self, search_handler, setup_test_data, db_session):
        """Test chained search by birthdate: Observation?patient.birthdate=1970-01-01"""
        params = {'patient.birthdate': '1970-01-01'}
        parsed_params, _ = search_handler.parse_search_params('Observation', params)
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Observation', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find only observation-1 for patient born on 1970-01-01
        assert len(results) == 1
        assert results[0].fhir_id == 'observation-1'
    
    def test_chained_search_by_identifier(self, search_handler, setup_test_data, db_session):
        """Test chained search by identifier: Patient?general-practitioner.identifier=12345"""
        params = {'general-practitioner.identifier': '12345'}
        parsed_params, _ = search_handler.parse_search_params('Patient', params)
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Patient', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find patient-1 who has practitioner with identifier 12345
        assert len(results) == 1
        assert results[0].fhir_id == 'patient-1'
    
    def test_multi_level_chained_search(self, search_handler, setup_test_data, db_session):
        """Test multi-level chained search: Patient?managingOrganization.partOf.name=City Hospital"""
        params = {'managingOrganization.partOf.name': 'City Hospital'}
        parsed_params, _ = search_handler.parse_search_params('Patient', params)
        
        # Verify parsing
        param_data = parsed_params['managingOrganization.partOf.name']
        assert param_data['type'] == 'chained'
        assert param_data['chain'] == ['partOf', 'name']
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Patient', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find patient-2 who is managed by org-2 which is part of org-1 (City Hospital)
        assert len(results) == 1
        assert results[0].fhir_id == 'patient-2'
    
    def test_chained_search_no_results(self, search_handler, setup_test_data, db_session):
        """Test chained search that returns no results."""
        params = {'general-practitioner.name': 'NonExistentDoctor'}
        parsed_params, _ = search_handler.parse_search_params('Patient', params)
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Patient', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Patient'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find no results
        assert len(results) == 0
    
    def test_multiple_chained_parameters(self, search_handler, setup_test_data, db_session):
        """Test multiple chained parameters in one search."""
        params = {
            'subject.family': 'Doe',
            'performer.family': 'Smith'
        }
        parsed_params, _ = search_handler.parse_search_params('Observation', params)
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query('Observation', parsed_params)
        
        query = f"""
            SELECT r.* FROM fhir.resources r
            {' '.join(join_clauses)}
            WHERE r.resource_type = 'Observation'
            AND r.deleted = false
            AND {' AND '.join(where_clauses)}
        """
        
        results = db_session.execute(query, sql_params).fetchall()
        
        # Should find observation-1 (John Doe's observation by Dr. Smith)
        assert len(results) == 1
        assert results[0].fhir_id == 'observation-1'
    
    def test_chained_search_with_regular_parameters(self, search_handler, setup_test_data, db_session):
        """Test chained search combined with regular parameters."""
        params = {
            'code': '8867-4',  # Regular token parameter
            'subject.family': 'Doe'  # Chained parameter
        }
        
        # Add code parameter definition
        search_handler.definitions['Observation']['code'] = {'type': 'token'}
        
        parsed_params, _ = search_handler.parse_search_params('Observation', params)
        
        # Should have both parameters parsed
        assert 'code' in parsed_params
        assert 'subject.family' in parsed_params
        assert parsed_params['code']['type'] == 'token'
        assert parsed_params['subject.family']['type'] == 'chained'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])