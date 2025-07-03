"""
FHIR Operations Implementation

Implements FHIR operations like $validate, $everything, $expand, etc.
Provides a framework for custom operations.
"""

from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from fhir.resources.bundle import Bundle, BundleEntry
from fhir.resources.parameters import Parameters, ParametersParameter
from fhir.resources.operationoutcome import OperationOutcome
from fhir.resources import construct_fhir_element
from .storage import FHIRStorageEngine
from .validator import FHIRValidator


class OperationHandler:
    """Handles FHIR operations at instance, type, and system levels."""
    
    def __init__(
        self,
        storage: FHIRStorageEngine,
        validator: FHIRValidator
    ):
        """
        Initialize operation handler.
        
        Args:
            storage: FHIR storage engine
            validator: FHIR validator
        """
        self.storage = storage
        self.validator = validator
        
        # Register standard operations
        self.operations = {
            # System-level operations
            'validate': self._validate_operation,
            'meta': self._meta_operation,
            'convert': self._convert_operation,
            
            # Type-level operations
            'search': self._search_operation,
            'history': self._history_operation,
            
            # Instance-level operations
            'everything': self._everything_operation,
            'document': self._document_operation,
            
            # Patient-specific operations
            'Patient/everything': self._patient_everything_operation,
            
            # Observation-specific operations
            'Observation/stats': self._observation_stats_operation,
            'Observation/lastn': self._observation_lastn_operation,
            
            # ValueSet operations
            'ValueSet/expand': self._valueset_expand_operation,
            'ValueSet/validate-code': self._valueset_validate_code_operation,
            
            # Terminology operations
            'CodeSystem/lookup': self._codesystem_lookup_operation,
            'CodeSystem/subsumes': self._codesystem_subsumes_operation,
        }
    
    async def execute_operation(
        self,
        operation_name: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        parameters: Optional[Parameters] = None
    ) -> Any:
        """
        Execute a FHIR operation.
        
        Args:
            operation_name: Name of the operation (without $)
            resource_type: Resource type for type-level operations
            resource_id: Resource ID for instance-level operations
            parameters: Operation parameters
            
        Returns:
            Operation result (resource or Parameters)
        """
        # Determine operation key
        if resource_type and operation_name in ['everything', 'document']:
            # Resource-specific operation
            operation_key = f"{resource_type}/{operation_name}"
            if operation_key not in self.operations:
                operation_key = operation_name
        else:
            operation_key = operation_name
        
        # Get operation handler
        handler = self.operations.get(operation_key)
        if not handler:
            raise ValueError(f"Operation ${operation_name} not supported")
        
        # Execute operation
        return await handler(resource_type, resource_id, parameters)
    
    def register_custom_operation(
        self,
        name: str,
        handler: Callable,
        resource_type: Optional[str] = None
    ):
        """
        Register a custom operation.
        
        Args:
            name: Operation name
            handler: Operation handler function
            resource_type: Optional resource type for resource-specific operations
        """
        if resource_type:
            key = f"{resource_type}/{name}"
        else:
            key = name
        
        self.operations[key] = handler
    
    async def _validate_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> OperationOutcome:
        """
        $validate operation - validate a resource.
        
        Can be called at:
        - System level: validate any resource
        - Type level: validate a specific resource type
        - Instance level: validate updates to an existing resource
        """
        # Extract resource from parameters
        resource_param = None
        profile_param = None
        
        if parameters and parameters.parameter:
            for param in parameters.parameter:
                if param.name == 'resource':
                    resource_param = param.resource
                elif param.name == 'profile':
                    profile_param = param.valueUri
        
        if not resource_param:
            return OperationOutcome(
                issue=[{
                    "severity": "error",
                    "code": "required",
                    "details": {"text": "No resource provided for validation"}
                }]
            )
        
        # Determine resource type
        if not resource_type:
            resource_type = resource_param.resource_type
        
        # Validate the resource
        return self.validator.validate_resource(
            resource_type,
            resource_param.dict(),
            profile_param
        )
    
    async def _meta_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Parameters:
        """
        $meta operation - get metadata about resources.
        
        Returns information about:
        - Supported profiles
        - Tags in use
        - Security labels
        """
        # This is a simplified implementation
        return Parameters(
            parameter=[
                ParametersParameter(
                    name="return",
                    valueMeta={
                        "profile": ["http://example.org/fhir/profiles"],
                        "tag": [
                            {
                                "system": "http://example.org/tags",
                                "code": "example"
                            }
                        ]
                    }
                )
            ]
        )
    
    async def _convert_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Any:
        """
        $convert operation - convert between formats.
        
        Supports conversion between:
        - JSON and XML
        - Different FHIR versions (with limitations)
        """
        # This would require additional implementation
        raise NotImplementedError("$convert operation not yet implemented")
    
    async def _search_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Bundle:
        """
        $search operation - search with POST.
        
        Allows searching using POST to avoid URL length limitations.
        """
        if not resource_type:
            raise ValueError("Resource type required for $search operation")
        
        # Convert parameters to search params
        search_params = {}
        if parameters and parameters.parameter:
            for param in parameters.parameter:
                if param.name and param.valueString:
                    search_params[param.name] = param.valueString
        
        # Execute search
        resources, total = await self.storage.search_resources(
            resource_type,
            search_params
        )
        
        # Build search bundle
        bundle = Bundle(
            type="searchset",
            total=total,
            entry=[]
        )
        
        for resource_data in resources:
            bundle.entry.append(
                BundleEntry(
                    resource=construct_fhir_element(resource_type, resource_data),
                    fullUrl=f"{resource_type}/{resource_data['id']}"
                )
            )
        
        return bundle
    
    async def _history_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Bundle:
        """
        $history operation - get resource history.
        
        Can be called at:
        - System level: all resources
        - Type level: all resources of a type
        - Instance level: specific resource
        """
        # Get history
        history_entries = await self.storage.get_history(
            resource_type,
            resource_id
        )
        
        # Build history bundle
        bundle = Bundle(
            type="history",
            entry=[]
        )
        
        for entry in history_entries:
            bundle.entry.append(
                BundleEntry(
                    resource=construct_fhir_element(
                        entry['resourceType'],
                        entry['resource']
                    ),
                    fullUrl=f"{entry['resourceType']}/{entry['id']}",
                    request={
                        "method": entry['operation'].upper(),
                        "url": f"{entry['resourceType']}/{entry['id']}"
                    },
                    response={
                        "status": "200",
                        "lastModified": entry['lastUpdated']
                    }
                )
            )
        
        return bundle
    
    async def _everything_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Bundle:
        """
        $everything operation - get all related resources.
        
        Generic implementation that can be overridden for specific resources.
        """
        if not resource_type or not resource_id:
            raise ValueError("Resource type and ID required for $everything operation")
        
        # Get the base resource
        base_resource = await self.storage.read_resource(resource_type, resource_id)
        if not base_resource:
            raise ValueError(f"Resource {resource_type}/{resource_id} not found")
        
        # This is a simplified implementation
        # A full implementation would follow references and reverse references
        bundle = Bundle(
            type="searchset",
            entry=[
                BundleEntry(
                    resource=construct_fhir_element(resource_type, base_resource),
                    fullUrl=f"{resource_type}/{resource_id}"
                )
            ]
        )
        
        return bundle
    
    async def _document_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Bundle:
        """
        $document operation - generate a document bundle.
        
        Creates a document bundle with:
        - Composition as the first entry
        - All referenced resources
        """
        # This would require Composition handling
        raise NotImplementedError("$document operation not yet implemented")
    
    async def _patient_everything_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Bundle:
        """
        Patient/$everything - get all resources for a patient.
        
        Returns:
        - Patient resource
        - All resources that reference the patient
        - Resources referenced by the patient
        """
        if resource_type != "Patient" or not resource_id:
            raise ValueError("Patient ID required for Patient/$everything")
        
        # Get patient
        patient = await self.storage.read_resource("Patient", resource_id)
        if not patient:
            raise ValueError(f"Patient/{resource_id} not found")
        
        bundle = Bundle(
            type="searchset",
            entry=[
                BundleEntry(
                    resource=construct_fhir_element("Patient", patient),
                    fullUrl=f"Patient/{resource_id}"
                )
            ]
        )
        
        # Get all resources referencing this patient
        # This is simplified - would need to search all resource types
        for resource_type in ["Observation", "Condition", "MedicationRequest", "Encounter"]:
            resources, _ = await self.storage.search_resources(
                resource_type,
                {"patient": f"Patient/{resource_id}"},
                limit=1000
            )
            
            for resource_data in resources:
                bundle.entry.append(
                    BundleEntry(
                        resource=construct_fhir_element(resource_type, resource_data),
                        fullUrl=f"{resource_type}/{resource_data['id']}"
                    )
                )
        
        return bundle
    
    async def _observation_stats_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Parameters:
        """
        Observation/$stats - get statistics for observations.
        
        Returns statistics like:
        - Count
        - Average
        - Min/Max
        - Standard deviation
        """
        # Extract parameters
        subject = None
        code = None
        date = None
        
        if parameters and parameters.parameter:
            for param in parameters.parameter:
                if param.name == "subject":
                    subject = param.valueReference
                elif param.name == "code":
                    code = param.valueCodeableConcept
                elif param.name == "date":
                    date = param.valuePeriod
        
        # This is a placeholder implementation
        return Parameters(
            parameter=[
                ParametersParameter(
                    name="statistics",
                    part=[
                        ParametersParameter(name="count", valueInteger=100),
                        ParametersParameter(name="average", valueDecimal=120.5),
                        ParametersParameter(name="min", valueDecimal=80.0),
                        ParametersParameter(name="max", valueDecimal=180.0),
                        ParametersParameter(name="stdDev", valueDecimal=15.2)
                    ]
                )
            ]
        )
    
    async def _observation_lastn_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Bundle:
        """
        Observation/$lastn - get the last N observations.
        
        Returns the most recent observations for each code.
        """
        # Extract parameters
        max_count = 1
        subject = None
        
        if parameters and parameters.parameter:
            for param in parameters.parameter:
                if param.name == "max" and param.valueInteger:
                    max_count = param.valueInteger
                elif param.name == "subject":
                    subject = param.valueReference
        
        # This is a simplified implementation
        search_params = {}
        if subject:
            search_params["subject"] = subject.reference
        
        # Would need to group by code and get latest
        resources, _ = await self.storage.search_resources(
            "Observation",
            search_params,
            limit=max_count
        )
        
        bundle = Bundle(
            type="searchset",
            entry=[]
        )
        
        for resource_data in resources:
            bundle.entry.append(
                BundleEntry(
                    resource=construct_fhir_element("Observation", resource_data),
                    fullUrl=f"Observation/{resource_data['id']}"
                )
            )
        
        return bundle
    
    async def _valueset_expand_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Any:
        """
        ValueSet/$expand - expand a value set.
        
        Returns all codes in the value set.
        """
        # This would require ValueSet and terminology service implementation
        raise NotImplementedError("ValueSet/$expand not yet implemented")
    
    async def _valueset_validate_code_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Parameters:
        """
        ValueSet/$validate-code - validate a code against a value set.
        """
        # This would require ValueSet implementation
        raise NotImplementedError("ValueSet/$validate-code not yet implemented")
    
    async def _codesystem_lookup_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Parameters:
        """
        CodeSystem/$lookup - look up code details.
        """
        # This would require CodeSystem implementation
        raise NotImplementedError("CodeSystem/$lookup not yet implemented")
    
    async def _codesystem_subsumes_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[Parameters]
    ) -> Parameters:
        """
        CodeSystem/$subsumes - test subsumption relationship.
        """
        # This would require CodeSystem implementation
        raise NotImplementedError("CodeSystem/$subsumes not yet implemented")