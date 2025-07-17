"""
Dynamic Catalog Service
Extracts and builds catalogs from actual patient FHIR data
"""

import json
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from collections import defaultdict, Counter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import asyncio
import logging

logger = logging.getLogger(__name__)


class DynamicCatalogService:
    """
    Service to extract and build catalogs from actual patient FHIR data.
    
    Provides dynamic catalogs for:
    - Medications (from MedicationRequest/MedicationStatement)
    - Conditions (from Condition resources)
    - Lab Tests (from Observation resources with category=laboratory)
    - Procedures (from Procedure resources)
    """
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.cache = {}
        self.cache_timeout = 3600  # 1 hour cache
        self.last_refresh = None
    
    async def extract_medication_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract medication catalog from MedicationRequest resources."""
        cache_key = f"medications_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting medication catalog from patient data")
        
        # Query MedicationRequest resources
        sql = text("""
            SELECT DISTINCT 
                resource->'medicationCodeableConcept'->'coding'->0->>'code' as code,
                resource->'medicationCodeableConcept'->'coding'->0->>'display' as display,
                resource->'medicationCodeableConcept'->'coding'->0->>'system' as system,
                resource->'medicationCodeableConcept'->>'text' as text,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'status') as statuses,
                array_agg(DISTINCT resource->'dosageInstruction'->0->'timing'->'repeat'->>'frequency') as frequencies
            FROM fhir.resources 
            WHERE resource_type = 'MedicationRequest'
            AND resource->'medicationCodeableConcept'->'coding'->0->>'code' IS NOT NULL
            GROUP BY 
                resource->'medicationCodeableConcept'->'coding'->0->>'code',
                resource->'medicationCodeableConcept'->'coding'->0->>'display',
                resource->'medicationCodeableConcept'->'coding'->0->>'system',
                resource->'medicationCodeableConcept'->>'text'
            ORDER BY COUNT(*) DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(sql, {"limit": limit or 1000})
        
        medications = []
        for row in result:
            med = {
                "id": f"med_{row.code}" if row.code else f"med_{len(medications)}",
                "code": row.code,
                "display": row.display or row.text or "Unknown medication",
                "system": row.system or "http://www.nlm.nih.gov/research/umls/rxnorm",
                "frequency_count": row.frequency,
                "common_statuses": [s for s in row.statuses if s] if row.statuses else [],
                "dosing_frequencies": [f for f in row.frequencies if f] if row.frequencies else [],
                "source": "patient_data"
            }
            medications.append(med)
        
        # Also get MedicationStatement data
        sql_statement = text("""
            SELECT DISTINCT 
                resource->'medicationCodeableConcept'->'coding'->0->>'code' as code,
                resource->'medicationCodeableConcept'->'coding'->0->>'display' as display,
                resource->'medicationCodeableConcept'->'coding'->0->>'system' as system,
                resource->'medicationCodeableConcept'->>'text' as text,
                COUNT(*) as frequency
            FROM fhir.resources 
            WHERE resource_type = 'MedicationStatement'
            AND resource->'medicationCodeableConcept'->'coding'->0->>'code' IS NOT NULL
            GROUP BY 
                resource->'medicationCodeableConcept'->'coding'->0->>'code',
                resource->'medicationCodeableConcept'->'coding'->0->>'display',
                resource->'medicationCodeableConcept'->'coding'->0->>'system',
                resource->'medicationCodeableConcept'->>'text'
            ORDER BY COUNT(*) DESC
        """)
        
        result_statement = await self.db.execute(sql_statement)
        
        # Merge with existing medications
        existing_codes = {med["code"] for med in medications}
        for row in result_statement:
            if row.code not in existing_codes:
                med = {
                    "id": f"med_{row.code}" if row.code else f"med_statement_{len(medications)}",
                    "code": row.code,
                    "display": row.display or row.text or "Unknown medication",
                    "system": row.system or "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "frequency_count": row.frequency,
                    "common_statuses": ["active"],
                    "dosing_frequencies": [],
                    "source": "medication_statement"
                }
                medications.append(med)
        
        self._cache_result(cache_key, medications)
        logger.info(f"Extracted {len(medications)} unique medications from patient data")
        return medications
    
    async def extract_condition_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract condition catalog from Condition resources."""
        cache_key = f"conditions_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting condition catalog from patient data")
        
        sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->>'text' as text,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'clinicalStatus') as clinical_statuses,
                array_agg(DISTINCT resource->>'verificationStatus') as verification_statuses,
                array_agg(DISTINCT resource->'severity'->'coding'->0->>'display') as severities,
                array_agg(DISTINCT resource->'category'->0->'coding'->0->>'display') as categories
            FROM fhir.resources 
            WHERE resource_type = 'Condition'
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY 
                resource->'code'->'coding'->0->>'code',
                resource->'code'->'coding'->0->>'display',
                resource->'code'->'coding'->0->>'system',
                resource->'code'->>'text'
            ORDER BY COUNT(*) DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(sql, {"limit": limit or 1000})
        
        conditions = []
        for row in result:
            condition = {
                "id": f"cond_{row.code}" if row.code else f"cond_{len(conditions)}",
                "code": row.code,
                "display": row.display or row.text or "Unknown condition",
                "system": row.system or "http://snomed.info/sct",
                "frequency_count": row.frequency,
                "clinical_statuses": [s for s in row.clinical_statuses if s] if row.clinical_statuses else [],
                "verification_statuses": [s for s in row.verification_statuses if s] if row.verification_statuses else [],
                "common_severities": [s for s in row.severities if s] if row.severities else [],
                "categories": [c for c in row.categories if c] if row.categories else [],
                "source": "patient_data"
            }
            conditions.append(condition)
        
        self._cache_result(cache_key, conditions)
        logger.info(f"Extracted {len(conditions)} unique conditions from patient data")
        return conditions
    
    async def extract_lab_test_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract lab test catalog from Observation resources with category=laboratory."""
        cache_key = f"lab_tests_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting lab test catalog from patient data")
        
        sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as loinc_code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->>'text' as text,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'status') as statuses,
                array_agg(DISTINCT resource->'valueQuantity'->>'unit') as units,
                PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY (resource->'valueQuantity'->>'value')::numeric) as p05,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (resource->'valueQuantity'->>'value')::numeric) as p95,
                AVG((resource->'valueQuantity'->>'value')::numeric) as avg_value,
                MIN((resource->'valueQuantity'->>'value')::numeric) as min_value,
                MAX((resource->'valueQuantity'->>'value')::numeric) as max_value
            FROM fhir.resources 
            WHERE resource_type = 'Observation'
            AND resource->'category'->0->'coding'->0->>'code' = 'laboratory'
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            AND resource->'valueQuantity'->>'value' IS NOT NULL
            GROUP BY 
                resource->'code'->'coding'->0->>'code',
                resource->'code'->'coding'->0->>'display',
                resource->'code'->'coding'->0->>'system',
                resource->'code'->>'text'
            ORDER BY COUNT(*) DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(sql, {"limit": limit or 1000})
        
        lab_tests = []
        for row in result:
            # Calculate reference range from actual data (5th to 95th percentile)
            reference_range = None
            if row.p05 is not None and row.p95 is not None:
                reference_range = {
                    "min": float(row.p05),
                    "max": float(row.p95),
                    "unit": row.units[0] if row.units and row.units[0] else "",
                    "interpretation": "calculated from patient data"
                }
            
            lab_test = {
                "id": f"lab_{row.loinc_code}" if row.loinc_code else f"lab_{len(lab_tests)}",
                "name": row.loinc_code,
                "display": row.display or row.text or "Unknown lab test",
                "loinc_code": row.loinc_code,
                "category": "laboratory",
                "specimen_type": "blood",  # Default, could be enhanced
                "reference_range": reference_range,
                "frequency_count": row.frequency,
                "common_statuses": [s for s in row.statuses if s] if row.statuses else [],
                "common_units": [u for u in row.units if u] if row.units else [],
                "value_statistics": {
                    "min": float(row.min_value) if row.min_value else None,
                    "max": float(row.max_value) if row.max_value else None,
                    "avg": float(row.avg_value) if row.avg_value else None
                },
                "source": "patient_data"
            }
            lab_tests.append(lab_test)
        
        self._cache_result(cache_key, lab_tests)
        logger.info(f"Extracted {len(lab_tests)} unique lab tests from patient data")
        return lab_tests
    
    async def extract_procedure_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract procedure catalog from Procedure resources."""
        cache_key = f"procedures_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting procedure catalog from patient data")
        
        sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->>'text' as text,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'status') as statuses,
                array_agg(DISTINCT resource->'category'->'coding'->0->>'display') as categories
            FROM fhir.resources 
            WHERE resource_type = 'Procedure'
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY 
                resource->'code'->'coding'->0->>'code',
                resource->'code'->'coding'->0->>'display',
                resource->'code'->'coding'->0->>'system',
                resource->'code'->>'text'
            ORDER BY COUNT(*) DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(sql, {"limit": limit or 1000})
        
        procedures = []
        for row in result:
            procedure = {
                "id": f"proc_{row.code}" if row.code else f"proc_{len(procedures)}",
                "code": row.code,
                "display": row.display or row.text or "Unknown procedure",
                "system": row.system or "http://snomed.info/sct",
                "frequency_count": row.frequency,
                "common_statuses": [s for s in row.statuses if s] if row.statuses else [],
                "categories": [c for c in row.categories if c] if row.categories else [],
                "source": "patient_data"
            }
            procedures.append(procedure)
        
        self._cache_result(cache_key, procedures)
        logger.info(f"Extracted {len(procedures)} unique procedures from patient data")
        return procedures
    
    async def get_catalog_statistics(self) -> Dict[str, Any]:
        """Get statistics about the extracted catalogs."""
        logger.info("Generating catalog statistics")
        
        # Get resource counts
        sql = text("""
            SELECT 
                resource_type,
                COUNT(*) as count
            FROM fhir.resources 
            WHERE resource_type IN ('Patient', 'MedicationRequest', 'MedicationStatement', 
                                   'Condition', 'Observation', 'Procedure')
            GROUP BY resource_type
            ORDER BY count DESC
        """)
        
        result = await self.db.execute(sql)
        resource_counts = {row.resource_type: row.count for row in result}
        
        # Get lab observation count specifically
        lab_sql = text("""
            SELECT COUNT(*) as lab_count
            FROM fhir.resources 
            WHERE resource_type = 'Observation'
            AND resource->'category'->0->'coding'->0->>'code' = 'laboratory'
        """)
        
        lab_result = await self.db.execute(lab_sql)
        lab_count = lab_result.scalar()
        
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
        logger.info("Refreshing all dynamic catalogs")
        
        self.cache.clear()  # Clear existing cache
        
        # Extract all catalogs
        medications = await self.extract_medication_catalog(limit)
        conditions = await self.extract_condition_catalog(limit)
        lab_tests = await self.extract_lab_test_catalog(limit)
        procedures = await self.extract_procedure_catalog(limit)
        statistics = await self.get_catalog_statistics()
        
        self.last_refresh = datetime.now()
        
        summary = {
            "refresh_time": self.last_refresh.isoformat(),
            "catalog_counts": {
                "medications": len(medications),
                "conditions": len(conditions),
                "lab_tests": len(lab_tests),
                "procedures": len(procedures)
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