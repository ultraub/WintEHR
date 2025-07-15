#!/usr/bin/env python3
"""
Integration and Workflow Testing Harness

This harness validates cross-resource integration and complete clinical workflows:
- Patient-centric workflows across all resource types
- Provider accountability tracking across clinical resources
- End-to-end clinical scenarios (order-to-result, prescribe-to-dispense)
- Cross-module integration testing
- Workflow orchestration validation
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
from core.fhir.storage import FHIRStorageEngine
from database import get_session_maker


@dataclass
class IntegrationWorkflowResult:
    """Result of integration workflow testing"""
    workflow_name: str
    step: str
    status: str  # PASS, FAIL, SKIP
    message: str
    details: Dict[str, Any] = None
    duration: float = 0.0
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class IntegrationWorkflowTestingHarness:
    """Comprehensive integration and workflow testing harness"""
    
    def __init__(self):
        self.session_maker = get_session_maker()
        self.logger = logging.getLogger(__name__)
    
    async def run_comprehensive_testing(self) -> List[IntegrationWorkflowResult]:
        """Run comprehensive integration and workflow testing"""
        results = []
        
        async with self.session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Patient-centric workflow testing
            patient_workflows = await self._test_patient_centric_workflows(storage_engine)
            results.extend(patient_workflows)
            
            # Provider accountability tracking
            provider_tracking = await self._test_provider_accountability_tracking(storage_engine)
            results.extend(provider_tracking)
            
            # End-to-end clinical scenarios
            clinical_scenarios = await self._test_end_to_end_clinical_scenarios(storage_engine)
            results.extend(clinical_scenarios)
            
            # Cross-module integration
            cross_module = await self._test_cross_module_integration(storage_engine)
            results.extend(cross_module)
        
        return results
    
    async def _test_patient_centric_workflows(self, storage_engine: FHIRStorageEngine) -> List[IntegrationWorkflowResult]:
        """Test patient-centric workflows across all resource types"""
        results = []
        start_time = time.time()
        
        try:
            # Get a sample patient
            patients = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
            if patients['total'] == 0:
                results.append(IntegrationWorkflowResult(
                    workflow_name="patient_centric",
                    step="patient_selection",
                    status="SKIP",
                    message="No patients found for workflow testing",
                    duration=time.time() - start_time
                ))
                return results
            
            patient = patients['entry'][0]['resource']
            patient_id = patient['id']
            
            # Test resource discovery across types
            resource_types = ['Observation', 'Condition', 'MedicationRequest', 'Procedure', 'Encounter']
            workflow_coverage = {}
            
            for resource_type in resource_types:
                try:
                    related_resources = await storage_engine.search_resources(
                        resource_type,
                        {'patient': [f"Patient/{patient_id}"]},
                        {'_count': ['10']}
                    )
                    workflow_coverage[resource_type] = related_resources['total']
                except Exception as e:
                    workflow_coverage[resource_type] = f"Error: {e}"
            
            # Evaluate workflow coverage
            covered_types = sum(1 for count in workflow_coverage.values() if isinstance(count, int) and count > 0)
            total_types = len(resource_types)
            coverage_ratio = covered_types / total_types
            
            if coverage_ratio >= 0.6:  # 60% coverage threshold
                results.append(IntegrationWorkflowResult(
                    workflow_name="patient_centric",
                    step="resource_discovery",
                    status="PASS",
                    message=f"Good patient workflow coverage: {covered_types}/{total_types} resource types",
                    details={
                        "patient_id": patient_id,
                        "coverage": workflow_coverage,
                        "coverage_ratio": coverage_ratio
                    },
                    duration=time.time() - start_time
                ))
            else:
                results.append(IntegrationWorkflowResult(
                    workflow_name="patient_centric",
                    step="resource_discovery",
                    status="FAIL",
                    message=f"Low patient workflow coverage: {covered_types}/{total_types} resource types",
                    details={
                        "patient_id": patient_id,
                        "coverage": workflow_coverage,
                        "coverage_ratio": coverage_ratio
                    },
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(IntegrationWorkflowResult(
                workflow_name="patient_centric",
                step="resource_discovery",
                status="FAIL",
                message=f"Error testing patient-centric workflows: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_provider_accountability_tracking(self, storage_engine: FHIRStorageEngine) -> List[IntegrationWorkflowResult]:
        """Test provider accountability tracking across clinical resources"""
        results = []
        start_time = time.time()
        
        try:
            # Analyze provider references across resources
            provider_analysis_query = text("""
                SELECT 
                    r.resource_type,
                    COUNT(*) as total_resources,
                    COUNT(CASE WHEN sp.param_name = 'performer' THEN 1 END) as performer_refs,
                    COUNT(CASE WHEN sp.param_name = 'requester' THEN 1 END) as requester_refs,
                    COUNT(CASE WHEN sp.param_name = 'author' THEN 1 END) as author_refs
                FROM fhir.resources r
                LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id
                WHERE r.resource_type IN ('Observation', 'Procedure', 'MedicationRequest', 'DiagnosticReport')
                AND r.deleted = false
                GROUP BY r.resource_type
            """)
            result = await storage_engine.session.execute(provider_analysis_query)
            provider_stats = result.fetchall()
            
            accountability_score = 0
            total_resources = 0
            
            for stat in provider_stats:
                total_refs = stat.performer_refs + stat.requester_refs + stat.author_refs
                if stat.total_resources > 0:
                    resource_accountability = total_refs / stat.total_resources
                    accountability_score += resource_accountability * stat.total_resources
                    total_resources += stat.total_resources
            
            overall_accountability = accountability_score / total_resources if total_resources > 0 else 0
            
            if overall_accountability >= 0.7:  # 70% accountability threshold
                results.append(IntegrationWorkflowResult(
                    workflow_name="provider_accountability",
                    step="accountability_analysis",
                    status="PASS",
                    message=f"Good provider accountability: {overall_accountability:.1%} of resources have provider references",
                    details={
                        "overall_accountability": overall_accountability,
                        "total_resources": total_resources,
                        "resource_breakdown": [dict(stat) for stat in provider_stats]
                    },
                    duration=time.time() - start_time
                ))
            else:
                results.append(IntegrationWorkflowResult(
                    workflow_name="provider_accountability",
                    step="accountability_analysis",
                    status="FAIL",
                    message=f"Low provider accountability: {overall_accountability:.1%} of resources have provider references",
                    details={
                        "overall_accountability": overall_accountability,
                        "total_resources": total_resources,
                        "resource_breakdown": [dict(stat) for stat in provider_stats]
                    },
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(IntegrationWorkflowResult(
                workflow_name="provider_accountability",
                step="accountability_analysis",
                status="FAIL",
                message=f"Error testing provider accountability: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_end_to_end_clinical_scenarios(self, storage_engine: FHIRStorageEngine) -> List[IntegrationWorkflowResult]:
        """Test end-to-end clinical scenarios"""
        results = []
        
        # Test order-to-result workflow
        order_result = await self._test_order_to_result_workflow(storage_engine)
        results.extend(order_result)
        
        # Test prescribe-to-dispense workflow
        prescribe_dispense = await self._test_prescribe_to_dispense_workflow(storage_engine)
        results.extend(prescribe_dispense)
        
        return results
    
    async def _test_order_to_result_workflow(self, storage_engine: FHIRStorageEngine) -> List[IntegrationWorkflowResult]:
        """Test order-to-result workflow"""
        results = []
        start_time = time.time()
        
        try:
            # Find ServiceRequest -> Observation linkages
            order_result_query = text("""
                SELECT 
                    sr.fhir_id as service_request_id,
                    COUNT(DISTINCT obs.fhir_id) as linked_observations
                FROM fhir.resources sr
                LEFT JOIN fhir.search_parameters sp_based ON sr.id = sp_based.resource_id
                    AND sp_based.param_name = 'based-on'
                LEFT JOIN fhir.resources obs ON obs.id = sp_based.resource_id
                    AND obs.resource_type = 'Observation'
                    AND obs.deleted = false
                WHERE sr.resource_type = 'ServiceRequest'
                AND sr.deleted = false
                GROUP BY sr.fhir_id
                HAVING COUNT(DISTINCT obs.fhir_id) > 0
                LIMIT 10
            """)
            result = await storage_engine.session.execute(order_result_query)
            workflow_links = result.fetchall()
            
            if workflow_links:
                total_links = sum(link.linked_observations for link in workflow_links)
                avg_results_per_order = total_links / len(workflow_links)
                
                results.append(IntegrationWorkflowResult(
                    workflow_name="order_to_result",
                    step="workflow_linkage",
                    status="PASS",
                    message=f"Found {len(workflow_links)} order-to-result workflows, avg {avg_results_per_order:.1f} results per order",
                    details={
                        "workflow_count": len(workflow_links),
                        "total_results": total_links,
                        "avg_results_per_order": avg_results_per_order
                    },
                    duration=time.time() - start_time
                ))
            else:
                results.append(IntegrationWorkflowResult(
                    workflow_name="order_to_result",
                    step="workflow_linkage",
                    status="SKIP",
                    message="No order-to-result workflow linkages found",
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(IntegrationWorkflowResult(
                workflow_name="order_to_result",
                step="workflow_linkage",
                status="FAIL",
                message=f"Error testing order-to-result workflow: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_prescribe_to_dispense_workflow(self, storage_engine: FHIRStorageEngine) -> List[IntegrationWorkflowResult]:
        """Test prescribe-to-dispense workflow"""
        results = []
        start_time = time.time()
        
        try:
            # Find MedicationRequest -> MedicationDispense linkages
            prescription_dispense_query = text("""
                SELECT 
                    mr.fhir_id as medication_request_id,
                    COUNT(DISTINCT md.fhir_id) as linked_dispenses
                FROM fhir.resources mr
                LEFT JOIN fhir.search_parameters sp_auth ON mr.id = sp_auth.resource_id
                    AND sp_auth.param_name = 'authorizingPrescription'
                LEFT JOIN fhir.resources md ON md.id = sp_auth.resource_id
                    AND md.resource_type = 'MedicationDispense'
                    AND md.deleted = false
                WHERE mr.resource_type = 'MedicationRequest'
                AND mr.deleted = false
                GROUP BY mr.fhir_id
                HAVING COUNT(DISTINCT md.fhir_id) > 0
                LIMIT 10
            """)
            result = await storage_engine.session.execute(prescription_dispense_query)
            workflow_links = result.fetchall()
            
            if workflow_links:
                total_dispenses = sum(link.linked_dispenses for link in workflow_links)
                avg_dispenses_per_prescription = total_dispenses / len(workflow_links)
                
                results.append(IntegrationWorkflowResult(
                    workflow_name="prescribe_to_dispense",
                    step="workflow_linkage",
                    status="PASS",
                    message=f"Found {len(workflow_links)} prescribe-to-dispense workflows, avg {avg_dispenses_per_prescription:.1f} dispenses per prescription",
                    details={
                        "workflow_count": len(workflow_links),
                        "total_dispenses": total_dispenses,
                        "avg_dispenses_per_prescription": avg_dispenses_per_prescription
                    },
                    duration=time.time() - start_time
                ))
            else:
                results.append(IntegrationWorkflowResult(
                    workflow_name="prescribe_to_dispense",
                    step="workflow_linkage",
                    status="SKIP",
                    message="No prescribe-to-dispense workflow linkages found",
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(IntegrationWorkflowResult(
                workflow_name="prescribe_to_dispense",
                step="workflow_linkage",
                status="FAIL",
                message=f"Error testing prescribe-to-dispense workflow: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results
    
    async def _test_cross_module_integration(self, storage_engine: FHIRStorageEngine) -> List[IntegrationWorkflowResult]:
        """Test cross-module integration"""
        results = []
        start_time = time.time()
        
        try:
            # Test data consistency across modules
            consistency_query = text("""
                SELECT 
                    'Patient References' as check_type,
                    COUNT(DISTINCT sp.value_reference) as unique_patients,
                    COUNT(*) as total_patient_refs
                FROM fhir.search_parameters sp
                WHERE sp.param_name = 'patient'
                AND sp.value_reference LIKE 'Patient/%'
                
                UNION ALL
                
                SELECT 
                    'Practitioner References' as check_type,
                    COUNT(DISTINCT sp.value_reference) as unique_practitioners,
                    COUNT(*) as total_practitioner_refs
                FROM fhir.search_parameters sp
                WHERE sp.param_name IN ('performer', 'requester', 'author')
                AND sp.value_reference LIKE 'Practitioner/%'
            """)
            result = await storage_engine.session.execute(consistency_query)
            consistency_stats = result.fetchall()
            
            integration_health = {}
            for stat in consistency_stats:
                check_type = stat.check_type
                if stat.unique_patients > 0:  # Use the first column for count
                    reference_ratio = stat.total_patient_refs / stat.unique_patients
                    integration_health[check_type] = {
                        "unique_entities": stat.unique_patients,
                        "total_references": stat.total_patient_refs,
                        "reference_ratio": reference_ratio
                    }
            
            if integration_health:
                results.append(IntegrationWorkflowResult(
                    workflow_name="cross_module",
                    step="integration_consistency",
                    status="PASS",
                    message="Cross-module integration analysis completed",
                    details={"integration_health": integration_health},
                    duration=time.time() - start_time
                ))
            else:
                results.append(IntegrationWorkflowResult(
                    workflow_name="cross_module",
                    step="integration_consistency",
                    status="SKIP",
                    message="No cross-module references found for analysis",
                    duration=time.time() - start_time
                ))
            
        except Exception as e:
            results.append(IntegrationWorkflowResult(
                workflow_name="cross_module",
                step="integration_consistency",
                status="FAIL",
                message=f"Error testing cross-module integration: {e}",
                details={"error": str(e)},
                duration=time.time() - start_time
            ))
        
        return results


async def main():
    """Main entry point for integration workflow testing"""
    logging.basicConfig(level=logging.INFO)
    
    harness = IntegrationWorkflowTestingHarness()
    
    print("Starting Integration and Workflow Testing...")
    print("=" * 60)
    
    results = await harness.run_comprehensive_testing()
    
    # Summary statistics
    total_tests = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")
    
    print(f"\nTesting Summary:")
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    print(f"Success Rate: {(passed/total_tests*100):.1f}%" if total_tests > 0 else "N/A")
    
    # Group results by workflow
    workflows = {}
    for result in results:
        if result.workflow_name not in workflows:
            workflows[result.workflow_name] = []
        workflows[result.workflow_name].append(result)
    
    print(f"\nDetailed Results by Workflow:")
    print("-" * 60)
    
    for workflow_name, workflow_results in workflows.items():
        print(f"\n{workflow_name.upper().replace('_', ' ')}:")
        for result in workflow_results:
            status_icon = "✓" if result.status == "PASS" else "✗" if result.status == "FAIL" else "⚠"
            print(f"  {status_icon} {result.step}: {result.message}")
            if result.details and result.status != "PASS":
                for key, value in result.details.items():
                    if key != "error":
                        print(f"     {key}: {value}")
    
    # Exit with error code if any failures
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))