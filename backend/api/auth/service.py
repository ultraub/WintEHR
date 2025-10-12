"""
Authentication service layer
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import secrets
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session
from .config import JWT_ENABLED, TRAINING_USERS, TRAINING_PASSWORD, JWT_ACCESS_TOKEN_EXPIRE_DELTA, USE_SECURE_AUTH
from .jwt_handler import create_access_token, verify_token, verify_password
from .models import User, TokenResponse, SimpleAuthResponse
from api.services.audit_event_service import AuditEventService, AuditEventType

# Security scheme
security = HTTPBearer(auto_error=False)


class AuthService:
    """Authentication service handling both training and production modes"""

    # Class-level session storage (shared across all instances)
    # In production, this should use Redis or proper session storage
    training_sessions: Dict[str, Dict[str, Any]] = {}
    failed_attempts: Dict[str, list] = {}  # IP -> list of attempt timestamps

    def __init__(self, db: AsyncSession):
        self.db = db
    
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
            # CRITICAL SECURITY ISSUE: This must be fixed before production use!
            # TODO: Implement proper user database with hashed passwords
            # Current implementation accepts hardcoded training password which is a major security vulnerability
            
            # WARNING: The code below is for DEMO ONLY and must be replaced with:
            # 1. User table in database with hashed passwords (bcrypt)
            # 2. Proper password verification against hashed passwords
            # 3. User role and permission management
            # 4. Account lockout after failed attempts
            # 5. Password complexity requirements
            
            if username in TRAINING_USERS:
                # SECURITY VULNERABILITY: Using plain text password comparison
                # This MUST be replaced with bcrypt password hash verification
                if password == TRAINING_PASSWORD:
                    user_data = TRAINING_USERS[username]
                    return User(**user_data)
            return None
    
    async def login(self, username: str, password: str, request: Optional[Request] = None) -> Dict[str, Any]:
        """Process login and return appropriate response"""
        # Get client info for audit logging
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get('user-agent')
        
        # Create audit service (HAPI FHIR AuditEvent)
        audit = AuditEventService()
        
        # Basic rate limiting check
        if ip_address:
            await self._check_rate_limit(ip_address)
        
        user = await self.authenticate_user(username, password)
        if not user:
            # Log failed login attempt
            # Record failed attempt for rate limiting
            self._record_failed_attempt(ip_address)
            
            # Log failed login attempt
            await audit.log_login_attempt(
                username=username,
                success=False,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason="Invalid credentials"
            )
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
            
            # Log successful login
            await audit.log_login_attempt(
                username=username,
                success=True,
                ip_address=ip_address,
                user_agent=user_agent
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
            AuthService.training_sessions[session_token] = {
                "user": user.dict(),
                "created_at": datetime.utcnow()
            }
            # Log successful login
            await audit.log_login_attempt(
                username=username,
                success=True,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
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
            session = AuthService.training_sessions.get(token)
            if session:
                return User(**session["user"])
            return None
    
    async def _check_rate_limit(self, ip_address: str, max_attempts: int = 5, window_minutes: int = 15):
        """Simple rate limiting to prevent brute force attacks"""
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=window_minutes)
        
        # Clean old attempts
        if ip_address in AuthService.failed_attempts:
            AuthService.failed_attempts[ip_address] = [
                attempt for attempt in AuthService.failed_attempts[ip_address]
                if attempt > window_start
            ]
        
        # Check if too many attempts
        attempts = AuthService.failed_attempts.get(ip_address, [])
        if len(attempts) >= max_attempts:
            # Log suspicious activity (HAPI FHIR AuditEvent)
            audit = AuditEventService()
            await audit.log_event(
                event_type=AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
                details={
                    "reason": "Too many failed login attempts",
                    "ip_address": ip_address,
                    "attempts": len(attempts)
                },
                ip_address=ip_address,
                outcome="blocked"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later."
            )
    
    def _record_failed_attempt(self, ip_address: str):
        """Record a failed login attempt for rate limiting"""
        if ip_address:
            if ip_address not in AuthService.failed_attempts:
                AuthService.failed_attempts[ip_address] = []
            AuthService.failed_attempts[ip_address].append(datetime.utcnow())


# Dependency to get auth service
async def get_auth_service(db: AsyncSession = Depends(get_db_session)) -> AuthService:
    """Get auth service instance"""
    if USE_SECURE_AUTH:
        # Import here to avoid circular imports
        from .secure_auth_service import SecureAuthService
        return SecureAuthService(db)
    else:
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

    # Try Practitioner auth first (new system)
    if token.startswith("practitioner-session-"):
        from .practitioner_auth_service import get_practitioner_auth_service
        practitioner_service = get_practitioner_auth_service()
        user = await practitioner_service.validate_session(token)
        if user:
            return user

    # Fall back to legacy auth service
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


# Dependency that returns current user or demo user
async def get_current_user_or_demo(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(default=None)
) -> User:
    """Get current user if authenticated, otherwise return demo user"""
    try:
        return await get_current_user(credentials, authorization)
    except HTTPException:
        # Return demo user when not authenticated
        return User(
            id="demo",
            username="demo",
            email="demo@example.com",
            name="Demo User",
            role="user"
        )