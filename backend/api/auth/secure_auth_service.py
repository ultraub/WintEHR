"""
Secure Authentication Service
Uses proper database storage with bcrypt password hashing
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import secrets
import bcrypt
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging

from database import get_db_session
from .config import JWT_ENABLED, JWT_ACCESS_TOKEN_EXPIRE_DELTA, JWT_REFRESH_TOKEN_EXPIRE_DELTA
from .jwt_handler import create_access_token, verify_token
from .models import User, TokenResponse, SimpleAuthResponse
from api.services.audit_service import AuditService, AuditEventType

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)

# Password requirements
MIN_PASSWORD_LENGTH = 8
PASSWORD_REQUIRE_UPPERCASE = True
PASSWORD_REQUIRE_LOWERCASE = True
PASSWORD_REQUIRE_DIGIT = True
PASSWORD_REQUIRE_SPECIAL = True
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30


class SecureAuthService:
    """Secure authentication service with database-backed user management."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.training_sessions: Dict[str, Dict[str, Any]] = {}  # For development mode
    
    async def authenticate_user(self, username: str, password: str, ip_address: Optional[str] = None) -> Optional[User]:
        """Authenticate user against database with proper password hashing."""
        
        # Get user from database
        query = text("""
            SELECT 
                u.id, u.username, u.email, u.password_hash, u.full_name,
                u.role, u.permissions, u.is_active, u.is_locked,
                u.failed_login_attempts, u.last_failed_login,
                u.password_changed_at, u.must_change_password
            FROM auth.users u
            WHERE u.username = :username
        """)
        
        result = await self.db.execute(query, {"username": username})
        user_row = result.fetchone()
        
        if not user_row:
            # User not found - still check password to prevent timing attacks
            bcrypt.checkpw(b"dummy", b"$2b$12$dummy.hash.to.prevent.timing.attacks")
            return None
        
        # Check if account is locked
        if user_row.is_locked:
            # Check if lockout period has expired
            if user_row.last_failed_login:
                lockout_until = user_row.last_failed_login + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                if datetime.utcnow() < lockout_until:
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail=f"Account locked until {lockout_until.isoformat()}. Too many failed login attempts."
                    )
                else:
                    # Unlock account
                    await self._unlock_account(user_row.id)
        
        # Check if account is active
        if not user_row.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled. Please contact administrator."
            )
        
        # Verify password
        password_valid = bcrypt.checkpw(
            password.encode('utf-8'),
            user_row.password_hash.encode('utf-8')
        )
        
        if not password_valid:
            # Record failed attempt
            await self._record_failed_login(user_row.id, ip_address)
            return None
        
        # Reset failed attempts on successful login
        await self._reset_failed_attempts(user_row.id)
        
        # Get user permissions
        permissions = await self._get_user_permissions(user_row.id)
        
        # Create User object
        user = User(
            id=str(user_row.id),
            username=user_row.username,
            email=user_row.email,
            name=user_row.full_name,
            role=user_row.role,
            permissions=permissions,
            metadata={
                "must_change_password": user_row.must_change_password,
                "password_changed_at": user_row.password_changed_at.isoformat() if user_row.password_changed_at else None
            }
        )
        
        return user
    
    async def _get_user_permissions(self, user_id: str) -> List[str]:
        """Get all permissions for a user (role + individual)."""
        query = text("""
            SELECT DISTINCT 
                p.resource || ':' || p.action as permission
            FROM auth.user_permissions p
            WHERE p.user_id = :user_id
        """)
        
        result = await self.db.execute(query, {"user_id": user_id})
        permissions = [row.permission for row in result]
        
        # Add wildcard permissions for admin
        if any('admin' in p for p in permissions):
            permissions.append('*')
        
        return permissions
    
    async def _record_failed_login(self, user_id: str, ip_address: Optional[str]):
        """Record failed login attempt and lock account if needed."""
        update_query = text("""
            UPDATE auth.users
            SET 
                failed_login_attempts = failed_login_attempts + 1,
                last_failed_login = CURRENT_TIMESTAMP,
                is_locked = CASE 
                    WHEN failed_login_attempts + 1 >= :max_attempts THEN true 
                    ELSE false 
                END
            WHERE id = :user_id
        """)
        
        await self.db.execute(update_query, {
            "user_id": user_id,
            "max_attempts": MAX_LOGIN_ATTEMPTS
        })
        await self.db.commit()
        
        # Log security event
        audit = AuditService(self.db)
        await audit.log_event(
            event_type=AuditEventType.AUTH_LOGIN_FAILURE,
            user_id=str(user_id),
            details={"reason": "Invalid password"},
            ip_address=ip_address,
            outcome="failure"
        )
    
    async def _reset_failed_attempts(self, user_id: str):
        """Reset failed login attempts after successful login."""
        update_query = text("""
            UPDATE auth.users
            SET 
                failed_login_attempts = 0,
                last_successful_login = CURRENT_TIMESTAMP
            WHERE id = :user_id
        """)
        
        await self.db.execute(update_query, {"user_id": user_id})
        await self.db.commit()
    
    async def _unlock_account(self, user_id: str):
        """Unlock a locked account."""
        update_query = text("""
            UPDATE auth.users
            SET 
                is_locked = false,
                failed_login_attempts = 0
            WHERE id = :user_id
        """)
        
        await self.db.execute(update_query, {"user_id": user_id})
        await self.db.commit()
    
    async def login(self, username: str, password: str, request: Optional[Request] = None) -> Dict[str, Any]:
        """Process login and return appropriate response."""
        # Get client info for audit logging
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get('user-agent')
        
        # Create audit service
        audit = AuditService(self.db)
        
        try:
            user = await self.authenticate_user(username, password, ip_address)
            
            if not user:
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
                # Production mode - return JWT tokens
                access_token = create_access_token(
                    data={"sub": user.username, "role": user.role, "user_id": user.id},
                    expires_delta=JWT_ACCESS_TOKEN_EXPIRE_DELTA
                )
                
                refresh_token = create_access_token(
                    data={"sub": user.username, "type": "refresh"},
                    expires_delta=JWT_REFRESH_TOKEN_EXPIRE_DELTA
                )
                
                # Store session in database
                await self._create_session(user.id, access_token, ip_address, user_agent)
                
                # Log successful login
                await audit.log_login_attempt(
                    username=username,
                    success=True,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                
                return TokenResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_type="bearer",
                    expires_in=int(JWT_ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
                    user=user.dict()
                ).dict()
            else:
                # Development mode - return simple session
                session_token = f"dev-session-{secrets.token_urlsafe(32)}"
                self.training_sessions[session_token] = {
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
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Login error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred during login"
            )
    
    async def _create_session(self, user_id: str, token: str, ip_address: Optional[str], user_agent: Optional[str]):
        """Create a session record for JWT tracking."""
        # Hash the token for storage
        token_hash = bcrypt.hashpw(token.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        query = text("""
            INSERT INTO auth.sessions (user_id, token_hash, expires_at, ip_address, user_agent)
            VALUES (:user_id, :token_hash, :expires_at, :ip_address, :user_agent)
        """)
        
        expires_at = datetime.utcnow() + JWT_ACCESS_TOKEN_EXPIRE_DELTA
        
        await self.db.execute(query, {
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": expires_at,
            "ip_address": ip_address,
            "user_agent": user_agent
        })
        await self.db.commit()
    
    async def logout(self, token: str, user_id: str):
        """Invalidate a session."""
        # In production, we'd mark the session as inactive
        if JWT_ENABLED:
            query = text("""
                UPDATE auth.sessions
                SET is_active = false
                WHERE user_id = :user_id
                AND expires_at > CURRENT_TIMESTAMP
            """)
            
            await self.db.execute(query, {"user_id": user_id})
            await self.db.commit()
        else:
            # Development mode - remove from memory
            for session_token, session in list(self.training_sessions.items()):
                if session["user"]["id"] == user_id:
                    del self.training_sessions[session_token]
    
    async def change_password(self, user_id: str, current_password: str, new_password: str):
        """Change user password with validation."""
        # Validate new password
        if not self._validate_password_strength(new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password does not meet security requirements"
            )
        
        # Get current password hash
        query = text("SELECT password_hash FROM auth.users WHERE id = :user_id")
        result = await self.db.execute(query, {"user_id": user_id})
        user_row = result.fetchone()
        
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify current password
        if not bcrypt.checkpw(current_password.encode('utf-8'), user_row.password_hash.encode('utf-8')):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
        
        # Check password history
        if await self._is_password_reused(user_id, new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password has been used recently. Please choose a different password."
            )
        
        # Hash new password
        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Update password
        update_query = text("""
            UPDATE auth.users
            SET 
                password_hash = :password_hash,
                password_changed_at = CURRENT_TIMESTAMP,
                must_change_password = false
            WHERE id = :user_id
        """)
        
        await self.db.execute(update_query, {
            "user_id": user_id,
            "password_hash": new_hash
        })
        
        # Add to password history
        history_query = text("""
            INSERT INTO auth.password_history (user_id, password_hash)
            VALUES (:user_id, :password_hash)
        """)
        
        await self.db.execute(history_query, {
            "user_id": user_id,
            "password_hash": new_hash
        })
        
        await self.db.commit()
    
    def _validate_password_strength(self, password: str) -> bool:
        """Validate password meets security requirements."""
        if len(password) < MIN_PASSWORD_LENGTH:
            return False
        
        if PASSWORD_REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            return False
        
        if PASSWORD_REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            return False
        
        if PASSWORD_REQUIRE_DIGIT and not any(c.isdigit() for c in password):
            return False
        
        if PASSWORD_REQUIRE_SPECIAL and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            return False
        
        return True
    
    async def _is_password_reused(self, user_id: str, new_password: str, history_count: int = 5) -> bool:
        """Check if password was used recently."""
        query = text("""
            SELECT password_hash
            FROM auth.password_history
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(query, {
            "user_id": user_id,
            "limit": history_count
        })
        
        for row in result:
            if bcrypt.checkpw(new_password.encode('utf-8'), row.password_hash.encode('utf-8')):
                return True
        
        return False
    
    async def get_current_user_from_token(self, token: str) -> Optional[User]:
        """Get user from token with session validation."""
        if JWT_ENABLED:
            # Verify JWT token
            payload = verify_token(token)
            if not payload:
                return None
            
            user_id = payload.get("user_id")
            username = payload.get("sub")
            
            if not user_id or not username:
                return None
            
            # Check if session is still active
            query = text("""
                SELECT 1 FROM auth.sessions
                WHERE user_id = :user_id
                AND is_active = true
                AND expires_at > CURRENT_TIMESTAMP
                LIMIT 1
            """)
            
            result = await self.db.execute(query, {"user_id": user_id})
            if not result.fetchone():
                return None
            
            # Get user from database
            return await self._get_user_by_id(user_id)
        else:
            # Development mode - check memory sessions
            session = self.training_sessions.get(token)
            if session:
                return User(**session["user"])
            return None
    
    async def _get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID from database."""
        query = text("""
            SELECT 
                u.id, u.username, u.email, u.full_name,
                u.role, u.permissions, u.is_active
            FROM auth.users u
            WHERE u.id = :user_id AND u.is_active = true
        """)
        
        result = await self.db.execute(query, {"user_id": user_id})
        user_row = result.fetchone()
        
        if not user_row:
            return None
        
        permissions = await self._get_user_permissions(user_id)
        
        return User(
            id=str(user_row.id),
            username=user_row.username,
            email=user_row.email,
            name=user_row.full_name,
            role=user_row.role,
            permissions=permissions
        )


# Dependency to get secure auth service
async def get_secure_auth_service(db: AsyncSession = Depends(get_db_session)) -> SecureAuthService:
    """Get secure auth service instance."""
    return SecureAuthService(db)


# Updated dependency to get current user
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db_session)
) -> User:
    """Get current authenticated user from request."""
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
    auth_service = SecureAuthService(db)
    
    user = await auth_service.get_current_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


# Permission checking decorator
def require_permission(permission: str):
    """Decorator to require specific permission for endpoint."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get current user from kwargs
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )
            
            # Check if user has required permission
            if '*' in current_user.permissions:  # Admin has all permissions
                return await func(*args, **kwargs)
            
            if permission not in current_user.permissions:
                # Check wildcard permissions (e.g., "medications:*" matches "medications:prescribe")
                resource = permission.split(':')[0]
                if f"{resource}:*" not in current_user.permissions:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied. Required: {permission}"
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator