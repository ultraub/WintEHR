"""
DocumentReference Search Parameter Enhancement Test Harness

This test harness validates the enhanced DocumentReference search parameters
implementation according to FHIR R4 specification.

Tests cover:
- Missing search parameters: category, facility, period, relatesto, security-label
- Enhanced content search with format and size parameters  
- Document workflow status tracking
- Clinical document categorization
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Any

from fhir.core.storage import FHIRStorageEngine
from fhir.models.resources import FHIRResource
from sqlalchemy.ext.asyncio import AsyncSession


class TestDocumentReferenceSearchEnhancement:
    """Test harness for DocumentReference search parameter enhancements."""
    
    @pytest.fixture
    async def storage_engine(self, async_session: AsyncSession):
        """Create storage engine instance."""
        return FHIRStorageEngine(async_session)
    
    @pytest.fixture
    def sample_document_references(self) -> List[Dict[str, Any]]:
        """Create sample DocumentReference resources for testing."""
        return [
            {
                "resourceType": "DocumentReference",
                "status": "current",
                "docStatus": "final",
                "type": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "34109-9",
                        "display": "Note"
                    }]
                },
                "category": [{
                    "coding": [{
                        "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                        "code": "clinical-note",
                        "display": "Clinical Note"
                    }]
                }],
                "subject": {"reference": "Patient/test-patient-123"},
                "date": "2025-07-14T10:00:00Z",
                "author": [{"reference": "Practitioner/test-provider-456"}],
                "context": {
                    "encounter": [{"reference": "Encounter/test-encounter-789"}],
                    "facilityType": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                            "code": "HOSP",
                            "display": "Hospital"
                        }]
                    },
                    "period": {
                        "start": "2025-07-14T09:00:00Z",
                        "end": "2025-07-14T11:00:00Z"
                    }
                },
                "content": [{
                    "attachment": {
                        "contentType": "application/json",
                        "size": 1024,
                        "title": "Clinical Progress Note",
                        "data": "eyJub3RlIjogIlBhdGllbnQgaXMgZG9pbmcgd2VsbCJ9"  # base64 encoded
                    },
                    "format": {
                        "system": "http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem",
                        "code": "urn:ihe:pcc:xphr:2007",
                        "display": "Personal Health Records"
                    }
                }],
                "securityLabel": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                        "code": "N",
                        "display": "Normal"
                    }]
                }],
                "relatesTo": [{
                    "code": "replaces",
                    "target": {"reference": "DocumentReference/previous-note-001"}
                }]
            },
            {
                "resourceType": "DocumentReference",
                "status": "current",
                "docStatus": "preliminary",
                "type": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": "18842-5",
                        "display": "Discharge Summary"
                    }]
                },
                "category": [{
                    "coding": [{
                        "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                        "code": "discharge-summary",
                        "display": "Discharge Summary"
                    }]
                }],
                "subject": {"reference": "Patient/test-patient-456"},
                "date": "2025-07-14T14:00:00Z",
                "author": [{"reference": "Practitioner/test-provider-789"}],
                "context": {
                    "encounter": [{"reference": "Encounter/test-encounter-456"}],
                    "facilityType": {
                        "coding": [{
                            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                            "code": "AMB",
                            "display": "Ambulatory"
                        }]
                    },
                    "period": {
                        "start": "2025-07-14T13:00:00Z",
                        "end": "2025-07-14T15:00:00Z"
                    }
                },
                "content": [{
                    "attachment": {
                        "contentType": "text/plain",
                        "size": 2048,
                        "title": "Discharge Summary Document"
                    },
                    "format": {
                        "system": "http://ihe.net/fhir/ValueSet/IHE.FormatCode.codesystem",
                        "code": "urn:ihe:pcc:xds-ms:2007",
                        "display": "Medical Summaries"
                    }
                }],
                "securityLabel": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                        "code": "R",
                        "display": "Restricted"
                    }]
                }]
            }
        ]
    
    async def test_enhanced_search_parameter_definitions(self, storage_engine: FHIRStorageEngine):
        """Test that DocumentReference has all required FHIR R4 search parameters."""
        search_params = storage_engine._get_search_parameter_definitions()
        
        # Verify DocumentReference search parameters exist
        assert 'DocumentReference' in search_params
        doc_params = search_params['DocumentReference']
        
        # Test existing parameters
        assert 'patient' in doc_params
        assert 'encounter' in doc_params
        assert 'type' in doc_params
        assert 'category' in doc_params
        assert 'date' in doc_params
        assert 'author' in doc_params
        assert 'status' in doc_params
        
        # Test enhanced parameters
        assert 'facility' in doc_params
        assert 'period' in doc_params
        assert 'relatesto' in doc_params
        assert 'security-label' in doc_params
        assert 'content-format' in doc_params
        assert 'content-size' in doc_params
        
        # Verify parameter types
        assert doc_params['category']['type'] == 'token'
        assert doc_params['facility']['type'] == 'token'
        assert doc_params['period']['type'] == 'date'
        assert doc_params['relatesto']['type'] == 'reference'
        assert doc_params['security-label']['type'] == 'token'
        assert doc_params['content-format']['type'] == 'token'
        assert doc_params['content-size']['type'] == 'quantity'
    
    async def test_category_search_parameter(
        self, 
        storage_engine: FHIRStorageEngine, 
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by category parameter."""
        
        # Create test documents
        doc_ids = []
        for doc_data in sample_document_references:
            fhir_id, version_id, last_updated = await storage_engine.create_resource(
                'DocumentReference', doc_data
            )
            doc_ids.append(fhir_id)
        
        # Test category search
        clinical_notes, total = await storage_engine.search_resources(
            'DocumentReference',
            {'category': 'clinical-note'}
        )
        
        assert total == 1
        assert len(clinical_notes) == 1
        assert clinical_notes[0]['category'][0]['coding'][0]['code'] == 'clinical-note'
        
        # Test multiple category search
        discharge_summaries, total = await storage_engine.search_resources(
            'DocumentReference',
            {'category': 'discharge-summary'}
        )
        
        assert total == 1
        assert len(discharge_summaries) == 1
        assert discharge_summaries[0]['category'][0]['coding'][0]['code'] == 'discharge-summary'
    
    async def test_facility_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by facility parameter."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test facility search
        hospital_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'facility': 'HOSP'}
        )
        
        assert total == 1
        assert hospital_docs[0]['context']['facilityType']['coding'][0]['code'] == 'HOSP'
        
        # Test ambulatory facility search
        ambulatory_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'facility': 'AMB'}
        )
        
        assert total == 1
        assert ambulatory_docs[0]['context']['facilityType']['coding'][0]['code'] == 'AMB'
    
    async def test_period_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by period parameter."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test period range search
        morning_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {
                'period': 'ge2025-07-14T09:00:00Z',
                'period': 'le2025-07-14T12:00:00Z'
            }
        )
        
        assert total == 1
        period_start = morning_docs[0]['context']['period']['start']
        assert '09:00:00' in period_start
        
        # Test afternoon period search
        afternoon_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {
                'period': 'ge2025-07-14T13:00:00Z',
                'period': 'le2025-07-14T16:00:00Z'
            }
        )
        
        assert total == 1
        period_start = afternoon_docs[0]['context']['period']['start']
        assert '13:00:00' in period_start
    
    async def test_relatesto_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by relatesTo parameter."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test relatesTo search
        related_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'relatesto': 'DocumentReference/previous-note-001'}
        )
        
        assert total == 1
        assert related_docs[0]['relatesTo'][0]['target']['reference'] == 'DocumentReference/previous-note-001'
        assert related_docs[0]['relatesTo'][0]['code'] == 'replaces'
    
    async def test_security_label_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by security-label parameter."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test normal security level search
        normal_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'security-label': 'N'}
        )
        
        assert total == 1
        assert normal_docs[0]['securityLabel'][0]['coding'][0]['code'] == 'N'
        
        # Test restricted security level search
        restricted_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'security-label': 'R'}
        )
        
        assert total == 1
        assert restricted_docs[0]['securityLabel'][0]['coding'][0]['code'] == 'R'
    
    async def test_content_format_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by content format parameter."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test PHR format search
        phr_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'content-format': 'urn:ihe:pcc:xphr:2007'}
        )
        
        assert total == 1
        assert phr_docs[0]['content'][0]['format']['code'] == 'urn:ihe:pcc:xphr:2007'
        
        # Test medical summaries format search
        summary_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'content-format': 'urn:ihe:pcc:xds-ms:2007'}
        )
        
        assert total == 1
        assert summary_docs[0]['content'][0]['format']['code'] == 'urn:ihe:pcc:xds-ms:2007'
    
    async def test_content_size_search_parameter(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search by content size parameter."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test size range search (small documents)
        small_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'content-size': 'le1500'}
        )
        
        assert total == 1
        assert small_docs[0]['content'][0]['attachment']['size'] <= 1500
        
        # Test size range search (larger documents)
        large_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'content-size': 'ge1500'}
        )
        
        assert total == 1
        assert large_docs[0]['content'][0]['attachment']['size'] >= 1500
    
    async def test_combined_search_parameters(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference search with multiple enhanced parameters."""
        
        # Create test documents
        for doc_data in sample_document_references:
            await storage_engine.create_resource('DocumentReference', doc_data)
        
        # Test combined search: category + facility + security-label
        hospital_clinical_notes, total = await storage_engine.search_resources(
            'DocumentReference',
            {
                'category': 'clinical-note',
                'facility': 'HOSP',
                'security-label': 'N'
            }
        )
        
        assert total == 1
        doc = hospital_clinical_notes[0]
        assert doc['category'][0]['coding'][0]['code'] == 'clinical-note'
        assert doc['context']['facilityType']['coding'][0]['code'] == 'HOSP'
        assert doc['securityLabel'][0]['coding'][0]['code'] == 'N'
    
    async def test_workflow_status_integration(
        self,
        storage_engine: FHIRStorageEngine,
        sample_document_references: List[Dict[str, Any]]
    ):
        """Test DocumentReference workflow status tracking."""
        
        # Create document with preliminary status
        preliminary_doc = sample_document_references[1].copy()
        preliminary_doc['docStatus'] = 'preliminary'
        
        doc_id, version_id, last_updated = await storage_engine.create_resource(
            'DocumentReference', preliminary_doc
        )
        
        # Search for preliminary documents
        preliminary_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'doc-status': 'preliminary'}
        )
        
        assert total == 1
        assert preliminary_docs[0]['docStatus'] == 'preliminary'
        
        # Update to final status
        preliminary_doc['docStatus'] = 'final'
        updated_id, updated_version, updated_time = await storage_engine.update_resource(
            'DocumentReference', doc_id, preliminary_doc
        )
        
        # Search for final documents
        final_docs, total = await storage_engine.search_resources(
            'DocumentReference',
            {'doc-status': 'final'}
        )
        
        assert total == 1
        assert final_docs[0]['docStatus'] == 'final'
        assert final_docs[0]['meta']['versionId'] == '2'
    
    async def test_clinical_document_categorization(
        self,
        storage_engine: FHIRStorageEngine
    ):
        """Test clinical document categorization with workflow integration."""
        
        # Create documents of different categories
        document_types = [
            {
                "category_code": "clinical-note",
                "type_code": "34109-9",
                "workflow_priority": "routine"
            },
            {
                "category_code": "discharge-summary", 
                "type_code": "18842-5",
                "workflow_priority": "urgent"
            },
            {
                "category_code": "lab-report",
                "type_code": "11502-2",
                "workflow_priority": "stat"
            }
        ]
        
        created_docs = []
        for doc_type in document_types:
            doc_data = {
                "resourceType": "DocumentReference",
                "status": "current",
                "docStatus": "final",
                "type": {
                    "coding": [{
                        "system": "http://loinc.org",
                        "code": doc_type["type_code"],
                        "display": "Test Document"
                    }]
                },
                "category": [{
                    "coding": [{
                        "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                        "code": doc_type["category_code"],
                        "display": doc_type["category_code"].replace('-', ' ').title()
                    }]
                }],
                "subject": {"reference": "Patient/test-patient-123"},
                "date": "2025-07-14T10:00:00Z",
                "content": [{
                    "attachment": {
                        "contentType": "text/plain",
                        "title": f"Test {doc_type['category_code']}"
                    }
                }]
            }
            
            doc_id, _, _ = await storage_engine.create_resource('DocumentReference', doc_data)
            created_docs.append((doc_id, doc_type))
        
        # Test categorization search
        for category in ['clinical-note', 'discharge-summary', 'lab-report']:
            category_docs, total = await storage_engine.search_resources(
                'DocumentReference',
                {'category': category}
            )
            
            assert total == 1
            assert category_docs[0]['category'][0]['coding'][0]['code'] == category

    async def test_search_parameter_validation(self, storage_engine: FHIRStorageEngine):
        """Test validation of enhanced search parameters."""
        
        # Test invalid parameter values
        with pytest.raises(ValueError):
            await storage_engine.search_resources(
                'DocumentReference',
                {'content-size': 'invalid-quantity'}
            )
        
        # Test invalid date format
        with pytest.raises(ValueError):
            await storage_engine.search_resources(
                'DocumentReference', 
                {'period': 'invalid-date'}
            )
        
        # Test valid parameter combinations
        results, total = await storage_engine.search_resources(
            'DocumentReference',
            {
                'category': 'clinical-note',
                'content-size': 'ge100',
                'period': 'ge2025-01-01'
            }
        )
        
        # Should not raise error with valid parameters
        assert isinstance(results, list)
        assert isinstance(total, int)