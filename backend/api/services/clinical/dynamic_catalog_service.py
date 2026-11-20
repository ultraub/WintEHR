"""
Dynamic Catalog Service - HAPI FHIR Migration
Extracts and builds catalogs from actual patient FHIR data using fhirclient
"""

import asyncio
import json
import os
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)

# HAPI caps a search page at 500 entries whatever _count asks for.
PAGE_SIZE = 500
# Upper bound on resources read per catalog scan. A scan is sequential
# offset paging sorted by _id, so past this the catalog is a deterministic
# sample rather than the whole store.
MAX_SCAN_RESOURCES = int(os.getenv("CATALOG_SCAN_MAX_RESOURCES", "100000"))
CACHE_TTL_SECONDS = 3600
# A scan holds this lock so the other uvicorn workers don't run the same one.
SCAN_LOCK_SECONDS = 900
REDIS_URL = os.getenv("REDIS_URL")


@dataclass
class _CatalogEntry:
    items: List[Dict[str, Any]]
    complete: bool  # False = built from the first page only; a scan is filling it in
    built_at: float  # wall clock, so it compares across processes

    @property
    def fresh(self) -> bool:
        return (time.time() - self.built_at) < CACHE_TTL_SECONDS


# Process-wide, not per-instance: a DynamicCatalogService is constructed per
# request, so an instance-level cache was never hit and every catalog request
# re-read (only) the first page from HAPI. The backend runs several uvicorn
# workers, so completed scans are also published to Redis (when REDIS_URL is
# set and reachable) and one worker's scan serves all of them.
_CACHE: Dict[str, _CatalogEntry] = {}
_SCANS: Dict[str, Tuple[asyncio.AbstractEventLoop, asyncio.Task]] = {}
_redis_client = None
_redis_failed = False


def _redis():
    """Shared Redis client, or None when Redis is not configured/reachable."""
    global _redis_client, _redis_failed
    if _redis_client is None and REDIS_URL and not _redis_failed:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(REDIS_URL, socket_timeout=2, socket_connect_timeout=2)
        except Exception as e:
            logger.warning(f"Catalog cache: Redis unavailable, using per-process cache only ({e})")
            _redis_failed = True
    return _redis_client


async def _redis_get(name: str) -> Optional[_CatalogEntry]:
    r = _redis()
    if r is None:
        return None
    try:
        raw = await r.get(f"catalog:{name}")
    except Exception as e:
        logger.warning(f"Catalog cache: Redis read failed ({e})")
        return None
    if not raw:
        return None
    data = json.loads(raw)
    return _CatalogEntry(data["items"], True, data["built_at"])


async def _redis_put(name: str, entry: _CatalogEntry) -> None:
    r = _redis()
    if r is None:
        return
    try:
        # Kept twice the TTL so an expired catalog is still served stale
        # while the rescan runs.
        await r.set(f"catalog:{name}", json.dumps({"items": entry.items, "built_at": entry.built_at}),
                    ex=CACHE_TTL_SECONDS * 2)
    except Exception as e:
        logger.warning(f"Catalog cache: Redis write failed ({e})")


async def _redis_lock(name: str) -> bool:
    """True if this worker should scan; False if another worker already is."""
    r = _redis()
    if r is None:
        return True
    try:
        return bool(await r.set(f"catalog:scan:{name}", "1", nx=True, ex=SCAN_LOCK_SECONDS))
    except Exception as e:
        logger.warning(f"Catalog cache: Redis lock failed ({e})")
        return True


async def _redis_unlock(name: str) -> None:
    r = _redis()
    if r is None:
        return
    try:
        await r.delete(f"catalog:scan:{name}")
    except Exception:
        pass


def _count_codings(
    entries: List[Dict[str, Any]], field: str, unknown: str
) -> List[Tuple[str, Dict[str, Any]]]:
    """Aggregate `resource[field].coding[0]` across bundle entries.

    Returns (code, {display, system, count}) in first-seen order.
    """
    codes: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        concept = entry.get('resource', {}).get(field) or {}
        codings = concept.get('coding') or []
        if not codings:
            continue
        coding = codings[0]
        code = coding.get('code')
        if not code:
            continue
        data = codes.setdefault(code, {'display': None, 'system': None, 'count': 0})
        data['display'] = coding.get('display') or concept.get('text') or unknown
        data['system'] = coding.get('system')
        data['count'] += 1
    return list(codes.items())


def _build_medications(entries):
    medications = [{
        "id": f"med_{code}",
        "code": code,
        "display": data['display'],
        "system": data['system'] or "http://www.nlm.nih.gov/research/umls/rxnorm",
        "frequency_count": data['count'],
        "source": "patient_data"
    } for code, data in _count_codings(entries, 'medicationCodeableConcept', "Unknown medication")]
    medications.sort(key=lambda x: x['frequency_count'], reverse=True)
    return medications


def _build_conditions(entries):
    conditions = [{
        "id": f"cond_{code}",
        "code": code,
        "display": data['display'],
        "system": data['system'] or "http://snomed.info/sct",
        "frequency_count": data['count'],
        "source": "patient_data"
    } for code, data in _count_codings(entries, 'code', "Unknown condition")]
    conditions.sort(key=lambda x: x['frequency_count'], reverse=True)
    return conditions


def _build_lab_tests(entries):
    lab_tests = [{
        "id": f"lab_{code}",
        "name": code,
        "display": data['display'],
        "loinc_code": code,
        "category": "laboratory",
        # No specimen type: this extraction reads Observation codes
        # only (_elements=code), which never state the specimen. It
        # used to hardcode "blood" for every test — wrong for urine,
        # CSF, swab, and stool studies, and a training platform must
        # not teach a specimen it did not observe.
        "specimen_type": None,
        "frequency_count": data['count'],
        "source": "patient_data"
    } for code, data in _count_codings(entries, 'code', "Unknown lab test")]
    lab_tests.sort(key=lambda x: x['frequency_count'], reverse=True)
    return lab_tests


def _build_procedures(entries):
    procedures = [{
        "id": f"proc_{code}",
        "code": code,
        "display": data['display'],
        "system": data['system'] or "http://snomed.info/sct",
        "frequency_count": data['count'],
        "source": "patient_data"
    } for code, data in _count_codings(entries, 'code', "Unknown procedure")]
    procedures.sort(key=lambda x: x['frequency_count'], reverse=True)
    return procedures


def _build_vaccines(entries):
    vaccines = [{
        "id": f"vax_{code}",
        "vaccine_code": code,
        "vaccine_name": data['display'],
        "cvx_code": code,
        "usage_count": data['count'],
        "source": "patient_data"
    } for code, data in _count_codings(entries, 'vaccineCode', "Unknown vaccine")]
    vaccines.sort(key=lambda x: x['usage_count'], reverse=True)
    return vaccines


def _build_allergies(entries):
    allergies = []
    for code, data in _count_codings(entries, 'code', "Unknown allergen"):
        # Determine allergen type from system
        system = data['system'] or ""
        is_medication = "rxnorm" in system.lower()
        allergy = {
            "id": f"allergy_{code}",
            "allergen_code": code,
            "allergen_name": data['display'],
            "allergen_type": "medication" if is_medication else "other",
            "system": data['system'],
            "usage_count": data['count'],
            "source": "patient_data"
        }
        if is_medication:
            allergy["rxnorm_code"] = code
        allergies.append(allergy)
    allergies.sort(key=lambda x: x['usage_count'], reverse=True)
    return allergies


def _build_imaging(entries):
    """One catalog row per study type.

    Synthea ImagingStudy resources carry no top-level `description` or
    `modality`; what they have is `procedureCode` plus `series[].modality`
    and `series[].bodySite`. Reading only the top-level fields collapsed
    every study into a single "Unknown Study" row. Top-level fields still
    win when a server does populate them.
    """
    studies: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        resource = entry.get('resource', {})
        procedure = (resource.get('procedureCode') or [{}])[0]
        coding = (procedure.get('coding') or [{}])[0]
        series = (resource.get('series') or [{}])[0]

        modality = (
            ((resource.get('modality') or [{}])[0]).get('code')
            or (series.get('modality') or {}).get('code')
            or 'Unknown'
        )
        display = (
            resource.get('description')
            or coding.get('display')
            or procedure.get('text')
            or f"{modality} Study"
        )
        key = coding.get('code') or display

        data = studies.setdefault(key, {
            'display': display,
            'modality': modality,
            'body_site': (series.get('bodySite') or {}).get('display'),
            'count': 0,
        })
        data['count'] += 1

    imaging_studies = [{
        "id": f"img_{i}",
        "code": key,
        "display": data['display'],
        "modality": data['modality'],
        "body_site": data['body_site'],
        "frequency_count": data['count'],
        "source": "patient_data"
    } for i, (key, data) in enumerate(studies.items())]
    imaging_studies.sort(key=lambda x: x['frequency_count'], reverse=True)
    return imaging_studies


def _build_order_sets(entries):
    order_sets = []
    for entry in entries:
        resource = entry.get('resource', {})
        order_sets.append({
            "id": resource.get('id', f"os_{len(order_sets)}"),
            "title": resource.get('title', 'Unnamed Order Set'),
            "description": resource.get('description', ''),
            "status": resource.get('status', 'unknown'),
            "source": "patient_data"
        })
    return order_sets


# catalog name -> (resource type, search params, builder). `_elements` keeps
# the payload to the fields the builder reads.
_SOURCES: Dict[str, Tuple[str, Dict[str, str], Callable]] = {
    "medications": ("MedicationRequest", {"_elements": "medicationCodeableConcept"}, _build_medications),
    "conditions": ("Condition", {"_elements": "code"}, _build_conditions),
    "lab_tests": ("Observation", {"category": "laboratory", "_elements": "code"}, _build_lab_tests),
    "procedures": ("Procedure", {"_elements": "code"}, _build_procedures),
    "vaccines": ("Immunization", {"_elements": "vaccineCode"}, _build_vaccines),
    "allergies": ("AllergyIntolerance", {"_elements": "code"}, _build_allergies),
    "imaging": ("ImagingStudy", {"_elements": "procedureCode,series,modality,description"}, _build_imaging),
    "order_sets": ("PlanDefinition", {"type": "order-set", "_elements": "title,description,status"}, _build_order_sets),
}


class DynamicCatalogService:
    """
    Service to extract and build catalogs from actual patient FHIR data using fhirclient.

    Provides dynamic catalogs for:
    - Medications (from MedicationRequest/MedicationStatement)
    - Conditions (from Condition resources)
    - Lab Tests (from Observation resources with category=laboratory)
    - Procedures (from Procedure resources)
    - Imaging (from ImagingStudy and DiagnosticReport)
    - Vaccines (from Immunization resources)
    - Allergies (from AllergyIntolerance resources)
    - Order Sets (from CarePlan and PlanDefinition)

    Catalogs are built from ALL matching resources, not the first search
    page. The first request after startup answers from page one and starts
    a background scan; once that lands, every request gets the full catalog
    from the cache until it expires (then it is served stale while a rescan
    runs). The cache is per process, mirrored in Redis when available so
    the uvicorn workers share one scan.
    """

    def __init__(self):
        self.last_refresh = None

    async def _fetch_page(self, name: str, offset: int) -> List[Dict[str, Any]]:
        resource_type, params, _ = _SOURCES[name]
        bundle = await HAPIFHIRClient().search(resource_type, {
            **params,
            "_count": str(PAGE_SIZE),
            # Offset paging needs a stable order; HAPI's default is not one.
            "_sort": "_id",
            "_offset": str(offset),
        })
        return bundle.get('entry', [])

    async def _scan(self, name: str) -> List[Dict[str, Any]]:
        """Read every page for a catalog and replace its cache entry."""
        entries: List[Dict[str, Any]] = []
        offset = 0
        while offset < MAX_SCAN_RESOURCES:
            page = await self._fetch_page(name, offset)
            entries.extend(page)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
        else:
            logger.warning(
                f"{name} catalog scan stopped at {MAX_SCAN_RESOURCES} resources "
                "(CATALOG_SCAN_MAX_RESOURCES); catalog is a sample"
            )
        items = _SOURCES[name][2](entries)
        entry = _CACHE[name] = _CatalogEntry(items, True, time.time())
        await _redis_put(name, entry)
        logger.info(f"{name} catalog: {len(items)} entries from {len(entries)} resources")
        return items

    def _ensure_scan(self, name: str) -> None:
        loop = asyncio.get_running_loop()
        running = _SCANS.get(name)
        if running and running[0] is loop and not running[1].done():
            return

        async def run():
            if not await _redis_lock(name):
                return  # another worker's scan will land in Redis
            try:
                await self._scan(name)
            except Exception as e:
                # Keep serving whatever is cached; the next request retries.
                logger.error(f"{name} catalog scan failed: {e}")
            finally:
                await _redis_unlock(name)

        _SCANS[name] = (loop, loop.create_task(run()))

    async def _catalog(self, name: str, limit: Optional[int]) -> List[Dict[str, Any]]:
        entry = _CACHE.get(name)
        if entry is None or not (entry.complete and entry.fresh):
            # Another worker may have finished a scan since we last looked.
            shared = await _redis_get(name)
            if shared and (entry is None or shared.built_at > entry.built_at):
                entry = _CACHE[name] = shared
        if entry is None:
            try:
                page = await self._fetch_page(name, 0)
            except Exception as e:
                logger.error(f"Error extracting {name} catalog: {e}")
                return []
            complete = len(page) < PAGE_SIZE
            entry = _CACHE[name] = _CatalogEntry(_SOURCES[name][2](page), complete, time.time())
        if not (entry.complete and entry.fresh):
            self._ensure_scan(name)
        return entry.items[:limit] if limit else list(entry.items)

    async def extract_medication_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Medication catalog from MedicationRequest resources, most used first."""
        return await self._catalog("medications", limit)

    async def extract_condition_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Condition catalog from Condition resources, most used first."""
        return await self._catalog("conditions", limit)

    async def extract_lab_test_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Lab test catalog from Observation resources with category=laboratory."""
        return await self._catalog("lab_tests", limit)

    async def extract_procedure_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Procedure catalog from Procedure resources, most used first."""
        return await self._catalog("procedures", limit)

    async def extract_vaccine_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Vaccine catalog from Immunization resources, most used first."""
        return await self._catalog("vaccines", limit)

    async def extract_allergy_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Allergen catalog from AllergyIntolerance resources, most used first."""
        return await self._catalog("allergies", limit)

    async def extract_imaging_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Imaging study-type catalog from ImagingStudy resources, most used first."""
        return await self._catalog("imaging", limit)

    async def extract_order_set_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Order set catalog from PlanDefinition resources of type order-set."""
        return await self._catalog("order_sets", limit)

    async def get_catalog_statistics(self) -> Dict[str, Any]:
        """Get statistics about the extracted catalogs using HAPIFHIRClient."""
        logger.info("Generating catalog statistics from HAPI FHIR")

        hapi_client = HAPIFHIRClient()

        # Get resource counts by searching with _summary=count
        resource_types = ['Patient', 'MedicationRequest', 'MedicationStatement',
                         'Condition', 'Observation', 'Procedure']

        resource_counts = {}
        for resource_type in resource_types:
            try:
                # Search with _summary=count to get just the total (efficient)
                bundle = await hapi_client.search(resource_type, {'_summary': 'count'})
                resource_counts[resource_type] = bundle.get('total', 0)
            except Exception as e:
                logger.warning(f"Could not get count for {resource_type}: {e}")
                resource_counts[resource_type] = 0

        # Get lab observation count specifically
        lab_count = 0
        try:
            bundle = await hapi_client.search('Observation', {
                'category': 'laboratory',
                '_summary': 'count'
            })
            lab_count = bundle.get('total', 0)
        except Exception as e:
            logger.warning(f"Could not get lab observation count: {e}")

        statistics = {
            "resource_counts": resource_counts,
            "laboratory_observations": lab_count,
            "last_refresh": self.last_refresh,
            "cache_status": {
                "cached_catalogs": sorted(_CACHE.keys()),
                "complete_catalogs": sorted(k for k, v in _CACHE.items() if v.complete),
                "cache_timeout": CACHE_TTL_SECONDS
            }
        }

        return statistics

    async def refresh_all_catalogs(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """Rescan every catalog in full and return a summary."""
        logger.info("Refreshing all dynamic catalogs from HAPI FHIR")

        counts = {}
        for name in _SOURCES:
            try:
                counts[name] = len(await self._scan(name))
            except Exception as e:
                logger.error(f"Error refreshing {name} catalog: {e}")
                counts[name] = len(_CACHE[name].items) if name in _CACHE else 0
        statistics = await self.get_catalog_statistics()

        self.last_refresh = datetime.now()

        summary = {
            "refresh_time": self.last_refresh.isoformat(),
            "catalog_counts": counts,
            "statistics": statistics
        }

        logger.info(f"Catalog refresh complete: {summary['catalog_counts']}")
        return summary

    async def clear_cache(self) -> None:
        """Clear cached results in this process and in Redis."""
        _CACHE.clear()
        r = _redis()
        if r is not None:
            try:
                await r.delete(*[f"catalog:{name}" for name in _SOURCES])
            except Exception as e:
                logger.warning(f"Catalog cache: Redis clear failed ({e})")
        logger.info("Dynamic catalog cache cleared")
