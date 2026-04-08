"""
Terminology Service — FHIR ValueSet $expand wrapper for catalog search.

Provides vocabulary search across HAPI FHIR-loaded ValueSets (SNOMED, RxNorm,
LOINC, ICD-10-CM, CVX, HCPCS, etc.) with in-memory caching.

Used by UnifiedCatalogService to provide comprehensive vocabulary coverage
beyond what exists in patient data.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

# ValueSet IDs loaded by scripts/load_terminology.py
CATALOG_VALUESETS = {
    "medications": "wintehr-medications",
    "medication_ingredients": "wintehr-medication-ingredients",
    "conditions_snomed": "wintehr-conditions-snomed",
    "conditions_icd10": "wintehr-conditions-icd10",
    "lab_tests": "wintehr-lab-tests",
    "procedures_snomed": "wintehr-procedures-snomed",
    "procedures_hcpcs": "wintehr-procedures-hcpcs",
    "vaccines": "wintehr-vaccines",
    "units": "wintehr-units",
    "drug_classes": "wintehr-drug-classes",
}

CACHE_TTL_SECONDS = 600  # 10 minutes


class TerminologyService:
    """Wraps HAPI FHIR $expand for vocabulary search with caching."""

    def __init__(self):
        self.hapi_client = HAPIFHIRClient()
        self.hapi_client.timeout = 60.0
        self._cache: Dict[str, Tuple[datetime, List[Dict[str, str]]]] = {}
        self._cache_ttl = timedelta(seconds=CACHE_TTL_SECONDS)

    def _get_cached(self, key: str) -> Optional[List[Dict[str, str]]]:
        entry = self._cache.get(key)
        if entry and (datetime.now() - entry[0]) < self._cache_ttl:
            return entry[1]
        return None

    def _set_cache(self, key: str, value: List[Dict[str, str]]):
        self._cache[key] = (datetime.now(), value)

    async def expand_valueset(
        self,
        valueset_id: str,
        filter_text: Optional[str] = None,
        count: int = 50,
    ) -> List[Dict[str, str]]:
        """
        Expand a ValueSet, optionally filtered by text.
        Returns list of {system, code, display}.
        """
        cache_key = f"{valueset_id}:{filter_text or ''}:{count}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        params = {"count": str(count)}
        if filter_text:
            params["filter"] = filter_text

        try:
            result = await self.hapi_client.operation(
                f"ValueSet/{valueset_id}/$expand", params=params
            )
            concepts = [
                {
                    "system": item.get("system", ""),
                    "code": item.get("code", ""),
                    "display": item.get("display", ""),
                }
                for item in result.get("expansion", {}).get("contains", [])
            ]
            self._set_cache(cache_key, concepts)
            return concepts
        except Exception as e:
            logger.warning(f"$expand failed for {valueset_id}: {e}")
            return []

    async def search_catalog(
        self,
        catalog_type: str,
        filter_text: Optional[str] = None,
        count: int = 50,
    ) -> List[Dict[str, str]]:
        """Search a catalog domain via the corresponding ValueSet."""
        valueset_id = CATALOG_VALUESETS.get(catalog_type)
        if not valueset_id:
            return []
        return await self.expand_valueset(valueset_id, filter_text, count)

    async def search_multi(
        self,
        catalog_types: List[str],
        filter_text: Optional[str] = None,
        count: int = 50,
    ) -> Dict[str, List[Dict[str, str]]]:
        """Search multiple catalog domains concurrently."""
        tasks = {
            ct: self.search_catalog(ct, filter_text, count)
            for ct in catalog_types
        }
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        out = {}
        for ct, result in zip(tasks.keys(), results):
            if isinstance(result, Exception):
                logger.warning(f"Terminology search failed for {ct}: {result}")
                out[ct] = []
            else:
                out[ct] = result
        return out


_terminology_service: Optional[TerminologyService] = None


def get_terminology_service() -> TerminologyService:
    global _terminology_service
    if _terminology_service is None:
        _terminology_service = TerminologyService()
    return _terminology_service
