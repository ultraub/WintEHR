"""
Unified Authentication Router

Combines all authentication endpoints into a single router.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List

from database import get_db_session
from .service import AuthService, enabled_usernames, get_auth_service, get_current_user, user_record_live
from .practitioner_auth_service import PractitionerAuthService, get_practitioner_auth_service
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
        # In training mode, show the logins that exist and are enabled (built-in plus
        # the Command Center's custom users), with display names for the picker.
        config.available_users = await enabled_usernames()
        config.users = []
        for username in config.available_users:
            record = await user_record_live(username)
            if record:
                config.users.append({"username": username, "name": record["name"], "role": record["role"]})

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
    if not JWT_ENABLED:
        # Drop every training session this user holds, on every worker.
        await auth_service.training_sessions.delete_where(
            lambda session: session.get("user", {}).get("id") == current_user.id
        )
    
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
    
    users = []
    for username in await enabled_usernames():
        record = await user_record_live(username)
        if record:
            users.append(User(**{k: v for k, v in record.items() if k != "disabled"}))
    return users


# Health check endpoint
@router.get("/health")
async def auth_health_check():
    """Check authentication service health"""
    return {
        "status": "healthy",
        "mode": "production" if JWT_ENABLED else "training",
        "jwt_enabled": JWT_ENABLED
    }


# ========================================
# Practitioner-based Authentication
# ========================================

@router.get("/practitioners")
async def list_practitioners(
    practitioner_service: PractitionerAuthService = Depends(get_practitioner_auth_service)
):
    """
    List all active Practitioners for login selection.

    Returns simplified practitioner info including:
    - ID
    - Full name
    - Family name (for login)
    - NPI
    - Email
    """
    practitioners = await practitioner_service.list_all_practitioners()
    return {
        "practitioners": practitioners,
        "total": len(practitioners),
        "login_instructions": "Use family name, NPI, or ID to log in"
    }


@router.post("/practitioners/login")
async def practitioner_login(
    login_request: LoginRequest,
    request: Request,
    practitioner_service: PractitionerAuthService = Depends(get_practitioner_auth_service)
):
    """
    Login as a Practitioner using family name, NPI, or Practitioner ID.

    Examples:
    - username: "Reilly981" (family name)
    - username: "9999984591" (NPI)
    - username: "78" (Practitioner ID)

    Password is optional in development mode.

    Returns authentication token and user information.
    """
    return await practitioner_service.login(
        identifier=login_request.username,
        password=login_request.password,
        request=request
    )