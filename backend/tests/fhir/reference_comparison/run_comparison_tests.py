#!/usr/bin/env python3
"""
Run comprehensive FHIR implementation comparison tests

This script orchestrates the complete comparison testing process:
1. Starts reference server (if needed)
2. Synchronizes test data
3. Runs comparison tests
4. Generates reports
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
import subprocess

# Import our modules
from reference_impl_comparison import run_reference_comparison
from sync_test_data import FHIRDataSynchronizer
from setup_reference_server import ReferenceServerSetup


class ComprehensiveComparisonRunner:
    """Orchestrates the complete comparison testing process"""
    
    def __init__(self, our_server: str, reference_server: str,
                 manage_reference: bool = False):
        self.our_server = our_server
        self.reference_server = reference_server
        self.manage_reference = manage_reference
        self.reports_dir = Path(__file__).parent / "reports"
        self.reports_dir.mkdir(exist_ok=True)
        
    async def setup_reference_server(self):
        """Setup reference server if needed"""
        if self.manage_reference:
            setup = ReferenceServerSetup(self.reference_server)
            setup.start_reference_server()
            return True
        return False
    
    async def sync_data(self) -> bool:
        """Synchronize data between servers"""
        print("\n" + "="*60)
        print("SYNCHRONIZING TEST DATA")
        print("="*60)
        
        async with FHIRDataSynchronizer(self.our_server, self.reference_server) as syncer:
            # First verify current state
            print("\nChecking current sync status...")
            pre_verification = await syncer.verify_sync()
            
            if pre_verification['matches']:
                print("✓ Servers already have matching data")
                return True
            
            # Perform sync
            print("\nSynchronizing data...")
            results = await syncer.sync_all_data()
            
            # Verify after sync
            print("\nVerifying synchronization...")
            post_verification = await syncer.verify_sync()
            
            if post_verification['matches']:
                print("✓ Data synchronized successfully")
                return True
            else:
                print("✗ Data synchronization incomplete")
                return False
    
    async def run_comparison_tests(self) -> bool:
        """Run the comparison tests"""
        print("\n" + "="*60)
        print("RUNNING COMPARISON TESTS")
        print("="*60)
        
        # Generate report filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.reports_dir / f"comparison_report_{timestamp}.txt"
        
        # Run comparison
        success = await run_reference_comparison(
            self.our_server,
            self.reference_server,
            str(report_file)
        )
        
        print(f"\nReport saved to: {report_file}")
        
        # Also generate JSON report for programmatic analysis
        json_report_file = self.reports_dir / f"comparison_report_{timestamp}.json"
        await self._generate_json_report(json_report_file)
        
        return success
    
    async def _generate_json_report(self, output_file: Path):
        """Generate a JSON report for programmatic analysis"""
        # This would require modifying the comparison module to return structured data
        # For now, we'll create a placeholder
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "our_server": self.our_server,
            "reference_server": self.reference_server,
            "summary": {
                "status": "completed",
                "note": "See text report for detailed results"
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
    
    def cleanup_reference_server(self):
        """Stop reference server if we started it"""
        if self.manage_reference:
            setup = ReferenceServerSetup(self.reference_server)
            setup.stop_reference_server()
    
    async def run_full_comparison(self) -> bool:
        """Run the complete comparison process"""
        try:
            # Setup
            if self.manage_reference:
                print("Starting reference FHIR server...")
                await self.setup_reference_server()
            
            # Sync data
            sync_success = await self.sync_data()
            if not sync_success:
                print("\n⚠️  WARNING: Data sync was incomplete")
                print("Continuing with comparison anyway...\n")
            
            # Run tests
            test_success = await self.run_comparison_tests()
            
            # Generate summary
            self._print_summary(sync_success, test_success)
            
            return test_success
            
        finally:
            # Cleanup
            if self.manage_reference:
                print("\nStopping reference server...")
                self.cleanup_reference_server()
    
    def _print_summary(self, sync_success: bool, test_success: bool):
        """Print overall summary"""
        print("\n" + "="*60)
        print("COMPARISON TEST SUMMARY")
        print("="*60)
        print(f"Data Sync: {'✓ Success' if sync_success else '✗ Failed'}")
        print(f"Comparison Tests: {'✓ Passed' if test_success else '✗ Failed'}")
        print(f"Reports Directory: {self.reports_dir}")
        
        if test_success:
            print("\n✓ Implementation comparison PASSED")
            print("Your FHIR implementation is compatible with the reference")
        else:
            print("\n✗ Implementation comparison FAILED")
            print("Review the report for specific discrepancies")


async def run_quick_check():
    """Run a quick compatibility check with minimal data"""
    print("\n" + "="*60)
    print("QUICK COMPATIBILITY CHECK")
    print("="*60)
    
    our_server = "http://localhost:8000/fhir/R4"
    reference_server = "http://hapi.fhir.org/baseR4"  # Public HAPI server
    
    # Run a few key queries
    from reference_impl_comparison import ReferenceImplementationTester
    
    async with ReferenceImplementationTester(our_server, reference_server) as tester:
        test_queries = [
            ("Basic Patient search", "Patient", {}),
            ("Patient by name", "Patient", {"name": "Smith"}),
            ("Observations with code", "Observation", {"code": "8867-4"}),
            ("Include test", "Patient", {"_include": "Patient:general-practitioner"}),
            ("Chained search", "Observation", {"patient.name": "Smith"})
        ]
        
        print("\nRunning quick compatibility checks...")
        passed = 0
        failed = 0
        
        for description, resource_type, params in test_queries:
            result = await tester.compare_query(resource_type, params, description)
            
            if result.passed:
                print(f"✓ {description}")
                passed += 1
            else:
                print(f"✗ {description}")
                print(f"  - Match: {result.match_percentage:.1f}%")
                for diff in result.differences[:2]:  # Show first 2 differences
                    print(f"  - {diff}")
                failed += 1
        
        print(f"\nQuick check: {passed} passed, {failed} failed")
        return failed == 0


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Run FHIR implementation comparison tests',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full comparison with local reference server
  %(prog)s --full --manage-reference
  
  # Run comparison against existing reference server
  %(prog)s --full --reference-server http://localhost:8080/fhir
  
  # Quick check against public HAPI server
  %(prog)s --quick
  
  # Just sync data between servers
  %(prog)s --sync-only
        """
    )
    
    parser.add_argument('--our-server', default='http://localhost:8000/fhir/R4',
                       help='Our FHIR server URL')
    parser.add_argument('--reference-server', default='http://localhost:8080/fhir',
                       help='Reference FHIR server URL')
    parser.add_argument('--manage-reference', action='store_true',
                       help='Start/stop reference server automatically')
    parser.add_argument('--full', action='store_true',
                       help='Run full comparison suite')
    parser.add_argument('--quick', action='store_true',
                       help='Run quick compatibility check')
    parser.add_argument('--sync-only', action='store_true',
                       help='Only sync data, no comparison')
    
    args = parser.parse_args()
    
    # Default to quick check if no mode specified
    if not args.full and not args.quick and not args.sync_only:
        args.quick = True
    
    success = True
    
    if args.quick:
        success = await run_quick_check()
    
    elif args.sync_only:
        async with FHIRDataSynchronizer(args.our_server, args.reference_server) as syncer:
            results = await syncer.sync_all_data()
            verification = await syncer.verify_sync()
            success = verification['matches']
    
    elif args.full:
        runner = ComprehensiveComparisonRunner(
            args.our_server,
            args.reference_server,
            args.manage_reference
        )
        success = await runner.run_full_comparison()
    
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)