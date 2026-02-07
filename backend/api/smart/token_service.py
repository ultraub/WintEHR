"""
SMART on FHIR Token Service

Manages JWT access tokens, refresh tokens, and token validation for SMART apps.
Based on SMART App Launch Implementation Guide v2.1.0

Educational Purpose:
- Demonstrates JWT structure for SMART access tokens
- Shows token lifecycle management (issue, validate, refresh, revoke)
- Provides transparent token claims for learning OAuth2

Token Types:
- Access Token: Short-lived JWT for FHIR API access
- Refresh Token: Long-lived opaque token for obtaining new access tokens
- ID Token: OpenID Connect identity token (when openid scope granted)
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
import jwt
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class TokenType(str, Enum):
    """Token types issued by the authorization server"""
    ACCESS = "access"
    REFRESH = "refresh"
    ID = "id"


@dataclass
class TokenClaims:
    """
    Parsed token claims from a SMART access token

    Educational notes:
    Standard JWT claims:
    - iss: Issuer (our authorization server URL)
    - sub: Subject (user ID)
    - aud: Audience (FHIR server URL)
    - exp: Expiration timestamp
    - iat: Issued at timestamp
    - jti: JWT ID (unique identifier)

    SMART-specific claims:
    - client_id: The app that requested the token
    - scope: Granted scopes (space-separated)
    - patient: Patient ID in context (if patient-scoped)
    - encounter: Encounter ID in context (if available)
    - fhirUser: FHIR resource URL for the user (if fhirUser scope)
    """
    iss: str
    sub: str
    aud: str
    exp: int
    iat: int
    jti: str
    client_id: str
    scope: str
    patient: Optional[str] = None
    encounter: Optional[str] = None
    fhir_user: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JWT encoding"""
        claims = {
            "iss": self.iss,
            "sub": self.sub,
            "aud": self.aud,
            "exp": self.exp,
            "iat": self.iat,
            "jti": self.jti,
            "client_id": self.client_id,
            "scope": self.scope,
        }

        # Add optional SMART context claims
        if self.patient:
            claims["patient"] = self.patient
        if self.encounter:
            claims["encounter"] = self.encounter
        if self.fhir_user:
            claims["fhirUser"] = self.fhir_user

        return claims


@dataclass
class TokenValidationResult:
    """Result of token validation"""
    valid: bool
    claims: Optional[TokenClaims] = None
    error: Optional[str] = None
    error_description: Optional[str] = None


class SMARTTokenService:
    """
    Token service for SMART on FHIR authorization

    Educational Purpose:
    This service demonstrates the complete token lifecycle:
    1. Token generation with proper JWT structure
    2. Token validation with signature and claims checking
    3. Refresh token handling for long-lived sessions
    4. Token revocation for security
    """

    # Default token lifetimes
    ACCESS_TOKEN_LIFETIME = 3600  # 1 hour
    REFRESH_TOKEN_LIFETIME = 86400 * 30  # 30 days
    ID_TOKEN_LIFETIME = 3600  # 1 hour

    def __init__(
        self,
        issuer: str,
        audience: str,
        secret_key: str,
        algorithm: str = "HS256"
    ):
        """
        Initialize token service

        Args:
            issuer: Authorization server URL (becomes 'iss' claim)
            audience: FHIR server URL (becomes 'aud' claim)
            secret_key: Key for signing JWTs
            algorithm: JWT signing algorithm (HS256, RS256, etc.)

        Educational notes:
        - HS256 uses symmetric key (same key for sign/verify)
        - RS256 uses asymmetric keys (private for sign, public for verify)
        - RS256 is preferred in production for key distribution
        """
        self.issuer = issuer
        self.audience = audience
        self.secret_key = secret_key
        self.algorithm = algorithm

        # In-memory token storage (use database in production)
        # Maps token hash to token metadata
        self._refresh_tokens: Dict[str, Dict[str, Any]] = {}
        self._revoked_tokens: set = set()

    def generate_access_token(
        self,
        user_id: str,
        client_id: str,
        scope: str,
        patient_id: Optional[str] = None,
        encounter_id: Optional[str] = None,
        fhir_user: Optional[str] = None,
        expires_in: Optional[int] = None
    ) -> Tuple[str, int]:
        """
        Generate a SMART access token (JWT)

        Educational notes:
        The access token is a JWT that contains:
        - Standard OAuth2 claims (iss, sub, aud, exp, iat)
        - SMART-specific context (patient, encounter, fhirUser)
        - Granted scopes for resource access control

        Args:
            user_id: Subject identifier (user who authorized)
            client_id: Application client ID
            scope: Space-separated granted scopes
            patient_id: Patient context (for patient-scoped tokens)
            encounter_id: Encounter context (if available)
            fhir_user: FHIR User resource URL (if fhirUser scope granted)
            expires_in: Custom expiration time in seconds

        Returns:
            Tuple of (access_token, expires_in)
        """
        now = datetime.utcnow()
        exp_seconds = expires_in or self.ACCESS_TOKEN_LIFETIME
        exp_time = now + timedelta(seconds=exp_seconds)

        # Generate unique token ID
        jti = secrets.token_urlsafe(16)

        claims = TokenClaims(
            iss=self.issuer,
            sub=user_id,
            aud=self.audience,
            exp=int(exp_time.timestamp()),
            iat=int(now.timestamp()),
            jti=jti,
            client_id=client_id,
            scope=scope,
            patient=patient_id,
            encounter=encounter_id,
            fhir_user=fhir_user
        )

        # Encode JWT
        token = jwt.encode(
            claims.to_dict(),
            self.secret_key,
            algorithm=self.algorithm
        )

        logger.info(
            f"Generated access token for client {client_id}, "
            f"user {user_id}, patient {patient_id}"
        )

        return token, exp_seconds

    def generate_refresh_token(
        self,
        user_id: str,
        client_id: str,
        scope: str,
        patient_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> str:
        """
        Generate a refresh token

        Educational notes:
        Refresh tokens are:
        - Opaque (not JWTs) to prevent client inspection
        - Long-lived for persistent access
        - Stored server-side for revocation capability
        - Used to get new access tokens without re-authorization

        Args:
            user_id: User who authorized
            client_id: Application client ID
            scope: Granted scopes (to maintain at refresh)
            patient_id: Patient context to maintain
            session_id: Optional authorization session ID

        Returns:
            Opaque refresh token string
        """
        # Generate secure random token
        token = secrets.token_urlsafe(32)

        # Store token metadata (hash the token for storage)
        token_hash = self._hash_token(token)
        expires_at = datetime.utcnow() + timedelta(seconds=self.REFRESH_TOKEN_LIFETIME)

        self._refresh_tokens[token_hash] = {
            "user_id": user_id,
            "client_id": client_id,
            "scope": scope,
            "patient_id": patient_id,
            "session_id": session_id,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
            "last_used": None
        }

        logger.info(f"Generated refresh token for client {client_id}")

        return token

    def generate_id_token(
        self,
        user_id: str,
        client_id: str,
        fhir_user: Optional[str] = None,
        nonce: Optional[str] = None
    ) -> str:
        """
        Generate an OpenID Connect ID token

        Educational notes:
        ID tokens are used when 'openid' scope is granted.
        They contain user identity information:
        - sub: Subject identifier
        - fhirUser: FHIR resource URL for the user
        - nonce: Value from authorization request (replay protection)

        Args:
            user_id: User identifier
            client_id: Application client ID
            fhir_user: FHIR User resource URL
            nonce: Nonce from authorization request

        Returns:
            ID token JWT
        """
        now = datetime.utcnow()
        exp_time = now + timedelta(seconds=self.ID_TOKEN_LIFETIME)

        claims = {
            "iss": self.issuer,
            "sub": user_id,
            "aud": client_id,  # ID token audience is the client
            "exp": int(exp_time.timestamp()),
            "iat": int(now.timestamp()),
        }

        if fhir_user:
            claims["fhirUser"] = fhir_user

        if nonce:
            claims["nonce"] = nonce

        token = jwt.encode(
            claims,
            self.secret_key,
            algorithm=self.algorithm
        )

        return token

    def validate_access_token(self, token: str) -> TokenValidationResult:
        """
        Validate a SMART access token

        Educational notes:
        Validation checks:
        1. Signature verification (proves token wasn't tampered)
        2. Expiration check (token hasn't expired)
        3. Issuer check (token is from our server)
        4. Audience check (token is for our FHIR server)
        5. Revocation check (token wasn't revoked)

        Args:
            token: The JWT access token to validate

        Returns:
            TokenValidationResult with claims if valid
        """
        try:
            # Decode and verify JWT
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                audience=self.audience,
                issuer=self.issuer
            )

            # Check if token was revoked
            jti = payload.get("jti")
            if jti and jti in self._revoked_tokens:
                return TokenValidationResult(
                    valid=False,
                    error="invalid_token",
                    error_description="Token has been revoked"
                )

            # Parse claims into structured object
            claims = TokenClaims(
                iss=payload["iss"],
                sub=payload["sub"],
                aud=payload["aud"],
                exp=payload["exp"],
                iat=payload["iat"],
                jti=payload.get("jti", ""),
                client_id=payload.get("client_id", ""),
                scope=payload.get("scope", ""),
                patient=payload.get("patient"),
                encounter=payload.get("encounter"),
                fhir_user=payload.get("fhirUser")
            )

            return TokenValidationResult(valid=True, claims=claims)

        except jwt.ExpiredSignatureError:
            logger.warning("Token validation failed: expired")
            return TokenValidationResult(
                valid=False,
                error="invalid_token",
                error_description="Token has expired"
            )

        except jwt.InvalidAudienceError:
            logger.warning("Token validation failed: invalid audience")
            return TokenValidationResult(
                valid=False,
                error="invalid_token",
                error_description="Token audience is invalid"
            )

        except jwt.InvalidIssuerError:
            logger.warning("Token validation failed: invalid issuer")
            return TokenValidationResult(
                valid=False,
                error="invalid_token",
                error_description="Token issuer is invalid"
            )

        except jwt.InvalidSignatureError:
            logger.warning("Token validation failed: invalid signature")
            return TokenValidationResult(
                valid=False,
                error="invalid_token",
                error_description="Token signature is invalid"
            )

        except jwt.DecodeError as e:
            logger.warning(f"Token validation failed: decode error - {e}")
            return TokenValidationResult(
                valid=False,
                error="invalid_token",
                error_description="Token could not be decoded"
            )

        except Exception as e:
            logger.error(f"Token validation error: {e}")
            return TokenValidationResult(
                valid=False,
                error="server_error",
                error_description="Token validation failed"
            )

    def validate_refresh_token(
        self,
        token: str,
        client_id: str
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Validate a refresh token

        Educational notes:
        Refresh token validation:
        1. Verify token exists in storage
        2. Verify it belongs to the requesting client
        3. Check expiration
        4. Return stored metadata for new token generation

        Args:
            token: The refresh token to validate
            client_id: Client ID making the request (must match)

        Returns:
            Tuple of (valid, token_metadata, error_message)
        """
        token_hash = self._hash_token(token)

        metadata = self._refresh_tokens.get(token_hash)
        if not metadata:
            return False, None, "Refresh token not found"

        # Verify client
        if metadata["client_id"] != client_id:
            logger.warning(
                f"Refresh token client mismatch: expected {metadata['client_id']}, "
                f"got {client_id}"
            )
            return False, None, "Refresh token was issued to different client"

        # Check expiration
        if datetime.utcnow() > metadata["expires_at"]:
            # Clean up expired token
            del self._refresh_tokens[token_hash]
            return False, None, "Refresh token has expired"

        # Update last used
        metadata["last_used"] = datetime.utcnow()

        return True, metadata, None

    def refresh_access_token(
        self,
        refresh_token: str,
        client_id: str
    ) -> Tuple[Optional[str], Optional[str], Optional[int], Optional[str]]:
        """
        Use a refresh token to get a new access token

        Educational notes:
        The refresh flow:
        1. Validate refresh token
        2. Generate new access token with same scope/context
        3. Optionally rotate refresh token (security best practice)
        4. Return new tokens

        Args:
            refresh_token: The refresh token
            client_id: Client ID making the request

        Returns:
            Tuple of (access_token, new_refresh_token, expires_in, error)
        """
        valid, metadata, error = self.validate_refresh_token(refresh_token, client_id)

        if not valid:
            return None, None, None, error

        # Generate new access token
        access_token, expires_in = self.generate_access_token(
            user_id=metadata["user_id"],
            client_id=client_id,
            scope=metadata["scope"],
            patient_id=metadata.get("patient_id")
        )

        # Optionally rotate refresh token (recommended for security)
        # For educational simplicity, we don't rotate by default
        new_refresh_token = None

        return access_token, new_refresh_token, expires_in, None

    def revoke_token(self, token: str, token_type: TokenType = TokenType.ACCESS) -> bool:
        """
        Revoke a token

        Educational notes:
        Token revocation is important for:
        - User logout
        - Security incidents
        - App deauthorization

        For JWTs, we track revoked token IDs since
        we can't truly invalidate a signed token.

        Args:
            token: The token to revoke
            token_type: Type of token (access or refresh)

        Returns:
            True if successfully revoked
        """
        if token_type == TokenType.REFRESH:
            token_hash = self._hash_token(token)
            if token_hash in self._refresh_tokens:
                del self._refresh_tokens[token_hash]
                logger.info("Revoked refresh token")
                return True
            return False

        else:  # Access token
            try:
                # Decode without verification to get JTI
                payload = jwt.decode(
                    token,
                    self.secret_key,
                    algorithms=[self.algorithm],
                    options={"verify_exp": False, "verify_aud": False}
                )
                jti = payload.get("jti")
                if jti:
                    self._revoked_tokens.add(jti)
                    logger.info(f"Revoked access token with JTI {jti}")
                    return True
            except Exception as e:
                logger.error(f"Error revoking token: {e}")

            return False

    def revoke_all_for_user(self, user_id: str) -> int:
        """
        Revoke all refresh tokens for a user

        Used when user changes password or explicitly logs out everywhere

        Args:
            user_id: The user whose tokens to revoke

        Returns:
            Number of tokens revoked
        """
        to_revoke = [
            token_hash for token_hash, metadata in self._refresh_tokens.items()
            if metadata["user_id"] == user_id
        ]

        for token_hash in to_revoke:
            del self._refresh_tokens[token_hash]

        logger.info(f"Revoked {len(to_revoke)} refresh tokens for user {user_id}")
        return len(to_revoke)

    def get_token_info(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a token (for debugging/education)

        Args:
            token: The JWT to inspect

        Returns:
            Dictionary with token details or None if invalid
        """
        try:
            # Decode without verification for inspection
            header = jwt.get_unverified_header(token)
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": False, "verify_aud": False}
            )

            exp_dt = datetime.fromtimestamp(payload.get("exp", 0))
            iat_dt = datetime.fromtimestamp(payload.get("iat", 0))
            now = datetime.utcnow()

            return {
                "header": header,
                "payload": payload,
                "is_expired": now > exp_dt,
                "expires_at": exp_dt.isoformat(),
                "issued_at": iat_dt.isoformat(),
                "time_until_expiry": str(exp_dt - now) if exp_dt > now else "Expired",
                "scopes": payload.get("scope", "").split(),
                "patient_context": payload.get("patient"),
                "encounter_context": payload.get("encounter"),
                "fhir_user": payload.get("fhirUser")
            }

        except Exception as e:
            logger.error(f"Error inspecting token: {e}")
            return None

    def _hash_token(self, token: str) -> str:
        """Hash a token for secure storage"""
        return hashlib.sha256(token.encode()).hexdigest()

    def cleanup_expired_tokens(self) -> int:
        """
        Clean up expired refresh tokens from memory

        Should be called periodically to prevent memory growth

        Returns:
            Number of tokens cleaned up
        """
        now = datetime.utcnow()
        expired = [
            token_hash for token_hash, metadata in self._refresh_tokens.items()
            if metadata["expires_at"] < now
        ]

        for token_hash in expired:
            del self._refresh_tokens[token_hash]

        if expired:
            logger.info(f"Cleaned up {len(expired)} expired refresh tokens")

        return len(expired)


# Factory function for creating token service with app config
def create_token_service(
    base_url: str,
    fhir_url: str,
    secret_key: str,
    algorithm: str = "HS256"
) -> SMARTTokenService:
    """
    Create a token service with the given configuration

    Args:
        base_url: Base URL of the authorization server
        fhir_url: Base URL of the FHIR server
        secret_key: Secret key for JWT signing
        algorithm: JWT signing algorithm

    Returns:
        Configured SMARTTokenService instance
    """
    return SMARTTokenService(
        issuer=base_url,
        audience=fhir_url,
        secret_key=secret_key,
        algorithm=algorithm
    )
