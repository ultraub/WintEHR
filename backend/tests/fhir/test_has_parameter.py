"""
Test suite for FHIR _has parameter (reverse chaining).

Tests the implementation of reverse chaining search functionality
according to FHIR R4 specifications.
"""

import pytest
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Tuple
from unittest.mock import MagicMock, patch

from fhir.core.search.basic import SearchParameterHandler


class TestHasParameter:
    """Test _has parameter functionality."""
    
    @pytest.fixture
    def search_handler(self):
        """Create a SearchParameterHandler instance."""
        return SearchParameterHandler()
    
    def test_parse_simple_has_parameter(self, search_handler):
        """Test parsing a simple _has parameter."""
        raw_params = {
            '_has:Observation:patient:code': '1234-5'
        }
        
        search_params, _ = search_handler.parse_search_params('Patient', raw_params)
        
        assert '_has:Observation:patient:code' in search_params
        assert search_params['_has:Observation:patient:code']['type'] == '_has'
        assert search_params['_has:Observation:patient:code']['values'] == ['1234-5']
    
    def test_parse_has_with_system_and_code(self, search_handler):
        """Test parsing _has parameter with system|code format."""
        raw_params = {
            '_has:Observation:patient:code': 'http://loinc.org|8480-6'
        }
        
        search_params, _ = search_handler.parse_search_params('Patient', raw_params)
        
        assert '_has:Observation:patient:code' in search_params
        assert search_params['_has:Observation:patient:code']['values'] == ['http://loinc.org|8480-6']
    
    def test_parse_nested_has_parameter(self, search_handler):
        """Test parsing nested _has parameter."""
        raw_params = {
            '_has:Observation:patient:_has:AuditEvent:entity:type': 'rest'
        }
        
        search_params, _ = search_handler.parse_search_params('Patient', raw_params)
        
        assert '_has:Observation:patient:_has:AuditEvent:entity:type' in search_params
        assert search_params['_has:Observation:patient:_has:AuditEvent:entity:type']['type'] == '_has'
    
    def test_build_simple_has_clause(self, search_handler):
        """Test building SQL for simple _has parameter."""
        search_params = {
            '_has:Observation:patient:code': {
                'type': '_has',
                'values': ['1234-5']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        # Should have one WHERE clause for _has
        assert len(where_clauses) == 1
        where_clause = where_clauses[0]
        
        # Check the WHERE clause structure
        assert 'EXISTS' in where_clause
        assert 'resource_type = \'Observation\'' in where_clause
        assert 'deleted = false' in where_clause
        
        # Check SQL parameters
        assert any('has_value' in key for key in sql_params.keys())
    
    def test_build_has_clause_with_token_search(self, search_handler):
        """Test _has with token search (system|code)."""
        search_params = {
            '_has:Observation:patient:code': {
                'type': '_has',
                'values': ['http://loinc.org|8480-6']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should handle system and code separately
        assert 'has_system' in str(sql_params)
        assert 'has_code' in str(sql_params)
        assert sql_params[next(k for k in sql_params if 'system' in k)] == 'http://loinc.org'
        assert sql_params[next(k for k in sql_params if 'code' in k and 'system' not in k)] == '8480-6'
    
    def test_build_has_clause_with_status(self, search_handler):
        """Test _has with status search."""
        search_params = {
            '_has:Encounter:patient:status': {
                'type': '_has',
                'values': ['finished']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should search on status field
        assert "resource->>'status'" in where_clause
        assert sql_params[next(k for k in sql_params if 'has_value' in k)] == 'finished'
    
    def test_build_has_clause_with_identifier(self, search_handler):
        """Test _has with identifier search."""
        search_params = {
            '_has:Patient:managingOrganization:identifier': {
                'type': '_has',
                'values': ['12345']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Organization', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should search in identifier array
        assert 'identifier' in where_clause
        assert 'jsonb_array_elements' in where_clause
        assert sql_params[next(k for k in sql_params if 'has_value' in k)] == '12345'
    
    def test_build_has_clause_with_date(self, search_handler):
        """Test _has with date search."""
        search_params = {
            '_has:Observation:patient:date': {
                'type': '_has',
                'values': ['ge2024-01-01']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should handle date comparison
        assert "resource->>'date'" in where_clause
        assert '>=' in where_clause
        assert 'has_date_start' in str(sql_params)
    
    def test_build_nested_has_clause(self, search_handler):
        """Test building nested _has clause."""
        search_params = {
            '_has:Observation:patient:_has:AuditEvent:entity:type': {
                'type': '_has',
                'values': ['rest']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should have nested EXISTS clauses
        assert where_clause.count('EXISTS') >= 2
        assert 'Observation' in where_clause
        assert 'AuditEvent' in where_clause
        assert 'has_outer' in where_clause
        assert 'has_inner' in where_clause
    
    def test_multiple_has_parameters(self, search_handler):
        """Test multiple _has parameters in same search."""
        search_params = {
            '_has:Observation:patient:code': {
                'type': '_has',
                'values': ['1234-5']
            },
            '_has:Encounter:patient:status': {
                'type': '_has',
                'values': ['finished']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        # Should have two WHERE clauses
        assert len(where_clauses) == 2
        
        # Check both conditions are present
        combined = ' '.join(where_clauses)
        assert 'Observation' in combined
        assert 'Encounter' in combined
    
    def test_has_with_multiple_values(self, search_handler):
        """Test _has parameter with multiple values (OR condition)."""
        search_params = {
            '_has:Observation:patient:code': {
                'type': '_has',
                'values': ['1234-5', '5678-9']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should have OR between values
        assert ' OR ' in where_clause
        assert 'has_0_0' in where_clause
        assert 'has_0_1' in where_clause
    
    def test_has_reference_condition_formats(self, search_handler):
        """Test that _has handles different reference formats."""
        # Create a mock instance to test the reference condition builder
        handler = search_handler
        condition = handler._build_has_reference_condition('alias1', 'patient')
        
        # Should handle multiple reference formats
        assert 'r.resource_type || \'/\' || r.fhir_id' in condition
        assert '\'urn:uuid:\' || r.fhir_id' in condition
        assert 'r.fhir_id' in condition
    
    def test_has_with_category_search(self, search_handler):
        """Test _has with category (CodeableConcept) search."""
        search_params = {
            '_has:Observation:patient:category': {
                'type': '_has',
                'values': ['laboratory']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should search in category.coding array
        assert 'category' in where_clause
        assert 'coding' in where_clause
        assert sql_params[next(k for k in sql_params if 'has_value' in k)] == 'laboratory'
    
    def test_invalid_has_parameter_format(self, search_handler):
        """Test invalid _has parameter format returns safe SQL."""
        search_params = {
            '_has:InvalidFormat': {
                'type': '_has',
                'values': ['value']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        # Should return safe "1=1" for invalid format
        assert len(where_clauses) == 1
        assert where_clauses[0] == "1=1"
    
    def test_has_with_id_search(self, search_handler):
        """Test _has with _id search parameter."""
        search_params = {
            '_has:Observation:patient:_id': {
                'type': '_has',
                'values': ['obs-123']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should search on fhir_id
        assert 'fhir_id' in where_clause
        assert sql_params[next(k for k in sql_params if 'has_value' in k)] == 'obs-123'
    
    def test_has_with_generic_string_search(self, search_handler):
        """Test _has with generic string parameter."""
        search_params = {
            '_has:Practitioner:organization:name': {
                'type': '_has',
                'values': ['Smith']
            }
        }
        
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Organization', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should use ILIKE for generic string search
        assert 'ILIKE' in where_clause
        assert "resource->>'name'" in where_clause
        assert sql_params[next(k for k in sql_params if 'has_value' in k)] == '%Smith%'


class TestHasParameterIntegration:
    """Integration tests for _has parameter with real-world scenarios."""
    
    @pytest.fixture
    def search_handler(self):
        """Create a SearchParameterHandler instance."""
        return SearchParameterHandler()
    
    def test_patient_with_specific_lab_results(self, search_handler):
        """Find patients with specific lab results."""
        raw_params = {
            '_has:Observation:patient:code': 'http://loinc.org|8480-6',
            '_has:Observation:patient:category': 'laboratory'
        }
        
        search_params, _ = search_handler.parse_search_params('Patient', raw_params)
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Patient', search_params
        )
        
        # Should have two separate _has conditions
        assert len(where_clauses) == 2
        combined = ' '.join(where_clauses)
        assert 'laboratory' in str(sql_params.values())
        assert '8480-6' in str(sql_params.values())
    
    def test_organization_with_patient_blood_samples(self, search_handler):
        """Find organizations with patients who have blood samples."""
        raw_params = {
            '_has:Patient:managingOrganization:_has:Specimen:subject:type': 'blood'
        }
        
        search_params, _ = search_handler.parse_search_params('Organization', raw_params)
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Organization', search_params
        )
        
        where_clause = where_clauses[0]
        
        # Should have nested EXISTS for Patient and Specimen
        assert 'Patient' in where_clause
        assert 'Specimen' in where_clause
        assert where_clause.count('EXISTS') >= 2
    
    def test_practitioner_with_finished_encounters(self, search_handler):
        """Find practitioners with finished encounters."""
        raw_params = {
            '_has:Encounter:participant:status': 'finished',
            '_has:Encounter:participant:class': 'outpatient'
        }
        
        search_params, _ = search_handler.parse_search_params('Practitioner', raw_params)
        join_clauses, where_clauses, sql_params = search_handler.build_search_query(
            'Practitioner', search_params
        )
        
        # Should have two separate conditions
        assert len(where_clauses) == 2
        assert 'finished' in str(sql_params.values())
        assert 'outpatient' in str(sql_params.values())
    
    def test_combined_regular_and_has_parameters(self, search_handler):
        """Test combination of regular search and _has parameters."""
        raw_params = {
            'name': 'Smith',
            '_has:Observation:patient:code': '1234-5'
        }
        
        search_params, _ = search_handler.parse_search_params('Patient', raw_params)
        
        # Should have both regular and _has parameters
        assert 'name' in search_params
        assert '_has:Observation:patient:code' in search_params
        assert search_params['name']['type'] != '_has'
        assert search_params['_has:Observation:patient:code']['type'] == '_has'