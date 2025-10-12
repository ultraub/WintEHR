"""
CDS Hooks Prefetch Query Execution Engine
Handles parsing and executing FHIR prefetch templates for CDS Hooks optimization
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import re
import json
import logging
import asyncio
from urllib.parse import quote
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from services.fhir_client_config import get_resource, search_resources

logger = logging.getLogger(__name__)

class PrefetchEngine:
    """Executes FHIR prefetch queries for CDS Hooks"""
    
    # Common prefetch patterns
    COMMON_PREFETCH_TEMPLATES = {
        'patient': 'Patient/{{context.patientId}}',
        'medications': 'MedicationRequest?patient={{context.patientId}}&status=active',
        'conditions': 'Condition?patient={{context.patientId}}&clinical-status=active',
        'allergies': 'AllergyIntolerance?patient={{context.patientId}}',
        'observations': 'Observation?patient={{context.patientId}}&category=vital-signs&_count=10',
        'labResults': 'Observation?patient={{context.patientId}}&category=laboratory&_count=20',
        'encounters': 'Encounter?patient={{context.patientId}}&_count=5&_sort=-date',
        'procedures': 'Procedure?patient={{context.patientId}}&_count=10',
        'immunizations': 'Immunization?patient={{context.patientId}}',
        'carePlans': 'CarePlan?patient={{context.patientId}}&status=active'
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.token_pattern = re.compile(r'\{\{([^}]+)\}\}')
    
    async def execute_prefetch(self, 
                             prefetch_config: Dict[str, str], 
                             context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute all prefetch queries defined in the configuration"""
        results = {}
        
        # Execute queries in parallel for performance
        tasks = []
        for key, template in prefetch_config.items():
            task = self._execute_single_prefetch(key, template, context)
            tasks.append(task)
        
        if tasks:
            completed_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Combine results
            for idx, (key, _) in enumerate(prefetch_config.items()):
                result = completed_results[idx]
                if isinstance(result, Exception):
                    logger.error(f"Prefetch error for {key}: {result}")
                    results[key] = None
                else:
                    results[key] = result
        
        return results
    
    async def _execute_single_prefetch(self, 
                                     key: str, 
                                     template: str, 
                                     context: Dict[str, Any]) -> Any:
        """Execute a single prefetch query"""
        try:
            # Replace tokens in template
            query = self._replace_tokens(template, context)
            
            # Parse query to determine resource type and parameters
            resource_type, params = self._parse_query(query)
            
            # Execute appropriate query based on resource type
            if '/' in resource_type:
                # Direct resource fetch (e.g., Patient/123)
                return await self._fetch_resource_by_id(resource_type)
            else:
                # Search query
                return await self._search_resources(resource_type, params)
            
        except Exception as e:
            logger.error(f"Error executing prefetch for {key}: {e}")
            raise
    
    def _replace_tokens(self, template: str, context: Dict[str, Any]) -> str:
        """Replace template tokens with actual values from context"""
        def replace_token(match):
            token_path = match.group(1)
            parts = token_path.split('.')
            
            # Navigate through context to find value
            value = context
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    logger.warning(f"Token path {token_path} not found in context")
                    return match.group(0)  # Return original if not found
            
            return str(value)
        
        return self.token_pattern.sub(replace_token, template)
    
    def _parse_query(self, query: str) -> Tuple[str, Dict[str, str]]:
        """Parse FHIR query into resource type and parameters"""
        if '?' in query:
            resource_part, param_part = query.split('?', 1)
            params = {}
            
            # Parse URL parameters
            for param in param_part.split('&'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    params[key] = value
            
            return resource_part, params
        else:
            return query, {}
    
    async def _fetch_resource_by_id(self, resource_path: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific resource by ID using HAPI FHIR"""
        try:
            parts = resource_path.split('/')
            if len(parts) != 2:
                logger.warning(f"Invalid resource path: {resource_path}")
                return None

            resource_type, resource_id = parts

            # Get resource from HAPI FHIR
            resource = get_resource(resource_type, resource_id)

            if resource:
                # Convert fhirclient resource to dict
                return resource.as_json() if hasattr(resource, 'as_json') else None

            return None

        except Exception as e:
            logger.error(f"Error fetching resource {resource_path}: {e}")
            return None
    
    async def _search_resources(self,
                              resource_type: str,
                              params: Dict[str, str]) -> Dict[str, Any]:
        """Search for resources based on parameters using HAPI FHIR"""
        try:
            # Build search parameters for HAPI FHIR
            search_params = {}

            # Handle common search parameters
            if 'patient' in params:
                search_params['patient'] = params['patient']

            if 'status' in params:
                search_params['status'] = params['status']

            if 'clinical-status' in params:
                search_params['clinical-status'] = params['clinical-status']

            if 'category' in params:
                search_params['category'] = params['category']

            # Handle date filtering
            if 'date' in params:
                search_params['date'] = params['date']

            # Handle count parameter
            if '_count' in params:
                search_params['_count'] = params['_count']

            # Handle sort parameter
            if '_sort' in params:
                search_params['_sort'] = params['_sort']

            # Search resources from HAPI FHIR
            resources = search_resources(resource_type, search_params)

            # Create bundle response
            bundle = {
                'resourceType': 'Bundle',
                'type': 'searchset',
                'total': len(resources) if resources else 0,
                'entry': [
                    {
                        'resource': resource.as_json() if hasattr(resource, 'as_json') else resource,
                        'fullUrl': f"{resource_type}/{resource.id if hasattr(resource, 'id') else resource.get('id')}"
                    }
                    for resource in (resources or [])
                ]
            }

            return bundle
            
        except Exception as e:
            logger.error(f"Error searching resources: {e}")
            return {
                'resourceType': 'Bundle',
                'type': 'searchset',
                'total': 0,
                'entry': []
            }
    
    def get_recommended_prefetch(self, hook_type: str) -> Dict[str, str]:
        """Get recommended prefetch configuration for a hook type"""
        recommendations = {
            'patient-view': {
                'patient': self.COMMON_PREFETCH_TEMPLATES['patient'],
                'conditions': self.COMMON_PREFETCH_TEMPLATES['conditions'],
                'medications': self.COMMON_PREFETCH_TEMPLATES['medications'],
                'allergies': self.COMMON_PREFETCH_TEMPLATES['allergies'],
                'recentLabs': self.COMMON_PREFETCH_TEMPLATES['labResults']
            },
            'medication-prescribe': {
                'patient': self.COMMON_PREFETCH_TEMPLATES['patient'],
                'medications': self.COMMON_PREFETCH_TEMPLATES['medications'],
                'allergies': self.COMMON_PREFETCH_TEMPLATES['allergies'],
                'conditions': self.COMMON_PREFETCH_TEMPLATES['conditions']
            },
            'order-select': {
                'patient': self.COMMON_PREFETCH_TEMPLATES['patient'],
                'recentOrders': 'ServiceRequest?patient={{context.patientId}}&_count=10&_sort=-authored'
            },
            'order-sign': {
                'patient': self.COMMON_PREFETCH_TEMPLATES['patient'],
                'draftOrders': 'ServiceRequest?patient={{context.patientId}}&status=draft'
            },
            'encounter-start': {
                'patient': self.COMMON_PREFETCH_TEMPLATES['patient'],
                'encounter': 'Encounter/{{context.encounterId}}',
                'conditions': self.COMMON_PREFETCH_TEMPLATES['conditions'],
                'medications': self.COMMON_PREFETCH_TEMPLATES['medications']
            },
            'encounter-discharge': {
                'patient': self.COMMON_PREFETCH_TEMPLATES['patient'],
                'encounter': 'Encounter/{{context.encounterId}}',
                'medications': self.COMMON_PREFETCH_TEMPLATES['medications'],
                'procedures': 'Procedure?encounter={{context.encounterId}}'
            }
        }
        
        return recommendations.get(hook_type, {})
    
    async def analyze_prefetch_patterns(self, 
                                      service_id: str, 
                                      days: int = 30) -> Dict[str, Any]:
        """Analyze prefetch usage patterns for optimization"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            query = text("""
                SELECT 
                    request_data->'prefetch' as prefetch_config,
                    execution_time_ms,
                    created_at
                FROM cds_hooks.execution_log
                WHERE service_id = :service_id
                AND created_at >= :cutoff_date
                AND success = true
                ORDER BY created_at DESC
                LIMIT 1000
            """)
            
            result = await self.db.execute(query, {
                'service_id': service_id,
                'cutoff_date': cutoff_date
            })
            
            rows = result.fetchall()
            
            # Analyze patterns
            total_executions = len(rows)
            prefetch_usage = {}
            avg_execution_time = 0
            
            if rows:
                total_time = sum(row.execution_time_ms for row in rows)
                avg_execution_time = total_time / total_executions
                
                # Count prefetch key usage
                for row in rows:
                    if row.prefetch_config:
                        config = row.prefetch_config if isinstance(row.prefetch_config, dict) else json.loads(row.prefetch_config)
                        for key in config.keys():
                            prefetch_usage[key] = prefetch_usage.get(key, 0) + 1
            
            # Calculate usage percentages
            prefetch_percentages = {
                key: (count / total_executions * 100) 
                for key, count in prefetch_usage.items()
            } if total_executions > 0 else {}
            
            return {
                'service_id': service_id,
                'analysis_period_days': days,
                'total_executions': total_executions,
                'average_execution_time_ms': round(avg_execution_time, 2),
                'prefetch_usage': prefetch_usage,
                'prefetch_usage_percentage': prefetch_percentages,
                'recommendations': self._generate_prefetch_recommendations(
                    prefetch_percentages, 
                    avg_execution_time
                )
            }
            
        except Exception as e:
            logger.error(f"Error analyzing prefetch patterns: {e}")
            return {}
    
    def _generate_prefetch_recommendations(self, 
                                         usage_percentages: Dict[str, float],
                                         avg_execution_time: float) -> List[str]:
        """Generate recommendations based on usage patterns"""
        recommendations = []
        
        # High usage prefetch items (>80%)
        high_usage = [k for k, v in usage_percentages.items() if v > 80]
        if high_usage:
            recommendations.append(
                f"Consider caching these frequently used prefetch items: {', '.join(high_usage)}"
            )
        
        # Low usage prefetch items (<20%)
        low_usage = [k for k, v in usage_percentages.items() if v < 20]
        if low_usage:
            recommendations.append(
                f"Consider removing these rarely used prefetch items: {', '.join(low_usage)}"
            )
        
        # Performance recommendations
        if avg_execution_time > 500:
            recommendations.append(
                "Average execution time is high. Consider implementing caching or reducing prefetch scope."
            )
        
        return recommendations

# Utility functions for integration
async def get_prefetch_engine(db: AsyncSession) -> PrefetchEngine:
    """Get a prefetch engine instance"""
    return PrefetchEngine(db)

async def execute_hook_prefetch(db: AsyncSession, 
                              prefetch_config: Dict[str, str],
                              context: Dict[str, Any]) -> Dict[str, Any]:
    """Execute prefetch queries for a CDS hook"""
    try:
        engine = await get_prefetch_engine(db)
        return await engine.execute_prefetch(prefetch_config, context)
    except Exception as e:
        logger.error(f"Error executing prefetch: {e}")
        return {}