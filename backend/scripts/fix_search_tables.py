#!/usr/bin/env python3
"""
Fix search tables using the existing SQLAlchemy session
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from core.fhir.storage import FHIRStorage
from core.database import get_database_url

async def check_and_create_search_table():
    """Check if search_params table exists and create if missing."""
    
    print("=== FHIR Search Table Fix ===\n")
    
    # Get database URL
    database_url = get_database_url()
    print(f"Connecting to database: {database_url.split('@')[1] if '@' in database_url else 'localhost'}")
    
    # Create engine and session
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check if search_params table exists
            print("1. Checking if fhir.search_params table exists...")
            
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'fhir' 
                    AND table_name = 'search_params'
                )
            """))
            table_exists = result.scalar()
            
            if table_exists:
                print("   ✅ fhir.search_params table exists")
                
                # Check record count
                count_result = await session.execute(text("SELECT COUNT(*) FROM fhir.search_params"))
                count = count_result.scalar()
                print(f"   Current records: {count}")
                
                if count == 0:
                    print("   ⚠️  Table exists but has no records - search indexing may be broken")
                
            else:
                print("   ❌ fhir.search_params table MISSING - creating it now...")
                
                # Create the table
                await session.execute(text("""
                    CREATE TABLE fhir.search_params (
                        id BIGSERIAL PRIMARY KEY,
                        resource_id BIGINT NOT NULL,
                        param_name VARCHAR(255) NOT NULL,
                        param_type VARCHAR(50) NOT NULL,
                        value_string TEXT,
                        value_number DECIMAL,
                        value_date TIMESTAMP WITH TIME ZONE,
                        value_token_system VARCHAR(255),
                        value_token_code VARCHAR(255),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        
                        CONSTRAINT fk_search_params_resource 
                            FOREIGN KEY (resource_id) 
                            REFERENCES fhir.resources(id) 
                            ON DELETE CASCADE
                    )
                """))
                
                print("   ✅ Created fhir.search_params table")
                
                # Create indexes
                indexes = [
                    "CREATE INDEX idx_search_params_resource_id ON fhir.search_params (resource_id)",
                    "CREATE INDEX idx_search_params_param_name ON fhir.search_params (param_name)",
                    "CREATE INDEX idx_search_params_value_string ON fhir.search_params (value_string)",
                    "CREATE INDEX idx_search_params_patient_lookup ON fhir.search_params (param_name, value_string) WHERE param_name IN ('patient', 'subject')",
                    "CREATE INDEX idx_search_params_token_lookup ON fhir.search_params (param_name, value_token_code) WHERE param_type = 'token'"
                ]
                
                for index_sql in indexes:
                    await session.execute(text(index_sql))
                
                print("   ✅ Created search parameter indexes")
                
                await session.commit()
                print("   ✅ Changes committed to database")
            
            # Check resources table
            print("\n2. Checking fhir.resources table...")
            resources_result = await session.execute(text("SELECT COUNT(*) FROM fhir.resources"))
            resources_count = resources_result.scalar()
            print(f"   Total resources: {resources_count}")
            
            # Show recent resources
            recent_result = await session.execute(text("""
                SELECT resource_type, COUNT(*) as count
                FROM fhir.resources 
                WHERE deleted = false
                GROUP BY resource_type
                ORDER BY count DESC
                LIMIT 10
            """))
            
            print("   Resource types:")
            for row in recent_result:
                print(f"     {row[0]}: {row[1]} resources")
                
        except Exception as e:
            print(f"❌ Error: {e}")
            await session.rollback()
            return False
    
    await engine.dispose()
    return True

async def test_search_indexing():
    """Test if search parameter indexing is now working."""
    
    print("\n3. Testing search parameter indexing...")
    
    # Create a FHIR storage instance to test indexing
    database_url = get_database_url()
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        storage = FHIRStorage(session)
        
        try:
            # Create a test condition
            test_condition = {
                "resourceType": "Condition",
                "clinicalStatus": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active"
                    }]
                },
                "code": {
                    "text": "TEST_SEARCH_INDEXING"
                },
                "subject": {
                    "reference": "Patient/92675303-ca5b-136a-169b-e764c5753f06"
                }
            }
            
            print("   Creating test condition...")
            result = await storage.create_resource("Condition", test_condition)
            test_id = result['id']
            print(f"   ✅ Created condition: {test_id}")
            
            # Check if search parameters were created
            count_result = await session.execute(text("""
                SELECT COUNT(*) FROM fhir.search_params sp
                JOIN fhir.resources r ON r.id = sp.resource_id
                WHERE r.fhir_id = :condition_id
            """), {"condition_id": test_id})
            
            param_count = count_result.scalar()
            print(f"   Search parameters created: {param_count}")
            
            if param_count > 0:
                # Show the parameters
                params_result = await session.execute(text("""
                    SELECT param_name, param_type, value_string, value_token_code
                    FROM fhir.search_params sp
                    JOIN fhir.resources r ON r.id = sp.resource_id
                    WHERE r.fhir_id = :condition_id
                    ORDER BY param_name
                """), {"condition_id": test_id})
                
                print("   Parameters created:")
                for row in params_result:
                    value = row[2] or row[3] or "(null)"
                    print(f"     {row[0]} ({row[1]}): {value}")
                
                print("   ✅ Search parameter indexing is working!")
                return True
            else:
                print("   ❌ No search parameters were created")
                return False
                
        except Exception as e:
            print(f"   ❌ Error testing indexing: {e}")
            return False
        finally:
            await session.rollback()  # Don't commit test data
    
    await engine.dispose()

async def main():
    """Main function."""
    
    success = await check_and_create_search_table()
    
    if success:
        indexing_works = await test_search_indexing()
        
        print(f"\n{'='*50}")
        if indexing_works:
            print("🎉 SUCCESS: Search tables fixed and indexing works!")
            print("\nNext steps:")
            print("1. Restart the backend server")
            print("2. Test condition creation in the UI")
            print("3. Verify new conditions appear in patient searches")
        else:
            print("⚠️  PARTIAL: Tables created but indexing may still have issues")
            print("\nDebugging needed:")
            print("1. Check server logs for search parameter extraction errors")
            print("2. Verify search parameter extraction code is being called")
            print("3. Test with debug logging enabled")
        print(f"{'='*50}")
    else:
        print("\n❌ FAILED: Could not create search tables")

if __name__ == '__main__':
    asyncio.run(main())