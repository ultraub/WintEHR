"""
Unified Catalog Service

Combines dynamic FHIR catalogs, database catalogs, and static catalogs
into a single service with intelligent fallback.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
import logging
import json
import os

from api.services.clinical.dynamic_catalog_service import DynamicCatalogService
from models.clinical.catalogs import MedicationCatalog, LabTestCatalog, ImagingStudyCatalog, ClinicalOrderSet
from .models import (
    MedicationCatalogItem, 
    LabTestCatalogItem, 
    ImagingStudyCatalogItem,
    ConditionCatalogItem,
    OrderSetItem,
    ProcedureCatalogItem,
    VaccineCatalogItem,
    AllergyCatalogItem,
    CatalogSearchResult
)

logger = logging.getLogger(__name__)


class UnifiedCatalogService:
    """Service that unifies all catalog sources"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.dynamic_service = DynamicCatalogService()  # Fixed: DynamicCatalogService doesn't accept db parameter
        self._static_catalogs = self._load_static_catalogs()
    
    def _load_static_catalogs(self) -> Dict[str, Any]:
        """Load static catalog data from JSON files"""
        try:
            base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            catalogs_path = os.path.join(base_path, 'data', 'catalogs')
            
            catalogs = {}
            for catalog_type in ['medications', 'lab_tests', 'imaging_studies']:
                file_path = os.path.join(catalogs_path, f'{catalog_type}.json')
                if os.path.exists(file_path):
                    with open(file_path, 'r') as f:
                        catalogs[catalog_type] = json.load(f)
                else:
                    catalogs[catalog_type] = []
            
            return catalogs
        except Exception as e:
            logger.error(f"Error loading static catalogs: {e}")
            return {'medications': [], 'lab_tests': [], 'imaging_studies': []}
    
    async def search_medications(
        self, 
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[MedicationCatalogItem]:
        """
        Search medications across all sources.
        Priority: Dynamic FHIR > Database > Static
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            dynamic_meds = await self.dynamic_service.extract_medication_catalog(limit)
            logger.info(f"Dynamic medications found: {len(dynamic_meds)}")
            if dynamic_meds:
                logger.info(f"Sample medication: {dynamic_meds[0]}")
            
            if search_term:
                dynamic_meds = [
                    med for med in dynamic_meds
                    if search_term.lower() in med.get('display', '').lower()
                ]
                logger.info(f"After search filter: {len(dynamic_meds)}")
            
            for med in dynamic_meds[:limit]:
                results.append(MedicationCatalogItem(
                    id=med.get('code', ''),
                    generic_name=med.get('display', ''),
                    brand_name=med.get('brand_name'),
                    strength=med.get('strength'),
                    dosage_form=med.get('form'),
                    route=med.get('route'),
                    rxnorm_code=med.get('code'),
                    usage_count=med.get('frequency', 0),
                    common_dosages=med.get('dosages', [])
                ))
        except Exception as e:
            logger.warning(f"Dynamic catalog failed: {e}")
        
        # 2. If not enough results, try database
        if len(results) < limit:
            try:
                query = select(MedicationCatalog).where(MedicationCatalog.is_active == True)
                if search_term:
                    search_pattern = f"%{search_term}%"
                    query = query.where(
                        or_(
                            MedicationCatalog.generic_name.ilike(search_pattern),
                            MedicationCatalog.brand_name.ilike(search_pattern)
                        )
                    )
                query = query.limit(limit - len(results))
                
                result = await self.db.execute(query)
                db_meds = result.scalars().all()
                
                for med in db_meds:
                    results.append(MedicationCatalogItem(
                        id=med.id,
                        generic_name=med.generic_name,
                        brand_name=med.brand_name,
                        strength=med.strength,
                        dosage_form=med.dosage_form,
                        route=med.route,
                        drug_class=med.drug_class,
                        frequency_options=med.frequency_options or [],
                        standard_doses=med.standard_doses or [],
                        is_controlled_substance=med.is_controlled_substance,
                        requires_authorization=med.requires_authorization,
                        is_formulary=med.is_formulary
                    ))
            except Exception as e:
                logger.warning(f"Database catalog failed: {e}")
        
        # 3. If still not enough, use static catalog
        if len(results) < limit:
            static_meds = self._static_catalogs.get('medications', [])
            if search_term:
                static_meds = [
                    med for med in static_meds
                    if search_term.lower() in med.get('generic_name', '').lower()
                    or search_term.lower() in med.get('brand_name', '').lower()
                ]
            
            for med in static_meds[:limit - len(results)]:
                results.append(MedicationCatalogItem(
                    id=med.get('id', ''),
                    generic_name=med.get('generic_name', ''),
                    brand_name=med.get('brand_name'),
                    strength=med.get('strength'),
                    dosage_form=med.get('dosage_form'),
                    route=med.get('route'),
                    frequency_options=med.get('frequency_options', []),
                    rxnorm_code=med.get('rxnorm_code')
                ))
        
        return results
    
    async def search_lab_tests(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[LabTestCatalogItem]:
        """
        Search lab tests from dynamic FHIR catalog only (no hardcoded fallbacks).
        Returns empty array if no patient data exists - this is by design.

        Uses FHIR-standard _elements parameter for efficient catalog extraction.
        """
        results = []

        # Dynamic FHIR catalog - reads from actual patient data
        try:
            dynamic_tests = await self.dynamic_service.extract_lab_test_catalog(limit)
            logger.info(f"Retrieved {len(dynamic_tests)} lab tests from FHIR catalog")

            if search_term:
                dynamic_tests = [
                    test for test in dynamic_tests
                    if search_term.lower() in test.get('display', '').lower()
                ]
                logger.debug(f"Filtered to {len(dynamic_tests)} tests matching '{search_term}'")

            for test in dynamic_tests[:limit]:
                results.append(LabTestCatalogItem(
                    id=test.get('id', ''),
                    test_name=test.get('display', ''),
                    test_code=test.get('loinc_code', ''),
                    loinc_code=test.get('loinc_code'),
                    reference_range=test.get('reference_range'),
                    usage_count=test.get('frequency_count', 0),
                    specimen_type=test.get('specimen_type', 'blood')
                ))

        except Exception as e:
            logger.error(f"Dynamic lab catalog failed: {e}", exc_info=True)

        return results
    
    async def search_conditions(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[ConditionCatalogItem]:
        """
        Search conditions/diagnoses across all sources.
        Priority: Dynamic FHIR > Database > Static
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            # Extract conditions from actual patient data
            conditions = await self.dynamic_service.extract_condition_catalog(limit)
            if search_term:
                conditions = [
                    cond for cond in conditions
                    if search_term.lower() in cond.get('display', '').lower()
                ]
            
            for cond in conditions[:limit]:
                results.append(ConditionCatalogItem(
                    id=cond.get('code', ''),
                    display_name=cond.get('display', ''),
                    icd10_code=cond.get('icd10_code'),
                    snomed_code=cond.get('snomed_code'),
                    category=cond.get('category'),
                    chronic=cond.get('chronic', False),
                    usage_count=cond.get('usage_count', 0),
                    common_medications=cond.get('common_medications', [])
                ))
        except Exception as e:
            logger.warning(f"Dynamic condition catalog failed: {e}")
        
        # 2. Static fallback with common conditions
        if len(results) < limit:
            # Common conditions as fallback
            static_conditions = [
                {
                    "id": "E11.9",
                    "display_name": "Type 2 diabetes mellitus without complications",
                    "icd10_code": "E11.9",
                    "category": "Endocrine",
                    "chronic": True
                },
                {
                    "id": "I10",
                    "display_name": "Essential (primary) hypertension",
                    "icd10_code": "I10",
                    "category": "Cardiovascular",
                    "chronic": True
                },
                {
                    "id": "J45.909",
                    "display_name": "Unspecified asthma, uncomplicated",
                    "icd10_code": "J45.909",
                    "category": "Respiratory",
                    "chronic": True
                },
                {
                    "id": "K21.9",
                    "display_name": "Gastro-esophageal reflux disease without esophagitis",
                    "icd10_code": "K21.9",
                    "category": "Gastrointestinal",
                    "chronic": True
                },
                {
                    "id": "M25.561",
                    "display_name": "Pain in right knee",
                    "icd10_code": "M25.561",
                    "category": "Musculoskeletal",
                    "chronic": False
                }
            ]
            
            if search_term:
                static_conditions = [
                    cond for cond in static_conditions
                    if search_term.lower() in cond.get('display_name', '').lower()
                ]
            
            for cond in static_conditions[:limit - len(results)]:
                results.append(ConditionCatalogItem(
                    id=cond.get('id', ''),
                    display_name=cond.get('display_name', ''),
                    icd10_code=cond.get('icd10_code'),
                    snomed_code=cond.get('snomed_code'),
                    category=cond.get('category'),
                    chronic=cond.get('chronic', False)
                ))
        
        return results
    
    async def search_imaging_studies(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[ImagingStudyCatalogItem]:
        """
        Search imaging studies across all sources.
        Priority: Dynamic FHIR > Static catalog
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            # Extract imaging studies from actual patient data
            imaging_studies = await self.dynamic_service.extract_imaging_catalog(limit)
            if search_term:
                imaging_studies = [
                    study for study in imaging_studies
                    if search_term.lower() in study.get('display', '').lower() or
                    search_term.lower() in study.get('modality', '').lower()
                ]
            
            for study in imaging_studies[:limit]:
                results.append(ImagingStudyCatalogItem(
                    id=study.get('code', ''),
                    study_name=study.get('display', ''),
                    study_code=study.get('code', ''),
                    study_description=study.get('description'),
                    modality=study.get('modality', ''),
                    body_site=study.get('body_site'),
                    contrast_required=study.get('contrast_required', False),
                    prep_instructions=study.get('preparation_instructions'),
                    duration_minutes=study.get('typical_duration'),
                    radiation_dose=study.get('radiation_dose'),
                    usage_count=study.get('usage_count', 0)
                ))
        except Exception as e:
            logger.warning(f"Dynamic imaging catalog failed: {e}")
        
        # 2. Static fallback with common imaging procedures
        if len(results) < limit:
            static_studies = [
                {
                    "id": "71020",
                    "display_name": "Chest X-ray, 2 views",
                    "modality": "CR",
                    "body_site": "Chest",
                    "cpt_code": "71020",
                    "typical_duration": 15,
                    "preparation_required": False,
                    "contrast_required": False
                },
                {
                    "id": "70450",
                    "display_name": "CT Head without contrast",
                    "modality": "CT",
                    "body_site": "Head",
                    "cpt_code": "70450",
                    "typical_duration": 30,
                    "preparation_required": False,
                    "contrast_required": False
                },
                {
                    "id": "70553",
                    "display_name": "MRI Brain with and without contrast",
                    "modality": "MR",
                    "body_site": "Brain",
                    "cpt_code": "70553",
                    "typical_duration": 60,
                    "preparation_required": True,
                    "contrast_required": True
                },
                {
                    "id": "74177",
                    "display_name": "CT Abdomen and Pelvis with contrast",
                    "modality": "CT",
                    "body_site": "Abdomen/Pelvis",
                    "cpt_code": "74177",
                    "typical_duration": 45,
                    "preparation_required": True,
                    "contrast_required": True
                },
                {
                    "id": "93306",
                    "display_name": "Echocardiogram, complete",
                    "modality": "US",
                    "body_site": "Heart",
                    "cpt_code": "93306",
                    "typical_duration": 45,
                    "preparation_required": False,
                    "contrast_required": False
                }
            ]
            
            if search_term:
                static_studies = [
                    study for study in static_studies
                    if search_term.lower() in study['display_name'].lower() or
                    search_term.lower() in study['modality'].lower() or
                    search_term.lower() in study.get('body_site', '').lower()
                ]
            
            for study in static_studies[:limit - len(results)]:
                results.append(ImagingStudyCatalogItem(
                    id=study['id'],
                    display_name=study['display_name'],
                    modality=study['modality'],
                    body_site=study.get('body_site'),
                    cpt_code=study.get('cpt_code'),
                    typical_duration=study.get('typical_duration'),
                    preparation_required=study.get('preparation_required', False),
                    contrast_required=study.get('contrast_required', False)
                ))
        
        return results
    
    async def search_order_sets(
        self,
        search_term: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[OrderSetItem]:
        """
        Search order sets across all sources.
        Priority: Dynamic FHIR data > Database > Static catalog
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            # Extract order sets from actual patient data
            order_sets = await self.dynamic_service.extract_order_set_catalog(limit)
            
            # Filter by search term
            if search_term:
                order_sets = [
                    os for os in order_sets
                    if search_term.lower() in os.get('name', '').lower() or
                    search_term.lower() in os.get('description', '').lower() or
                    any(search_term.lower() in item.get('display', '').lower() 
                        for item in os.get('items', []))
                ]
            
            # Filter by category
            if category:
                order_sets = [
                    os for os in order_sets
                    if category.lower() == os.get('category', '').lower()
                ]
            
            for order_set in order_sets[:limit]:
                results.append(OrderSetItem(
                    id=order_set.get('id', ''),
                    name=order_set.get('name', ''),
                    description=order_set.get('description'),
                    category=order_set.get('category', 'Clinical'),
                    specialty=order_set.get('specialty'),
                    items=order_set.get('items', []),
                    is_active=order_set.get('is_active', True),
                    created_at=None,  # Dynamic sets don't have creation dates
                    updated_at=None
                ))
        except Exception as e:
            logger.warning(f"Dynamic order set catalog failed: {e}")
        
        # 2. If not enough results, use static fallback
        if len(results) < limit:
            # Common order sets as fallback
            static_order_sets = [
                {
                    "id": "os_admit_general",
                    "name": "General Admission Orders",
                    "description": "Standard admission order set for general medical patients",
                    "category": "Admission",
                    "items": [
                        {"type": "Vital Signs", "display": "Vital signs q4h", "code": "VS001"},
                        {"type": "Lab", "display": "CBC with differential", "code": "LAB001"},
                        {"type": "Lab", "display": "Basic metabolic panel", "code": "LAB002"},
                        {"type": "Diet", "display": "Regular diet", "code": "DIET001"},
                        {"type": "Activity", "display": "Activity as tolerated", "code": "ACT001"}
                    ]
                },
                {
                    "id": "os_chest_pain",
                    "name": "Chest Pain Protocol",
                    "description": "Standard orders for chest pain evaluation",
                    "category": "Emergency",
                    "items": [
                        {"type": "EKG", "display": "12-lead EKG STAT", "code": "EKG001"},
                        {"type": "Lab", "display": "Troponin I", "code": "LAB010"},
                        {"type": "Lab", "display": "CK-MB", "code": "LAB011"},
                        {"type": "Imaging", "display": "Chest X-ray PA and lateral", "code": "IMG001"},
                        {"type": "Medication", "display": "Aspirin 325mg PO", "code": "MED001"},
                        {"type": "Medication", "display": "Nitroglycerin 0.4mg SL PRN", "code": "MED002"}
                    ]
                },
                {
                    "id": "os_preop",
                    "name": "Pre-operative Orders",
                    "description": "Standard pre-operative preparation orders",
                    "category": "Surgical",
                    "items": [
                        {"type": "Lab", "display": "CBC", "code": "LAB001"},
                        {"type": "Lab", "display": "PT/PTT", "code": "LAB020"},
                        {"type": "Lab", "display": "Type and screen", "code": "LAB021"},
                        {"type": "NPO", "display": "NPO after midnight", "code": "NPO001"},
                        {"type": "Medication", "display": "Ancef 1g IV on call", "code": "MED010"}
                    ]
                },
                {
                    "id": "os_diabetes",
                    "name": "Diabetes Management",
                    "description": "Standard orders for diabetic patients",
                    "category": "Endocrine",
                    "items": [
                        {"type": "Lab", "display": "Glucose fingerstick AC and HS", "code": "LAB030"},
                        {"type": "Lab", "display": "Hemoglobin A1C", "code": "LAB031"},
                        {"type": "Diet", "display": "1800 calorie ADA diet", "code": "DIET010"},
                        {"type": "Consult", "display": "Diabetes educator consult", "code": "CON001"},
                        {"type": "Medication", "display": "Insulin sliding scale", "code": "MED020"}
                    ]
                }
            ]
            
            # Filter static sets
            filtered_static = static_order_sets
            if search_term:
                filtered_static = [
                    os for os in filtered_static
                    if search_term.lower() in os['name'].lower() or
                    search_term.lower() in os.get('description', '').lower()
                ]
            if category:
                filtered_static = [
                    os for os in filtered_static
                    if category.lower() == os['category'].lower()
                ]
            
            for order_set in filtered_static[:limit - len(results)]:
                results.append(OrderSetItem(
                    id=order_set['id'],
                    name=order_set['name'],
                    description=order_set.get('description'),
                    category=order_set['category'],
                    specialty=order_set.get('specialty'),
                    items=order_set['items'],
                    is_active=True
                ))
        
        return results
    
    async def search_procedures(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[ProcedureCatalogItem]:
        """
        Search procedure catalog.
        Priority: Dynamic FHIR data > Static catalog
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            procedures = await self.dynamic_service.extract_procedure_catalog(limit)
            if search_term:
                procedures = [
                    proc for proc in procedures
                    if search_term.lower() in proc.get('display', '').lower() or
                    search_term.lower() in proc.get('code', '').lower()
                ]
            
            for proc in procedures[:limit]:
                results.append(ProcedureCatalogItem(
                    id=proc.get('id', ''),
                    procedure_name=proc.get('display', ''),
                    procedure_code=proc.get('code', ''),
                    procedure_description=None,  # Could be enhanced
                    cpt_code=proc.get('code') if proc.get('system', '').endswith('cpt') else None,
                    snomed_code=proc.get('code') if proc.get('system', '').endswith('sct') else None,
                    category=proc.get('categories', [''])[0] if proc.get('categories') else None,
                    typical_duration=None,  # Could be calculated from data
                    requires_anesthesia=False,  # Could be inferred
                    usage_count=proc.get('frequency_count', 0)
                ))
        except Exception as e:
            logger.warning(f"Dynamic procedure catalog failed: {e}")
        
        # 2. Static fallback with common procedures
        if len(results) < limit:
            static_procedures = [
                {
                    "id": "proc_99213",
                    "procedure_name": "Office visit, established patient, level 3",
                    "procedure_code": "99213",
                    "cpt_code": "99213",
                    "category": "Evaluation and Management",
                    "typical_duration": 15
                },
                {
                    "id": "proc_99214",
                    "procedure_name": "Office visit, established patient, level 4",
                    "procedure_code": "99214",
                    "cpt_code": "99214",
                    "category": "Evaluation and Management",
                    "typical_duration": 25
                },
                {
                    "id": "proc_36415",
                    "procedure_name": "Venipuncture",
                    "procedure_code": "36415",
                    "cpt_code": "36415",
                    "category": "Laboratory",
                    "typical_duration": 5
                },
                {
                    "id": "proc_93000",
                    "procedure_name": "Electrocardiogram, 12-lead",
                    "procedure_code": "93000",
                    "cpt_code": "93000",
                    "category": "Cardiology",
                    "typical_duration": 10
                }
            ]
            
            if search_term:
                static_procedures = [
                    proc for proc in static_procedures
                    if search_term.lower() in proc['procedure_name'].lower()
                ]
            
            for proc in static_procedures[:limit - len(results)]:
                results.append(ProcedureCatalogItem(
                    id=proc['id'],
                    procedure_name=proc['procedure_name'],
                    procedure_code=proc['procedure_code'],
                    cpt_code=proc.get('cpt_code'),
                    snomed_code=proc.get('snomed_code'),
                    category=proc.get('category'),
                    typical_duration=proc.get('typical_duration'),
                    requires_anesthesia=proc.get('requires_anesthesia', False)
                ))
        
        return results
    
    async def search_vaccines(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[VaccineCatalogItem]:
        """
        Search vaccine/immunization catalog.
        Priority: Dynamic FHIR data > Static catalog
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            vaccines = await self.dynamic_service.extract_vaccine_catalog(limit)
            if search_term:
                vaccines = [
                    vax for vax in vaccines
                    if search_term.lower() in vax.get('vaccine_name', '').lower() or
                    search_term.lower() in vax.get('cvx_code', '').lower()
                ]
            
            for vax in vaccines[:limit]:
                # Extract route and site from common values
                route = vax.get('common_routes', [''])[0] if vax.get('common_routes') else None
                site = vax.get('common_sites', [''])[0] if vax.get('common_sites') else None
                
                results.append(VaccineCatalogItem(
                    id=vax.get('id', ''),
                    vaccine_name=vax.get('vaccine_name', ''),
                    vaccine_code=vax.get('vaccine_code', ''),
                    cvx_code=vax.get('cvx_code'),
                    manufacturer=vax.get('manufacturer'),
                    route=route,
                    site=site,
                    usage_count=vax.get('usage_count', 0)
                ))
        except Exception as e:
            logger.warning(f"Dynamic vaccine catalog failed: {e}")
        
        # 2. Static fallback with common vaccines
        if len(results) < limit:
            static_vaccines = [
                {
                    "id": "vax_150",
                    "vaccine_name": "Influenza, seasonal, injectable",
                    "vaccine_code": "150",
                    "cvx_code": "150",
                    "route": "Intramuscular",
                    "site": "Deltoid"
                },
                {
                    "id": "vax_208",
                    "vaccine_name": "COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose",
                    "vaccine_code": "208",
                    "cvx_code": "208",
                    "manufacturer": "Pfizer-BioNTech",
                    "route": "Intramuscular",
                    "site": "Deltoid"
                },
                {
                    "id": "vax_115",
                    "vaccine_name": "Tdap",
                    "vaccine_code": "115",
                    "cvx_code": "115",
                    "route": "Intramuscular",
                    "site": "Deltoid"
                },
                {
                    "id": "vax_03",
                    "vaccine_name": "MMR",
                    "vaccine_code": "03",
                    "cvx_code": "03",
                    "route": "Subcutaneous",
                    "site": "Upper arm"
                }
            ]
            
            if search_term:
                static_vaccines = [
                    vax for vax in static_vaccines
                    if search_term.lower() in vax['vaccine_name'].lower()
                ]
            
            for vax in static_vaccines[:limit - len(results)]:
                results.append(VaccineCatalogItem(
                    id=vax['id'],
                    vaccine_name=vax['vaccine_name'],
                    vaccine_code=vax['vaccine_code'],
                    cvx_code=vax.get('cvx_code'),
                    manufacturer=vax.get('manufacturer'),
                    route=vax.get('route'),
                    site=vax.get('site')
                ))
        
        return results
    
    async def search_allergies(
        self,
        search_term: Optional[str] = None,
        allergen_type: Optional[str] = None,
        limit: int = 50
    ) -> List[AllergyCatalogItem]:
        """
        Search allergy catalog.
        Priority: Dynamic FHIR data > Static catalog
        """
        results = []
        
        # 1. Try dynamic FHIR catalog first
        try:
            allergies = await self.dynamic_service.extract_allergy_catalog(limit)
            
            # Filter by search term
            if search_term:
                allergies = [
                    allergy for allergy in allergies
                    if search_term.lower() in allergy.get('allergen_name', '').lower()
                ]
            
            # Filter by allergen type
            if allergen_type:
                allergies = [
                    allergy for allergy in allergies
                    if allergen_type.lower() == allergy.get('allergen_type', '').lower()
                ]
            
            for allergy in allergies[:limit]:
                results.append(AllergyCatalogItem(
                    id=allergy.get('id', ''),
                    allergen_name=allergy.get('allergen_name', ''),
                    allergen_code=allergy.get('allergen_code'),
                    allergen_type=allergy.get('allergen_type', 'other'),
                    rxnorm_code=allergy.get('rxnorm_code'),
                    snomed_code=allergy.get('allergen_code') if allergy.get('system', '').endswith('sct') else None,
                    common_reactions=allergy.get('common_reactions', []),
                    severity_levels=allergy.get('criticality_levels', []),
                    usage_count=allergy.get('usage_count', 0)
                ))
        except Exception as e:
            logger.warning(f"Dynamic allergy catalog failed: {e}")
        
        # 2. Static fallback with common allergies
        if len(results) < limit:
            static_allergies = [
                {
                    "id": "allergy_penicillin",
                    "allergen_name": "Penicillin",
                    "allergen_type": "medication",
                    "rxnorm_code": "7980",
                    "common_reactions": ["Rash", "Hives", "Anaphylaxis"],
                    "severity_levels": ["mild", "moderate", "severe"]
                },
                {
                    "id": "allergy_sulfa",
                    "allergen_name": "Sulfa drugs",
                    "allergen_type": "medication",
                    "rxnorm_code": "10831",
                    "common_reactions": ["Rash", "Stevens-Johnson syndrome"],
                    "severity_levels": ["mild", "severe"]
                },
                {
                    "id": "allergy_peanut",
                    "allergen_name": "Peanut",
                    "allergen_type": "food",
                    "common_reactions": ["Hives", "Swelling", "Anaphylaxis"],
                    "severity_levels": ["mild", "moderate", "severe"]
                },
                {
                    "id": "allergy_latex",
                    "allergen_name": "Latex",
                    "allergen_type": "environmental",
                    "common_reactions": ["Contact dermatitis", "Respiratory symptoms"],
                    "severity_levels": ["mild", "moderate"]
                }
            ]
            
            # Filter static allergies
            filtered_static = static_allergies
            if search_term:
                filtered_static = [
                    allergy for allergy in filtered_static
                    if search_term.lower() in allergy['allergen_name'].lower()
                ]
            if allergen_type:
                filtered_static = [
                    allergy for allergy in filtered_static
                    if allergen_type.lower() == allergy['allergen_type'].lower()
                ]
            
            for allergy in filtered_static[:limit - len(results)]:
                results.append(AllergyCatalogItem(
                    id=allergy['id'],
                    allergen_name=allergy['allergen_name'],
                    allergen_code=allergy.get('allergen_code'),
                    allergen_type=allergy['allergen_type'],
                    rxnorm_code=allergy.get('rxnorm_code'),
                    snomed_code=allergy.get('snomed_code'),
                    common_reactions=allergy.get('common_reactions', []),
                    severity_levels=allergy.get('severity_levels', [])
                ))
        
        return results
    
    async def search_all_catalogs(
        self,
        search_term: str,
        limit_per_type: int = 10
    ) -> CatalogSearchResult:
        """Search across all catalog types"""
        medications = await self.search_medications(search_term, limit_per_type)
        lab_tests = await self.search_lab_tests(search_term, limit_per_type)
        conditions = await self.search_conditions(search_term, limit_per_type)
        imaging_studies = await self.search_imaging_studies(search_term, limit_per_type)
        order_sets = await self.search_order_sets(search_term, None, limit_per_type)
        
        return CatalogSearchResult(
            medications=medications,
            lab_tests=lab_tests,
            conditions=conditions,
            imaging_studies=imaging_studies,
            order_sets=order_sets,
            total_results=len(medications) + len(lab_tests) + len(conditions) + len(imaging_studies) + len(order_sets)
        )