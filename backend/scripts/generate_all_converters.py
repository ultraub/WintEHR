#!/usr/bin/env python3
"""
Generate official StructureMap-based converters for all FHIR resources

This script analyzes the downloaded StructureMaps and generates Python converters
for all resources that have official R4↔R5 transformation definitions.

Based on the AllergyIntolerance converter pattern, this creates a comprehensive
converter system for the entire FHIR ecosystem.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Set
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConverterGenerator:
    """Generate FHIR resource converters from official StructureMaps"""
    
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.structure_maps_dir = base_dir / "core/fhir/official_resources/structure_maps"
        self.converters_dir = base_dir / "core/fhir/converters"
        self.official_resources_dir = base_dir / "core/fhir/official_resources"
        
        # Ensure converters directory exists
        self.converters_dir.mkdir(exist_ok=True)
        
        # Resource types that have official StructureMaps
        self.available_resources = self._discover_structure_maps()
        
        logger.info(f"Discovered {len(self.available_resources)} resources with StructureMaps")
    
    def _discover_structure_maps(self) -> Set[str]:
        """Discover which resources have official StructureMaps"""
        resources = set()
        
        # Check 4to5 directory
        maps_4to5 = self.structure_maps_dir / "4to5"
        if maps_4to5.exists():
            for map_file in maps_4to5.glob("*.json"):
                # Extract resource name from filename (e.g., "Patient4to5.json" -> "Patient")
                resource_name = map_file.stem.replace("4to5", "")
                resources.add(resource_name)
        
        return resources
    
    def _snake_case(self, name: str) -> str:
        """Convert PascalCase to snake_case"""
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
    
    def _generate_converter_content(self, resource_type: str) -> str:
        """Generate converter Python code for a specific resource type"""
        snake_case_name = self._snake_case(resource_type)
        
        template = f'''#!/usr/bin/env python3
"""
Official FHIR StructureMap-based {resource_type} R4↔R5 converter

Implements the official HL7 StructureMap transformations:
- http://hl7.org/fhir/StructureMap/{resource_type}4to5
- http://hl7.org/fhir/StructureMap/{resource_type}5to4

Generated automatically from official FHIR StructureMaps.
"""

import logging
from typing import Dict, Any, Tuple, List
from pathlib import Path
from ..structure_map_processor import StructureMapProcessor

logger = logging.getLogger(__name__)

class {resource_type}Converter:
    """
    Official StructureMap-based converter for {resource_type} resources
    
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
        self.resource_type = "{resource_type}"
        logger.info(f"✅ {{self.resource_type}} converter initialized with official StructureMaps")
    
    def convert_r4_to_r5(self, r4_resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert {resource_type} from R4 to R5 format using official StructureMap
        
        Args:
            r4_resource: R4 {resource_type} resource
            
        Returns:
            R5 {resource_type} resource
            
        Raises:
            ValueError: If resource is not {resource_type}
        """
        if r4_resource.get("resourceType") != self.resource_type:
            raise ValueError(f"Expected {{self.resource_type}}, got {{r4_resource.get('resourceType')}}")
        
        logger.debug(f"Converting {{self.resource_type}} R4→R5: {{r4_resource.get('id', 'unknown')}}")
        
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
        Convert {resource_type} from R5 to R4 format using official StructureMap
        
        Args:
            r5_resource: R5 {resource_type} resource
            
        Returns:
            R4 {resource_type} resource
            
        Raises:
            ValueError: If resource is not {resource_type}
        """
        if r5_resource.get("resourceType") != self.resource_type:
            raise ValueError(f"Expected {{self.resource_type}}, got {{r5_resource.get('resourceType')}}")
        
        logger.debug(f"Converting {{self.resource_type}} R5→R4: {{r5_resource.get('id', 'unknown')}}")
        
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
        r4_example_path = base_dir / "official_resources/r4/{resource_type}.json"
        
        if not r4_example_path.exists():
            return {{
                "success": False,
                "error": f"Official R4 example not found: {{r4_example_path}}"
            }}
        
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
            
            return {{
                "success": True,
                "round_trip_fidelity": is_valid,
                "differences_count": len(differences),
                "differences": differences,
                "r4_fields": list(r4_example.keys()),
                "r5_fields": list(r5_converted.keys()),
                "round_trip_fields": list(r4_round_trip.keys())
            }}
            
        except Exception as e:
            logger.error(f"Converter test failed: {{e}}")
            return {{
                "success": False,
                "error": str(e)
            }}


# Integration functions for version-aware storage

async def convert_{snake_case_name}_r4_to_r5(resource_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Async wrapper for version-aware storage integration
    
    Args:
        resource_data: R4 {resource_type} resource
        
    Returns:
        R5 {resource_type} resource
    """
    converter = {resource_type}Converter()
    return converter.convert_r4_to_r5(resource_data)


async def convert_{snake_case_name}_r5_to_r4(resource_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Async wrapper for version-aware storage integration
    
    Args:
        resource_data: R5 {resource_type} resource
        
    Returns:
        R4 {resource_type} resource
    """
    converter = {resource_type}Converter()
    return converter.convert_r5_to_r4(resource_data)


# Export converter class and integration functions
__all__ = [
    "{resource_type}Converter",
    "convert_{snake_case_name}_r4_to_r5", 
    "convert_{snake_case_name}_r5_to_r4"
]'''
        
        return template
    
    def generate_converter(self, resource_type: str) -> bool:
        """Generate a converter file for a specific resource type"""
        try:
            # Generate converter content
            content = self._generate_converter_content(resource_type)
            
            # Write to file
            snake_case_name = self._snake_case(resource_type)
            converter_file = self.converters_dir / f"{snake_case_name}_converter.py"
            
            with open(converter_file, 'w') as f:
                f.write(content)
            
            logger.info(f"✅ Generated converter: {converter_file}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to generate converter for {resource_type}: {e}")
            return False
    
    def generate_all_converters(self) -> Dict[str, bool]:
        """Generate converters for all available resources"""
        results = {}
        
        logger.info(f"Generating converters for {len(self.available_resources)} resources...")
        
        for resource_type in sorted(self.available_resources):
            logger.info(f"Generating converter for {resource_type}...")
            results[resource_type] = self.generate_converter(resource_type)
        
        # Generate summary
        successful = sum(1 for success in results.values() if success)
        failed = len(results) - successful
        
        logger.info(f"✅ Successfully generated {successful} converters")
        if failed > 0:
            logger.warning(f"⚠️ Failed to generate {failed} converters")
        
        return results
    
    def generate_converter_factory(self) -> str:
        """Generate a factory class to manage all converters"""
        
        # Import statements for all converters
        imports = []
        factory_mappings = []
        
        for resource_type in sorted(self.available_resources):
            snake_case_name = self._snake_case(resource_type)
            imports.append(f"from .{snake_case_name}_converter import {resource_type}Converter")
            factory_mappings.append(f'        "{resource_type}": {resource_type}Converter,')
        
        imports_str = "\n".join(imports)
        mappings_str = "\n".join(factory_mappings)
        
        factory_content = f'''#!/usr/bin/env python3
"""
FHIR Resource Converter Factory

Provides centralized access to all official StructureMap-based converters.
Auto-generated from available StructureMaps.
"""

import logging
from typing import Dict, Any, Type, Optional

{imports_str}

logger = logging.getLogger(__name__)

class FHIRConverterFactory:
    """
    Factory for creating FHIR resource converters
    
    Provides centralized access to all available converters based on
    official HL7 StructureMaps for R4↔R5 conversions.
    """
    
    # Registry of all available converters
    CONVERTERS: Dict[str, Type] = {{
{mappings_str}
    }}
    
    @classmethod
    def get_converter(cls, resource_type: str):
        """
        Get converter instance for a specific resource type
        
        Args:
            resource_type: FHIR resource type (e.g., "Patient", "AllergyIntolerance")
            
        Returns:
            Converter instance
            
        Raises:
            ValueError: If resource type not supported
        """
        if resource_type not in cls.CONVERTERS:
            available = ", ".join(sorted(cls.CONVERTERS.keys()))
            raise ValueError(f"Converter not available for {{resource_type}}. Available: {{available}}")
        
        converter_class = cls.CONVERTERS[resource_type]
        return converter_class()
    
    @classmethod
    def get_supported_resources(cls) -> list:
        """Get list of all supported resource types"""
        return sorted(cls.CONVERTERS.keys())
    
    @classmethod
    def convert_resource_r4_to_r5(cls, resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert any supported resource from R4 to R5
        
        Args:
            resource: R4 FHIR resource
            
        Returns:
            R5 FHIR resource
        """
        resource_type = resource.get("resourceType")
        if not resource_type:
            raise ValueError("Resource missing resourceType field")
        
        converter = cls.get_converter(resource_type)
        return converter.convert_r4_to_r5(resource)
    
    @classmethod  
    def convert_resource_r5_to_r4(cls, resource: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert any supported resource from R5 to R4
        
        Args:
            resource: R5 FHIR resource
            
        Returns:
            R4 FHIR resource
        """
        resource_type = resource.get("resourceType")
        if not resource_type:
            raise ValueError("Resource missing resourceType field")
        
        converter = cls.get_converter(resource_type)
        return converter.convert_r5_to_r4(resource)
    
    @classmethod
    def validate_all_converters(cls) -> Dict[str, Dict[str, Any]]:
        """
        Test all converters with their official examples
        
        Returns:
            Dictionary of test results by resource type
        """
        results = {{}}
        
        logger.info(f"Testing {{len(cls.CONVERTERS)}} converters...")
        
        for resource_type in sorted(cls.CONVERTERS.keys()):
            logger.info(f"Testing {{resource_type}} converter...")
            
            try:
                converter_class = cls.CONVERTERS[resource_type]
                test_result = converter_class.test_with_official_example()
                results[resource_type] = test_result
                
                if test_result.get("success"):
                    fidelity = test_result.get("round_trip_fidelity", False)
                    diff_count = test_result.get("differences_count", 0)
                    logger.info(f"  ✅ {{resource_type}}: fidelity={{fidelity}}, differences={{diff_count}}")
                else:
                    error = test_result.get("error", "Unknown error")
                    logger.error(f"  ❌ {{resource_type}}: {{error}}")
                    
            except Exception as e:
                logger.error(f"  ❌ {{resource_type}}: Exception during test - {{e}}")
                results[resource_type] = {{
                    "success": False,
                    "error": str(e)
                }}
        
        # Summary
        successful = sum(1 for r in results.values() if r.get("success"))
        perfect_fidelity = sum(1 for r in results.values() 
                             if r.get("success") and r.get("round_trip_fidelity"))
        
        logger.info(f"✅ {{successful}}/{{len(results)}} converters working")
        logger.info(f"🎯 {{perfect_fidelity}}/{{successful}} have perfect round-trip fidelity")
        
        return results


# Export factory and all converter types
__all__ = ["FHIRConverterFactory"] + [f"{{resource_type}}Converter" for resource_type in FHIRConverterFactory.CONVERTERS.keys()]'''
        
        return factory_content
    
    def create_factory_file(self) -> bool:
        """Create the converter factory file"""
        try:
            factory_content = self.generate_converter_factory()
            factory_file = self.converters_dir / "factory.py"
            
            with open(factory_file, 'w') as f:
                f.write(factory_content)
            
            logger.info(f"✅ Generated converter factory: {factory_file}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to generate converter factory: {e}")
            return False
    
    def create_init_file(self) -> bool:
        """Create __init__.py for the converters package"""
        try:
            init_content = '''"""
FHIR Resource Converters

Official StructureMap-based converters for all FHIR resources with
available R4↔R5 transformation definitions.
"""

from .factory import FHIRConverterFactory

__all__ = ["FHIRConverterFactory"]
'''
            
            init_file = self.converters_dir / "__init__.py"
            with open(init_file, 'w') as f:
                f.write(init_content)
            
            logger.info(f"✅ Generated __init__.py: {init_file}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to generate __init__.py: {e}")
            return False


def main():
    """Main execution function"""
    # Get base directory (backend/)
    script_dir = Path(__file__).parent
    base_dir = script_dir.parent
    
    logger.info("🚀 Starting FHIR converter generation...")
    logger.info(f"Base directory: {base_dir}")
    
    # Create generator
    generator = ConverterGenerator(base_dir)
    
    # Generate all converters
    results = generator.generate_all_converters()
    
    # Create factory and __init__.py
    generator.create_factory_file()
    generator.create_init_file()
    
    # Final summary
    successful = sum(1 for success in results.values() if success)
    total = len(results)
    
    logger.info("=" * 60)
    logger.info(f"🎉 Converter generation complete!")
    logger.info(f"✅ Generated {successful}/{total} resource converters")
    logger.info(f"📁 Converters saved to: {generator.converters_dir}")
    
    if successful < total:
        failed_resources = [resource for resource, success in results.items() if not success]
        logger.warning(f"❌ Failed resources: {', '.join(failed_resources)}")
    
    logger.info("Next steps:")
    logger.info("1. Test converters: python -c 'from core.fhir.converters import FHIRConverterFactory; FHIRConverterFactory.validate_all_converters()'")
    logger.info("2. Use factory: FHIRConverterFactory.get_converter('Patient')")
    logger.info("3. Integrate with version-aware storage")


if __name__ == "__main__":
    main()