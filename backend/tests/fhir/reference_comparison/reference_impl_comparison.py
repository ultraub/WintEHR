#!/usr/bin/env python3
"""
FHIR Reference Implementation Comparison Tests

Compares our FHIR implementation behavior against reference implementations
like HAPI FHIR to ensure consistency and compliance.
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import difflib
import os
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class ComparisonResult:
    """Result of comparing a single query between implementations"""
    query: str
    our_total: int
    reference_total: int
    match_percentage: float
    differences: List[str] = field(default_factory=list)
    passed: bool = False
    error: Optional[str] = None


@dataclass 
class ImplementationComparison:
    """Overall comparison report between implementations"""
    timestamp: datetime
    our_server: str
    reference_server: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    results: List[ComparisonResult] = field(default_factory=list)
    
    @property
    def success_rate(self) -> float:
        if self.total_tests == 0:
            return 0.0
        return (self.passed_tests / self.total_tests) * 100


class ReferenceImplementationTester:
    """Compares FHIR query results between implementations"""
    
    def __init__(self, our_server: str, reference_server: str):
        self.our_server = our_server.rstrip('/')
        self.reference_server = reference_server.rstrip('/')
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def execute_query(self, server: str, resource_type: str, params: Dict[str, str]) -> Dict[str, Any]:
        """Execute a FHIR query against a server"""
        try:
            url = f"{server}/{resource_type}"
            async with self.session.get(url, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    return {"error": f"HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}
    
    def normalize_bundle(self, bundle: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize a bundle for comparison (remove server-specific fields)"""
        if "error" in bundle:
            return bundle
            
        normalized = {
            "resourceType": bundle.get("resourceType", "Bundle"),
            "type": bundle.get("type", "searchset"),
            "total": bundle.get("total", 0),
            "entry": []
        }
        
        # Normalize entries
        for entry in bundle.get("entry", []):
            resource = entry.get("resource", {})
            # Remove server-specific metadata
            if "meta" in resource:
                resource["meta"].pop("versionId", None)
                resource["meta"].pop("lastUpdated", None)
                resource["meta"].pop("source", None)
            
            normalized_entry = {
                "resource": resource,
                "search": entry.get("search", {})
            }
            normalized["entry"].append(normalized_entry)
        
        return normalized
    
    def compare_bundles(self, our_bundle: Dict[str, Any], ref_bundle: Dict[str, Any]) -> Tuple[float, List[str]]:
        """Compare two bundles and return match percentage and differences"""
        differences = []
        
        # Check for errors
        if "error" in our_bundle:
            differences.append(f"Our server error: {our_bundle['error']}")
            return 0.0, differences
        if "error" in ref_bundle:
            differences.append(f"Reference server error: {ref_bundle['error']}")
            return 0.0, differences
        
        # Compare totals
        our_total = our_bundle.get("total", 0)
        ref_total = ref_bundle.get("total", 0)
        
        if our_total != ref_total:
            differences.append(f"Total mismatch: our={our_total}, reference={ref_total}")
        
        # Compare resource IDs
        our_ids = {
            entry["resource"]["id"]
            for entry in our_bundle.get("entry", [])
            if "resource" in entry and "id" in entry["resource"]
        }
        
        ref_ids = {
            entry["resource"]["id"] 
            for entry in ref_bundle.get("entry", [])
            if "resource" in entry and "id" in entry["resource"]
        }
        
        # Find differences
        only_in_ours = our_ids - ref_ids
        only_in_ref = ref_ids - our_ids
        common_ids = our_ids & ref_ids
        
        if only_in_ours:
            differences.append(f"IDs only in our results: {sorted(only_in_ours)[:5]}")
        if only_in_ref:
            differences.append(f"IDs only in reference: {sorted(only_in_ref)[:5]}")
        
        # Calculate match percentage
        if len(our_ids) + len(ref_ids) == 0:
            match_percentage = 100.0
        else:
            match_percentage = (2 * len(common_ids)) / (len(our_ids) + len(ref_ids)) * 100
        
        return match_percentage, differences
    
    async def compare_query(self, resource_type: str, params: Dict[str, str], 
                          description: str = "") -> ComparisonResult:
        """Compare a single query between implementations"""
        # Execute on both servers
        our_result = await self.execute_query(self.our_server, resource_type, params)
        ref_result = await self.execute_query(self.reference_server, resource_type, params)
        
        # Normalize for comparison
        our_normalized = self.normalize_bundle(our_result)
        ref_normalized = self.normalize_bundle(ref_result)
        
        # Compare results
        match_percentage, differences = self.compare_bundles(our_normalized, ref_normalized)
        
        query_str = f"{resource_type}?{self._params_to_string(params)}"
        if description:
            query_str = f"{description}: {query_str}"
        
        result = ComparisonResult(
            query=query_str,
            our_total=our_normalized.get("total", 0),
            reference_total=ref_normalized.get("total", 0),
            match_percentage=match_percentage,
            differences=differences,
            passed=match_percentage >= 90.0 and len(differences) <= 1
        )
        
        return result
    
    def _params_to_string(self, params: Dict[str, str]) -> str:
        """Convert params dict to query string"""
        return "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    
    async def run_comparison_suite(self) -> ImplementationComparison:
        """Run comprehensive comparison test suite"""
        comparison = ImplementationComparison(
            timestamp=datetime.utcnow(),
            our_server=self.our_server,
            reference_server=self.reference_server,
            total_tests=0,
            passed_tests=0,
            failed_tests=0
        )
        
        # Define test queries
        test_queries = [
            # Basic searches
            ("Patient", {}, "All patients"),
            ("Patient", {"_count": "10"}, "Patients with count limit"),
            ("Patient", {"gender": "female"}, "Female patients"),
            ("Patient", {"name": "Smith"}, "Patients named Smith"),
            ("Patient", {"birthdate": "ge1980-01-01"}, "Patients born after 1980"),
            
            # Complex searches  
            ("Patient", {"gender": "male", "birthdate": "le1990-12-31"}, "Male patients born before 1991"),
            ("Patient", {"_sort": "birthdate"}, "Patients sorted by birthdate"),
            ("Patient", {"_sort": "-name"}, "Patients reverse sorted by name"),
            
            # Include/Revinclude
            ("Patient", {"_include": "Patient:general-practitioner"}, "Patients with practitioners"),
            ("Patient", {"_revinclude": "Observation:patient", "_count": "5"}, "Patients with observations"),
            
            # Chained searches
            ("Patient", {"general-practitioner.name": "Smith"}, "Patients whose GP is named Smith"),
            ("Observation", {"patient.name": "Smith"}, "Observations for patients named Smith"),
            
            # Observation searches
            ("Observation", {"code": "8867-4"}, "Heart rate observations"),
            ("Observation", {"status": "final"}, "Final observations"),
            ("Observation", {"value-quantity": "gt70"}, "Observations with value > 70"),
            
            # MedicationRequest searches
            ("MedicationRequest", {"status": "active"}, "Active medication requests"),
            ("MedicationRequest", {"_include": "MedicationRequest:medication"}, "Medications with includes"),
            
            # Practitioner searches
            ("Practitioner", {"name": "Smith"}, "Practitioners named Smith"),
            ("Practitioner", {"_revinclude": "Patient:general-practitioner"}, "Practitioners with patients"),
            
            # Organization searches
            ("Organization", {"name": "General"}, "Organizations with 'General' in name"),
            ("Organization", {"_include": "Organization:partof"}, "Organizations with hierarchy"),
            
            # _has parameter
            ("Patient", {"_has:Observation:patient:code": "8867-4"}, "Patients with heart rate observations"),
            ("Practitioner", {"_has:Patient:general-practitioner:gender": "female"}, "Practitioners with female patients"),
            
            # Composite searches
            ("Observation", {"combo-code-value-quantity": "8867-4$gt70"}, "Heart rate > 70"),
            
            # Summary modes
            ("Patient", {"_summary": "count"}, "Patient count only"),
            ("Patient", {"_summary": "true", "_count": "10"}, "Patient summary"),
            
            # Elements parameter
            ("Patient", {"_elements": "id,name,gender"}, "Partial patient data"),
            
            # Text search
            ("Patient", {"_text": "diabetes"}, "Text search for diabetes"),
            ("Condition", {"_content": "hypertension"}, "Content search for hypertension"),
        ]
        
        # Run each test query
        for resource_type, params, description in test_queries:
            logger.info(f"Comparing: {description}")
            result = await self.compare_query(resource_type, params, description)
            comparison.results.append(result)
            comparison.total_tests += 1
            
            if result.passed:
                comparison.passed_tests += 1
                logger.info(f"✓ PASSED: {result.query} (match: {result.match_percentage:.1f}%)")
            else:
                comparison.failed_tests += 1
                logger.warning(f"✗ FAILED: {result.query}")
                for diff in result.differences:
                    logger.warning(f"  - {diff}")
        
        return comparison


def generate_comparison_report(comparison: ImplementationComparison) -> str:
    """Generate a detailed comparison report"""
    report = f"""
FHIR Implementation Comparison Report
=====================================
Generated: {comparison.timestamp.isoformat()}
Our Server: {comparison.our_server}
Reference Server: {comparison.reference_server}

Summary
-------
Total Tests: {comparison.total_tests}
Passed: {comparison.passed_tests}
Failed: {comparison.failed_tests}
Success Rate: {comparison.success_rate:.1f}%

Detailed Results
----------------
"""
    
    # Group by pass/fail
    passed_results = [r for r in comparison.results if r.passed]
    failed_results = [r for r in comparison.results if not r.passed]
    
    if failed_results:
        report += "\nFAILED TESTS:\n"
        for result in failed_results:
            report += f"\n{result.query}\n"
            report += f"  Our Total: {result.our_total}, Reference Total: {result.reference_total}\n"
            report += f"  Match: {result.match_percentage:.1f}%\n"
            if result.differences:
                report += "  Differences:\n"
                for diff in result.differences:
                    report += f"    - {diff}\n"
    
    if passed_results:
        report += "\nPASSED TESTS:\n"
        for result in passed_results:
            report += f"  ✓ {result.query} (match: {result.match_percentage:.1f}%)\n"
    
    # Recommendations
    report += "\nRecommendations\n---------------\n"
    if comparison.success_rate < 50:
        report += "- Critical: Major discrepancies found. Review search implementation.\n"
    elif comparison.success_rate < 80:
        report += "- Warning: Several discrepancies found. Focus on failed queries.\n"
    elif comparison.success_rate < 95:
        report += "- Good: Minor discrepancies. Fine-tune edge cases.\n"
    else:
        report += "- Excellent: Implementation closely matches reference.\n"
    
    # Common issues
    common_issues = set()
    for result in failed_results:
        if "Total mismatch" in str(result.differences):
            common_issues.add("Result count differences")
        if "IDs only in" in str(result.differences):
            common_issues.add("Different resources returned")
    
    if common_issues:
        report += "\nCommon Issues:\n"
        for issue in common_issues:
            report += f"- {issue}\n"
    
    return report


async def run_reference_comparison(our_server: str, reference_server: str,
                                 output_file: Optional[str] = None):
    """Run reference implementation comparison tests"""
    logger.info(f"Starting reference implementation comparison")
    logger.info(f"Our server: {our_server}")
    logger.info(f"Reference server: {reference_server}")
    
    async with ReferenceImplementationTester(our_server, reference_server) as tester:
        comparison = await tester.run_comparison_suite()
    
    # Generate report
    report = generate_comparison_report(comparison)
    
    # Save report
    if output_file:
        with open(output_file, 'w') as f:
            f.write(report)
        logger.info(f"Report saved to {output_file}")
    else:
        print(report)
    
    # Return success based on threshold
    return comparison.success_rate >= 80.0


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Compare FHIR implementations')
    parser.add_argument('--our-server', default='http://localhost:8000/fhir/R4',
                       help='Our FHIR server URL')
    parser.add_argument('--reference-server', default='http://hapi.fhir.org/baseR4',
                       help='Reference FHIR server URL')
    parser.add_argument('--output', help='Output file for comparison report')
    
    args = parser.parse_args()
    
    # Run comparison
    success = await run_reference_comparison(
        args.our_server,
        args.reference_server,
        args.output
    )
    
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)