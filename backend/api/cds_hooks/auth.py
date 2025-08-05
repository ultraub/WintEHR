"""
CDS Hooks JWT Authentication
Implements JWT-based authentication for CDS Clients per CDS Hooks 2.0 spec
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Security scheme for FastAPI
security = HTTPBearer(auto_error=False)


class CDSClientToken(BaseModel):
    """CDS Client JWT token claims"""
    iss: str  # Issuer (CDS Client identifier)
    aud: str  # Audience (CDS Service URL)
    exp: int  # Expiration time
    iat: int  # Issued at time
    jti: str  # JWT ID (unique identifier)
    sub: Optional[str] = None  # Subject (user identifier)
    
    # CDS-specific claims
    cds_client_id: str
    cds_client_name: Optional[str] = None
    organization: Optional[str] = None
    purpose: Optional[str] = None  # Purpose of the request


class CDSJWTAuth:
    """
    JWT Authentication handler for CDS Hooks
    
    CDS Hooks 2.0 requires HTTPS and supports JWT authentication
    for enhanced security between CDS Clients and Services
    """
    
    def __init__(
        self,
        jwt_secret: Optional[str] = None,
        jwt_algorithm: str = "HS256",
        token_expiration_minutes: int = 60,
        require_https: bool = True
    ):
        self.jwt_secret = jwt_secret or self._get_jwt_secret()
        self.jwt_algorithm = jwt_algorithm
        self.token_expiration = timedelta(minutes=token_expiration_minutes)
        self.require_https = require_https
        
        # Track token usage for rate limiting and audit
        self.token_usage: Dict[str, list] = {}
    
    def _get_jwt_secret(self) -> str:
        """Get JWT secret from environment or configuration"""
        import os
        secret = os.environ.get("CDS_JWT_SECRET")
        if not secret:
            # In production, this should fail
            logger.warning("No CDS_JWT_SECRET found, using default (INSECURE!)")
            secret = "default-secret-change-me"
        return secret
    
    def create_token(
        self,
        cds_client_id: str,
        cds_service_url: str,
        user_id: Optional[str] = None,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a JWT token for CDS Client authentication
        
        Args:
            cds_client_id: Unique identifier for the CDS Client
            cds_service_url: URL of the CDS Service (audience)
            user_id: Optional user identifier
            additional_claims: Optional additional JWT claims
            
        Returns:
            Signed JWT token string
        """
        now = datetime.utcnow()
        
        claims = {
            "iss": cds_client_id,
            "aud": cds_service_url,
            "exp": now + self.token_expiration,
            "iat": now,
            "jti": str(jwt.encode({"random": now.timestamp()}, "random", algorithm="HS256")),
            "cds_client_id": cds_client_id
        }
        
        if user_id:
            claims["sub"] = user_id
            
        if additional_claims:
            claims.update(additional_claims)
        
        token = jwt.encode(claims, self.jwt_secret, algorithm=self.jwt_algorithm)
        return token
    
    def verify_token(
        self,
        token: str,
        expected_audience: Optional[str] = None
    ) -> CDSClientToken:
        """
        Verify and decode a JWT token
        
        Args:
            token: JWT token string
            expected_audience: Expected audience claim (service URL)
            
        Returns:
            Decoded token claims
            
        Raises:
            HTTPException: If token is invalid
        """
        try:
            # Decode and verify token
            options = {"verify_exp": True}
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm],
                options=options
            )
            
            # Verify audience if provided
            if expected_audience and payload.get("aud") != expected_audience:
                raise jwt.InvalidAudienceError(f"Invalid audience: expected {expected_audience}")
            
            # Track token usage
            client_id = payload.get("cds_client_id", payload.get("iss"))
            self._track_token_usage(client_id, payload.get("jti"))
            
            return CDSClientToken(**payload)
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            raise HTTPException(status_code=401, detail="Token verification failed")
    
    def _track_token_usage(self, client_id: str, jti: Optional[str]):
        """Track token usage for rate limiting and audit"""
        if client_id not in self.token_usage:
            self.token_usage[client_id] = []
        
        self.token_usage[client_id].append({
            "jti": jti,
            "timestamp": datetime.utcnow()
        })
        
        # Clean up old entries (keep last hour)
        cutoff = datetime.utcnow() - timedelta(hours=1)
        self.token_usage[client_id] = [
            entry for entry in self.token_usage[client_id]
            if entry["timestamp"] > cutoff
        ]
    
    def check_rate_limit(self, client_id: str, limit: int = 1000) -> bool:
        """
        Check if client has exceeded rate limit
        
        Args:
            client_id: CDS Client identifier
            limit: Maximum requests per hour
            
        Returns:
            True if within limit, False if exceeded
        """
        if client_id not in self.token_usage:
            return True
        
        # Count requests in last hour
        hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_requests = [
            entry for entry in self.token_usage.get(client_id, [])
            if entry["timestamp"] > hour_ago
        ]
        
        return len(recent_requests) < limit


# Singleton instance
jwt_auth = CDSJWTAuth()


async def get_cds_client_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[CDSClientToken]:
    """
    FastAPI dependency to extract and verify CDS Client JWT token
    
    This is optional - services can choose to require authentication
    """
    if not credentials:
        return None
    
    # Check HTTPS requirement (in production)
    if jwt_auth.require_https and not request.url.scheme == "https":
        # In development, we might want to allow HTTP
        import os
        if os.environ.get("ENVIRONMENT") != "development":
            raise HTTPException(
                status_code=403,
                detail="HTTPS required for JWT authentication"
            )
    
    # Get expected audience from request URL
    expected_audience = str(request.url).split("?")[0]
    
    try:
        token = jwt_auth.verify_token(
            credentials.credentials,
            expected_audience=expected_audience
        )
        
        # Check rate limit
        if not jwt_auth.check_rate_limit(token.cds_client_id):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded"
            )
        
        return token
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")


def require_cds_auth(
    token: CDSClientToken = Depends(get_cds_client_token)
) -> CDSClientToken:
    """
    FastAPI dependency that requires CDS Client authentication
    
    Use this for endpoints that must be authenticated
    """
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    return token


# Middleware for automatic JWT validation
class CDSAuthMiddleware:
    """
    Middleware to automatically validate JWT tokens for CDS endpoints
    """
    
    def __init__(self, require_auth: bool = False):
        self.require_auth = require_auth
    
    async def __call__(self, request: Request, call_next):
        # Only process CDS endpoints
        if "/cds-services" in str(request.url):
            # Extract token from Authorization header
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    # Verify token
                    client_token = jwt_auth.verify_token(token)
                    # Add to request state for later use
                    request.state.cds_client = client_token
                except Exception as e:
                    if self.require_auth:
                        return HTTPException(status_code=401, detail=str(e))
                    else:
                        logger.warning(f"Invalid token provided: {str(e)}")
            elif self.require_auth:
                return HTTPException(
                    status_code=401,
                    detail="Authorization header required"
                )
        
        response = await call_next(request)
        return response