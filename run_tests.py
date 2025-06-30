#!/usr/bin/env python3
"""
Comprehensive test runner for Teaching EMR System
Runs all unit tests and generates coverage reports
"""

import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}...")
    print(f"Command: {' '.join(command)}")
    
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print("Output:", result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed")
        print("Error:", e.stderr)
        if e.stdout:
            print("Output:", e.stdout)
        return False

def main():
    """Run comprehensive test suite"""
    print("🏥 Teaching EMR System - Comprehensive Test Suite")
    print("=" * 60)
    
    # Change to backend directory
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print(f"❌ Backend directory not found: {backend_dir}")
        return 1
    
    os.chdir(backend_dir)
    
    # Check if virtual environment exists
    venv_python = None
    if (Path.cwd() / "venv" / "bin" / "python").exists():
        venv_python = str(Path.cwd() / "venv" / "bin" / "python")
    elif (Path.cwd() / "venv" / "Scripts" / "python.exe").exists():
        venv_python = str(Path.cwd() / "venv" / "Scripts" / "python.exe")
    
    if venv_python:
        python_cmd = venv_python
        pip_cmd = venv_python.replace("python", "pip").replace(".exe", ".exe" if ".exe" in venv_python else "")
        print(f"📦 Using virtual environment: {venv_python}")
    else:
        python_cmd = sys.executable
        pip_cmd = "pip"
        print("📦 Using system Python")
    
    tests_passed = 0
    tests_failed = 0
    
    # Install test dependencies
    if not run_command([pip_cmd, "install", "pytest", "pytest-cov"], "Installing test dependencies"):
        tests_failed += 1
    else:
        tests_passed += 1
    
    # Run unit tests with coverage
    test_commands = [
        {
            "command": [python_cmd, "-m", "pytest", "tests/test_models.py", "-v"],
            "description": "Model unit tests"
        },
        {
            "command": [python_cmd, "-m", "pytest", "tests/test_fhir_endpoints.py", "-v"],
            "description": "FHIR endpoint tests"
        },
        {
            "command": [python_cmd, "-m", "pytest", "tests/test_cds_hooks.py", "-v"],
            "description": "CDS Hooks tests"
        },
        {
            "command": [python_cmd, "-m", "pytest", "tests/test_api_endpoints.py", "-v"],
            "description": "API endpoint tests"
        },
        {
            "command": [python_cmd, "-m", "pytest", "tests/", "--cov=.", "--cov-report=html", "--cov-report=term"],
            "description": "Full test suite with coverage"
        }
    ]
    
    for test in test_commands:
        if run_command(test["command"], test["description"]):
            tests_passed += 1
        else:
            tests_failed += 1
    
    # Test database population
    if run_command([python_cmd, "-c", "import populate_database; print('Database population script imports successfully')"], 
                   "Database population script validation"):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Test imports for all modules
    import_tests = [
        "import models.models",
        "import api.fhir.fhir_router",
        "import api.cds_hooks.cds_hooks_router", 
        "import api.app.app_router",
        "import services.analytics_service"
    ]
    
    for import_test in import_tests:
        if run_command([python_cmd, "-c", import_test], f"Import test: {import_test}"):
            tests_passed += 1
        else:
            tests_failed += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    total_tests = tests_passed + tests_failed
    success_rate = (tests_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if tests_failed == 0:
        print("\n🎉 All tests passed! The EMR system is ready for deployment.")
        print("\n📋 Next Steps:")
        print("1. Run: docker-compose up")
        print("2. Access EMR at: http://localhost:3000")
        print("3. Run system integration tests: python test_emr_system.py")
        return 0
    else:
        print(f"\n⚠️  {tests_failed} test(s) failed. Please review and fix issues before deployment.")
        return 1

if __name__ == "__main__":
    exit(main())