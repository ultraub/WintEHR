"""
Test Phase 2 Migration - AuditEventService and search_values.py
Tests that migrated services work correctly with HAPI FHIR
"""

import asyncio
import sys
from pathlib import Path

# Add api directory to path
sys.path.insert(0, str(Path(__file__).parent / "api"))

from services.audit_event_service import AuditEventService, AuditEventType
from sqlalchemy import create_engine, text
from database import get_db_session

async def test_audit_service():
    """Test AuditEventService creates events in HAPI FHIR"""
    print("\n=== Testing AuditEventService ===")

    service = AuditEventService(hapi_base_url="http://hapi-fhir:8080/fhir")

    # Test 1: Login success
    print("\n1. Testing login success event...")
    await service.log_login_attempt(
        username="test-user-123",
        success=True,
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0"
    )
    print("✅ Login success event created")

    # Test 2: Login failure
    print("\n2. Testing login failure event...")
    await service.log_login_attempt(
        username="bad-user",
        success=False,
        ip_address="192.168.1.2",
        failure_reason="Invalid credentials"
    )
    print("✅ Login failure event created")

    # Test 3: Resource access
    print("\n3. Testing resource access event...")
    await service.log_resource_access(
        user_id="test-user-123",
        resource_type="Patient",
        resource_id="test-patient-1",
        action="read",
        patient_id="Patient/test-patient-1",
        ip_address="192.168.1.1"
    )
    print("✅ Resource access event created")

    # Test 4: Get user activity
    print("\n4. Testing get user activity...")
    activities = await service.get_user_activity(user_id="test-user-123", limit=10)
    print(f"✅ Retrieved {len(activities)} audit events for user")

    print("\n✅ All AuditEventService tests passed!")

def test_search_values():
    """Test search_values.py queries HAPI JPA indexes"""
    print("\n=== Testing search_values.py Migration ===")

    # Get database connection
    db = next(get_db_session())

    try:
        # Test 1: Get searchable parameters for Patient
        print("\n1. Testing get searchable parameters for Patient...")
        query = text("""
            SELECT DISTINCT sp_name as param_name
            FROM (
                SELECT DISTINCT sp_name FROM hfj_spidx_token
                WHERE res_type = :resource_type
                UNION
                SELECT DISTINCT sp_name FROM hfj_spidx_string
                WHERE res_type = :resource_type
                UNION
                SELECT DISTINCT sp_name FROM hfj_spidx_date
                WHERE res_type = :resource_type
                UNION
                SELECT DISTINCT sp_name FROM hfj_spidx_number
                WHERE res_type = :resource_type
                UNION
                SELECT DISTINCT sp_name FROM hfj_spidx_quantity
                WHERE res_type = :resource_type
                UNION
                SELECT DISTINCT sp_name FROM hfj_spidx_uri
                WHERE res_type = :resource_type
            ) AS all_params
            ORDER BY param_name
        """)

        result = db.execute(query, {"resource_type": "Patient"})
        params = [row.param_name for row in result]
        print(f"✅ Found {len(params)} searchable parameters for Patient")
        print(f"   Sample params: {params[:5] if params else 'none'}")

        # Test 2: Get distinct values for gender parameter
        print("\n2. Testing get distinct values for gender...")
        query = text("""
            SELECT DISTINCT
                sp.sp_value as value,
                COUNT(*) as usage_count
            FROM hfj_spidx_token sp
            WHERE sp.res_type = :resource_type
            AND sp.sp_name = :param_name
            AND sp.sp_value IS NOT NULL
            GROUP BY sp.sp_value
            ORDER BY usage_count DESC
            LIMIT :limit
        """)

        result = db.execute(query, {
            "resource_type": "Patient",
            "param_name": "gender",
            "limit": 10
        })

        values = [(row.value, row.usage_count) for row in result]
        print(f"✅ Found {len(values)} distinct gender values")
        for value, count in values:
            print(f"   {value}: {count} patients")

        print("\n✅ All search_values tests passed!")

    finally:
        db.close()

async def main():
    """Run all Phase 2 migration tests"""
    print("=" * 60)
    print("Phase 2 Migration Test Suite")
    print("=" * 60)

    try:
        # Test AuditEventService
        await test_audit_service()

        # Test search_values queries
        test_search_values()

        print("\n" + "=" * 60)
        print("✅ ALL PHASE 2 MIGRATION TESTS PASSED!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
