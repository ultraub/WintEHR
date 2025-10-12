#!/usr/bin/env python3
"""
Data Context Agent
Formats FHIR data from FHIRExecutorAgent into structured context for component generation
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class DataContextAgent:
    """Agent that formats FHIR execution results into rich context for UI component generation"""
    
    def __init__(self):
        self.status = 'idle'
        self.last_context = None
    
    async def format_data_context(self, execution_results: Dict[str, Any], query_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format FHIR execution results into structured context for component generation
        
        Args:
            execution_results: Results from FHIRExecutorAgent
            query_plan: Original query plan for context
        
        Returns:
            Dict containing formatted data context for UI generation
        """
        try:
            self.status = 'formatting'
            
            data_context = {
                "dataAvailable": True,
                "scope": execution_results.get("scope", "unknown"),
                "totalRecords": execution_results.get("executionSummary", {}).get("totalRecords", 0),
                "resourceSummary": {},
                "dataStructures": {},
                "sampleData": {},
                "aggregations": {},
                "recommendations": {
                    "components": [],
                    "visualizations": [],
                    "interactions": []
                },
                "dataQuality": {},
                "clinicalContext": {},
                "uiHints": {}
            }
            
            # Process each query result
            for query_id, result_data in execution_results.get("queryResults", {}).items():
                if not result_data.get("success"):
                    continue
                
                query = result_data["query"]
                query_result = result_data["result"]
                resource_type = query.get("resourceType")
                
                # Add resource summary
                data_context["resourceSummary"][resource_type] = {
                    "recordCount": result_data.get("recordCount", 0),
                    "purpose": query.get("purpose", ""),
                    "priority": query.get("priority", "medium")
                }
                
                # Extract data structures and samples
                if query_result.get("entry"):
                    data_context["dataStructures"][resource_type] = self._analyze_data_structure(query_result["entry"])
                    data_context["sampleData"][resource_type] = self._extract_sample_data(query_result["entry"], resource_type)
                
                # Add aggregated data if available
                if query_id in execution_results.get("aggregatedData", {}):
                    data_context["aggregations"][resource_type] = execution_results["aggregatedData"][query_id]
            
            # Generate clinical context
            data_context["clinicalContext"] = self._generate_clinical_context(execution_results, query_plan)
            
            # Generate data quality assessment
            data_context["dataQuality"] = self._assess_data_quality(execution_results)
            
            # Generate component recommendations
            data_context["recommendations"] = self._generate_recommendations(data_context, query_plan)
            
            # Generate UI hints for better component generation
            data_context["uiHints"] = self._generate_ui_hints(data_context)
            
            self.last_context = data_context
            self.status = 'complete'
            
            return {
                "success": True,
                "dataContext": data_context,
                "reasoning": f"Formatted data context with {len(data_context['resourceSummary'])} resource types and {data_context['totalRecords']} total records"
            }
            
        except Exception as e:
            self.status = 'error'
            logger.error(f"Error formatting data context: {e}")
            raise
    
    def _analyze_data_structure(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze the structure of FHIR resources to understand available fields"""
        structure = {
            "commonFields": {},
            "numericFields": [],
            "dateFields": [],
            "codedFields": [],
            "textFields": [],
            "referenceFields": []
        }
        
        for entry in entries[:10]:  # Analyze first 10 entries for performance
            resource = entry["resource"]
            self._analyze_resource_fields(resource, structure, "")
        
        return structure
    
    def _analyze_resource_fields(self, obj: Any, structure: Dict[str, Any], prefix: str):
        """Recursively analyze fields in a FHIR resource"""
        if isinstance(obj, dict):
            for key, value in obj.items():
                field_path = f"{prefix}.{key}" if prefix else key
                
                # Track field frequency
                if field_path not in structure["commonFields"]:
                    structure["commonFields"][field_path] = 0
                structure["commonFields"][field_path] += 1
                
                # Categorize field types
                if isinstance(value, (int, float)):
                    if field_path not in structure["numericFields"]:
                        structure["numericFields"].append(field_path)
                elif isinstance(value, str):
                    if self._is_date_field(key, value):
                        if field_path not in structure["dateFields"]:
                            structure["dateFields"].append(field_path)
                    elif self._is_reference_field(key, value):
                        if field_path not in structure["referenceFields"]:
                            structure["referenceFields"].append(field_path)
                    elif self._is_coded_field(key):
                        if field_path not in structure["codedFields"]:
                            structure["codedFields"].append(field_path)
                    else:
                        if field_path not in structure["textFields"]:
                            structure["textFields"].append(field_path)
                elif isinstance(value, dict):
                    # Handle nested objects
                    if key == "valueQuantity" and "value" in value:
                        numeric_path = f"{field_path}.value"
                        if numeric_path not in structure["numericFields"]:
                            structure["numericFields"].append(numeric_path)
                    elif key == "code" and "coding" in value:
                        coded_path = f"{field_path}.coding"
                        if coded_path not in structure["codedFields"]:
                            structure["codedFields"].append(coded_path)
                    
                    # Recurse for nested analysis (limited depth)
                    if len(prefix.split('.')) < 3:
                        self._analyze_resource_fields(value, structure, field_path)
                elif isinstance(value, list) and value:
                    # Analyze first item in list
                    self._analyze_resource_fields(value[0], structure, field_path)
    
    def _is_date_field(self, key: str, value: str) -> bool:
        """Check if a field contains date/time data"""
        date_keywords = ['date', 'time', 'effective', 'authored', 'recorded', 'onset']
        if any(keyword in key.lower() for keyword in date_keywords):
            # Try to parse as date
            try:
                datetime.fromisoformat(value.replace('Z', '+00:00'))
                return True
            except (ValueError, AttributeError):
                pass
        return False
    
    def _is_reference_field(self, key: str, value: str) -> bool:
        """Check if a field contains FHIR references"""
        if key.lower() in ['reference', 'subject', 'patient', 'encounter']:
            return True
        if isinstance(value, str) and ('/' in value or value.startswith('urn:uuid:')):
            return True
        return False
    
    def _is_coded_field(self, key: str) -> bool:
        """Check if a field typically contains coded values"""
        coded_keywords = ['code', 'status', 'category', 'system', 'display']
        return any(keyword in key.lower() for keyword in coded_keywords)
    
    def _extract_sample_data(self, entries: List[Dict[str, Any]], resource_type: str) -> Dict[str, Any]:
        """Extract representative sample data for UI generation"""
        samples = {
            "count": len(entries),
            "examples": [],
            "valueRanges": {},
            "commonValues": {},
            "dateRange": {"earliest": None, "latest": None}
        }
        
        # Take first 2 resources as examples to reduce token count
        for entry in entries[:2]:
            resource = entry["resource"]
            
            # Create simplified example
            example = {
                "id": resource.get("id"),
                "resourceType": resource.get("resourceType")
            }
            
            # Add key fields based on resource type
            if resource_type == "Observation":
                example.update({
                    "code": self._extract_code_display(resource.get("code")),
                    "value": self._extract_observation_value(resource),
                    "date": resource.get("effectiveDateTime"),
                    "status": resource.get("status")
                })
                
                # Track value ranges for numeric observations
                numeric_value = self._extract_numeric_value(resource, "valueQuantity.value")
                if numeric_value is not None:
                    code_display = example["code"]
                    if code_display not in samples["valueRanges"]:
                        samples["valueRanges"][code_display] = {"min": numeric_value, "max": numeric_value, "values": []}
                    samples["valueRanges"][code_display]["min"] = min(samples["valueRanges"][code_display]["min"], numeric_value)
                    samples["valueRanges"][code_display]["max"] = max(samples["valueRanges"][code_display]["max"], numeric_value)
                    samples["valueRanges"][code_display]["values"].append(numeric_value)
            
            elif resource_type == "Condition":
                example.update({
                    "code": self._extract_code_display(resource.get("code")),
                    "clinicalStatus": resource.get("clinicalStatus", {}).get("coding", [{}])[0].get("code"),
                    "onsetDateTime": resource.get("onsetDateTime"),
                    "recordedDate": resource.get("recordedDate")
                })
            
            elif resource_type == "MedicationRequest":
                example.update({
                    "medication": self._extract_medication_display(resource),
                    "status": resource.get("status"),
                    "intent": resource.get("intent"),
                    "authoredOn": resource.get("authoredOn")
                })
            
            # Extract dates for range analysis
            date_fields = ["effectiveDateTime", "authoredOn", "onsetDateTime", "recordedDate"]
            for date_field in date_fields:
                if date_field in resource:
                    try:
                        date_obj = datetime.fromisoformat(resource[date_field].replace('Z', '+00:00'))
                        if not samples["dateRange"]["earliest"] or date_obj < datetime.fromisoformat(samples["dateRange"]["earliest"]):
                            samples["dateRange"]["earliest"] = date_obj.isoformat()
                        if not samples["dateRange"]["latest"] or date_obj > datetime.fromisoformat(samples["dateRange"]["latest"]):
                            samples["dateRange"]["latest"] = date_obj.isoformat()
                    except (ValueError, AttributeError):
                        pass
            
            samples["examples"].append(example)
        
        return samples
    
    def _extract_code_display(self, code_obj: Optional[Dict[str, Any]]) -> str:
        """Extract human-readable display from FHIR code"""
        if not code_obj:
            return "Unknown"
        
        if "text" in code_obj:
            return code_obj["text"]
        
        if "coding" in code_obj and code_obj["coding"]:
            coding = code_obj["coding"][0]
            return coding.get("display", coding.get("code", "Unknown"))
        
        return "Unknown"
    
    def _extract_observation_value(self, resource: Dict[str, Any]) -> str:
        """Extract human-readable value from Observation"""
        if "valueQuantity" in resource:
            vq = resource["valueQuantity"]
            value = vq.get("value", "")
            unit = vq.get("unit", "")
            return f"{value} {unit}".strip()
        elif "valueString" in resource:
            return resource["valueString"]
        elif "valueBoolean" in resource:
            return str(resource["valueBoolean"])
        elif "valueCodeableConcept" in resource:
            return self._extract_code_display(resource["valueCodeableConcept"])
        else:
            return "No value"
    
    def _extract_medication_display(self, resource: Dict[str, Any]) -> str:
        """Extract medication display name"""
        if "medicationCodeableConcept" in resource:
            return self._extract_code_display(resource["medicationCodeableConcept"])
        elif "medicationReference" in resource:
            return resource["medicationReference"].get("display", "Medication reference")
        else:
            return "Unknown medication"
    
    def _extract_numeric_value(self, resource: Dict[str, Any], field_path: str) -> Optional[float]:
        """Extract numeric value using dot notation"""
        try:
            value = resource
            for part in field_path.split('.'):
                value = value[part]
            return float(value) if value is not None else None
        except (KeyError, ValueError, TypeError):
            return None
    
    def _generate_clinical_context(self, execution_results: Dict[str, Any], query_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Generate clinical context for better UI decisions"""
        clinical_context = {
            "primaryClinicalFocus": query_plan.get("reasoning", "General clinical data"),
            "temporalContext": "current",  # current, historical, trending
            "clinicalDomain": [],  # laboratory, vital-signs, medications, conditions, etc.
            "riskFactors": [],
            "clinicalSignificance": "routine"  # critical, urgent, routine, informational
        }
        
        # Analyze what clinical domains are involved
        for resource_type in execution_results.get("resourceSummary", {}):
            if resource_type == "Observation":
                clinical_context["clinicalDomain"].append("laboratory")
                clinical_context["clinicalDomain"].append("vital-signs")
            elif resource_type == "Condition":
                clinical_context["clinicalDomain"].append("conditions")
            elif resource_type == "MedicationRequest":
                clinical_context["clinicalDomain"].append("medications")
            elif resource_type == "Procedure":
                clinical_context["clinicalDomain"].append("procedures")
        
        # Remove duplicates
        clinical_context["clinicalDomain"] = list(set(clinical_context["clinicalDomain"]))
        
        # Determine temporal context based on date ranges
        stats = execution_results.get("dataStatistics", {})
        if stats.get("dateRange", {}).get("latest"):
            try:
                latest_date = datetime.fromisoformat(stats["dateRange"]["latest"])
                days_ago = (datetime.now() - latest_date).days
                
                if days_ago <= 7:
                    clinical_context["temporalContext"] = "current"
                elif days_ago <= 90:
                    clinical_context["temporalContext"] = "recent"
                else:
                    clinical_context["temporalContext"] = "historical"
            except (ValueError, TypeError):
                pass
        
        return clinical_context
    
    def _assess_data_quality(self, execution_results: Dict[str, Any]) -> Dict[str, Any]:
        """Assess the quality of retrieved data"""
        quality = {
            "completeness": 0.0,  # Percentage of expected fields populated
            "recency": "unknown",  # recent, current, outdated
            "volume": "adequate",  # insufficient, adequate, abundant
            "consistency": "good",  # poor, fair, good, excellent
            "issues": []
        }
        
        total_records = execution_results.get("executionSummary", {}).get("totalRecords", 0)
        
        # Assess volume
        if total_records == 0:
            quality["volume"] = "insufficient"
            quality["issues"].append("No data retrieved")
        elif total_records < 5:
            quality["volume"] = "limited"
            quality["issues"].append("Limited data available")
        elif total_records > 100:
            quality["volume"] = "abundant"
        
        # Assess completeness based on execution success rate
        exec_summary = execution_results.get("executionSummary", {})
        successful = exec_summary.get("successful", 0)
        total_queries = exec_summary.get("successful", 0) + exec_summary.get("failed", 0)
        
        if total_queries > 0:
            quality["completeness"] = successful / total_queries
            if quality["completeness"] < 0.5:
                quality["issues"].append("Many queries failed")
        
        return quality
    
    def _generate_recommendations(self, data_context: Dict[str, Any], query_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Generate component and visualization recommendations"""
        recommendations = {
            "components": [],
            "visualizations": [],
            "interactions": []
        }
        
        # Analyze available data and suggest components
        for resource_type, summary in data_context["resourceSummary"].items():
            record_count = summary["recordCount"]
            
            if resource_type == "Observation" and record_count > 0:
                # Check if we have numeric values for trending
                if resource_type in data_context["sampleData"]:
                    sample_data = data_context["sampleData"][resource_type]
                    if sample_data.get("valueRanges"):
                        recommendations["components"].append({
                            "type": "chart",
                            "subtype": "line",
                            "purpose": "Show lab value trends over time",
                            "dataSource": resource_type,
                            "priority": "high"
                        })
                        recommendations["visualizations"].append("trend-analysis")
                
                # Always suggest a grid for observations
                recommendations["components"].append({
                    "type": "grid",
                    "subtype": "result-list",
                    "purpose": "Display lab results in tabular format",
                    "dataSource": resource_type,
                    "priority": "medium"
                })
            
            elif resource_type == "Condition" and record_count > 0:
                recommendations["components"].append({
                    "type": "summary",
                    "purpose": "Summarize active conditions",
                    "dataSource": resource_type,
                    "priority": "high"
                })
                
                if record_count > 5:
                    recommendations["components"].append({
                        "type": "grid",
                        "subtype": "condition-list",
                        "purpose": "List all conditions with details",
                        "dataSource": resource_type,
                        "priority": "medium"
                    })
            
            elif resource_type == "MedicationRequest" and record_count > 0:
                recommendations["components"].append({
                    "type": "grid",
                    "subtype": "medication-list",
                    "purpose": "Display current medications",
                    "dataSource": resource_type,
                    "priority": "high"
                })
        
        # Suggest interactions based on data scope
        if data_context["scope"] == "population":
            recommendations["interactions"].extend(["filter-by-condition", "sort-by-value", "export-data"])
        elif data_context["scope"] == "patient":
            recommendations["interactions"].extend(["date-range-filter", "print-report", "export-data"])
        
        return recommendations
    
    def _generate_ui_hints(self, data_context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate hints for better UI component generation"""
        hints = {
            "layout": "auto",  # auto, dashboard, report, focused
            "colorScheme": "clinical",  # clinical, professional, accessible
            "density": "comfortable",  # compact, comfortable, spacious
            "emphasis": [],  # what to emphasize
            "warnings": []  # potential issues
        }
        
        # Determine layout based on data volume and scope
        total_records = data_context["totalRecords"]
        resource_count = len(data_context["resourceSummary"])
        
        if resource_count == 1 and total_records < 10:
            hints["layout"] = "focused"
            hints["density"] = "spacious"
        elif resource_count > 3 or total_records > 50:
            hints["layout"] = "dashboard"
            hints["density"] = "compact"
        else:
            hints["layout"] = "report"
        
        # Determine what to emphasize
        clinical_context = data_context.get("clinicalContext", {})
        if "laboratory" in clinical_context.get("clinicalDomain", []):
            hints["emphasis"].append("abnormal-values")
        if clinical_context.get("clinicalSignificance") == "critical":
            hints["emphasis"].append("critical-alerts")
        
        # Generate warnings
        quality = data_context.get("dataQuality", {})
        if quality.get("volume") == "insufficient":
            hints["warnings"].append("Limited data may affect visualization quality")
        if quality.get("completeness", 1.0) < 0.8:
            hints["warnings"].append("Some data queries failed - display may be incomplete")
        
        return hints
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "status": self.status,
            "lastContext": self.last_context
        }
    
    def reset(self):
        """Reset agent state"""
        self.status = 'idle'
        self.last_context = None