#!/usr/bin/env python3
"""
Automated Regression Testing Suite

This suite provides continuous integration testing framework, automated test
result reporting, test coverage tracking, and regression analysis for all
FHIR implementations.
"""

import asyncio
import sys
import os
import time
import logging
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict

# Add parent directories to path for imports
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from fhir.core.storage import FHIRStorageEngine
from database import get_session_maker

# Import other test harnesses
from .comprehensive_fhir_test_runner import FHIRTestRunner, TestCategory, ValidationLevel
from .core_clinical_validation import CoreClinicalValidationHarness
from .medication_workflow_validation import MedicationWorkflowValidationHarness
from .provider_directory_validation import ProviderDirectoryValidationHarness
from .documentation_infrastructure_validation import DocumentationInfrastructureValidationHarness
from .sql_database_validation import SQLDatabaseValidationFramework
from .performance_benchmark_suite import PerformanceBenchmarkSuite
from .integration_workflow_testing import IntegrationWorkflowTestingHarness


@dataclass
class RegressionTestResult:
    """Result of regression testing"""
    test_suite: str
    test_name: str
    status: str  # PASS, FAIL, SKIP, ERROR
    duration: float
    message: str
    details: Dict[str, Any] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)
        if self.details is None:
            self.details = {}


@dataclass
class RegressionSuiteReport:
    """Complete regression suite report"""
    run_id: str
    start_time: datetime
    end_time: datetime
    total_duration: float
    validation_level: str
    total_tests: int
    passed: int
    failed: int
    skipped: int
    errors: int
    success_rate: float
    coverage_metrics: Dict[str, float]
    performance_metrics: Dict[str, float]
    test_results: List[RegressionTestResult]
    previous_run_comparison: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.coverage_metrics is None:
            self.coverage_metrics = {}
        if self.performance_metrics is None:
            self.performance_metrics = {}


class AutomatedRegressionSuite:
    """Automated regression testing suite"""
    
    def __init__(self, validation_level: ValidationLevel = ValidationLevel.STANDARD):
        self.validation_level = validation_level
        self.session_maker = get_session_maker()
        self.logger = logging.getLogger(__name__)
        
        # Results storage
        self.test_results: List[RegressionTestResult] = []
        self.start_time = None
        self.end_time = None
        
        # Generate unique run ID
        self.run_id = f"regression_{int(time.time())}"
        
        # Coverage tracking
        self.coverage_metrics = {}
        self.performance_metrics = {}
    
    async def run_complete_regression_suite(self, include_performance: bool = False) -> RegressionSuiteReport:
        """Run complete regression testing suite"""
        self.start_time = datetime.now(timezone.utc)
        self.logger.info(f"Starting regression suite run: {self.run_id}")
        
        # Run all test harnesses
        await self._run_core_clinical_tests()
        await self._run_medication_workflow_tests()
        await self._run_provider_directory_tests()
        await self._run_documentation_infrastructure_tests()
        await self._run_sql_database_tests()
        await self._run_integration_workflow_tests()
        
        if include_performance:
            await self._run_performance_benchmarks()
        
        self.end_time = datetime.now(timezone.utc)
        total_duration = (self.end_time - self.start_time).total_seconds()
        
        # Generate comprehensive report
        report = await self._generate_regression_report(total_duration)
        
        # Save report to file
        await self._save_regression_report(report)
        
        # Compare with previous runs if available
        await self._compare_with_previous_runs(report)
        
        return report
    
    async def _run_core_clinical_tests(self):
        """Run core clinical validation tests"""
        self.logger.info("Running core clinical validation tests...")
        
        try:
            harness = CoreClinicalValidationHarness()
            results = await harness.run_comprehensive_validation()
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="core_clinical",
                    test_name=result.check_name,
                    status=result.status,
                    duration=result.duration,
                    message=result.message,
                    details=result.details
                ))
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="core_clinical",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"Core clinical test suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _run_medication_workflow_tests(self):
        """Run medication workflow validation tests"""
        self.logger.info("Running medication workflow validation tests...")
        
        try:
            harness = MedicationWorkflowValidationHarness()
            results = await harness.run_comprehensive_validation()
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="medication_workflow",
                    test_name=f"{result.workflow_name}_{result.step}",
                    status=result.status,
                    duration=result.duration,
                    message=result.message,
                    details=result.details
                ))
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="medication_workflow",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"Medication workflow test suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _run_provider_directory_tests(self):
        """Run provider directory validation tests"""
        self.logger.info("Running provider directory validation tests...")
        
        try:
            harness = ProviderDirectoryValidationHarness()
            results = await harness.run_comprehensive_validation()
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="provider_directory",
                    test_name=f"{result.directory_component}_{result.validation_type}",
                    status=result.status,
                    duration=result.duration,
                    message=result.message,
                    details=result.details
                ))
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="provider_directory",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"Provider directory test suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _run_documentation_infrastructure_tests(self):
        """Run documentation infrastructure validation tests"""
        self.logger.info("Running documentation infrastructure validation tests...")
        
        try:
            harness = DocumentationInfrastructureValidationHarness()
            results = await harness.run_comprehensive_validation()
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="documentation_infrastructure",
                    test_name=f"{result.infrastructure_component}_{result.validation_type}",
                    status=result.status,
                    duration=result.duration,
                    message=result.message,
                    details=result.details
                ))
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="documentation_infrastructure",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"Documentation infrastructure test suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _run_sql_database_tests(self):
        """Run SQL and database validation tests"""
        self.logger.info("Running SQL and database validation tests...")
        
        try:
            framework = SQLDatabaseValidationFramework()
            results = await framework.run_comprehensive_validation()
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="sql_database",
                    test_name=f"{result.validation_category}_{result.test_name}",
                    status=result.status,
                    duration=result.duration,
                    message=result.message,
                    details=result.details
                ))
                
                # Collect performance metrics
                if result.performance_metrics:
                    for metric, value in result.performance_metrics.items():
                        self.performance_metrics[f"sql_{result.test_name}_{metric}"] = value
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="sql_database",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"SQL database test suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _run_integration_workflow_tests(self):
        """Run integration and workflow tests"""
        self.logger.info("Running integration and workflow tests...")
        
        try:
            harness = IntegrationWorkflowTestingHarness()
            results = await harness.run_comprehensive_testing()
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="integration_workflow",
                    test_name=f"{result.workflow_name}_{result.step}",
                    status=result.status,
                    duration=result.duration,
                    message=result.message,
                    details=result.details
                ))
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="integration_workflow",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"Integration workflow test suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _run_performance_benchmarks(self):
        """Run performance benchmarks"""
        self.logger.info("Running performance benchmarks...")
        
        try:
            suite = PerformanceBenchmarkSuite()
            results = await suite.run_comprehensive_benchmarks(25)  # Smaller sample for regression
            
            for result in results:
                self.test_results.append(RegressionTestResult(
                    test_suite="performance",
                    test_name=f"{result.resource_type}_{result.operation}",
                    status=result.status,
                    duration=result.avg_duration,
                    message=result.message,
                    details=asdict(result)
                ))
                
                # Collect performance metrics
                self.performance_metrics[f"perf_{result.resource_type}_{result.operation}_ops_per_sec"] = result.operations_per_second
                self.performance_metrics[f"perf_{result.resource_type}_{result.operation}_avg_duration"] = result.avg_duration
                self.performance_metrics[f"perf_{result.resource_type}_{result.operation}_p95_duration"] = result.p95_duration
                
        except Exception as e:
            self.test_results.append(RegressionTestResult(
                test_suite="performance",
                test_name="suite_execution",
                status="ERROR",
                duration=0.0,
                message=f"Performance benchmark suite failed: {e}",
                details={"error": str(e)}
            ))
    
    async def _generate_regression_report(self, total_duration: float) -> RegressionSuiteReport:
        """Generate comprehensive regression report"""
        
        # Calculate summary statistics
        total_tests = len(self.test_results)
        passed = sum(1 for r in self.test_results if r.status == "PASS")
        failed = sum(1 for r in self.test_results if r.status == "FAIL")
        skipped = sum(1 for r in self.test_results if r.status == "SKIP")
        errors = sum(1 for r in self.test_results if r.status == "ERROR")
        success_rate = (passed / total_tests * 100) if total_tests > 0 else 0.0
        
        # Calculate coverage metrics
        await self._calculate_coverage_metrics()
        
        report = RegressionSuiteReport(
            run_id=self.run_id,
            start_time=self.start_time,
            end_time=self.end_time,
            total_duration=total_duration,
            validation_level=self.validation_level.value,
            total_tests=total_tests,
            passed=passed,
            failed=failed,
            skipped=skipped,
            errors=errors,
            success_rate=success_rate,
            coverage_metrics=self.coverage_metrics,
            performance_metrics=self.performance_metrics,
            test_results=self.test_results
        )
        
        return report
    
    async def _calculate_coverage_metrics(self):
        """Calculate test coverage metrics"""
        
        # Test suite coverage
        suites = set(r.test_suite for r in self.test_results)
        expected_suites = {
            'core_clinical', 'medication_workflow', 'provider_directory',
            'documentation_infrastructure', 'sql_database', 'integration_workflow'
        }
        suite_coverage = len(suites & expected_suites) / len(expected_suites)
        
        # Resource type coverage
        async with self.session_maker() as session:
            resource_types_query = text("""
                SELECT DISTINCT resource_type 
                FROM fhir.resources 
                WHERE deleted = false
            """)
            result = await session.execute(resource_types_query)
            total_resource_types = len(result.fetchall())
        
        tested_resource_types = set()
        for test_result in self.test_results:
            if 'resource_type' in test_result.details:
                tested_resource_types.add(test_result.details['resource_type'])
        
        resource_coverage = len(tested_resource_types) / total_resource_types if total_resource_types > 0 else 0
        
        self.coverage_metrics = {
            'test_suite_coverage': suite_coverage,
            'resource_type_coverage': resource_coverage,
            'total_resource_types': total_resource_types,
            'tested_resource_types': len(tested_resource_types)
        }
    
    async def _save_regression_report(self, report: RegressionSuiteReport):
        """Save regression report to file"""
        
        # Create reports directory if it doesn't exist
        reports_dir = current_dir / "reports"
        reports_dir.mkdir(exist_ok=True)
        
        # Save detailed report
        report_file = reports_dir / f"regression_report_{self.run_id}.json"
        with open(report_file, 'w') as f:
            json.dump(asdict(report), f, indent=2, default=str)
        
        # Save summary report
        summary_file = reports_dir / f"regression_summary_{self.run_id}.json"
        summary_data = {
            'run_id': report.run_id,
            'timestamp': report.start_time.isoformat(),
            'validation_level': report.validation_level,
            'total_tests': report.total_tests,
            'passed': report.passed,
            'failed': report.failed,
            'skipped': report.skipped,
            'errors': report.errors,
            'success_rate': report.success_rate,
            'duration': report.total_duration,
            'coverage_metrics': report.coverage_metrics,
            'performance_summary': {
                k: v for k, v in report.performance_metrics.items() 
                if 'ops_per_sec' in k or 'avg_duration' in k
            }
        }
        
        with open(summary_file, 'w') as f:
            json.dump(summary_data, f, indent=2)
        
        self.logger.info(f"Regression reports saved to {reports_dir}")
    
    async def _compare_with_previous_runs(self, report: RegressionSuiteReport):
        """Compare current run with previous runs for regression analysis"""
        
        reports_dir = current_dir / "reports"
        if not reports_dir.exists():
            return
        
        # Find most recent previous run
        summary_files = list(reports_dir.glob("regression_summary_*.json"))
        if len(summary_files) < 2:  # Need at least current + 1 previous
            return
        
        # Sort by creation time and get the second most recent (previous run)
        summary_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        previous_file = summary_files[1]  # Second most recent
        
        try:
            with open(previous_file, 'r') as f:
                previous_data = json.load(f)
            
            # Compare key metrics
            comparison = {
                'previous_run_id': previous_data['run_id'],
                'success_rate_change': report.success_rate - previous_data['success_rate'],
                'duration_change': report.total_duration - previous_data['duration'],
                'test_count_change': report.total_tests - previous_data['total_tests'],
                'new_failures': report.failed - previous_data['failed'],
                'coverage_changes': {}
            }
            
            # Coverage changes
            for metric, current_value in report.coverage_metrics.items():
                if metric in previous_data.get('coverage_metrics', {}):
                    previous_value = previous_data['coverage_metrics'][metric]
                    comparison['coverage_changes'][metric] = current_value - previous_value
            
            # Performance changes
            comparison['performance_changes'] = {}
            for metric, current_value in report.performance_metrics.items():
                if metric in previous_data.get('performance_summary', {}):
                    previous_value = previous_data['performance_summary'][metric]
                    if isinstance(current_value, (int, float)) and isinstance(previous_value, (int, float)):
                        comparison['performance_changes'][metric] = current_value - previous_value
            
            report.previous_run_comparison = comparison
            
        except Exception as e:
            self.logger.warning(f"Could not compare with previous run: {e}")


async def main():
    """Main entry point for automated regression testing"""
    logging.basicConfig(level=logging.INFO)
    
    import argparse
    parser = argparse.ArgumentParser(description="Automated Regression Testing Suite")
    parser.add_argument("--validation-level", choices=["basic", "standard", "strict", "comprehensive"],
                       default="standard", help="Validation level")
    parser.add_argument("--include-performance", action="store_true", help="Include performance benchmarks")
    parser.add_argument("--output-dir", type=str, help="Output directory for reports")
    
    args = parser.parse_args()
    
    # Initialize regression suite
    validation_level = ValidationLevel(args.validation_level)
    suite = AutomatedRegressionSuite(validation_level)
    
    print("Starting Automated Regression Testing Suite...")
    print("=" * 60)
    print(f"Run ID: {suite.run_id}")
    print(f"Validation Level: {validation_level.value}")
    print(f"Include Performance: {args.include_performance}")
    print()
    
    # Run regression suite
    report = await suite.run_complete_regression_suite(args.include_performance)
    
    # Display summary
    print("\nRegression Testing Summary:")
    print("=" * 60)
    print(f"Run ID: {report.run_id}")
    print(f"Duration: {report.total_duration:.2f}s")
    print(f"Total Tests: {report.total_tests}")
    print(f"Passed: {report.passed}")
    print(f"Failed: {report.failed}")
    print(f"Skipped: {report.skipped}")
    print(f"Errors: {report.errors}")
    print(f"Success Rate: {report.success_rate:.1f}%")
    
    print(f"\nCoverage Metrics:")
    for metric, value in report.coverage_metrics.items():
        if isinstance(value, float):
            print(f"  {metric}: {value:.1%}")
        else:
            print(f"  {metric}: {value}")
    
    if report.performance_metrics:
        print(f"\nPerformance Summary:")
        perf_ops = {k: v for k, v in report.performance_metrics.items() if 'ops_per_sec' in k}
        for metric, value in sorted(perf_ops.items())[:5]:  # Show top 5
            print(f"  {metric}: {value:.1f} ops/sec")
    
    if report.previous_run_comparison:
        print(f"\nRegression Analysis:")
        comp = report.previous_run_comparison
        print(f"  Success Rate Change: {comp['success_rate_change']:+.1f}%")
        print(f"  Duration Change: {comp['duration_change']:+.1f}s")
        print(f"  New Failures: {comp['new_failures']:+d}")
    
    # Exit with error code if regression detected
    regression_detected = (
        report.failed > 0 or 
        report.errors > 0 or 
        (report.previous_run_comparison and report.previous_run_comparison['new_failures'] > 0)
    )
    
    return 1 if regression_detected else 0


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))