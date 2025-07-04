#!/usr/bin/env python3
"""Test the notification system."""

import requests
import json

# Configuration
API_BASE = "http://localhost:8000"
TOKEN = None  # Will be set after login

def login():
    """Login to get authentication token."""
    global TOKEN
    
    # Login as Dr. Sarah Smith
    response = requests.post(f"{API_BASE}/api/auth/login", json={
        "username": "dr-smith",
        "password": "demo123"
    })
    
    if response.status_code == 200:
        data = response.json()
        TOKEN = data.get("access_token")
        print(f"✓ Logged in successfully as {data.get('user', {}).get('display_name')}")
        return True
    else:
        print(f"✗ Login failed: {response.status_code}")
        return False

def get_notification_count():
    """Get the count of unread notifications."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    response = requests.get(f"{API_BASE}/fhir/R4/notifications/count", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        count = data.get("count", 0)
        print(f"✓ Unread notifications: {count}")
        return count
    else:
        print(f"✗ Failed to get notification count: {response.status_code}")
        print(f"  Response: {response.text}")
        return None

def get_notifications():
    """Get list of notifications."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    response = requests.get(f"{API_BASE}/fhir/R4/notifications", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        total = data.get("total", 0)
        notifications = data.get("notifications", [])
        print(f"✓ Total notifications: {total}")
        
        # Show first few notifications
        for i, notif in enumerate(notifications[:3]):
            subject = notif.get("note", [{}])[0].get("text", "No subject")
            message = notif.get("payload", [{}])[0].get("contentString", "No message")
            priority = notif.get("priority", "routine")
            is_read = any(
                ext.get("valueBoolean", False) 
                for ext in notif.get("extension", [])
                if ext.get("url") == "http://medgenemr.com/fhir/StructureDefinition/notification-read"
            )
            
            print(f"\n  Notification {i+1}:")
            print(f"    Subject: {subject}")
            print(f"    Message: {message[:100]}...")
            print(f"    Priority: {priority}")
            print(f"    Read: {'Yes' if is_read else 'No'}")
        
        return notifications
    else:
        print(f"✗ Failed to get notifications: {response.status_code}")
        print(f"  Response: {response.text}")
        return []

def create_test_notification():
    """Create a test notification."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    notification_data = {
        "recipient_id": "dr-smith",  # Send to ourselves
        "subject": "Test Notification",
        "message": "This is a test notification created via the API.",
        "priority": "routine",
        "category": "notification"
    }
    
    response = requests.post(
        f"{API_BASE}/fhir/R4/notifications", 
        headers=headers,
        json=notification_data
    )
    
    if response.status_code == 200:
        print("✓ Test notification created successfully")
        return True
    else:
        print(f"✗ Failed to create notification: {response.status_code}")
        print(f"  Response: {response.text}")
        return False

def mark_notification_as_read(notification_id):
    """Mark a notification as read."""
    headers = {"Authorization": f"Bearer {TOKEN}"}
    response = requests.put(
        f"{API_BASE}/fhir/R4/notifications/{notification_id}/read",
        headers=headers
    )
    
    if response.status_code == 200:
        print(f"✓ Marked notification {notification_id} as read")
        return True
    else:
        print(f"✗ Failed to mark notification as read: {response.status_code}")
        return False

def main():
    """Run notification system tests."""
    print("Testing Notification System")
    print("=" * 50)
    
    # Step 1: Login
    if not login():
        return
    
    print("\n" + "=" * 50)
    
    # Step 2: Get initial notification count
    print("\nChecking initial notification count...")
    initial_count = get_notification_count()
    
    # Step 3: Get notifications list
    print("\nFetching notifications...")
    notifications = get_notifications()
    
    # Step 4: Create a test notification
    print("\nCreating test notification...")
    if create_test_notification():
        # Check count again
        print("\nChecking notification count after creation...")
        new_count = get_notification_count()
        
        if new_count is not None and initial_count is not None:
            if new_count > initial_count:
                print(f"✓ Notification count increased from {initial_count} to {new_count}")
            else:
                print(f"✗ Notification count did not increase (still {new_count})")
    
    # Step 5: Mark a notification as read
    if notifications:
        # Find an unread notification
        unread_notif = None
        for notif in notifications:
            is_read = any(
                ext.get("valueBoolean", False) 
                for ext in notif.get("extension", [])
                if ext.get("url") == "http://medgenemr.com/fhir/StructureDefinition/notification-read"
            )
            if not is_read:
                unread_notif = notif
                break
        
        if unread_notif:
            notif_id = unread_notif.get("id") or unread_notif.get("_id")
            if notif_id:
                print(f"\nMarking notification as read...")
                mark_notification_as_read(notif_id)
                
                # Check count after marking as read
                print("\nChecking notification count after marking as read...")
                final_count = get_notification_count()
                print(f"✓ Final unread count: {final_count}")

if __name__ == "__main__":
    main()