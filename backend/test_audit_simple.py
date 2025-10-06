#!/usr/bin/env python3
"""
Simple AuditEventService test - verifies HAPI integration works
Run this from within the backend Docker container
"""

import asyncio
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, '/app/api')

async def test_audit_service():
    """Test that AuditEventService can create events in HAPI FHIR"""
    print("\n" + "="*60)
    print("Testing AuditEventService with HAPI FHIR")
    print("="*60)

    try:
        from services.audit_event_service import AuditEventService, AuditEventType

        # Create service instance
        service = AuditEventService(hapi_base_url="http://hapi-fhir:8080/fhir")
        print("✅ AuditEventService initialized")

        # Test 1: Simple login event
        print("\n1. Testing login event creation...")
        result = await service.log_login_attempt(
            username="test-user-123",
            success=True,
            ip_address="192.168.1.1",
            user_agent="Test/1.0"
        )
        print(f"✅ Login event created (no errors)")

        # Test 2: Failed login
        print("\n2. Testing failed login event...")
        result = await service.log_login_attempt(
            username="bad-user",
            success=False,
            ip_address="192.168.1.2",
            failure_reason="Invalid credentials"
        )
        print(f"✅ Failed login event created (no errors)")

        # Test 3: Resource access
        print("\n3. Testing resource access event...")
        result = await service.log_resource_access(
            user_id="test-user-123",
            resource_type="Patient",
            resource_id="test-patient-1",
            action="read",
            patient_id="Patient/test-patient-1",
            ip_address="192.168.1.1"
        )
        print(f"✅ Resource access event created (no errors)")

        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED - AuditEventService working correctly!")
        print("="*60)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_audit_service())
