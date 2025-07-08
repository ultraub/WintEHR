"""
Development Mode Service for UI Composer
Provides fallback functionality when Claude CLI is not authenticated
"""

import json
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class DevelopmentModeService:
    """Provides template-based UI generation in development mode"""
    
    def __init__(self):
        self.templates = {
            "dashboard": self._dashboard_template,
            "chart": self._chart_template,
            "grid": self._grid_template,
            "summary": self._summary_template
        }
    
    async def analyze_request(self, request: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze request using pattern matching and templates"""
        request_lower = request.lower()
        
        # Determine intent and scope
        intent = self._extract_intent(request_lower)
        scope = self._extract_scope(request_lower, context)
        components = self._suggest_components(request_lower, intent)
        
        analysis = {
            "intent": intent,
            "scope": scope,
            "layoutType": "dashboard" if len(components) > 1 else "focused-view",
            "requiredData": self._extract_required_data(request_lower, components),
            "components": components,
            "layout": {
                "structure": "grid",
                "responsive": "mobile-friendly"
            }
        }
        
        return analysis
    
    def _extract_intent(self, request: str) -> str:
        """Extract intent from request"""
        if any(word in request for word in ["show", "display", "view"]):
            if "trend" in request or "history" in request:
                return "View historical trends"
            elif "list" in request or "all" in request:
                return "View list of items"
            elif "summary" in request or "overview" in request:
                return "View summary information"
        elif any(word in request for word in ["analyze", "compare"]):
            return "Analyze and compare data"
        elif "monitor" in request:
            return "Monitor real-time data"
        
        return "Display clinical information"
    
    def _extract_scope(self, request: str, context: Dict[str, Any]) -> str:
        """Extract scope from request and context"""
        if context.get("patientId"):
            return "patient"
        elif any(word in request for word in ["population", "all patients", "cohort"]):
            return "population"
        elif any(word in request for word in ["encounter", "visit"]):
            return "encounter"
        
        return "patient"
    
    def _suggest_components(self, request: str, intent: str) -> List[Dict[str, Any]]:
        """Suggest components based on request"""
        components = []
        
        # Chart suggestions
        if any(word in request for word in ["trend", "chart", "graph", "plot"]):
            chart_type = "line"
            if "bar" in request:
                chart_type = "bar"
            elif "pie" in request:
                chart_type = "pie"
            
            components.append({
                "type": "chart",
                "purpose": "Display data trends over time",
                "dataBinding": {
                    "resourceType": self._guess_resource_type(request),
                    "filters": [],
                    "aggregation": "daily"
                },
                "displayProperties": {
                    "title": "Data Visualization",
                    "chartType": chart_type
                }
            })
        
        # Grid suggestions
        if any(word in request for word in ["list", "table", "grid"]):
            grid_type = "generic-table"
            if "patient" in request:
                grid_type = "patient-list"
            elif "result" in request or "lab" in request:
                grid_type = "result-list"
            elif "medication" in request:
                grid_type = "medication-list"
            
            components.append({
                "type": "grid",
                "purpose": "Display tabular data",
                "dataBinding": {
                    "resourceType": self._guess_resource_type(request),
                    "filters": [],
                    "aggregation": "none"
                },
                "displayProperties": {
                    "title": "Data Table",
                    "gridType": grid_type,
                    "columns": ["name", "status", "date"]
                }
            })
        
        # Summary suggestions
        if any(word in request for word in ["summary", "overview", "count"]):
            components.append({
                "type": "summary",
                "purpose": "Display summary statistics",
                "dataBinding": {
                    "resourceType": self._guess_resource_type(request),
                    "filters": [],
                    "aggregation": "count"
                },
                "displayProperties": {
                    "title": "Summary Statistics"
                }
            })
        
        # Default to a grid if no specific type identified
        if not components:
            components.append({
                "type": "grid",
                "purpose": "Display clinical data",
                "dataBinding": {
                    "resourceType": "Observation",
                    "filters": [],
                    "aggregation": "none"
                },
                "displayProperties": {
                    "title": "Clinical Data",
                    "gridType": "generic-table",
                    "columns": ["name", "value", "date"]
                }
            })
        
        return components
    
    def _guess_resource_type(self, request: str) -> str:
        """Guess FHIR resource type from request"""
        resource_map = {
            "lab": "Observation",
            "result": "Observation",
            "vital": "Observation",
            "medication": "MedicationRequest",
            "drug": "MedicationRequest",
            "condition": "Condition",
            "diagnosis": "Condition",
            "problem": "Condition",
            "allergy": "AllergyIntolerance",
            "procedure": "Procedure",
            "immunization": "Immunization",
            "vaccine": "Immunization",
            "encounter": "Encounter",
            "visit": "Encounter",
            "patient": "Patient"
        }
        
        for keyword, resource in resource_map.items():
            if keyword in request:
                return resource
        
        return "Observation"  # Default
    
    def _extract_required_data(self, request: str, components: List[Dict[str, Any]]) -> List[str]:
        """Extract required FHIR resources"""
        resources = set()
        
        # Get from components
        for comp in components:
            if comp.get("dataBinding", {}).get("resourceType"):
                resources.add(comp["dataBinding"]["resourceType"])
        
        # Add related resources
        if "Patient" in resources:
            resources.add("Encounter")
        if "MedicationRequest" in resources:
            resources.add("MedicationStatement")
        
        return list(resources)
    
    async def generate_component(self, component_spec: Dict[str, Any]) -> str:
        """Generate component code from specification"""
        component_type = component_spec.get("type", "container")
        
        if component_type in self.templates:
            return self.templates[component_type](component_spec)
        
        return self._default_template(component_spec)
    
    def _dashboard_template(self, spec: Dict[str, Any]) -> str:
        """Generate dashboard component"""
        return f'''
import React, {{ useState, useEffect }} from 'react';
import {{ Box, Grid, Paper, Typography, CircularProgress, Alert }} from '@mui/material';
import {{ useFHIRResources }} from '../../../hooks/useFHIRResources';

const GeneratedDashboard = ({{ patientId, ...props }}) => {{
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Placeholder for data fetching
  useEffect(() => {{
    setTimeout(() => setLoading(false), 1000);
  }}, []);
  
  if (loading) {{
    return (
      <Box display="flex" justifyContent="center" p={{4}}>
        <CircularProgress />
      </Box>
    );
  }}
  
  if (error) {{
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {{error}}
      </Alert>
    );
  }}
  
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        {spec.get("displayProperties", {}).get("title", "Dashboard")}
      </Typography>
      <Grid container spacing={{2}}>
        <Grid item xs={{12}} md={{6}}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Component 1</Typography>
            <Typography>Dashboard content will be generated here</Typography>
          </Paper>
        </Grid>
        <Grid item xs={{12}} md={{6}}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Component 2</Typography>
            <Typography>Additional content will appear here</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}};

export default GeneratedDashboard;
'''
    
    def _chart_template(self, spec: Dict[str, Any]) -> str:
        """Generate chart component"""
        chart_type = spec.get("displayProperties", {}).get("chartType", "line")
        title = spec.get("displayProperties", {}).get("title", "Chart")
        
        return f'''
import React, {{ useState, useEffect }} from 'react';
import {{ Box, Paper, Typography, CircularProgress }} from '@mui/material';
import {{ LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer }} from 'recharts';

const GeneratedChart = ({{ data, ...props }}) => {{
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {{
    // Simulated data for development
    const sampleData = [
      {{ date: '2024-01', value: 120 }},
      {{ date: '2024-02', value: 132 }},
      {{ date: '2024-03', value: 125 }},
      {{ date: '2024-04', value: 140 }},
      {{ date: '2024-05', value: 135 }}
    ];
    setChartData(sampleData);
    setLoading(false);
  }}, [data]);
  
  if (loading) {{
    return (
      <Box display="flex" justifyContent="center" p={{2}}>
        <CircularProgress size={{24}} />
      </Box>
    );
  }}
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={{300}}>
        <{'LineChart' if chart_type == 'line' else 'BarChart'} data={{chartData}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <{'Line' if chart_type == 'line' else 'Bar'} type="monotone" dataKey="value" stroke="#8884d8" {'fill="#8884d8"' if chart_type == 'bar' else ''} />
        </{'LineChart' if chart_type == 'line' else 'BarChart'}>
      </ResponsiveContainer>
    </Paper>
  );
}};

export default GeneratedChart;
'''
    
    def _grid_template(self, spec: Dict[str, Any]) -> str:
        """Generate grid component"""
        grid_type = spec.get("displayProperties", {}).get("gridType", "generic-table")
        title = spec.get("displayProperties", {}).get("title", "Data Table")
        columns = spec.get("displayProperties", {}).get("columns", ["name", "value", "date"])
        
        return f'''
import React, {{ useState, useEffect }} from 'react';
import {{
  Box, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress
}} from '@mui/material';

const GeneratedGrid = ({{ data, ...props }}) => {{
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {{
    // Simulated data for development
    const sampleRows = [
      {{ id: 1, {', '.join([f'{col}: "Sample {col} 1"' for col in columns])} }},
      {{ id: 2, {', '.join([f'{col}: "Sample {col} 2"' for col in columns])} }},
      {{ id: 3, {', '.join([f'{col}: "Sample {col} 3"' for col in columns])} }}
    ];
    setRows(sampleRows);
    setLoading(false);
  }}, [data]);
  
  if (loading) {{
    return (
      <Box display="flex" justifyContent="center" p={{2}}>
        <CircularProgress />
      </Box>
    );
  }}
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {' '.join([f'<TableCell>{col.title()}</TableCell>' for col in columns])}
            </TableRow>
          </TableHead>
          <TableBody>
            {{rows.map((row) => (
              <TableRow key={{row.id}}>
                {' '.join([f'<TableCell>{{row.{col}}}</TableCell>' for col in columns])}
              </TableRow>
            ))}}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}};

export default GeneratedGrid;
'''
    
    def _summary_template(self, spec: Dict[str, Any]) -> str:
        """Generate summary component"""
        title = spec.get("displayProperties", {}).get("title", "Summary")
        
        return f'''
import React, {{ useState, useEffect }} from 'react';
import {{ Box, Paper, Typography, Grid, CircularProgress }} from '@mui/material';

const GeneratedSummary = ({{ data, ...props }}) => {{
  const [stats, setStats] = useState({{}});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {{
    // Simulated stats for development
    const sampleStats = {{
      total: 42,
      active: 15,
      completed: 27,
      average: 28.5
    }};
    setStats(sampleStats);
    setLoading(false);
  }}, [data]);
  
  if (loading) {{
    return (
      <Box display="flex" justifyContent="center" p={{2}}>
        <CircularProgress />
      </Box>
    );
  }}
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Grid container spacing={{2}}>
        <Grid item xs={{6}} sm={{3}}>
          <Typography variant="subtitle2" color="textSecondary">
            Total
          </Typography>
          <Typography variant="h4">
            {{stats.total}}
          </Typography>
        </Grid>
        <Grid item xs={{6}} sm={{3}}>
          <Typography variant="subtitle2" color="textSecondary">
            Active
          </Typography>
          <Typography variant="h4" color="primary">
            {{stats.active}}
          </Typography>
        </Grid>
        <Grid item xs={{6}} sm={{3}}>
          <Typography variant="subtitle2" color="textSecondary">
            Completed
          </Typography>
          <Typography variant="h4" color="success.main">
            {{stats.completed}}
          </Typography>
        </Grid>
        <Grid item xs={{6}} sm={{3}}>
          <Typography variant="subtitle2" color="textSecondary">
            Average
          </Typography>
          <Typography variant="h4">
            {{stats.average}}
          </Typography>
        </Grid>
      </Grid>
    </Paper>
  );
}};

export default GeneratedSummary;
'''
    
    def _default_template(self, spec: Dict[str, Any]) -> str:
        """Generate default component"""
        return f'''
import React from 'react';
import {{ Box, Paper, Typography }} from '@mui/material';

const GeneratedComponent = (props) => {{
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">
        {spec.get("displayProperties", {}).get("title", "Component")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Component type: {spec.get("type", "unknown")}
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography>
          This is a placeholder component generated in development mode.
        </Typography>
      </Box>
    </Paper>
  );
}};

export default GeneratedComponent;
'''
    
    async def refine_ui(self, feedback: str, specification: Dict[str, Any], 
                       feedback_type: str = "general") -> Dict[str, Any]:
        """Provide refinement suggestions based on feedback"""
        feedback_lower = feedback.lower()
        changes = []
        
        # Analyze feedback for common patterns
        if "bigger" in feedback_lower or "larger" in feedback_lower:
            changes.append({
                "type": "update",
                "target": "styling",
                "property": "size",
                "value": "large",
                "reasoning": "User requested larger size"
            })
        
        if "color" in feedback_lower:
            changes.append({
                "type": "update",
                "target": "styling",
                "property": "color",
                "value": "primary",
                "reasoning": "User requested color change"
            })
        
        if "remove" in feedback_lower:
            changes.append({
                "type": "remove",
                "target": "component",
                "reasoning": "User requested removal"
            })
        
        if "add" in feedback_lower:
            if "filter" in feedback_lower:
                changes.append({
                    "type": "add",
                    "target": "component",
                    "componentType": "filter",
                    "reasoning": "User requested filter addition"
                })
        
        return {
            "changes": changes,
            "reasoning": f"Applied {len(changes)} changes based on user feedback"
        }

# Singleton instance
development_mode_service = DevelopmentModeService()