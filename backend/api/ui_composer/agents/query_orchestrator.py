"""
Query Orchestrator
Executes complex FHIR query plans with dependency resolution and result management
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional, Set
from datetime import datetime
import json

from .fhir_query_builder import QueryPlan, QueryNode
from .fhir_http_client import FHIRHTTPClient

logger = logging.getLogger(__name__)

class QueryResult:
    """Container for query execution results"""
    def __init__(self, node_id: str, resource_type: str):
        self.node_id = node_id
        self.resource_type = resource_type
        self.bundle = None
        self.resources = []
        self.aggregated_data = {}
        self.execution_time = 0
        self.error = None
        
    def extract_resources(self):
        """Extract resources from bundle"""
        if self.bundle and "entry" in self.bundle:
            self.resources = [entry["resource"] for entry in self.bundle["entry"]]
    
    def get_ids(self) -> List[str]:
        """Get all resource IDs"""
        return [r.get("id") for r in self.resources if r.get("id")]
    
    def get_references(self, field: str) -> List[str]:
        """Get all references from a specific field"""
        refs = []
        for resource in self.resources:
            ref = resource.get(field, {}).get("reference")
            if ref:
                refs.append(ref)
        return refs

class QueryOrchestrator:
    """Orchestrates execution of complex FHIR query plans"""
    
    def __init__(self, base_url: str = "http://localhost:8000/fhir/R4"):
        self.base_url = base_url
        self.results_cache = {}
        self.execution_stats = {
            "total_queries": 0,
            "total_time": 0,
            "cache_hits": 0,
            "total_records": 0
        }
    
    async def execute_plan(self, plan: QueryPlan) -> Dict[str, QueryResult]:
        """Execute a query plan and return results"""
        results = {}
        start_time = datetime.now()
        
        logger.info(f"Executing query plan with {len(plan.nodes)} nodes")
        
        # Execute queries in dependency order
        for node_id in plan.execution_order:
            node = next((n for n in plan.nodes if n.id == node_id), None)
            if not node:
                logger.error(f"Node {node_id} not found in plan")
                continue
            
            # Resolve dependencies in filters
            resolved_filters = await self._resolve_filter_dependencies(node, results)
            node.filters.update(resolved_filters)
            
            # Execute the query
            result = await self._execute_node(node, results)
            results[node_id] = result
            
            # Apply aggregations if specified
            if node.aggregations:
                await self._apply_aggregations(result, node.aggregations)
        
        # Update execution stats
        self.execution_stats["total_queries"] += len(plan.nodes)
        self.execution_stats["total_time"] += (datetime.now() - start_time).total_seconds()
        self.execution_stats["total_records"] += sum(len(r.resources) for r in results.values())
        
        logger.info(f"Query plan execution completed in {self.execution_stats['total_time']:.2f}s")
        
        return results
    
    async def _execute_node(self, node: QueryNode, previous_results: Dict[str, QueryResult]) -> QueryResult:
        """Execute a single query node"""
        result = QueryResult(node.id, node.resource_type)
        start_time = datetime.now()
        
        try:
            # Check cache first
            cache_key = self._get_cache_key(node)
            if cache_key in self.results_cache:
                logger.info(f"Cache hit for node {node.id}")
                self.execution_stats["cache_hits"] += 1
                return self.results_cache[cache_key]
            
            # Build FHIR parameters
            params = node.to_fhir_params()
            
            # Add default parameters for optimization
            if "_count" not in params:
                params["_count"] = "1000"  # Default limit
            if "_sort" not in params and node.resource_type == "Observation":
                params["_sort"] = "-date"  # Sort observations by date
            
            logger.info(f"Executing query for {node.resource_type} with params: {params}")
            
            # Execute the query
            async with FHIRHTTPClient(self.base_url) as client:
                bundle = await client.search_resources(node.resource_type, params)
                result.bundle = bundle
                result.extract_resources()
            
            # Handle pagination if needed
            total = bundle.get("total", 0)
            if total > len(result.resources) and total <= 5000:  # Reasonable limit
                await self._fetch_remaining_pages(result, bundle, params)
            
            # Cache the result
            self.results_cache[cache_key] = result
            
            logger.info(f"Query {node.id} returned {len(result.resources)} resources")
            
        except Exception as e:
            logger.error(f"Error executing query {node.id}: {e}")
            result.error = str(e)
        
        result.execution_time = (datetime.now() - start_time).total_seconds()
        return result
    
    async def _resolve_filter_dependencies(self, node: QueryNode, previous_results: Dict[str, QueryResult]) -> Dict[str, Any]:
        """Resolve filter values that depend on previous query results"""
        resolved = {}
        
        for param, value in node.filters.items():
            if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
                # This is a reference to previous results
                ref = value[1:-1]  # Remove {}
                parts = ref.split(".")
                
                if len(parts) >= 2:
                    source_id = parts[0]
                    field = parts[1]
                    
                    if source_id in previous_results:
                        source_result = previous_results[source_id]
                        
                        if field == "subjects" or field == "ids":
                            # Get all patient/resource IDs
                            ids = source_result.get_ids()
                            if ids:
                                # Format for FHIR search
                                resolved[param] = ",".join([f"{source_result.resource_type}/{id}" for id in ids])
                        elif field == "references":
                            # Get references from a specific field
                            refs = source_result.get_references(parts[2] if len(parts) > 2 else "subject")
                            if refs:
                                resolved[param] = ",".join(refs)
                        else:
                            # Get specific field values
                            values = []
                            for resource in source_result.resources:
                                value = self._extract_field_value(resource, field)
                                if value:
                                    values.append(value)
                            if values:
                                resolved[param] = ",".join(values)
            else:
                resolved[param] = value
        
        return resolved
    
    async def _apply_aggregations(self, result: QueryResult, aggregations: List[Dict[str, Any]]):
        """Apply aggregations to query results"""
        for agg in aggregations:
            agg_type = agg.get("type")
            
            if agg_type == "latest_per_patient":
                # Group by patient and keep only latest
                patient_map = {}
                for resource in result.resources:
                    patient_ref = resource.get("subject", {}).get("reference", "")
                    date = resource.get("effectiveDateTime") or resource.get("authoredOn") or resource.get("recordedDate")
                    
                    if patient_ref and date:
                        if patient_ref not in patient_map or date > patient_map[patient_ref]["date"]:
                            patient_map[patient_ref] = {"resource": resource, "date": date}
                
                # Replace resources with only latest per patient
                result.resources = [item["resource"] for item in patient_map.values()]
                result.aggregated_data["latest_per_patient"] = True
            
            elif agg_type == "count":
                # Count by specified field
                group_by = agg.get("groupBy", "subject")
                counts = {}
                
                for resource in result.resources:
                    key = self._extract_field_value(resource, group_by)
                    if key:
                        counts[key] = counts.get(key, 0) + 1
                
                result.aggregated_data[f"count_by_{group_by}"] = counts
            
            elif agg_type == "avg":
                # Calculate average of numeric values
                field = agg.get("field")
                group_by = agg.get("groupBy")
                
                if group_by:
                    # Average per group
                    groups = {}
                    for resource in result.resources:
                        group_key = self._extract_field_value(resource, group_by)
                        value = self._extract_numeric_value(resource, field)
                        
                        if group_key and value is not None:
                            if group_key not in groups:
                                groups[group_key] = []
                            groups[group_key].append(value)
                    
                    averages = {k: sum(v) / len(v) for k, v in groups.items() if v}
                    result.aggregated_data[f"avg_{field}_by_{group_by}"] = averages
                else:
                    # Overall average
                    values = [self._extract_numeric_value(r, field) for r in result.resources]
                    values = [v for v in values if v is not None]
                    if values:
                        result.aggregated_data[f"avg_{field}"] = sum(values) / len(values)
    
    async def _fetch_remaining_pages(self, result: QueryResult, initial_bundle: Dict[str, Any], params: Dict[str, Any]):
        """Fetch remaining pages of results"""
        next_link = None
        for link in initial_bundle.get("link", []):
            if link.get("relation") == "next":
                next_link = link.get("url")
                break
        
        pages_fetched = 1
        max_pages = 5  # Limit to prevent excessive fetching
        
        while next_link and pages_fetched < max_pages:
            async with FHIRHTTPClient() as client:
                # Extract the full URL or construct from relative
                if next_link.startswith("http"):
                    response = await client.client.get(next_link)
                    next_bundle = response.json()
                else:
                    # Parse parameters from next link
                    # This is simplified - in production, parse the URL properly
                    next_bundle = await client.search_resources(result.resource_type, params)
                
                if next_bundle.get("entry"):
                    result.resources.extend([e["resource"] for e in next_bundle["entry"]])
                
                # Find next link
                next_link = None
                for link in next_bundle.get("link", []):
                    if link.get("relation") == "next":
                        next_link = link.get("url")
                        break
                
                pages_fetched += 1
    
    def _extract_field_value(self, resource: Dict[str, Any], field_path: str) -> Optional[str]:
        """Extract value from nested field path"""
        parts = field_path.split(".")
        value = resource
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            elif isinstance(value, list) and value:
                # Take first item for now
                value = value[0].get(part) if isinstance(value[0], dict) else None
            else:
                return None
        
        return str(value) if value is not None else None
    
    def _extract_numeric_value(self, resource: Dict[str, Any], field_path: str) -> Optional[float]:
        """Extract numeric value from field"""
        value = self._extract_field_value(resource, field_path)
        if value:
            try:
                return float(value)
            except (ValueError, TypeError):
                pass
        
        # Try common numeric field patterns
        if "valueQuantity" in resource:
            return resource["valueQuantity"].get("value")
        
        return None
    
    def _get_cache_key(self, node: QueryNode) -> str:
        """Generate cache key for a query node"""
        # Create a deterministic key from node properties
        key_parts = [
            node.resource_type,
            json.dumps(node.filters, sort_keys=True),
            ",".join(sorted(node.includes)),
            ",".join(sorted(node.revincludes))
        ]
        return "|".join(key_parts)
    
    def get_execution_stats(self) -> Dict[str, Any]:
        """Get execution statistics"""
        return {
            **self.execution_stats,
            "cache_size": len(self.results_cache),
            "avg_query_time": self.execution_stats["total_time"] / max(1, self.execution_stats["total_queries"])
        }
    
    def clear_cache(self):
        """Clear the results cache"""
        self.results_cache.clear()
        logger.info("Query cache cleared")