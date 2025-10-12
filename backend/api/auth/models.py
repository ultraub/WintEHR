"""
Authentication data models
"""

from pydantic import BaseModel, EmailStr
from typing import Dict, Any, List, Optional
from datetime import datetime


class User(BaseModel):
    """User model for authentication"""
    id: str
    username: str
    name: str
    email: EmailStr
    role: str
    permissions: List[str]
    department: Optional[str] = None
    active: bool = True


class LoginRequest(BaseModel):
    """Login request model"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """JWT token response model"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class SimpleAuthResponse(BaseModel):
    """Simple auth response for training mode"""
    user: Dict[str, Any]
    session_token: str


class AuthConfig(BaseModel):
    """Authentication configuration response"""
    mode: str  # "training" or "production"
    jwt_enabled: bool
    available_users: Optional[List[str]] = None  # Only in training mode