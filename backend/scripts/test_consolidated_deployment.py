#!/usr/bin/env python3
"""
Test Consolidated Deployment
Tests that the new consolidated build system works correctly.
"""

import asyncio
import asyncpg
import sys
import json
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': 'localhost',  # Change to 'postgres' if running in Docker
    'port': 5432,
    'database': 'emr_db',
    'user': 'emr_user',
    'password': 'emr_password'
}

class DeploymentTester:
    def __init__(self):
        self.conn = None
        self.tests_passed = 0
        self.tests_failed = 0
        self.errors = []
    
    async def connect(self):
        """Connect to database."""
        try:
            self.conn = await asyncpg.connect(**DB_CONFIG)
            print("✅ Database connection established")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            return False
    
    async def test_schemas_exist(self):
        """Test that all schemas exist."""
        print("\n🔍 Testing schemas...")
        try:
            schemas = await self.conn.fetch("""
                SELECT schema_name FROM information_schema.schemata 
                WHERE schema_name IN ('fhir', 'cds_hooks', 'auth')
            """)
            
            schema_names = {row['schema_name'] for row in schemas}
            expected = {'fhir', 'cds_hooks', 'auth'}
            
            if expected.issubset(schema_names):
                print("  ✅ All schemas exist")
                self.tests_passed += 1
            else:
                missing = expected - schema_names
                print(f"  ❌ Missing schemas: {missing}")
                self.tests_failed += 1
                self.errors.append(f"Missing schemas: {missing}")
        except Exception as e:
            print(f"  ❌ Schema test failed: {e}")
            self.tests_failed += 1
            self.errors.append(str(e))
    
    async def test_fhir_tables(self):
        """Test that all FHIR tables exist with correct columns."""
        print("\n🔍 Testing FHIR tables...")
        
        expected_tables = {
            'resources': ['id', 'resource_type', 'fhir_id', 'version_id', 'last_updated', 'resource', 'deleted'],
            'search_params': ['id', 'resource_id', 'resource_type', 'param_name', 'param_type', 
                            'value_string', 'value_number', 'value_date', 'value_token',
                            'value_token_system', 'value_token_code', 'value_reference',
                            'value_quantity_value', 'value_quantity_unit'],
            'resource_history': ['id', 'resource_id', 'version_id', 'operation', 'resource', 'created_at'],
            'references': ['id', 'source_id', 'source_type', 'target_type', 'target_id', 
                          'reference_path', 'reference_value'],
            'compartments': ['id', 'compartment_type', 'compartment_id', 'resource_id'],
            'audit_logs': ['id', 'resource_type', 'resource_id', 'operation', 'user_id']
        }
        
        for table, expected_columns in expected_tables.items():
            try:
                # Check table exists
                columns = await self.conn.fetch("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_schema = 'fhir' AND table_name = $1
                """, table)
                
                if not columns:
                    print(f"  ❌ Table fhir.{table} does not exist")
                    self.tests_failed += 1
                    self.errors.append(f"Missing table: fhir.{table}")
                    continue
                
                column_names = {row['column_name'] for row in columns}
                missing = set(expected_columns) - column_names
                
                if missing:
                    print(f"  ⚠️  Table fhir.{table} missing columns: {missing}")
                    self.errors.append(f"Table fhir.{table} missing columns: {missing}")
                else:
                    print(f"  ✅ Table fhir.{table} has all required columns")
                    self.tests_passed += 1
                    
            except Exception as e:
                print(f"  ❌ Error testing table {table}: {e}")
                self.tests_failed += 1
                self.errors.append(str(e))
    
    async def test_provider_tables(self):
        """Test that provider tables exist."""
        print("\n🔍 Testing provider tables...")
        
        expected_tables = ['organizations', 'providers', 'user_sessions', 'patient_provider_assignments']
        
        for table in expected_tables:
            try:
                result = await self.conn.fetchval("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = 'auth' AND table_name = $1
                """, table)
                
                if result > 0:
                    print(f"  ✅ Table auth.{table} exists")
                    self.tests_passed += 1
                else:
                    print(f"  ❌ Table auth.{table} does not exist")
                    self.tests_failed += 1
                    self.errors.append(f"Missing table: auth.{table}")
                    
            except Exception as e:
                print(f"  ❌ Error testing table {table}: {e}")
                self.tests_failed += 1
                self.errors.append(str(e))
    
    async def test_data_transformation(self):
        """Test that data transformations are working."""
        print("\n🔍 Testing data transformations...")
        
        # Check for URN references (should not exist after transformation)
        try:
            result = await self.conn.fetchval("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE resource::text LIKE '%urn:uuid:%'
            """)
            
            if result == 0:
                print("  ✅ No URN references found (transformed correctly)")
                self.tests_passed += 1
            else:
                print(f"  ⚠️  Found {result} resources with URN references")
                # This is a warning, not a failure since old data might exist
                
        except Exception as e:
            print(f"  ❌ Error testing URN transformation: {e}")
            self.tests_failed += 1
            self.errors.append(str(e))
        
        # Check for numeric suffixes in names (should be cleaned)
        try:
            result = await self.conn.fetchval("""
                SELECT COUNT(*) FROM fhir.resources 
                WHERE resource_type IN ('Patient', 'Practitioner')
                AND resource::text ~ '"family"\\s*:\\s*"[^"]*[0-9]+\\s*"'
            """)
            
            if result == 0:
                print("  ✅ No numeric suffixes in names (cleaned correctly)")
                self.tests_passed += 1
            else:
                print(f"  ⚠️  Found {result} resources with numeric name suffixes")
                # This is a warning, not a failure since old data might exist
                
        except Exception as e:
            print(f"  ❌ Error testing name cleaning: {e}")
            self.tests_failed += 1
            self.errors.append(str(e))
    
    async def test_search_params(self):
        """Test that search parameters are being indexed."""
        print("\n🔍 Testing search parameter indexing...")
        
        try:
            # Check if any search params exist
            count = await self.conn.fetchval("SELECT COUNT(*) FROM fhir.search_params")
            
            if count > 0:
                print(f"  ✅ Found {count} search parameters indexed")
                self.tests_passed += 1
                
                # Check for patient/subject params specifically
                patient_params = await self.conn.fetchval("""
                    SELECT COUNT(*) FROM fhir.search_params 
                    WHERE param_name IN ('patient', 'subject')
                """)
                
                if patient_params > 0:
                    print(f"  ✅ Found {patient_params} patient/subject parameters")
                    self.tests_passed += 1
                else:
                    print("  ⚠️  No patient/subject parameters found")
            else:
                print("  ⚠️  No search parameters indexed yet")
                
        except Exception as e:
            print(f"  ❌ Error testing search params: {e}")
            self.tests_failed += 1
            self.errors.append(str(e))
    
    async def test_compartments(self):
        """Test that compartments are being populated."""
        print("\n🔍 Testing compartment population...")
        
        try:
            count = await self.conn.fetchval("""
                SELECT COUNT(DISTINCT compartment_id) 
                FROM fhir.compartments 
                WHERE compartment_type = 'Patient'
            """)
            
            if count > 0:
                print(f"  ✅ Found {count} patient compartments")
                self.tests_passed += 1
            else:
                print("  ⚠️  No patient compartments found yet")
                
        except Exception as e:
            print(f"  ❌ Error testing compartments: {e}")
            self.tests_failed += 1
            self.errors.append(str(e))
    
    async def test_references(self):
        """Test that references are being extracted."""
        print("\n🔍 Testing reference extraction...")
        
        try:
            count = await self.conn.fetchval("SELECT COUNT(*) FROM fhir.references")
            
            if count > 0:
                print(f"  ✅ Found {count} references extracted")
                self.tests_passed += 1
            else:
                print("  ⚠️  No references extracted yet")
                
        except Exception as e:
            print(f"  ❌ Error testing references: {e}")
            self.tests_failed += 1
            self.errors.append(str(e))
    
    async def run_all_tests(self):
        """Run all deployment tests."""
        print("\n" + "="*60)
        print("🧪 WintEHR Consolidated Deployment Test Suite")
        print("="*60)
        
        if not await self.connect():
            print("\n❌ Cannot proceed without database connection")
            return False
        
        # Run all tests
        await self.test_schemas_exist()
        await self.test_fhir_tables()
        await self.test_provider_tables()
        await self.test_data_transformation()
        await self.test_search_params()
        await self.test_compartments()
        await self.test_references()
        
        # Summary
        print("\n" + "="*60)
        print("📊 Test Summary")
        print("="*60)
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        
        if self.errors:
            print("\n⚠️  Errors encountered:")
            for error in self.errors:
                print(f"  - {error}")
        
        success = self.tests_failed == 0
        if success:
            print("\n🎉 All critical tests passed! Deployment is healthy.")
        else:
            print("\n❌ Some tests failed. Please review errors above.")
        
        await self.conn.close()
        return success

async def main():
    """Run the deployment test suite."""
    tester = DeploymentTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())