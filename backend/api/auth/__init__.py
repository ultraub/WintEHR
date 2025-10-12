"""
Unified Authentication Module

Provides both simple training authentication and production JWT authentication
based on environment configuration.
"""

from .router import router
from .service import AuthService, get_current_user
from .models import User, LoginRequest, TokenResponse

__all__ = [
    "router",
    "AuthService", 
    "get_current_user",
    "User",
    "LoginRequest",
    "TokenResponse"
]