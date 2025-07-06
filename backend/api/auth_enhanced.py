"""
Enhanced Authentication API with optional JWT support
Maintains simple training auth as default with optional JWT for production
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import os
import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from database import get_db_session

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Configuration
JWT_ENABLED = os.getenv("JWT_ENABLED", "false").lower() == "true"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "training-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default

# Password hashing (only used if JWT is enabled)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]

class SimpleAuthResponse(BaseModel):
    user: Dict[str, Any]
    session_token: str

# Training users (used when JWT is disabled)
TRAINING_USERS = {
    "demo": {
        "id": "demo-user-001",
        "username": "demo",
        "name": "Demo User",
        "email": "demo@medgenemr.training",
        "role": "physician",
        "permissions": ["read", "write", "admin"],
        "department": "Internal Medicine"
    },
    "nurse": {
        "id": "nurse-user-001", 
        "username": "nurse",
        "name": "Nurse User",
        "email": "nurse@medgenemr.training",
        "role": "nurse",
        "permissions": ["read", "write"],
        "department": "Nursing"
    },
    "pharmacist": {
        "id": "pharmacist-user-001",
        "username": "pharmacist", 
        "name": "Pharmacist User",
        "email": "pharmacist@medgenemr.training",
        "role": "pharmacist",
        "permissions": ["read", "write"],
        "department": "Pharmacy"
    },
    "admin": {
        "id": "admin-user-001",
        "username": "admin",
        "name": "System Admin",
        "email": "admin@medgenemr.training", 
        "role": "admin",
        "permissions": ["read", "write", "admin", "system"],
        "department": "IT"
    }
}

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token (only used if JWT is enabled)"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token (only used if JWT is enabled)"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return payload
    except jwt.PyJWTError:
        return None

def get_password_hash(password: str) -> str:
    """Hash password (only used if JWT is enabled)"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password (only used if JWT is enabled)"""
    return pwd_context.verify(plain_password, hashed_password)

@router.post("/login")
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Login endpoint supporting both simple training auth and JWT
    """
    if JWT_ENABLED:
        return await jwt_login(login_data, db)
    else:
        return await simple_login(login_data)

async def simple_login(login_data: LoginRequest) -> SimpleAuthResponse:
    """Simple training authentication (default)"""
    username = login_data.username.lower()
    
    # Check if user exists in training users
    if username not in TRAINING_USERS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    user = TRAINING_USERS[username].copy()
    
    # For training, accept any password or no password
    # In a real system, you'd verify the password here
    
    # Create simple session token (just base64 encoded user info for training)
    import base64
    import json
    session_data = {
        "user_id": user["id"],
        "username": user["username"],
        "login_time": datetime.utcnow().isoformat()
    }
    session_token = base64.b64encode(json.dumps(session_data).encode()).decode()
    
    return SimpleAuthResponse(
        user=user,
        session_token=session_token
    )

async def jwt_login(login_data: LoginRequest, db: AsyncSession) -> TokenResponse:
    """JWT authentication (optional)"""
    # In a real implementation, you'd check against a database
    # For now, we'll use the same training users but with actual password verification
    username = login_data.username.lower()
    
    if username not in TRAINING_USERS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    user = TRAINING_USERS[username].copy()
    
    # For JWT mode, you could add actual password verification here
    # For training purposes, we'll accept the password "password" for all users
    if login_data.password != "password":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create JWT token
    access_token_expires = timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user
    )

@router.get("/me")
async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get current user information
    Supports both simple session tokens and JWT tokens
    """
    if not authorization:
        # Return demo user if no authorization (for backwards compatibility)
        return TRAINING_USERS["demo"]
    
    if JWT_ENABLED and authorization.startswith("Bearer "):
        # JWT mode
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        username = payload.get("sub")
        if username not in TRAINING_USERS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return TRAINING_USERS[username]
    
    else:
        # Simple session token mode
        try:
            import base64
            import json
            
            # Remove "Bearer " if present
            token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
            
            # Decode session token
            session_data = json.loads(base64.b64decode(token).decode())
            username = session_data.get("username")
            
            if username and username in TRAINING_USERS:
                return TRAINING_USERS[username]
            else:
                # Fallback to demo user
                return TRAINING_USERS["demo"]
                
        except Exception:
            # If token parsing fails, return demo user for training
            return TRAINING_USERS["demo"]

@router.post("/logout")
async def logout():
    """
    Logout endpoint
    In training mode, this just returns success
    In JWT mode, client should discard the token
    """
    return {"message": "Logged out successfully"}

@router.get("/config")
async def get_auth_config():
    """
    Get authentication configuration
    Useful for frontend to know which auth mode is active
    """
    return {
        "jwt_enabled": JWT_ENABLED,
        "auth_mode": "jwt" if JWT_ENABLED else "simple",
        "token_expire_minutes": JWT_ACCESS_TOKEN_EXPIRE_MINUTES if JWT_ENABLED else None,
        "available_users": list(TRAINING_USERS.keys()) if not JWT_ENABLED else None,
        "message": "JWT authentication is optional. Set JWT_ENABLED=true to enable." if not JWT_ENABLED else "JWT authentication is enabled."
    }

@router.get("/users")
async def list_training_users():
    """
    List available training users (only in simple auth mode)
    """
    if JWT_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User listing not available in JWT mode"
        )
    
    # Return user list without sensitive data
    users = []
    for username, user_data in TRAINING_USERS.items():
        users.append({
            "username": username,
            "name": user_data["name"],
            "role": user_data["role"],
            "department": user_data["department"]
        })
    
    return {"users": users}

# Dependency for protected routes
async def get_current_active_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Dependency to get current active user for protected routes
    Works with both auth modes
    """
    return await get_current_user(authorization, db)