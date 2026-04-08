"""
Unified Catalog Service

Combines terminology ValueSets, dynamic FHIR patient data, and static fallbacks
into a single service with intelligent merging and deduplication.

Priority: Dynamic patient data (frequency-ranked) + Terminology $expand (comprehensive),
with static fallbacks only when both sources fail.
"""

import asyncio
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import json
import os

from api.services.clinical.dynamic_catalog_service import DynamicCatalogService
from services.terminology_service import get_terminology_service
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

# FHIR system URIs for identifying code origin
SNOMED_SYSTEM = "http://snomed.info/sct"
ICD10CM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm"
HCPCS_SYSTEM = "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets"


class UnifiedCatalogService:
    """Service that unifies terminology, dynamic patient data, and static catalogs."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.dynamic_service = DynamicCatalogService()
        self.terminology = get_terminology_service()
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

    # ------------------------------------------------------------------
    # Medications
    # ------------------------------------------------------------------

    async def search_medications(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[MedicationCatalogItem]:
        """Search medications: dynamic patient data + RxNorm terminology."""
        results = []
        seen_codes: set = set()

        # Concurrent: dynamic patient data + terminology $expand
        dynamic_meds, term_meds = await self._gather_sources(
            self._dynamic_medications(search_term, limit),
            self.terminology.search_catalog("medications", search_term, limit) if search_term else self._empty(),
        )

        # Dynamic first (frequency-ranked)
        for med in dynamic_meds:
            code = med.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(MedicationCatalogItem(
                    id=code,
                    generic_name=med.get('display', ''),
                    brand_name=med.get('brand_name'),
                    strength=med.get('strength'),
                    dosage_form=med.get('form'),
                    route=med.get('route'),
                    rxnorm_code=code,
                    usage_count=med.get('frequency', med.get('frequency_count', 0)),
                    common_dosages=med.get('dosages', [])
                ))

        # Backfill from terminology
        for concept in term_meds:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(MedicationCatalogItem(
                    id=code,
                    generic_name=concept.get('display', ''),
                    rxnorm_code=code,
                    usage_count=0,
                ))

        # Static fallback only if both sources empty
        if not results:
            results = self._static_medication_fallback(search_term, limit)

        return results[:limit]

    async def _dynamic_medications(self, search_term, limit):
        try:
            meds = await self.dynamic_service.extract_medication_catalog(limit)
            if search_term:
                meds = [m for m in meds if search_term.lower() in m.get('display', '').lower()]
            return meds
        except Exception as e:
            logger.warning(f"Dynamic medication catalog failed: {e}")
            return []

    def _static_medication_fallback(self, search_term, limit):
        results = []
        static_meds = self._static_catalogs.get('medications', [])
        if search_term:
            static_meds = [
                m for m in static_meds
                if search_term.lower() in m.get('generic_name', '').lower()
                or search_term.lower() in m.get('brand_name', '').lower()
            ]
        for med in static_meds[:limit]:
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

    # ------------------------------------------------------------------
    # Lab Tests
    # ------------------------------------------------------------------

    async def search_lab_tests(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[LabTestCatalogItem]:
        """Search lab tests: dynamic patient data + LOINC terminology."""
        results = []
        seen_codes: set = set()

        dynamic_tests, term_tests = await self._gather_sources(
            self._dynamic_lab_tests(search_term, limit),
            self.terminology.search_catalog("lab_tests", search_term, limit) if search_term else self._empty(),
        )

        for test in dynamic_tests:
            code = test.get('loinc_code', test.get('code', ''))
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(LabTestCatalogItem(
                    id=test.get('id', code),
                    test_name=test.get('display', ''),
                    test_code=code,
                    loinc_code=code,
                    reference_range=test.get('reference_range'),
                    usage_count=test.get('frequency_count', 0),
                    specimen_type=test.get('specimen_type', 'blood')
                ))

        for concept in term_tests:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(LabTestCatalogItem(
                    id=code,
                    test_name=concept.get('display', ''),
                    test_code=code,
                    loinc_code=code,
                    usage_count=0,
                ))

        return results[:limit]

    async def _dynamic_lab_tests(self, search_term, limit):
        try:
            tests = await self.dynamic_service.extract_lab_test_catalog(limit)
            if search_term:
                tests = [t for t in tests if search_term.lower() in t.get('display', '').lower()]
            return tests
        except Exception as e:
            logger.warning(f"Dynamic lab catalog failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Conditions
    # ------------------------------------------------------------------

    async def search_conditions(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[ConditionCatalogItem]:
        """Search conditions: dynamic + SNOMED + ICD-10-CM terminology."""
        results = []
        seen_codes: set = set()

        if search_term:
            dynamic_conds, term_results = await self._gather_sources(
                self._dynamic_conditions(search_term, limit),
                self.terminology.search_multi(
                    ["conditions_snomed", "conditions_icd10"], search_term, limit
                ),
            )
            term_snomed = term_results.get("conditions_snomed", []) if isinstance(term_results, dict) else []
            term_icd10 = term_results.get("conditions_icd10", []) if isinstance(term_results, dict) else []
        else:
            dynamic_conds = await self._dynamic_conditions(search_term, limit)
            term_snomed, term_icd10 = [], []

        # Dynamic first
        for cond in dynamic_conds:
            code = cond.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(ConditionCatalogItem(
                    id=code,
                    display_name=cond.get('display', ''),
                    icd10_code=cond.get('icd10_code'),
                    snomed_code=cond.get('snomed_code'),
                    category=cond.get('category'),
                    chronic=cond.get('chronic', False),
                    usage_count=cond.get('usage_count', 0),
                    common_medications=cond.get('common_medications', [])
                ))

        # SNOMED conditions
        for concept in term_snomed:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(ConditionCatalogItem(
                    id=code,
                    display_name=concept.get('display', ''),
                    snomed_code=code,
                    usage_count=0,
                ))

        # ICD-10-CM conditions
        for concept in term_icd10:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(ConditionCatalogItem(
                    id=code,
                    display_name=concept.get('display', ''),
                    icd10_code=code,
                    usage_count=0,
                ))

        # Static fallback
        if not results:
            results = self._static_condition_fallback(search_term, limit)

        return results[:limit]

    async def _dynamic_conditions(self, search_term, limit):
        try:
            conds = await self.dynamic_service.extract_condition_catalog(limit)
            if search_term:
                conds = [c for c in conds if search_term.lower() in c.get('display', '').lower()]
            return conds
        except Exception as e:
            logger.warning(f"Dynamic condition catalog failed: {e}")
            return []

    def _static_condition_fallback(self, search_term, limit):
        static_conditions = [
            {"id": "E11.9", "display_name": "Type 2 diabetes mellitus without complications", "icd10_code": "E11.9", "category": "Endocrine", "chronic": True},
            {"id": "I10", "display_name": "Essential (primary) hypertension", "icd10_code": "I10", "category": "Cardiovascular", "chronic": True},
            {"id": "J45.909", "display_name": "Unspecified asthma, uncomplicated", "icd10_code": "J45.909", "category": "Respiratory", "chronic": True},
            {"id": "K21.9", "display_name": "Gastro-esophageal reflux disease without esophagitis", "icd10_code": "K21.9", "category": "Gastrointestinal", "chronic": True},
            {"id": "M25.561", "display_name": "Pain in right knee", "icd10_code": "M25.561", "category": "Musculoskeletal", "chronic": False},
        ]
        if search_term:
            static_conditions = [c for c in static_conditions if search_term.lower() in c['display_name'].lower()]
        return [
            ConditionCatalogItem(
                id=c['id'], display_name=c['display_name'], icd10_code=c.get('icd10_code'),
                category=c.get('category'), chronic=c.get('chronic', False)
            )
            for c in static_conditions[:limit]
        ]

    # ------------------------------------------------------------------
    # Procedures
    # ------------------------------------------------------------------

    async def search_procedures(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[ProcedureCatalogItem]:
        """Search procedures: dynamic + SNOMED + HCPCS terminology."""
        results = []
        seen_codes: set = set()

        if search_term:
            dynamic_procs, term_results = await self._gather_sources(
                self._dynamic_procedures(search_term, limit),
                self.terminology.search_multi(
                    ["procedures_snomed", "procedures_hcpcs"], search_term, limit
                ),
            )
            term_snomed = term_results.get("procedures_snomed", []) if isinstance(term_results, dict) else []
            term_hcpcs = term_results.get("procedures_hcpcs", []) if isinstance(term_results, dict) else []
        else:
            dynamic_procs = await self._dynamic_procedures(search_term, limit)
            term_snomed, term_hcpcs = [], []

        for proc in dynamic_procs:
            code = proc.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(ProcedureCatalogItem(
                    id=proc.get('id', code),
                    procedure_name=proc.get('display', ''),
                    procedure_code=code,
                    cpt_code=code if proc.get('system', '').endswith('cpt') else None,
                    snomed_code=code if proc.get('system', '').endswith('sct') else None,
                    category=proc.get('categories', [''])[0] if proc.get('categories') else None,
                    usage_count=proc.get('frequency_count', 0)
                ))

        for concept in term_snomed:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(ProcedureCatalogItem(
                    id=code,
                    procedure_name=concept.get('display', ''),
                    procedure_code=code,
                    snomed_code=code,
                    usage_count=0,
                ))

        for concept in term_hcpcs:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(ProcedureCatalogItem(
                    id=code,
                    procedure_name=concept.get('display', ''),
                    procedure_code=code,
                    usage_count=0,
                ))

        # Static fallback
        if not results:
            results = self._static_procedure_fallback(search_term, limit)

        return results[:limit]

    async def _dynamic_procedures(self, search_term, limit):
        try:
            procs = await self.dynamic_service.extract_procedure_catalog(limit)
            if search_term:
                procs = [p for p in procs
                         if search_term.lower() in p.get('display', '').lower()
                         or search_term.lower() in p.get('code', '').lower()]
            return procs
        except Exception as e:
            logger.warning(f"Dynamic procedure catalog failed: {e}")
            return []

    def _static_procedure_fallback(self, search_term, limit):
        static = [
            {"id": "proc_99213", "procedure_name": "Office visit, established patient, level 3", "procedure_code": "99213", "cpt_code": "99213", "category": "Evaluation and Management", "typical_duration": 15},
            {"id": "proc_99214", "procedure_name": "Office visit, established patient, level 4", "procedure_code": "99214", "cpt_code": "99214", "category": "Evaluation and Management", "typical_duration": 25},
            {"id": "proc_36415", "procedure_name": "Venipuncture", "procedure_code": "36415", "cpt_code": "36415", "category": "Laboratory", "typical_duration": 5},
            {"id": "proc_93000", "procedure_name": "Electrocardiogram, 12-lead", "procedure_code": "93000", "cpt_code": "93000", "category": "Cardiology", "typical_duration": 10},
        ]
        if search_term:
            static = [p for p in static if search_term.lower() in p['procedure_name'].lower()]
        return [
            ProcedureCatalogItem(
                id=p['id'], procedure_name=p['procedure_name'], procedure_code=p['procedure_code'],
                cpt_code=p.get('cpt_code'), category=p.get('category'),
                typical_duration=p.get('typical_duration')
            )
            for p in static[:limit]
        ]

    # ------------------------------------------------------------------
    # Vaccines
    # ------------------------------------------------------------------

    async def search_vaccines(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[VaccineCatalogItem]:
        """Search vaccines: dynamic + CVX terminology."""
        results = []
        seen_codes: set = set()

        dynamic_vax, term_vax = await self._gather_sources(
            self._dynamic_vaccines(search_term, limit),
            self.terminology.search_catalog("vaccines", search_term, limit) if search_term else self._empty(),
        )

        for vax in dynamic_vax:
            code = vax.get('cvx_code', vax.get('vaccine_code', ''))
            if code and code not in seen_codes:
                seen_codes.add(code)
                route = vax.get('common_routes', [''])[0] if vax.get('common_routes') else None
                site = vax.get('common_sites', [''])[0] if vax.get('common_sites') else None
                results.append(VaccineCatalogItem(
                    id=vax.get('id', code),
                    vaccine_name=vax.get('vaccine_name', ''),
                    vaccine_code=code,
                    cvx_code=code,
                    manufacturer=vax.get('manufacturer'),
                    route=route,
                    site=site,
                    usage_count=vax.get('usage_count', 0)
                ))

        for concept in term_vax:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(VaccineCatalogItem(
                    id=code,
                    vaccine_name=concept.get('display', ''),
                    vaccine_code=code,
                    cvx_code=code,
                    usage_count=0,
                ))

        # Static fallback
        if not results:
            results = self._static_vaccine_fallback(search_term, limit)

        return results[:limit]

    async def _dynamic_vaccines(self, search_term, limit):
        try:
            vax = await self.dynamic_service.extract_vaccine_catalog(limit)
            if search_term:
                vax = [v for v in vax
                       if search_term.lower() in v.get('vaccine_name', '').lower()
                       or search_term.lower() in v.get('cvx_code', '').lower()]
            return vax
        except Exception as e:
            logger.warning(f"Dynamic vaccine catalog failed: {e}")
            return []

    def _static_vaccine_fallback(self, search_term, limit):
        static = [
            {"id": "vax_150", "vaccine_name": "Influenza, seasonal, injectable", "vaccine_code": "150", "cvx_code": "150", "route": "Intramuscular", "site": "Deltoid"},
            {"id": "vax_208", "vaccine_name": "COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose", "vaccine_code": "208", "cvx_code": "208", "route": "Intramuscular", "site": "Deltoid"},
            {"id": "vax_115", "vaccine_name": "Tdap", "vaccine_code": "115", "cvx_code": "115", "route": "Intramuscular", "site": "Deltoid"},
            {"id": "vax_03", "vaccine_name": "MMR", "vaccine_code": "03", "cvx_code": "03", "route": "Subcutaneous", "site": "Upper arm"},
        ]
        if search_term:
            static = [v for v in static if search_term.lower() in v['vaccine_name'].lower()]
        return [
            VaccineCatalogItem(
                id=v['id'], vaccine_name=v['vaccine_name'], vaccine_code=v['vaccine_code'],
                cvx_code=v.get('cvx_code'), route=v.get('route'), site=v.get('site')
            )
            for v in static[:limit]
        ]

    # ------------------------------------------------------------------
    # Allergies
    # ------------------------------------------------------------------

    async def search_allergies(
        self,
        search_term: Optional[str] = None,
        allergen_type: Optional[str] = None,
        limit: int = 50
    ) -> List[AllergyCatalogItem]:
        """Search allergies: dynamic + RxNorm ingredients for medication allergies."""
        results = []
        seen_codes: set = set()

        # Only search terminology for medication allergies (RxNorm ingredients)
        use_terminology = search_term and (not allergen_type or allergen_type.lower() == "medication")

        dynamic_allergies, term_allergies = await self._gather_sources(
            self._dynamic_allergies(search_term, allergen_type, limit),
            self.terminology.search_catalog("medication_ingredients", search_term, limit) if use_terminology else self._empty(),
        )

        for allergy in dynamic_allergies:
            code = allergy.get('allergen_code', allergy.get('id', ''))
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(AllergyCatalogItem(
                    id=allergy.get('id', code),
                    allergen_name=allergy.get('allergen_name', ''),
                    allergen_code=allergy.get('allergen_code'),
                    allergen_type=allergy.get('allergen_type', 'other'),
                    rxnorm_code=allergy.get('rxnorm_code'),
                    snomed_code=allergy.get('allergen_code') if allergy.get('system', '').endswith('sct') else None,
                    common_reactions=allergy.get('common_reactions', []),
                    severity_levels=allergy.get('criticality_levels', []),
                    usage_count=allergy.get('usage_count', 0)
                ))

        for concept in term_allergies:
            code = concept.get('code', '')
            if code and code not in seen_codes:
                seen_codes.add(code)
                results.append(AllergyCatalogItem(
                    id=code,
                    allergen_name=concept.get('display', ''),
                    allergen_code=code,
                    allergen_type='medication',
                    rxnorm_code=code,
                    usage_count=0,
                ))

        # Static fallback
        if not results:
            results = self._static_allergy_fallback(search_term, allergen_type, limit)

        return results[:limit]

    async def _dynamic_allergies(self, search_term, allergen_type, limit):
        try:
            allergies = await self.dynamic_service.extract_allergy_catalog(limit)
            if search_term:
                allergies = [a for a in allergies if search_term.lower() in a.get('allergen_name', '').lower()]
            if allergen_type:
                allergies = [a for a in allergies if allergen_type.lower() == a.get('allergen_type', '').lower()]
            return allergies
        except Exception as e:
            logger.warning(f"Dynamic allergy catalog failed: {e}")
            return []

    def _static_allergy_fallback(self, search_term, allergen_type, limit):
        static = [
            {"id": "allergy_penicillin", "allergen_name": "Penicillin", "allergen_type": "medication", "rxnorm_code": "7980", "common_reactions": ["Rash", "Hives", "Anaphylaxis"], "severity_levels": ["mild", "moderate", "severe"]},
            {"id": "allergy_sulfa", "allergen_name": "Sulfa drugs", "allergen_type": "medication", "rxnorm_code": "10831", "common_reactions": ["Rash", "Stevens-Johnson syndrome"], "severity_levels": ["mild", "severe"]},
            {"id": "allergy_peanut", "allergen_name": "Peanut", "allergen_type": "food", "common_reactions": ["Hives", "Swelling", "Anaphylaxis"], "severity_levels": ["mild", "moderate", "severe"]},
            {"id": "allergy_latex", "allergen_name": "Latex", "allergen_type": "environmental", "common_reactions": ["Contact dermatitis", "Respiratory symptoms"], "severity_levels": ["mild", "moderate"]},
        ]
        if search_term:
            static = [a for a in static if search_term.lower() in a['allergen_name'].lower()]
        if allergen_type:
            static = [a for a in static if allergen_type.lower() == a['allergen_type'].lower()]
        return [
            AllergyCatalogItem(
                id=a['id'], allergen_name=a['allergen_name'], allergen_type=a['allergen_type'],
                rxnorm_code=a.get('rxnorm_code'), common_reactions=a.get('common_reactions', []),
                severity_levels=a.get('severity_levels', [])
            )
            for a in static[:limit]
        ]

    # ------------------------------------------------------------------
    # Imaging Studies (no terminology ValueSet — dynamic + static only)
    # ------------------------------------------------------------------

    async def search_imaging_studies(
        self,
        search_term: Optional[str] = None,
        limit: int = 50
    ) -> List[ImagingStudyCatalogItem]:
        """Search imaging studies. No terminology ValueSet — uses dynamic + static."""
        results = []

        try:
            imaging_studies = await self.dynamic_service.extract_imaging_catalog(limit)
            if search_term:
                imaging_studies = [
                    s for s in imaging_studies
                    if search_term.lower() in s.get('display', '').lower()
                    or search_term.lower() in s.get('modality', '').lower()
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
                    usage_count=study.get('frequency_count', study.get('usage_count', 0))
                ))
        except Exception as e:
            logger.warning(f"Dynamic imaging catalog failed: {e}")

        if len(results) < limit:
            static_studies = [
                {"id": "71020", "display_name": "Chest X-ray, 2 views", "modality": "CR", "body_site": "Chest", "typical_duration": 15, "contrast_required": False},
                {"id": "70450", "display_name": "CT Head without contrast", "modality": "CT", "body_site": "Head", "typical_duration": 30, "contrast_required": False},
                {"id": "70553", "display_name": "MRI Brain with and without contrast", "modality": "MR", "body_site": "Brain", "typical_duration": 60, "contrast_required": True},
                {"id": "74177", "display_name": "CT Abdomen and Pelvis with contrast", "modality": "CT", "body_site": "Abdomen/Pelvis", "typical_duration": 45, "contrast_required": True},
                {"id": "93306", "display_name": "Echocardiogram, complete", "modality": "US", "body_site": "Heart", "typical_duration": 45, "contrast_required": False},
            ]
            if search_term:
                static_studies = [
                    s for s in static_studies
                    if search_term.lower() in s['display_name'].lower()
                    or search_term.lower() in s['modality'].lower()
                    or search_term.lower() in s.get('body_site', '').lower()
                ]
            for study in static_studies[:limit - len(results)]:
                results.append(ImagingStudyCatalogItem(
                    id=study['id'], display_name=study['display_name'],
                    modality=study['modality'], body_site=study.get('body_site'),
                    typical_duration=study.get('typical_duration'),
                    contrast_required=study.get('contrast_required', False)
                ))

        return results

    # ------------------------------------------------------------------
    # Order Sets (no terminology ValueSet — dynamic + static only)
    # ------------------------------------------------------------------

    async def search_order_sets(
        self,
        search_term: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[OrderSetItem]:
        """Search order sets. No terminology ValueSet — uses dynamic + static."""
        results = []

        try:
            order_sets = await self.dynamic_service.extract_order_set_catalog(limit)
            if search_term:
                order_sets = [
                    os for os in order_sets
                    if search_term.lower() in os.get('title', os.get('name', '')).lower()
                    or search_term.lower() in os.get('description', '').lower()
                    or any(search_term.lower() in item.get('display', '').lower() for item in os.get('items', []))
                ]
            if category:
                order_sets = [os for os in order_sets if category.lower() == os.get('category', '').lower()]

            for order_set in order_sets[:limit]:
                results.append(OrderSetItem(
                    id=order_set.get('id', ''),
                    name=order_set.get('title', order_set.get('name', '')),
                    description=order_set.get('description'),
                    category=order_set.get('category', 'Clinical'),
                    specialty=order_set.get('specialty'),
                    items=order_set.get('items', []),
                    is_active=order_set.get('is_active', True),
                ))
        except Exception as e:
            logger.warning(f"Dynamic order set catalog failed: {e}")

        if len(results) < limit:
            static_order_sets = [
                {"id": "os_admit_general", "name": "General Admission Orders", "description": "Standard admission order set for general medical patients", "category": "Admission",
                 "items": [{"type": "Vital Signs", "display": "Vital signs q4h", "code": "VS001"}, {"type": "Lab", "display": "CBC with differential", "code": "LAB001"}, {"type": "Lab", "display": "Basic metabolic panel", "code": "LAB002"}, {"type": "Diet", "display": "Regular diet", "code": "DIET001"}, {"type": "Activity", "display": "Activity as tolerated", "code": "ACT001"}]},
                {"id": "os_chest_pain", "name": "Chest Pain Protocol", "description": "Standard orders for chest pain evaluation", "category": "Emergency",
                 "items": [{"type": "EKG", "display": "12-lead EKG STAT", "code": "EKG001"}, {"type": "Lab", "display": "Troponin I", "code": "LAB010"}, {"type": "Lab", "display": "CK-MB", "code": "LAB011"}, {"type": "Imaging", "display": "Chest X-ray PA and lateral", "code": "IMG001"}, {"type": "Medication", "display": "Aspirin 325mg PO", "code": "MED001"}, {"type": "Medication", "display": "Nitroglycerin 0.4mg SL PRN", "code": "MED002"}]},
                {"id": "os_preop", "name": "Pre-operative Orders", "description": "Standard pre-operative preparation orders", "category": "Surgical",
                 "items": [{"type": "Lab", "display": "CBC", "code": "LAB001"}, {"type": "Lab", "display": "PT/PTT", "code": "LAB020"}, {"type": "Lab", "display": "Type and screen", "code": "LAB021"}, {"type": "NPO", "display": "NPO after midnight", "code": "NPO001"}, {"type": "Medication", "display": "Ancef 1g IV on call", "code": "MED010"}]},
                {"id": "os_diabetes", "name": "Diabetes Management", "description": "Standard orders for diabetic patients", "category": "Endocrine",
                 "items": [{"type": "Lab", "display": "Glucose fingerstick AC and HS", "code": "LAB030"}, {"type": "Lab", "display": "Hemoglobin A1C", "code": "LAB031"}, {"type": "Diet", "display": "1800 calorie ADA diet", "code": "DIET010"}, {"type": "Consult", "display": "Diabetes educator consult", "code": "CON001"}, {"type": "Medication", "display": "Insulin sliding scale", "code": "MED020"}]},
            ]
            filtered = static_order_sets
            if search_term:
                filtered = [os for os in filtered if search_term.lower() in os['name'].lower() or search_term.lower() in os.get('description', '').lower()]
            if category:
                filtered = [os for os in filtered if category.lower() == os['category'].lower()]
            for order_set in filtered[:limit - len(results)]:
                results.append(OrderSetItem(
                    id=order_set['id'], name=order_set['name'],
                    description=order_set.get('description'), category=order_set['category'],
                    specialty=order_set.get('specialty'), items=order_set['items'], is_active=True
                ))

        return results

    # ------------------------------------------------------------------
    # Unified search
    # ------------------------------------------------------------------

    async def search_all_catalogs(
        self,
        search_term: str,
        limit_per_type: int = 10
    ) -> CatalogSearchResult:
        """Search across all catalog types concurrently."""
        medications, lab_tests, conditions, imaging_studies, order_sets, procedures, vaccines, allergies = (
            await asyncio.gather(
                self.search_medications(search_term, limit_per_type),
                self.search_lab_tests(search_term, limit_per_type),
                self.search_conditions(search_term, limit_per_type),
                self.search_imaging_studies(search_term, limit_per_type),
                self.search_order_sets(search_term, None, limit_per_type),
                self.search_procedures(search_term, limit_per_type),
                self.search_vaccines(search_term, limit_per_type),
                self.search_allergies(search_term, None, limit_per_type),
            )
        )

        return CatalogSearchResult(
            medications=medications,
            lab_tests=lab_tests,
            conditions=conditions,
            imaging_studies=imaging_studies,
            order_sets=order_sets,
            procedures=procedures,
            vaccines=vaccines,
            allergies=allergies,
            total_results=(
                len(medications) + len(lab_tests) + len(conditions) +
                len(imaging_studies) + len(order_sets) + len(procedures) +
                len(vaccines) + len(allergies)
            )
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _gather_sources(self, *coros):
        """Run coroutines concurrently, returning [] for any that fail."""
        results = await asyncio.gather(*coros, return_exceptions=True)
        return tuple(
            r if not isinstance(r, Exception) else []
            for r in results
        )

    async def _empty(self):
        """Return empty list — used when terminology search is skipped."""
        return []
