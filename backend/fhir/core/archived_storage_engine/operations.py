"""
FHIR Operations Implementation

Implements FHIR operations like $validate, $everything, $expand, etc.
Provides a framework for custom operations.
"""

from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import logging
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
        
        Generic implementation that delegates to resource-specific handlers
        or provides basic functionality.
        """
        if not resource_type or not resource_id:
            raise ValueError("Resource type and ID required for $everything operation")
        
        # For Patient resources, use the specialized implementation
        if resource_type == "Patient":
            return await self._patient_everything_operation(resource_type, resource_id, parameters)
        
        # For other resources, provide a basic implementation
        # Get the base resource
        base_resource = await self.storage.read_resource(resource_type, resource_id)
        if not base_resource:
            raise ValueError(f"Resource {resource_type}/{resource_id} not found")
        
        # Extract parameters
        since_date = None
        count_limit = None
        offset = 0
        
        if parameters:
            # Handle both dict and Parameters object
            if hasattr(parameters, 'parameter'):
                # Parameters object
                for param in parameters.parameter or []:
                    if param.name == "_since" and param.valueDateTime:
                        since_date = param.valueDateTime
                    elif param.name == "_count" and param.valueInteger:
                        count_limit = param.valueInteger
                    elif param.name == "_offset" and param.valueInteger:
                        offset = param.valueInteger
            else:
                # Dict parameters (from HTTP query params)
                since_date = parameters.get('_since')
                if parameters.get('_count'):
                    count_limit = int(parameters.get('_count'))
                if parameters.get('_offset'):
                    offset = int(parameters.get('_offset'))
        
        # Create result bundle
        bundle = Bundle(
            type="searchset",
            total=1,
            entry=[
                BundleEntry(
                    resource=construct_fhir_element(resource_type, base_resource),
                    fullUrl=f"{resource_type}/{resource_id}"
                )
            ]
        )
        
        # For non-Patient resources, we could implement reference following
        # but for now just return the resource itself
        # TODO: Implement reference following for other resource types
        
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
        
        Implements FHIR R4 $everything operation with support for:
        - _since: Only include resources modified after this date
        - _type: Only include resources of specified types
        - _count: Limit number of resources returned (with pagination)
        
        Returns:
        - Patient resource
        - All resources in the patient compartment
        - Resources referenced by those resources
        """
        if resource_type != "Patient" or not resource_id:
            raise ValueError("Patient ID required for Patient/$everything")
        
        # Get patient
        patient = await self.storage.read_resource("Patient", resource_id)
        if not patient:
            raise ValueError(f"Patient/{resource_id} not found")
        
        # Extract parameters
        since_date = None
        requested_types = None
        count_limit = None
        offset = 0
        
        if parameters:
            # Handle both dict and Parameters object
            if hasattr(parameters, 'parameter'):
                # Parameters object
                for param in parameters.parameter or []:
                    if param.name == "_since" and param.valueDateTime:
                        since_date = param.valueDateTime
                    elif param.name == "_type" and param.valueString:
                        requested_types = [t.strip() for t in param.valueString.split(',')]
                    elif param.name == "_count" and param.valueInteger:
                        count_limit = param.valueInteger
                    elif param.name == "_offset" and param.valueInteger:
                        offset = param.valueInteger
            else:
                # Dict parameters (from HTTP query params)
                since_date = parameters.get('_since')
                if parameters.get('_type'):
                    requested_types = [t.strip() for t in parameters.get('_type').split(',')]
                    logging.info(f"$everything: Requested types: {requested_types}")
                if parameters.get('_count'):
                    count_limit = int(parameters.get('_count'))
                if parameters.get('_offset'):
                    offset = int(parameters.get('_offset'))
        
        # Define all resource types in the patient compartment
        # Based on FHIR R4 specification
        patient_compartment_types = [
            # Core clinical resources
            "AllergyIntolerance", "CarePlan", "CareTeam", "ClinicalImpression",
            "Condition", "DiagnosticReport", "DocumentReference", "Encounter",
            "Goal", "ImagingStudy", "Immunization", "MedicationAdministration",
            "MedicationDispense", "MedicationRequest", "MedicationStatement",
            "Observation", "Procedure", "RiskAssessment", "ServiceRequest",
            
            # Administrative resources  
            "Account", "AdverseEvent", "Appointment", "AppointmentResponse",
            "Basic", "BodyStructure", "ChargeItem", "Claim", "ClaimResponse",
            "Communication", "CommunicationRequest", "Composition", "Consent",
            "Coverage", "DetectedIssue", "DeviceRequest", "DeviceUseStatement",
            "EpisodeOfCare", "ExplanationOfBenefit", "FamilyMemberHistory",
            "Flag", "Invoice", "List", "Media", "NutritionOrder",
            "Person", "Provenance", "QuestionnaireResponse", "RelatedPerson",
            "RequestGroup", "ResearchSubject", "Schedule", "Specimen",
            "SupplyDelivery", "SupplyRequest", "VisionPrescription"
        ]
        
        # Filter by requested types if specified
        if requested_types:
            # Include "Patient" in the requested types since it's always returned
            search_types = [t for t in requested_types if t in patient_compartment_types and t != "Patient"]
            logging.info(f"$everything: Filtered search types: {search_types}")
        else:
            search_types = patient_compartment_types
            logging.info(f"$everything: Using all compartment types: {len(search_types)} types")
        
        # Create result bundle
        bundle = Bundle(
            type="searchset",
            total=0,
            entry=[]
        )
        
        # Track all resources to avoid duplicates
        included_resources = set()
        all_entries = []
        
        # Always include the patient resource itself first
        patient_entry = BundleEntry(
            resource=construct_fhir_element("Patient", patient),
            fullUrl=f"Patient/{resource_id}"
        )
        all_entries.append(patient_entry)
        included_resources.add(f"Patient/{resource_id}")
        
        # Search each resource type for patient references
        for res_type in search_types:
            try:
                # Build search parameters
                raw_search_params = self._get_patient_search_params(res_type, resource_id)
                
                # Add _lastUpdated filter if _since is specified
                if since_date:
                    raw_search_params['_lastUpdated'] = f"gt{since_date}"
                
                logging.info(f"$everything: Searching {res_type} with params: {raw_search_params}")
                
                # Parse the search parameters properly
                from fhir.core.search.basic import SearchParameterHandler
                search_handler = SearchParameterHandler(self.storage._get_search_parameter_definitions())
                parsed_params, _ = search_handler.parse_search_params(res_type, raw_search_params)
                
                # Search for resources using paginated search
                from fhir.core.utils import search_all_resources
                resources = await search_all_resources(
                    self.storage,
                    res_type,
                    parsed_params
                )
                
                logging.info(f"$everything: Found {len(resources)} {res_type} resources")
                
                # Add resources to bundle
                for resource_data in resources:
                    # Check if resource_data is a string (which would be wrong)
                    if isinstance(resource_data, str):
                        logging.error(f"$everything: Got string instead of dict for {res_type}: {resource_data[:100]}")
                        continue
                    
                    res_id = f"{res_type}/{resource_data['id']}"
                    if res_id not in included_resources:
                        entry = BundleEntry(
                            resource=construct_fhir_element(res_type, resource_data),
                            fullUrl=res_id
                        )
                        all_entries.append(entry)
                        included_resources.add(res_id)
                        
                        # Also collect referenced resources
                        await self._collect_referenced_resources(
                            resource_data, all_entries, included_resources, since_date
                        )
                        
            except Exception as e:
                # Log but continue with other resource types
                import traceback
                logging.warning(f"Error searching {res_type} for patient {resource_id}: {e}")
                logging.warning(f"Traceback: {traceback.format_exc()}")
        
        # Apply pagination if _count is specified
        total_resources = len(all_entries)
        bundle.total = total_resources
        
        if count_limit:
            # Calculate pagination
            start_idx = offset
            end_idx = min(start_idx + count_limit, total_resources)
            
            # Add entries for this page
            bundle.entry = all_entries[start_idx:end_idx]
            
            # Add pagination links
            bundle.link = []
            
            # Self link
            self_params = []
            if requested_types:
                self_params.append(f"_type={','.join(requested_types)}")
            if since_date:
                self_params.append(f"_since={since_date}")
            if count_limit:
                self_params.append(f"_count={count_limit}")
            if offset:
                self_params.append(f"_offset={offset}")
            
            self_url = f"Patient/{resource_id}/$everything"
            if self_params:
                self_url += "?" + "&".join(self_params)
            
            bundle.link.append({
                "relation": "self",
                "url": self_url
            })
            
            # Next link if there are more resources
            if end_idx < total_resources:
                next_params = self_params.copy()
                # Update offset for next page
                next_params = [p for p in next_params if not p.startswith("_offset")]
                next_params.append(f"_offset={end_idx}")
                bundle.link.append({
                    "relation": "next", 
                    "url": f"Patient/{resource_id}/$everything?" + "&".join(next_params)
                })
            
            # Previous link if not on first page
            if offset > 0:
                prev_offset = max(0, offset - count_limit)
                prev_params = self_params.copy()
                prev_params = [p for p in prev_params if not p.startswith("_offset")]
                if prev_offset > 0:
                    prev_params.append(f"_offset={prev_offset}")
                bundle.link.append({
                    "relation": "previous",
                    "url": f"Patient/{resource_id}/$everything?" + "&".join(prev_params)
                })
        else:
            # No pagination - return all resources
            bundle.entry = all_entries
        
        return bundle
    
    def _get_patient_search_params(self, resource_type: str, patient_id: str) -> dict:
        """
        Get the appropriate search parameter for patient references by resource type.
        
        Different resources use different parameter names to reference patients.
        """
        # Most resources use 'patient' parameter
        standard_patient_params = {
            "AllergyIntolerance", "CarePlan", "CareTeam", "ClinicalImpression",
            "Condition", "DiagnosticReport", "DocumentReference", "Encounter",
            "Goal", "ImagingStudy", "Immunization", "MedicationAdministration",
            "MedicationDispense", "MedicationRequest", "MedicationStatement",
            "Observation", "Procedure", "RiskAssessment", "ServiceRequest",
            "AdverseEvent", "Appointment", "AppointmentResponse", "Basic",
            "BodyStructure", "ChargeItem", "Communication", "CommunicationRequest",
            "Composition", "Consent", "Coverage", "DetectedIssue", "DeviceRequest",
            "DeviceUseStatement", "EpisodeOfCare", "ExplanationOfBenefit",
            "FamilyMemberHistory", "Flag", "Invoice", "List", "Media",
            "NutritionOrder", "Provenance", "QuestionnaireResponse", "RequestGroup",
            "ResearchSubject", "Schedule", "Specimen", "SupplyDelivery",
            "SupplyRequest", "VisionPrescription"
        }
        
        # Resources that use 'subject' parameter
        subject_param_resources = {
            "Basic", "BodyStructure", "Consent", "DetectedIssue", 
            "Media", "QuestionnaireResponse", "RiskAssessment"
        }
        
        # Resources that use specific parameters
        special_params = {
            "Account": "subject",
            "Claim": "patient",
            "ClaimResponse": "patient", 
            "Coverage": "beneficiary",
            "Group": "member",
            "Person": "link",
            "RelatedPerson": "patient"
        }
        
        # Determine the correct parameter
        if resource_type in special_params:
            param_name = special_params[resource_type]
        elif resource_type in subject_param_resources:
            param_name = "subject"
        else:
            param_name = "patient"
        
        return {param_name: f"Patient/{patient_id}"}
    
    async def _collect_referenced_resources(
        self,
        resource_data: dict,
        all_entries: list,
        included_resources: set,
        since_date: Optional[str]
    ):
        """
        Collect resources referenced by the given resource.
        
        This implements the FHIR requirement to include "any resource referenced from those"
        in the patient compartment.
        """
        # Common reference fields to check
        reference_fields = [
            "performer", "author", "encounter", "location", "organization",
            "practitioner", "recorder", "asserter", "requester", "participant"
        ]
        
        for field in reference_fields:
            if field in resource_data:
                ref_value = resource_data[field]
                
                # Handle single reference
                if isinstance(ref_value, dict) and 'reference' in ref_value:
                    await self._add_referenced_resource(
                        ref_value['reference'], all_entries, included_resources, since_date
                    )
                
                # Handle array of references
                elif isinstance(ref_value, list):
                    for item in ref_value:
                        if isinstance(item, dict) and 'reference' in item:
                            await self._add_referenced_resource(
                                item['reference'], all_entries, included_resources, since_date
                            )
    
    async def _add_referenced_resource(
        self,
        reference: str,
        all_entries: list,
        included_resources: set,
        since_date: Optional[str]
    ):
        """Add a referenced resource to the bundle if not already included."""
        if reference in included_resources:
            return
        
        # Parse reference
        if '/' in reference:
            ref_parts = reference.split('/')
            if len(ref_parts) == 2:
                ref_type, ref_id = ref_parts
                
                # Skip if reference is to a contained resource or external system
                if ref_type.startswith('#') or ref_type.startswith('http'):
                    return
                
                try:
                    # Fetch the referenced resource
                    ref_resource = await self.storage.read_resource(ref_type, ref_id)
                    if ref_resource:
                        # Check _since filter
                        if since_date:
                            last_updated = ref_resource.get('meta', {}).get('lastUpdated')
                            if last_updated and last_updated < since_date:
                                return
                        
                        # Add to bundle
                        entry = BundleEntry(
                            resource=construct_fhir_element(ref_type, ref_resource),
                            fullUrl=reference
                        )
                        all_entries.append(entry)
                        included_resources.add(reference)
                except Exception:
                    # Log but continue if reference cannot be resolved
                    pass
    
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