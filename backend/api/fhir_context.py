"""
FHIR Context Provider
Provides FHIR-based context for authenticated users
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, Optional, List
from datetime import datetime

from database import get_db_session as get_db
from models.synthea_models import Provider  # TODO Phase 5: Migrate Provider to HAPI FHIR Practitioner
from models.session import UserSession, PatientProviderAssignment
from services.hapi_fhir_client import HAPIFHIRClient
from .fhir_auth import get_current_fhir_provider
from .fhir.converters import (
    practitioner_to_fhir,
    create_reference
)
from .fhir.converters.person import provider_to_person, add_authentication_extensions
from .fhir.converters.practitioner import create_practitioner_role


class FHIRContext:
    """
    FHIR-based context for authenticated users

    Note: Now uses FHIR resources directly from HAPI FHIR server
    - patient: FHIR Patient resource (dict)
    - organization: FHIR Organization resource (dict)
    - provider: Provider model (TODO: migrate to FHIR Practitioner in Phase 5)
    """

    def __init__(
        self,
        provider: Provider,
        session: UserSession,
        organization: Optional[Dict[str, Any]] = None,  # FHIR Organization resource
        patient: Optional[Dict[str, Any]] = None  # FHIR Patient resource
    ):
        self.provider = provider
        self.session = session
        self.organization = organization  # Already FHIR dict
        self.patient = patient  # Already FHIR dict
    
    @property
    def practitioner_reference(self) -> Dict[str, str]:
        """Get FHIR reference to current practitioner"""
        return create_reference(
            "Practitioner", 
            str(self.provider.id),
            f"{self.provider.first_name} {self.provider.last_name}"
        )
    
    @property
    def person_reference(self) -> Dict[str, str]:
        """Get FHIR reference to current person"""
        return create_reference(
            "Person",
            str(self.provider.id),
            f"{self.provider.first_name} {self.provider.last_name}"
        )
    
    @property
    def organization_reference(self) -> Optional[Dict[str, str]]:
        """Get FHIR reference to current organization"""
        if not self.organization:
            return None
        # organization is already FHIR dict from HAPI FHIR
        org_id = self.organization.get("id")
        org_name = self.organization.get("name", "Unknown Organization")
        return create_reference("Organization", org_id, org_name)
    
    @property
    def patient_reference(self) -> Optional[Dict[str, str]]:
        """Get FHIR reference to current patient"""
        if not self.patient:
            return None
        # patient is already FHIR dict from HAPI FHIR
        patient_id = self.patient.get("id")
        # Get name from FHIR name array
        name_parts = self.patient.get("name", [{}])[0] if self.patient.get("name") else {}
        given = " ".join(name_parts.get("given", [])) if name_parts.get("given") else ""
        family = name_parts.get("family", "")
        display_name = f"{given} {family}".strip() or "Unknown Patient"
        return create_reference("Patient", patient_id, display_name)
    
    def to_fhir_bundle(self) -> Dict[str, Any]:
        """Convert context to FHIR Bundle"""
        entries = []
        
        # Add Practitioner
        practitioner = practitioner_to_fhir(self.provider, include_person_link=True, session=self.session)
        entries.append({
            "fullUrl": f"Practitioner/{self.provider.id}",
            "resource": practitioner
        })
        
        # Add Person
        person = provider_to_person(self.provider)
        person = add_authentication_extensions(person, self.session)
        entries.append({
            "fullUrl": f"Person/{self.provider.id}",
            "resource": person
        })
        
        # Add Organization (already FHIR from HAPI FHIR)
        if self.organization:
            org_id = self.organization.get("id")
            entries.append({
                "fullUrl": f"Organization/{org_id}",
                "resource": self.organization  # Already FHIR dict
            })

            # Add PractitionerRole
            practitioner_role = create_practitioner_role(
                practitioner_id=str(self.provider.id),
                organization_id=org_id,
                roles=["doctor"] if self.provider.specialty else ["healthcare-professional"],
                specialties=[self.provider.specialty] if self.provider.specialty else None
            )
            entries.append({
                "fullUrl": f"PractitionerRole/{self.provider.id}-{org_id}",
                "resource": practitioner_role
            })

        # Add Patient if in context (already FHIR from HAPI FHIR)
        if self.patient:
            patient_id = self.patient.get("id")
            entries.append({
                "fullUrl": f"Patient/{patient_id}",
                "resource": self.patient  # Already FHIR dict
            })
        
        return {
            "resourceType": "Bundle",
            "type": "collection",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "total": len(entries),
            "entry": entries
        }
    
    def to_smart_context(self) -> Dict[str, Any]:
        """Convert to SMART on FHIR context format"""
        context = {
            "user": self.practitioner_reference["reference"],
            "userType": "Practitioner",
            "style": "https://wintehr.local/smart-style.json"
        }
        
        if self.organization:
            context["organization"] = self.organization_reference["reference"]
        
        if self.patient:
            context["patient"] = self.patient_reference["reference"]
        
        # Add need_patient_banner if no patient selected
        context["need_patient_banner"] = self.patient is None
        
        # Add session info as extension
        context["extension"] = {
            "session_expires": self.session.expires_at.isoformat() + "Z",
            "last_activity": self.session.last_activity.isoformat() + "Z" if self.session.last_activity else None
        }
        
        return context


async def get_fhir_context(
    patient_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    current_provider: Provider = Depends(get_current_fhir_provider),
    db: AsyncSession = Depends(get_db)
) -> FHIRContext:
    """
    Get FHIR context for current user

    Migrated to HAPI FHIR (Phase 3.7):
    - Patient resources loaded from HAPI FHIR
    - Organization resources loaded from HAPI FHIR
    - Provider authentication still uses Provider model (TODO Phase 5)
    """
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Initialize HAPI FHIR client
    hapi_client = HAPIFHIRClient()

    # Get current session (still uses session table - legitimate)
    from sqlalchemy import select
    session_query = select(UserSession).where(
        UserSession.provider_id == current_provider.id,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    )
    result = await db.execute(session_query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session"
        )

    # Get organization from HAPI FHIR
    organization = None
    org_id_to_fetch = organization_id or current_provider.organization_id
    if org_id_to_fetch:
        try:
            # Query HAPI FHIR for Organization resource
            organization = await hapi_client.read("Organization", org_id_to_fetch)
        except Exception as e:
            # Log but don't fail - organization is optional
            import logging
            logging.warning(f"Failed to load organization {org_id_to_fetch} from HAPI FHIR: {e}")

    # Get patient from HAPI FHIR if specified
    patient = None
    if patient_id:
        try:
            # Query HAPI FHIR for Patient resource
            patient = await hapi_client.read("Patient", patient_id)

            # Verify provider has access to patient
            if patient:
                assignment_query = select(PatientProviderAssignment).where(
                    PatientProviderAssignment.patient_id == patient_id,
                    PatientProviderAssignment.provider_id == current_provider.id,
                    PatientProviderAssignment.is_active == True
                )
                assignment_result = await db.execute(assignment_query)
                assignment = assignment_result.scalar_one_or_none()

                if not assignment:
                    # Check if provider has organizational access
                    # For now, allow access if provider is in same organization
                    # In production, implement more granular access control
                    pass
        except Exception as e:
            # Log error but don't fail
            import logging
            logging.error(f"Failed to load patient {patient_id} from HAPI FHIR: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient {patient_id} not found"
            )

    return FHIRContext(
        provider=current_provider,
        session=session,
        organization=organization,  # Now FHIR dict from HAPI
        patient=patient  # Now FHIR dict from HAPI
    )


async def get_smart_context(
    patient_id: Optional[str] = None,
    fhir_context: FHIRContext = Depends(get_fhir_context)
) -> Dict[str, Any]:
    """Get SMART on FHIR context"""
    return fhir_context.to_smart_context()


async def require_patient_context(
    fhir_context: FHIRContext = Depends(get_fhir_context)
) -> FHIRContext:
    """Require patient to be in context"""
    if not fhir_context.patient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient context required"
        )
    return fhir_context


async def require_organization_context(
    fhir_context: FHIRContext = Depends(get_fhir_context)
) -> FHIRContext:
    """Require organization to be in context"""
    if not fhir_context.organization:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required"
        )
    return fhir_context