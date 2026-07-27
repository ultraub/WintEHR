"""
Catalog data models
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class MedicationCatalogItem(BaseModel):
    """Medication catalog item.

    Fields are Optional because the catalog is built from the FHIR data
    actually present, and most of these facts are NOT in it: the dynamic
    extractor reads MedicationRequest codes (`_elements=code`) and the
    terminology path returns {system, code, display}. Neither carries
    strength, form, route, drug class, formulary status, or scheduling.

    They are therefore None = UNKNOWN, never asserted. The booleans below
    used to default to `is_formulary=True`, `is_controlled_substance=False`,
    `requires_authorization=False` — claims no data supported, which in a
    platform that teaches pharmacy workflows would have taught students
    that (say) oxycodone is not a controlled substance. If a real source
    for these appears (a formulary file, an RxNorm attribute load), populate
    them there; do not re-add asserted defaults.
    """
    id: str
    generic_name: str
    brand_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    route: Optional[str] = None
    drug_class: Optional[str] = None
    frequency_options: Optional[List[str]] = []
    standard_doses: Optional[List[str]] = []
    rxnorm_code: Optional[str] = None
    is_controlled_substance: Optional[bool] = None
    requires_authorization: Optional[bool] = None
    is_formulary: Optional[bool] = None
    usage_count: Optional[int] = None  # From dynamic extraction
    common_dosages: Optional[List[Dict[str, Any]]] = None  # From dynamic extraction


class LabTestCatalogItem(BaseModel):
    """Lab test catalog item. Unknown facts are None, not asserted —
    see MedicationCatalogItem for the rationale."""
    id: str
    test_name: str
    test_code: str
    test_description: Optional[str] = None
    specimen_type: Optional[str] = None
    loinc_code: Optional[str] = None
    fasting_required: Optional[bool] = None
    special_instructions: Optional[str] = None
    turnaround_time: Optional[str] = None
    reference_range: Optional[Dict[str, Any]] = None  # From dynamic extraction
    usage_count: Optional[int] = None  # From dynamic extraction


class ImagingStudyCatalogItem(BaseModel):
    """Imaging study catalog item. Unknown facts are None, not asserted —
    see MedicationCatalogItem for the rationale."""
    id: str
    study_name: str
    study_code: str
    study_description: Optional[str] = None
    modality: str
    body_site: Optional[str] = None
    contrast_required: Optional[bool] = None
    prep_instructions: Optional[str] = None
    duration_minutes: Optional[int] = None
    radiation_dose: Optional[str] = None
    usage_count: Optional[int] = None  # From dynamic extraction


class ConditionCatalogItem(BaseModel):
    """Condition/diagnosis catalog item. Unknown facts are None, not
    asserted — see MedicationCatalogItem for the rationale."""
    id: str
    display_name: str
    icd10_code: Optional[str] = None
    snomed_code: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    chronic: Optional[bool] = None
    usage_count: Optional[int] = None  # From dynamic extraction
    common_medications: Optional[List[str]] = None  # From dynamic extraction


class OrderSetItem(BaseModel):
    """Order set catalog item model"""
    id: str
    name: str
    description: Optional[str] = None
    category: str
    specialty: Optional[str] = None
    items: List[Dict[str, Any]] = []
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProcedureCatalogItem(BaseModel):
    """Procedure catalog item model"""
    id: str
    procedure_name: str
    procedure_code: str
    procedure_description: Optional[str] = None
    cpt_code: Optional[str] = None
    snomed_code: Optional[str] = None
    category: Optional[str] = None
    typical_duration: Optional[int] = None  # in minutes
    requires_anesthesia: bool = False
    usage_count: Optional[int] = None  # From dynamic extraction


class VaccineCatalogItem(BaseModel):
    """Vaccine/Immunization catalog item model"""
    id: str
    vaccine_name: str
    vaccine_code: str
    cvx_code: Optional[str] = None  # CDC vaccine code
    manufacturer: Optional[str] = None
    series_doses: Optional[int] = None
    min_age_months: Optional[int] = None
    max_age_months: Optional[int] = None
    route: Optional[str] = None
    site: Optional[str] = None
    contraindications: Optional[List[str]] = []
    usage_count: Optional[int] = None  # From dynamic extraction


class AllergyCatalogItem(BaseModel):
    """Allergy catalog item model"""
    id: str
    allergen_name: str
    allergen_code: Optional[str] = None
    allergen_type: str  # medication, food, environmental, etc.
    rxnorm_code: Optional[str] = None  # for medication allergies
    snomed_code: Optional[str] = None
    common_reactions: Optional[List[str]] = []
    severity_levels: Optional[List[str]] = []
    usage_count: Optional[int] = None  # From dynamic extraction


class CatalogSearchResult(BaseModel):
    """Unified catalog search result"""
    medications: List[MedicationCatalogItem] = []
    lab_tests: List[LabTestCatalogItem] = []
    imaging_studies: List[ImagingStudyCatalogItem] = []
    conditions: List[ConditionCatalogItem] = []
    order_sets: List[OrderSetItem] = []
    procedures: Optional[List[ProcedureCatalogItem]] = []
    vaccines: Optional[List[VaccineCatalogItem]] = []
    allergies: Optional[List[AllergyCatalogItem]] = []
    total_results: int = 0