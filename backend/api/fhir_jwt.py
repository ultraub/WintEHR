"""
FHIR JWT Token Module
Provides JWT token support for FHIR authentication
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import jwt
import os
from pydantic import BaseModel

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours


class FHIRTokenData(BaseModel):
    """FHIR JWT token payload"""
    sub: str  # Subject (Practitioner ID)
    iss: str  # Issuer
    aud: str  # Audience
    exp: int  # Expiration time
    iat: int  # Issued at
    practitioner_ref: str  # Practitioner reference
    person_ref: str  # Person reference
    organization_ref: Optional[str] = None  # Organization reference
    scope: str = "user/*.read user/*.write"  # SMART scopes
    context: Optional[Dict[str, Any]] = None  # Additional context


def create_fhir_access_token(
    practitioner_id: str,
    organization_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    additional_context: Optional[Dict[str, Any]] = None
) -> str:
    """Create a FHIR-compliant JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Create FHIR-compliant token data
    token_data = {
        "sub": practitioner_id,
        "iss": "http://wintehr.local/fhir",
        "aud": "http://wintehr.local/fhir",
        "exp": expire,
        "iat": datetime.utcnow(),
        "practitioner_ref": f"Practitioner/{practitioner_id}",
        "person_ref": f"Person/{practitioner_id}",
        "scope": "user/*.read user/*.write launch/patient",
        "context": additional_context or {}
    }
    
    if organization_id:
        token_data["organization_ref"] = f"Organization/{organization_id}"
        token_data["context"]["organization"] = organization_id
    
    # Add SMART on FHIR claims
    token_data["smart_style"] = "https://wintehr.local/smart-style.json"
    token_data["need_patient_banner"] = True
    
    encoded_jwt = jwt.encode(token_data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_fhir_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a FHIR JWT access token"""
    try:
        payload = jwt.decode(
            token, 
            JWT_SECRET_KEY, 
            algorithms=[JWT_ALGORITHM],
            audience="http://wintehr.local/fhir"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {str(e)}")


def create_fhir_refresh_token(practitioner_id: str) -> str:
    """Create a FHIR refresh token"""
    expire = datetime.utcnow() + timedelta(days=30)
    
    token_data = {
        "sub": practitioner_id,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(token_data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def validate_fhir_scope(token_payload: Dict[str, Any], required_scope: str) -> bool:
    """Validate that token has required SMART on FHIR scope"""
    token_scopes = token_payload.get("scope", "").split()
    
    # Handle wildcard scopes
    if required_scope in token_scopes:
        return True
    
    # Check for wildcard permissions
    scope_parts = required_scope.split("/")
    if len(scope_parts) == 2:
        resource_type, permission = scope_parts
        
        # Check for user/* or patient/* wildcards
        if f"{resource_type}/*.{permission.split('.')[1]}" in token_scopes:
            return True
        
        # Check for */read or */write wildcards
        if f"{resource_type.split('.')[0]}/*" in token_scopes:
            return True
    
    return False


def create_smart_launch_context(
    practitioner_id: str,
    patient_id: Optional[str] = None,
    encounter_id: Optional[str] = None,
    intent: str = "launch"
) -> Dict[str, Any]:
    """Create SMART on FHIR launch context"""
    context = {
        "intent": intent,
        "user": f"Practitioner/{practitioner_id}",
        "need_patient_banner": patient_id is None
    }
    
    if patient_id:
        context["patient"] = f"Patient/{patient_id}"
    
    if encounter_id:
        context["encounter"] = f"Encounter/{encounter_id}"
    
    return context


def encode_launch_parameter(context: Dict[str, Any]) -> str:
    """Encode SMART launch context as JWT"""
    expire = datetime.utcnow() + timedelta(minutes=5)  # Short-lived launch token
    
    token_data = {
        "launch_context": context,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(token_data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_launch_parameter(launch_token: str) -> Dict[str, Any]:
    """Decode SMART launch context from JWT"""
    try:
        payload = jwt.decode(
            launch_token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )
        return payload.get("launch_context", {})
    except jwt.ExpiredSignatureError:
        raise ValueError("Launch token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid launch token: {str(e)}")