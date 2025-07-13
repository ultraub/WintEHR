#!/usr/bin/env python3
"""
FHIR Resource Converter Factory

Provides centralized access to all official StructureMap-based converters.
Auto-generated from available StructureMaps.
"""

import logging
from typing import Dict, Any, Type, Optional

from .allergy_intolerance_converter import AllergyIntoleranceConverter
from .bundle_converter import BundleConverter
from .care_plan_converter import CarePlanConverter
from .care_team_converter import CareTeamConverter
from .communication_converter import CommunicationConverter
from .composition_converter import CompositionConverter
from .condition_converter import ConditionConverter
from .coverage_converter import CoverageConverter
from .device_converter import DeviceConverter
from .device_request_converter import DeviceRequestConverter
from .diagnostic_report_converter import DiagnosticReportConverter
from .encounter_converter import EncounterConverter
from .flag_converter import FlagConverter
from .goal_converter import GoalConverter
from .immunization_converter import ImmunizationConverter
from .list_converter import ListConverter
from .location_converter import LocationConverter
from .medication_converter import MedicationConverter
from .medication_administration_converter import MedicationAdministrationConverter
from .medication_dispense_converter import MedicationDispenseConverter
from .medication_request_converter import MedicationRequestConverter
from .medication_statement_converter import MedicationStatementConverter
from .observation_converter import ObservationConverter
from .organization_converter import OrganizationConverter
from .patient_converter import PatientConverter
from .practitioner_converter import PractitionerConverter
from .practitioner_role_converter import PractitionerRoleConverter
from .procedure_converter import ProcedureConverter
from .service_request_converter import ServiceRequestConverter

logger = logging.getLogger(__name__)

class FHIRConverterFactory:
    """
    Factory for creating FHIR resource converters
    
    Provides centralized access to all available converters based on
    official HL7 StructureMaps for R4↔R5 conversions.
    """
    
    # Registry of all available converters
    CONVERTERS: Dict[str, Type] = {
        "AllergyIntolerance": AllergyIntoleranceConverter,
        "Bundle": BundleConverter,
        "CarePlan": CarePlanConverter,
        "CareTeam": CareTeamConverter,
        "Communication": CommunicationConverter,
        "Composition": CompositionConverter,
        "Condition": ConditionConverter,
        "Coverage": CoverageConverter,
        "Device": DeviceConverter,
        "DeviceRequest": DeviceRequestConverter,
        "DiagnosticReport": DiagnosticReportConverter,
        "Encounter": EncounterConverter,
        "Flag": FlagConverter,
        "Goal": GoalConverter,
        "Immunization": ImmunizationConverter,
        "List": ListConverter,
        "Location": LocationConverter,
        "Medication": MedicationConverter,
        "MedicationAdministration": MedicationAdministrationConverter,
        "MedicationDispense": MedicationDispenseConverter,
        "MedicationRequest": MedicationRequestConverter,
        "MedicationStatement": MedicationStatementConverter,
        "Observation": ObservationConverter,
        "Organization": OrganizationConverter,
        "Patient": PatientConverter,
        "Practitioner": PractitionerConverter,
        "PractitionerRole": PractitionerRoleConverter,
        "Procedure": ProcedureConverter,
        "ServiceRequest": ServiceRequestConverter,
    }
    
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
            raise ValueError(f"Converter not available for {resource_type}. Available: {available}")
        
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
        results = {}
        
        logger.info(f"Testing {len(cls.CONVERTERS)} converters...")
        
        for resource_type in sorted(cls.CONVERTERS.keys()):
            logger.info(f"Testing {resource_type} converter...")
            
            try:
                converter_class = cls.CONVERTERS[resource_type]
                test_result = converter_class.test_with_official_example()
                results[resource_type] = test_result
                
                if test_result.get("success"):
                    fidelity = test_result.get("round_trip_fidelity", False)
                    diff_count = test_result.get("differences_count", 0)
                    logger.info(f"  ✅ {resource_type}: fidelity={fidelity}, differences={diff_count}")
                else:
                    error = test_result.get("error", "Unknown error")
                    logger.error(f"  ❌ {resource_type}: {error}")
                    
            except Exception as e:
                logger.error(f"  ❌ {resource_type}: Exception during test - {e}")
                results[resource_type] = {
                    "success": False,
                    "error": str(e)
                }
        
        # Summary
        successful = sum(1 for r in results.values() if r.get("success"))
        perfect_fidelity = sum(1 for r in results.values() 
                             if r.get("success") and r.get("round_trip_fidelity"))
        
        logger.info(f"✅ {successful}/{len(results)} converters working")
        logger.info(f"🎯 {perfect_fidelity}/{successful} have perfect round-trip fidelity")
        
        return results


# Export factory and all converter types
__all__ = ["FHIRConverterFactory"] + [f"{resource_type}Converter" for resource_type in FHIRConverterFactory.CONVERTERS.keys()]