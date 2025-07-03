"""
EMR Authentication and Session Management

Provides authentication beyond SMART on FHIR:
- Traditional username/password login
- Session management
- Role-based access control
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import json
import bcrypt
import jwt
import os

from database import get_db_session

router = APIRouter()

# Security
security = HTTPBearer(auto_error=False)


@router.get("/providers")
async def get_providers(db: AsyncSession = Depends(get_db_session)):
    """
    Get list of available providers for login.
    
    Returns practitioners with active user accounts.
    """
    # For now, return demo providers
    # In production, this would query the FHIR Practitioner resources
    demo_providers = [
        {
            "id": "dr-smith",
            "name": "Dr. Sarah Smith",
            "role": "Primary Care Physician",
            "department": "Internal Medicine"
        },
        {
            "id": "dr-jones", 
            "name": "Dr. Michael Jones",
            "role": "Cardiologist",
            "department": "Cardiology"
        },
        {
            "id": "nurse-wilson",
            "name": "Nancy Wilson, RN",
            "role": "Registered Nurse",
            "department": "Emergency"
        },
        {
            "id": "admin-user",
            "name": "System Administrator",
            "role": "Administrator",
            "department": "IT"
        }
    ]
    
    return {"providers": demo_providers}

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


class AuthService:
    """Handles authentication and authorization."""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify a password against its hash."""
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    @staticmethod
    def create_token(user_id: str, username: str, role: str) -> str:
        """Create a JWT token."""
        payload = {
            "sub": user_id,
            "username": username,
            "role": role,
            "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
            "iat": datetime.now(timezone.utc)
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """Decode and validate a JWT token."""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db_session)
) -> Optional[Dict[str, Any]]:
    """Get current user from JWT token."""
    if not credentials:
        return None
    
    # Decode token
    payload = AuthService.decode_token(credentials.credentials)
    
    # Get user from database
    query = text("""
        SELECT id, username, email, role, practitioner_id, preferences
        FROM emr.users
        WHERE id = :user_id AND is_active = true
    """)
    
    result = await db.execute(query, {"user_id": uuid.UUID(payload["sub"])})
    user = result.first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "practitionerId": user.practitioner_id,
        "preferences": user.preferences or {}
    }


async def require_auth(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Require authentication for an endpoint."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_role(required_role: str):
    """Require a specific role for an endpoint."""
    async def role_checker(user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
        if user["role"] != required_role and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


@router.post("/register")
async def register(
    registration_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session)
):
    """
    Register a new user.
    
    Links to FHIR Practitioner resource if practitionerId provided.
    """
    # Validate required fields
    required = ["username", "email", "password"]
    for field in required:
        if field not in registration_data:
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    # Check if user already exists
    check_query = text("""
        SELECT id FROM emr.users
        WHERE username = :username OR email = :email
    """)
    
    result = await db.execute(check_query, {
        "username": registration_data["username"],
        "email": registration_data["email"]
    })
    
    if result.first():
        raise HTTPException(status_code=409, detail="Username or email already exists")
    
    # Create user
    user_id = uuid.uuid4()
    insert_query = text("""
        INSERT INTO emr.users (
            id, username, email, password_hash, role,
            practitioner_id, preferences
        ) VALUES (
            :id, :username, :email, :password_hash, :role,
            :practitioner_id, :preferences
        )
    """)
    
    await db.execute(insert_query, {
        "id": user_id,
        "username": registration_data["username"],
        "email": registration_data["email"],
        "password_hash": AuthService.hash_password(registration_data["password"]),
        "role": registration_data.get("role", "user"),
        "practitioner_id": registration_data.get("practitionerId"),
        "preferences": json.dumps(registration_data.get("preferences", {}))
    })
    
    await db.commit()
    
    return {
        "id": str(user_id),
        "username": registration_data["username"],
        "email": registration_data["email"],
        "message": "User registered successfully"
    }


@router.post("/login")
async def login(
    login_data: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Login with provider_id (demo mode) or username/password.
    
    Returns JWT token for subsequent requests.
    """
    # Check if this is a provider-based login (demo mode)
    if login_data.get("provider_id"):
        # Demo provider login - create session without password
        provider_id = login_data["provider_id"]
        
        # Map provider IDs to demo users
        provider_map = {
            "dr-smith": {"username": "dr.smith", "name": "Dr. Sarah Smith", "role": "physician"},
            "dr-jones": {"username": "dr.jones", "name": "Dr. Michael Jones", "role": "physician"},
            "nurse-wilson": {"username": "nurse.wilson", "name": "Nancy Wilson, RN", "role": "nurse"},
            "admin-user": {"username": "admin", "name": "System Administrator", "role": "admin"}
        }
        
        if provider_id not in provider_map:
            raise HTTPException(status_code=404, detail="Provider not found")
        
        provider_info = provider_map[provider_id]
        
        # Create session token
        token = AuthService.create_token(
            user_id=provider_id,
            username=provider_info["username"],
            role=provider_info["role"]
        )
        
        # Create session
        session_id = uuid.uuid4()
        create_session_query = text("""
            INSERT INTO emr.sessions (
                id, user_id, token, expires_at, user_agent, ip_address
            ) VALUES (
                :id, :user_id, :token, :expires_at, :user_agent, :ip_address
            )
        """)
        
        try:
            await db.execute(create_session_query, {
                "id": session_id,
                "user_id": provider_id,  # Using provider_id as user_id for demo
                "token": token,
                "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
                "user_agent": request.headers.get("User-Agent", ""),
                "ip_address": request.client.host if request.client else None
            })
            await db.commit()
        except Exception:
            # Sessions table might not exist yet, continue anyway for demo
            pass
        
        return {
            "session_token": token,
            "provider": {
                "id": provider_id,
                "name": provider_info["name"],
                "role": provider_info["role"]
            }
        }
    
    # Regular username/password login
    elif login_data.get("username") and login_data.get("password"):
        # Get user
        query = text("""
            SELECT id, username, email, password_hash, role, practitioner_id
            FROM emr.users
            WHERE username = :username AND is_active = true
        """)
    
        result = await db.execute(query, {"username": login_data["username"]})
        user = result.first()
        
        if not user or not AuthService.verify_password(login_data["password"], user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Update last login
        update_query = text("""
            UPDATE emr.users
            SET last_login = :last_login
            WHERE id = :user_id
        """)
        
        await db.execute(update_query, {
            "last_login": datetime.now(timezone.utc),
            "user_id": user.id
        })
        
        # Create session
        session_id = uuid.uuid4()
        token = AuthService.create_token(str(user.id), user.username, user.role)
        
        session_query = text("""
            INSERT INTO emr.sessions (
                id, user_id, token, expires_at
            ) VALUES (
                :id, :user_id, :token, :expires_at
            )
        """)
        
        await db.execute(session_query, {
            "id": session_id,
            "user_id": user.id,
            "token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
        })
        
        # Create audit log
        audit_query = text("""
            INSERT INTO emr.audit_logs (
                user_id, action, details, ip_address, user_agent
            ) VALUES (
                :user_id, :action, :details, :ip_address, :user_agent
            )
        """)
        
        await db.execute(audit_query, {
            "user_id": user.id,
            "action": "login",
            "details": json.dumps({"username": user.username}),
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("User-Agent")
        })
        
        await db.commit()
        
        return {
            "token": token,
            "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "practitionerId": user.practitioner_id
        }
    }
    else:
        raise HTTPException(status_code=400, detail="Provider ID or username/password required")


@router.get("/me")
async def get_current_user(
    user: Dict[str, Any] = Depends(require_auth)
):
    """Get current user information."""
    return user


@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Logout and invalidate session."""
    # Get token from header
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    
    # Delete session
    delete_query = text("""
        DELETE FROM emr.sessions
        WHERE token = :token
    """)
    
    await db.execute(delete_query, {"token": token})
    
    # Create audit log
    audit_query = text("""
        INSERT INTO emr.audit_logs (
            user_id, action, ip_address, user_agent
        ) VALUES (
            :user_id, :action, :ip_address, :user_agent
        )
    """)
    
    await db.execute(audit_query, {
        "user_id": uuid.UUID(user["id"]),
        "action": "logout",
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("User-Agent")
    })
    
    await db.commit()
    
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user_info(
    user: Dict[str, Any] = Depends(require_auth),
    db: AsyncSession = Depends(get_db_session)
):
    """Get current user information."""
    # Get additional user details
    query = text("""
        SELECT preferences, last_login, created_at
        FROM emr.users
        WHERE id = :user_id
    """)
    
    result = await db.execute(query, {"user_id": uuid.UUID(user["id"])})
    details = result.first()
    
    return {
        **user,
        "preferences": details.preferences or {},
        "lastLogin": details.last_login.isoformat() if details.last_login else None,
        "createdAt": details.created_at.isoformat()
    }


@router.put("/me/preferences")
async def update_preferences(
    preferences: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Update user preferences."""
    update_query = text("""
        UPDATE emr.users
        SET preferences = :preferences
        WHERE id = :user_id
    """)
    
    await db.execute(update_query, {
        "preferences": json.dumps(preferences),
        "user_id": uuid.UUID(user["id"])
    })
    
    await db.commit()
    
    return {"message": "Preferences updated successfully"}


@router.post("/change-password")
async def change_password(
    password_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Change user password."""
    # Validate current password
    query = text("""
        SELECT password_hash
        FROM emr.users
        WHERE id = :user_id
    """)
    
    result = await db.execute(query, {"user_id": uuid.UUID(user["id"])})
    row = result.first()
    
    if not AuthService.verify_password(password_data.get("currentPassword", ""), row.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    update_query = text("""
        UPDATE emr.users
        SET password_hash = :password_hash
        WHERE id = :user_id
    """)
    
    await db.execute(update_query, {
        "password_hash": AuthService.hash_password(password_data["newPassword"]),
        "user_id": uuid.UUID(user["id"])
    })
    
    await db.commit()
    
    return {"message": "Password changed successfully"}


@router.get("/sessions")
async def get_active_sessions(
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Get user's active sessions."""
    query = text("""
        SELECT id, created_at, expires_at
        FROM emr.sessions
        WHERE user_id = :user_id AND expires_at > :now
        ORDER BY created_at DESC
    """)
    
    result = await db.execute(query, {
        "user_id": uuid.UUID(user["id"]),
        "now": datetime.now(timezone.utc)
    })
    
    sessions = []
    for row in result:
        sessions.append({
            "id": str(row.id),
            "createdAt": row.created_at.isoformat(),
            "expiresAt": row.expires_at.isoformat()
        })
    
    return {"sessions": sessions}


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: Dict[str, Any] = Depends(require_auth)
):
    """Revoke a specific session."""
    delete_query = text("""
        DELETE FROM emr.sessions
        WHERE id = :session_id AND user_id = :user_id
    """)
    
    result = await db.execute(delete_query, {
        "session_id": uuid.UUID(session_id),
        "user_id": uuid.UUID(user["id"])
    })
    
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session revoked successfully"}