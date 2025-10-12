"""
Practitioner-based Authentication Service

Uses actual FHIR Practitioner resources for authentication.
Replaces hardcoded demo users with real Practitioners from HAPI FHIR.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import secrets
import logging
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from services.hapi_fhir_client import HAPIFHIRClient
from .models import User, TokenResponse, SimpleAuthResponse
from .config import JWT_ENABLED, JWT_ACCESS_TOKEN_EXPIRE_DELTA
from .jwt_handler import create_access_token
from api.services.audit_event_service import AuditEventService

logger = logging.getLogger(__name__)


class PractitionerAuthService:
    """
    Authentication service using FHIR Practitioner resources.

    Allows login with:
    - Practitioner family name (e.g., "Reilly981")
    - Practitioner NPI (e.g., "9999984591")
    - Practitioner ID (e.g., "78")

    For development, no password required.
    For production, would integrate with proper credential system.
    """

    def __init__(self):
        self.hapi_client = HAPIFHIRClient()
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

    async def find_practitioner(self, identifier: str) -> Optional[Dict[str, Any]]:
        """
        Find Practitioner by family name, NPI, or ID.

        Args:
            identifier: Family name, NPI, or Practitioner ID

        Returns:
            Practitioner resource dict or None
        """
        try:
            # Try as direct ID first
            if identifier.isdigit():
                try:
                    practitioner = await self.hapi_client.read("Practitioner", identifier)
                    if practitioner and practitioner.get("active", False):
                        return practitioner
                except Exception:
                    pass  # Not found by ID, continue searching

            # Search by family name
            bundle = await self.hapi_client.search("Practitioner", {
                "family": identifier,
                "active": "true",
                "_count": "10"
            })

            entries = bundle.get("entry", [])
            if entries:
                return entries[0].get("resource")

            # Search by NPI identifier
            bundle = await self.hapi_client.search("Practitioner", {
                "identifier": identifier,
                "active": "true",
                "_count": "1"
            })

            entries = bundle.get("entry", [])
            if entries:
                return entries[0].get("resource")

            return None

        except Exception as e:
            logger.error(f"Error finding practitioner: {e}")
            return None

    async def list_all_practitioners(self) -> List[Dict[str, Any]]:
        """
        Get all active Practitioners for login selection.

        Returns:
            List of simplified practitioner info
        """
        try:
            bundle = await self.hapi_client.search("Practitioner", {
                "active": "true",
                "_count": "100",
                "_sort": "family"
            })

            practitioners = []
            for entry in bundle.get("entry", []):
                resource = entry.get("resource", {})

                # Extract name
                names = resource.get("name", [])
                if names:
                    name_obj = names[0]
                    given = " ".join(name_obj.get("given", []))
                    family = name_obj.get("family", "")
                    prefix = " ".join(name_obj.get("prefix", []))
                    full_name = f"{prefix} {given} {family}".strip()
                else:
                    full_name = f"Practitioner {resource.get('id')}"

                # Extract NPI
                identifiers = resource.get("identifier", [])
                npi = None
                for identifier in identifiers:
                    if identifier.get("system") == "http://hl7.org/fhir/sid/us-npi":
                        npi = identifier.get("value")
                        break

                # Extract email
                telecoms = resource.get("telecom", [])
                email = None
                for telecom in telecoms:
                    if telecom.get("system") == "email":
                        email = telecom.get("value")
                        break

                practitioners.append({
                    "id": resource.get("id"),
                    "name": full_name,
                    "family": names[0].get("family") if names else None,
                    "npi": npi,
                    "email": email,
                    "gender": resource.get("gender")
                })

            return practitioners

        except Exception as e:
            logger.error(f"Error listing practitioners: {e}")
            return []

    def practitioner_to_user(self, practitioner: Dict[str, Any]) -> User:
        """
        Convert FHIR Practitioner resource to User object.

        Args:
            practitioner: FHIR Practitioner resource

        Returns:
            User object for authentication
        """
        # Extract name
        names = practitioner.get("name", [])
        if names:
            name_obj = names[0]
            given = " ".join(name_obj.get("given", []))
            family = name_obj.get("family", "")
            prefix = " ".join(name_obj.get("prefix", []))
            full_name = f"{prefix} {given} {family}".strip()
        else:
            full_name = f"Practitioner {practitioner.get('id')}"

        # Extract email
        telecoms = practitioner.get("telecom", [])
        email = "noemail@example.com"
        for telecom in telecoms:
            if telecom.get("system") == "email":
                email = telecom.get("value", email)
                break

        # Extract NPI for username
        identifiers = practitioner.get("identifier", [])
        username = family  # Default to family name
        for identifier in identifiers:
            if identifier.get("system") == "http://hl7.org/fhir/sid/us-npi":
                username = identifier.get("value", username)
                break

        # Determine role from specialty (simplified for now)
        role = "physician"  # Default role

        # All practitioners can prescribe and order
        permissions = [
            "read",
            "write",
            "prescribe",
            "order:medication",
            "order:lab",
            "order:imaging"
        ]

        return User(
            id=practitioner.get("id"),
            username=username,
            name=full_name,
            email=email,
            role=role,
            permissions=permissions,
            department="Clinical",
            active=practitioner.get("active", True)
        )

    async def authenticate(self, identifier: str, password: Optional[str] = None) -> Optional[User]:
        """
        Authenticate user by Practitioner identifier.

        For development: No password required
        For production: Would validate against credential system

        Args:
            identifier: Practitioner family name, NPI, or ID
            password: Password (not used in development mode)

        Returns:
            User object or None
        """
        practitioner = await self.find_practitioner(identifier)
        if not practitioner:
            return None

        # In development mode, any active practitioner can log in
        # In production, would validate password here

        return self.practitioner_to_user(practitioner)

    async def login(
        self,
        identifier: str,
        password: Optional[str] = None,
        request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """
        Process login with Practitioner credentials.

        Args:
            identifier: Practitioner family name, NPI, or ID
            password: Password (optional in development)
            request: FastAPI request for audit logging

        Returns:
            Authentication response with token and user info
        """
        # Get client info for audit
        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get('user-agent')

        # Audit service
        audit = AuditEventService()

        # Authenticate
        user = await self.authenticate(identifier, password)
        if not user:
            # Log failed login
            await audit.log_login_attempt(
                username=identifier,
                success=False,
                ip_address=ip_address,
                user_agent=user_agent,
                failure_reason="Practitioner not found"
            )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Practitioner '{identifier}' not found or inactive"
            )

        # Log successful login
        await audit.log_login_attempt(
            username=user.username,
            success=True,
            ip_address=ip_address,
            user_agent=user_agent
        )

        if JWT_ENABLED:
            # Production mode - return JWT
            access_token = create_access_token(
                data={"sub": user.id, "role": user.role},
                expires_delta=JWT_ACCESS_TOKEN_EXPIRE_DELTA
            )

            return TokenResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=int(JWT_ACCESS_TOKEN_EXPIRE_DELTA.total_seconds()),
                user=user.dict()
            ).dict()
        else:
            # Development mode - return session token
            session_token = f"practitioner-session-{secrets.token_urlsafe(32)}"

            # Store session
            self.active_sessions[session_token] = {
                "user": user,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=24),
                "ip_address": ip_address
            }

            return SimpleAuthResponse(
                user=user.dict(),
                session_token=session_token
            ).dict()

    async def validate_session(self, session_token: str) -> Optional[User]:
        """
        Validate session token and return user.

        Args:
            session_token: Session token from login

        Returns:
            User object or None
        """
        session = self.active_sessions.get(session_token)
        if not session:
            return None

        # Check expiration
        if datetime.utcnow() > session["expires_at"]:
            del self.active_sessions[session_token]
            return None

        return session["user"]

    async def logout(self, session_token: str) -> bool:
        """
        Logout and invalidate session.

        Args:
            session_token: Session token to invalidate

        Returns:
            True if session was found and invalidated
        """
        if session_token in self.active_sessions:
            del self.active_sessions[session_token]
            return True
        return False


# Global instance for dependency injection
_practitioner_auth_service = PractitionerAuthService()


def get_practitioner_auth_service() -> PractitionerAuthService:
    """Get Practitioner auth service instance"""
    return _practitioner_auth_service
