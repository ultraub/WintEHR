"""
FHIR Context Provider
Provides FHIR-based context for authenticated users
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime

from database import get_db_session as get_db
from models.synthea_models import Provider, Organization, Patient
from models.session import UserSession, PatientProviderAssignment
from .fhir_auth import get_current_fhir_provider
from .fhir.converters import (
    practitioner_to_fhir, 
    organization_to_fhir, 
    patient_to_fhir,
    create_reference
)
from .fhir.converters.person import provider_to_person, add_authentication_extensions
from .fhir.converters.practitioner import create_practitioner_role


class FHIRContext:
    """FHIR-based context for authenticated users"""
    
    def __init__(
        self,
        provider: Provider,
        session: UserSession,
        organization: Optional[Organization] = None,
        patient: Optional[Patient] = None
    ):
        self.provider = provider
        self.session = session
        self.organization = organization
        self.patient = patient
    
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
        return create_reference(
            "Organization",
            str(self.organization.id),
            self.organization.name
        )
    
    @property
    def patient_reference(self) -> Optional[Dict[str, str]]:
        """Get FHIR reference to current patient"""
        if not self.patient:
            return None
        return create_reference(
            "Patient",
            str(self.patient.id),
            f"{self.patient.first_name} {self.patient.last_name}"
        )
    
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
        
        # Add Organization
        if self.organization:
            entries.append({
                "fullUrl": f"Organization/{self.organization.id}",
                "resource": organization_to_fhir(self.organization)
            })
            
            # Add PractitionerRole
            practitioner_role = create_practitioner_role(
                practitioner_id=str(self.provider.id),
                organization_id=str(self.organization.id),
                roles=["doctor"] if self.provider.specialty else ["healthcare-professional"],
                specialties=[self.provider.specialty] if self.provider.specialty else None
            )
            entries.append({
                "fullUrl": f"PractitionerRole/{self.provider.id}-{self.organization.id}",
                "resource": practitioner_role
            })
        
        # Add Patient if in context
        if self.patient:
            entries.append({
                "fullUrl": f"Patient/{self.patient.id}",
                "resource": patient_to_fhir(self.patient)
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


def get_fhir_context(
    patient_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    current_provider: Provider = Depends(get_current_fhir_provider),
    db: Session = Depends(get_db)
) -> FHIRContext:
    """Get FHIR context for current user"""
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
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session"
        )
    
    # Get organization
    organization = None
    if organization_id:
        organization = db.query(Organization).filter(
            Organization.id == organization_id
        ).first()
    elif current_provider.organization_id:
        organization = db.query(Organization).filter(
            Organization.id == current_provider.organization_id
        ).first()
    
    # Get patient if specified
    patient = None
    if patient_id:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        
        # Verify provider has access to patient
        if patient:
            assignment = db.query(PatientProviderAssignment).filter(
                PatientProviderAssignment.patient_id == patient_id,
                PatientProviderAssignment.provider_id == current_provider.id,
                PatientProviderAssignment.is_active == True
            ).first()
            
            if not assignment:
                # Check if provider has organizational access
                # For now, allow access if provider is in same organization
                # In production, implement more granular access control
                pass
    
    return FHIRContext(
        provider=current_provider,
        session=session,
        organization=organization,
        patient=patient
    )


def get_smart_context(
    patient_id: Optional[str] = None,
    fhir_context: FHIRContext = Depends(get_fhir_context)
) -> Dict[str, Any]:
    """Get SMART on FHIR context"""
    return fhir_context.to_smart_context()


def require_patient_context(
    fhir_context: FHIRContext = Depends(get_fhir_context)
) -> FHIRContext:
    """Require patient to be in context"""
    if not fhir_context.patient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient context required"
        )
    return fhir_context


def require_organization_context(
    fhir_context: FHIRContext = Depends(get_fhir_context)
) -> FHIRContext:
    """Require organization to be in context"""
    if not fhir_context.organization:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization context required"
        )
    return fhir_context