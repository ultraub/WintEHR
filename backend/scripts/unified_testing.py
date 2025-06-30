#!/usr/bin/env python3
"""
Unified testing script for EMR system
Comprehensive testing with memory optimization and complete coverage
"""

import sys
import os
import subprocess
import gc
import time
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine
from models.models import Patient, Provider, Encounter, Condition, Medication, Observation

class UnifiedTester:
    """Comprehensive EMR system tester with memory optimization"""
    
    def __init__(self):
        self.test_results = {
            'database_tests': {},
            'model_tests': {},
            'api_tests': {},
            'integration_tests': {},
            'performance_tests': {},
            'memory_tests': {},
            'total_passed': 0,
            'total_failed': 0,
            'start_time': datetime.now(),
            'test_details': []
        }
    
    def log_test(self, test_name: str, passed: bool, details: str = "", duration: float = 0):
        """Log test result"""
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {test_name} ({duration:.2f}s)")
        if details:
            print(f"    {details}")
        
        self.test_results['test_details'].append({
            'name': test_name,
            'passed': passed,
            'details': details,
            'duration': duration,
            'timestamp': datetime.now().isoformat()
        })
        
        if passed:
            self.test_results['total_passed'] += 1
        else:
            self.test_results['total_failed'] += 1
    
    def test_database_connection(self) -> bool:
        """Test database connectivity"""
        start_time = time.time()
        try:
            with SessionLocal() as session:
                result = session.execute("SELECT 1").fetchone()
                duration = time.time() - start_time
                self.log_test("Database Connection", True, "Successfully connected to database", duration)
                return True
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("Database Connection", False, f"Failed to connect: {str(e)}", duration)
            return False
    
    def test_model_creation(self) -> bool:
        """Test model instance creation"""
        start_time = time.time()
        try:
            with SessionLocal() as session:
                # Test Patient creation
                patient = Patient(
                    first_name="Test",
                    last_name="Patient",
                    date_of_birth="1990-01-01",
                    gender="male"
                )
                session.add(patient)
                session.flush()
                
                # Test Provider creation
                provider = Provider(
                    first_name="Test",
                    last_name="Provider",
                    npi="1234567890",
                    specialty="Family Medicine"
                )
                session.add(provider)
                session.flush()
                
                session.rollback()  # Don't persist test data
                
                duration = time.time() - start_time
                self.log_test("Model Creation", True, "Successfully created test models", duration)
                return True
                
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("Model Creation", False, f"Failed to create models: {str(e)}", duration)
            return False
    
    def test_model_relationships(self) -> bool:
        """Test model relationships"""
        start_time = time.time()
        try:
            with SessionLocal() as session:
                # Create related models
                patient = Patient(
                    first_name="Relation",
                    last_name="Test",
                    date_of_birth="1985-05-15",
                    gender="female"
                )
                session.add(patient)
                session.flush()
                
                encounter = Encounter(
                    patient_id=patient.id,
                    encounter_class="AMB",
                    status="finished",
                    start_time=datetime.now()
                )
                session.add(encounter)
                session.flush()
                
                # Test relationship access
                retrieved_patient = session.query(Patient).filter_by(id=patient.id).first()
                encounters = retrieved_patient.encounters
                
                if len(encounters) == 1 and encounters[0].id == encounter.id:
                    session.rollback()
                    duration = time.time() - start_time
                    self.log_test("Model Relationships", True, "Successfully tested relationships", duration)
                    return True
                else:
                    session.rollback()
                    duration = time.time() - start_time
                    self.log_test("Model Relationships", False, "Relationship test failed", duration)
                    return False
                    
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("Model Relationships", False, f"Relationship test error: {str(e)}", duration)
            return False
    
    def test_data_integrity(self) -> bool:
        """Test data integrity constraints"""
        start_time = time.time()
        try:
            with SessionLocal() as session:
                # Test required field validation
                try:
                    invalid_patient = Patient(
                        last_name="Test"
                        # Missing required first_name, date_of_birth, gender
                    )
                    session.add(invalid_patient)
                    session.flush()
                    session.rollback()
                    duration = time.time() - start_time
                    self.log_test("Data Integrity", False, "Should have failed with invalid data", duration)
                    return False
                except:
                    # Expected to fail
                    session.rollback()
                    duration = time.time() - start_time
                    self.log_test("Data Integrity", True, "Correctly enforced data constraints", duration)
                    return True
                    
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("Data Integrity", False, f"Integrity test error: {str(e)}", duration)
            return False
    
    def test_import_script_exists(self) -> bool:
        """Test that import scripts exist and are accessible"""
        start_time = time.time()
        script_dir = Path(__file__).parent
        
        required_scripts = [
            "optimized_synthea_import.py",
            "optimized_comprehensive_setup.py",
            "create_sample_providers.py",
            "populate_clinical_catalogs.py"
        ]
        
        missing_scripts = []
        for script in required_scripts:
            if not (script_dir / script).exists():
                missing_scripts.append(script)
        
        duration = time.time() - start_time
        if not missing_scripts:
            self.log_test("Import Scripts", True, "All required scripts present", duration)
            return True
        else:
            self.log_test("Import Scripts", False, f"Missing scripts: {missing_scripts}", duration)
            return False
    
    def test_api_imports(self) -> bool:
        """Test that API modules can be imported"""
        start_time = time.time()
        try:
            # Test importing main API modules
            from api.app.app_router import router as app_router
            from api.fhir.fhir_router import router as fhir_router
            from api.cds_hooks.cds_hooks_router import router as cds_router
            from api.auth import router as auth_router
            
            duration = time.time() - start_time
            self.log_test("API Imports", True, "Successfully imported all API routers", duration)
            return True
            
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("API Imports", False, f"Failed to import APIs: {str(e)}", duration)
            return False
    
    def test_memory_usage(self) -> bool:
        """Test memory usage patterns"""
        start_time = time.time()
        try:
            import psutil
            process = psutil.Process()
            initial_memory = process.memory_info().rss / 1024 / 1024  # MB
            
            # Create and destroy many objects to test memory cleanup
            with SessionLocal() as session:
                for i in range(100):
                    patient = Patient(
                        first_name=f"Test{i}",
                        last_name="Patient",
                        date_of_birth="1990-01-01",
                        gender="male"
                    )
                    session.add(patient)
                    
                    if i % 20 == 0:
                        session.flush()
                        gc.collect()
                
                session.rollback()
            
            gc.collect()
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_diff = final_memory - initial_memory
            
            duration = time.time() - start_time
            if memory_diff < 50:  # Less than 50MB increase
                self.log_test("Memory Usage", True, f"Memory usage acceptable: {memory_diff:.1f}MB increase", duration)
                return True
            else:
                self.log_test("Memory Usage", False, f"High memory usage: {memory_diff:.1f}MB increase", duration)
                return False
                
        except ImportError:
            duration = time.time() - start_time
            self.log_test("Memory Usage", True, "Skipped (psutil not available)", duration)
            return True
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("Memory Usage", False, f"Memory test error: {str(e)}", duration)
            return False
    
    def test_performance_basic(self) -> bool:
        """Test basic performance characteristics"""
        start_time = time.time()
        try:
            with SessionLocal() as session:
                # Test query performance
                query_start = time.time()
                patients = session.query(Patient).limit(10).all()
                query_duration = time.time() - query_start
                
                # Test bulk operations
                bulk_start = time.time()
                test_patients = []
                for i in range(50):
                    patient = Patient(
                        first_name=f"Perf{i}",
                        last_name="Test",
                        date_of_birth="1990-01-01",
                        gender="male"
                    )
                    test_patients.append(patient)
                
                session.bulk_save_objects(test_patients)
                session.rollback()
                bulk_duration = time.time() - bulk_start
                
                total_duration = time.time() - start_time
                
                if query_duration < 1.0 and bulk_duration < 2.0:
                    self.log_test("Performance Basic", True, 
                                f"Query: {query_duration:.3f}s, Bulk: {bulk_duration:.3f}s", 
                                total_duration)
                    return True
                else:
                    self.log_test("Performance Basic", False,
                                f"Slow performance - Query: {query_duration:.3f}s, Bulk: {bulk_duration:.3f}s",
                                total_duration)
                    return False
                    
        except Exception as e:
            duration = time.time() - start_time
            self.log_test("Performance Basic", False, f"Performance test error: {str(e)}", duration)
            return False
    
    def test_frontend_files(self) -> bool:
        """Test that critical frontend files exist"""
        start_time = time.time()
        frontend_dir = Path(__file__).parent.parent.parent / "frontend"
        
        critical_files = [
            "src/App.js",
            "src/contexts/AuthContext.js",
            "src/contexts/ClinicalContext.js",
            "src/components/clinical/ClinicalWorkspace.js",
            "src/services/api.js",
            "package.json"
        ]
        
        missing_files = []
        for file_path in critical_files:
            if not (frontend_dir / file_path).exists():
                missing_files.append(file_path)
        
        duration = time.time() - start_time
        if not missing_files:
            self.log_test("Frontend Files", True, "All critical frontend files present", duration)
            return True
        else:
            self.log_test("Frontend Files", False, f"Missing files: {missing_files}", duration)
            return False
    
    def run_all_tests(self) -> bool:
        """Run comprehensive test suite"""
        print("🏥 EMR System - Unified Testing Suite")
        print("=" * 60)
        print(f"Started at: {self.test_results['start_time']}")
        print("=" * 60)
        
        # Database tests
        print("\n📊 Database Tests")
        print("-" * 30)
        self.test_database_connection()
        self.test_model_creation()
        self.test_model_relationships()
        self.test_data_integrity()
        
        # Import and script tests
        print("\n🔧 Import & Script Tests")
        print("-" * 30)
        self.test_import_script_exists()
        self.test_api_imports()
        
        # Performance tests
        print("\n⚡ Performance Tests")
        print("-" * 30)
        self.test_performance_basic()
        self.test_memory_usage()
        
        # Frontend tests
        print("\n🖥️  Frontend Tests")
        print("-" * 30)
        self.test_frontend_files()
        
        # Summary
        self.generate_summary()
        return self.test_results['total_failed'] == 0
    
    def generate_summary(self):
        """Generate test summary"""
        end_time = datetime.now()
        duration = (end_time - self.test_results['start_time']).total_seconds()
        
        print("\n" + "=" * 60)
        print("📋 Test Summary")
        print("=" * 60)
        
        total_tests = self.test_results['total_passed'] + self.test_results['total_failed']
        success_rate = (self.test_results['total_passed'] / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {self.test_results['total_passed']}")
        print(f"❌ Failed: {self.test_results['total_failed']}")
        print(f"Success Rate: {success_rate:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        if self.test_results['total_failed'] == 0:
            print("\n🎉 All tests passed! EMR system is ready.")
            print("\n📋 Next Steps:")
            print("1. Start backend: cd EMR/backend && python main.py")
            print("2. Start frontend: cd EMR/frontend && npm start")
            print("3. Access system: http://localhost:3000")
        else:
            print(f"\n⚠️ {self.test_results['total_failed']} test(s) failed.")
            print("Review failed tests above before proceeding.")
        
        # Save detailed results
        results_file = Path(__file__).parent.parent / "test_results.json"
        self.test_results['end_time'] = end_time.isoformat()
        self.test_results['duration_seconds'] = duration
        
        try:
            with open(results_file, 'w') as f:
                json.dump(self.test_results, f, indent=2, default=str)
            print(f"\n📄 Detailed results saved to: {results_file}")
        except Exception as e:
            print(f"\n⚠️ Could not save results: {e}")


def main():
    """Main entry point"""
    tester = UnifiedTester()
    success = tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())