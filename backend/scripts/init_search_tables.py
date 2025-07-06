#!/usr/bin/env python3
"""
Initialize FHIR search parameter tables
Creates the fhir.search_params table if it doesn't exist
"""

import asyncio
import asyncpg
import os

async def init_search_tables():
    """Initialize search parameter tables in the database."""
    
    # Database connection parameters
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME', 'emr_db'),
        'user': os.getenv('DB_USER', 'emr_user'),
        'password': os.getenv('DB_PASSWORD', 'emr_password')
    }
    
    print("Connecting to database...")
    conn = await asyncpg.connect(**db_config)
    
    try:
        # Create fhir schema if it doesn't exist
        print("Creating fhir schema if needed...")
        await conn.execute("CREATE SCHEMA IF NOT EXISTS fhir")
        
        # Check if search_params table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' 
                AND table_name = 'search_params'
            )
        """)
        
        if table_exists:
            print("✅ fhir.search_params table already exists")
            
            # Check record count
            count = await conn.fetchval("SELECT COUNT(*) FROM fhir.search_params")
            print(f"   Current search parameter records: {count}")
            
        else:
            print("❌ fhir.search_params table does not exist - creating it...")
            
            # Create search_params table
            await conn.execute("""
                CREATE TABLE fhir.search_params (
                    id SERIAL PRIMARY KEY,
                    resource_id UUID NOT NULL,
                    resource_type VARCHAR(50) NOT NULL,
                    param_name VARCHAR(100) NOT NULL,
                    param_type VARCHAR(20) NOT NULL,
                    value_string TEXT,
                    value_token VARCHAR(500),
                    value_reference VARCHAR(500),
                    value_date TIMESTAMP,
                    value_number NUMERIC,
                    value_quantity_value NUMERIC,
                    value_quantity_unit VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (resource_id) REFERENCES fhir.resources(id) ON DELETE CASCADE
                )
            """)
            
            print("✅ Created fhir.search_params table")
            
            # Create indexes for better search performance
            print("Creating indexes...")
            
            indexes = [
                ("idx_search_params_resource_id", "resource_id"),
                ("idx_search_params_param_name", "param_name"),
                ("idx_search_params_param_type", "param_type"),
                ("idx_search_params_value_string", "value_string"),
                ("idx_search_params_token_code", "value_token_code"),
                ("idx_search_params_patient", "param_name, value_string") 
            ]
            
            for index_name, columns in indexes:
                await conn.execute(f"""
                    CREATE INDEX IF NOT EXISTS {index_name} 
                    ON fhir.search_params ({columns})
                """)
                print(f"   ✅ Created index: {index_name}")
            
            # Create composite indexes for common search patterns
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_search_params_patient_lookup 
                ON fhir.search_params (param_name, value_string) 
                WHERE param_name IN ('patient', 'subject')
            """)
            print("   ✅ Created patient lookup index")
            
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_search_params_token_lookup 
                ON fhir.search_params (param_name, value_token_system, value_token_code) 
                WHERE param_type = 'token'
            """)
            print("   ✅ Created token lookup index")
        
        # Check if resources table exists (should exist)
        resources_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'fhir' 
                AND table_name = 'resources'
            )
        """)
        
        if resources_exists:
            print("✅ fhir.resources table exists")
            
            # Check if deleted column exists
            deleted_exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'fhir' 
                    AND table_name = 'resources' 
                    AND column_name = 'deleted'
                )
            """)
            
            if not deleted_exists:
                print("Adding deleted column to resources table...")
                await conn.execute("""
                    ALTER TABLE fhir.resources 
                    ADD COLUMN deleted BOOLEAN DEFAULT FALSE
                """)
                print("✅ Added deleted column")
            else:
                print("✅ Deleted column already exists")
            
            resource_count = await conn.fetchval("SELECT COUNT(*) FROM fhir.resources WHERE deleted = FALSE OR deleted IS NULL")
            print(f"   Total active resources: {resource_count}")
        else:
            print("❌ fhir.resources table does not exist!")
            return False
        
        print("\n🎯 Database initialization complete!")
        return True
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False
        
    finally:
        await conn.close()

async def main():
    """Main entry point."""
    print("=== FHIR Search Tables Initialization ===\n")
    
    success = await init_search_tables()
    
    if success:
        print("\n✅ All search tables are ready!")
        print("\nNext steps:")
        print("1. Restart the backend server")
        print("2. Test search functionality")
        print("3. Run: python test_search_params_table.py")
    else:
        print("\n❌ Database initialization failed!")
        print("Please check database connection and permissions.")

if __name__ == '__main__':
    asyncio.run(main())