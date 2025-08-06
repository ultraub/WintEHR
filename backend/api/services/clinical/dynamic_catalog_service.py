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
    
    async def extract_imaging_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract imaging catalog from ImagingStudy and DiagnosticReport resources."""
        cache_key = f"imaging_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting imaging catalog from patient data")
        
        # Query ImagingStudy resources
        sql = text("""
            SELECT DISTINCT 
                resource->'modality'->0->'code' as modality_code,
                resource->'modality'->0->'display' as modality_display,
                resource->>'description' as description,
                resource->'procedureCode'->0->'coding'->0->>'code' as procedure_code,
                resource->'procedureCode'->0->'coding'->0->>'display' as procedure_display,
                resource->'bodySite'->0->'display' as body_site,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'status') as statuses
            FROM fhir.resources 
            WHERE resource_type = 'ImagingStudy'
            AND resource->>'modality' IS NOT NULL
            GROUP BY modality_code, modality_display, description, procedure_code, procedure_display, body_site
            """)
        
        if limit:
            sql = text(sql.text + f" ORDER BY frequency DESC LIMIT {limit}")
        else:
            sql = text(sql.text + " ORDER BY frequency DESC")
        
        result = await self.db.execute(sql)
        imaging_studies = []
        
        for row in result:
            # Determine modality from code
            modality_code = row.modality_code if row.modality_code else ""
            modality_map = {
                "CT": "CT", "MR": "MR", "US": "US", "CR": "CR", "DX": "DX",
                "NM": "NM", "PT": "PET", "XA": "XA", "MG": "MG"
            }
            modality = modality_map.get(modality_code, modality_code)
            
            # Build display name
            display_name = row.procedure_display or row.description
            if not display_name and row.modality_display and row.body_site:
                display_name = f"{row.modality_display} {row.body_site}"
            elif not display_name and row.modality_display:
                display_name = row.modality_display
            
            imaging_study = {
                "code": row.procedure_code or f"{modality_code}_{row.body_site}".replace(" ", "_"),
                "display": display_name or "Imaging Study",
                "modality": modality,
                "body_site": row.body_site,
                "cpt_code": row.procedure_code,
                "frequency": row.frequency,
                "statuses": [s for s in row.statuses if s] if row.statuses else [],
                "usage_count": row.frequency,
                "source": "patient_data"
            }
            imaging_studies.append(imaging_study)
        
        # Also check DiagnosticReport resources for imaging
        diag_sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'category'->0->'coding'->0->>'code' as category_code,
                COUNT(*) as frequency
            FROM fhir.resources 
            WHERE resource_type = 'DiagnosticReport'
            AND resource->'category'->0->'coding'->0->>'code' IN ('RAD', 'IMG', 'RUS', 'VUS', 'OUS')
            GROUP BY code, display, category_code
            """)
        
        if limit:
            remaining_limit = limit - len(imaging_studies)
            if remaining_limit > 0:
                diag_sql = text(diag_sql.text + f" ORDER BY frequency DESC LIMIT {remaining_limit}")
        else:
            diag_sql = text(diag_sql.text + " ORDER BY frequency DESC")
        
        diag_result = await self.db.execute(diag_sql)
        
        for row in diag_result:
            # Map category codes to modalities
            category_to_modality = {
                "RAD": "CR", "IMG": "CT", "RUS": "US", "VUS": "US", "OUS": "US"
            }
            modality = category_to_modality.get(row.category_code, "OT")
            
            imaging_study = {
                "code": row.code or f"DIAG_{row.category_code}",
                "display": row.display or "Diagnostic Imaging",
                "modality": modality,
                "category": row.category_code,
                "frequency": row.frequency,
                "usage_count": row.frequency,
                "source": "diagnostic_reports"
            }
            imaging_studies.append(imaging_study)
        
        self._cache_result(cache_key, imaging_studies)
        logger.info(f"Extracted {len(imaging_studies)} unique imaging studies from patient data")
        return imaging_studies
    
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
    
    async def extract_order_set_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract order sets from CarePlan and PlanDefinition resources."""
        cache_key = f"order_sets_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting order set catalog from patient data")
        
        order_sets = []
        
        # Extract from CarePlan resources (active care plans can represent order sets)
        care_plan_sql = text("""
            SELECT 
                resource->>'id' as id,
                resource->>'title' as title,
                resource->>'description' as description,
                resource->'category'->0->'coding'->0->>'display' as category,
                resource->>'status' as status,
                resource->'activity' as activities,
                COUNT(*) OVER (PARTITION BY resource->>'title') as usage_count
            FROM fhir.resources 
            WHERE resource_type = 'CarePlan'
            AND resource->>'title' IS NOT NULL
            GROUP BY id, title, description, category, status, activities
            ORDER BY usage_count DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(care_plan_sql, {"limit": limit or 100})
        
        for row in result:
            # Parse activities to extract order items
            items = []
            if row.activities:
                try:
                    activities = json.loads(row.activities) if isinstance(row.activities, str) else row.activities
                    for activity in activities:
                        detail = activity.get('detail', {})
                        if detail:
                            item = {
                                "type": detail.get('kind', 'Unknown'),
                                "code": detail.get('code', {}).get('coding', [{}])[0].get('code'),
                                "display": detail.get('code', {}).get('text', detail.get('description', '')),
                                "status": detail.get('status', 'unknown')
                            }
                            if item['display']:  # Only add if we have a display name
                                items.append(item)
                except Exception as e:
                    logger.warning(f"Error parsing activities for CarePlan {row.id}: {e}")
            
            order_set = {
                "id": f"careplan_{row.id}",
                "name": row.title or f"Care Plan {row.id}",
                "description": row.description,
                "category": row.category or "Clinical",
                "specialty": None,  # Could be extracted from context
                "items": items,
                "usage_count": row.usage_count or 0,
                "source": "care_plans",
                "is_active": row.status in ['active', 'draft']
            }
            order_sets.append(order_set)
        
        # Extract from PlanDefinition resources if available
        plan_def_sql = text("""
            SELECT 
                resource->>'id' as id,
                resource->>'title' as title,
                resource->>'description' as description,
                resource->'type'->'coding'->0->>'display' as type_display,
                resource->>'status' as status,
                resource->'action' as actions,
                resource->'useContext' as use_context
            FROM fhir.resources 
            WHERE resource_type = 'PlanDefinition'
            AND resource->>'title' IS NOT NULL
        """)
        
        if limit:
            remaining_limit = limit - len(order_sets)
            if remaining_limit > 0:
                plan_def_sql = text(plan_def_sql.text + f" LIMIT {remaining_limit}")
        
        plan_result = await self.db.execute(plan_def_sql)
        
        for row in plan_result:
            # Parse actions to extract order items
            items = []
            if row.actions:
                try:
                    actions = json.loads(row.actions) if isinstance(row.actions, str) else row.actions
                    for action in actions:
                        item = {
                            "type": action.get('type', {}).get('coding', [{}])[0].get('display', 'Action'),
                            "code": action.get('code', [{}])[0].get('coding', [{}])[0].get('code') if action.get('code') else None,
                            "display": action.get('title', action.get('description', '')),
                            "status": "active"  # PlanDefinitions are templates
                        }
                        if item['display']:
                            items.append(item)
                except Exception as e:
                    logger.warning(f"Error parsing actions for PlanDefinition {row.id}: {e}")
            
            # Extract specialty from use context if available
            specialty = None
            if row.use_context:
                try:
                    use_contexts = json.loads(row.use_context) if isinstance(row.use_context, str) else row.use_context
                    for context in use_contexts:
                        if context.get('code', {}).get('code') == 'focus':
                            specialty = context.get('valueCodeableConcept', {}).get('coding', [{}])[0].get('display')
                            break
                except Exception:
                    pass
            
            order_set = {
                "id": f"plandef_{row.id}",
                "name": row.title or f"Plan Definition {row.id}",
                "description": row.description,
                "category": row.type_display or "Clinical Protocol",
                "specialty": specialty,
                "items": items,
                "usage_count": 0,  # PlanDefinitions don't have direct usage counts
                "source": "plan_definitions",
                "is_active": row.status == 'active'
            }
            order_sets.append(order_set)
        
        # Also create some common order sets from patterns in the data
        common_order_sets = await self._extract_common_order_patterns(limit)
        order_sets.extend(common_order_sets)
        
        self._cache_result(cache_key, order_sets)
        logger.info(f"Extracted {len(order_sets)} order sets from patient data")
        return order_sets
    
    async def _extract_common_order_patterns(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract common ordering patterns from ServiceRequest and MedicationRequest resources."""
        order_sets = []
        
        # Find common grouped orders (orders placed within same encounter/time window)
        grouped_orders_sql = text("""
            WITH order_groups AS (
                SELECT 
                    resource->>'encounter' as encounter_ref,
                    DATE_TRUNC('hour', (resource->'authoredOn')::timestamp) as order_hour,
                    array_agg(DISTINCT jsonb_build_object(
                        'type', 'ServiceRequest',
                        'code', resource->'code'->'coding'->0->>'code',
                        'display', COALESCE(
                            resource->'code'->'coding'->0->>'display',
                            resource->'code'->>'text'
                        )
                    )) as service_requests
                FROM fhir.resources
                WHERE resource_type = 'ServiceRequest'
                AND resource->>'encounter' IS NOT NULL
                AND resource->>'authoredOn' IS NOT NULL
                GROUP BY encounter_ref, order_hour
                HAVING COUNT(*) > 2  -- Groups with more than 2 orders
            )
            SELECT 
                service_requests,
                COUNT(*) as frequency
            FROM order_groups
            GROUP BY service_requests
            ORDER BY frequency DESC
            LIMIT 10
        """)
        
        result = await self.db.execute(grouped_orders_sql)
        
        for idx, row in enumerate(result):
            if row.service_requests:
                items = []
                try:
                    # Parse the service requests
                    requests = json.loads(row.service_requests) if isinstance(row.service_requests, str) else row.service_requests
                    for req in requests:
                        if req.get('display'):
                            items.append({
                                "type": req.get('type', 'ServiceRequest'),
                                "code": req.get('code'),
                                "display": req.get('display'),
                                "status": "active"
                            })
                except Exception as e:
                    logger.warning(f"Error parsing grouped orders: {e}")
                    continue
                
                if len(items) >= 3:  # Only include sets with at least 3 items
                    # Try to categorize the order set based on the items
                    category = self._categorize_order_set(items)
                    
                    order_set = {
                        "id": f"pattern_{idx + 1}",
                        "name": f"{category} Order Set {idx + 1}",
                        "description": f"Common {category.lower()} orders frequently placed together",
                        "category": category,
                        "specialty": None,
                        "items": items[:10],  # Limit items
                        "usage_count": row.frequency,
                        "source": "order_patterns",
                        "is_active": True
                    }
                    order_sets.append(order_set)
        
        return order_sets[:limit] if limit else order_sets
    
    def _categorize_order_set(self, items: List[Dict[str, Any]]) -> str:
        """Categorize an order set based on its items."""
        item_displays = [item.get('display', '').lower() for item in items]
        all_text = ' '.join(item_displays)
        
        # Simple categorization based on keywords
        if any(word in all_text for word in ['lab', 'blood', 'urine', 'culture']):
            return "Laboratory"
        elif any(word in all_text for word in ['xray', 'ct', 'mri', 'ultrasound', 'imaging']):
            return "Radiology"
        elif any(word in all_text for word in ['admission', 'admit', 'discharge']):
            return "Admission"
        elif any(word in all_text for word in ['emergency', 'ed', 'urgent']):
            return "Emergency"
        elif any(word in all_text for word in ['surgery', 'operative', 'pre-op', 'post-op']):
            return "Surgical"
        else:
            return "General"
    
    async def extract_vaccine_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract vaccine/immunization catalog from Immunization resources."""
        cache_key = f"vaccines_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting vaccine catalog from patient data")
        
        sql = text("""
            SELECT DISTINCT 
                resource->'vaccineCode'->'coding'->0->>'code' as cvx_code,
                resource->'vaccineCode'->'coding'->0->>'display' as display,
                resource->'vaccineCode'->>'text' as text,
                resource->'manufacturer'->>'display' as manufacturer,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'status') as statuses,
                array_agg(DISTINCT resource->'route'->'coding'->0->>'display') as routes,
                array_agg(DISTINCT resource->'site'->'coding'->0->>'display') as sites
            FROM fhir.resources 
            WHERE resource_type = 'Immunization'
            AND resource->'vaccineCode'->'coding'->0->>'code' IS NOT NULL
            GROUP BY cvx_code, display, text, manufacturer
            ORDER BY COUNT(*) DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(sql, {"limit": limit or 1000})
        
        vaccines = []
        for row in result:
            vaccine = {
                "id": f"vax_{row.cvx_code}" if row.cvx_code else f"vax_{len(vaccines)}",
                "vaccine_code": row.cvx_code,
                "vaccine_name": row.display or row.text or "Unknown vaccine",
                "cvx_code": row.cvx_code,
                "manufacturer": row.manufacturer,
                "frequency_count": row.frequency,
                "common_statuses": [s for s in row.statuses if s] if row.statuses else [],
                "common_routes": [r for r in row.routes if r] if row.routes else [],
                "common_sites": [s for s in row.sites if s] if row.sites else [],
                "usage_count": row.frequency,
                "source": "patient_data"
            }
            vaccines.append(vaccine)
        
        self._cache_result(cache_key, vaccines)
        logger.info(f"Extracted {len(vaccines)} unique vaccines from patient data")
        return vaccines
    
    async def extract_allergy_catalog(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Extract allergy catalog from AllergyIntolerance resources."""
        cache_key = f"allergies_{limit}"
        if self._is_cached(cache_key):
            return self.cache[cache_key]
        
        logger.info("Extracting allergy catalog from patient data")
        
        sql = text("""
            SELECT DISTINCT 
                resource->'code'->'coding'->0->>'code' as code,
                resource->'code'->'coding'->0->>'display' as display,
                resource->'code'->'coding'->0->>'system' as system,
                resource->'code'->>'text' as text,
                resource->'category'->0 as category,
                COUNT(*) as frequency,
                array_agg(DISTINCT resource->>'type') as types,
                array_agg(DISTINCT resource->>'criticality') as criticalities,
                array_agg(DISTINCT reaction->'manifestation'->0->'coding'->0->>'display') as reactions
            FROM fhir.resources,
                 jsonb_array_elements(resource->'reaction') as reaction
            WHERE resource_type = 'AllergyIntolerance'
            AND resource->'code'->'coding'->0->>'code' IS NOT NULL
            GROUP BY code, display, system, text, category
            ORDER BY COUNT(*) DESC
            LIMIT :limit
        """)
        
        result = await self.db.execute(sql, {"limit": limit or 1000})
        
        allergies = []
        for row in result:
            # Determine allergy type from category
            allergen_type = "other"
            if row.category:
                category_str = row.category if isinstance(row.category, str) else str(row.category).lower()
                if 'medication' in category_str:
                    allergen_type = "medication"
                elif 'food' in category_str:
                    allergen_type = "food"
                elif 'environment' in category_str:
                    allergen_type = "environmental"
            
            allergy = {
                "id": f"allergy_{row.code}" if row.code else f"allergy_{len(allergies)}",
                "allergen_code": row.code,
                "allergen_name": row.display or row.text or "Unknown allergen",
                "allergen_type": allergen_type,
                "system": row.system,
                "frequency_count": row.frequency,
                "common_types": [t for t in row.types if t] if row.types else [],
                "criticality_levels": [c for c in row.criticalities if c] if row.criticalities else [],
                "common_reactions": [r for r in row.reactions if r] if row.reactions else [],
                "usage_count": row.frequency,
                "source": "patient_data"
            }
            
            # Add RxNorm code for medication allergies
            if allergen_type == "medication" and row.system == "http://www.nlm.nih.gov/research/umls/rxnorm":
                allergy["rxnorm_code"] = row.code
            
            allergies.append(allergy)
        
        self._cache_result(cache_key, allergies)
        logger.info(f"Extracted {len(allergies)} unique allergies from patient data")
        return allergies
    
    def clear_cache(self) -> None:
        """Clear all cached results."""
        self.cache.clear()
        logger.info("Dynamic catalog cache cleared")