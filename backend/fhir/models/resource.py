"""
Generic FHIR Resource Model for Resources Stored in fhir.resources Table
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from database import Base


class FHIRResource(Base):
    """Generic FHIR Resource model for resources stored as JSONB"""
    __tablename__ = "resources"
    __table_args__ = {"schema": "fhir"}
    
    id = Column(Integer, primary_key=True)
    resource_type = Column(String(255), nullable=False, index=True)
    fhir_id = Column(String(255), nullable=False)
    version_id = Column(Integer, nullable=False, default=1)
    last_updated = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    resource = Column(JSONB, nullable=False)
    deleted = Column(Boolean, default=False)
    
    # Convenience property to access resource data
    @property
    def data(self):
        return self.resource
    
    # Property to get patient_id from various resource types
    @property
    def patient_id(self):
        if self.resource_type in ["Patient"]:
            return self.fhir_id
        
        # Check common patient reference paths
        patient_ref = None
        if "subject" in self.resource and isinstance(self.resource["subject"], dict):
            patient_ref = self.resource["subject"].get("reference", "")
        elif "patient" in self.resource and isinstance(self.resource["patient"], dict):
            patient_ref = self.resource["patient"].get("reference", "")
        elif "beneficiary" in self.resource and isinstance(self.resource["beneficiary"], dict):
            patient_ref = self.resource["beneficiary"].get("reference", "")
        
        if patient_ref and patient_ref.startswith("Patient/"):
            return patient_ref.replace("Patient/", "")
        
        return None
    
    # Property to get encounter_id
    @property
    def encounter_id(self):
        if self.resource_type == "Encounter":
            return self.fhir_id
        
        encounter_ref = None
        if "encounter" in self.resource and isinstance(self.resource["encounter"], dict):
            encounter_ref = self.resource["encounter"].get("reference", "")
        elif "context" in self.resource and isinstance(self.resource["context"], dict):
            # For older FHIR versions
            encounter_ref = self.resource["context"].get("reference", "")
        
        if encounter_ref and encounter_ref.startswith("Encounter/"):
            return encounter_ref.replace("Encounter/", "")
        
        return None
    
    def __repr__(self):
        return f"<FHIRResource {self.resource_type}/{self.fhir_id}>"


# Create specific resource type aliases for easier querying
class ConditionResource(FHIRResource):
    """Proxy for Condition resources"""
    @classmethod
    def query_by_type(cls, session):
        return session.query(FHIRResource).filter(
            FHIRResource.resource_type == "Condition",
            FHIRResource.deleted == False
        )

class AllergyIntoleranceResource(FHIRResource):
    """Proxy for AllergyIntolerance resources"""
    @classmethod
    def query_by_type(cls, session):
        return session.query(FHIRResource).filter(
            FHIRResource.resource_type == "AllergyIntolerance",
            FHIRResource.deleted == False
        )

class ImmunizationResource(FHIRResource):
    """Proxy for Immunization resources"""
    @classmethod
    def query_by_type(cls, session):
        return session.query(FHIRResource).filter(
            FHIRResource.resource_type == "Immunization",
            FHIRResource.deleted == False
        )

class ProcedureResource(FHIRResource):
    """Proxy for Procedure resources"""
    @classmethod
    def query_by_type(cls, session):
        return session.query(FHIRResource).filter(
            FHIRResource.resource_type == "Procedure",
            FHIRResource.deleted == False
        )

class CarePlanResource(FHIRResource):
    """Proxy for CarePlan resources"""
    @classmethod
    def query_by_type(cls, session):
        return session.query(FHIRResource).filter(
            FHIRResource.resource_type == "CarePlan",
            FHIRResource.deleted == False
        )

# Create aliases for easier use
Condition = ConditionResource
AllergyIntolerance = AllergyIntoleranceResource
Immunization = ImmunizationResource
Procedure = ProcedureResource
CarePlan = CarePlanResource