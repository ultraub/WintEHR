"""
Authentication configuration
"""

import os
from datetime import timedelta

# JWT Configuration
JWT_ENABLED = os.getenv("JWT_ENABLED", "false").lower() == "true"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "training-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default
JWT_ACCESS_TOKEN_EXPIRE_DELTA = timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
JWT_REFRESH_TOKEN_EXPIRE_DELTA = timedelta(days=7)  # 7 days

# Use secure database authentication (automatically enabled in production)
USE_SECURE_AUTH = os.getenv("USE_SECURE_AUTH", "false").lower() == "true" or JWT_ENABLED

# Training mode users
# ✅ Updated to use FHIR Practitioner IDs (matches Practitioner resources in HAPI FHIR)
# These IDs correspond to Practitioner resources created by create_demo_practitioners.py
TRAINING_USERS = {
    "demo": {
        "id": "demo-physician",  # ✅ Matches Practitioner/demo-physician in HAPI FHIR
        "username": "demo",
        "name": "Dr. Demo Physician",
        "email": "demo@wintehr.example.com",
        "role": "physician",
        "permissions": ["read", "write", "prescribe", "order:medication", "order:lab", "order:imaging", "admin"],
        "department": "General Practice"
    },
    "nurse": {
        "id": "demo-nurse",  # ✅ Matches Practitioner/demo-nurse in HAPI FHIR
        "username": "nurse",
        "name": "RN Demo Nurse",
        "email": "nurse@wintehr.example.com",
        "role": "nurse",
        "permissions": ["read", "write", "order:lab"],
        "department": "Medical-Surgical Nursing"
    },
    "pharmacist": {
        "id": "demo-pharmacist",  # ✅ Matches Practitioner/demo-pharmacist in HAPI FHIR
        "username": "pharmacist",
        "name": "PharmD Demo Pharmacist",
        "email": "pharmacist@wintehr.example.com",
        "role": "pharmacist",
        "permissions": ["read", "write", "pharmacy:dispense", "pharmacy:review"],
        "department": "Clinical Pharmacy"
    },
    "admin": {
        "id": "demo-admin",  # ✅ Matches Practitioner/demo-admin in HAPI FHIR
        "username": "admin",
        "name": "Dr. Demo Administrator",
        "email": "admin@wintehr.example.com",
        "role": "admin",
        "permissions": ["read", "write", "admin", "system", "prescribe", "order:medication", "order:lab", "order:imaging"],
        "department": "Hospital Administration"
    }
}

# Training mode password (same for all users)
TRAINING_PASSWORD = "password"