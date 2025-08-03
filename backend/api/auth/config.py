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
TRAINING_USERS = {
    "demo": {
        "id": "demo-user-001",
        "username": "demo",
        "name": "Demo User",
        "email": "demo@wintehr.training",
        "role": "physician",
        "permissions": ["read", "write", "admin"],
        "department": "Internal Medicine"
    },
    "nurse": {
        "id": "nurse-user-001", 
        "username": "nurse",
        "name": "Nurse User",
        "email": "nurse@wintehr.training",
        "role": "nurse",
        "permissions": ["read", "write"],
        "department": "Nursing"
    },
    "pharmacist": {
        "id": "pharmacist-user-001",
        "username": "pharmacist", 
        "name": "Pharmacist User",
        "email": "pharmacist@wintehr.training",
        "role": "pharmacist",
        "permissions": ["read", "write", "department:pharmacy"],
        "department": "Pharmacy"
    },
    "admin": {
        "id": "admin-user-001",
        "username": "admin",
        "name": "System Admin",
        "email": "admin@wintehr.training", 
        "role": "admin",
        "permissions": ["read", "write", "admin", "system"],
        "department": "IT"
    }
}

# Training mode password (same for all users)
TRAINING_PASSWORD = "password"