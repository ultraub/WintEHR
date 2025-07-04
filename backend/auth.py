"""
Simple authentication module for API dependencies.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, str]:
    """
    Simple authentication dependency.
    In production, this would validate the JWT token.
    For now, returns a mock user.
    """
    # TODO: Implement proper JWT validation
    # For now, return a mock user for development
    return {
        "id": "practitioner-1",
        "username": "demo_provider",
        "name": "Demo Provider",
        "role": "provider"
    }

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, str]]:
    """
    Optional authentication dependency.
    Returns None if no credentials provided.
    """
    if not credentials:
        return None
    
    return await get_current_user(credentials)