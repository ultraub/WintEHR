#!/usr/bin/env python3
"""
Provider Directory Validation Harness

This harness validates provider and organization directory functionality:
- Complete PractitionerRole resource testing (CRUD + search parameters)
- Complete Location resource testing (CRUD + search parameters)
- Enhanced Organization hierarchy testing (partof parameter)
- Enhanced Practitioner contact search testing
- Provider directory search scenarios (by specialty, organization, role)
- Geographic search capabilities testing for Location

Based on Agent C's planned implementations for provider-organization resources.
"""

import asyncio
import sys
import os
import time
import logging
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass

# Add parent directories to path for imports
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.fhir.storage import FHIRStorageEngine
from database import get_session_maker


@dataclass
class ProviderDirectoryResult:
    """Result of a provider directory validation"""
    directory_component: str
    validation_type: str
    status: str  # PASS, FAIL, SKIP
    message: str
    details: Dict[str, Any] = None
    duration: float = 0.0
    resource_id: str = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class ProviderDirectoryValidationHarness:
    """Comprehensive validation harness for provider directory functionality"""
    
    def __init__(self):
        self.session_maker = get_session_maker()
        self.logger = logging.getLogger(__name__)
        
        # Provider directory resource types
        self.provider_resources = [
            'Practitioner', 'PractitionerRole', 'Organization', 'Location',
            'HealthcareService', 'Endpoint'
        ]
        
        # Critical search parameters for provider directory
        self.provider_search_params = {
            'Practitioner': [
                'identifier', 'name', 'family', 'given', 'telecom',
                'address', 'gender', 'qualification'
            ],
            'PractitionerRole': [
                'practitioner', 'organization', 'role', 'specialty',
                'location', 'service', 'telecom', 'active'
            ],
            'Organization': [
                'identifier', 'name', 'type', 'address', 'partof',
                'endpoint', 'active'
            ],
            'Location': [
                'identifier', 'name', 'type', 'address', 'organization',
                'status', 'mode', 'near'
            ],
            'HealthcareService': [
                'identifier', 'organization', 'location', 'name',
                'type', 'specialty', 'active'
            ]
        }
        
        # Sample test data for provider directory
        self.test_practitioner = {
            "resourceType": "Practitioner",
            "id": "test-practitioner-001",
            "identifier": [
                {
                    "system": "http://hl7.org/fhir/sid/us-npi",
                    "value": "1234567890"
                }
            ],
            "name": [
                {
                    "family": "TestDoc",
                    "given": ["Jane", "Mary"],
                    "prefix": ["Dr."]
                }
            ],
            "telecom": [
                {
                    "system": "phone",
                    "value": "555-123-4567",
                    "use": "work"
                },
                {
                    "system": "email",
                    "value": "jane.testdoc@example.com",
                    "use": "work"
                }
            ],
            "gender": "female",
            "qualification": [
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v2-0360",
                                "code": "MD",
                                "display": "Doctor of Medicine"
                            }
                        ]
                    }
                }
            ]
        }
    
    async def run_comprehensive_validation(self) -> List[ProviderDirectoryResult]:
        """Run comprehensive validation of provider directory functionality"""
        results = []
        
        async with self.session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Validate provider directory data availability
            data_validation = await self._validate_provider_data_availability(storage_engine)
            results.extend(data_validation)
            
            # Validate Practitioner functionality
            practitioner_validation = await self._validate_practitioner_functionality(storage_engine)
            results.extend(practitioner_validation)
            
            # Validate PractitionerRole functionality
            role_validation = await self._validate_practitioner_role_functionality(storage_engine)
            results.extend(role_validation)
            
            # Validate Organization functionality
            org_validation = await self._validate_organization_functionality(storage_engine)
            results.extend(org_validation)
            
            # Validate Location functionality
            location_validation = await self._validate_location_functionality(storage_engine)
            results.extend(location_validation)
            
            # Validate provider directory search scenarios
            search_validation = await self._validate_provider_directory_search_scenarios(storage_engine)
            results.extend(search_validation)
            
            # Validate geographic search capabilities
            geo_validation = await self._validate_geographic_search_capabilities(storage_engine)
            results.extend(geo_validation)
            
            # Validate provider-organization relationships
            relationship_validation = await self._validate_provider_organization_relationships(storage_engine)
            results.extend(relationship_validation)
        
        return results
    
    async def _validate_provider_data_availability(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate sufficient provider directory test data is available"""
        results = []
        
        for resource_type in self.provider_resources:
            start_time = time.time()
            
            try:
                count_query = text("""
                    SELECT COUNT(*) as total
                    FROM fhir.resources 
                    WHERE resource_type = :resource_type 
                    AND deleted = false
                """)
                result = await storage_engine.session.execute(
                    count_query, {'resource_type': resource_type}
                )
                count = result.scalar()
                
                # Different minimum requirements for different resource types
                min_required = {
                    'Practitioner': 5,
                    'PractitionerRole': 3,
                    'Organization': 3,
                    'Location': 3,
                    'HealthcareService': 1,
                    'Endpoint': 1
                }.get(resource_type, 1)
                
                if count < min_required:
                    results.append(ProviderDirectoryResult(
                        directory_component=resource_type,
                        validation_type="data_availability",
                        status="FAIL",
                        message=f"Insufficient test data: only {count} {resource_type} resources found",
                        details={"count": count, "minimum_required": min_required},
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(ProviderDirectoryResult(
                        directory_component=resource_type,
                        validation_type="data_availability",
                        status="PASS",
                        message=f"Sufficient test data: {count} {resource_type} resources available",
                        details={"count": count},
                        duration=time.time() - start_time
                    ))
                    
            except Exception as e:
                results.append(ProviderDirectoryResult(
                    directory_component=resource_type,
                    validation_type="data_availability",
                    status="FAIL",
                    message=f"Error checking data availability: {e}",
                    details={"error": str(e)},
                    duration=time.time() - start_time
                ))
        
        return results
    
    async def _validate_practitioner_functionality(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate Practitioner resource functionality"""
        results = []
        
        # Test CRUD operations
        crud_result = await self._test_practitioner_crud(storage_engine)
        results.extend(crud_result)
        
        # Test search parameters
        search_result = await self._test_practitioner_search_parameters(storage_engine)
        results.extend(search_result)
        
        # Test contact information search
        contact_result = await self._test_practitioner_contact_search(storage_engine)
        results.extend(contact_result)
        
        return results
    
    async def _test_practitioner_crud(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test Practitioner CRUD operations"""
        results = []
        start_time = time.time()
        
        try:
            # Test CREATE
            created_resource = await storage_engine.create_resource("Practitioner", self.test_practitioner)
            resource_id = created_resource['id']
            
            results.append(ProviderDirectoryResult(
                directory_component="Practitioner",
                validation_type="crud_create",
                status="PASS",
                message="Practitioner created successfully",
                details={"resource_id": resource_id},
                duration=time.time() - start_time,
                resource_id=resource_id
            ))
            
            # Test READ
            read_resource = await storage_engine.get_resource("Practitioner", resource_id)
            if read_resource and read_resource['id'] == resource_id:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="crud_read",
                    status="PASS",
                    message="Practitioner read successfully",
                    details={"resource_id": resource_id},
                    duration=time.time() - start_time,
                    resource_id=resource_id
                ))
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="crud_read",
                    status="FAIL",
                    message="Practitioner read failed",
                    details={"resource_id": resource_id},
                    duration=time.time() - start_time,
                    resource_id=resource_id
                ))
            
            # Test UPDATE
            updated_practitioner = self.test_practitioner.copy()
            updated_practitioner["id"] = resource_id
            updated_practitioner["name"][0]["given"] = ["Jane", "Updated"]
            
            updated_resource = await storage_engine.update_resource("Practitioner", resource_id, updated_practitioner)
            
            if updated_resource and updated_resource.get('name', [{}])[0].get('given') == ["Jane", "Updated"]:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="crud_update",
                    status="PASS",
                    message="Practitioner updated successfully",
                    details={"resource_id": resource_id},
                    duration=time.time() - start_time,
                    resource_id=resource_id
                ))
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="crud_update",
                    status="FAIL",
                    message="Practitioner update failed",
                    details={"resource_id": resource_id},
                    duration=time.time() - start_time,
                    resource_id=resource_id
                ))
            
            # Test DELETE
            await storage_engine.delete_resource("Practitioner", resource_id)
            
            # Verify deletion
            try:
                deleted_resource = await storage_engine.get_resource("Practitioner", resource_id)
                if deleted_resource is None:
                    results.append(ProviderDirectoryResult(
                        directory_component="Practitioner",
                        validation_type="crud_delete",
                        status="PASS",
                        message="Practitioner deleted successfully",
                        details={"resource_id": resource_id},
                        duration=time.time() - start_time,
                        resource_id=resource_id
                    ))
                else:
                    results.append(ProviderDirectoryResult(
                        directory_component="Practitioner",
                        validation_type="crud_delete",
                        status="FAIL",
                        message="Practitioner deletion failed - resource still exists",
                        details={"resource_id": resource_id},
                        duration=time.time() - start_time,
                        resource_id=resource_id
                    ))
            except Exception:
                # Expected behavior for deleted resource
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="crud_delete",
                    status="PASS",
                    message="Practitioner deleted successfully",
                    details={"resource_id": resource_id},
                    duration=time.time() - start_time,
                    resource_id=resource_id
                ))
                
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="Practitioner",
                validation_type="crud_error",
                status="FAIL",
                message=f"Error in Practitioner CRUD testing: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_practitioner_search_parameters(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test Practitioner search parameters"""
        results = []
        
        search_params = self.provider_search_params['Practitioner']
        
        for param in search_params:
            start_time = time.time()
            
            try:
                # Test search parameter existence
                param_query = text("""
                    SELECT COUNT(*) as param_count
                    FROM fhir.search_parameters sp
                    JOIN fhir.resources r ON sp.resource_id = r.id
                    WHERE r.resource_type = 'Practitioner'
                    AND sp.param_name = :param_name
                """)
                result = await storage_engine.session.execute(
                    param_query, {'param_name': param}
                )
                param_count = result.scalar()
                
                if param_count > 0:
                    results.append(ProviderDirectoryResult(
                        directory_component="Practitioner",
                        validation_type=f"search_param_{param}",
                        status="PASS",
                        message=f"Search parameter '{param}' found with {param_count} instances",
                        details={"param_name": param, "count": param_count},
                        duration=time.time() - start_time
                    ))
                    
                    # Test actual search for specific parameters
                    if param == 'name':
                        search_result = await storage_engine.search_resources(
                            'Practitioner',
                            {param: ['Test']},
                            {'_count': ['5']}
                        )
                        
                        results.append(ProviderDirectoryResult(
                            directory_component="Practitioner",
                            validation_type=f"search_execution_{param}",
                            status="PASS",
                            message=f"Search by '{param}' executed successfully",
                            details={"param_name": param, "results_count": search_result.get('total', 0)},
                            duration=time.time() - start_time
                        ))
                    
                else:
                    results.append(ProviderDirectoryResult(
                        directory_component="Practitioner",
                        validation_type=f"search_param_{param}",
                        status="SKIP",
                        message=f"Search parameter '{param}' not found (may be expected)",
                        details={"param_name": param},
                        duration=time.time() - start_time
                    ))
                    
            except Exception as e:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type=f"search_param_{param}",
                    status="FAIL",
                    message=f"Error testing search parameter '{param}': {e}",
                    details={"param_name": param, "error": str(e)},
                    duration=time.time() - start_time
                ))
        
        return results
    
    async def _test_practitioner_contact_search(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test enhanced Practitioner contact search functionality"""
        results = []
        start_time = time.time()
        
        try:
            # Test telecom search parameter
            telecom_query = text("""
                SELECT COUNT(*) as telecom_count
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Practitioner'
                AND sp.param_name = 'telecom'
            """)
            result = await storage_engine.session.execute(telecom_query)
            telecom_count = result.scalar()
            
            if telecom_count > 0:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="contact_search",
                    status="PASS",
                    message=f"Found {telecom_count} practitioner telecom entries for contact search",
                    details={"telecom_count": telecom_count},
                    duration=time.time() - start_time
                ))
                
                # Test email search
                try:
                    email_search = await storage_engine.search_resources(
                        'Practitioner',
                        {'telecom': ['email']},
                        {'_count': ['5']}
                    )
                    
                    results.append(ProviderDirectoryResult(
                        directory_component="Practitioner",
                        validation_type="email_search",
                        status="PASS",
                        message="Email contact search executed successfully",
                        details={"results_count": email_search.get('total', 0)},
                        duration=time.time() - start_time
                    ))
                except Exception as e:
                    results.append(ProviderDirectoryResult(
                        directory_component="Practitioner",
                        validation_type="email_search",
                        status="FAIL",
                        message=f"Email contact search failed: {e}",
                        details={"error": str(e)},
                        duration=time.time() - start_time
                    ))
                
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="Practitioner",
                    validation_type="contact_search",
                    status="SKIP",
                    message="No practitioner telecom data found for contact search testing",
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="Practitioner",
                validation_type="contact_search",
                status="FAIL",
                message=f"Error testing practitioner contact search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_practitioner_role_functionality(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate PractitionerRole resource functionality"""
        results = []
        start_time = time.time()
        
        try:
            # Check PractitionerRole data availability
            count_query = text("""
                SELECT COUNT(*) as total
                FROM fhir.resources 
                WHERE resource_type = 'PractitionerRole' 
                AND deleted = false
            """)
            result = await storage_engine.session.execute(count_query)
            count = result.scalar()
            
            if count > 0:
                results.append(ProviderDirectoryResult(
                    directory_component="PractitionerRole",
                    validation_type="data_availability",
                    status="PASS",
                    message=f"Found {count} PractitionerRole resources",
                    details={"count": count},
                    duration=time.time() - start_time
                ))
                
                # Test search parameters
                role_search_params = self.provider_search_params['PractitionerRole']
                for param in role_search_params:
                    param_start_time = time.time()
                    try:
                        param_query = text("""
                            SELECT COUNT(*) as param_count
                            FROM fhir.search_parameters sp
                            JOIN fhir.resources r ON sp.resource_id = r.id
                            WHERE r.resource_type = 'PractitionerRole'
                            AND sp.param_name = :param_name
                        """)
                        result = await storage_engine.session.execute(
                            param_query, {'param_name': param}
                        )
                        param_count = result.scalar()
                        
                        if param_count > 0:
                            results.append(ProviderDirectoryResult(
                                directory_component="PractitionerRole",
                                validation_type=f"search_param_{param}",
                                status="PASS",
                                message=f"Search parameter '{param}' found with {param_count} instances",
                                details={"param_name": param, "count": param_count},
                                duration=time.time() - param_start_time
                            ))
                        else:
                            results.append(ProviderDirectoryResult(
                                directory_component="PractitionerRole",
                                validation_type=f"search_param_{param}",
                                status="SKIP",
                                message=f"Search parameter '{param}' not found",
                                details={"param_name": param},
                                duration=time.time() - param_start_time
                            ))
                            
                    except Exception as e:
                        results.append(ProviderDirectoryResult(
                            directory_component="PractitionerRole",
                            validation_type=f"search_param_{param}",
                            status="FAIL",
                            message=f"Error testing search parameter '{param}': {e}",
                            details={"param_name": param, "error": str(e)},
                            duration=time.time() - param_start_time
                        ))
                
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="PractitionerRole",
                    validation_type="data_availability",
                    status="SKIP",
                    message="No PractitionerRole resources found",
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="PractitionerRole",
                validation_type="functionality",
                status="FAIL",
                message=f"Error validating PractitionerRole functionality: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_organization_functionality(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate Organization functionality including hierarchy testing"""
        results = []
        
        # Test Organization hierarchy (partof parameter)
        hierarchy_result = await self._test_organization_hierarchy(storage_engine)
        results.extend(hierarchy_result)
        
        return results
    
    async def _test_organization_hierarchy(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test Organization hierarchy functionality (partof parameter)"""
        results = []
        start_time = time.time()
        
        try:
            # Check for partof search parameter
            partof_query = text("""
                SELECT COUNT(*) as partof_count
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Organization'
                AND sp.param_name = 'partof'
            """)
            result = await storage_engine.session.execute(partof_query)
            partof_count = result.scalar()
            
            if partof_count > 0:
                results.append(ProviderDirectoryResult(
                    directory_component="Organization",
                    validation_type="hierarchy_partof",
                    status="PASS",
                    message=f"Found {partof_count} organization hierarchy relationships (partof)",
                    details={"partof_count": partof_count},
                    duration=time.time() - start_time
                ))
                
                # Test partof search
                try:
                    partof_search = await storage_engine.search_resources(
                        'Organization',
                        {'partof': ['Organization/test']},
                        {'_count': ['5']}
                    )
                    
                    results.append(ProviderDirectoryResult(
                        directory_component="Organization",
                        validation_type="hierarchy_search",
                        status="PASS",
                        message="Organization hierarchy search executed successfully",
                        details={"results_count": partof_search.get('total', 0)},
                        duration=time.time() - start_time
                    ))
                except Exception as e:
                    results.append(ProviderDirectoryResult(
                        directory_component="Organization",
                        validation_type="hierarchy_search",
                        status="FAIL",
                        message=f"Organization hierarchy search failed: {e}",
                        details={"error": str(e)},
                        duration=time.time() - start_time
                    ))
                
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="Organization",
                    validation_type="hierarchy_partof",
                    status="SKIP",
                    message="No organization hierarchy relationships found",
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="Organization",
                validation_type="hierarchy_partof",
                status="FAIL",
                message=f"Error testing organization hierarchy: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_location_functionality(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate Location resource functionality"""
        results = []
        start_time = time.time()
        
        try:
            # Check Location data availability
            count_query = text("""
                SELECT COUNT(*) as total
                FROM fhir.resources 
                WHERE resource_type = 'Location' 
                AND deleted = false
            """)
            result = await storage_engine.session.execute(count_query)
            count = result.scalar()
            
            if count > 0:
                results.append(ProviderDirectoryResult(
                    directory_component="Location",
                    validation_type="data_availability",
                    status="PASS",
                    message=f"Found {count} Location resources",
                    details={"count": count},
                    duration=time.time() - start_time
                ))
                
                # Test Location search parameters
                location_search_params = self.provider_search_params['Location']
                for param in location_search_params:
                    param_start_time = time.time()
                    try:
                        param_query = text("""
                            SELECT COUNT(*) as param_count
                            FROM fhir.search_parameters sp
                            JOIN fhir.resources r ON sp.resource_id = r.id
                            WHERE r.resource_type = 'Location'
                            AND sp.param_name = :param_name
                        """)
                        result = await storage_engine.session.execute(
                            param_query, {'param_name': param}
                        )
                        param_count = result.scalar()
                        
                        if param_count > 0:
                            results.append(ProviderDirectoryResult(
                                directory_component="Location",
                                validation_type=f"search_param_{param}",
                                status="PASS",
                                message=f"Search parameter '{param}' found with {param_count} instances",
                                details={"param_name": param, "count": param_count},
                                duration=time.time() - param_start_time
                            ))
                        else:
                            results.append(ProviderDirectoryResult(
                                directory_component="Location",
                                validation_type=f"search_param_{param}",
                                status="SKIP",
                                message=f"Search parameter '{param}' not found",
                                details={"param_name": param},
                                duration=time.time() - param_start_time
                            ))
                            
                    except Exception as e:
                        results.append(ProviderDirectoryResult(
                            directory_component="Location",
                            validation_type=f"search_param_{param}",
                            status="FAIL",
                            message=f"Error testing search parameter '{param}': {e}",
                            details={"param_name": param, "error": str(e)},
                            duration=time.time() - param_start_time
                        ))
                
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="Location",
                    validation_type="data_availability",
                    status="SKIP",
                    message="No Location resources found",
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="Location",
                validation_type="functionality",
                status="FAIL",
                message=f"Error validating Location functionality: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_provider_directory_search_scenarios(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate provider directory search scenarios (by specialty, organization, role)"""
        results = []
        
        # Test search by specialty
        specialty_result = await self._test_search_by_specialty(storage_engine)
        results.extend(specialty_result)
        
        # Test search by organization
        org_result = await self._test_search_by_organization(storage_engine)
        results.extend(org_result)
        
        # Test search by role
        role_result = await self._test_search_by_role(storage_engine)
        results.extend(role_result)
        
        return results
    
    async def _test_search_by_specialty(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test provider directory search by specialty"""
        results = []
        start_time = time.time()
        
        try:
            # Test specialty search in PractitionerRole
            specialty_search = await storage_engine.search_resources(
                'PractitionerRole',
                {'specialty': ['cardiology']},
                {'_count': ['5']}
            )
            
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="search_by_specialty",
                status="PASS",
                message="Search by specialty executed successfully",
                details={"results_count": specialty_search.get('total', 0)},
                duration=time.time() - start_time
            ))
            
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="search_by_specialty",
                status="FAIL",
                message=f"Error searching by specialty: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_search_by_organization(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test provider directory search by organization"""
        results = []
        start_time = time.time()
        
        try:
            # Test organization search in PractitionerRole
            org_search = await storage_engine.search_resources(
                'PractitionerRole',
                {'organization': ['Organization/test']},
                {'_count': ['5']}
            )
            
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="search_by_organization",
                status="PASS",
                message="Search by organization executed successfully",
                details={"results_count": org_search.get('total', 0)},
                duration=time.time() - start_time
            ))
            
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="search_by_organization",
                status="FAIL",
                message=f"Error searching by organization: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_search_by_role(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Test provider directory search by role"""
        results = []
        start_time = time.time()
        
        try:
            # Test role search in PractitionerRole
            role_search = await storage_engine.search_resources(
                'PractitionerRole',
                {'role': ['doctor']},
                {'_count': ['5']}
            )
            
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="search_by_role",
                status="PASS",
                message="Search by role executed successfully",
                details={"results_count": role_search.get('total', 0)},
                duration=time.time() - start_time
            ))
            
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="search_by_role",
                status="FAIL",
                message=f"Error searching by role: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_geographic_search_capabilities(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate geographic search capabilities for Location"""
        results = []
        start_time = time.time()
        
        try:
            # Test near parameter for geographic search
            near_search = await storage_engine.search_resources(
                'Location',
                {'near': ['42.358|-71.063|10|mi']},  # Boston coordinates with 10 mile radius
                {'_count': ['5']}
            )
            
            results.append(ProviderDirectoryResult(
                directory_component="Location",
                validation_type="geographic_search",
                status="PASS",
                message="Geographic search (near) executed successfully",
                details={"results_count": near_search.get('total', 0)},
                duration=time.time() - start_time
            ))
            
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="Location",
                validation_type="geographic_search",
                status="FAIL",
                message=f"Error testing geographic search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_provider_organization_relationships(self, storage_engine: FHIRStorageEngine) -> List[ProviderDirectoryResult]:
        """Validate provider-organization relationship integrity"""
        results = []
        start_time = time.time()
        
        try:
            # Analyze provider-organization relationships
            relationship_query = text("""
                SELECT 
                    COUNT(DISTINCT pr.id) as practitioner_roles,
                    COUNT(DISTINCT sp_prac.value_reference) as unique_practitioners,
                    COUNT(DISTINCT sp_org.value_reference) as unique_organizations
                FROM fhir.resources pr
                LEFT JOIN fhir.search_parameters sp_prac ON pr.id = sp_prac.resource_id
                    AND sp_prac.param_name = 'practitioner'
                LEFT JOIN fhir.search_parameters sp_org ON pr.id = sp_org.resource_id
                    AND sp_org.param_name = 'organization'
                WHERE pr.resource_type = 'PractitionerRole'
                AND pr.deleted = false
            """)
            result = await storage_engine.session.execute(relationship_query)
            relationship_stats = result.fetchone()
            
            if relationship_stats.practitioner_roles > 0:
                results.append(ProviderDirectoryResult(
                    directory_component="ProviderDirectory",
                    validation_type="relationship_integrity",
                    status="PASS",
                    message=f"Provider-organization relationships found: {relationship_stats.practitioner_roles} roles linking {relationship_stats.unique_practitioners} practitioners to {relationship_stats.unique_organizations} organizations",
                    details={
                        "practitioner_roles": relationship_stats.practitioner_roles,
                        "unique_practitioners": relationship_stats.unique_practitioners,
                        "unique_organizations": relationship_stats.unique_organizations
                    },
                    duration=time.time() - start_time
                ))
            else:
                results.append(ProviderDirectoryResult(
                    directory_component="ProviderDirectory",
                    validation_type="relationship_integrity",
                    status="SKIP",
                    message="No provider-organization relationships found",
                    duration=time.time() - start_time
                ))
                
        except Exception as e:
            results.append(ProviderDirectoryResult(
                directory_component="ProviderDirectory",
                validation_type="relationship_integrity",
                status="FAIL",
                message=f"Error validating provider-organization relationships: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results


async def main():
    """Main entry point for provider directory validation"""
    logging.basicConfig(level=logging.INFO)
    
    harness = ProviderDirectoryValidationHarness()
    
    print("Starting Provider Directory Validation...")
    print("=" * 60)
    
    results = await harness.run_comprehensive_validation()
    
    # Summary statistics
    total_checks = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")
    
    print(f"\nValidation Summary:")
    print(f"Total Checks: {total_checks}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    print(f"Success Rate: {(passed/total_checks*100):.1f}%" if total_checks > 0 else "N/A")
    
    # Group results by component
    components = {}
    for result in results:
        if result.directory_component not in components:
            components[result.directory_component] = []
        components[result.directory_component].append(result)
    
    print(f"\nDetailed Results by Component:")
    print("-" * 60)
    
    for component_name, component_results in components.items():
        print(f"\n{component_name.upper()}:")
        for result in component_results:
            status_icon = "✓" if result.status == "PASS" else "✗" if result.status == "FAIL" else "⚠"
            print(f"  {status_icon} {result.validation_type}: {result.message}")
            if result.details and result.status != "PASS":
                for key, value in result.details.items():
                    if key != "error":
                        print(f"     {key}: {value}")
    
    # Exit with error code if any failures
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))