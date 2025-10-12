"""
Data Relationship Mapper
Analyzes FHIR query results to determine data relationships and optimal UI structure
"""

import logging
from typing import Dict, Any, List, Optional, Set, Tuple
from collections import defaultdict
from datetime import datetime

from .query_orchestrator import QueryResult

logger = logging.getLogger(__name__)

class DataRelationship:
    """Represents a relationship between data elements"""
    def __init__(self, source_type: str, target_type: str, relationship_type: str, cardinality: str = "1:n"):
        self.source_type = source_type
        self.target_type = target_type
        self.relationship_type = relationship_type  # reference, include, revinclude, derived
        self.cardinality = cardinality  # 1:1, 1:n, n:m
        self.instances = []  # Actual instance relationships
    
    def add_instance(self, source_id: str, target_id: str):
        """Add an instance of this relationship"""
        self.instances.append((source_id, target_id))
    
    def get_grouped_instances(self) -> Dict[str, List[str]]:
        """Get instances grouped by source"""
        grouped = defaultdict(list)
        for source, target in self.instances:
            grouped[source].append(target)
        return dict(grouped)

class DataStructure:
    """Represents the overall data structure from query results"""
    def __init__(self):
        self.resource_types = {}  # Type -> count
        self.relationships = []  # List of DataRelationship
        self.hierarchies = []  # Hierarchical structures found
        self.aggregations = {}  # Aggregated data available
        self.temporal_data = {}  # Time-series data
        self.primary_entity = None  # Main entity (e.g., Patient)
        self.metrics = {}  # Calculated metrics
    
    def add_resource_type(self, resource_type: str, count: int):
        """Add a resource type and its count"""
        self.resource_types[resource_type] = count
    
    def add_relationship(self, relationship: DataRelationship):
        """Add a discovered relationship"""
        self.relationships.append(relationship)
    
    def find_relationships(self, source_type: str = None, target_type: str = None) -> List[DataRelationship]:
        """Find relationships matching criteria"""
        results = []
        for rel in self.relationships:
            if (source_type is None or rel.source_type == source_type) and \
               (target_type is None or rel.target_type == target_type):
                results.append(rel)
        return results

class DataRelationshipMapper:
    """Maps relationships between FHIR resources and suggests UI structures"""
    
    def __init__(self):
        self.structure = DataStructure()
        self.ui_patterns = self._load_ui_patterns()
    
    def _load_ui_patterns(self) -> Dict[str, Any]:
        """Load UI patterns for different data structures"""
        return {
            "single_entity_details": {
                "description": "Details view for a single entity",
                "when": ["single primary resource", "multiple related resources"],
                "components": ["summary_card", "related_data_tabs", "timeline"]
            },
            "population_overview": {
                "description": "Overview of multiple entities",
                "when": ["multiple primary resources", "aggregated data"],
                "components": ["stat_cards", "data_grid", "distribution_charts"]
            },
            "hierarchical_view": {
                "description": "Tree or nested view",
                "when": ["parent-child relationships", "nested data"],
                "components": ["tree_view", "nested_accordions", "drill_down"]
            },
            "comparison_view": {
                "description": "Compare multiple entities",
                "when": ["multiple similar entities", "benchmarking data"],
                "components": ["comparison_table", "side_by_side", "radar_chart"]
            },
            "timeline_view": {
                "description": "Temporal data visualization",
                "when": ["time-series data", "historical records"],
                "components": ["timeline_chart", "event_list", "trend_analysis"]
            },
            "dashboard": {
                "description": "Multi-metric overview",
                "when": ["multiple metrics", "KPIs", "summary data"],
                "components": ["metric_cards", "charts_grid", "alerts_panel"]
            }
        }
    
    def analyze_query_results(self, results: Dict[str, QueryResult], query_plan: Dict[str, Any]) -> DataStructure:
        """Analyze query results to build data structure"""
        self.structure = DataStructure()
        
        # Count resources by type
        for result_id, result in results.items():
            if result.resources:
                resource_type = result.resource_type
                self.structure.add_resource_type(resource_type, len(result.resources))
        
        # Discover relationships
        self._discover_relationships(results)
        
        # Identify hierarchies
        self._identify_hierarchies(results)
        
        # Extract aggregations
        self._extract_aggregations(results)
        
        # Analyze temporal data
        self._analyze_temporal_data(results)
        
        # Determine primary entity
        self._determine_primary_entity(query_plan)
        
        # Calculate metrics
        self._calculate_metrics(results)
        
        return self.structure
    
    def _discover_relationships(self, results: Dict[str, QueryResult]):
        """Discover relationships between resources"""
        # Map resource IDs to their types
        id_to_type = {}
        for result in results.values():
            for resource in result.resources:
                if "id" in resource:
                    id_to_type[resource["id"]] = resource.get("resourceType", result.resource_type)
        
        # Find references between resources
        for result in results.values():
            source_type = result.resource_type
            
            for resource in result.resources:
                source_id = resource.get("id")
                if not source_id:
                    continue
                
                # Check common reference fields
                reference_fields = ["subject", "patient", "encounter", "performer", "author", 
                                  "requester", "participant", "location", "organization"]
                
                for field in reference_fields:
                    ref_value = resource.get(field)
                    if ref_value:
                        target_id, target_type = self._extract_reference(ref_value, id_to_type)
                        if target_id and target_type:
                            # Find or create relationship
                            rel = self._find_or_create_relationship(source_type, target_type, field)
                            rel.add_instance(source_id, target_id)
                
                # Check for array references
                for field in ["basedOn", "partOf", "hasMember", "derivedFrom"]:
                    ref_array = resource.get(field, [])
                    if isinstance(ref_array, list):
                        for ref in ref_array:
                            target_id, target_type = self._extract_reference(ref, id_to_type)
                            if target_id and target_type:
                                rel = self._find_or_create_relationship(source_type, target_type, field)
                                rel.add_instance(source_id, target_id)
    
    def _extract_reference(self, ref_value: Any, id_to_type: Dict[str, str]) -> Tuple[Optional[str], Optional[str]]:
        """Extract reference ID and type from a reference value"""
        if isinstance(ref_value, dict) and "reference" in ref_value:
            ref_str = ref_value["reference"]
            if "/" in ref_str:
                parts = ref_str.split("/")
                if len(parts) == 2:
                    return parts[1], parts[0]
            elif ref_str.startswith("urn:uuid:"):
                ref_id = ref_str.replace("urn:uuid:", "")
                return ref_id, id_to_type.get(ref_id)
        
        return None, None
    
    def _find_or_create_relationship(self, source_type: str, target_type: str, field: str) -> DataRelationship:
        """Find existing relationship or create new one"""
        # Look for existing relationship
        for rel in self.structure.relationships:
            if rel.source_type == source_type and rel.target_type == target_type and rel.relationship_type == field:
                return rel
        
        # Create new relationship
        rel = DataRelationship(source_type, target_type, field)
        self.structure.add_relationship(rel)
        return rel
    
    def _identify_hierarchies(self, results: Dict[str, QueryResult]):
        """Identify hierarchical structures in the data"""
        # Look for parent-child relationships
        parent_child_fields = ["partOf", "parent", "container"]
        
        for result in results.values():
            for resource in result.resources:
                for field in parent_child_fields:
                    if field in resource:
                        # This is a hierarchical relationship
                        hierarchy = {
                            "type": "parent_child",
                            "resource_type": result.resource_type,
                            "parent_field": field,
                            "levels": self._trace_hierarchy_depth(resource, field, result.resources)
                        }
                        if hierarchy not in self.structure.hierarchies:
                            self.structure.hierarchies.append(hierarchy)
        
        # Look for encounter-based hierarchies
        if any(r.resource_type == "Encounter" for r in results.values()):
            self.structure.hierarchies.append({
                "type": "encounter_based",
                "description": "Resources grouped by encounter"
            })
    
    def _trace_hierarchy_depth(self, resource: Dict[str, Any], parent_field: str, all_resources: List[Dict[str, Any]]) -> int:
        """Trace the depth of a hierarchy"""
        max_depth = 1
        parent_ref = resource.get(parent_field)
        
        if parent_ref:
            # Find parent resource
            parent_id = self._extract_reference(parent_ref, {})[0]
            if parent_id:
                for other in all_resources:
                    if other.get("id") == parent_id:
                        depth = 1 + self._trace_hierarchy_depth(other, parent_field, all_resources)
                        max_depth = max(max_depth, depth)
        
        return max_depth
    
    def _extract_aggregations(self, results: Dict[str, QueryResult]):
        """Extract aggregated data from results"""
        for result_id, result in results.items():
            if result.aggregated_data:
                self.structure.aggregations[result_id] = result.aggregated_data
    
    def _analyze_temporal_data(self, results: Dict[str, QueryResult]):
        """Analyze temporal aspects of the data"""
        for result_id, result in results.items():
            date_fields = []
            date_ranges = {}
            
            # Find date fields and their ranges
            for resource in result.resources[:10]:  # Sample first 10
                for field in ["effectiveDateTime", "authoredOn", "recordedDate", "onsetDateTime", "period"]:
                    if field in resource:
                        if field not in date_fields:
                            date_fields.append(field)
                        
                        # Track date range
                        date_value = self._parse_date(resource[field])
                        if date_value:
                            if field not in date_ranges:
                                date_ranges[field] = {"min": date_value, "max": date_value}
                            else:
                                date_ranges[field]["min"] = min(date_ranges[field]["min"], date_value)
                                date_ranges[field]["max"] = max(date_ranges[field]["max"], date_value)
            
            if date_fields:
                self.structure.temporal_data[result.resource_type] = {
                    "date_fields": date_fields,
                    "date_ranges": date_ranges,
                    "has_time_series": len(result.resources) > 5 and len(date_fields) > 0
                }
    
    def _parse_date(self, date_value: Any) -> Optional[datetime]:
        """Parse a FHIR date/datetime value"""
        if isinstance(date_value, str):
            try:
                return datetime.fromisoformat(date_value.replace('Z', '+00:00'))
            except:
                pass
        elif isinstance(date_value, dict) and "start" in date_value:
            return self._parse_date(date_value["start"])
        
        return None
    
    def _determine_primary_entity(self, query_plan: Dict[str, Any]):
        """Determine the primary entity based on query plan"""
        # Check if explicitly defined in query plan
        if "dataFlow" in query_plan and "primary" in query_plan["dataFlow"]:
            primary_stage = query_plan["dataFlow"]["primary"]
            # Find the resource type for this stage
            if "queryGraph" in query_plan:
                stages = query_plan["queryGraph"].get("stages", {})
                if primary_stage in stages:
                    self.structure.primary_entity = stages[primary_stage].get("resourceType")
            elif "queries" in query_plan:
                for query in query_plan["queries"]:
                    if query.get("id") == primary_stage:
                        self.structure.primary_entity = query.get("resourceType")
        
        # If not found, use heuristics
        if not self.structure.primary_entity:
            # If there's a Patient, it's usually primary
            if "Patient" in self.structure.resource_types:
                self.structure.primary_entity = "Patient"
            # Otherwise, use the resource type with most records
            elif self.structure.resource_types:
                self.structure.primary_entity = max(self.structure.resource_types.items(), key=lambda x: x[1])[0]
    
    def _calculate_metrics(self, results: Dict[str, QueryResult]):
        """Calculate relevant metrics from the data"""
        total_records = sum(len(r.resources) for r in results.values())
        
        self.structure.metrics = {
            "total_records": total_records,
            "resource_types_count": len(self.structure.resource_types),
            "relationships_count": len(self.structure.relationships),
            "has_aggregations": bool(self.structure.aggregations),
            "has_temporal_data": bool(self.structure.temporal_data),
            "complexity": self._calculate_complexity()
        }
    
    def _calculate_complexity(self) -> str:
        """Calculate data structure complexity"""
        score = 0
        
        # Factor in number of resource types
        score += len(self.structure.resource_types) * 2
        
        # Factor in relationships
        score += len(self.structure.relationships) * 3
        
        # Factor in hierarchies
        score += len(self.structure.hierarchies) * 5
        
        # Factor in aggregations
        score += len(self.structure.aggregations) * 2
        
        if score < 10:
            return "simple"
        elif score < 25:
            return "moderate"
        else:
            return "complex"
    
    def suggest_ui_structure(self) -> Dict[str, Any]:
        """Suggest optimal UI structure based on data analysis"""
        suggestions = {
            "primary_pattern": None,
            "components": [],
            "layout": {},
            "interactions": [],
            "reasoning": []
        }
        
        # Determine primary UI pattern
        if self.structure.metrics["total_records"] == 1:
            suggestions["primary_pattern"] = "single_entity_details"
            suggestions["reasoning"].append("Single record suggests detailed view")
        elif self.structure.primary_entity == "Patient" and self.structure.metrics["total_records"] < 50:
            suggestions["primary_pattern"] = "single_entity_details"
            suggestions["reasoning"].append("Patient-centric view with related data")
        elif len(self.structure.resource_types) == 1 and self.structure.metrics["total_records"] > 10:
            if self.structure.temporal_data:
                suggestions["primary_pattern"] = "timeline_view"
                suggestions["reasoning"].append("Single resource type with temporal data suggests timeline")
            else:
                suggestions["primary_pattern"] = "population_overview"
                suggestions["reasoning"].append("Multiple records of same type suggests population view")
        elif self.structure.hierarchies:
            suggestions["primary_pattern"] = "hierarchical_view"
            suggestions["reasoning"].append("Hierarchical relationships found in data")
        elif self.structure.aggregations:
            suggestions["primary_pattern"] = "dashboard"
            suggestions["reasoning"].append("Aggregated data available for dashboard view")
        else:
            suggestions["primary_pattern"] = "population_overview"
            suggestions["reasoning"].append("Default to population overview for multiple records")
        
        # Suggest specific components based on data
        pattern = self.ui_patterns[suggestions["primary_pattern"]]
        suggestions["components"] = pattern["components"]
        
        # Add specific component suggestions based on data
        if self.structure.temporal_data:
            suggestions["components"].append("trend_chart")
        
        if self.structure.aggregations:
            suggestions["components"].append("summary_stats")
        
        if len(self.structure.relationships) > 2:
            suggestions["components"].append("relationship_graph")
        
        # Suggest layout
        suggestions["layout"] = self._suggest_layout()
        
        # Suggest interactions
        suggestions["interactions"] = self._suggest_interactions()
        
        return suggestions
    
    def _suggest_layout(self) -> Dict[str, Any]:
        """Suggest layout structure"""
        if self.structure.metrics["complexity"] == "simple":
            return {
                "type": "single_column",
                "sections": ["header", "main_content", "footer"]
            }
        elif self.structure.metrics["complexity"] == "moderate":
            return {
                "type": "two_column",
                "sections": ["header", "sidebar", "main_content"],
                "responsive": "stack_on_mobile"
            }
        else:
            return {
                "type": "grid",
                "sections": ["header", "filters", "main_grid", "details_panel"],
                "responsive": "adaptive"
            }
    
    def _suggest_interactions(self) -> List[str]:
        """Suggest user interactions based on data"""
        interactions = []
        
        if self.structure.metrics["total_records"] > 10:
            interactions.extend(["search", "filter", "sort"])
        
        if self.structure.temporal_data:
            interactions.extend(["date_range_filter", "timeline_zoom"])
        
        if self.structure.hierarchies:
            interactions.extend(["expand_collapse", "drill_down"])
        
        if len(self.structure.resource_types) > 1:
            interactions.append("resource_type_toggle")
        
        return interactions