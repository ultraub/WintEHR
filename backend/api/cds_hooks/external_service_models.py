"""
External Service Registration Models
Pydantic models for registering and managing external CDS services
"""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, Dict
from datetime import datetime
from urllib.parse import urlparse


class ExternalServiceRegistration(BaseModel):
    """Request model for registering an external CDS service"""

    # Service identification
    service_id: str = Field(..., description="CDS service ID from discovery")
    title: str = Field(..., description="Human-readable service title")
    description: str = Field(..., description="Service description")
    hook_type: str = Field(..., description="CDS Hook type (e.g., patient-view)")

    # Service URL configuration
    url: str = Field(..., description="Full service URL or path")
    base_url: Optional[str] = Field(None, description="Base URL of CDS Hooks server")

    # Optional configuration
    prefetch_template: Optional[Dict[str, str]] = Field(None, description="Prefetch templates")
    credentials_id: Optional[str] = Field(None, description="Credentials reference ID")
    status: Optional[str] = Field("draft", description="Service status")
    version_notes: Optional[str] = Field(None, description="Version or import notes")

    @model_validator(mode='after')
    def derive_base_url(self):
        """
        Automatically derive base_url from url if not provided.

        Pydantic V2 note: V1 used `@validator('base_url', always=True)`,
        but V2 field_validators don't fire when the field is omitted
        from the input. `model_validator(mode='after')` runs once all
        fields are populated and reliably reaches both the "supplied"
        and "omitted" cases. Mutating `self` and returning it is the
        documented V2 idiom for cross-field defaulting.

        Example:
            url: "https://sandbox-services.cds-hooks.org/patient-greeting"
            base_url: "https://sandbox-services.cds-hooks.org"
        """
        if self.base_url is None and self.url:
            parsed = urlparse(self.url)
            self.base_url = f"{parsed.scheme}://{parsed.netloc}"
        return self

    class Config:
        schema_extra = {
            "example": {
                "service_id": "patient-greeting",
                "title": "Patient Greeting",
                "description": "Display which patient is being worked with",
                "hook_type": "patient-view",
                "url": "https://sandbox-services.cds-hooks.org/patient-greeting",
                "base_url": "https://sandbox-services.cds-hooks.org",
                "prefetch_template": {
                    "patient": "Patient/{{context.patientId}}"
                },
                "credentials_id": None,
                "status": "draft",
                "version_notes": "Imported from CDS Hooks sandbox"
            }
        }


class ExternalServiceResponse(BaseModel):
    """Response model for external service registration"""
    id: str
    service_id: str
    title: str
    hook_type: str
    base_url: str
    url: str
    status: str
    created_at: datetime

    class Config:
        orm_mode = True
