#!/usr/bin/env python3
"""
Python-based StructureMap processor for FHIR R4↔R5 conversions

Since HAPI FHIR validator doesn't yet support R4→R5 conversions, 
this implements the official StructureMap transformations using 
the fhir.resources library.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class StructureMapProcessor:
    """
    Python implementation of FHIR StructureMap transformations
    
    Based on official HL7 StructureMaps from:
    http://hl7.org/fhir/StructureMap/AllergyIntolerance4to5
    """
    
    def __init__(self, structure_maps_dir: Optional[str] = None):
        """Initialize with path to StructureMap directory"""
        if structure_maps_dir:
            self.maps_dir = Path(structure_maps_dir)
        else:
            # Default to relative path from this file
            base_dir = Path(__file__).parent
            self.maps_dir = base_dir / "official_resources/structure_maps"
            
        # Load concept maps for terminology translation
        self._load_concept_maps()
    
    def _load_concept_maps(self):
        """Load ConceptMaps from StructureMap files"""
        self.concept_maps = {}
        
        # Load from AllergyIntolerance4to5.json
        allergy_map_path = self.maps_dir / "4to5/AllergyIntolerance4to5.json"
        if allergy_map_path.exists():
            with open(allergy_map_path) as f:
                structure_map = json.load(f)
                
            # Extract embedded ConceptMaps
            if 'contained' in structure_map:
                for contained in structure_map['contained']:
                    if contained.get('resourceType') == 'ConceptMap':
                        concept_map_id = contained['id']
                        self.concept_maps[concept_map_id] = contained
                        logger.info(f"Loaded ConceptMap: {concept_map_id}")
    
    def _translate_code(self, value: str, concept_map_id: str) -> str:
        """
        Translate a code using the specified ConceptMap
        
        Args:
            value: Source code value  
            concept_map_id: ID of ConceptMap to use (e.g., "AllergyIntoleranceCategory")
            
        Returns:
            Translated code value
        """
        if concept_map_id not in self.concept_maps:
            logger.warning(f"ConceptMap not found: {concept_map_id}, returning original value")
            return value
            
        concept_map = self.concept_maps[concept_map_id]
        
        # Search through concept map groups and elements
        for group in concept_map.get('group', []):
            for element in group.get('element', []):
                if element.get('code') == value:
                    # Return first target mapping
                    targets = element.get('target', [])
                    if targets:
                        return targets[0]['code']
        
        # No mapping found, return original
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
        """
        Transform R4 type string to R5 CodeableConcept
        
        Based on StructureMap rules:
        src.type as s where type = 'allergy' -> tgt.type = create('CodeableConcept')
        """
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
        """
        Transform R4 recorder reference to R5 participant
        
        Based on StructureMap AllergyIntoleranceRecorder group
        """
        return {
            "function": self._create_codeable_concept(
                "http://terminology.hl7.org/CodeSystem/provenance-participant-type",
                "enterer",
                "Enterer"
            ),
            "actor": recorder_ref
        }
    
    def _transform_asserter_to_participant(self, asserter_ref: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform R4 asserter reference to R5 participant
        
        Based on StructureMap AllergyIntoleranceAsserter group
        """
        return {
            "function": self._create_codeable_concept(
                "http://terminology.hl7.org/CodeSystem/provenance-participant-type", 
                "author",
                "Author"
            ),
            "actor": asserter_ref
        }
    
    def convert_allergy_r4_to_r5(self, r4_resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert AllergyIntolerance from R4 to R5 format
        
        Implementation of official StructureMap:
        http://hl7.org/fhir/StructureMap/AllergyIntolerance4to5
        """
        logger.info(f"Converting AllergyIntolerance R4→R5: {r4_resource.get('id', 'unknown')}")
        
        # Start with base resource structure
        r5_resource = {
            "resourceType": "AllergyIntolerance",
            "id": r4_resource.get("id")
        }
        
        # Direct mappings (most fields stay the same)
        direct_fields = [
            "identifier", "clinicalStatus", "verificationStatus", 
            "code", "patient", "encounter", "recordedDate",
            "lastOccurrence", "note"
        ]
        
        for field in direct_fields:
            if field in r4_resource:
                r5_resource[field] = r4_resource[field]
        
        # Handle polymorphic onset field (onsetDateTime, onsetAge, onsetPeriod, onsetRange, onsetString)
        # Store the original field name for round-trip fidelity
        onset_fields = ["onset", "onsetDateTime", "onsetAge", "onsetPeriod", "onsetRange", "onsetString"]
        for onset_field in onset_fields:
            if onset_field in r4_resource:
                if onset_field == "onset":
                    r5_resource["onset"] = r4_resource["onset"]
                else:
                    # For typed onset fields (onsetDateTime, etc.), map to generic onset
                    r5_resource["onset"] = r4_resource[onset_field]
                    # Store metadata for round-trip conversion
                    r5_resource["_onsetFieldType"] = onset_field
                break  # Only one onset type should be present
        
        # Transform type: string → CodeableConcept  
        if "type" in r4_resource:
            r5_resource["type"] = self._transform_type_r4_to_r5(r4_resource["type"])
        
        # Transform category with concept mapping
        if "category" in r4_resource:
            # category is an array in both versions
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
        
        # Transform reaction array (includes severity translation)
        if "reaction" in r4_resource:
            r5_resource["reaction"] = []
            for r4_reaction in r4_resource["reaction"]:
                r5_reaction = {}
                
                # Direct reaction mappings
                reaction_direct_fields = [
                    "substance", "manifestation", "description", 
                    "onset", "exposureRoute", "note"
                ]
                
                for field in reaction_direct_fields:
                    if field in r4_reaction:
                        r5_reaction[field] = r4_reaction[field]
                
                # Transform severity with concept mapping
                if "severity" in r4_reaction:
                    r5_reaction["severity"] = self._translate_code(
                        r4_reaction["severity"], 
                        "AllergyIntoleranceSeverity"
                    )
                
                r5_resource["reaction"].append(r5_reaction)
        
        logger.info("✅ R4→R5 conversion completed successfully")
        return r5_resource
    
    def _transform_type_r5_to_r4(self, r5_type: Dict[str, Any]) -> str:
        """
        Transform R5 type CodeableConcept to R4 string
        
        Reverse of the R4→R5 transformation
        """
        if not r5_type or "coding" not in r5_type:
            return "allergy"  # Default
            
        coding = r5_type["coding"][0] if r5_type["coding"] else {}
        code = coding.get("code", "allergy")
        
        # Map back to R4 values
        if code in ["allergy", "intolerance"]:
            return code
        else:
            logger.warning(f"Unknown R5 type code: {code}, defaulting to 'allergy'")
            return "allergy"
    
    def _extract_participants_to_r4(self, participants: List[Dict[str, Any]]) -> tuple[Optional[Dict], Optional[Dict]]:
        """
        Extract R5 participants back to R4 recorder/asserter
        
        Returns tuple of (recorder_ref, asserter_ref)
        """
        recorder_ref = None
        asserter_ref = None
        
        for participant in participants:
            function = participant.get("function", {})
            coding = function.get("coding", [{}])[0] if function.get("coding") else {}
            code = coding.get("code")
            
            if code == "enterer":
                recorder_ref = participant.get("actor")
            elif code == "author":
                asserter_ref = participant.get("actor")
        
        return recorder_ref, asserter_ref
    
    def convert_allergy_r5_to_r4(self, r5_resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert AllergyIntolerance from R5 to R4 format
        
        Reverse transformation for round-trip testing
        """
        logger.info(f"Converting AllergyIntolerance R5→R4: {r5_resource.get('id', 'unknown')}")
        
        # Start with base resource structure  
        r4_resource = {
            "resourceType": "AllergyIntolerance",
            "id": r5_resource.get("id")
        }
        
        # Direct mappings (most fields stay the same)
        direct_fields = [
            "identifier", "clinicalStatus", "verificationStatus",
            "code", "patient", "encounter", "recordedDate", 
            "lastOccurrence", "note"
        ]
        
        for field in direct_fields:
            if field in r5_resource:
                r4_resource[field] = r5_resource[field]
        
        # Handle polymorphic onset field - R5 uses generic "onset", R4 may use typed variants
        if "onset" in r5_resource:
            onset_value = r5_resource["onset"]
            
            # Check if we stored the original field type for round-trip fidelity
            if "_onsetFieldType" in r5_resource:
                original_field = r5_resource["_onsetFieldType"]
                r4_resource[original_field] = onset_value
            else:
                # Fallback: guess the field type based on value
                if isinstance(onset_value, str) and "T" in onset_value:
                    # Looks like a datetime
                    r4_resource["onsetDateTime"] = onset_value
                else:
                    # Generic onset
                    r4_resource["onset"] = onset_value
        
        # Transform type: CodeableConcept → string
        if "type" in r5_resource:
            r4_resource["type"] = self._transform_type_r5_to_r4(r5_resource["type"])
        
        # Transform category (reverse concept mapping - same values in this case)
        if "category" in r5_resource:
            r4_resource["category"] = r5_resource["category"]  # Same values R4↔R5
        
        # Transform criticality (reverse concept mapping - same values)
        if "criticality" in r5_resource:
            r4_resource["criticality"] = r5_resource["criticality"]  # Same values R4↔R5
        
        # Transform participant array → recorder/asserter
        if "participant" in r5_resource:
            recorder_ref, asserter_ref = self._extract_participants_to_r4(r5_resource["participant"])
            
            if recorder_ref:
                r4_resource["recorder"] = recorder_ref
            if asserter_ref:
                r4_resource["asserter"] = asserter_ref
        
        # Transform reaction array (reverse severity translation)
        if "reaction" in r5_resource:
            r4_resource["reaction"] = []
            for r5_reaction in r5_resource["reaction"]:
                r4_reaction = {}
                
                # Direct reaction mappings
                reaction_direct_fields = [
                    "substance", "manifestation", "description",
                    "onset", "exposureRoute", "note"
                ]
                
                for field in reaction_direct_fields:
                    if field in r5_reaction:
                        r4_reaction[field] = r5_reaction[field]
                
                # Transform severity (reverse mapping - same values)
                if "severity" in r5_reaction:
                    r4_reaction["severity"] = r5_reaction["severity"]  # Same values R4↔R5
                
                r4_resource["reaction"].append(r4_reaction)
        
        logger.info("✅ R5→R4 conversion completed successfully")
        return r4_resource
    
    def validate_round_trip(self, original: Dict[str, Any], converted_back: Dict[str, Any], 
                          ignore_fields: List[str] = None) -> tuple[bool, List[str]]:
        """
        Validate round-trip conversion fidelity
        
        Args:
            original: Original R4 resource
            converted_back: Resource after R4→R5→R4 conversion
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
    
    def transform_resource(self, source_resource: Dict[str, Any], 
                         source_version: str = "4.0", 
                         target_version: str = "5.0") -> Dict[str, Any]:
        """
        Transform a FHIR resource between versions using StructureMap
        
        Args:
            source_resource: Input FHIR resource as dict
            source_version: Source FHIR version (e.g., "4.0")
            target_version: Target FHIR version (e.g., "5.0")
            
        Returns:
            Transformed FHIR resource as dict
        """
        resource_type = source_resource.get("resourceType")
        
        if resource_type == "AllergyIntolerance":
            # Use the original AllergyIntolerance implementation for backward compatibility
            if source_version == "4.0" and target_version == "5.0":
                return self.convert_allergy_r4_to_r5(source_resource)
            elif source_version == "5.0" and target_version == "4.0":
                return self.convert_allergy_r5_to_r4(source_resource)
            else:
                raise ValueError(f"Unsupported conversion: {source_version} → {target_version}")
        else:
            # Use generic processor for all other resources
            from fhir.core.generic_structure_map_processor import GenericStructureMapProcessor
            
            # Initialize generic processor with the same maps directory
            generic_processor = GenericStructureMapProcessor(str(self.maps_dir))
            
            # Delegate to generic processor
            return generic_processor.transform_resource(
                source_resource, source_version, target_version
            )