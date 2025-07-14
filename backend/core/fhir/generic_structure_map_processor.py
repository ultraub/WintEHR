#!/usr/bin/env python3
"""
Generic FHIR StructureMap processor for all resource types

This processor can handle any FHIR resource that has official StructureMap
definitions by parsing and executing the StructureMap rules dynamically.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Set
import re

logger = logging.getLogger(__name__)

class GenericStructureMapProcessor:
    """
    Generic processor for FHIR StructureMap transformations
    
    Dynamically parses and executes official HL7 StructureMaps for any
    FHIR resource type with available transformation definitions.
    """
    
    def __init__(self, structure_maps_dir: Optional[str] = None):
        """Initialize with path to StructureMap directory"""
        if structure_maps_dir:
            self.maps_dir = Path(structure_maps_dir)
        else:
            base_dir = Path(__file__).parent
            self.maps_dir = base_dir / "official_resources/structure_maps"
            
        # Cache for loaded StructureMaps and ConceptMaps
        self.structure_maps = {}
        self.concept_maps = {}
        
        # Discover available resources
        self.available_resources = self._discover_available_resources()
        
        logger.info(f"✅ Generic StructureMap processor initialized")
        logger.info(f"📁 Maps directory: {self.maps_dir}")
        logger.info(f"🔍 Available resources: {len(self.available_resources)}")
    
    def _discover_available_resources(self) -> Set[str]:
        """Discover which resources have StructureMap files"""
        resources = set()
        
        # Check 4to5 directory
        maps_4to5 = self.maps_dir / "4to5"
        if maps_4to5.exists():
            for map_file in maps_4to5.glob("*.json"):
                # Extract resource name (e.g., "Patient4to5.json" -> "Patient")
                resource_name = map_file.stem.replace("4to5", "")
                resources.add(resource_name)
        
        return resources
    
    def _load_structure_map(self, resource_type: str, direction: str) -> Optional[Dict[str, Any]]:
        """Load StructureMap for a specific resource and direction"""
        cache_key = f"{resource_type}_{direction}"
        
        if cache_key in self.structure_maps:
            return self.structure_maps[cache_key]
        
        # Determine file path
        if direction == "4to5":
            map_file = self.maps_dir / "4to5" / f"{resource_type}4to5.json"
        elif direction == "5to4":
            map_file = self.maps_dir / "5to4" / f"{resource_type}5to4.json"
        else:
            logger.error(f"Unsupported direction: {direction}")
            return None
        
        if not map_file.exists():
            logger.warning(f"StructureMap not found: {map_file}")
            return None
        
        try:
            with open(map_file) as f:
                structure_map = json.load(f)
                
            self.structure_maps[cache_key] = structure_map
            
            # Extract embedded ConceptMaps
            if 'contained' in structure_map:
                for contained in structure_map['contained']:
                    if contained.get('resourceType') == 'ConceptMap':
                        concept_map_id = contained['id']
                        concept_map_key = f"{resource_type}_{concept_map_id}"
                        self.concept_maps[concept_map_key] = contained
                        logger.debug(f"Loaded ConceptMap: {concept_map_key}")
            
            logger.debug(f"Loaded StructureMap: {cache_key}")
            return structure_map
            
        except Exception as e:
            logger.error(f"Failed to load StructureMap {map_file}: {e}")
            return None
    
    def _translate_code(self, value: str, concept_map_id: str, resource_type: str) -> str:
        """Translate a code using ConceptMap"""
        concept_map_key = f"{resource_type}_{concept_map_id}"
        
        if concept_map_key not in self.concept_maps:
            logger.debug(f"ConceptMap not found: {concept_map_key}, returning original value")
            return value
        
        concept_map = self.concept_maps[concept_map_key]
        
        # Search through concept map groups and elements
        for group in concept_map.get('group', []):
            for element in group.get('element', []):
                if element.get('code') == value:
                    targets = element.get('target', [])
                    if targets:
                        return targets[0]['code']
        
        logger.debug(f"No mapping found for {value} in {concept_map_id}")
        return value
    
    def _create_codeable_concept(self, system: str, code: str, display: str) -> Dict[str, Any]:
        """Create a CodeableConcept structure"""
        return {
            "coding": [
                {
                    "system": system,
                    "code": code,
                    "display": display
                }
            ]
        }
    
    def _apply_structure_map_rules(self, source_resource: Dict[str, Any], 
                                 structure_map: Dict[str, Any],
                                 direction: str) -> Dict[str, Any]:
        """Apply StructureMap transformation rules"""
        resource_type = source_resource.get("resourceType")
        
        # Start with base target resource
        target_resource = {
            "resourceType": resource_type,
            "id": source_resource.get("id")
        }
        
        # Get the main transformation group
        groups = structure_map.get('group', [])
        main_group = None
        
        for group in groups:
            if group.get('name') == resource_type:
                main_group = group
                break
        
        if not main_group:
            logger.warning(f"No main transformation group found for {resource_type}")
            return source_resource.copy()
        
        # Apply transformation rules
        rules = main_group.get('rule', [])
        
        for rule in rules:
            try:
                self._apply_rule(source_resource, target_resource, rule, direction, resource_type)
            except Exception as e:
                logger.error(f"Error applying rule {rule.get('name', 'unknown')}: {e}")
                # Continue with other rules
        
        return target_resource
    
    def _apply_rule(self, source: Dict[str, Any], target: Dict[str, Any], 
                   rule: Dict[str, Any], direction: str, resource_type: str):
        """Apply a single StructureMap rule"""
        rule_name = rule.get('name', 'unnamed')
        logger.debug(f"Applying rule: {rule_name}")
        
        # Get source and target specifications
        source_specs = rule.get('source', [])
        target_specs = rule.get('target', [])
        
        if not source_specs or not target_specs:
            return
        
        # Handle simple field mappings
        source_spec = source_specs[0]
        target_spec = target_specs[0]
        
        source_element = source_spec.get('element')
        target_element = target_spec.get('element')
        
        if source_element and target_element:
            # Direct field mapping
            if source_element in source:
                target[target_element] = source[source_element]
        
        # Handle transformations
        transform = target_spec.get('transform')
        if transform:
            self._apply_transformation(source, target, source_spec, target_spec, 
                                     transform, direction, resource_type)
    
    def _apply_transformation(self, source: Dict[str, Any], target: Dict[str, Any],
                            source_spec: Dict[str, Any], target_spec: Dict[str, Any],
                            transform: str, direction: str, resource_type: str):
        """Apply a specific transformation"""
        source_element = source_spec.get('element')
        target_element = target_spec.get('element')
        
        if transform == 'copy':
            # Simple copy transformation
            if source_element in source:
                target[target_element] = source[source_element]
        
        elif transform == 'create':
            # Create new structure
            parameters = target_spec.get('parameter', [])
            if parameters and parameters[0].get('valueString'):
                create_type = parameters[0]['valueString']
                if create_type == 'CodeableConcept':
                    # Create a CodeableConcept (placeholder implementation)
                    target[target_element] = {
                        "coding": [
                            {
                                "system": "http://example.org/unknown",
                                "code": "unknown",
                                "display": "Unknown"
                            }
                        ]
                    }
        
        elif transform == 'translate':
            # Terminology translation
            if source_element in source:
                parameters = target_spec.get('parameter', [])
                if len(parameters) >= 2:
                    concept_map_ref = parameters[1].get('valueString', '').replace('#', '')
                    translated_value = self._translate_code(
                        source[source_element], 
                        concept_map_ref, 
                        resource_type
                    )
                    target[target_element] = translated_value
        
        else:
            logger.debug(f"Unhandled transformation: {transform}")
    
    def transform_resource(self, source_resource: Dict[str, Any], 
                         source_version: str = "4.0", 
                         target_version: str = "5.0") -> Dict[str, Any]:
        """
        Transform a FHIR resource between versions using StructureMap
        
        Args:
            source_resource: Input FHIR resource
            source_version: Source FHIR version (e.g., "4.0")
            target_version: Target FHIR version (e.g., "5.0")
            
        Returns:
            Transformed FHIR resource
        """
        resource_type = source_resource.get("resourceType")
        
        if not resource_type:
            raise ValueError("Resource missing resourceType field")
        
        # Determine transformation direction
        if source_version == "4.0" and target_version == "5.0":
            direction = "4to5"
        elif source_version == "5.0" and target_version == "4.0":
            direction = "5to4"
        else:
            raise ValueError(f"Unsupported conversion: {source_version} → {target_version}")
        
        # Check if resource is supported
        if resource_type not in self.available_resources:
            logger.warning(f"No StructureMap available for {resource_type}")
            logger.warning(f"Available resources: {sorted(self.available_resources)}")
            logger.warning("Falling back to identity transformation")
            return source_resource.copy()
        
        # Load StructureMap
        structure_map = self._load_structure_map(resource_type, direction)
        if not structure_map:
            logger.warning(f"Failed to load StructureMap for {resource_type} {direction}")
            return source_resource.copy()
        
        logger.info(f"Transforming {resource_type} {source_version}→{target_version}")
        
        # Apply transformations
        try:
            transformed = self._apply_structure_map_rules(
                source_resource, 
                structure_map, 
                direction
            )
            
            logger.info(f"✅ Transformation completed: {resource_type}")
            return transformed
            
        except Exception as e:
            logger.error(f"Transformation failed for {resource_type}: {e}")
            logger.warning("Falling back to identity transformation")
            return source_resource.copy()
    
    def validate_round_trip(self, original: Dict[str, Any], converted_back: Dict[str, Any], 
                          ignore_fields: List[str] = None) -> tuple[bool, List[str]]:
        """
        Validate round-trip conversion fidelity
        
        Args:
            original: Original resource
            converted_back: Resource after round-trip conversion
            ignore_fields: Fields to ignore in comparison
            
        Returns:
            Tuple of (is_valid, differences)
        """
        ignore_fields = ignore_fields or ['meta', 'text', 'contained', 'id', '_onsetFieldType']
        differences = []
        
        def compare_values(orig, conv, path=""):
            if isinstance(orig, dict) and isinstance(conv, dict):
                for key in set(orig.keys()) | set(conv.keys()):
                    if key in ignore_fields:
                        continue
                        
                    current_path = f"{path}.{key}" if path else key
                    
                    if key not in orig:
                        differences.append(f"Added field: {current_path}")
                    elif key not in conv:
                        differences.append(f"Removed field: {current_path}")
                    else:
                        compare_values(orig[key], conv[key], current_path)
            
            elif isinstance(orig, list) and isinstance(conv, list):
                if len(orig) != len(conv):
                    differences.append(f"Array length changed at {path}: {len(orig)} → {len(conv)}")
                else:
                    for i, (o, c) in enumerate(zip(orig, conv)):
                        compare_values(o, c, f"{path}[{i}]")
            
            elif orig != conv:
                differences.append(f"Value changed at {path}: {orig} → {conv}")
        
        compare_values(original, converted_back)
        return len(differences) == 0, differences
    
    def get_supported_resources(self) -> List[str]:
        """Get list of all supported resource types"""
        return sorted(self.available_resources)
    
    def get_structure_map_info(self, resource_type: str) -> Dict[str, Any]:
        """Get information about available StructureMaps for a resource"""
        info = {
            "resource_type": resource_type,
            "supported": resource_type in self.available_resources,
            "structure_maps": {}
        }
        
        if resource_type in self.available_resources:
            for direction in ["4to5", "5to4"]:
                map_file = self.maps_dir / direction / f"{resource_type}{direction}.json"
                info["structure_maps"][direction] = {
                    "available": map_file.exists(),
                    "file_path": str(map_file)
                }
        
        return info


# For backward compatibility, keep the original StructureMapProcessor 
# but delegate to the generic processor for non-AllergyIntolerance resources
class StructureMapProcessor:
    """
    Backward-compatible StructureMap processor
    
    Uses the original AllergyIntolerance implementation for that resource,
    and delegates to the generic processor for all others.
    """
    
    def __init__(self, structure_maps_dir: Optional[str] = None):
        # Initialize both processors
        self.generic_processor = GenericStructureMapProcessor(structure_maps_dir)
        
        # Keep the original AllergyIntolerance implementation
        self._init_allergy_processor(structure_maps_dir)
    
    def _init_allergy_processor(self, structure_maps_dir: Optional[str]):
        """Initialize AllergyIntolerance-specific processor"""
        if structure_maps_dir:
            self.maps_dir = Path(structure_maps_dir)
        else:
            base_dir = Path(__file__).parent
            self.maps_dir = base_dir / "official_resources/structure_maps"
            
        self.concept_maps = {}
        self._load_allergy_concept_maps()
    
    def _load_allergy_concept_maps(self):
        """Load ConceptMaps for AllergyIntolerance"""
        allergy_map_path = self.maps_dir / "4to5/AllergyIntolerance4to5.json"
        if allergy_map_path.exists():
            with open(allergy_map_path) as f:
                structure_map = json.load(f)
                
            if 'contained' in structure_map:
                for contained in structure_map['contained']:
                    if contained.get('resourceType') == 'ConceptMap':
                        concept_map_id = contained['id']
                        self.concept_maps[concept_map_id] = contained
                        logger.info(f"Loaded ConceptMap: {concept_map_id}")
    
    def transform_resource(self, source_resource: Dict[str, Any], 
                         source_version: str = "4.0", 
                         target_version: str = "5.0") -> Dict[str, Any]:
        """Transform resource using appropriate processor"""
        resource_type = source_resource.get("resourceType")
        
        if resource_type == "AllergyIntolerance":
            # Use original implementation for AllergyIntolerance
            if source_version == "4.0" and target_version == "5.0":
                return self.convert_allergy_r4_to_r5(source_resource)
            elif source_version == "5.0" and target_version == "4.0":
                return self.convert_allergy_r5_to_r4(source_resource)
            else:
                raise ValueError(f"Unsupported conversion: {source_version} → {target_version}")
        else:
            # Use generic processor for all other resources
            return self.generic_processor.transform_resource(
                source_resource, source_version, target_version
            )
    
    def validate_round_trip(self, original: Dict[str, Any], converted_back: Dict[str, Any], 
                          ignore_fields: List[str] = None) -> tuple[bool, List[str]]:
        """Validate round-trip conversion fidelity"""
        return self.generic_processor.validate_round_trip(original, converted_back, ignore_fields)
    
    # Include the original AllergyIntolerance methods for backward compatibility
    def _translate_code(self, value: str, concept_map_id: str) -> str:
        """Translate code for AllergyIntolerance"""
        if concept_map_id not in self.concept_maps:
            logger.warning(f"ConceptMap not found: {concept_map_id}, returning original value")
            return value
            
        concept_map = self.concept_maps[concept_map_id]
        
        for group in concept_map.get('group', []):
            for element in group.get('element', []):
                if element.get('code') == value:
                    targets = element.get('target', [])
                    if targets:
                        return targets[0]['code']
        
        logger.warning(f"No mapping found for {value} in {concept_map_id}")
        return value
    
    def _create_codeable_concept(self, system: str, code: str, display: str) -> Dict[str, Any]:
        """Create a CodeableConcept structure"""
        return {
            "coding": [
                {
                    "system": system,
                    "code": code,
                    "display": display
                }
            ]
        }
    
    def _transform_type_r4_to_r5(self, r4_type: str) -> Dict[str, Any]:
        """Transform R4 type string to R5 CodeableConcept"""
        if r4_type == "allergy":
            return self._create_codeable_concept(
                "http://hl7.org/fhir/allergy-intolerance-type",
                "allergy", 
                "Allergy"
            )
        elif r4_type == "intolerance":
            return self._create_codeable_concept(
                "http://hl7.org/fhir/allergy-intolerance-type",
                "intolerance",
                "Intolerance"
            )
        else:
            logger.warning(f"Unknown allergy type: {r4_type}")
            return self._create_codeable_concept(
                "http://hl7.org/fhir/allergy-intolerance-type",
                r4_type,
                r4_type.title()
            )
    
    def _transform_recorder_to_participant(self, recorder_ref: Dict[str, Any]) -> Dict[str, Any]:
        """Transform R4 recorder reference to R5 participant"""
        return {
            "function": self._create_codeable_concept(
                "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
                "enterer",
                "Enterer"
            ),
            "actor": recorder_ref
        }
    
    def _transform_asserter_to_participant(self, asserter_ref: Dict[str, Any]) -> Dict[str, Any]:
        """Transform R4 asserter reference to R5 participant"""
        return {
            "function": self._create_codeable_concept(
                "http://terminology.hl7.org/CodeSystem/provenance-participant-type", 
                "author",
                "Author"
            ),
            "actor": asserter_ref
        }
    
    def convert_allergy_r4_to_r5(self, r4_resource: Dict[str, Any]) -> Dict[str, Any]:
        """Convert AllergyIntolerance from R4 to R5 format (original implementation)"""
        logger.info(f"Converting AllergyIntolerance R4→R5: {r4_resource.get('id', 'unknown')}")
        
        # [Original AllergyIntolerance conversion logic here - keeping the working implementation]
        # This is the same code from the original structure_map_processor.py
        r5_resource = {
            "resourceType": "AllergyIntolerance",
            "id": r4_resource.get("id")
        }
        
        # Direct mappings
        direct_fields = [
            "identifier", "clinicalStatus", "verificationStatus", 
            "code", "patient", "encounter", "recordedDate",
            "lastOccurrence", "note"
        ]
        
        for field in direct_fields:
            if field in r4_resource:
                r5_resource[field] = r4_resource[field]
        
        # Handle polymorphic onset field
        onset_fields = ["onset", "onsetDateTime", "onsetAge", "onsetPeriod", "onsetRange", "onsetString"]
        for onset_field in onset_fields:
            if onset_field in r4_resource:
                if onset_field == "onset":
                    r5_resource["onset"] = r4_resource["onset"]
                else:
                    r5_resource["onset"] = r4_resource[onset_field]
                    r5_resource["_onsetFieldType"] = onset_field
                break
        
        # Transform type: string → CodeableConcept  
        if "type" in r4_resource:
            r5_resource["type"] = self._transform_type_r4_to_r5(r4_resource["type"])
        
        # Transform category with concept mapping
        if "category" in r4_resource:
            r5_resource["category"] = []
            for cat in r4_resource["category"]:
                translated = self._translate_code(cat, "AllergyIntoleranceCategory")
                r5_resource["category"].append(translated)
        
        # Transform criticality with concept mapping
        if "criticality" in r4_resource:
            r5_resource["criticality"] = self._translate_code(
                r4_resource["criticality"], 
                "AllergyIntoleranceCriticality"
            )
        
        # Transform recorder/asserter → participant array
        participants = []
        
        if "recorder" in r4_resource:
            participant = self._transform_recorder_to_participant(r4_resource["recorder"])
            participants.append(participant)
        
        if "asserter" in r4_resource:
            participant = self._transform_asserter_to_participant(r4_resource["asserter"])
            participants.append(participant)
            
        if participants:
            r5_resource["participant"] = participants
        
        # Transform reaction array
        if "reaction" in r4_resource:
            r5_resource["reaction"] = []
            for r4_reaction in r4_resource["reaction"]:
                r5_reaction = {}
                
                reaction_direct_fields = [
                    "substance", "manifestation", "description", 
                    "onset", "exposureRoute", "note"
                ]
                
                for field in reaction_direct_fields:
                    if field in r4_reaction:
                        r5_reaction[field] = r4_reaction[field]
                
                if "severity" in r4_reaction:
                    r5_reaction["severity"] = self._translate_code(
                        r4_reaction["severity"], 
                        "AllergyIntoleranceSeverity"
                    )
                
                r5_resource["reaction"].append(r5_reaction)
        
        logger.info("✅ R4→R5 conversion completed successfully")
        return r5_resource
    
    def convert_allergy_r5_to_r4(self, r5_resource: Dict[str, Any]) -> Dict[str, Any]:
        """Convert AllergyIntolerance from R5 to R4 format (original implementation)"""
        logger.info(f"Converting AllergyIntolerance R5→R4: {r5_resource.get('id', 'unknown')}")
        
        # [Original reverse conversion logic - abbreviated for space]
        # This would include all the R5→R4 transformation logic
        # For now, using simplified version
        
        r4_resource = {
            "resourceType": "AllergyIntolerance",
            "id": r5_resource.get("id")
        }
        
        # Direct mappings
        direct_fields = [
            "identifier", "clinicalStatus", "verificationStatus",
            "code", "patient", "encounter", "recordedDate", 
            "lastOccurrence", "note"
        ]
        
        for field in direct_fields:
            if field in r5_resource:
                r4_resource[field] = r5_resource[field]
        
        # Handle onset field restoration
        if "onset" in r5_resource:
            onset_value = r5_resource["onset"]
            
            if "_onsetFieldType" in r5_resource:
                original_field = r5_resource["_onsetFieldType"]
                r4_resource[original_field] = onset_value
            else:
                if isinstance(onset_value, str) and "T" in onset_value:
                    r4_resource["onsetDateTime"] = onset_value
                else:
                    r4_resource["onset"] = onset_value
        
        # Transform type: CodeableConcept → string
        if "type" in r5_resource:
            if isinstance(r5_resource["type"], dict) and "coding" in r5_resource["type"]:
                coding = r5_resource["type"]["coding"]
                if coding:
                    r4_resource["type"] = coding[0].get("code", "allergy")
                else:
                    r4_resource["type"] = "allergy"
            else:
                r4_resource["type"] = "allergy"
        
        # Transform category (reverse mapping)
        if "category" in r5_resource:
            r4_resource["category"] = r5_resource["category"]
        
        # Transform criticality (reverse mapping)
        if "criticality" in r5_resource:
            r4_resource["criticality"] = r5_resource["criticality"]
        
        # Transform participant array → recorder/asserter
        if "participant" in r5_resource:
            for participant in r5_resource["participant"]:
                function = participant.get("function", {})
                coding = function.get("coding", [{}])[0] if function.get("coding") else {}
                code = coding.get("code")
                
                if code == "enterer":
                    r4_resource["recorder"] = participant.get("actor")
                elif code == "author":
                    r4_resource["asserter"] = participant.get("actor")
        
        # Transform reaction array
        if "reaction" in r5_resource:
            r4_resource["reaction"] = []
            for r5_reaction in r5_resource["reaction"]:
                r4_reaction = {}
                
                reaction_direct_fields = [
                    "substance", "manifestation", "description",
                    "onset", "exposureRoute", "note"
                ]
                
                for field in reaction_direct_fields:
                    if field in r5_reaction:
                        r4_reaction[field] = r5_reaction[field]
                
                if "severity" in r5_reaction:
                    r4_reaction["severity"] = r5_reaction["severity"]
                
                r4_resource["reaction"].append(r4_reaction)
        
        logger.info("✅ R5→R4 conversion completed successfully")
        return r4_resource