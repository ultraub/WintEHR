"""
Unified Authentication Router

Combines all authentication endpoints into a single router.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List

from database import get_db_session
from .service import AuthService, get_auth_service, get_current_user
from .models import LoginRequest, User, AuthConfig
from .config import JWT_ENABLED, TRAINING_USERS

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/config", response_model=AuthConfig)
async def get_auth_config():
    """Get authentication configuration"""
    config = AuthConfig(
        mode="production" if JWT_ENABLED else "training",
        jwt_enabled=JWT_ENABLED
    )
    
    if not JWT_ENABLED:
        # In training mode, show available users
        config.available_users = list(TRAINING_USERS.keys())
    
    return config


@router.post("/login")
async def login(
    login_request: LoginRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Authenticate user and return token/session.
    
    In training mode:
    - Use any username from: demo, nurse, pharmacist, admin
    - Password is always: password
    
    In production mode:
    - Use registered credentials
    - Returns JWT token
    """
    return await auth_service.login(login_request.username, login_request.password, request)


@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information"""
    return current_user


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Logout current user.
    
    In training mode: Invalidates session
    In production mode: Client should discard JWT token
    """
    # In JWT mode, logout is handled client-side
    # In training mode, we could invalidate the session
    if not JWT_ENABLED and hasattr(auth_service, 'training_sessions'):
        # Remove session if exists
        for token, session in list(auth_service.training_sessions.items()):
            if session["user"]["id"] == current_user.id:
                del auth_service.training_sessions[token]
    
    return {"message": "Successfully logged out"}


@router.get("/users", response_model=List[User])
async def list_available_users(
    current_user: User = Depends(get_current_user)
):
    """
    List available users (admin only).
    
    In training mode: Returns all demo users
    In production mode: Returns registered users
    """
    if "admin" not in current_user.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    if not JWT_ENABLED:
        # Return training users
        return [User(**user_data) for user_data in TRAINING_USERS.values()]
    else:
        # TODO: In production, query from database
        # For now, return training users
        return [User(**user_data) for user_data in TRAINING_USERS.values()]


# Health check endpoint
@router.get("/health")
async def auth_health_check():
    """Check authentication service health"""
    return {
        "status": "healthy",
        "mode": "production" if JWT_ENABLED else "training",
        "jwt_enabled": JWT_ENABLED
    }