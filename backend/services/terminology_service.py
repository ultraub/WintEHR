"""
Terminology Service — vocabulary search backend for catalog endpoints.

Two implementations live here:

  - `LocalTerminologyIndex` (preferred): SQLite + FTS5 index built from the
    JSON CodeSystems we extract from UMLS. Fast prefix-match search, no
    HAPI dependency.
  - `_HapiTerminologyService`: legacy `$expand` wrapper around HAPI's
    ValueSet expansion. Currently broken because HSearch is disabled —
    `$expand` against the wintehr-* ValueSets aborts with HAPI-0831
    ("produced too many codes"). Kept as a fallback so deploys without
    the index file built (dev environments, fresh restores) don't crash;
    they just degrade to dynamic-only catalog search.

`get_terminology_service()` picks the local index when
`/app/data/terminology.db` (or `$TERMINOLOGY_DB_PATH`) exists, falling
back to the HAPI implementation otherwise. `UnifiedCatalogService`
doesn't see the difference — both expose `search_catalog` and
`search_multi`.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from services.hapi_fhir_client import HAPIFHIRClient
from services.local_terminology_index import LocalTerminologyIndex

logger = logging.getLogger(__name__)

DEFAULT_TERMINOLOGY_DB_PATH = "/app/data/terminology.db"

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


class _HapiTerminologyService:
    """Wraps HAPI FHIR $expand for vocabulary search with caching.

    Fallback path. Currently degraded — `$expand` against the wintehr-*
    ValueSets returns HAPI-0831 / HAPI-0888 errors because HSearch is
    disabled. The catalog endpoints catch the empty result and fall back
    to dynamic-from-Synthea data, which is the "1 result for diabetes"
    behavior students see today. Use `LocalTerminologyIndex` instead
    when the SQLite index has been built (deploy.sh handles that).
    """

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


# Public type alias for the dependency-injection annotations in routers.
# Both backends expose the same `search_catalog` / `search_multi` interface;
# the type alias just keeps existing `Depends(get_terminology_service)`
# annotations valid without callers needing to know which is active.
TerminologyService = LocalTerminologyIndex  # alias for type annotations


_terminology_service = None


def get_terminology_service():
    """Return the preferred terminology backend.

    Picks LocalTerminologyIndex if `/app/data/terminology.db` (or the
    override at `$TERMINOLOGY_DB_PATH`) is present. Otherwise falls
    back to the HAPI-based implementation. The choice is sticky for
    the lifetime of the process — restart the backend after building
    the index to switch over.
    """
    global _terminology_service
    if _terminology_service is not None:
        return _terminology_service

    db_path = os.getenv("TERMINOLOGY_DB_PATH", DEFAULT_TERMINOLOGY_DB_PATH)
    if Path(db_path).exists():
        logger.info("Using LocalTerminologyIndex (db=%s)", db_path)
        _terminology_service = LocalTerminologyIndex(db_path)
    else:
        logger.warning(
            "Terminology index missing at %s; falling back to HAPI $expand "
            "(degraded — catalog search will return only dynamic-from-patient-data results)",
            db_path,
        )
        _terminology_service = _HapiTerminologyService()
    return _terminology_service
