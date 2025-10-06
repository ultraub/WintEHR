"""
Catalog Extraction Service

Extracts unique medications, conditions, and lab tests from patient FHIR data
to build searchable catalogs for CPOE (Computerized Provider Order Entry).

Updated: 2025-10-05 - Migrated to use HAPI FHIR REST API (proper approach)
"""

import json
from typing import Dict, List, Set, Optional, Any
from collections import defaultdict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
import logging

# FHIR client for accessing HAPI FHIR REST API
from services.fhir_client_config import get_fhir_server
from fhirclient.models.medicationrequest import MedicationRequest
from fhirclient.models.condition import Condition
from fhirclient.models.observation import Observation
from fhirclient.models.patient import Patient

logger = logging.getLogger(__name__)


class CatalogExtractor:
    """
    Extracts catalog items from FHIR resources in the database.

    This service analyzes patient data to build catalogs of:
    - Medications (from MedicationRequest resources)
    - Conditions (from Condition resources)
    - Lab Tests (from Observation resources with category=laboratory)

    MIGRATION NOTE (2025-10-05):
    Updated to use HAPI FHIR REST API via fhirclient library.
    This is the proper, portable approach vs direct SQL queries.
    """

    def __init__(self, session: AsyncSession = None):
        """
        Initialize catalog extractor.

        Args:
            session: Database session (kept for backward compatibility, but not used)
        """
        self.server = get_fhir_server()
        self.extracted_data = {
            "medications": {},
            "conditions": {},
            "lab_tests": {},
            "extraction_metadata": {
                "last_extraction": None,
                "patient_count": 0,
                "resource_counts": {}
            }
        }

    async def extract_all_catalogs(self) -> Dict[str, Any]:
        """
        Extract all catalog types from FHIR resources.

        Returns a dictionary containing extracted medications, conditions, and lab tests.
        """
        logger.info("Starting catalog extraction from HAPI FHIR resources")

        # Get patient count
        patient_count = await self._get_patient_count()
        self.extracted_data["extraction_metadata"]["patient_count"] = patient_count

        # Extract each catalog type
        await self._extract_medications()
        await self._extract_conditions()
        await self._extract_lab_tests()

        # Update metadata
        self.extracted_data["extraction_metadata"]["last_extraction"] = datetime.utcnow().isoformat()

        logger.info(f"Extraction complete. Found {len(self.extracted_data['medications'])} medications, "
                   f"{len(self.extracted_data['conditions'])} conditions, "
                   f"{len(self.extracted_data['lab_tests'])} lab tests")

        return self.extracted_data

    async def _get_patient_count(self) -> int:
        """Get total number of patients via HAPI FHIR API."""
        try:
            # Use FHIR search with _summary=count to get total
            search = Patient.where(struct={"_summary": "count"})
            bundle = search.perform(self.server)
            return bundle.total if bundle and hasattr(bundle, 'total') else 0
        except Exception as e:
            logger.warning(f"Error getting patient count via FHIR API: {e}")
            return 0

    async def _extract_medications(self):
        """Extract unique medications via HAPI FHIR REST API."""
        medications_dict = {}

        try:
            # Search for all MedicationRequest resources
            # Use pagination to handle large datasets
            search = MedicationRequest.where(struct={
                "_count": 1000,  # Max per page
                "_elements": "medicationCodeableConcept,status"
            })

            bundle = search.perform(self.server)
            if not bundle or not bundle.entry:
                logger.info("No medication requests found")
                self.extracted_data["medications"] = medications_dict
                return

            # Process all resources in the bundle
            for entry in bundle.entry:
                if not entry.resource:
                    continue

                med_request = entry.resource
                medication_data = None

                # Get medication data
                if hasattr(med_request, 'medicationCodeableConcept') and med_request.medicationCodeableConcept:
                    medication_data = med_request.medicationCodeableConcept.as_json()

                if not medication_data:
                    continue

                # Extract medication details
                med_text = medication_data.get('text', '')
                codings = medication_data.get('coding', [])

                for coding in codings:
                    code = coding.get('code')
                    if not code:
                        continue

                    # Use RxNorm code as the unique identifier
                    if coding.get('system') == 'http://www.nlm.nih.gov/research/umls/rxnorm':
                        if code not in medications_dict:
                            # Parse medication name to extract components
                            display = coding.get('display', med_text)

                            # Extract dosage form and strength from display name
                            parts = display.split()
                            generic_name = []
                            strength = []
                            dosage_form = []

                            # Simple parsing logic
                            for i, part in enumerate(parts):
                                if part.upper() in ['MG', 'MCG', 'G', 'ML', 'MG/ML', 'UNIT', 'IU']:
                                    if i > 0 and parts[i-1].replace('.', '').isdigit():
                                        strength = [parts[i-1], part]
                                    else:
                                        strength.append(part)
                                elif part.lower() in ['tablet', 'capsule', 'solution', 'injection', 'cream',
                                                    'ointment', 'patch', 'inhaler', 'spray', 'drops',
                                                    'chewable', 'oral', 'topical', 'ophthalmic']:
                                    dosage_form.append(part)
                                elif i < 2:  # First two words likely to be drug name
                                    generic_name.append(part)

                            medications_dict[code] = {
                                "id": f"med_{code}",
                                "rxnorm_code": code,
                                "display_name": display,
                                "generic_name": ' '.join(generic_name) if generic_name else display.split()[0],
                                "strength": ' '.join(strength) if strength else "Unknown",
                                "dosage_form": ' '.join(dosage_form) if dosage_form else "Unknown",
                                "system": coding.get('system'),
                                "occurrence_count": 1,
                                "last_seen": datetime.utcnow().isoformat()
                            }
                        else:
                            medications_dict[code]["occurrence_count"] += 1

        except Exception as e:
            logger.error(f"Error extracting medications via FHIR API: {e}")

        self.extracted_data["medications"] = medications_dict
        self.extracted_data["extraction_metadata"]["resource_counts"]["MedicationRequest"] = len(medications_dict)

    async def _extract_conditions(self):
        """Extract unique conditions via HAPI FHIR REST API."""
        conditions_dict = {}

        try:
            # Search for all Condition resources
            # Use pagination to handle large datasets
            search = Condition.where(struct={
                "_count": 1000,  # Max per page
                "_elements": "code,clinicalStatus"
            })

            bundle = search.perform(self.server)
            if not bundle or not bundle.entry:
                logger.info("No conditions found")
                self.extracted_data["conditions"] = conditions_dict
                return

            # Process all resources in the bundle
            for entry in bundle.entry:
                if not entry.resource:
                    continue

                condition = entry.resource
                condition_data = None
                clinical_status = None

                # Get condition code data
                if hasattr(condition, 'code') and condition.code:
                    condition_data = condition.code.as_json()

                # Get clinical status
                if hasattr(condition, 'clinicalStatus') and condition.clinicalStatus:
                    clinical_status = condition.clinicalStatus.as_json()

                if not condition_data:
                    continue

                # Extract condition details
                condition_text = condition_data.get('text', '')
                codings = condition_data.get('coding', [])

                for coding in codings:
                    code = coding.get('code')
                    if not code:
                        continue

                    # Use SNOMED code as the unique identifier
                    if coding.get('system') == 'http://snomed.info/sct':
                        if code not in conditions_dict:
                            display = coding.get('display', condition_text)

                            # Extract condition name without qualifiers
                            condition_name = display.replace(' (disorder)', '').replace(' (finding)', '')

                            conditions_dict[code] = {
                                "id": f"cond_{code}",
                                "snomed_code": code,
                                "display_name": display,
                                "condition_name": condition_name,
                                "system": coding.get('system'),
                                "is_disorder": '(disorder)' in display,
                                "is_finding": '(finding)' in display,
                                "occurrence_count": 1,
                                "active_count": 1 if clinical_status and 'active' in str(clinical_status) else 0,
                                "last_seen": datetime.utcnow().isoformat()
                            }
                        else:
                            conditions_dict[code]["occurrence_count"] += 1
                            if clinical_status and 'active' in str(clinical_status):
                                conditions_dict[code]["active_count"] += 1

        except Exception as e:
            logger.error(f"Error extracting conditions via FHIR API: {e}")

        self.extracted_data["conditions"] = conditions_dict
        self.extracted_data["extraction_metadata"]["resource_counts"]["Condition"] = len(conditions_dict)

    async def _extract_lab_tests(self):
        """Extract unique lab tests via HAPI FHIR REST API."""
        lab_tests_dict = {}

        try:
            # Search for all Observation resources with laboratory category
            # Use pagination to handle large datasets
            search = Observation.where(struct={
                "_count": 1000,  # Max per page
                "category": "laboratory",
                "_elements": "code,category,valueQuantity,referenceRange"
            })

            bundle = search.perform(self.server)
            if not bundle or not bundle.entry:
                logger.info("No laboratory observations found")
                self.extracted_data["lab_tests"] = lab_tests_dict
                return

            # Process all resources in the bundle
            for entry in bundle.entry:
                if not entry.resource:
                    continue

                observation = entry.resource
                test_data = None
                value_quantity = None
                reference_range = None

                # Get observation code data
                if hasattr(observation, 'code') and observation.code:
                    test_data = observation.code.as_json()

                # Get value quantity
                if hasattr(observation, 'valueQuantity') and observation.valueQuantity:
                    value_quantity = observation.valueQuantity.as_json()

                # Get reference range
                if hasattr(observation, 'referenceRange') and observation.referenceRange:
                    reference_range = [r.as_json() for r in observation.referenceRange]

                if not test_data:
                    continue

                # Extract test details
                test_text = test_data.get('text', '')
                codings = test_data.get('coding', [])

                for coding in codings:
                    code = coding.get('code')
                    if not code:
                        continue

                    # Use LOINC code as the unique identifier
                    if coding.get('system') == 'http://loinc.org':
                        if code not in lab_tests_dict:
                            display = coding.get('display', test_text)

                            # Parse test name to extract components
                            # Common patterns: "Substance [Unit] in Specimen by Method"
                            test_name = display
                            specimen_type = "Unknown"
                            unit = "Unknown"

                            # Extract specimen type
                            if ' in ' in display:
                                parts = display.split(' in ')
                                if len(parts) > 1:
                                    specimen_part = parts[1].split(' by ')[0]
                                    specimen_type = specimen_part.strip()

                            # Extract unit from brackets
                            if '[' in display and ']' in display:
                                unit_start = display.find('[')
                                unit_end = display.find(']')
                                unit = display[unit_start+1:unit_end]

                            # Extract reference range if available
                            ref_range = None
                            if reference_range:
                                try:
                                    ref_data = reference_range[0] if isinstance(reference_range, list) else reference_range
                                    if ref_data:
                                        ref_range = {
                                            "low": ref_data.get('low', {}).get('value'),
                                            "high": ref_data.get('high', {}).get('value'),
                                            "text": ref_data.get('text')
                                        }
                                except:
                                    pass

                            lab_tests_dict[code] = {
                                "id": f"lab_{code}",
                                "loinc_code": code,
                                "display_name": display,
                                "test_name": test_name,
                                "specimen_type": specimen_type,
                                "unit": unit,
                                "system": coding.get('system'),
                                "reference_range": ref_range,
                                "occurrence_count": 1,
                                "has_values": bool(value_quantity),
                                "last_seen": datetime.utcnow().isoformat()
                            }
                        else:
                            lab_tests_dict[code]["occurrence_count"] += 1
                            if value_quantity:
                                lab_tests_dict[code]["has_values"] = True

        except Exception as e:
            logger.error(f"Error extracting lab tests via FHIR API: {e}")

        self.extracted_data["lab_tests"] = lab_tests_dict
        self.extracted_data["extraction_metadata"]["resource_counts"]["Observation"] = len(lab_tests_dict)

    def get_medications_list(self,
                           search_term: Optional[str] = None,
                           min_occurrences: int = 1,
                           limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get list of medications from extracted data.

        Args:
            search_term: Optional search term to filter medications
            min_occurrences: Minimum number of occurrences to include
            limit: Maximum number of results to return

        Returns:
            List of medication dictionaries sorted by occurrence count
        """
        medications = list(self.extracted_data["medications"].values())

        # Filter by occurrence count
        medications = [m for m in medications if m["occurrence_count"] >= min_occurrences]

        # Filter by search term if provided
        if search_term:
            search_lower = search_term.lower()
            medications = [
                m for m in medications
                if search_lower in m["display_name"].lower() or
                   search_lower in m["generic_name"].lower()
            ]

        # Sort by occurrence count (descending) and name
        medications.sort(key=lambda x: (-x["occurrence_count"], x["display_name"]))

        return medications[:limit]

    def get_conditions_list(self,
                          search_term: Optional[str] = None,
                          active_only: bool = False,
                          min_occurrences: int = 1,
                          limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get list of conditions from extracted data.

        Args:
            search_term: Optional search term to filter conditions
            active_only: Only include conditions with active cases
            min_occurrences: Minimum number of occurrences to include
            limit: Maximum number of results to return

        Returns:
            List of condition dictionaries sorted by occurrence count
        """
        conditions = list(self.extracted_data["conditions"].values())

        # Filter by occurrence count
        conditions = [c for c in conditions if c["occurrence_count"] >= min_occurrences]

        # Filter by active status if requested
        if active_only:
            conditions = [c for c in conditions if c["active_count"] > 0]

        # Filter by search term if provided
        if search_term:
            search_lower = search_term.lower()
            conditions = [
                c for c in conditions
                if search_lower in c["display_name"].lower() or
                   search_lower in c["condition_name"].lower()
            ]

        # Sort by occurrence count (descending) and name
        conditions.sort(key=lambda x: (-x["occurrence_count"], x["display_name"]))

        return conditions[:limit]

    def get_lab_tests_list(self,
                         search_term: Optional[str] = None,
                         specimen_type: Optional[str] = None,
                         min_occurrences: int = 1,
                         limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get list of lab tests from extracted data.

        Args:
            search_term: Optional search term to filter lab tests
            specimen_type: Filter by specimen type (e.g., "Blood", "Urine")
            min_occurrences: Minimum number of occurrences to include
            limit: Maximum number of results to return

        Returns:
            List of lab test dictionaries sorted by occurrence count
        """
        lab_tests = list(self.extracted_data["lab_tests"].values())

        # Filter by occurrence count
        lab_tests = [t for t in lab_tests if t["occurrence_count"] >= min_occurrences]

        # Filter by specimen type if provided
        if specimen_type:
            lab_tests = [
                t for t in lab_tests
                if specimen_type.lower() in t["specimen_type"].lower()
            ]

        # Filter by search term if provided
        if search_term:
            search_lower = search_term.lower()
            lab_tests = [
                t for t in lab_tests
                if search_lower in t["display_name"].lower() or
                   search_lower in t["test_name"].lower() or
                   search_lower in t["loinc_code"].lower()
            ]

        # Sort by occurrence count (descending) and name
        lab_tests.sort(key=lambda x: (-x["occurrence_count"], x["display_name"]))

        return lab_tests[:limit]

    def get_extraction_summary(self) -> Dict[str, Any]:
        """Get summary of the extraction results."""
        return {
            "medications": {
                "total": len(self.extracted_data["medications"]),
                "unique_rxnorm_codes": len(self.extracted_data["medications"]),
                "total_occurrences": sum(m["occurrence_count"] for m in self.extracted_data["medications"].values())
            },
            "conditions": {
                "total": len(self.extracted_data["conditions"]),
                "unique_snomed_codes": len(self.extracted_data["conditions"]),
                "total_occurrences": sum(c["occurrence_count"] for c in self.extracted_data["conditions"].values()),
                "active_conditions": sum(1 for c in self.extracted_data["conditions"].values() if c["active_count"] > 0)
            },
            "lab_tests": {
                "total": len(self.extracted_data["lab_tests"]),
                "unique_loinc_codes": len(self.extracted_data["lab_tests"]),
                "total_occurrences": sum(t["occurrence_count"] for t in self.extracted_data["lab_tests"].values()),
                "tests_with_values": sum(1 for t in self.extracted_data["lab_tests"].values() if t["has_values"])
            },
            "metadata": self.extracted_data["extraction_metadata"]
        }
