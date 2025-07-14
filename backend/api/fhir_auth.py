"""
FHIR-based Authentication Module
Integrates FHIR Person and Practitioner resources with authentication
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import uuid
import secrets
import hashlib
import json

from database import get_db_session as get_db
from models.synthea_models import Provider, Organization
from models.session import UserSession, PatientProviderAssignment
from .fhir.converter_modules.person import provider_to_person, add_authentication_extensions
from .fhir.converter_modules.practitioner import provider_to_practitioner, create_practitioner_role
from .fhir_jwt import (
    create_fhir_access_token, 
    create_fhir_refresh_token, 
    decode_fhir_access_token,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES
)
import jwt

router = APIRouter(prefix="/api/fhir-auth", tags=["fhir-authentication"])
security = HTTPBearer(auto_error=False)


# Pydantic models for FHIR-based authentication
class FHIRLogin(BaseModel):
    """FHIR-compliant login request"""
    identifier: str = Field(..., description="NPI, email, or user ID")
    credential: Optional[str] = Field(None, description="Password or auth token (for future use)")
    organization_id: Optional[str] = Field(None, description="Organization context for login")


class FHIRPractitionerResponse(BaseModel):
    """FHIR Practitioner resource response"""
    resourceType: str = "Practitioner"
    id: str
    meta: Dict[str, Any]
    active: bool
    name: List[Dict[str, Any]]
    identifier: List[Dict[str, Any]]
    telecom: Optional[List[Dict[str, Any]]] = None
    qualification: Optional[List[Dict[str, Any]]] = None
    extension: Optional[List[Dict[str, Any]]] = None


class FHIRPersonResponse(BaseModel):
    """FHIR Person resource response"""
    resourceType: str = "Person"
    id: str
    meta: Dict[str, Any]
    active: bool
    name: List[Dict[str, Any]]
    identifier: List[Dict[str, Any]]
    link: Optional[List[Dict[str, Any]]] = None
    extension: Optional[List[Dict[str, Any]]] = None


class FHIRSessionResponse(BaseModel):
    """FHIR-compliant session response"""
    session_token: str
    expires_at: datetime
    practitioner: Dict[str, Any]  # FHIR Practitioner resource
    person: Dict[str, Any]  # FHIR Person resource
    practitioner_role: Optional[Dict[str, Any]] = None  # FHIR PractitionerRole resource
    access_token: Optional[str] = None  # JWT access token
    refresh_token: Optional[str] = None  # JWT refresh token
    token_type: str = "Bearer"
    scope: str = "user/*.read user/*.write"


class FHIRBundleResponse(BaseModel):
    """FHIR Bundle containing authentication resources"""
    resourceType: str = "Bundle"
    type: str = "searchset"
    total: int
    entry: List[Dict[str, Any]]


# Helper functions
def create_fhir_session(provider: Provider, organization_id: Optional[str], db: Session) -> UserSession:
    """Create a new user session with FHIR references"""
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=8)  # 8-hour sessions
    
    session = UserSession(
        provider_id=provider.id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session


def get_current_fhir_provider(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Provider]:
    """Get current provider from session token or JWT with FHIR validation"""
    if not credentials:
        return None
    
    token = credentials.credentials
    
    # First try to decode as JWT
    try:
        jwt_payload = decode_fhir_access_token(token)
        practitioner_id = jwt_payload.get("sub")
        if practitioner_id:
            provider = db.query(Provider).filter(
                Provider.id == practitioner_id,
                Provider.active == True
            ).first()
            if provider:
                # Create or update session for JWT auth
                session = db.query(UserSession).filter(
                    UserSession.provider_id == provider.id,
                    UserSession.is_active == True,
                    UserSession.expires_at > datetime.utcnow()
                ).first()
                
                if session:
                    session.last_activity = datetime.utcnow()
                    db.commit()
                
                return provider
    except ValueError:
        # Not a valid JWT, try as session token
        pass
    
    # Fall back to session token lookup
    session = db.query(UserSession).filter(
        UserSession.session_token == token,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        return None
    
    # Update last activity
    session.last_activity = datetime.utcnow()
    db.commit()
    
    # Get the provider
    provider = db.query(Provider).filter(Provider.id == session.provider_id).first()
    
    # Validate provider is still active
    if not provider or not provider.active:
        session.is_active = False
        db.commit()
        return None
    
    return provider


def validate_practitioner_identifier(identifier: str, db: Session) -> Optional[Provider]:
    """Validate and find provider by various identifiers"""
    # Try different identifier types
    provider = db.query(Provider).filter(
        or_(
            Provider.npi == identifier,
            Provider.synthea_id == identifier,
            Provider.email == identifier,
            Provider.id == identifier
        ),
        Provider.active == True
    ).first()
    
    return provider


# FHIR Authentication endpoints
@router.get("/metadata", response_model=Dict[str, Any])
async def get_auth_metadata():
    """Get authentication capability statement"""
    return {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": datetime.utcnow().isoformat() + "Z",
        "kind": "instance",
        "implementation": {
            "description": "WintEHR FHIR Authentication Service"
        },
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [{
            "mode": "server",
            "security": {
                "service": [{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                        "code": "SMART-on-FHIR",
                        "display": "SMART-on-FHIR"
                    }]
                }],
                "description": "FHIR-based authentication with Person and Practitioner resources"
            },
            "resource": [
                {
                    "type": "Person",
                    "profile": "http://hl7.org/fhir/StructureDefinition/Person",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ]
                },
                {
                    "type": "Practitioner",
                    "profile": "http://hl7.org/fhir/StructureDefinition/Practitioner",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ]
                },
                {
                    "type": "PractitionerRole",
                    "profile": "http://hl7.org/fhir/StructureDefinition/PractitionerRole",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ]
                }
            ]
        }]
    }


@router.get("/Practitioner", response_model=FHIRBundleResponse)
async def search_practitioners(
    identifier: Optional[str] = None,
    name: Optional[str] = None,
    active: Optional[bool] = True,
    _count: Optional[int] = 100,
    db: Session = Depends(get_db)
):
    """Search for Practitioner resources"""
    query = db.query(Provider)
    
    if active is not None:
        query = query.filter(Provider.active == active)
    
    if identifier:
        query = query.filter(
            or_(
                Provider.npi == identifier,
                Provider.synthea_id == identifier,
                Provider.id == identifier
            )
        )
    
    if name:
        name_pattern = f"%{name}%"
        query = query.filter(
            or_(
                Provider.first_name.ilike(name_pattern),
                Provider.last_name.ilike(name_pattern)
            )
        )
    
    providers = query.limit(_count).all()
    
    # Convert to FHIR Bundle
    entries = []
    for provider in providers:
        practitioner = provider_to_practitioner(provider)
        entries.append({
            "fullUrl": f"Practitioner/{provider.id}",
            "resource": practitioner,
            "search": {
                "mode": "match"
            }
        })
    
    return FHIRBundleResponse(
        resourceType="Bundle",
        type="searchset",
        total=len(entries),
        entry=entries
    )


@router.get("/Practitioner/{practitioner_id}", response_model=Dict[str, Any])
async def get_practitioner(
    practitioner_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific Practitioner resource"""
    provider = db.query(Provider).filter(Provider.id == practitioner_id).first()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practitioner not found"
        )
    
    # Get current session if any
    session = db.query(UserSession).filter(
        UserSession.provider_id == provider.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    return provider_to_practitioner(provider, include_person_link=True, session=session)


@router.get("/Person/{person_id}", response_model=Dict[str, Any])
async def get_person(
    person_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific Person resource"""
    provider = db.query(Provider).filter(Provider.id == person_id).first()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    # Get current session if any
    session = db.query(UserSession).filter(
        UserSession.provider_id == provider.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    person = provider_to_person(provider)
    if session:
        person = add_authentication_extensions(person, session)
    
    return person


@router.post("/login", response_model=FHIRSessionResponse)
async def fhir_login(
    login_data: FHIRLogin,
    db: Session = Depends(get_db)
):
    """FHIR-compliant login endpoint"""
    # Validate provider
    provider = validate_practitioner_identifier(login_data.identifier, db)
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid identifier or practitioner not found"
        )
    
    # Create session
    session = create_fhir_session(provider, login_data.organization_id, db)
    
    # Create FHIR resources
    practitioner = provider_to_practitioner(provider, session=session)
    person = provider_to_person(provider)
    person = add_authentication_extensions(person, session)
    
    # Create PractitionerRole if organization specified
    practitioner_role = None
    if login_data.organization_id and provider.organization_id == login_data.organization_id:
        practitioner_role = create_practitioner_role(
            practitioner_id=str(provider.id),
            organization_id=login_data.organization_id,
            roles=["doctor"] if provider.specialty else ["healthcare-professional"],
            specialties=[provider.specialty] if provider.specialty else None
        )
    
    # Create JWT tokens
    access_token = create_fhir_access_token(
        practitioner_id=str(provider.id),
        organization_id=login_data.organization_id,
        additional_context={
            "session_id": str(session.id),
            "login_time": datetime.utcnow().isoformat() + "Z"
        }
    )
    
    refresh_token = create_fhir_refresh_token(str(provider.id))
    
    return FHIRSessionResponse(
        session_token=session.session_token,
        expires_at=session.expires_at,
        practitioner=practitioner,
        person=person,
        practitioner_role=practitioner_role,
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        scope="user/*.read user/*.write launch/patient"
    )


@router.post("/logout")
async def fhir_logout(
    current_provider: Provider = Depends(get_current_fhir_provider),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """FHIR-compliant logout endpoint"""
    if credentials:
        session = db.query(UserSession).filter(
            UserSession.session_token == credentials.credentials
        ).first()
        
        if session:
            session.is_active = False
            db.commit()
            
            # Return FHIR OperationOutcome
            return {
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "information",
                    "code": "informational",
                    "details": {
                        "text": "Successfully logged out"
                    }
                }]
            }
    
    return {
        "resourceType": "OperationOutcome",
        "issue": [{
            "severity": "warning",
            "code": "not-found",
            "details": {
                "text": "No active session found"
            }
        }]
    }


@router.get("/me", response_model=FHIRBundleResponse)
async def get_current_user_bundle(
    current_provider: Provider = Depends(get_current_fhir_provider),
    db: Session = Depends(get_db)
):
    """Get current user's FHIR resources as a Bundle"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Get current session
    session = db.query(UserSession).filter(
        UserSession.provider_id == current_provider.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    # Create FHIR resources
    practitioner = provider_to_practitioner(current_provider, session=session)
    person = provider_to_person(current_provider)
    person = add_authentication_extensions(person, session)
    
    entries = [
        {
            "fullUrl": f"Practitioner/{current_provider.id}",
            "resource": practitioner
        },
        {
            "fullUrl": f"Person/{current_provider.id}",
            "resource": person
        }
    ]
    
    # Add PractitionerRole if provider has organization
    if current_provider.organization_id:
        practitioner_role = create_practitioner_role(
            practitioner_id=str(current_provider.id),
            organization_id=current_provider.organization_id,
            roles=["doctor"] if current_provider.specialty else ["healthcare-professional"],
            specialties=[current_provider.specialty] if current_provider.specialty else None
        )
        entries.append({
            "fullUrl": f"PractitionerRole/{current_provider.id}-{current_provider.organization_id}",
            "resource": practitioner_role
        })
        
        # Add Organization resource
        org = db.query(Organization).filter(
            Organization.id == current_provider.organization_id
        ).first()
        if org:
            from .fhir.converters import organization_to_fhir
            entries.append({
                "fullUrl": f"Organization/{org.id}",
                "resource": organization_to_fhir(org)
            })
    
    return FHIRBundleResponse(
        resourceType="Bundle",
        type="collection",
        total=len(entries),
        entry=entries
    )


@router.post("/validate-session")
async def validate_session(
    current_provider: Provider = Depends(get_current_fhir_provider),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Validate current session and return FHIR OperationOutcome"""
    if not current_provider:
        return {
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "error",
                "code": "security",
                "details": {
                    "text": "Invalid or expired session"
                }
            }]
        }
    
    # Get session details
    session = db.query(UserSession).filter(
        UserSession.session_token == credentials.credentials,
        UserSession.is_active == True
    ).first()
    
    if not session:
        return {
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "error",
                "code": "security",
                "details": {
                    "text": "Session not found"
                }
            }]
        }
    
    # Calculate remaining time
    remaining_time = (session.expires_at - datetime.utcnow()).total_seconds()
    
    return {
        "resourceType": "OperationOutcome",
        "issue": [{
            "severity": "information",
            "code": "informational",
            "details": {
                "text": f"Session valid for {int(remaining_time / 60)} minutes"
            },
            "extension": [{
                "url": "http://wintehr.local/fhir/StructureDefinition/session-info",
                "extension": [
                    {
                        "url": "expires-at",
                        "valueDateTime": session.expires_at.isoformat() + "Z"
                    },
                    {
                        "url": "last-activity",
                        "valueDateTime": session.last_activity.isoformat() + "Z" if session.last_activity else None
                    },
                    {
                        "url": "practitioner-reference",
                        "valueReference": {
                            "reference": f"Practitioner/{current_provider.id}"
                        }
                    }
                ]
            }]
        }]
    }


@router.post("/token/refresh")
async def refresh_access_token(
    refresh_token: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Refresh FHIR access token"""
    try:
        # Decode refresh token
        payload = jwt.decode(
            refresh_token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )
        
        practitioner_id = payload.get("sub")
        if not practitioner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token"
            )
        
        # Get provider
        provider = db.query(Provider).filter(
            Provider.id == practitioner_id,
            Provider.active == True
        ).first()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Practitioner not found or inactive"
            )
        
        # Create new access token
        access_token = create_fhir_access_token(
            practitioner_id=str(provider.id),
            organization_id=provider.organization_id
        )
        
        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "scope": "user/*.read user/*.write launch/patient"
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


# Backward compatibility wrapper
def require_fhir_auth(db: Session = Depends(get_db)):
    """Dependency to require FHIR authentication"""
    def check_auth(current_provider: Provider = Depends(get_current_fhir_provider)):
        if not current_provider:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FHIR authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
        return current_provider
    return check_auth