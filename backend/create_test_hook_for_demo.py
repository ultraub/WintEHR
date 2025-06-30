#!/usr/bin/env python3
"""Create a test CDS hook that will fire for demo purposes"""

import requests
import json

BASE_URL = "http://localhost:8000"

def create_test_hook():
    """Create a simple test hook that fires for all patients"""
    hook_id = "demo-patient-alert"
    
    # First try to delete if it exists
    delete_response = requests.delete(f"{BASE_URL}/cds-hooks/hooks/{hook_id}")
    
    test_hook = {
        "id": "demo-patient-alert",
        "title": "Demo Patient Alert",
        "description": "A simple test hook to demonstrate CDS integration",
        "hook": "patient-view",
        "priority": 1,
        "enabled": True,
        "conditions": [
            {
                "id": "1",
                "type": "patient-age",
                "parameters": {
                    "operator": "gt",
                    "value": "0"  # Fires for all patients
                }
            }
        ],
        "actions": [
            {
                "id": "1",
                "type": "info-card",
                "parameters": {
                    "summary": "CDS Hooks Integration Active",
                    "detail": "This is a demo alert showing that CDS Hooks are working! This alert fires whenever you open a patient chart.",
                    "indicator": "info",
                    "source": "Demo CDS Service"
                }
            }
        ]
    }
    
    response = requests.post(
        f"{BASE_URL}/cds-hooks/hooks",
        json=test_hook
    )
    
    if response.status_code == 200:
        print("✅ Test hook created successfully!")
        print(f"Hook ID: {test_hook['id']}")
        print("\nTo see it in action:")
        print("1. Open the EMR in your browser")
        print("2. Navigate to any patient's Clinical Workspace")
        print("3. You should see the blue info alert at the top")
    else:
        print(f"❌ Error creating hook: {response.status_code}")
        print(response.text)

def create_medication_alert_hook():
    """Create a hook that fires when prescribing medications"""
    hook_id = "demo-medication-alert"
    
    # First try to delete if it exists
    delete_response = requests.delete(f"{BASE_URL}/cds-hooks/hooks/{hook_id}")
    
    med_hook = {
        "id": "demo-medication-alert",
        "title": "Medication Prescribing Alert",
        "description": "Alerts when prescribing any medication",
        "hook": "medication-prescribe",
        "priority": 1,
        "enabled": True,
        "conditions": [],  # No conditions - fires for all medications
        "actions": [
            {
                "id": "1",
                "type": "warning-card",
                "parameters": {
                    "summary": "Medication Safety Check",
                    "detail": "Remember to check for drug interactions and patient allergies before prescribing.",
                    "indicator": "warning",
                    "source": "Medication Safety System"
                }
            }
        ]
    }
    
    response = requests.post(
        f"{BASE_URL}/cds-hooks/hooks",
        json=med_hook
    )
    
    if response.status_code == 200:
        print("\n✅ Medication alert hook created successfully!")
        print(f"Hook ID: {med_hook['id']}")
    else:
        print(f"\n❌ Error creating medication hook: {response.status_code}")

if __name__ == "__main__":
    print("Creating Demo CDS Hooks")
    print("======================\n")
    
    create_test_hook()
    create_medication_alert_hook()
    
    print("\n\nAll hooks created! You can now:")
    print("1. Open a patient chart to see the patient-view alert")
    print("2. Try to create a medication order to see the medication-prescribe alert")
    print("3. Use the CDS Hooks Builder UI to create more complex rules")