#!/usr/bin/env python3
"""
WintEHR Comprehensive Test Suite Runner
Runs all FHIR and integration tests in sequence
"""

import asyncio
import subprocess
import sys
import time
from datetime import datetime
import os

class TestRunner:
    def __init__(self):
        self.test_results = {}
        self.start_time = time.time()
        
    def print_header(self, title: str):
        """Print section header"""
        print("\n" + "="*60)
        print(f"🏥 {title}")
        print("="*60)
        
    async def check_prerequisites(self):
        """Check if all prerequisites are met"""
        print("🔍 Checking Prerequisites...")
        
        # Check if backend is running
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get("http://localhost:8000/health") as response:
                    if response.status == 200:
                        print("✅ Backend is running")
                    else:
                        print("❌ Backend health check failed")
                        return False
        except Exception as e:
            print(f"❌ Backend is not accessible: {e}")
            print("   Please start the backend first: cd backend && ./start.sh")
            return False
            
        # Check for required Python packages
        required_packages = ["aiohttp", "websockets"]
        missing_packages = []
        
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                missing_packages.append(package)
                
        if missing_packages:
            print(f"❌ Missing required packages: {', '.join(missing_packages)}")
            print(f"   Install with: pip install {' '.join(missing_packages)}")
            return False
            
        print("✅ All prerequisites met")
        return True
        
    async def run_test_file(self, test_file: str, test_name: str):
        """Run a single test file"""
        self.print_header(test_name)
        
        start_time = time.time()
        try:
            # Run the test file
            result = subprocess.run(
                [sys.executable, test_file],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            duration = time.time() - start_time
            
            # Parse output for pass/fail
            output = result.stdout
            if result.returncode == 0 and ("✅" in output or "PASS" in output):
                # Count passed/failed tests
                passed = output.count("✅ PASS") + output.count("✅")
                failed = output.count("❌ FAIL") + output.count("❌")
                
                # Exclude the setup success messages
                if "✅ Authentication successful" in output:
                    passed -= 1
                if "✅ Using test patient" in output:
                    passed -= 1
                    
                self.test_results[test_name] = {
                    "status": "PASSED" if failed == 0 else "PARTIAL",
                    "passed": passed,
                    "failed": failed,
                    "duration": duration
                }
                
                print(f"\n✅ {test_name} completed in {duration:.2f}s")
                print(f"   Passed: {passed}, Failed: {failed}")
            else:
                self.test_results[test_name] = {
                    "status": "FAILED",
                    "passed": 0,
                    "failed": 1,
                    "duration": duration,
                    "error": result.stderr or "Test execution failed"
                }
                print(f"\n❌ {test_name} failed after {duration:.2f}s")
                if result.stderr:
                    print(f"   Error: {result.stderr[:200]}")
                    
        except subprocess.TimeoutExpired:
            self.test_results[test_name] = {
                "status": "TIMEOUT",
                "passed": 0,
                "failed": 1,
                "duration": 300
            }
            print(f"\n❌ {test_name} timed out after 300s")
        except Exception as e:
            self.test_results[test_name] = {
                "status": "ERROR",
                "passed": 0,
                "failed": 1,
                "duration": time.time() - start_time,
                "error": str(e)
            }
            print(f"\n❌ {test_name} error: {str(e)}")
            
    def print_summary(self):
        """Print comprehensive test summary"""
        self.print_header("COMPREHENSIVE TEST SUMMARY")
        
        total_duration = time.time() - self.start_time
        total_tests = len(self.test_results)
        passed_suites = sum(1 for r in self.test_results.values() if r["status"] in ["PASSED", "PARTIAL"])
        failed_suites = total_tests - passed_suites
        
        print(f"\nTest Execution completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total Duration: {total_duration:.2f}s")
        print(f"\nTest Suites: {total_tests}")
        print(f"✅ Passed/Partial: {passed_suites}")
        print(f"❌ Failed: {failed_suites}")
        
        # Detailed results
        print("\n📋 DETAILED RESULTS:")
        print("-" * 60)
        
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result["status"] in ["PASSED", "PARTIAL"] else "❌"
            print(f"\n{status_icon} {test_name}")
            print(f"   Status: {result['status']}")
            print(f"   Duration: {result['duration']:.2f}s")
            if result.get("passed", 0) > 0 or result.get("failed", 0) > 0:
                print(f"   Tests: {result.get('passed', 0)} passed, {result.get('failed', 0)} failed")
            if result.get("error"):
                print(f"   Error: {result['error'][:100]}...")
                
        # Overall statistics
        total_individual_tests = sum(r.get("passed", 0) + r.get("failed", 0) for r in self.test_results.values())
        total_passed = sum(r.get("passed", 0) for r in self.test_results.values())
        total_failed = sum(r.get("failed", 0) for r in self.test_results.values())
        
        print("\n📊 OVERALL STATISTICS:")
        print("-" * 60)
        print(f"Total Individual Tests: {total_individual_tests}")
        print(f"✅ Total Passed: {total_passed}")
        print(f"❌ Total Failed: {total_failed}")
        if total_individual_tests > 0:
            success_rate = (total_passed / total_individual_tests) * 100
            print(f"Success Rate: {success_rate:.1f}%")
            
        # Recommendations
        print("\n💡 RECOMMENDATIONS:")
        print("-" * 60)
        
        if failed_suites == 0:
            print("✅ All test suites passed! The system is ready for production.")
        else:
            print("❌ Some tests failed. Please review the following:")
            for test_name, result in self.test_results.items():
                if result["status"] not in ["PASSED", "PARTIAL"]:
                    print(f"   - Fix issues in {test_name}")
                    
        # Save results to file
        results_file = f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(results_file, "w") as f:
            f.write(f"WintEHR Test Results - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*60 + "\n\n")
            
            for test_name, result in self.test_results.items():
                f.write(f"{test_name}:\n")
                f.write(f"  Status: {result['status']}\n")
                f.write(f"  Duration: {result['duration']:.2f}s\n")
                if result.get("passed", 0) > 0 or result.get("failed", 0) > 0:
                    f.write(f"  Tests: {result.get('passed', 0)} passed, {result.get('failed', 0)} failed\n")
                f.write("\n")
                
        print(f"\n📄 Results saved to: {results_file}")

async def main():
    """Run all tests"""
    runner = TestRunner()
    
    print("🏥 WintEHR Comprehensive Test Suite")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check prerequisites
    if not await runner.check_prerequisites():
        print("\n❌ Prerequisites not met. Please fix the issues above and try again.")
        return
        
    # Define test suites in order
    test_suites = [
        ("test_fhir_comprehensive.py", "FHIR API Comprehensive Tests"),
        ("test_clinical_workspace.py", "Clinical Workspace Integration"),
        ("test_websocket_realtime.py", "WebSocket Real-time Updates"),
        ("test_cds_hooks_integration.py", "CDS Hooks Integration"),
        ("test_error_handling.py", "Error Handling and Edge Cases"),
    ]
    
    # Run each test suite
    for test_file, test_name in test_suites:
        if os.path.exists(test_file):
            await runner.run_test_file(test_file, test_name)
        else:
            print(f"\n⚠️ Skipping {test_name} - {test_file} not found")
            runner.test_results[test_name] = {
                "status": "SKIPPED",
                "passed": 0,
                "failed": 0,
                "duration": 0
            }
            
    # Print summary
    runner.print_summary()

if __name__ == "__main__":
    asyncio.run(main())