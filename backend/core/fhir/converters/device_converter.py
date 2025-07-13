#!/usr/bin/env python3
"""
Official FHIR StructureMap-based Device R4↔R5 converter

Implements the official HL7 StructureMap transformations:
- http://hl7.org/fhir/StructureMap/Device4to5
- http://hl7.org/fhir/StructureMap/Device5to4

Generated automatically from official FHIR StructureMaps.
"""

import logging
from typing import Dict, Any, Tuple, List
from pathlib import Path
from ..structure_map_processor import StructureMapProcessor

logger = logging.getLogger(__name__)

class DeviceConverter:
    """
    Official StructureMap-based converter for Device resources
    
    Features:
    - Official HL7 StructureMap compliance
    - Proper handling of polymorphic fields
    - Terminology translation via ConceptMaps
    - Round-trip conversion validation
    """
    
    def __init__(self):
        """Initialize with StructureMap processor"""
        # Get path to StructureMaps relative to this file
        base_dir = Path(__file__).parent.parent
        maps_dir = base_dir / "official_resources/structure_maps"
        
        self.processor = StructureMapProcessor(str(maps_dir))
        self.resource_type = "Device"
        logger.info(f"✅ {self.resource_type} converter initialized with official StructureMaps")
    
    def convert_r4_to_r5(self, r4_resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert Device from R4 to R5 format using official StructureMap
        
        Args:
            r4_resource: R4 Device resource
            
        Returns:
            R5 Device resource
            
        Raises:
            ValueError: If resource is not Device
        """
        if r4_resource.get("resourceType") != self.resource_type:
            raise ValueError(f"Expected {self.resource_type}, got {r4_resource.get('resourceType')}")
        
        logger.debug(f"Converting {self.resource_type} R4→R5: {r4_resource.get('id', 'unknown')}")
        
        # Use the base processor with resource-specific StructureMap
        r5_resource = self.processor.transform_resource(
            r4_resource,
            source_version="4.0",
            target_version="5.0"
        )
        
        logger.debug("✅ R4→R5 conversion completed")
        return r5_resource
    
    def convert_r5_to_r4(self, r5_resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert Device from R5 to R4 format using official StructureMap
        
        Args:
            r5_resource: R5 Device resource
            
        Returns:
            R4 Device resource
            
        Raises:
            ValueError: If resource is not Device
        """
        if r5_resource.get("resourceType") != self.resource_type:
            raise ValueError(f"Expected {self.resource_type}, got {r5_resource.get('resourceType')}")
        
        logger.debug(f"Converting {self.resource_type} R5→R4: {r5_resource.get('id', 'unknown')}")
        
        # Use the base processor with resource-specific StructureMap
        r4_resource = self.processor.transform_resource(
            r5_resource,
            source_version="5.0",
            target_version="4.0"
        )
        
        logger.debug("✅ R5→R4 conversion completed")
        return r4_resource
    
    def validate_round_trip(self, original_r4: Dict[str, Any], 
                          ignore_fields: List[str] = None) -> Tuple[bool, List[str]]:
        """
        Validate round-trip conversion fidelity: R4 → R5 → R4
        
        Args:
            original_r4: Original R4 resource
            ignore_fields: Fields to ignore in validation
            
        Returns:
            Tuple of (is_valid, differences_list)
        """
        # Perform round-trip conversion
        r5_converted = self.convert_r4_to_r5(original_r4)
        r4_round_trip = self.convert_r5_to_r4(r5_converted)
        
        # Validate fidelity
        return self.processor.validate_round_trip(
            original_r4, 
            r4_round_trip, 
            ignore_fields
        )
    
    @classmethod
    def test_with_official_example(cls) -> Dict[str, Any]:
        """
        Test converter with official FHIR example
        
        Returns:
            Test results dictionary
        """
        # Load official R4 example
        base_dir = Path(__file__).parent.parent
        r4_example_path = base_dir / "official_resources/r4/Device.json"
        
        if not r4_example_path.exists():
            return {
                "success": False,
                "error": f"Official R4 example not found: {r4_example_path}"
            }
        
        import json
        with open(r4_example_path) as f:
            r4_example = json.load(f)
        
        # Create converter and test
        converter = cls()
        
        try:
            # Test conversion
            r5_converted = converter.convert_r4_to_r5(r4_example)
            r4_round_trip = converter.convert_r5_to_r4(r5_converted)
            
            # Validate fidelity
            is_valid, differences = converter.validate_round_trip(r4_example)
            
            return {
                "success": True,
                "round_trip_fidelity": is_valid,
                "differences_count": len(differences),
                "differences": differences,
                "r4_fields": list(r4_example.keys()),
                "r5_fields": list(r5_converted.keys()),
                "round_trip_fields": list(r4_round_trip.keys())
            }
            
        except Exception as e:
            logger.error(f"Converter test failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Integration functions for version-aware storage

async def convert_device_r4_to_r5(resource_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Async wrapper for version-aware storage integration
    
    Args:
        resource_data: R4 Device resource
        
    Returns:
        R5 Device resource
    """
    converter = DeviceConverter()
    return converter.convert_r4_to_r5(resource_data)


async def convert_device_r5_to_r4(resource_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Async wrapper for version-aware storage integration
    
    Args:
        resource_data: R5 Device resource
        
    Returns:
        R4 Device resource
    """
    converter = DeviceConverter()
    return converter.convert_r5_to_r4(resource_data)


# Export converter class and integration functions
__all__ = [
    "DeviceConverter",
    "convert_device_r4_to_r5", 
    "convert_device_r5_to_r4"
]