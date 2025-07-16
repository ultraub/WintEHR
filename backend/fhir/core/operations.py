"""
FHIR Operations Implementation

Implements FHIR operations like $validate, $everything, $expand, etc.
Provides a framework for custom operations.
"""

from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from fhir.core.resources_r4b import Bundle, BundleEntry, Parameters, OperationOutcome, construct_fhir_element
from fhir.core.resources_r4b import ParametersParameter
from fhir.core.storage import FHIRStorageEngine, safe_dict_conversion
from fhir.core.validators.validator import FHIRValidator


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
        parameters: Optional[dict] = None
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
        parameters: Optional[dict]
    ) -> dict:
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
            safe_dict_conversion(resource_param),
            profile_param
        )
    
    async def _meta_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> Any:
        """
        $convert operation - convert between formats.
        
        Supports conversion between:
        - JSON and XML
        - Different FHIR versions (with limitations)
        """
        # Basic implementation for training purposes
        if not parameters:
            return Parameters(
                parameter=[
                    ParametersParameter(
                        name="outcome",
                        valueString="No conversion parameters provided"
                    )
                ]
            )
        
        # Extract input resource and target format
        input_resource = None
        target_format = "json"  # Default
        
        for param in parameters.parameter or []:
            if param.name == "input":
                input_resource = param.resource
            elif param.name == "format":
                target_format = param.valueString
        
        if not input_resource:
            return Parameters(
                parameter=[
                    ParametersParameter(
                        name="outcome",
                        valueString="No input resource provided for conversion"
                    )
                ]
            )
        
        # For training purposes, return the same resource (identity conversion)
        return Parameters(
            parameter=[
                ParametersParameter(
                    name="result",
                    resource=input_resource
                ),
                ParametersParameter(
                    name="outcome",
                    valueString=f"Converted to {target_format} format (training mode)"
                )
            ]
        )
    
    async def _search_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> dict:
        """
        $document operation - generate a document bundle.
        
        Creates a document bundle with:
        - Composition as the first entry
        - All referenced resources
        """
        if resource_type != "Composition" or not resource_id:
            raise ValueError("$document operation requires a Composition resource ID")
        
        # Get the composition
        composition = await self.storage.read_resource("Composition", resource_id)
        if not composition:
            raise ValueError(f"Composition {resource_id} not found")
        
        # Create document bundle
        bundle = Bundle(
            id=f"document-{resource_id}",
            type="document",
            timestamp=datetime.utcnow().isoformat(),
            entry=[]
        )
        
        # Add composition as first entry
        bundle.entry.append(
            BundleEntry(
                resource=composition,
                fullUrl=f"urn:uuid:{composition.id}"
            )
        )
        
        # For training purposes, add a simple document note
        bundle.entry.append(
            BundleEntry(
                resource={
                    "resourceType": "DocumentReference",
                    "id": f"doc-ref-{resource_id}",
                    "status": "current",
                    "type": {
                        "coding": [{
                            "system": "http://loinc.org",
                            "code": "11488-4",
                            "display": "Consult note"
                        }]
                    },
                    "subject": composition.get("subject"),
                    "date": datetime.utcnow().isoformat(),
                    "description": "Generated document bundle (training mode)"
                },
                fullUrl=f"urn:uuid:doc-ref-{resource_id}"
            )
        )
        
        return bundle
    
    async def _patient_everything_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> dict:
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
        parameters: Optional[dict]
    ) -> Any:
        """
        ValueSet/$expand - expand a value set.
        
        Returns all codes in the value set.
        """
        # Basic implementation for training purposes
        # Extract parameters
        url = None
        filter_param = None
        count = 100  # Default limit
        
        if parameters:
            for param in parameters.parameter or []:
                if param.name == "url":
                    url = param.valueUri
                elif param.name == "filter":
                    filter_param = param.valueString
                elif param.name == "count":
                    count = param.valueInteger
        
        # Create a basic expanded ValueSet
        expansion = {
            "identifier": f"expansion-{datetime.utcnow().isoformat()}",
            "timestamp": datetime.utcnow().isoformat(),
            "total": 3,  # Training example
            "contains": [
                {
                    "system": "http://loinc.org",
                    "code": "2339-0",
                    "display": "Glucose"
                },
                {
                    "system": "http://loinc.org", 
                    "code": "38483-4",
                    "display": "Creatinine"
                },
                {
                    "system": "http://loinc.org",
                    "code": "2947-0", 
                    "display": "Sodium"
                }
            ]
        }
        
        return {
            "resourceType": "ValueSet",
            "id": resource_id or "training-valueset",
            "url": url or "http://example.org/training/valueset",
            "status": "active",
            "expansion": expansion
        }
    
    async def _valueset_validate_code_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[dict]
    ) -> dict:
        """
        ValueSet/$validate-code - validate a code against a value set.
        """
        # Basic implementation for training purposes
        code = None
        system = None
        display = None
        
        if parameters:
            for param in parameters.parameter or []:
                if param.name == "code":
                    code = param.valueCode
                elif param.name == "system":
                    system = param.valueUri
                elif param.name == "display":
                    display = param.valueString
        
        # For training, validate common medical codes
        valid_codes = {
            "http://loinc.org": ["2339-0", "38483-4", "2947-0"],
            "http://snomed.info/sct": ["44054006", "59621000", "271737000"]
        }
        
        is_valid = system in valid_codes and code in valid_codes[system]
        
        return Parameters(
            parameter=[
                ParametersParameter(
                    name="result",
                    valueBoolean=is_valid
                ),
                ParametersParameter(
                    name="message",
                    valueString=f"Code {code} {'is valid' if is_valid else 'is not valid'} in system {system}"
                )
            ]
        )
    
    async def _codesystem_lookup_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[dict]
    ) -> dict:
        """
        CodeSystem/$lookup - look up code details.
        """
        # Basic implementation for training purposes
        code = None
        system = None
        
        if parameters:
            for param in parameters.parameter or []:
                if param.name == "code":
                    code = param.valueCode
                elif param.name == "system":
                    system = param.valueUri
        
        # Training code lookup data
        code_info = {
            "http://loinc.org": {
                "2339-0": {"display": "Glucose", "definition": "Glucose measurement"},
                "38483-4": {"display": "Creatinine", "definition": "Creatinine measurement"},
                "2947-0": {"display": "Sodium", "definition": "Sodium measurement"}
            },
            "http://snomed.info/sct": {
                "44054006": {"display": "Diabetes mellitus", "definition": "A metabolic disorder"},
                "59621000": {"display": "Hypertension", "definition": "High blood pressure"},
                "271737000": {"display": "Anemia", "definition": "Low hemoglobin"}
            }
        }
        
        if system in code_info and code in code_info[system]:
            info = code_info[system][code]
            return Parameters(
                parameter=[
                    ParametersParameter(
                        name="name",
                        valueString=f"Training CodeSystem for {system}"
                    ),
                    ParametersParameter(
                        name="display",
                        valueString=info["display"]
                    ),
                    ParametersParameter(
                        name="definition",
                        valueString=info["definition"]
                    )
                ]
            )
        else:
            return Parameters(
                parameter=[
                    ParametersParameter(
                        name="message",
                        valueString=f"Code {code} not found in system {system}"
                    )
                ]
            )
    
    async def _codesystem_subsumes_operation(
        self,
        resource_type: Optional[str],
        resource_id: Optional[str],
        parameters: Optional[dict]
    ) -> dict:
        """
        CodeSystem/$subsumes - test subsumption relationship.
        """
        # Basic implementation for training purposes
        codeA = None
        codeB = None
        system = None
        
        if parameters:
            for param in parameters.parameter or []:
                if param.name == "codeA":
                    codeA = param.valueCode
                elif param.name == "codeB":
                    codeB = param.valueCode
                elif param.name == "system":
                    system = param.valueUri
        
        # For training, create some simple subsumption relationships
        # In reality, this would check hierarchical relationships in the code system
        subsumption_result = "not-subsumed"  # Default
        
        if system == "http://snomed.info/sct":
            # Simple training examples
            if codeA == "44054006" and codeB == "44054006":  # Same code
                subsumption_result = "equivalent"
            elif codeA == "73211009" and codeB == "44054006":  # Diabetes type 2 subsumes diabetes
                subsumption_result = "subsumes"
        
        return Parameters(
            parameter=[
                ParametersParameter(
                    name="outcome",
                    valueCode=subsumption_result
                ),
                ParametersParameter(
                    name="message",
                    valueString=f"Subsumption check: {codeA} {subsumption_result} {codeB} (training mode)"
                )
            ]
        )