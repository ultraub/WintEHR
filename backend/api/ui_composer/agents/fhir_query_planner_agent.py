#!/usr/bin/env python3
"""
FHIR Query Planner Agent
Uses Claude to analyze natural language requests and determine what FHIR queries are needed
"""

import sys
import json
import subprocess
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class FHIRQueryPlannerAgent:
    """Agent that uses Claude to plan FHIR queries from natural language requests"""
    
    def __init__(self):
        self.status = 'idle'
        self.last_plan = None
    
    async def plan_queries(self, request: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze a natural language request and create a plan for FHIR queries
        
        Args:
            request: Natural language description of data needed
            context: Additional context (patient ID, date range, etc.)
        
        Returns:
            Dict containing query plan with FHIR resource types, search parameters, and aggregations
        """
        try:
            self.status = 'planning'
            
            # Build Claude prompt for query planning
            prompt = self._build_query_planning_prompt(request, context or {})
            
            # Execute Claude CLI
            result = subprocess.run(
                ["claude", "--print", prompt],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"Claude CLI error: {result.stderr}")
            
            # Parse response
            response_text = result.stdout.strip()
            query_plan = self._parse_claude_response(response_text)
            
            self.last_plan = query_plan
            self.status = 'complete'
            
            return {
                "success": True,
                "queryPlan": query_plan,
                "reasoning": query_plan.get("reasoning", "Query plan created successfully")
            }
            
        except subprocess.TimeoutExpired:
            self.status = 'error'
            raise TimeoutError("Claude CLI timed out during query planning")
        except Exception as e:
            self.status = 'error'
            logger.error(f"Error planning FHIR queries: {e}")
            raise
    
    def _build_query_planning_prompt(self, request: str, context: Dict[str, Any]) -> str:
        """Build prompt for Claude to plan FHIR queries"""
        
        # Include available FHIR context if provided
        fhir_context = context.get('fhirContext', '')
        patient_id = context.get('patientId', '')
        
        return f"""
You are a FHIR query planning expert for the WintEHR clinical system. Analyze the following natural language request and create a detailed plan for FHIR queries needed to retrieve the relevant data.

Request: "{request}"

Context:
- Patient ID: {patient_id or 'Not specified - population query'}
- User Role: {context.get('userRole', 'clinician')}
- Date Range: {context.get('dateRange', 'Not specified')}

{fhir_context}

Please analyze this request and create a sophisticated query plan with dependencies. 

For complex requests, use a multi-stage approach where later queries can reference results from earlier ones.
Use _include and _revinclude to minimize the number of queries needed.

Respond with a JSON object containing:

{{
  "reasoning": "explanation of what data is needed and why",
  "scope": "patient|population|encounter",
  "queryGraph": {{
    "stages": {{
      "stage1": {{
        "id": "stage1",
        "resourceType": "FHIR resource type",
        "purpose": "what this query will retrieve",
        "filters": {{
          "code": "LOINC/SNOMED codes if needed",
          "status": "active|completed|etc",
          "date": "date range if temporal",
          "value-quantity": "value comparisons"
        }},
        "_include": ["ResourceType:field"],
        "_revinclude": ["ResourceType:field:target"],
        "fields": ["specific fields needed, leave empty for all"],
        "aggregate": {{
          "type": "latest_per_patient|count|avg|group",
          "field": "field to aggregate",
          "groupBy": "grouping field"
        }}
      }},
      "stage2": {{
        "id": "stage2", 
        "resourceType": "Another resource type",
        "purpose": "purpose",
        "dependsOn": ["stage1"],
        "filters": {{
          "subject": "{{stage1.ids}}", // Reference previous results
          "code": "relevant codes"
        }},
        "_include": ["includes if needed"]
      }}
    }},
    "execution_order": ["stage1", "stage2"],
    "relationships": {{
      "stage1": [["stage2", "feeds_data"]],
      "stage2": []
    }}
  }},
  "dataFlow": {{
    "primary": "which stage provides primary data",
    "supporting": ["stages providing context"],
    "aggregations": ["stages with aggregations"]
  }},
  "expectedResults": {{
    "totalQueries": "number after optimization",
    "estimatedRecords": "approximate total records",
    "primaryData": "main data driving the UI",
    "supportingData": "additional context data"
  }},
  "uiComponents": [
    {{
      "type": "chart|grid|summary|timeline|stat",
      "dataSource": "which query result feeds this component",
      "aggregationNeeded": "what processing is needed"
    }}
  ]
}}

Focus on:
1. **Clinical Accuracy**: Use correct LOINC codes, SNOMED codes, and FHIR search parameters
2. **Performance**: Minimize queries while getting complete data
3. **Real Data**: Plan for actual FHIR resources in the WintEHR database
4. **Temporal Context**: Consider date ranges and trends for clinical data
5. **Patient Safety**: Ensure queries return clinically relevant and accurate data

IMPORTANT FHIR Resource Types and Common Use Cases:
- **Observation**: Lab results, vital signs, measurements
  - A1c: 4548-4
  - Blood Pressure: 8480-6 (systolic), 8462-4 (diastolic)
  - Temperature: 8310-5
  - Heart Rate: 8867-4
  - Respiratory Rate: 9279-1
  - White Blood Cell Count: 6690-2
  - Lactate: 2524-7
  - C-Reactive Protein: 1988-5
  - Procalcitonin: 75241-0
- **Condition**: Diagnoses, problems
  - Diabetes: 44054006
  - Hypertension: 38341003, 59621000
  - Sepsis: 91302008
  - SIRS: 238149007
  - Infection: 40733004
- **MedicationRequest**: Prescriptions, current medications
- **DiagnosticReport**: Lab reports, imaging reports
- **Procedure**: Interventions, surgeries
- **AllergyIntolerance**: Drug and environmental allergies
- **Encounter**: Visits, admissions
- **Patient**: Demographics, contact info

Common Search Patterns:
- Patient-specific: `patient=[patient-id]`
- Lab values: `code=4548-4&value-quantity=gt8.0` (A1c > 8.0%)
- Date ranges: `date=ge2023-01-01&date=le2023-12-31`
- Status filtering: `status=active`
- Sorting: `_sort=-date` (newest first)
- Multiple codes: `code=8310-5,8867-4,9279-1` (temp, HR, RR for sepsis)
- Abnormal values: `code=6690-2&value-quantity=gt12000|lt4000` (abnormal WBC)

Sepsis Risk Indicators:
- Vital signs: Temperature >38°C or <36°C, HR >90, RR >20
- Labs: WBC >12000 or <4000, elevated lactate, CRP, procalcitonin
- Conditions: Recent infections, immunocompromise
- Consider SIRS criteria: 2+ abnormal vital signs + suspected infection

IMPORTANT: Return ONLY the JSON object, no additional text or markdown.
"""
    
    def _parse_claude_response(self, response: str) -> Dict[str, Any]:
        """Parse Claude's query planning response"""
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                query_plan = json.loads(json_str)
                
                # Handle both old format (queries array) and new format (queryGraph)
                if 'queryGraph' in query_plan:
                    # New format - convert stages to queries array for compatibility
                    queries = []
                    stages = query_plan['queryGraph'].get('stages', {})
                    
                    for stage_id, stage in stages.items():
                        query = {
                            'id': stage_id,
                            'resourceType': stage.get('resourceType'),
                            'purpose': stage.get('purpose'),
                            'searchParameters': stage.get('filters', {}),
                            'aggregations': [stage['aggregate']] if 'aggregate' in stage else [],
                            'priority': 'high' if stage_id in query_plan.get('dataFlow', {}).get('primary', '') else 'medium'
                        }
                        
                        # Add includes/revincludes to search parameters
                        if '_include' in stage:
                            query['searchParameters']['_include'] = stage['_include']
                        if '_revinclude' in stage:
                            query['searchParameters']['_revinclude'] = stage['_revinclude']
                        
                        queries.append(query)
                    
                    query_plan['queries'] = queries
                
                # Validate required fields
                required_fields = ['reasoning', 'scope']
                for field in required_fields:
                    if field not in query_plan:
                        raise ValueError(f"Missing required field: {field}")
                
                # Ensure queries exist
                if 'queries' not in query_plan:
                    raise ValueError("Missing queries in response")
                
                # Validate query structure
                for query in query_plan.get('queries', []):
                    if 'resourceType' not in query or 'purpose' not in query:
                        raise ValueError("Invalid query structure - missing resourceType or purpose")
                
                return query_plan
            else:
                raise ValueError("No valid JSON found in Claude response")
                
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON from Claude response: {e}")
        except Exception as e:
            raise ValueError(f"Error parsing Claude response: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "status": self.status,
            "lastPlan": self.last_plan
        }
    
    def reset(self):
        """Reset agent state"""
        self.status = 'idle'
        self.last_plan = None

def main():
    """Main entry point for CLI usage"""
    if len(sys.argv) < 2:
        print("Usage: fhir_query_planner_agent.py 'request description' [context_json]")
        sys.exit(1)
    
    request = sys.argv[1]
    context = {}
    
    if len(sys.argv) > 2:
        try:
            context = json.loads(sys.argv[2])
        except json.JSONDecodeError:
            print("Warning: Invalid context JSON, using empty context", file=sys.stderr)
    
    try:
        agent = FHIRQueryPlannerAgent()
        import asyncio
        result = asyncio.run(agent.plan_queries(request, context))
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()