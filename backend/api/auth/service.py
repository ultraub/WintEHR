"""
Authentication service layer
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import secrets
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db_session, get_db_context
from .config import JWT_ENABLED, TRAINING_USERS, TRAINING_PASSWORD, JWT_ACCESS_TOKEN_EXPIRE_DELTA
from .jwt_handler import create_access_token, verify_token, verify_password
from .models import User, TokenResponse, SimpleAuthResponse
from .session_store import SessionStore
from api.services.audit_event_service import AuditEventService, AuditEventType

# Security scheme
security = HTTPBearer(auto_error=False)


class AuthService:
    """Authentication service handling both training and production modes"""

    # Training sessions: Redis-backed when REDIS_URL is set so every uvicorn
    # worker sees every login (session_store.py); in-process otherwise.
    training_sessions: SessionStore = SessionStore(
        "training", ttl_seconds=int(JWT_ACCESS_TOKEN_EXPIRE_DELTA.total_seconds())
    )
    failed_attempts: Dict[str, list] = {}  # IP -> list of attempt timestamps (per worker)

    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user: the built-in training users (literal training password)
        plus the Command Center's custom users (bcrypt); disabled users never log in.
        Same rule in both modes — JWT mode only changes what the login returns."""
        return await resolve_login_user(username, password)
    
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
            await AuthService.training_sessions.put(session_token, {
                "user": user.dict(),
                "created_at": datetime.utcnow(),
                # Shown on the Command Center's Sessions tab; never used for auth decisions.
                "ip_address": ip_address,
                "user_agent": user_agent,
            })
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
            record = await user_record_live(username) if username else None
            return User(**_user_fields(record)) if record and not record.get("disabled") else None
        else:
            # Check training session (shared store — see session_store.py)
            session = await AuthService.training_sessions.get(token)
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


# --- the user directory: built-in training users + the Command Center's `auth.users` ----------


def _user_fields(record: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in record.items() if k != "disabled"}


async def users_doc() -> Dict[str, Any]:
    """The live `auth.users` setting; {} when the settings store is unavailable, so
    the built-in logins keep working whatever happens to Postgres."""
    try:
        from api.command_center.settings_service import get_setting

        return dict(await get_setting("auth.users") or {})
    except Exception:  # noqa: BLE001 — identity must never depend on the settings store
        return {}


async def user_record_live(username: str) -> Optional[Dict[str, Any]]:
    from api.command_center.users import user_record

    return user_record(username, await users_doc())


async def resolve_login_user(username: str, password: str) -> Optional[User]:
    """Built-in users take the training password; custom users their bcrypt hash."""
    doc = await users_doc()
    if username in TRAINING_USERS:
        if (doc.get(username) or {}).get("disabled"):
            return None
        return User(**TRAINING_USERS[username]) if password == TRAINING_PASSWORD else None
    from api.command_center.users import user_record

    record = user_record(username, doc)
    if record is None or record.get("disabled"):
        return None
    if not verify_password(password, (doc.get(username) or {}).get("password_hash", "")):
        return None
    return User(**_user_fields(record))


async def user_disabled(username: str) -> bool:
    """Checked on every authenticated request so disabling a user ends their session now."""
    doc = await users_doc()
    return bool((doc.get(username) or {}).get("disabled"))


async def enabled_usernames() -> List[str]:
    doc = await users_doc()
    names = [u for u in TRAINING_USERS if not (doc.get(u) or {}).get("disabled")]
    names += sorted(u for u, spec in doc.items() if u not in TRAINING_USERS and isinstance(spec, dict) and not spec.get("disabled"))
    return names


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

    # Try Practitioner auth first (new system)
    if token.startswith("practitioner-session-"):
        from .practitioner_auth_service import get_practitioner_auth_service
        practitioner_service = get_practitioner_auth_service()
        user = await practitioner_service.validate_session(token)
        if user:
            return await apply_role_overrides(user)

    # Fall back to legacy auth service
    async with get_db_context() as db:
        auth_service = AuthService(db)
        user = await auth_service.get_current_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if await user_disabled(user.username):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This login has been disabled by an administrator",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await apply_role_overrides(user)


async def apply_role_overrides(user: User) -> User:
    """Replace the user's permissions with the Command Center's role override, if any.

    Reads the live `auth.roles` setting (cached per process for seconds), so an
    admin's change applies on the user's next request. Any failure to read the
    setting leaves the built-in permissions untouched — identity must never
    depend on the settings store being up.
    """
    try:
        from api.command_center.roles import effective_permissions
        from api.command_center.settings_service import get_setting

        overrides = await get_setting("auth.roles")
    except Exception:  # noqa: BLE001 — see docstring
        return user
    if not overrides:
        return user
    perms = effective_permissions(user.role, user.permissions, overrides)
    if perms == list(user.permissions):
        return user
    return user.model_copy(update={"permissions": perms})


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
            role="user",
            permissions=["read", "write"]
        )