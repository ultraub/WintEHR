#!/usr/bin/env python3
"""
Test minimal CarePlan
"""

from fhir.resources.careplan import CarePlan

# Test minimal CarePlan with addresses
careplan_data = {
    "resourceType": "CarePlan",
    "status": "active",
    "intent": "plan",
    "subject": {"reference": "Patient/123"},
    "addresses": [
        {"reference": "Condition/Diabetes"}
    ],
    "activity": [
        {
            "plannedActivityReference": {
                "reference": "ServiceRequest/409002",
                "display": "Food allergy diet"
            }
        }
    ]
}

try:
    cp = CarePlan(**careplan_data)
    print("✅ CarePlan created successfully!")
    print(f"Addresses: {cp.addresses}")
    print(f"Activity: {cp.activity}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()