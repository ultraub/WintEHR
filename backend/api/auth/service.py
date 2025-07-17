"""
Authentication service layer
"""

from typing import Optional, Dict, Any
from datetime import datetime
import secrets
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session
from .config import JWT_ENABLED, TRAINING_USERS, TRAINING_PASSWORD, JWT_ACCESS_TOKEN_EXPIRE_DELTA
from .jwt_handler import create_access_token, verify_token, verify_password
from .models import User, TokenResponse, SimpleAuthResponse

# Security scheme
security = HTTPBearer(auto_error=False)


class AuthService:
    """Authentication service handling both training and production modes"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.training_sessions: Dict[str, Dict[str, Any]] = {}
    
    async def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user based on current mode"""
        if not JWT_ENABLED:
            # Training mode - simple authentication
            if username in TRAINING_USERS and password == TRAINING_PASSWORD:
                user_data = TRAINING_USERS[username]
                return User(**user_data)
            return None
        else:
            # Production mode - JWT authentication
            # TODO: Implement database user lookup
            # For now, still use training users but with proper password hashing
            if username in TRAINING_USERS:
                # In production, you would fetch from database
                # For demo, we'll accept the training password
                if password == TRAINING_PASSWORD:
                    user_data = TRAINING_USERS[username]
                    return User(**user_data)
            return None
    
    async def login(self, username: str, password: str) -> Dict[str, Any]:
        """Process login and return appropriate response"""
        user = await self.authenticate_user(username, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password"
            )
        
        if JWT_ENABLED:
            # Production mode - return JWT token
            access_token = create_access_token(
                data={"sub": user.username, "role": user.role},
                expires_delta=JWT_ACCESS_TOKEN_EXPIRE_DELTA
            )
            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=int(JWT_ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
                user=user.dict()
            ).dict()
        else:
            # Training mode - return simple session
            session_token = f"training-session-{secrets.token_urlsafe(32)}"
            self.training_sessions[session_token] = {
                "user": user.dict(),
                "created_at": datetime.utcnow()
            }
            return SimpleAuthResponse(
                user=user.dict(),
                session_token=session_token
            ).dict()
    
    async def get_current_user_from_token(self, token: str) -> Optional[User]:
        """Get user from token (JWT or session)"""
        if JWT_ENABLED:
            # Verify JWT token
            payload = verify_token(token)
            if not payload:
                return None
            username = payload.get("sub")
            if username and username in TRAINING_USERS:
                return User(**TRAINING_USERS[username])
            return None
        else:
            # Check training session
            session = self.training_sessions.get(token)
            if session:
                return User(**session["user"])
            return None


# Dependency to get auth service
async def get_auth_service(db: AsyncSession = Depends(get_db_session)) -> AuthService:
    """Get auth service instance"""
    return AuthService(db)


# Dependency to get current user
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(default=None)
) -> User:
    """Get current authenticated user from request"""
    token = None
    
    # Check Bearer token first
    if credentials and credentials.credentials:
        token = credentials.credentials
    # Fall back to Authorization header
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get auth service
    db = await get_db_session().__anext__()
    auth_service = AuthService(db)
    
    user = await auth_service.get_current_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


# Optional dependency for endpoints that work with or without auth
async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(default=None)
) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(credentials, authorization)
    except HTTPException:
        return None