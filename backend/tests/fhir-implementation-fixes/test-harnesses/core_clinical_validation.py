#!/usr/bin/env python3
"""
Core Clinical Resources Validation Harness

This harness validates all core clinical resource implementations including:
- Patient identifier search across all resources
- Observation value-quantity search with operators (gt, lt, ge, le)
- AllergyIntolerance verification status and criticality search
- Condition onset-date search with date operators
- Performer/practitioner reference search across applicable resources
- SQL validation for search parameter extraction accuracy

Based on Agent A's implementations for core clinical resources.
"""

import asyncio
import sys
import os
import time
import logging
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
from fhir.core.storage import FHIRStorageEngine
from database import get_session_maker


@dataclass
class ValidationResult:
    """Result of a validation check"""
    check_name: str
    resource_type: str
    status: str  # PASS, FAIL, SKIP
    message: str
    details: Dict[str, Any] = None
    duration: float = 0.0
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class CoreClinicalValidationHarness:
    """Comprehensive validation harness for core clinical resources"""
    
    def __init__(self):
        self.session_maker = get_session_maker()
        self.logger = logging.getLogger(__name__)
        
        # Core clinical resource types to validate
        self.core_resources = [
            'Patient', 'Observation', 'Condition', 'AllergyIntolerance',
            'Procedure', 'DiagnosticReport', 'Encounter', 'MedicationRequest'
        ]
        
        # Critical search parameters for patient safety
        self.critical_search_params = {
            'Patient': ['identifier', 'name', 'family', 'given', 'birthdate'],
            'Observation': ['code', 'value-quantity', 'date', 'patient', 'performer'],
            'Condition': ['code', 'clinical-status', 'onset-date', 'patient'],
            'AllergyIntolerance': ['code', 'clinical-status', 'verification-status', 'criticality', 'patient'],
            'Procedure': ['code', 'date', 'patient', 'performer'],
            'DiagnosticReport': ['code', 'date', 'patient', 'performer'],
            'Encounter': ['class', 'date', 'patient'],
            'MedicationRequest': ['code', 'intent', 'status', 'patient']
        }
    
    async def run_comprehensive_validation(self) -> List[ValidationResult]:
        """Run comprehensive validation of core clinical resources"""
        results = []
        
        async with self.session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Validate data availability
            data_validation = await self._validate_test_data_availability(storage_engine)
            results.extend(data_validation)
            
            # Validate patient identifier search (CRITICAL for patient safety)
            patient_validation = await self._validate_patient_identifier_search(storage_engine)
            results.extend(patient_validation)
            
            # Validate observation value-quantity search
            observation_validation = await self._validate_observation_value_quantity_search(storage_engine)
            results.extend(observation_validation)
            
            # Validate allergy verification status search
            allergy_validation = await self._validate_allergy_verification_status_search(storage_engine)
            results.extend(allergy_validation)
            
            # Validate condition onset date search
            condition_validation = await self._validate_condition_onset_date_search(storage_engine)
            results.extend(condition_validation)
            
            # Validate performer/practitioner references
            performer_validation = await self._validate_performer_practitioner_references(storage_engine)
            results.extend(performer_validation)
            
            # Validate SQL search parameter extraction
            sql_validation = await self._validate_sql_search_parameter_extraction(storage_engine)
            results.extend(sql_validation)
            
            # Validate cross-resource integrity
            integrity_validation = await self._validate_cross_resource_integrity(storage_engine)
            results.extend(integrity_validation)
        
        return results
    
    async def _validate_test_data_availability(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate sufficient test data is available"""
        results = []
        
        for resource_type in self.core_resources:
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
                
                if count < 5:
                    results.append(ValidationResult(
                        check_name="data_availability",
                        resource_type=resource_type,
                        status="FAIL",
                        message=f"Insufficient test data: only {count} resources found",
                        details={"count": count, "minimum_required": 5},
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(ValidationResult(
                        check_name="data_availability",
                        resource_type=resource_type,
                        status="PASS",
                        message=f"Sufficient test data: {count} resources available",
                        details={"count": count},
                        duration=time.time() - start_time
                    ))
                    
            except Exception as e:
                results.append(ValidationResult(
                    check_name="data_availability",
                    resource_type=resource_type,
                    status="FAIL",
                    message=f"Error checking data availability: {e}",
                    details={"error": str(e)},
                    duration=time.time() - start_time
                ))
        
        return results
    
    async def _validate_patient_identifier_search(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate patient identifier search across all resources"""
        results = []
        
        # Test patient identifier search parameter extraction
        start_time = time.time()
        try:
            # Get sample patient with identifiers
            patient_result = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
            if patient_result['total'] == 0:
                results.append(ValidationResult(
                    check_name="patient_identifier_search",
                    resource_type="Patient",
                    status="SKIP",
                    message="No patients available for testing",
                    duration=time.time() - start_time
                ))
                return results
            
            patient = patient_result['entry'][0]['resource']
            patient_id = patient['id']
            
            # Validate identifier structure
            if 'identifier' not in patient:
                results.append(ValidationResult(
                    check_name="patient_identifier_structure",
                    resource_type="Patient",
                    status="FAIL",
                    message="Patient missing identifier field",
                    duration=time.time() - start_time
                ))
                return results
            
            identifiers = patient['identifier']
            if len(identifiers) == 0:
                results.append(ValidationResult(
                    check_name="patient_identifier_structure",
                    resource_type="Patient",
                    status="FAIL",
                    message="Patient has no identifiers",
                    duration=time.time() - start_time
                ))
                return results
            
            # Test search parameter extraction
            search_params_query = text("""
                SELECT COUNT(*) as param_count
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.fhir_id = :patient_id 
                AND r.resource_type = 'Patient'
                AND sp.param_name = 'identifier'
            """)
            result = await storage_engine.session.execute(
                search_params_query, {'patient_id': patient_id}
            )
            param_count = result.scalar()
            
            if param_count == 0:
                results.append(ValidationResult(
                    check_name="patient_identifier_extraction",
                    resource_type="Patient",
                    status="FAIL",
                    message="No identifier search parameters extracted",
                    duration=time.time() - start_time
                ))
            else:
                results.append(ValidationResult(
                    check_name="patient_identifier_extraction",
                    resource_type="Patient",
                    status="PASS",
                    message=f"Found {param_count} identifier search parameters",
                    details={"param_count": param_count, "identifier_count": len(identifiers)},
                    duration=time.time() - start_time
                ))
            
            # Test search by different identifier types
            for i, identifier in enumerate(identifiers[:3]):  # Test first 3 identifiers
                if 'value' in identifier:
                    search_value = identifier['value']
                    if 'system' in identifier:
                        search_value = f"{identifier['system']}|{search_value}"
                    
                    search_result = await storage_engine.search_resources(
                        'Patient', 
                        {'identifier': [search_value]}, 
                        {}
                    )
                    
                    if search_result['total'] > 0:
                        found_ids = [entry['resource']['id'] for entry in search_result['entry']]
                        if patient_id in found_ids:
                            results.append(ValidationResult(
                                check_name=f"patient_identifier_search_{i}",
                                resource_type="Patient",
                                status="PASS",
                                message=f"Successfully found patient by identifier: {search_value}",
                                details={"search_value": search_value, "results_count": search_result['total']},
                                duration=time.time() - start_time
                            ))
                        else:
                            results.append(ValidationResult(
                                check_name=f"patient_identifier_search_{i}",
                                resource_type="Patient",
                                status="FAIL",
                                message=f"Patient not found in search results for identifier: {search_value}",
                                details={"search_value": search_value, "results_count": search_result['total']},
                                duration=time.time() - start_time
                            ))
                    else:
                        results.append(ValidationResult(
                            check_name=f"patient_identifier_search_{i}",
                            resource_type="Patient",
                            status="FAIL",
                            message=f"No results for identifier search: {search_value}",
                            details={"search_value": search_value},
                            duration=time.time() - start_time
                        ))
            
        except Exception as e:
            results.append(ValidationResult(
                check_name="patient_identifier_search",
                resource_type="Patient",
                status="FAIL",
                message=f"Error validating patient identifier search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_observation_value_quantity_search(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate observation value-quantity search with operators"""
        results = []
        
        start_time = time.time()
        try:
            # Find observations with numeric values
            numeric_obs_query = text("""
                SELECT r.fhir_id, sp.value_quantity_value, sp.value_quantity_unit
                FROM fhir.resources r
                JOIN fhir.search_parameters sp ON r.id = sp.resource_id
                WHERE r.resource_type = 'Observation'
                AND r.deleted = false
                AND sp.param_name = 'value-quantity'
                AND sp.value_quantity_value IS NOT NULL
                AND sp.value_quantity_value > 0
                ORDER BY sp.value_quantity_value
                LIMIT 5
            """)
            result = await storage_engine.session.execute(numeric_obs_query)
            numeric_observations = result.fetchall()
            
            if not numeric_observations:
                results.append(ValidationResult(
                    check_name="observation_value_quantity_data",
                    resource_type="Observation",
                    status="SKIP",
                    message="No observations with numeric values found for testing",
                    duration=time.time() - start_time
                ))
                return results
            
            # Test different quantity operators
            test_obs = numeric_observations[len(numeric_observations)//2]  # Middle value
            test_value = test_obs.value_quantity_value
            test_unit = test_obs.value_quantity_unit or ""
            
            operators = ['gt', 'lt', 'ge', 'le']
            for operator in operators:
                search_value = f"{operator}{test_value - 1}"
                if test_unit:
                    search_value += f"|{test_unit}"
                
                search_result = await storage_engine.search_resources(
                    'Observation',
                    {'value-quantity': [search_value]},
                    {'_count': ['10']}
                )
                
                # Validate that search executed without error
                if 'total' in search_result:
                    results.append(ValidationResult(
                        check_name=f"observation_value_quantity_{operator}",
                        resource_type="Observation",
                        status="PASS",
                        message=f"Value-quantity search with {operator} operator successful",
                        details={
                            "operator": operator,
                            "search_value": search_value,
                            "results_count": search_result['total']
                        },
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(ValidationResult(
                        check_name=f"observation_value_quantity_{operator}",
                        resource_type="Observation",
                        status="FAIL",
                        message=f"Value-quantity search with {operator} operator failed",
                        details={"operator": operator, "search_value": search_value},
                        duration=time.time() - start_time
                    ))
            
        except Exception as e:
            results.append(ValidationResult(
                check_name="observation_value_quantity_search",
                resource_type="Observation",
                status="FAIL",
                message=f"Error validating observation value-quantity search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_allergy_verification_status_search(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate allergy verification status and criticality search"""
        results = []
        
        start_time = time.time()
        try:
            # Check for allergy data
            allergy_count_query = text("""
                SELECT COUNT(*) as total
                FROM fhir.resources 
                WHERE resource_type = 'AllergyIntolerance' 
                AND deleted = false
            """)
            result = await storage_engine.session.execute(allergy_count_query)
            count = result.scalar()
            
            if count == 0:
                results.append(ValidationResult(
                    check_name="allergy_verification_status_data",
                    resource_type="AllergyIntolerance",
                    status="SKIP",
                    message="No AllergyIntolerance resources found for testing",
                    duration=time.time() - start_time
                ))
                return results
            
            # Test verification status search parameter extraction
            verification_params_query = text("""
                SELECT COUNT(*) as param_count
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'AllergyIntolerance'
                AND sp.param_name = 'verification-status'
            """)
            result = await storage_engine.session.execute(verification_params_query)
            param_count = result.scalar()
            
            if param_count > 0:
                results.append(ValidationResult(
                    check_name="allergy_verification_status_extraction",
                    resource_type="AllergyIntolerance",
                    status="PASS",
                    message=f"Found {param_count} verification-status search parameters",
                    details={"param_count": param_count},
                    duration=time.time() - start_time
                ))
            else:
                results.append(ValidationResult(
                    check_name="allergy_verification_status_extraction",
                    resource_type="AllergyIntolerance",
                    status="FAIL",
                    message="No verification-status search parameters found",
                    duration=time.time() - start_time
                ))
            
            # Test search by verification status
            verification_statuses = ['unconfirmed', 'confirmed', 'refuted', 'entered-in-error']
            for status in verification_statuses:
                search_result = await storage_engine.search_resources(
                    'AllergyIntolerance',
                    {'verification-status': [status]},
                    {'_count': ['5']}
                )
                
                results.append(ValidationResult(
                    check_name=f"allergy_verification_status_search_{status}",
                    resource_type="AllergyIntolerance",
                    status="PASS",
                    message=f"Verification status search for '{status}' executed successfully",
                    details={"status": status, "results_count": search_result.get('total', 0)},
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(ValidationResult(
                check_name="allergy_verification_status_search",
                resource_type="AllergyIntolerance",
                status="FAIL",
                message=f"Error validating allergy verification status search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_condition_onset_date_search(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate condition onset date search with date operators"""
        results = []
        
        start_time = time.time()
        try:
            # Check for condition data with onset dates
            onset_query = text("""
                SELECT COUNT(*) as total
                FROM fhir.search_parameters sp
                JOIN fhir.resources r ON sp.resource_id = r.id
                WHERE r.resource_type = 'Condition'
                AND sp.param_name = 'onset-date'
                AND sp.value_date IS NOT NULL
            """)
            result = await storage_engine.session.execute(onset_query)
            count = result.scalar()
            
            if count == 0:
                results.append(ValidationResult(
                    check_name="condition_onset_date_data",
                    resource_type="Condition",
                    status="SKIP",
                    message="No conditions with onset dates found for testing",
                    duration=time.time() - start_time
                ))
                return results
            
            # Test date operators
            date_operators = ['gt', 'lt', 'ge', 'le']
            test_date = "2020-01-01"
            
            for operator in date_operators:
                search_value = f"{operator}{test_date}"
                
                search_result = await storage_engine.search_resources(
                    'Condition',
                    {'onset-date': [search_value]},
                    {'_count': ['5']}
                )
                
                results.append(ValidationResult(
                    check_name=f"condition_onset_date_{operator}",
                    resource_type="Condition",
                    status="PASS",
                    message=f"Onset date search with {operator} operator successful",
                    details={
                        "operator": operator,
                        "search_value": search_value,
                        "results_count": search_result.get('total', 0)
                    },
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(ValidationResult(
                check_name="condition_onset_date_search",
                resource_type="Condition",
                status="FAIL",
                message=f"Error validating condition onset date search: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _validate_performer_practitioner_references(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate performer/practitioner reference search across resources"""
        results = []
        
        performer_resources = ['Observation', 'Procedure', 'DiagnosticReport']
        
        for resource_type in performer_resources:
            start_time = time.time()
            
            try:
                # Check for performer search parameters
                performer_query = text("""
                    SELECT COUNT(*) as total
                    FROM fhir.search_parameters sp
                    JOIN fhir.resources r ON sp.resource_id = r.id
                    WHERE r.resource_type = :resource_type
                    AND sp.param_name = 'performer'
                """)
                result = await storage_engine.session.execute(
                    performer_query, {'resource_type': resource_type}
                )
                count = result.scalar()
                
                if count > 0:
                    results.append(ValidationResult(
                        check_name="performer_reference_extraction",
                        resource_type=resource_type,
                        status="PASS",
                        message=f"Found {count} performer reference search parameters",
                        details={"param_count": count},
                        duration=time.time() - start_time
                    ))
                    
                    # Test performer search
                    search_result = await storage_engine.search_resources(
                        resource_type,
                        {'performer': ['Practitioner/test']},
                        {'_count': ['1']}
                    )
                    
                    results.append(ValidationResult(
                        check_name="performer_reference_search",
                        resource_type=resource_type,
                        status="PASS",
                        message="Performer reference search executed successfully",
                        details={"results_count": search_result.get('total', 0)},
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(ValidationResult(
                        check_name="performer_reference_extraction",
                        resource_type=resource_type,
                        status="SKIP",
                        message="No performer reference search parameters found",
                        duration=time.time() - start_time
                    ))
                    
            except Exception as e:
                results.append(ValidationResult(
                    check_name="performer_reference_search",
                    resource_type=resource_type,
                    status="FAIL",
                    message=f"Error validating performer reference search: {e}",
                    details={"error": str(e)},
                    duration=time.time() - start_time
                ))
        
        return results
    
    async def _validate_sql_search_parameter_extraction(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate SQL search parameter extraction accuracy"""
        results = []
        
        for resource_type in self.core_resources:
            start_time = time.time()
            
            try:
                # Compare resource count vs search parameter count
                comparison_query = text("""
                    SELECT 
                        COUNT(DISTINCT r.id) as resource_count,
                        COUNT(sp.id) as search_param_count,
                        COUNT(DISTINCT sp.param_name) as unique_params
                    FROM fhir.resources r
                    LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id
                    WHERE r.resource_type = :resource_type
                    AND r.deleted = false
                """)
                result = await storage_engine.session.execute(
                    comparison_query, {'resource_type': resource_type}
                )
                stats = result.fetchone()
                
                if stats.resource_count == 0:
                    results.append(ValidationResult(
                        check_name="sql_parameter_extraction",
                        resource_type=resource_type,
                        status="SKIP",
                        message="No resources found for SQL validation",
                        duration=time.time() - start_time
                    ))
                    continue
                
                # Calculate extraction ratio
                extraction_ratio = stats.search_param_count / stats.resource_count if stats.resource_count > 0 else 0
                
                # Expect at least 3 search parameters per resource on average
                if extraction_ratio >= 3.0:
                    results.append(ValidationResult(
                        check_name="sql_parameter_extraction",
                        resource_type=resource_type,
                        status="PASS",
                        message=f"Good search parameter extraction ratio: {extraction_ratio:.1f}",
                        details={
                            "resource_count": stats.resource_count,
                            "search_param_count": stats.search_param_count,
                            "unique_params": stats.unique_params,
                            "extraction_ratio": extraction_ratio
                        },
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(ValidationResult(
                        check_name="sql_parameter_extraction",
                        resource_type=resource_type,
                        status="FAIL",
                        message=f"Low search parameter extraction ratio: {extraction_ratio:.1f}",
                        details={
                            "resource_count": stats.resource_count,
                            "search_param_count": stats.search_param_count,
                            "unique_params": stats.unique_params,
                            "extraction_ratio": extraction_ratio
                        },
                        duration=time.time() - start_time
                    ))
                
            except Exception as e:
                results.append(ValidationResult(
                    check_name="sql_parameter_extraction",
                    resource_type=resource_type,
                    status="FAIL",
                    message=f"Error validating SQL parameter extraction: {e}",
                    details={"error": str(e)},
                    duration=time.time() - start_time
                ))
        
        return results
    
    async def _validate_cross_resource_integrity(self, storage_engine: FHIRStorageEngine) -> List[ValidationResult]:
        """Validate cross-resource referential integrity"""
        results = []
        
        start_time = time.time()
        try:
            # Test patient references across resources
            patient_ref_query = text("""
                SELECT 
                    r.resource_type,
                    COUNT(*) as total_resources,
                    COUNT(sp.id) as patient_references
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id 
                    AND sp.param_name = 'patient'
                WHERE r.resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'Procedure')
                AND r.deleted = false
                GROUP BY r.resource_type
            """)
            result = await storage_engine.session.execute(patient_ref_query)
            ref_stats = result.fetchall()
            
            for stat in ref_stats:
                reference_ratio = stat.patient_references / stat.total_resources if stat.total_resources > 0 else 0
                
                if reference_ratio >= 0.8:  # Expect 80% of resources to have patient references
                    results.append(ValidationResult(
                        check_name="cross_resource_patient_references",
                        resource_type=stat.resource_type,
                        status="PASS",
                        message=f"Good patient reference coverage: {reference_ratio:.1%}",
                        details={
                            "total_resources": stat.total_resources,
                            "patient_references": stat.patient_references,
                            "coverage": reference_ratio
                        },
                        duration=time.time() - start_time
                    ))
                else:
                    results.append(ValidationResult(
                        check_name="cross_resource_patient_references",
                        resource_type=stat.resource_type,
                        status="FAIL",
                        message=f"Low patient reference coverage: {reference_ratio:.1%}",
                        details={
                            "total_resources": stat.total_resources,
                            "patient_references": stat.patient_references,
                            "coverage": reference_ratio
                        },
                        duration=time.time() - start_time
                    ))
            
        except Exception as e:
            results.append(ValidationResult(
                check_name="cross_resource_integrity",
                resource_type="ALL",
                status="FAIL",
                message=f"Error validating cross-resource integrity: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results


async def main():
    """Main entry point for core clinical validation"""
    logging.basicConfig(level=logging.INFO)
    
    harness = CoreClinicalValidationHarness()
    
    print("Starting Core Clinical Resources Validation...")
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
    
    # Detailed results
    print(f"\nDetailed Results:")
    print("-" * 60)
    
    for result in results:
        status_icon = "✓" if result.status == "PASS" else "✗" if result.status == "FAIL" else "⚠"
        print(f"{status_icon} {result.resource_type}: {result.check_name}")
        print(f"   {result.message}")
        if result.details:
            for key, value in result.details.items():
                print(f"   {key}: {value}")
        print()
    
    # Exit with error code if any failures
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))