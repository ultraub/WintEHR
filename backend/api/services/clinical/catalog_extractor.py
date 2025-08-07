"""
Catalog Extraction Service

Extracts unique medications, conditions, and lab tests from patient FHIR data
to build searchable catalogs for CPOE (Computerized Provider Order Entry).
"""

import json
from typing import Dict, List, Set, Optional, Any
from collections import defaultdict
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import logging

logger = logging.getLogger(__name__)


class CatalogExtractor:
    """
    Extracts catalog items from FHIR resources in the database.
    
    This service analyzes patient data to build catalogs of:
    - Medications (from MedicationRequest resources)
    - Conditions (from Condition resources)
    - Lab Tests (from Observation resources with category=laboratory)
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
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
        logger.info("Starting catalog extraction from FHIR resources")
        
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
        """Get total number of patients in the system."""
        query = text("""
            SELECT COUNT(*) as count
            FROM fhir.resources
            WHERE resource_type = 'Patient' AND deleted = false
        """)
        result = await self.session.execute(query)
        return result.scalar() or 0
    
    async def _extract_medications(self):
        """Extract unique medications from MedicationRequest resources."""
        query = text("""
            SELECT 
                resource->>'id' as id,
                resource->'medicationCodeableConcept' as medication,
                resource->>'status' as status,
                resource->'dosageInstruction' as dosage_instruction
            FROM fhir.resources
            WHERE resource_type = 'MedicationRequest' 
            AND deleted = false
            AND resource->'medicationCodeableConcept' IS NOT NULL
        """)
        
        result = await self.session.execute(query)
        medications_dict = {}
        
        for row in result:
            medication_data = row.medication
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
        
        self.extracted_data["medications"] = medications_dict
        self.extracted_data["extraction_metadata"]["resource_counts"]["MedicationRequest"] = len(medications_dict)
    
    async def _extract_conditions(self):
        """Extract unique conditions from Condition resources."""
        query = text("""
            SELECT 
                resource->>'id' as id,
                resource->'code' as condition_code,
                resource->'clinicalStatus' as clinical_status,
                resource->'category' as category
            FROM fhir.resources
            WHERE resource_type = 'Condition' 
            AND deleted = false
            AND resource->'code' IS NOT NULL
        """)
        
        result = await self.session.execute(query)
        conditions_dict = {}
        
        for row in result:
            condition_data = row.condition_code
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
                            "active_count": 1 if row.clinical_status and 'active' in str(row.clinical_status) else 0,
                            "last_seen": datetime.utcnow().isoformat()
                        }
                    else:
                        conditions_dict[code]["occurrence_count"] += 1
                        if row.clinical_status and 'active' in str(row.clinical_status):
                            conditions_dict[code]["active_count"] += 1
        
        self.extracted_data["conditions"] = conditions_dict
        self.extracted_data["extraction_metadata"]["resource_counts"]["Condition"] = len(conditions_dict)
    
    async def _extract_lab_tests(self):
        """Extract unique lab tests from Observation resources with laboratory category."""
        query = text("""
            SELECT 
                resource->>'id' as id,
                resource->'code' as test_code,
                resource->'category' as category,
                resource->'valueQuantity' as value_quantity,
                resource->'referenceRange' as reference_range
            FROM fhir.resources
            WHERE resource_type = 'Observation' 
            AND deleted = false
            AND resource->'code' IS NOT NULL
            AND resource->'category' @> '[{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "laboratory"}]}]'
        """)
        
        result = await self.session.execute(query)
        lab_tests_dict = {}
        
        for row in result:
            test_data = row.test_code
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
                        if row.reference_range:
                            try:
                                ref_data = row.reference_range[0] if isinstance(row.reference_range, list) else row.reference_range
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
                            "has_values": bool(row.value_quantity),
                            "last_seen": datetime.utcnow().isoformat()
                        }
                    else:
                        lab_tests_dict[code]["occurrence_count"] += 1
                        if row.value_quantity:
                            lab_tests_dict[code]["has_values"] = True
        
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