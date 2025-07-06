"""Authentication and provider management endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid
import secrets

from database import get_db_session as get_db
from models.models import Patient
from models.synthea_models import Provider  # Use existing Synthea provider model
from models.session import UserSession, PatientProviderAssignment

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Pydantic models
class ProviderLogin(BaseModel):
    provider_id: str  # Will use synthea_id or npi

class ProviderResponse(BaseModel):
    id: str
    synthea_id: Optional[str]
    npi: Optional[str]
    display_name: str
    full_name: str
    specialty: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    
    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    session_token: str
    provider: ProviderResponse
    expires_at: datetime

class PatientListResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    mrn: str
    assignment_type: Optional[str] = None
    
    class Config:
        from_attributes = True


# Session management
def create_session(provider: Provider, db: Session) -> UserSession:
    """Create a new user session"""
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
    
    # Note: Synthea provider model doesn't have last_login field
    # We'll just commit the session
    
    return session


def get_current_provider(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Provider]:
    """Get current provider from session token"""
    if not credentials:
        return None
    
    session = db.query(UserSession).filter(
        UserSession.session_token == credentials.credentials,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        return None
    
    # Update last activity
    session.last_activity = datetime.utcnow()
    db.commit()
    
    # Get the provider separately since session doesn't have relationship
    provider = db.query(Provider).filter(Provider.id == session.provider_id).first()
    return provider


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[Provider]:
    """Get current user if logged in, otherwise return None"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.split(" ")[1]
    
    # Look up session by token
    session = db.query(UserSession).filter(
        UserSession.session_token == token,
        UserSession.expires_at > datetime.utcnow(),
        UserSession.is_active == True
    ).first()
    
    if not session:
        return None
    
    # Get provider
    provider = db.query(Provider).filter(Provider.id == session.provider_id).first()
    return provider


# Authentication endpoints
@router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(db: Session = Depends(get_db)):
    """Get list of all active providers for login selection"""
    providers = db.query(Provider).filter(Provider.active == True).order_by(Provider.last_name, Provider.first_name).all()
    
    result = []
    for provider in providers:
        display_name = f"{provider.first_name} {provider.last_name}" if provider.first_name and provider.last_name else "Unknown Provider"
        full_name = display_name
        
        result.append(ProviderResponse(
            id=provider.id,
            synthea_id=provider.synthea_id,
            npi=provider.npi,
            display_name=display_name,
            full_name=full_name,
            specialty=provider.specialty,
            first_name=provider.first_name,
            last_name=provider.last_name
        ))
    
    return result


@router.post("/login", response_model=SessionResponse)
async def login(login_data: ProviderLogin, db: Session = Depends(get_db)):
    """Login as a specific provider"""
    # Try to find provider by synthea_id, npi, or id
    provider = db.query(Provider).filter(
        (Provider.synthea_id == login_data.provider_id) |
        (Provider.npi == login_data.provider_id) |
        (Provider.id == login_data.provider_id)
    ).first()
    
    if not provider or not provider.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid provider ID or provider is inactive"
        )
    
    # Create session
    session = create_session(provider, db)
    
    display_name = f"{provider.first_name} {provider.last_name}" if provider.first_name and provider.last_name else "Unknown Provider"
    
    provider_response = ProviderResponse(
        id=provider.id,
        synthea_id=provider.synthea_id,
        npi=provider.npi,
        display_name=display_name,
        full_name=display_name,
        specialty=provider.specialty,
        first_name=provider.first_name,
        last_name=provider.last_name
    )
    
    return SessionResponse(
        session_token=session.session_token,
        provider=provider_response,
        expires_at=session.expires_at
    )


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Logout current session"""
    if credentials:
        session = db.query(UserSession).filter(
            UserSession.session_token == credentials.credentials
        ).first()
        
        if session:
            session.is_active = False
            db.commit()
    
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=ProviderResponse)
async def get_current_user(
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """Get current provider information"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    display_name = f"{current_provider.first_name} {current_provider.last_name}" if current_provider.first_name and current_provider.last_name else "Unknown Provider"
    
    return ProviderResponse(
        id=current_provider.id,
        synthea_id=current_provider.synthea_id,
        npi=current_provider.npi,
        display_name=display_name,
        full_name=display_name,
        specialty=current_provider.specialty,
        first_name=current_provider.first_name,
        last_name=current_provider.last_name
    )


# Patient management endpoints
@router.get("/my-patients", response_model=List[PatientListResponse])
async def get_my_patients(
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """Get patients assigned to current provider"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Get patients assigned to this provider
    query = db.query(Patient, PatientProviderAssignment.assignment_type).join(
        PatientProviderAssignment,
        and_(
            Patient.id == PatientProviderAssignment.patient_id,
            PatientProviderAssignment.provider_id == current_provider.id,
            PatientProviderAssignment.is_active == True
        )
    ).order_by(Patient.last_name, Patient.first_name)
    
    results = query.all()
    
    patients = []
    for patient, assignment_type in results:
        patient_data = PatientListResponse(
            id=patient.id,
            first_name=patient.first_name,
            last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.isoformat() if patient.date_of_birth else "",
            gender=patient.gender,
            mrn=patient.mrn,
            assignment_type=assignment_type
        )
        patients.append(patient_data)
    
    return patients


@router.get("/all-patients", response_model=List[PatientListResponse])
async def search_all_patients(
    search: Optional[str] = None,
    limit: int = 50,
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """Search all patients (not just assigned ones)"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    query = db.query(Patient)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Patient.first_name.ilike(search_pattern)) |
            (Patient.last_name.ilike(search_pattern)) |
            (Patient.mrn.ilike(search_pattern))
        )
    
    patients = query.order_by(Patient.last_name, Patient.first_name).limit(limit).all()
    
    return [
        PatientListResponse(
            id=patient.id,
            first_name=patient.first_name,
            last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.isoformat() if patient.date_of_birth else "",
            gender=patient.gender,
            mrn=patient.mrn
        )
        for patient in patients
    ]


@router.post("/assign-patient/{patient_id}")
async def assign_patient_to_provider(
    patient_id: str,
    assignment_type: str = "primary",
    current_provider: Provider = Depends(get_current_provider),
    db: Session = Depends(get_db)
):
    """Assign a patient to the current provider"""
    if not current_provider:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Check if patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Check if assignment already exists
    existing = db.query(PatientProviderAssignment).filter(
        PatientProviderAssignment.patient_id == patient_id,
        PatientProviderAssignment.provider_id == current_provider.id,
        PatientProviderAssignment.assignment_type == assignment_type,
        PatientProviderAssignment.is_active == True
    ).first()
    
    if existing:
        return {"message": "Patient already assigned"}
    
    # Create new assignment
    assignment = PatientProviderAssignment(
        patient_id=patient_id,
        provider_id=current_provider.id,
        assignment_type=assignment_type,
        assigned_by_id=current_provider.id
    )
    
    db.add(assignment)
    db.commit()
    
    return {"message": "Patient assigned successfully"}