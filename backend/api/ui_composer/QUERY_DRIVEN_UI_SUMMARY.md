# Query-Driven UI Generation System

## Overview

This system implements sophisticated FHIR query-driven dynamic UI generation for MedGenEMR. It automatically generates React components based on intelligent FHIR query planning with chaining, includes, and optimal data fetching.

## Key Components

### 1. **UIGenerationOrchestrator** (`ui_generation_orchestrator.py`)
- Main orchestrator that coordinates the entire pipeline
- Takes natural language requests and generates complete UI components
- Manages the flow: Query Planning → Query Execution → Data Analysis → Component Generation

### 2. **FHIRQueryPlannerAgent** (`fhir_query_planner_agent.py`)
- Enhanced to generate multi-stage query plans with dependencies
- Supports _include/_revinclude parameters for efficient data fetching
- Creates query graphs that minimize API calls

### 3. **FHIRQueryBuilder** (`fhir_query_builder.py`)
- Builds optimized FHIR queries from high-level specifications
- Implements query node structure with dependencies
- Optimizes includes/revincludes to minimize queries

### 4. **QueryOrchestrator** (`query_orchestrator.py`)
- Executes complex query plans with dependency resolution
- Handles result caching and aggregations
- Manages multi-stage query execution

### 5. **DataRelationshipMapper** (`data_relationship_mapper.py`)
- Analyzes FHIR query results to discover data relationships
- Suggests optimal UI structures based on data patterns
- Identifies hierarchies, temporal data, and aggregations

### 6. **QueryDrivenGenerator** (`query_driven_generator.py`)
- Generates React components based on actual query results
- Creates data-driven UI components, not templates
- Uses actual LOINC/SNOMED codes from data

## How It Works

1. **Natural Language Input**: "Show me all patients with high blood pressure and their risk of stroke"

2. **Query Planning**: 
   ```json
   {
     "queryGraph": {
       "stages": {
         "stage1": {
           "resourceType": "Condition",
           "filters": {"code": "38341003"},
           "_include": ["Condition:subject"]
         },
         "stage2": {
           "resourceType": "Observation",
           "filters": {"code": "8480-6,8462-4"},
           "dependsOn": ["stage1"]
         }
       }
     }
   }
   ```

3. **Query Execution**: Fetches actual FHIR data with optimized queries

4. **Data Analysis**: 
   - Discovers relationships between resources
   - Identifies temporal patterns
   - Suggests UI structure (dashboard, timeline, etc.)

5. **Component Generation**: Creates React component with:
   - Real data bindings
   - Appropriate visualizations
   - Loading states and error handling
   - Material-UI components

## Integration

### In UI Composer Service
```python
# Enable query-driven generation
context = {
    "useQueryDriven": True,  # Enables new system
    "patientId": "optional-patient-id",
    "scope": "population"  # or "patient"
}
```

### In Claude CLI Service
The system automatically detects query results and uses query-driven generation when available:
```python
if query_results and query_plan:
    # Use query-driven generation
    component_code = generate_component_from_query_results(...)
```

## Benefits

1. **Dynamic Generation**: Components reflect actual data structure, not templates
2. **Optimized Queries**: Uses FHIR _include/_revinclude to minimize API calls
3. **Intelligent UI**: Automatically selects appropriate visualizations
4. **Real Data**: Uses actual LOINC/SNOMED codes from the database
5. **Scalable**: Handles both patient-specific and population queries

## Example Output

For hypertension/stroke risk query:
- Identifies Condition and Observation resources
- Creates dashboard with:
  - Summary statistics cards
  - Patient data table with BP values
  - Risk assessment indicators
  - Temporal trends chart
- Uses actual codes from data (e.g., 38341003 for hypertension)

## Testing

Run the test script:
```bash
cd backend/api/ui_composer
python test_query_driven.py
```

This tests the hypertension/stroke risk scenario and generates a complete React component.

## Future Enhancements

1. **Advanced Aggregations**: Implement FHIRAggregationService for complex analytics
2. **Real-time Updates**: WebSocket integration for live data
3. **Multi-component Generation**: Generate entire dashboard layouts
4. **Performance Optimization**: Parallel query execution, better caching
5. **ML Integration**: Use ML to improve query planning and UI suggestions