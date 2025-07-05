#!/usr/bin/env python3
"""
Optimize FHIR database indexes for better API performance.
This script adds additional indexes based on common query patterns.
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

async def optimize_indexes():
    """Add optimized indexes for FHIR database."""
    print("🚀 Optimizing FHIR Database Indexes")
    print("=" * 60)
    
    database_url = os.getenv('DATABASE_URL', 'postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db')
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # 1. Composite index for resource type and deletion status
        print("\n📊 Creating composite indexes...")
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_resource_type_deleted 
            ON fhir.resources(resource_type, deleted)
            WHERE deleted = FALSE
        """))
        print("✅ Created index: idx_resource_type_deleted")
        
        # 2. Patient reference index for common patient queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_patient_reference 
            ON fhir.resources((resource->'subject'->>'reference'))
            WHERE resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Procedure')
        """))
        print("✅ Created index: idx_patient_reference")
        
        # 3. Encounter reference index
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_encounter_reference 
            ON fhir.resources((resource->'encounter'->>'reference'))
            WHERE resource_type IN ('Observation', 'Condition', 'MedicationRequest', 'Procedure', 'DocumentReference')
        """))
        print("✅ Created index: idx_encounter_reference")
        
        # 4. Date-based indexes for time-series queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_observation_date 
            ON fhir.resources((resource->'effectiveDateTime'))
            WHERE resource_type = 'Observation' AND deleted = FALSE
        """))
        print("✅ Created index: idx_observation_date")
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_encounter_period 
            ON fhir.resources((resource->'period'->>'start'))
            WHERE resource_type = 'Encounter' AND deleted = FALSE
        """))
        print("✅ Created index: idx_encounter_period")
        
        # 5. Code-based indexes for clinical queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_observation_code 
            ON fhir.resources((resource->'code'->'coding'->0->>'code'))
            WHERE resource_type = 'Observation' AND deleted = FALSE
        """))
        print("✅ Created index: idx_observation_code")
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_observation_category 
            ON fhir.resources((resource->'category'->0->'coding'->0->>'code'))
            WHERE resource_type = 'Observation' AND deleted = FALSE
        """))
        print("✅ Created index: idx_observation_category")
        
        # 6. Status indexes for workflow queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_medication_status 
            ON fhir.resources((resource->>'status'))
            WHERE resource_type = 'MedicationRequest' AND deleted = FALSE
        """))
        print("✅ Created index: idx_medication_status")
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_task_status 
            ON fhir.resources((resource->>'status'))
            WHERE resource_type = 'Task' AND deleted = FALSE
        """))
        print("✅ Created index: idx_task_status")
        
        # 7. Practitioner reference index for provider queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_practitioner_reference 
            ON fhir.resources((resource->'requester'->>'reference'))
            WHERE resource_type IN ('MedicationRequest', 'ServiceRequest', 'Task')
        """))
        print("✅ Created index: idx_practitioner_reference")
        
        # 8. Appointment participant index
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_appointment_participant 
            ON fhir.resources USING GIN ((resource->'participant'))
            WHERE resource_type = 'Appointment' AND deleted = FALSE
        """))
        print("✅ Created index: idx_appointment_participant")
        
        # 9. Communication recipient index for inbox queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_communication_recipient 
            ON fhir.resources USING GIN ((resource->'recipient'))
            WHERE resource_type = 'Communication' AND deleted = FALSE
        """))
        print("✅ Created index: idx_communication_recipient")
        
        # 10. Composite index for search parameters
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_search_params_composite 
            ON fhir.search_parameters(resource_type, parameter_name)
            INCLUDE (parameter_value)
        """))
        print("✅ Created index: idx_search_params_composite")
        
        # Analyze tables to update statistics
        print("\n📊 Analyzing tables to update statistics...")
        await conn.execute(text("ANALYZE fhir.resources"))
        await conn.execute(text("ANALYZE fhir.search_parameters"))
        await conn.execute(text("ANALYZE fhir.resource_history"))
        print("✅ Table statistics updated")
        
        # Show index sizes
        print("\n📏 Index sizes:")
        result = await conn.execute(text("""
            SELECT 
                schemaname,
                indexname,
                pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as size
            FROM pg_indexes 
            WHERE schemaname = 'fhir'
            ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC
        """))
        
        for row in result:
            print(f"  - {row.indexname}: {row.size}")
    
    await engine.dispose()
    print("\n✅ Database optimization completed successfully!")
    
    print("\n💡 Performance tips:")
    print("  - Run VACUUM ANALYZE periodically to maintain performance")
    print("  - Monitor slow queries with pg_stat_statements")
    print("  - Consider partitioning large tables by date if needed")
    print("  - Use connection pooling for better concurrency")

if __name__ == "__main__":
    asyncio.run(optimize_indexes())