#!/usr/bin/env python3
"""
WintEHR Deployment Validation Script

This script validates that the WintEHR deployment is working correctly,
including database schema, FHIR API endpoints, and core functionality.

Usage:
    python scripts/validate_deployment.py [--docker] [--verbose]
    
Arguments:
    --docker    Use docker connection settings (default: local)
    --verbose   Show detailed validation output
"""

import asyncio
import argparse
import asyncpg
import aiohttp
import json
import sys
from datetime import datetime


class DeploymentValidator:
    """Validates WintEHR deployment components."""
    
    def __init__(self, use_docker=False, verbose=False):
        self.use_docker = use_docker
        self.verbose = verbose
        
        if use_docker:
            self.db_url = 'postgresql://emr_user:emr_password@postgres:5432/emr_db'
            self.api_base = 'http://backend:8000'
        else:
            self.db_url = 'postgresql://emr_user:emr_password@localhost:5432/emr_db'
            self.api_base = 'http://localhost:8000'
    
    def log(self, message, level="INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        if level == "ERROR":
            print(f"❌ [{timestamp}] {message}")
        elif level == "SUCCESS":
            print(f"✅ [{timestamp}] {message}")
        elif level == "WARNING":
            print(f"⚠️  [{timestamp}] {message}")
        else:
            print(f"ℹ️  [{timestamp}] {message}")
    
    async def validate_database_schema(self):
        """Validate database schema and connectivity."""
        self.log("Validating database schema...")
        
        try:
            conn = await asyncpg.connect(self.db_url)
            
            # Check schemas exist
            schemas = await conn.fetch("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name IN ('fhir', 'cds_hooks')
            """)
            schema_names = {row['schema_name'] for row in schemas}
            
            if 'fhir' not in schema_names:
                self.log("FHIR schema not found", "ERROR")
                return False
                
            # Check critical tables
            tables = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'fhir'
            """)
            table_names = {row['table_name'] for row in tables}
            
            required_tables = {
                'resources', 'search_params', 'resource_history', 'references', 'compartments', 'audit_logs'
            }
            
            missing_tables = required_tables - table_names
            if missing_tables:
                self.log(f"Missing critical tables: {missing_tables}", "ERROR")
                return False
            
            # Check resource_history table has required columns
            history_columns = await conn.fetch("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'fhir' AND table_name = 'resource_history'
            """)
            
            required_columns = {'resource_id', 'version_id', 'operation', 'resource'}
            actual_columns = {row['column_name'] for row in history_columns}
            
            missing_columns = required_columns - actual_columns
            if missing_columns:
                self.log(f"resource_history missing columns: {missing_columns}", "ERROR")
                return False
            
            # Test basic query
            resource_count = await conn.fetchval("""
                SELECT COUNT(*) FROM fhir.resources WHERE deleted = false OR deleted IS NULL
            """)
            
            await conn.close()
            
            self.log(f"Database schema validated ({resource_count} resources)", "SUCCESS")
            if self.verbose:
                self.log(f"Available tables: {sorted(table_names)}")
                
            return True
            
        except Exception as e:
            self.log(f"Database validation failed: {e}", "ERROR")
            return False
    
    async def validate_fhir_api(self):
        """Validate FHIR API endpoints."""
        self.log("Validating FHIR API endpoints...")
        
        try:
            async with aiohttp.ClientSession() as session:
                # Test health endpoint
                async with session.get(f"{self.api_base}/health") as resp:
                    if resp.status != 200:
                        self.log(f"Health endpoint failed: {resp.status}", "ERROR")
                        return False
                    
                    health_data = await resp.json()
                    if health_data.get('status') != 'healthy':
                        self.log(f"Backend not healthy: {health_data}", "ERROR")
                        return False
                
                # Test FHIR metadata endpoint
                async with session.get(f"{self.api_base}/fhir/R4/metadata") as resp:
                    if resp.status != 200:
                        self.log(f"FHIR metadata failed: {resp.status}", "ERROR")
                        return False
                        
                    metadata = await resp.json()
                    if metadata.get('resourceType') != 'CapabilityStatement':
                        self.log("FHIR metadata invalid", "ERROR")
                        return False
                
                # Test patient search
                async with session.get(f"{self.api_base}/fhir/R4/Patient?_count=1") as resp:
                    if resp.status != 200:
                        self.log(f"Patient search failed: {resp.status}", "ERROR")
                        return False
                        
                    bundle = await resp.json()
                    if bundle.get('resourceType') != 'Bundle':
                        self.log("Patient search returned invalid bundle", "ERROR")
                        return False
                
                # Test patient creation (if no patients exist)
                patient_count = bundle.get('total', 0)
                if patient_count == 0:
                    test_patient = {
                        "resourceType": "Patient",
                        "identifier": [{"system": "test", "value": "validation-test"}],
                        "name": [{"family": "ValidationTest", "given": ["Test"]}],
                        "gender": "unknown"
                    }
                    
                    async with session.post(
                        f"{self.api_base}/fhir/R4/Patient",
                        json=test_patient,
                        headers={"Content-Type": "application/json"}
                    ) as resp:
                        if resp.status not in [200, 201]:
                            self.log(f"Patient creation test failed: {resp.status}", "ERROR")
                            response_text = await resp.text()
                            if self.verbose:
                                self.log(f"Response: {response_text}")
                            return False
                        
                        created_patient = await resp.json()
                        if created_patient.get('resourceType') != 'Patient':
                            self.log("Patient creation returned invalid resource", "ERROR")
                            return False
                        
                        self.log("Patient creation test successful", "SUCCESS")
                
            self.log("FHIR API validation successful", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"FHIR API validation failed: {e}", "ERROR")
            return False
    
    async def validate_search_functionality(self):
        """Validate search parameter functionality."""
        self.log("Validating search functionality...")
        
        try:
            # Connect to database to check search parameters
            conn = await asyncpg.connect(self.db_url)
            
            search_param_count = await conn.fetchval("""
                SELECT COUNT(*) FROM fhir.search_params
            """)
            
            if search_param_count == 0:
                self.log("No search parameters found - running initialization", "WARNING")
                
                # Try to run search parameter initialization
                try:
                    await conn.execute("""
                        INSERT INTO fhir.search_params (resource_id, resource_type, param_name, param_type)
                        SELECT 
                            r.id, 
                            r.resource_type, 
                            '_id', 
                            'token'
                        FROM fhir.resources r
                        WHERE NOT EXISTS (
                            SELECT 1 FROM fhir.search_params sp 
                            WHERE sp.resource_id = r.id AND sp.param_name = '_id'
                        )
                    """)
                    
                    search_param_count = await conn.fetchval("""
                        SELECT COUNT(*) FROM fhir.search_params
                    """)
                    
                    self.log(f"Added {search_param_count} basic search parameters")
                    
                except Exception as e:
                    self.log(f"Failed to initialize search parameters: {e}", "ERROR")
                    await conn.close()
                    return False
            
            await conn.close()
            
            # Test API search functionality
            async with aiohttp.ClientSession() as session:
                # Test patient search with various parameters
                test_searches = [
                    f"{self.api_base}/fhir/R4/Patient?_count=5",
                    f"{self.api_base}/fhir/R4/Observation?_count=5",
                    f"{self.api_base}/fhir/R4/Condition?_count=5"
                ]
                
                for search_url in test_searches:
                    async with session.get(search_url) as resp:
                        if resp.status != 200:
                            self.log(f"Search test failed for {search_url}: {resp.status}", "ERROR")
                            return False
                        
                        bundle = await resp.json()
                        if bundle.get('resourceType') != 'Bundle':
                            self.log(f"Search returned invalid bundle for {search_url}", "ERROR")
                            return False
            
            self.log("Search functionality validated", "SUCCESS")
            return True
            
        except Exception as e:
            self.log(f"Search validation failed: {e}", "ERROR")
            return False
    
    async def run_validation(self):
        """Run complete validation suite."""
        self.log("Starting WintEHR deployment validation...")
        
        validations = [
            ("Database Schema", self.validate_database_schema()),
            ("FHIR API", self.validate_fhir_api()),
            ("Search Functionality", self.validate_search_functionality())
        ]
        
        results = {}
        
        for name, validation_coro in validations:
            self.log(f"Running {name} validation...")
            try:
                result = await validation_coro
                results[name] = result
                
                if result:
                    self.log(f"{name} validation passed", "SUCCESS")
                else:
                    self.log(f"{name} validation failed", "ERROR")
                    
            except Exception as e:
                self.log(f"{name} validation error: {e}", "ERROR")
                results[name] = False
        
        # Summary
        self.log("=" * 60)
        passed = sum(results.values())
        total = len(results)
        
        if passed == total:
            self.log(f"🎉 All validations passed ({passed}/{total})", "SUCCESS")
            self.log("WintEHR deployment is ready for use!", "SUCCESS")
            return True
        else:
            self.log(f"❌ {total - passed} validation(s) failed ({passed}/{total})", "ERROR")
            self.log("Please check the errors above and fix before using", "ERROR")
            return False


async def main():
    parser = argparse.ArgumentParser(description="Validate WintEHR deployment")
    parser.add_argument("--docker", action="store_true", help="Use docker connection settings")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    
    args = parser.parse_args()
    
    validator = DeploymentValidator(use_docker=args.docker, verbose=args.verbose)
    success = await validator.run_validation()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())