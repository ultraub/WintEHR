"""
Dynamic Catalog Service - HAPI FHIR Migration
Extracts and builds catalogs from actual patient FHIR data using fhirclient
"""

import json
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from collections import defaultdict, Counter
import logging
from services.hapi_fhir_client import HAPIFHIRClient

logger = logging.getLogger(__name__)


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
    """

    def __init__(self):
        self.cache = {}
        self.cache_timeout = 3600  # 1 hour cache
        self.last_refresh = None

    async def extract_medication_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract medication catalog from MedicationRequest resources.

        Uses FHIR-standard _elements parameter for efficient minimal-payload retrieval.
        Works with ANY FHIR R4 compliant server (HAPI, Azure FHIR, AWS HealthLake, etc.)
        """
        cache_key = f"medications_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting medication catalog using FHIR-standard _elements parameter")

        hapi_client = HAPIFHIRClient()

        try:
            # FHIR-standard approach: Fetch only medicationCodeableConcept field (85-90% payload reduction)
            # Works on ANY FHIR R4 server, not HAPI-specific
            bundle = await hapi_client.search("MedicationRequest", {
                "_elements": "medicationCodeableConcept",
                "_count": "1000"
            })

            total_found = len(bundle.get('entry', []))
            logger.info(f"Found {total_found} medication requests (minimal payload)")

            # Aggregate codes from minimal payload (fast in-memory processing)
            code_map = defaultdict(lambda: {
                'code': None,
                'display': None,
                'system': None,
                'frequency_count': 0
            })

            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'medicationCodeableConcept' not in resource:
                    continue

                med_concept = resource['medicationCodeableConcept']
                if 'coding' not in med_concept or not med_concept['coding']:
                    continue

                coding = med_concept['coding'][0]
                code = coding.get('code')

                if code:
                    code_data = code_map[code]
                    code_data['code'] = code
                    code_data['display'] = coding.get('display') or med_concept.get('text') or "Unknown medication"
                    code_data['system'] = coding.get('system') or "http://www.nlm.nih.gov/research/umls/rxnorm"
                    code_data['frequency_count'] += 1

            logger.info(f"Aggregated {len(code_map)} distinct medication codes from {total_found} requests")

        except Exception as e:
            logger.error(f"Error extracting medication catalog: {e}")
            code_map = {}

        # Convert to list format
        medications = []
        for code, data in code_map.items():
            medications.append({
                "id": f"med_{code}" if code else f"med_{len(medications)}",
                "code": data['code'],
                "display": data['display'],
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "source": "patient_data"
            })

        # Sort by usage frequency
        medications.sort(key=lambda x: x['frequency_count'], reverse=True)

        # Apply limit if specified
        if limit:
            medications = medications[:limit]

        self._cache_result(cache_key, medications)
        logger.info(f"Extracted {len(medications)} unique medications using FHIR-standard approach")
        return medications

    async def extract_condition_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract condition catalog from Condition resources.

        Uses FHIR-standard _elements parameter for efficient minimal-payload retrieval.
        Works with ANY FHIR R4 compliant server (HAPI, Azure FHIR, AWS HealthLake, etc.)
        """
        cache_key = f"conditions_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting condition catalog using FHIR-standard _elements parameter")

        hapi_client = HAPIFHIRClient()

        try:
            # FHIR-standard approach: Fetch only code field (85-90% payload reduction)
            bundle = await hapi_client.search("Condition", {
                "_elements": "code",
                "_count": "1000"
            })

            total_found = len(bundle.get('entry', []))
            logger.info(f"Found {total_found} conditions (minimal payload)")

            # Aggregate codes from minimal payload
            code_map = defaultdict(lambda: {
                'code': None,
                'display': None,
                'system': None,
                'frequency_count': 0
            })

            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'code' not in resource:
                    continue

                code_element = resource['code']
                if 'coding' not in code_element or not code_element['coding']:
                    continue

                coding = code_element['coding'][0]
                code = coding.get('code')

                if code:
                    code_data = code_map[code]
                    code_data['code'] = code
                    code_data['display'] = coding.get('display') or code_element.get('text') or "Unknown condition"
                    code_data['system'] = coding.get('system') or "http://snomed.info/sct"
                    code_data['frequency_count'] += 1

            logger.info(f"Aggregated {len(code_map)} distinct condition codes from {total_found} resources")

        except Exception as e:
            logger.error(f"Error extracting condition catalog: {e}")
            code_map = {}

        # Convert to list format
        conditions = []
        for code, data in code_map.items():
            conditions.append({
                "id": f"cond_{code}" if code else f"cond_{len(conditions)}",
                "code": data['code'],
                "display": data['display'],
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "source": "patient_data"
            })

        # Sort by usage frequency
        conditions.sort(key=lambda x: x['frequency_count'], reverse=True)

        # Apply limit if specified
        if limit:
            conditions = conditions[:limit]

        self._cache_result(cache_key, conditions)
        logger.info(f"Extracted {len(conditions)} unique conditions using FHIR-standard approach")
        return conditions

    async def extract_lab_test_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract lab test catalog from Observation resources with category=laboratory.

        Uses FHIR-standard _elements parameter for efficient minimal-payload retrieval.
        Works with ANY FHIR R4 compliant server (HAPI, Azure FHIR, AWS HealthLake, etc.)
        """
        cache_key = f"lab_tests_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting lab test catalog using FHIR-standard _elements parameter")

        hapi_client = HAPIFHIRClient()

        try:
            # FHIR-standard approach: Fetch only code field (85-90% payload reduction)
            # Works on ANY FHIR R4 server, not HAPI-specific
            bundle = await hapi_client.search("Observation", {
                "category": "laboratory",
                "_elements": "code",
                "_count": "1000"
            })

            total_found = len(bundle.get('entry', []))
            logger.info(f"Found {total_found} laboratory observations (minimal payload)")

            # Aggregate codes from minimal payload (fast in-memory processing)
            code_map = defaultdict(lambda: {
                'loinc_code': None,
                'display': None,
                'system': None,
                'frequency_count': 0
            })

            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'code' not in resource:
                    logger.warning(f"Resource {resource.get('id')} missing code field")
                    continue

                # Extract code from minimal resource
                code_element = resource['code']
                if 'coding' not in code_element or not code_element['coding']:
                    logger.warning(f"Resource {resource.get('id')} code missing coding")
                    continue

                coding = code_element['coding'][0]
                code = coding.get('code')

                if code:
                    code_data = code_map[code]
                    code_data['loinc_code'] = code
                    code_data['display'] = coding.get('display') or code_element.get('text') or "Unknown lab test"
                    code_data['system'] = coding.get('system')
                    code_data['frequency_count'] += 1
                    logger.debug(f"Aggregated {code}: {code_data['display']} (count: {code_data['frequency_count']})")

            logger.info(f"Aggregated {len(code_map)} distinct lab test codes from {total_found} observations")

        except Exception as e:
            logger.error(f"Error extracting lab catalog: {e}")
            code_map = {}

        # Convert to list format
        lab_tests = []
        for code, data in code_map.items():
            lab_tests.append({
                "id": f"lab_{code}" if code else f"lab_{len(lab_tests)}",
                "name": code,
                "display": data['display'],
                "loinc_code": data['loinc_code'],
                "category": "laboratory",
                "specimen_type": "blood",  # Default, could be enhanced
                "frequency_count": data['frequency_count'],
                "source": "patient_data"
            })

        # Sort by usage frequency
        lab_tests.sort(key=lambda x: x['frequency_count'], reverse=True)

        # Apply limit if specified
        if limit:
            lab_tests = lab_tests[:limit]

        self._cache_result(cache_key, lab_tests)
        logger.info(f"Extracted {len(lab_tests)} unique lab tests using FHIR-standard approach")
        return lab_tests

    async def extract_procedure_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract procedure catalog from Procedure resources.

        Uses FHIR-standard _elements parameter for efficient minimal-payload retrieval.
        Works with ANY FHIR R4 compliant server (HAPI, Azure FHIR, AWS HealthLake, etc.)
        """
        cache_key = f"procedures_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting procedure catalog using FHIR-standard _elements parameter")

        hapi_client = HAPIFHIRClient()

        try:
            # FHIR-standard approach: Fetch only code field (85-90% payload reduction)
            bundle = await hapi_client.search("Procedure", {
                "_elements": "code",
                "_count": "1000"
            })

            total_found = len(bundle.get('entry', []))
            logger.info(f"Found {total_found} procedures (minimal payload)")

            # Aggregate codes from minimal payload
            code_map = defaultdict(lambda: {
                'code': None,
                'display': None,
                'system': None,
                'frequency_count': 0
            })

            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'code' not in resource:
                    continue

                code_element = resource['code']
                if 'coding' not in code_element or not code_element['coding']:
                    continue

                coding = code_element['coding'][0]
                code = coding.get('code')

                if code:
                    code_data = code_map[code]
                    code_data['code'] = code
                    code_data['display'] = coding.get('display') or code_element.get('text') or "Unknown procedure"
                    code_data['system'] = coding.get('system') or "http://snomed.info/sct"
                    code_data['frequency_count'] += 1

            logger.info(f"Aggregated {len(code_map)} distinct procedure codes from {total_found} resources")

        except Exception as e:
            logger.error(f"Error extracting procedure catalog: {e}")
            code_map = {}

        # Convert to list format
        procedures = []
        for code, data in code_map.items():
            procedures.append({
                "id": f"proc_{code}" if code else f"proc_{len(procedures)}",
                "code": data['code'],
                "display": data['display'],
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "source": "patient_data"
            })

        # Sort by usage frequency
        procedures.sort(key=lambda x: x['frequency_count'], reverse=True)

        # Apply limit if specified
        if limit:
            procedures = procedures[:limit]

        self._cache_result(cache_key, procedures)
        logger.info(f"Extracted {len(procedures)} unique procedures using FHIR-standard approach")
        return procedures

    async def extract_vaccine_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract vaccine catalog from Immunization resources.

        Uses FHIR-standard _elements parameter for efficient minimal-payload retrieval.
        Works with ANY FHIR R4 compliant server (HAPI, Azure FHIR, AWS HealthLake, etc.)
        """
        cache_key = f"vaccines_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting vaccine catalog using FHIR-standard _elements parameter")

        hapi_client = HAPIFHIRClient()

        try:
            # FHIR-standard approach: Fetch only vaccineCode field (85-90% payload reduction)
            bundle = await hapi_client.search("Immunization", {
                "_elements": "vaccineCode",
                "_count": "1000"
            })

            total_found = len(bundle.get('entry', []))
            logger.info(f"Found {total_found} immunizations (minimal payload)")

            # Aggregate codes from minimal payload
            code_map = defaultdict(lambda: {
                'cvx_code': None,
                'display': None,
                'frequency_count': 0
            })

            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'vaccineCode' not in resource:
                    continue

                vaccine_code = resource['vaccineCode']
                if 'coding' not in vaccine_code or not vaccine_code['coding']:
                    continue

                coding = vaccine_code['coding'][0]
                code = coding.get('code')

                if code:
                    code_data = code_map[code]
                    code_data['cvx_code'] = code
                    code_data['display'] = coding.get('display') or vaccine_code.get('text') or "Unknown vaccine"
                    code_data['frequency_count'] += 1

            logger.info(f"Aggregated {len(code_map)} distinct vaccine codes from {total_found} immunizations")

        except Exception as e:
            logger.error(f"Error extracting vaccine catalog: {e}")
            code_map = {}

        # Convert to list format
        vaccines = []
        for code, data in code_map.items():
            vaccines.append({
                "id": f"vax_{code}" if code else f"vax_{len(vaccines)}",
                "vaccine_code": data['cvx_code'],
                "vaccine_name": data['display'],
                "cvx_code": data['cvx_code'],
                "usage_count": data['frequency_count'],
                "source": "patient_data"
            })

        # Sort by usage frequency
        vaccines.sort(key=lambda x: x['usage_count'], reverse=True)

        # Apply limit if specified
        if limit:
            vaccines = vaccines[:limit]

        self._cache_result(cache_key, vaccines)
        logger.info(f"Extracted {len(vaccines)} unique vaccines using FHIR-standard approach")
        return vaccines

    async def extract_allergy_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Extract allergy catalog from AllergyIntolerance resources.

        Uses FHIR-standard _elements parameter for efficient minimal-payload retrieval.
        Works with ANY FHIR R4 compliant server (HAPI, Azure FHIR, AWS HealthLake, etc.)
        """
        cache_key = f"allergies_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting allergy catalog using FHIR-standard _elements parameter")

        hapi_client = HAPIFHIRClient()

        try:
            # FHIR-standard approach: Fetch only code field (85-90% payload reduction)
            bundle = await hapi_client.search("AllergyIntolerance", {
                "_elements": "code",
                "_count": "1000"
            })

            total_found = len(bundle.get('entry', []))
            logger.info(f"Found {total_found} allergy intolerances (minimal payload)")

            # Aggregate codes from minimal payload
            code_map = defaultdict(lambda: {
                'code': None,
                'display': None,
                'system': None,
                'frequency_count': 0
            })

            for entry in bundle.get('entry', []):
                resource = entry['resource']
                if 'code' not in resource:
                    continue

                code_element = resource['code']
                if 'coding' not in code_element or not code_element['coding']:
                    continue

                coding = code_element['coding'][0]
                code = coding.get('code')

                if code:
                    code_data = code_map[code]
                    code_data['code'] = code
                    code_data['display'] = coding.get('display') or code_element.get('text') or "Unknown allergen"
                    code_data['system'] = coding.get('system')
                    code_data['frequency_count'] += 1

            logger.info(f"Aggregated {len(code_map)} distinct allergy codes from {total_found} resources")

        except Exception as e:
            logger.error(f"Error extracting allergy catalog: {e}")
            code_map = {}

        # Convert to list format
        allergies = []
        for code, data in code_map.items():
            # Determine allergen type from system
            allergen_type = "other"
            system = data['system'] or ""
            if "rxnorm" in system.lower():
                allergen_type = "medication"

            allergy_dict = {
                "id": f"allergy_{code}" if code else f"allergy_{len(allergies)}",
                "allergen_code": data['code'],
                "allergen_name": data['display'],
                "allergen_type": allergen_type,
                "system": data['system'],
                "usage_count": data['frequency_count'],
                "source": "patient_data"
            }

            # Add RxNorm code for medication allergies
            if allergen_type == "medication" and "rxnorm" in system.lower():
                allergy_dict["rxnorm_code"] = code

            allergies.append(allergy_dict)

        # Sort by usage frequency
        allergies.sort(key=lambda x: x['usage_count'], reverse=True)

        # Apply limit if specified
        if limit:
            allergies = allergies[:limit]

        self._cache_result(cache_key, allergies)
        logger.info(f"Extracted {len(allergies)} unique allergies from HAPI FHIR")
        return allergies

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
                "cached_catalogs": list(self.cache.keys()),
                "cache_timeout": self.cache_timeout
            }
        }

        return statistics

    async def refresh_all_catalogs(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """Refresh all catalogs and return summary."""
        logger.info("Refreshing all dynamic catalogs from HAPI FHIR")

        self.cache.clear()  # Clear existing cache

        # Extract all catalogs
        medications = await self.extract_medication_catalog(limit)
        conditions = await self.extract_condition_catalog(limit)
        lab_tests = await self.extract_lab_test_catalog(limit)
        procedures = await self.extract_procedure_catalog(limit)
        vaccines = await self.extract_vaccine_catalog(limit)
        allergies = await self.extract_allergy_catalog(limit)
        statistics = await self.get_catalog_statistics()

        self.last_refresh = datetime.now()

        summary = {
            "refresh_time": self.last_refresh.isoformat(),
            "catalog_counts": {
                "medications": len(medications),
                "conditions": len(conditions),
                "lab_tests": len(lab_tests),
                "procedures": len(procedures),
                "vaccines": len(vaccines),
                "allergies": len(allergies)
            },
            "statistics": statistics
        }

        logger.info(f"Catalog refresh complete: {summary['catalog_counts']}")
        return summary

    def _is_cached(self, key: str) -> bool:
        """Check if result is cached and not expired."""
        if key not in self.cache:
            return False

        cache_time = self.cache.get(f"{key}_time")
        if not cache_time:
            return False

        return (datetime.now() - cache_time).seconds < self.cache_timeout

    def _cache_result(self, key: str, result: Any) -> None:
        """Cache a result with timestamp."""
        self.cache[key] = result
        self.cache[f"{key}_time"] = datetime.now()

    def clear_cache(self) -> None:
        """Clear all cached results."""
        self.cache.clear()
        logger.info("Dynamic catalog cache cleared")
