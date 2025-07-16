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
    CatalogSearchResult
)

logger = logging.getLogger(__name__)


class UnifiedCatalogService:
    """Service that unifies all catalog sources"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.dynamic_service = DynamicCatalogService(db)
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
        """Search lab tests across all sources"""
        results = []
        
        # 1. Try dynamic FHIR catalog
        try:
            dynamic_tests = await self.dynamic_service.extract_lab_test_catalog(limit)
            if search_term:
                dynamic_tests = [
                    test for test in dynamic_tests
                    if search_term.lower() in test.get('display', '').lower()
                ]
            
            for test in dynamic_tests[:limit]:
                results.append(LabTestCatalogItem(
                    id=test.get('code', ''),
                    test_name=test.get('display', ''),
                    test_code=test.get('code', ''),
                    loinc_code=test.get('code'),
                    reference_range=test.get('reference_range'),
                    usage_count=test.get('frequency', 0)
                ))
        except Exception as e:
            logger.warning(f"Dynamic lab catalog failed: {e}")
        
        # 2. Database fallback
        if len(results) < limit:
            try:
                query = select(LabTestCatalog).where(LabTestCatalog.is_active == True)
                if search_term:
                    search_pattern = f"%{search_term}%"
                    query = query.where(
                        or_(
                            LabTestCatalog.test_name.ilike(search_pattern),
                            LabTestCatalog.test_code.ilike(search_pattern)
                        )
                    )
                query = query.limit(limit - len(results))
                
                result = await self.db.execute(query)
                db_tests = result.scalars().all()
                
                for test in db_tests:
                    results.append(LabTestCatalogItem(
                        id=test.id,
                        test_name=test.test_name,
                        test_code=test.test_code,
                        test_description=test.test_description,
                        specimen_type=test.specimen_type,
                        loinc_code=test.loinc_code,
                        fasting_required=test.fasting_required,
                        special_instructions=test.special_instructions,
                        turnaround_time=test.turnaround_time
                    ))
            except Exception as e:
                logger.warning(f"Database lab catalog failed: {e}")
        
        # 3. Static fallback
        if len(results) < limit:
            static_tests = self._static_catalogs.get('lab_tests', [])
            if search_term:
                static_tests = [
                    test for test in static_tests
                    if search_term.lower() in test.get('test_name', '').lower()
                ]
            
            for test in static_tests[:limit - len(results)]:
                results.append(LabTestCatalogItem(
                    id=test.get('id', ''),
                    test_name=test.get('test_name', ''),
                    test_code=test.get('test_code', ''),
                    test_description=test.get('test_description'),
                    specimen_type=test.get('specimen_type'),
                    loinc_code=test.get('loinc_code'),
                    fasting_required=test.get('fasting_required', False),
                    special_instructions=test.get('special_instructions')
                ))
        
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
    
    async def search_all_catalogs(
        self,
        search_term: str,
        limit_per_type: int = 10
    ) -> CatalogSearchResult:
        """Search across all catalog types"""
        medications = await self.search_medications(search_term, limit_per_type)
        lab_tests = await self.search_lab_tests(search_term, limit_per_type)
        conditions = await self.search_conditions(search_term, limit_per_type)
        
        # TODO: Implement imaging studies and order sets
        
        return CatalogSearchResult(
            medications=medications,
            lab_tests=lab_tests,
            conditions=conditions,
            imaging_studies=[],
            order_sets=[],
            total_results=len(medications) + len(lab_tests) + len(conditions)
        )