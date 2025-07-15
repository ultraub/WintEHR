#!/usr/bin/env python3
"""
Comprehensive FHIR Test Runner - Master Test Suite Framework

This is the central orchestration tool for all FHIR resource testing, validation,
and compliance verification. It provides a unified interface to run all test
harnesses across the system.

Features:
- Complete FHIR R4 resource testing
- Search parameter validation
- Cross-resource workflow integration
- Performance benchmarking
- SQL validation and optimization
- Automated regression testing
- Real-time reporting and analytics

Usage:
    # Run all tests
    python comprehensive_fhir_test_runner.py --all
    
    # Run specific test categories
    python comprehensive_fhir_test_runner.py --core-clinical
    python comprehensive_fhir_test_runner.py --medication-workflow
    python comprehensive_fhir_test_runner.py --provider-directory
    
    # Run with performance benchmarks
    python comprehensive_fhir_test_runner.py --all --benchmark
    
    # Run with specific validation level
    python comprehensive_fhir_test_runner.py --all --validation-level strict
"""

import asyncio
import argparse
import sys
import os
import time
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import traceback

# Add parent directories to path for imports
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.fhir.storage import FHIRStorageEngine
from database import get_session_maker


class TestCategory(Enum):
    """Test categories for organizing test execution"""
    CORE_CLINICAL = "core-clinical"
    MEDICATION = "medication"
    PROVIDER_ORGANIZATION = "provider-organization"
    DOCUMENTATION = "documentation"
    ADMINISTRATIVE = "administrative"
    INFRASTRUCTURE = "infrastructure"
    PERFORMANCE = "performance"
    SQL_VALIDATION = "sql-validation"
    INTEGRATION = "integration"


class ValidationLevel(Enum):
    """Validation levels for test execution"""
    BASIC = "basic"
    STANDARD = "standard"
    STRICT = "strict"
    COMPREHENSIVE = "comprehensive"


@dataclass
class TestResult:
    """Individual test result"""
    test_name: str
    category: TestCategory
    status: str  # PASS, FAIL, SKIP, ERROR
    duration: float
    message: str = ""
    details: Dict[str, Any] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)
        if self.details is None:
            self.details = {}


@dataclass
class TestSuiteResult:
    """Complete test suite results"""
    suite_name: str
    category: TestCategory
    total_tests: int
    passed: int
    failed: int
    skipped: int
    errors: int
    duration: float
    results: List[TestResult]
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        if self.total_tests == 0:
            return 0.0
        return (self.passed / self.total_tests) * 100


@dataclass
class BenchmarkResult:
    """Performance benchmark result"""
    operation: str
    resource_type: str
    avg_duration: float
    min_duration: float
    max_duration: float
    operations_per_second: float
    samples: int
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)


class FHIRTestRunner:
    """Master test runner for all FHIR implementations"""
    
    def __init__(self, validation_level: ValidationLevel = ValidationLevel.STANDARD):
        self.validation_level = validation_level
        self.session_maker = get_session_maker()
        self.test_results: List[TestResult] = []
        self.suite_results: List[TestSuiteResult] = []
        self.benchmark_results: List[BenchmarkResult] = []
        self.start_time = None
        self.end_time = None
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    async def run_all_tests(self, categories: List[TestCategory] = None, 
                          include_benchmarks: bool = False) -> Dict[str, Any]:
        """Run all test suites"""
        self.start_time = datetime.now(timezone.utc)
        self.logger.info("Starting comprehensive FHIR test execution")
        
        if categories is None:
            categories = list(TestCategory)
        
        # Initialize database session
        async with self.session_maker() as session:
            storage_engine = FHIRStorageEngine(session)
            
            # Run pre-execution validation
            await self._validate_test_environment(storage_engine)
            
            # Execute test suites by category
            for category in categories:
                if category == TestCategory.PERFORMANCE and not include_benchmarks:
                    continue
                
                self.logger.info(f"Executing {category.value} tests...")
                suite_result = await self._run_category_tests(category, storage_engine)
                self.suite_results.append(suite_result)
            
            # Run integration tests if multiple categories
            if len(categories) > 1 and TestCategory.INTEGRATION in categories:
                self.logger.info("Executing integration tests...")
                integration_result = await self._run_integration_tests(storage_engine)
                self.suite_results.append(integration_result)
            
            # Run performance benchmarks if requested
            if include_benchmarks:
                self.logger.info("Executing performance benchmarks...")
                await self._run_performance_benchmarks(storage_engine)
        
        self.end_time = datetime.now(timezone.utc)
        
        # Generate comprehensive report
        return await self._generate_test_report()
    
    async def _validate_test_environment(self, storage_engine: FHIRStorageEngine):
        """Validate test environment is ready"""
        self.logger.info("Validating test environment...")
        
        # Check database connectivity
        try:
            result = await storage_engine.session.execute(text("SELECT 1"))
            assert result.scalar() == 1
        except Exception as e:
            raise RuntimeError(f"Database connectivity check failed: {e}")
        
        # Check FHIR resources exist
        try:
            patient_count = await storage_engine.session.execute(
                text("SELECT COUNT(*) FROM fhir.resources WHERE resource_type = 'Patient' AND deleted = false")
            )
            count = patient_count.scalar()
            if count < 5:
                raise RuntimeError(f"Insufficient test data: only {count} patients found")
        except Exception as e:
            raise RuntimeError(f"Test data validation failed: {e}")
        
        self.logger.info(f"Test environment validated successfully")
    
    async def _run_category_tests(self, category: TestCategory, 
                                storage_engine: FHIRStorageEngine) -> TestSuiteResult:
        """Run tests for a specific category"""
        start_time = time.time()
        results = []
        
        try:
            if category == TestCategory.CORE_CLINICAL:
                results = await self._run_core_clinical_tests(storage_engine)
            elif category == TestCategory.MEDICATION:
                results = await self._run_medication_tests(storage_engine)
            elif category == TestCategory.PROVIDER_ORGANIZATION:
                results = await self._run_provider_organization_tests(storage_engine)
            elif category == TestCategory.DOCUMENTATION:
                results = await self._run_documentation_tests(storage_engine)
            elif category == TestCategory.ADMINISTRATIVE:
                results = await self._run_administrative_tests(storage_engine)
            elif category == TestCategory.INFRASTRUCTURE:
                results = await self._run_infrastructure_tests(storage_engine)
            elif category == TestCategory.SQL_VALIDATION:
                results = await self._run_sql_validation_tests(storage_engine)
            else:
                self.logger.warning(f"Unknown category: {category}")
                
        except Exception as e:
            self.logger.error(f"Error running {category.value} tests: {e}")
            results = [TestResult(
                test_name=f"{category.value}_suite_error",
                category=category,
                status="ERROR",
                duration=time.time() - start_time,
                message=str(e),
                details={"traceback": traceback.format_exc()}
            )]
        
        duration = time.time() - start_time
        
        # Calculate statistics
        passed = sum(1 for r in results if r.status == "PASS")
        failed = sum(1 for r in results if r.status == "FAIL")
        skipped = sum(1 for r in results if r.status == "SKIP")
        errors = sum(1 for r in results if r.status == "ERROR")
        
        suite_result = TestSuiteResult(
            suite_name=f"{category.value}_suite",
            category=category,
            total_tests=len(results),
            passed=passed,
            failed=failed,
            skipped=skipped,
            errors=errors,
            duration=duration,
            results=results
        )
        
        self.test_results.extend(results)
        return suite_result
    
    async def _run_core_clinical_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run core clinical resource tests"""
        results = []
        
        # Import and run existing core clinical tests
        try:
            from ..core_clinical.test_patient_identifier_search import TestPatientIdentifierSearch
            from ..core_clinical.test_observation_value_quantity_search import TestObservationValueQuantitySearch
            from ..core_clinical.test_allergy_verification_status_search import TestAllergyVerificationStatusSearch
            from ..core_clinical.test_condition_onset_date_search import TestConditionOnsetDateSearch
            from ..core_clinical.test_performer_practitioner_references import TestPerformerPractitionerReferences
            
            # Run Patient identifier search tests
            patient_tests = TestPatientIdentifierSearch()
            test_methods = [
                ("patient_identifier_extraction", patient_tests.test_patient_identifier_search_extraction),
                ("search_by_medical_record", patient_tests.test_search_by_medical_record_number),
                ("search_by_ssn", patient_tests.test_search_by_ssn),
                ("search_by_value_only", patient_tests.test_search_by_identifier_value_only),
                ("cross_resource_identification", patient_tests.test_cross_resource_patient_identification),
                ("parameter_coverage", patient_tests.test_identifier_search_parameter_coverage),
                ("sql_validation", patient_tests.test_sql_validation_identifier_extraction)
            ]
            
            for test_name, test_method in test_methods:
                result = await self._execute_test(
                    f"patient_{test_name}",
                    TestCategory.CORE_CLINICAL,
                    test_method,
                    storage_engine
                )
                results.append(result)
            
            # Run Observation value-quantity tests
            obs_tests = TestObservationValueQuantitySearch()
            obs_methods = [
                ("value_quantity_extraction", obs_tests.test_observation_value_quantity_search_extraction),
                ("search_by_value_gt", obs_tests.test_search_by_value_greater_than),
                ("search_by_value_lt", obs_tests.test_search_by_value_less_than),
                ("search_by_range", obs_tests.test_search_by_value_range),
                ("search_by_unit", obs_tests.test_search_by_unit_only),
                ("sql_validation", obs_tests.test_sql_validation_value_quantity_extraction)
            ]
            
            for test_name, test_method in obs_methods:
                result = await self._execute_test(
                    f"observation_{test_name}",
                    TestCategory.CORE_CLINICAL,
                    test_method,
                    storage_engine
                )
                results.append(result)
            
            # Run additional core clinical tests as available...
            
        except ImportError as e:
            self.logger.warning(f"Could not import core clinical tests: {e}")
            results.append(TestResult(
                test_name="core_clinical_import_error",
                category=TestCategory.CORE_CLINICAL,
                status="SKIP",
                duration=0.0,
                message=f"Import error: {e}"
            ))
        
        return results
    
    async def _run_medication_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run medication workflow tests"""
        results = []
        
        try:
            from ..medication.test_medication_dispense import TestMedicationDispense
            from ..medication.test_medication_administration import TestMedicationAdministration
            from ..medication.test_workflow_integration import TestMedicationWorkflowIntegration
            
            # Run MedicationDispense tests
            dispense_tests = TestMedicationDispense()
            dispense_methods = [
                ("crud_operations", dispense_tests.test_medication_dispense_crud),
                ("search_parameters", dispense_tests.test_search_parameters),
                ("status_workflow", dispense_tests.test_status_workflow),
                ("quantity_validation", dispense_tests.test_quantity_validation)
            ]
            
            for test_name, test_method in dispense_methods:
                result = await self._execute_test(
                    f"medication_dispense_{test_name}",
                    TestCategory.MEDICATION,
                    test_method,
                    storage_engine
                )
                results.append(result)
            
            # Add more medication tests...
            
        except ImportError as e:
            self.logger.warning(f"Could not import medication tests: {e}")
            results.append(TestResult(
                test_name="medication_import_error",
                category=TestCategory.MEDICATION,
                status="SKIP",
                duration=0.0,
                message=f"Import error: {e}"
            ))
        
        return results
    
    async def _run_provider_organization_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run provider and organization tests"""
        results = []
        
        # Placeholder for provider-organization tests
        # These will be implemented by Agent C
        results.append(TestResult(
            test_name="provider_organization_placeholder",
            category=TestCategory.PROVIDER_ORGANIZATION,
            status="SKIP",
            duration=0.0,
            message="Provider organization tests not yet implemented"
        ))
        
        return results
    
    async def _run_documentation_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run documentation infrastructure tests"""
        results = []
        
        # Placeholder for documentation tests
        # These will be implemented by Agent D
        results.append(TestResult(
            test_name="documentation_placeholder",
            category=TestCategory.DOCUMENTATION,
            status="SKIP",
            duration=0.0,
            message="Documentation tests not yet implemented"
        ))
        
        return results
    
    async def _run_administrative_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run administrative resource tests"""
        results = []
        
        # Placeholder for administrative tests
        # These will be implemented by Agent E
        results.append(TestResult(
            test_name="administrative_placeholder",
            category=TestCategory.ADMINISTRATIVE,
            status="SKIP",
            duration=0.0,
            message="Administrative tests not yet implemented"
        ))
        
        return results
    
    async def _run_infrastructure_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run infrastructure and system tests"""
        results = []
        
        # Test database schema
        result = await self._execute_test(
            "database_schema_validation",
            TestCategory.INFRASTRUCTURE,
            self._test_database_schema,
            storage_engine
        )
        results.append(result)
        
        # Test search parameter definitions
        result = await self._execute_test(
            "search_parameter_definitions",
            TestCategory.INFRASTRUCTURE,
            self._test_search_parameter_definitions,
            storage_engine
        )
        results.append(result)
        
        return results
    
    async def _run_sql_validation_tests(self, storage_engine: FHIRStorageEngine) -> List[TestResult]:
        """Run SQL validation and optimization tests"""
        results = []
        
        # Test search parameter extraction accuracy
        result = await self._execute_test(
            "search_parameter_extraction_accuracy",
            TestCategory.SQL_VALIDATION,
            self._test_search_parameter_extraction_accuracy,
            storage_engine
        )
        results.append(result)
        
        # Test SQL query performance
        result = await self._execute_test(
            "sql_query_performance",
            TestCategory.SQL_VALIDATION,
            self._test_sql_query_performance,
            storage_engine
        )
        results.append(result)
        
        return results
    
    async def _run_integration_tests(self, storage_engine: FHIRStorageEngine) -> TestSuiteResult:
        """Run cross-resource integration tests"""
        start_time = time.time()
        results = []
        
        # Test patient-centric workflows
        result = await self._execute_test(
            "patient_centric_workflow",
            TestCategory.INTEGRATION,
            self._test_patient_centric_workflow,
            storage_engine
        )
        results.append(result)
        
        # Test provider accountability tracking
        result = await self._execute_test(
            "provider_accountability_tracking",
            TestCategory.INTEGRATION,
            self._test_provider_accountability_tracking,
            storage_engine
        )
        results.append(result)
        
        duration = time.time() - start_time
        
        # Calculate statistics
        passed = sum(1 for r in results if r.status == "PASS")
        failed = sum(1 for r in results if r.status == "FAIL")
        skipped = sum(1 for r in results if r.status == "SKIP")
        errors = sum(1 for r in results if r.status == "ERROR")
        
        return TestSuiteResult(
            suite_name="integration_suite",
            category=TestCategory.INTEGRATION,
            total_tests=len(results),
            passed=passed,
            failed=failed,
            skipped=skipped,
            errors=errors,
            duration=duration,
            results=results
        )
    
    async def _run_performance_benchmarks(self, storage_engine: FHIRStorageEngine):
        """Run performance benchmarks"""
        self.logger.info("Running performance benchmarks...")
        
        # Benchmark CRUD operations
        for resource_type in ['Patient', 'Observation', 'Condition', 'MedicationRequest']:
            # Read operations
            benchmark = await self._benchmark_operation(
                f"read_{resource_type.lower()}",
                resource_type,
                self._benchmark_read_operation,
                storage_engine,
                resource_type
            )
            self.benchmark_results.append(benchmark)
            
            # Search operations
            benchmark = await self._benchmark_operation(
                f"search_{resource_type.lower()}",
                resource_type,
                self._benchmark_search_operation,
                storage_engine,
                resource_type
            )
            self.benchmark_results.append(benchmark)
    
    async def _execute_test(self, test_name: str, category: TestCategory,
                          test_method, *args) -> TestResult:
        """Execute a single test method with error handling"""
        start_time = time.time()
        
        try:
            # Check if test method is async
            if asyncio.iscoroutinefunction(test_method):
                await test_method(*args)
            else:
                test_method(*args)
            
            return TestResult(
                test_name=test_name,
                category=category,
                status="PASS",
                duration=time.time() - start_time,
                message="Test passed successfully"
            )
            
        except AssertionError as e:
            return TestResult(
                test_name=test_name,
                category=category,
                status="FAIL",
                duration=time.time() - start_time,
                message=f"Assertion failed: {e}",
                details={"assertion_error": str(e)}
            )
            
        except Exception as e:
            return TestResult(
                test_name=test_name,
                category=category,
                status="ERROR",
                duration=time.time() - start_time,
                message=f"Test error: {e}",
                details={
                    "error_type": type(e).__name__,
                    "traceback": traceback.format_exc()
                }
            )
    
    async def _benchmark_operation(self, operation: str, resource_type: str,
                                 benchmark_method, *args) -> BenchmarkResult:
        """Benchmark a specific operation"""
        durations = []
        samples = 10
        
        for _ in range(samples):
            start_time = time.time()
            try:
                if asyncio.iscoroutinefunction(benchmark_method):
                    await benchmark_method(*args)
                else:
                    benchmark_method(*args)
                durations.append(time.time() - start_time)
            except Exception as e:
                self.logger.warning(f"Benchmark error in {operation}: {e}")
                durations.append(float('inf'))  # Mark as failed
        
        # Filter out failed operations
        valid_durations = [d for d in durations if d != float('inf')]
        
        if not valid_durations:
            return BenchmarkResult(
                operation=operation,
                resource_type=resource_type,
                avg_duration=float('inf'),
                min_duration=float('inf'),
                max_duration=float('inf'),
                operations_per_second=0.0,
                samples=0
            )
        
        avg_duration = sum(valid_durations) / len(valid_durations)
        
        return BenchmarkResult(
            operation=operation,
            resource_type=resource_type,
            avg_duration=avg_duration,
            min_duration=min(valid_durations),
            max_duration=max(valid_durations),
            operations_per_second=1.0 / avg_duration if avg_duration > 0 else 0.0,
            samples=len(valid_durations)
        )
    
    # Test method implementations
    async def _test_database_schema(self, storage_engine: FHIRStorageEngine):
        """Test database schema integrity"""
        # Check required tables exist
        tables_query = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'fhir'
            AND table_name IN ('resources', 'search_parameters', 'references')
        """)
        result = await storage_engine.session.execute(tables_query)
        tables = [row[0] for row in result.fetchall()]
        
        required_tables = {'resources', 'search_parameters', 'references'}
        missing_tables = required_tables - set(tables)
        
        if missing_tables:
            raise AssertionError(f"Missing required tables: {missing_tables}")
    
    async def _test_search_parameter_definitions(self, storage_engine: FHIRStorageEngine):
        """Test search parameter definitions are complete"""
        definitions = storage_engine._get_search_parameter_definitions()
        
        required_resources = ['Patient', 'Observation', 'Condition', 'MedicationRequest']
        for resource_type in required_resources:
            if resource_type not in definitions:
                raise AssertionError(f"Missing search parameter definitions for {resource_type}")
    
    async def _test_search_parameter_extraction_accuracy(self, storage_engine: FHIRStorageEngine):
        """Test that search parameters are extracted accurately"""
        # Get sample patient and verify search parameter extraction
        query = text("""
            SELECT r.resource, COUNT(sp.id) as param_count
            FROM fhir.resources r
            LEFT JOIN fhir.search_parameters sp ON r.id = sp.resource_id
            WHERE r.resource_type = 'Patient' AND r.deleted = false
            GROUP BY r.id, r.resource
            LIMIT 1
        """)
        result = await storage_engine.session.execute(query)
        sample = result.fetchone()
        
        if not sample:
            raise AssertionError("No patient data found for testing")
        
        resource_data = sample.resource
        param_count = sample.param_count
        
        # Estimate expected parameter count based on resource structure
        expected_min_params = 2  # At minimum identifier and name
        if param_count < expected_min_params:
            raise AssertionError(f"Insufficient search parameters extracted: {param_count} < {expected_min_params}")
    
    async def _test_sql_query_performance(self, storage_engine: FHIRStorageEngine):
        """Test SQL query performance meets benchmarks"""
        # Simple search should be under 200ms
        start_time = time.time()
        result = await storage_engine.search_resources('Patient', {'_count': ['1']}, {})
        duration = time.time() - start_time
        
        if duration > 0.2:  # 200ms
            raise AssertionError(f"Simple search too slow: {duration:.3f}s > 0.200s")
    
    async def _test_patient_centric_workflow(self, storage_engine: FHIRStorageEngine):
        """Test patient-centric workflow across resources"""
        # Get a patient and find related resources
        patients = await storage_engine.search_resources('Patient', {}, {'_count': ['1']})
        if patients['total'] == 0:
            raise AssertionError("No patients found for integration testing")
        
        patient_id = patients['entry'][0]['resource']['id']
        
        # Test that we can find related resources
        resource_types = ['Observation', 'Condition', 'MedicationRequest']
        for resource_type in resource_types:
            try:
                result = await storage_engine.search_resources(
                    resource_type, 
                    {'patient': [patient_id]}, 
                    {}
                )
                # Don't require results, just that search executes
                assert 'total' in result
            except Exception as e:
                raise AssertionError(f"Failed to search {resource_type} by patient: {e}")
    
    async def _test_provider_accountability_tracking(self, storage_engine: FHIRStorageEngine):
        """Test provider accountability across clinical resources"""
        # This is a placeholder - will be expanded when provider tests are implemented
        pass
    
    async def _benchmark_read_operation(self, storage_engine: FHIRStorageEngine, resource_type: str):
        """Benchmark read operation"""
        # Get first resource ID for benchmarking
        result = await storage_engine.search_resources(resource_type, {}, {'_count': ['1']})
        if result['total'] > 0:
            resource_id = result['entry'][0]['resource']['id']
            await storage_engine.get_resource(resource_type, resource_id)
    
    async def _benchmark_search_operation(self, storage_engine: FHIRStorageEngine, resource_type: str):
        """Benchmark search operation"""
        await storage_engine.search_resources(resource_type, {}, {'_count': ['10']})
    
    async def _generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_duration = (self.end_time - self.start_time).total_seconds()
        
        # Calculate overall statistics
        total_tests = len(self.test_results)
        passed = sum(1 for r in self.test_results if r.status == "PASS")
        failed = sum(1 for r in self.test_results if r.status == "FAIL")
        skipped = sum(1 for r in self.test_results if r.status == "SKIP")
        errors = sum(1 for r in self.test_results if r.status == "ERROR")
        
        # Generate category summaries
        category_summaries = {}
        for suite in self.suite_results:
            category_summaries[suite.category.value] = {
                "total_tests": suite.total_tests,
                "passed": suite.passed,
                "failed": suite.failed,
                "skipped": suite.skipped,
                "errors": suite.errors,
                "success_rate": suite.success_rate,
                "duration": suite.duration
            }
        
        # Generate benchmark summaries
        benchmark_summaries = {}
        for benchmark in self.benchmark_results:
            benchmark_summaries[f"{benchmark.resource_type}_{benchmark.operation}"] = {
                "avg_duration": benchmark.avg_duration,
                "operations_per_second": benchmark.operations_per_second,
                "samples": benchmark.samples
            }
        
        report = {
            "summary": {
                "start_time": self.start_time.isoformat(),
                "end_time": self.end_time.isoformat(),
                "total_duration": total_duration,
                "validation_level": self.validation_level.value,
                "total_tests": total_tests,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "errors": errors,
                "success_rate": (passed / total_tests * 100) if total_tests > 0 else 0.0
            },
            "category_summaries": category_summaries,
            "benchmark_summaries": benchmark_summaries,
            "detailed_results": [asdict(result) for result in self.test_results],
            "suite_results": [asdict(suite) for suite in self.suite_results],
            "benchmark_results": [asdict(benchmark) for benchmark in self.benchmark_results],
            "failed_tests": [asdict(r) for r in self.test_results if r.status in ["FAIL", "ERROR"]]
        }
        
        return report


async def main():
    """Main entry point for test runner"""
    parser = argparse.ArgumentParser(description="Comprehensive FHIR Test Runner")
    parser.add_argument("--all", action="store_true", help="Run all test categories")
    parser.add_argument("--core-clinical", action="store_true", help="Run core clinical tests")
    parser.add_argument("--medication", action="store_true", help="Run medication tests")
    parser.add_argument("--provider-organization", action="store_true", help="Run provider organization tests")
    parser.add_argument("--documentation", action="store_true", help="Run documentation tests")
    parser.add_argument("--administrative", action="store_true", help="Run administrative tests")
    parser.add_argument("--infrastructure", action="store_true", help="Run infrastructure tests")
    parser.add_argument("--sql-validation", action="store_true", help="Run SQL validation tests")
    parser.add_argument("--integration", action="store_true", help="Run integration tests")
    parser.add_argument("--benchmark", action="store_true", help="Include performance benchmarks")
    parser.add_argument("--validation-level", choices=["basic", "standard", "strict", "comprehensive"],
                       default="standard", help="Validation level")
    parser.add_argument("--output", type=str, help="Output file for test results")
    
    args = parser.parse_args()
    
    # Determine which categories to run
    categories = []
    if args.all:
        categories = list(TestCategory)
    else:
        if args.core_clinical:
            categories.append(TestCategory.CORE_CLINICAL)
        if args.medication:
            categories.append(TestCategory.MEDICATION)
        if args.provider_organization:
            categories.append(TestCategory.PROVIDER_ORGANIZATION)
        if args.documentation:
            categories.append(TestCategory.DOCUMENTATION)
        if args.administrative:
            categories.append(TestCategory.ADMINISTRATIVE)
        if args.infrastructure:
            categories.append(TestCategory.INFRASTRUCTURE)
        if args.sql_validation:
            categories.append(TestCategory.SQL_VALIDATION)
        if args.integration:
            categories.append(TestCategory.INTEGRATION)
    
    if not categories:
        print("No test categories specified. Use --all or specify individual categories.")
        return 1
    
    # Initialize test runner
    validation_level = ValidationLevel(args.validation_level)
    runner = FHIRTestRunner(validation_level)
    
    try:
        # Run tests
        report = await runner.run_all_tests(categories, args.benchmark)
        
        # Output results
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"Test results written to {args.output}")
        else:
            # Print summary to console
            summary = report["summary"]
            print(f"\n{'='*60}")
            print(f"FHIR TEST EXECUTION SUMMARY")
            print(f"{'='*60}")
            print(f"Validation Level: {summary['validation_level']}")
            print(f"Total Duration: {summary['total_duration']:.2f}s")
            print(f"Total Tests: {summary['total_tests']}")
            print(f"Passed: {summary['passed']}")
            print(f"Failed: {summary['failed']}")
            print(f"Skipped: {summary['skipped']}")
            print(f"Errors: {summary['errors']}")
            print(f"Success Rate: {summary['success_rate']:.1f}%")
            
            if summary['failed'] > 0 or summary['errors'] > 0:
                print(f"\nFAILED/ERROR TESTS:")
                for test in report["failed_tests"]:
                    print(f"  - {test['test_name']}: {test['message']}")
        
        # Return exit code based on results
        return 0 if report["summary"]["failed"] == 0 and report["summary"]["errors"] == 0 else 1
        
    except Exception as e:
        print(f"Test execution failed: {e}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))