"""
FHIR Query Builder
Constructs complex FHIR queries with chaining, includes, and optimizations
"""

import logging
from typing import Dict, Any, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

class QueryRelationType(Enum):
    INCLUDE = "_include"
    REVINCLUDE = "_revinclude"
    REFERENCE = "reference"
    CHAINED = "chained"

@dataclass
class QueryNode:
    """Represents a single query in the query graph"""
    id: str
    resource_type: str
    filters: Dict[str, Any] = field(default_factory=dict)
    includes: List[str] = field(default_factory=list)
    revincludes: List[str] = field(default_factory=list)
    fields: List[str] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    aggregations: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_fhir_params(self) -> Dict[str, Any]:
        """Convert to FHIR search parameters"""
        params = dict(self.filters)
        
        if self.includes:
            params['_include'] = self.includes
        
        if self.revincludes:
            params['_revinclude'] = self.revincludes
            
        if self.fields:
            params['_elements'] = ','.join(self.fields)
            
        return params

@dataclass
class QueryPlan:
    """Represents a complete query execution plan"""
    nodes: List[QueryNode]
    execution_order: List[str]
    relationships: Dict[str, List[Tuple[str, QueryRelationType]]]
    
class FHIRQueryBuilder:
    """Builds optimized FHIR queries from high-level specifications"""
    
    def __init__(self):
        self.resource_relationships = self._load_resource_relationships()
    
    def _load_resource_relationships(self) -> Dict[str, Dict[str, str]]:
        """Load known FHIR resource relationships"""
        # This would ideally be loaded from FHIR metadata
        return {
            "Patient": {
                "generalPractitioner": "Practitioner,Organization",
                "managingOrganization": "Organization"
            },
            "Observation": {
                "subject": "Patient,Group,Device,Location",
                "encounter": "Encounter",
                "performer": "Practitioner,PractitionerRole,Organization",
                "basedOn": "ServiceRequest,MedicationRequest,CarePlan"
            },
            "Condition": {
                "subject": "Patient,Group",
                "encounter": "Encounter",
                "asserter": "Practitioner,PractitionerRole,Patient"
            },
            "MedicationRequest": {
                "subject": "Patient,Group",
                "encounter": "Encounter",
                "requester": "Practitioner,PractitionerRole,Organization",
                "medication": "Medication"
            },
            "Encounter": {
                "subject": "Patient,Group",
                "participant": "Practitioner,PractitionerRole",
                "serviceProvider": "Organization",
                "location": "Location"
            },
            "Procedure": {
                "subject": "Patient,Group",
                "encounter": "Encounter",
                "performer": "Practitioner,PractitionerRole,Organization"
            },
            "DiagnosticReport": {
                "subject": "Patient,Group,Device,Location",
                "encounter": "Encounter",
                "result": "Observation",
                "performer": "Practitioner,PractitionerRole,Organization"
            },
            "CarePlan": {
                "subject": "Patient,Group",
                "encounter": "Encounter",
                "author": "Patient,Practitioner,PractitionerRole,Organization",
                "careTeam": "CareTeam"
            },
            "AllergyIntolerance": {
                "patient": "Patient",
                "encounter": "Encounter",
                "asserter": "Patient,Practitioner,PractitionerRole"
            },
            "Immunization": {
                "patient": "Patient",
                "encounter": "Encounter",
                "performer": "Practitioner,PractitionerRole,Organization"
            },
            "ServiceRequest": {
                "subject": "Patient,Group,Device,Location",
                "encounter": "Encounter",
                "requester": "Practitioner,PractitionerRole,Organization",
                "performer": "Practitioner,PractitionerRole,Organization"
            }
        }
    
    def build_query_plan(self, query_spec: Dict[str, Any]) -> QueryPlan:
        """Build an optimized query plan from a specification"""
        nodes = []
        relationships = {}
        
        # Parse query specification into nodes
        if "stages" in query_spec:
            # Multi-stage query
            for stage_id, stage_spec in query_spec["stages"].items():
                node = self._create_query_node(stage_id, stage_spec)
                nodes.append(node)
                
                # Extract dependencies
                for param_value in stage_spec.get("filters", {}).values():
                    if isinstance(param_value, str) and param_value.startswith("{") and param_value.endswith("}"):
                        # Reference to another query result
                        ref = param_value[1:-1]  # Remove {}
                        source_id = ref.split(".")[0]
                        node.depends_on.append(source_id)
                        
                        if source_id not in relationships:
                            relationships[source_id] = []
                        relationships[source_id].append((stage_id, QueryRelationType.REFERENCE))
        else:
            # Single query
            node = self._create_query_node("main", query_spec)
            nodes.append(node)
        
        # Optimize includes/revincludes
        self._optimize_includes(nodes, relationships)
        
        # Determine execution order
        execution_order = self._topological_sort(nodes)
        
        return QueryPlan(
            nodes=nodes,
            execution_order=execution_order,
            relationships=relationships
        )
    
    def _create_query_node(self, node_id: str, spec: Dict[str, Any]) -> QueryNode:
        """Create a query node from specification"""
        node = QueryNode(
            id=node_id,
            resource_type=spec.get("resourceType", spec.get("resource", "")),
            filters=spec.get("filters", {})
        )
        
        # Handle includes
        if "_include" in spec:
            includes = spec["_include"]
            if isinstance(includes, str):
                node.includes = [includes]
            else:
                node.includes = includes
        
        # Handle revincludes
        if "_revinclude" in spec:
            revincludes = spec["_revinclude"]
            if isinstance(revincludes, str):
                node.revincludes = [revincludes]
            else:
                node.revincludes = revincludes
        
        # Handle field selection
        if "fields" in spec:
            node.fields = spec["fields"]
        
        # Handle aggregations
        if "aggregate" in spec:
            if isinstance(spec["aggregate"], dict):
                node.aggregations = [spec["aggregate"]]
            else:
                node.aggregations = spec["aggregate"]
        
        return node
    
    def _optimize_includes(self, nodes: List[QueryNode], relationships: Dict[str, List[Tuple[str, QueryRelationType]]]):
        """Optimize includes and revincludes to minimize queries"""
        # For each node, check if we can use includes/revincludes instead of separate queries
        node_map = {node.id: node for node in nodes}
        
        for node in nodes:
            # Check dependencies
            for dep_id in node.depends_on[:]:  # Copy list as we might modify it
                dep_node = node_map.get(dep_id)
                if not dep_node:
                    continue
                
                # Can we use _revinclude from the dependency?
                if self._can_use_revinclude(dep_node, node):
                    revinclude = f"{node.resource_type}:{self._find_reference_field(node.resource_type, dep_node.resource_type)}"
                    if revinclude not in dep_node.revincludes:
                        dep_node.revincludes.append(revinclude)
                    
                    # Update relationship type
                    if dep_id in relationships:
                        relationships[dep_id] = [(node.id, QueryRelationType.REVINCLUDE) if r[0] == node.id else r for r in relationships[dep_id]]
                    
                    # Remove the dependency as it will be included
                    node.depends_on.remove(dep_id)
                
                # Can we use _include from this node?
                elif self._can_use_include(node, dep_node):
                    include = f"{node.resource_type}:{self._find_reference_field(node.resource_type, dep_node.resource_type)}"
                    if include not in node.includes:
                        node.includes.append(include)
                    
                    # Update relationship type
                    if node.id not in relationships:
                        relationships[node.id] = []
                    relationships[node.id].append((dep_id, QueryRelationType.INCLUDE))
                    
                    # Remove the dependency as it will be included
                    node.depends_on.remove(dep_id)
    
    def _can_use_include(self, source_node: QueryNode, target_node: QueryNode) -> bool:
        """Check if we can use _include to get target from source"""
        # Check if source has a reference to target
        source_refs = self.resource_relationships.get(source_node.resource_type, {})
        for field, targets in source_refs.items():
            if target_node.resource_type in targets:
                return True
        return False
    
    def _can_use_revinclude(self, source_node: QueryNode, target_node: QueryNode) -> bool:
        """Check if we can use _revinclude to get target from source"""
        # Check if target has a reference to source
        target_refs = self.resource_relationships.get(target_node.resource_type, {})
        for field, sources in target_refs.items():
            if source_node.resource_type in sources:
                return True
        return False
    
    def _find_reference_field(self, source_type: str, target_type: str) -> str:
        """Find the field that references target from source"""
        source_refs = self.resource_relationships.get(source_type, {})
        for field, targets in source_refs.items():
            if target_type in targets:
                return field
        return "subject"  # Default fallback
    
    def _topological_sort(self, nodes: List[QueryNode]) -> List[str]:
        """Determine execution order based on dependencies"""
        # Build adjacency list
        graph = {node.id: node.depends_on for node in nodes}
        
        # Count in-degrees
        in_degree = {node_id: 0 for node_id in graph}
        for deps in graph.values():
            for dep in deps:
                if dep in in_degree:
                    in_degree[dep] += 1
        
        # Start with nodes that have no dependencies
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            node_id = queue.pop(0)
            result.append(node_id)
            
            # Remove this node from dependencies
            for other_id, deps in graph.items():
                if node_id in deps:
                    in_degree[other_id] -= 1
                    if in_degree[other_id] == 0:
                        queue.append(other_id)
        
        # If we couldn't sort all nodes, there's a cycle
        if len(result) != len(nodes):
            logger.warning("Circular dependency detected in query plan")
            # Just return nodes in order defined
            return [node.id for node in nodes]
        
        return result
    
    def optimize_for_performance(self, plan: QueryPlan) -> QueryPlan:
        """Apply performance optimizations to the query plan"""
        # TODO: Implement optimizations like:
        # - Batch similar queries
        # - Add appropriate _count limits
        # - Use _summary when full resources aren't needed
        # - Reorder for cache efficiency
        
        return plan
    
    def estimate_query_cost(self, plan: QueryPlan) -> Dict[str, Any]:
        """Estimate the cost of executing a query plan"""
        total_queries = len(plan.nodes)
        estimated_records = 0
        includes_count = 0
        
        for node in plan.nodes:
            includes_count += len(node.includes) + len(node.revincludes)
            # Rough estimation based on resource type
            if node.resource_type == "Patient":
                estimated_records += 100
            elif node.resource_type in ["Observation", "Condition"]:
                estimated_records += 500
            else:
                estimated_records += 200
        
        return {
            "total_queries": total_queries,
            "estimated_records": estimated_records,
            "includes_count": includes_count,
            "complexity": "high" if total_queries > 5 or includes_count > 10 else "medium" if total_queries > 2 else "low"
        }