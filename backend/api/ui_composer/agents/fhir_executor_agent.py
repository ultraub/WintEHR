#!/usr/bin/env python3
"""
FHIR Executor Agent
Executes FHIR queries planned by FHIRQueryPlannerAgent and retrieves real data
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from .fhir_http_client import FHIRHTTPClient
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class FHIRExecutorAgent:
    """Agent that executes FHIR queries and retrieves real data from the database"""
    
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self.status = 'idle'
        self.last_execution = None
    
    async def execute_query_plan(self, query_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a query plan created by FHIRQueryPlannerAgent
        
        Args:
            query_plan: Query plan with FHIR queries to execute
        
        Returns:
            Dict containing execution results with real FHIR data
        """
        try:
            self.status = 'executing'
            
            execution_results = {
                "scope": query_plan.get("scope", "unknown"),
                "totalQueries": len(query_plan.get("queries", [])),
                "queryResults": {},
                "aggregatedData": {},
                "dataStatistics": {},
                "executionSummary": {
                    "successful": 0,
                    "failed": 0,
                    "totalRecords": 0,
                    "executionTime": None
                }
            }
            
            start_time = datetime.now()
            
            # Execute each query in the plan
            for i, query in enumerate(query_plan.get("queries", [])):
                query_id = f"query_{i}_{query.get('resourceType', 'unknown')}"
                
                try:
                    logger.info(f"Executing query {query_id}: {query.get('purpose', 'No purpose specified')}")
                    
                    # Execute the FHIR query
                    result = await self._execute_single_query(query)
                    
                    execution_results["queryResults"][query_id] = {
                        "query": query,
                        "result": result,
                        "success": True,
                        "recordCount": self._count_records(result)
                    }
                    
                    # Perform aggregations if specified
                    if query.get("aggregations"):
                        aggregated = await self._perform_aggregations(result, query["aggregations"])
                        execution_results["aggregatedData"][query_id] = aggregated
                    
                    execution_results["executionSummary"]["successful"] += 1
                    execution_results["executionSummary"]["totalRecords"] += self._count_records(result)
                    
                except Exception as e:
                    logger.error(f"Error executing query {query_id}: {e}")
                    execution_results["queryResults"][query_id] = {
                        "query": query,
                        "success": False,
                        "error": str(e)
                    }
                    execution_results["executionSummary"]["failed"] += 1
            
            # Calculate execution time
            end_time = datetime.now()
            execution_results["executionSummary"]["executionTime"] = (end_time - start_time).total_seconds()
            
            # Generate data statistics
            execution_results["dataStatistics"] = self._generate_data_statistics(execution_results["queryResults"])
            
            self.last_execution = execution_results
            self.status = 'complete'
            
            return {
                "success": True,
                "executionResults": execution_results,
                "reasoning": f"Executed {execution_results['executionSummary']['successful']} queries successfully, retrieved {execution_results['executionSummary']['totalRecords']} total records"
            }
            
        except Exception as e:
            self.status = 'error'
            logger.error(f"Error executing query plan: {e}")
            raise
    
    async def _execute_single_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single FHIR query"""
        resource_type = query.get("resourceType")
        search_params = query.get("searchParameters", {})
        
        if not resource_type:
            raise ValueError("Query missing resourceType")
        
        # Clean search parameters - remove None values and empty strings
        clean_params = {k: v for k, v in search_params.items() if v is not None and v != ""}
        
        try:
            # Use HTTP client to call FHIR REST API
            async with FHIRHTTPClient() as client:
                bundle = await client.search_resources(resource_type, clean_params)
            
            # Handle case where bundle might be a string or have error
            if isinstance(bundle, str):
                logger.error(f"Unexpected string response from storage: {bundle}")
                return {"error": "Invalid response format", "total": 0, "entry": []}
            
            # Ensure bundle is properly formatted
            if not isinstance(bundle, dict):
                logger.warning(f"Bundle is not a dict: {type(bundle)}")
                return {"total": 0, "entry": []}
            
            return bundle
            
        except Exception as e:
            logger.error(f"Error executing FHIR search for {resource_type}: {e}")
            return {"error": str(e), "total": 0, "entry": []}
    
    async def _perform_aggregations(self, query_result: Dict[str, Any], aggregations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Perform aggregations on query results"""
        aggregated_results = {}
        
        if not query_result.get("entry"):
            return aggregated_results
        
        resources = [entry["resource"] for entry in query_result["entry"]]
        
        for agg in aggregations:
            agg_type = agg.get("type")
            field = agg.get("field")
            group_by = agg.get("groupBy")
            
            try:
                if agg_type == "count":
                    if group_by:
                        # Group by a field and count each group
                        groups = {}
                        for resource in resources:
                            group_value = self._extract_field_value(resource, group_by)
                            if group_value:
                                groups[group_value] = groups.get(group_value, 0) + 1
                        aggregated_results[f"count_by_{group_by}"] = groups
                    else:
                        aggregated_results["total_count"] = len(resources)
                
                elif agg_type in ["sum", "avg", "min", "max"]:
                    values = []
                    for resource in resources:
                        value = self._extract_numeric_value(resource, field)
                        if value is not None:
                            values.append(value)
                    
                    if values:
                        if agg_type == "sum":
                            aggregated_results[f"sum_{field}"] = sum(values)
                        elif agg_type == "avg":
                            aggregated_results[f"avg_{field}"] = sum(values) / len(values)
                        elif agg_type == "min":
                            aggregated_results[f"min_{field}"] = min(values)
                        elif agg_type == "max":
                            aggregated_results[f"max_{field}"] = max(values)
                
                elif agg_type == "group":
                    # Group resources by a field
                    groups = {}
                    for resource in resources:
                        group_value = self._extract_field_value(resource, group_by or field)
                        if group_value:
                            if group_value not in groups:
                                groups[group_value] = []
                            groups[group_value].append(resource)
                    aggregated_results[f"grouped_by_{group_by or field}"] = groups
                
            except Exception as e:
                logger.warning(f"Error performing aggregation {agg_type} on {field}: {e}")
                aggregated_results[f"error_{agg_type}_{field}"] = str(e)
        
        return aggregated_results
    
    def _extract_field_value(self, resource: Dict[str, Any], field_path: str) -> Any:
        """Extract a field value from a FHIR resource using dot notation"""
        try:
            value = resource
            for part in field_path.split('.'):
                if isinstance(value, dict):
                    value = value.get(part)
                elif isinstance(value, list) and part.isdigit():
                    value = value[int(part)]
                else:
                    return None
            return value
        except (KeyError, IndexError, AttributeError):
            return None
    
    def _extract_numeric_value(self, resource: Dict[str, Any], field_path: str) -> Optional[float]:
        """Extract a numeric value from a FHIR resource"""
        value = self._extract_field_value(resource, field_path)
        
        # Handle common FHIR numeric value patterns
        if isinstance(value, dict):
            # Try valueQuantity.value for Observations
            if "value" in value:
                value = value["value"]
            # Try various other FHIR numeric patterns
            elif "valueDecimal" in value:
                value = value["valueDecimal"]
            elif "valueInteger" in value:
                value = value["valueInteger"]
        
        try:
            return float(value) if value is not None else None
        except (ValueError, TypeError):
            return None
    
    def _count_records(self, query_result: Dict[str, Any]) -> int:
        """Count records in a query result"""
        if isinstance(query_result, dict):
            if "total" in query_result:
                return query_result["total"]
            elif "entry" in query_result:
                return len(query_result["entry"])
        return 0
    
    def _generate_data_statistics(self, query_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate statistics about the retrieved data"""
        stats = {
            "resourceTypes": {},
            "totalRecords": 0,
            "dateRange": {
                "earliest": None,
                "latest": None
            },
            "dataQuality": {
                "recordsWithValues": 0,
                "recordsWithoutValues": 0
            }
        }
        
        for query_id, result_data in query_results.items():
            if not result_data.get("success"):
                continue
                
            query_result = result_data.get("result", {})
            resource_type = result_data.get("query", {}).get("resourceType", "Unknown")
            record_count = self._count_records(query_result)
            
            stats["resourceTypes"][resource_type] = stats["resourceTypes"].get(resource_type, 0) + record_count
            stats["totalRecords"] += record_count
            
            # Analyze date ranges and data quality
            if query_result.get("entry"):
                for entry in query_result["entry"]:
                    resource = entry["resource"]
                    
                    # Extract dates for range analysis
                    date_fields = ["effectiveDateTime", "authoredOn", "onsetDateTime", "recordedDate"]
                    for date_field in date_fields:
                        if date_field in resource:
                            date_str = resource[date_field]
                            try:
                                date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                                if not stats["dateRange"]["earliest"] or date_obj < stats["dateRange"]["earliest"]:
                                    stats["dateRange"]["earliest"] = date_obj.isoformat()
                                if not stats["dateRange"]["latest"] or date_obj > stats["dateRange"]["latest"]:
                                    stats["dateRange"]["latest"] = date_obj.isoformat()
                            except (ValueError, AttributeError):
                                pass
                    
                    # Check for data quality
                    if resource_type == "Observation" and "valueQuantity" in resource:
                        if resource["valueQuantity"].get("value") is not None:
                            stats["dataQuality"]["recordsWithValues"] += 1
                        else:
                            stats["dataQuality"]["recordsWithoutValues"] += 1
        
        return stats
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "status": self.status,
            "lastExecution": self.last_execution
        }
    
    def reset(self):
        """Reset agent state"""
        self.status = 'idle'
        self.last_execution = None