"""
Dynamic Catalog Service - HAPI FHIR Migration
Extracts and builds catalogs from actual patient FHIR data using fhirclient
"""

import json
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from collections import defaultdict, Counter
import logging
from services.fhir_client_config import (
    search_resources,
    get_fhir_server
)

logger = logging.getLogger(__name__)


class DynamicCatalogServiceFHIR:
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
        """Extract medication catalog from MedicationRequest resources using fhirclient."""
        cache_key = f"medications_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting medication catalog from HAPI FHIR")

        # Fetch MedicationRequest resources
        med_requests = search_resources('MedicationRequest', {'_count': 1000})

        # Aggregate by medication code
        medication_map = defaultdict(lambda: {
            'code': None,
            'display': None,
            'system': None,
            'frequency_count': 0,
            'statuses': set(),
            'dosing_frequencies': set()
        })

        for med_request in med_requests:
            if hasattr(med_request, 'medicationCodeableConcept') and med_request.medicationCodeableConcept:
                coding = med_request.medicationCodeableConcept.coding[0] if med_request.medicationCodeableConcept.coding else None

                if coding and coding.code:
                    code = coding.code
                    med_data = medication_map[code]

                    med_data['code'] = code
                    med_data['display'] = coding.display or med_request.medicationCodeableConcept.text or "Unknown medication"
                    med_data['system'] = coding.system or "http://www.nlm.nih.gov/research/umls/rxnorm"
                    med_data['frequency_count'] += 1

                    if hasattr(med_request, 'status') and med_request.status:
                        med_data['statuses'].add(med_request.status)

                    if hasattr(med_request, 'dosageInstruction') and med_request.dosageInstruction:
                        for dosage in med_request.dosageInstruction:
                            if hasattr(dosage, 'timing') and dosage.timing:
                                if hasattr(dosage.timing, 'repeat') and dosage.timing.repeat:
                                    if hasattr(dosage.timing.repeat, 'frequency'):
                                        med_data['dosing_frequencies'].add(str(dosage.timing.repeat.frequency))

        # Also fetch MedicationStatement resources
        med_statements = search_resources('MedicationStatement', {'_count': 1000})

        for med_statement in med_statements:
            if hasattr(med_statement, 'medicationCodeableConcept') and med_statement.medicationCodeableConcept:
                coding = med_statement.medicationCodeableConcept.coding[0] if med_statement.medicationCodeableConcept.coding else None

                if coding and coding.code:
                    code = coding.code
                    if code not in medication_map:
                        med_data = medication_map[code]
                        med_data['code'] = code
                        med_data['display'] = coding.display or med_statement.medicationCodeableConcept.text or "Unknown medication"
                        med_data['system'] = coding.system or "http://www.nlm.nih.gov/research/umls/rxnorm"
                        med_data['frequency_count'] = 1
                        med_data['statuses'] = {'active'}

        # Convert to list and sort by frequency
        medications = []
        for code, data in medication_map.items():
            medications.append({
                "id": f"med_{code}" if code else f"med_{len(medications)}",
                "code": data['code'],
                "display": data['display'],
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "common_statuses": list(data['statuses']),
                "dosing_frequencies": list(data['dosing_frequencies']),
                "source": "patient_data"
            })

        medications.sort(key=lambda x: x['frequency_count'], reverse=True)

        if limit:
            medications = medications[:limit]

        self._cache_result(cache_key, medications)
        logger.info(f"Extracted {len(medications)} unique medications from HAPI FHIR")
        return medications

    async def extract_condition_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract condition catalog from Condition resources using fhirclient."""
        cache_key = f"conditions_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting condition catalog from HAPI FHIR")

        # Fetch Condition resources
        conditions_list = search_resources('Condition', {'_count': 1000})

        # Aggregate by condition code
        condition_map = defaultdict(lambda: {
            'code': None,
            'display': None,
            'system': None,
            'frequency_count': 0,
            'clinical_statuses': set(),
            'verification_statuses': set(),
            'severities': set(),
            'categories': set()
        })

        for condition in conditions_list:
            if hasattr(condition, 'code') and condition.code:
                coding = condition.code.coding[0] if condition.code.coding else None

                if coding and coding.code:
                    code = coding.code
                    cond_data = condition_map[code]

                    cond_data['code'] = code
                    cond_data['display'] = coding.display or condition.code.text or "Unknown condition"
                    cond_data['system'] = coding.system or "http://snomed.info/sct"
                    cond_data['frequency_count'] += 1

                    if hasattr(condition, 'clinicalStatus') and condition.clinicalStatus:
                        if hasattr(condition.clinicalStatus, 'text'):
                            cond_data['clinical_statuses'].add(condition.clinicalStatus.text)

                    if hasattr(condition, 'verificationStatus') and condition.verificationStatus:
                        if hasattr(condition.verificationStatus, 'text'):
                            cond_data['verification_statuses'].add(condition.verificationStatus.text)

                    if hasattr(condition, 'severity') and condition.severity:
                        if condition.severity.coding:
                            severity_display = condition.severity.coding[0].display
                            if severity_display:
                                cond_data['severities'].add(severity_display)

                    if hasattr(condition, 'category') and condition.category:
                        for cat in condition.category:
                            if cat.coding:
                                cat_display = cat.coding[0].display
                                if cat_display:
                                    cond_data['categories'].add(cat_display)

        # Convert to list and sort by frequency
        conditions = []
        for code, data in condition_map.items():
            conditions.append({
                "id": f"cond_{code}" if code else f"cond_{len(conditions)}",
                "code": data['code'],
                "display": data['display'],
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "clinical_statuses": list(data['clinical_statuses']),
                "verification_statuses": list(data['verification_statuses']),
                "common_severities": list(data['severities']),
                "categories": list(data['categories']),
                "source": "patient_data"
            })

        conditions.sort(key=lambda x: x['frequency_count'], reverse=True)

        if limit:
            conditions = conditions[:limit]

        self._cache_result(cache_key, conditions)
        logger.info(f"Extracted {len(conditions)} unique conditions from HAPI FHIR")
        return conditions

    async def extract_lab_test_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract lab test catalog from Observation resources with category=laboratory."""
        cache_key = f"lab_tests_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting lab test catalog from HAPI FHIR")

        # Fetch laboratory Observation resources
        observations = search_resources('Observation', {'category': 'laboratory', '_count': 1000})

        # Aggregate by LOINC code
        lab_test_map = defaultdict(lambda: {
            'loinc_code': None,
            'display': None,
            'system': None,
            'frequency_count': 0,
            'statuses': set(),
            'units': set(),
            'values': []
        })

        for obs in observations:
            if hasattr(obs, 'code') and obs.code:
                coding = obs.code.coding[0] if obs.code.coding else None

                if coding and coding.code:
                    code = coding.code
                    lab_data = lab_test_map[code]

                    lab_data['loinc_code'] = code
                    lab_data['display'] = coding.display or obs.code.text or "Unknown lab test"
                    lab_data['system'] = coding.system
                    lab_data['frequency_count'] += 1

                    if hasattr(obs, 'status') and obs.status:
                        lab_data['statuses'].add(obs.status)

                    if hasattr(obs, 'valueQuantity') and obs.valueQuantity:
                        if hasattr(obs.valueQuantity, 'unit') and obs.valueQuantity.unit:
                            lab_data['units'].add(obs.valueQuantity.unit)
                        if hasattr(obs.valueQuantity, 'value') and obs.valueQuantity.value is not None:
                            try:
                                lab_data['values'].append(float(obs.valueQuantity.value))
                            except (ValueError, TypeError):
                                pass

        # Convert to list with statistics
        lab_tests = []
        for code, data in lab_test_map.items():
            # Calculate statistics from values
            reference_range = None
            value_stats = None

            if data['values']:
                sorted_values = sorted(data['values'])
                n = len(sorted_values)

                # Calculate percentiles (5th and 95th)
                p05_idx = max(0, int(n * 0.05) - 1)
                p95_idx = min(n - 1, int(n * 0.95))

                reference_range = {
                    "min": sorted_values[p05_idx],
                    "max": sorted_values[p95_idx],
                    "unit": list(data['units'])[0] if data['units'] else "",
                    "interpretation": "calculated from patient data"
                }

                value_stats = {
                    "min": min(data['values']),
                    "max": max(data['values']),
                    "avg": sum(data['values']) / len(data['values'])
                }

            lab_tests.append({
                "id": f"lab_{code}" if code else f"lab_{len(lab_tests)}",
                "name": code,
                "display": data['display'],
                "loinc_code": data['loinc_code'],
                "category": "laboratory",
                "specimen_type": "blood",  # Default, could be enhanced
                "reference_range": reference_range,
                "frequency_count": data['frequency_count'],
                "common_statuses": list(data['statuses']),
                "common_units": list(data['units']),
                "value_statistics": value_stats,
                "source": "patient_data"
            })

        lab_tests.sort(key=lambda x: x['frequency_count'], reverse=True)

        if limit:
            lab_tests = lab_tests[:limit]

        self._cache_result(cache_key, lab_tests)
        logger.info(f"Extracted {len(lab_tests)} unique lab tests from HAPI FHIR")
        return lab_tests

    async def extract_procedure_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract procedure catalog from Procedure resources using fhirclient."""
        cache_key = f"procedures_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting procedure catalog from HAPI FHIR")

        # Fetch Procedure resources
        procedures_list = search_resources('Procedure', {'_count': 1000})

        # Aggregate by procedure code
        procedure_map = defaultdict(lambda: {
            'code': None,
            'display': None,
            'system': None,
            'frequency_count': 0,
            'statuses': set(),
            'categories': set()
        })

        for procedure in procedures_list:
            if hasattr(procedure, 'code') and procedure.code:
                coding = procedure.code.coding[0] if procedure.code.coding else None

                if coding and coding.code:
                    code = coding.code
                    proc_data = procedure_map[code]

                    proc_data['code'] = code
                    proc_data['display'] = coding.display or procedure.code.text or "Unknown procedure"
                    proc_data['system'] = coding.system or "http://snomed.info/sct"
                    proc_data['frequency_count'] += 1

                    if hasattr(procedure, 'status') and procedure.status:
                        proc_data['statuses'].add(procedure.status)

                    if hasattr(procedure, 'category') and procedure.category:
                        if procedure.category.coding:
                            cat_display = procedure.category.coding[0].display
                            if cat_display:
                                proc_data['categories'].add(cat_display)

        # Convert to list and sort by frequency
        procedures = []
        for code, data in procedure_map.items():
            procedures.append({
                "id": f"proc_{code}" if code else f"proc_{len(procedures)}",
                "code": data['code'],
                "display": data['display'],
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "common_statuses": list(data['statuses']),
                "categories": list(data['categories']),
                "source": "patient_data"
            })

        procedures.sort(key=lambda x: x['frequency_count'], reverse=True)

        if limit:
            procedures = procedures[:limit]

        self._cache_result(cache_key, procedures)
        logger.info(f"Extracted {len(procedures)} unique procedures from HAPI FHIR")
        return procedures

    async def extract_vaccine_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract vaccine/immunization catalog from Immunization resources using fhirclient."""
        cache_key = f"vaccines_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting vaccine catalog from HAPI FHIR")

        # Fetch Immunization resources
        immunizations = search_resources('Immunization', {'_count': 1000})

        # Aggregate by vaccine code
        vaccine_map = defaultdict(lambda: {
            'cvx_code': None,
            'display': None,
            'manufacturer': None,
            'frequency_count': 0,
            'statuses': set(),
            'routes': set(),
            'sites': set()
        })

        for immunization in immunizations:
            if hasattr(immunization, 'vaccineCode') and immunization.vaccineCode:
                coding = immunization.vaccineCode.coding[0] if immunization.vaccineCode.coding else None

                if coding and coding.code:
                    code = coding.code
                    vax_data = vaccine_map[code]

                    vax_data['cvx_code'] = code
                    vax_data['display'] = coding.display or immunization.vaccineCode.text or "Unknown vaccine"
                    vax_data['frequency_count'] += 1

                    if hasattr(immunization, 'manufacturer') and immunization.manufacturer:
                        if hasattr(immunization.manufacturer, 'display'):
                            vax_data['manufacturer'] = immunization.manufacturer.display

                    if hasattr(immunization, 'status') and immunization.status:
                        vax_data['statuses'].add(immunization.status)

                    if hasattr(immunization, 'route') and immunization.route:
                        if immunization.route.coding:
                            route_display = immunization.route.coding[0].display
                            if route_display:
                                vax_data['routes'].add(route_display)

                    if hasattr(immunization, 'site') and immunization.site:
                        if immunization.site.coding:
                            site_display = immunization.site.coding[0].display
                            if site_display:
                                vax_data['sites'].add(site_display)

        # Convert to list and sort by frequency
        vaccines = []
        for code, data in vaccine_map.items():
            vaccines.append({
                "id": f"vax_{code}" if code else f"vax_{len(vaccines)}",
                "vaccine_code": data['cvx_code'],
                "vaccine_name": data['display'],
                "cvx_code": data['cvx_code'],
                "manufacturer": data['manufacturer'],
                "frequency_count": data['frequency_count'],
                "common_statuses": list(data['statuses']),
                "common_routes": list(data['routes']),
                "common_sites": list(data['sites']),
                "usage_count": data['frequency_count'],
                "source": "patient_data"
            })

        vaccines.sort(key=lambda x: x['frequency_count'], reverse=True)

        if limit:
            vaccines = vaccines[:limit]

        self._cache_result(cache_key, vaccines)
        logger.info(f"Extracted {len(vaccines)} unique vaccines from HAPI FHIR")
        return vaccines

    async def extract_allergy_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract allergy catalog from AllergyIntolerance resources using fhirclient."""
        cache_key = f"allergies_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]

        logger.info("Extracting allergy catalog from HAPI FHIR")

        # Fetch AllergyIntolerance resources
        allergies_list = search_resources('AllergyIntolerance', {'_count': 1000})

        # Aggregate by allergen code
        allergy_map = defaultdict(lambda: {
            'code': None,
            'display': None,
            'system': None,
            'category': None,
            'frequency_count': 0,
            'types': set(),
            'criticalities': set(),
            'reactions': set()
        })

        for allergy in allergies_list:
            if hasattr(allergy, 'code') and allergy.code:
                coding = allergy.code.coding[0] if allergy.code.coding else None

                if coding and coding.code:
                    code = coding.code
                    allergy_data = allergy_map[code]

                    allergy_data['code'] = code
                    allergy_data['display'] = coding.display or allergy.code.text or "Unknown allergen"
                    allergy_data['system'] = coding.system
                    allergy_data['frequency_count'] += 1

                    if hasattr(allergy, 'category') and allergy.category:
                        allergy_data['category'] = allergy.category[0] if isinstance(allergy.category, list) else allergy.category

                    if hasattr(allergy, 'type') and allergy.type:
                        allergy_data['types'].add(allergy.type)

                    if hasattr(allergy, 'criticality') and allergy.criticality:
                        allergy_data['criticalities'].add(allergy.criticality)

                    if hasattr(allergy, 'reaction') and allergy.reaction:
                        for reaction in allergy.reaction:
                            if hasattr(reaction, 'manifestation') and reaction.manifestation:
                                for manifest in reaction.manifestation:
                                    if hasattr(manifest, 'coding') and manifest.coding:
                                        reaction_display = manifest.coding[0].display
                                        if reaction_display:
                                            allergy_data['reactions'].add(reaction_display)

        # Convert to list and determine allergen types
        allergies = []
        for code, data in allergy_map.items():
            # Determine allergy type from category
            allergen_type = "other"
            if data['category']:
                category_str = str(data['category']).lower()
                if 'medication' in category_str:
                    allergen_type = "medication"
                elif 'food' in category_str:
                    allergen_type = "food"
                elif 'environment' in category_str:
                    allergen_type = "environmental"

            allergy_dict = {
                "id": f"allergy_{code}" if code else f"allergy_{len(allergies)}",
                "allergen_code": data['code'],
                "allergen_name": data['display'],
                "allergen_type": allergen_type,
                "system": data['system'],
                "frequency_count": data['frequency_count'],
                "common_types": list(data['types']),
                "criticality_levels": list(data['criticalities']),
                "common_reactions": list(data['reactions']),
                "usage_count": data['frequency_count'],
                "source": "patient_data"
            }

            # Add RxNorm code for medication allergies
            if allergen_type == "medication" and data['system'] == "http://www.nlm.nih.gov/research/umls/rxnorm":
                allergy_dict["rxnorm_code"] = code

            allergies.append(allergy_dict)

        allergies.sort(key=lambda x: x['frequency_count'], reverse=True)

        if limit:
            allergies = allergies[:limit]

        self._cache_result(cache_key, allergies)
        logger.info(f"Extracted {len(allergies)} unique allergies from HAPI FHIR")
        return allergies

    async def get_catalog_statistics(self) -> Dict[str, Any]:
        """Get statistics about the extracted catalogs using fhirclient."""
        logger.info("Generating catalog statistics from HAPI FHIR")

        # Get resource counts by searching with count
        resource_types = ['Patient', 'MedicationRequest', 'MedicationStatement',
                         'Condition', 'Observation', 'Procedure']

        resource_counts = {}
        for resource_type in resource_types:
            try:
                # Search with _summary=count to get just the total
                results = search_resources(resource_type, {'_summary': 'count', '_count': 0})
                # The count is typically in the bundle's total
                # Since we're using fhirclient, we'll do a simple search and count results
                full_results = search_resources(resource_type, {'_count': 1000})
                resource_counts[resource_type] = len(full_results)
            except Exception as e:
                logger.warning(f"Could not get count for {resource_type}: {e}")
                resource_counts[resource_type] = 0

        # Get lab observation count specifically
        lab_count = 0
        try:
            lab_observations = search_resources('Observation', {'category': 'laboratory', '_count': 1000})
            lab_count = len(lab_observations)
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
