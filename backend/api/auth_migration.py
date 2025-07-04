"""
Authentication Migration Module
Provides backward compatibility and migration path from legacy auth to FHIR auth
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime

from database import get_db_session as get_db
from models.synthea_models import Provider
from models.session import UserSession
from .auth import get_current_provider, ProviderResponse, SessionResponse
from .fhir_auth import get_current_fhir_provider, FHIRSessionResponse
from .fhir.converters.person import provider_to_person, add_authentication_extensions
from .fhir.converters.practitioner import provider_to_practitioner

router = APIRouter(prefix="/api/auth-migration", tags=["auth-migration"])


@router.get("/status")
async def get_migration_status(
    current_provider: Optional[Provider] = Depends(get_current_provider),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Check if current session can be migrated to FHIR auth"""
    if not current_provider:
        return {
            "authenticated": False,
            "can_migrate": False,
            "reason": "No active session"
        }
    
    # Check if provider has required FHIR fields
    has_fhir_identifiers = bool(current_provider.npi or current_provider.synthea_id)
    has_contact_info = bool(current_provider.email or current_provider.phone)
    
    return {
        "authenticated": True,
        "can_migrate": True,
        "provider_id": str(current_provider.id),
        "has_fhir_identifiers": has_fhir_identifiers,
        "has_contact_info": has_contact_info,
        "fhir_ready": has_fhir_identifiers and has_contact_info,
        "recommendations": [] if (has_fhir_identifiers and has_contact_info) else [
            "Add NPI or Synthea ID for FHIR compliance" if not has_fhir_identifiers else None,
            "Add email or phone for contact information" if not has_contact_info else None
        ]
    }


@router.post("/migrate-session")
async def migrate_session_to_fhir(
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
) -> FHIRSessionResponse:
    """Migrate current legacy session to FHIR format"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session to migrate"
        )
    
    # Get current session
    session = db.query(UserSession).filter(
        UserSession.provider_id == current_provider.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid session found"
        )
    
    # Create FHIR resources
    practitioner = provider_to_practitioner(current_provider, include_person_link=True, session=session)
    person = provider_to_person(current_provider)
    person = add_authentication_extensions(person, session)
    
    # Create PractitionerRole if organization exists
    practitioner_role = None
    if current_provider.organization_id:
        from .fhir.converters.practitioner import create_practitioner_role
        practitioner_role = create_practitioner_role(
            practitioner_id=str(current_provider.id),
            organization_id=current_provider.organization_id,
            roles=["doctor"] if current_provider.specialty else ["healthcare-professional"],
            specialties=[current_provider.specialty] if current_provider.specialty else None
        )
    
    return FHIRSessionResponse(
        session_token=session.session_token,
        expires_at=session.expires_at,
        practitioner=practitioner,
        person=person,
        practitioner_role=practitioner_role
    )


@router.get("/compare-formats")
async def compare_auth_formats(
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Compare legacy and FHIR authentication formats"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Get legacy format
    display_name = f"{current_provider.first_name} {current_provider.last_name}"
    legacy_format = {
        "provider": {
            "id": str(current_provider.id),
            "synthea_id": current_provider.synthea_id,
            "npi": current_provider.npi,
            "display_name": display_name,
            "full_name": display_name,
            "specialty": current_provider.specialty,
            "first_name": current_provider.first_name,
            "last_name": current_provider.last_name
        }
    }
    
    # Get FHIR format
    session = db.query(UserSession).filter(
        UserSession.provider_id == current_provider.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    fhir_format = {
        "practitioner": provider_to_practitioner(current_provider, include_person_link=True, session=session),
        "person": add_authentication_extensions(provider_to_person(current_provider), session)
    }
    
    return {
        "legacy_format": legacy_format,
        "fhir_format": fhir_format,
        "benefits": [
            "FHIR format provides standardized resource structure",
            "Person resource enables identity management across roles",
            "Practitioner resource includes professional qualifications",
            "Extensions support custom authentication metadata",
            "PractitionerRole defines organizational relationships"
        ]
    }


@router.post("/update-provider-fhir-fields")
async def update_provider_fhir_fields(
    npi: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update provider fields needed for FHIR compliance"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Update fields
    updated_fields = []
    
    if npi and not current_provider.npi:
        current_provider.npi = npi
        updated_fields.append("npi")
    
    if email and not current_provider.email:
        current_provider.email = email
        updated_fields.append("email")
    
    if phone and not current_provider.phone:
        current_provider.phone = phone
        updated_fields.append("phone")
    
    if updated_fields:
        db.commit()
        db.refresh(current_provider)
    
    # Return updated FHIR resources
    return {
        "updated_fields": updated_fields,
        "practitioner": provider_to_practitioner(current_provider),
        "person": provider_to_person(current_provider)
    }


# Compatibility middleware
def get_provider_with_fhir_fallback(
    db: Session = Depends(get_db)
):
    """Get current provider with fallback between auth systems"""
    async def _get_provider(
        legacy_provider: Optional[Provider] = Depends(get_current_provider),
        fhir_provider: Optional[Provider] = Depends(get_current_fhir_provider)
    ) -> Provider:
        # Try legacy auth first for backward compatibility
        if legacy_provider:
            return legacy_provider
        
        # Fall back to FHIR auth
        if fhir_provider:
            return fhir_provider
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    return _get_provider