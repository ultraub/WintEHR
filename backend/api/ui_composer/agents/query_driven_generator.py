"""
Query-Driven Component Generator
Generates React components based on FHIR query results and data relationships
"""

import logging
from typing import Dict, Any, List, Optional, Set
from datetime import datetime
import json

from .query_orchestrator import QueryResult
from .data_relationship_mapper import DataStructure, DataRelationshipMapper

logger = logging.getLogger(__name__)

class ComponentTemplate:
    """Base template for component generation"""
    
    @staticmethod
    def generate_imports(required_imports: Set[str]) -> str:
        """Generate import statements"""
        imports = [
            "import React, { useState, useEffect, useMemo } from 'react';",
            "import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip, Tab, Tabs, Divider } from '@mui/material';",
            "import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';",
            "import { format, parseISO, differenceInYears } from 'date-fns';",
            "import { TrendingUp, TrendingDown, Warning, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';"
        ]
        
        # Add specific imports based on requirements
        if "timeline" in required_imports:
            imports.append("import Timeline from '@mui/lab/Timeline';")
            imports.append("import TimelineItem from '@mui/lab/TimelineItem';")
            imports.append("import TimelineSeparator from '@mui/lab/TimelineSeparator';")
            imports.append("import TimelineConnector from '@mui/lab/TimelineConnector';")
            imports.append("import TimelineContent from '@mui/lab/TimelineContent';")
            imports.append("import TimelineDot from '@mui/lab/TimelineDot';")
        
        if "comparison" in required_imports:
            imports.append("import { DataGrid } from '@mui/x-data-grid';")
        
        return "\n".join(imports)
    
    @staticmethod
    def generate_helper_functions() -> str:
        """Generate common helper functions"""
        return """
// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy HH:mm');
  } catch {
    return dateString;
  }
};

const getValueWithUnit = (valueQuantity) => {
  if (!valueQuantity) return 'N/A';
  const value = valueQuantity.value || '';
  const unit = valueQuantity.unit || valueQuantity.code || '';
  return `${value} ${unit}`.trim();
};

const getCodingDisplay = (coding) => {
  if (!coding || !Array.isArray(coding)) return 'Unknown';
  const primaryCoding = coding.find(c => c.display) || coding[0];
  return primaryCoding?.display || primaryCoding?.code || 'Unknown';
};

const getResourceReference = (reference) => {
  if (!reference || !reference.reference) return null;
  const parts = reference.reference.split('/');
  return parts.length === 2 ? { type: parts[0], id: parts[1] } : null;
};

const getStatusColor = (status) => {
  const statusColors = {
    active: 'success',
    completed: 'default',
    error: 'error',
    stopped: 'warning',
    'entered-in-error': 'error',
    draft: 'info',
    unknown: 'default'
  };
  return statusColors[status?.toLowerCase()] || 'default';
};

const getRiskLevel = (value, thresholds) => {
  if (!value || !thresholds) return { level: 'normal', color: 'inherit' };
  
  if (value >= thresholds.critical) {
    return { level: 'critical', color: 'error' };
  } else if (value >= thresholds.high) {
    return { level: 'high', color: 'warning' };
  } else if (value <= thresholds.low) {
    return { level: 'low', color: 'info' };
  }
  return { level: 'normal', color: 'success' };
};
"""

class QueryDrivenGenerator:
    """Generates React components based on FHIR query results"""
    
    def __init__(self, generation_mode: str = 'mixed'):
        self.generation_mode = generation_mode
        self.component_patterns = self._load_component_patterns()
        self.fhir_mappings = self._load_fhir_mappings()
        logger.info(f"QueryDrivenGenerator initialized with mode: {generation_mode}")
    
    def _load_component_patterns(self) -> Dict[str, Any]:
        """Load component generation patterns"""
        return {
            "stat_card": {
                "template": "StatCard",
                "props": ["title", "value", "unit", "trend", "color", "icon"]
            },
            "data_grid": {
                "template": "DataTable",
                "props": ["columns", "rows", "sortable", "filterable", "selectable"]
            },
            "trend_chart": {
                "template": "TrendChart",
                "props": ["data", "dataKey", "xAxis", "yAxis", "color", "showTrend"]
            },
            "timeline": {
                "template": "Timeline",
                "props": ["events", "orientation", "showConnectors"]
            },
            "detail_card": {
                "template": "DetailCard",
                "props": ["title", "sections", "actions", "expandable"]
            },
            "comparison_table": {
                "template": "ComparisonTable",
                "props": ["items", "attributes", "highlight"]
            }
        }
    
    def _load_fhir_mappings(self) -> Dict[str, Any]:
        """Load FHIR resource to UI component mappings"""
        return {
            "Observation": {
                "display_fields": ["code", "value", "effectiveDateTime", "status"],
                "grouping": "code.coding[0].code",
                "sorting": "-effectiveDateTime",
                "visualization": "trend_chart"
            },
            "Condition": {
                "display_fields": ["code", "clinicalStatus", "verificationStatus", "onsetDateTime"],
                "grouping": "clinicalStatus.coding[0].code",
                "sorting": "-recordedDate",
                "visualization": "timeline"
            },
            "MedicationRequest": {
                "display_fields": ["medication", "dosageInstruction", "status", "authoredOn"],
                "grouping": "status",
                "sorting": "-authoredOn",
                "visualization": "data_grid"
            },
            "Procedure": {
                "display_fields": ["code", "status", "performedDateTime", "outcome"],
                "grouping": "category.coding[0].code",
                "sorting": "-performedDateTime",
                "visualization": "timeline"
            }
        }
    
    def generate_component(self, 
                         query_results: Dict[str, QueryResult],
                         data_structure: DataStructure,
                         ui_suggestions: Dict[str, Any],
                         component_name: str = "DynamicFHIRComponent") -> str:
        """Generate a complete React component based on query results"""
        
        # Analyze data to determine component structure
        primary_data = self._identify_primary_data(query_results, data_structure)
        component_sections = self._determine_component_sections(data_structure, ui_suggestions)
        required_imports = self._determine_required_imports(component_sections)
        
        # Generate component code
        component_code = []
        
        # Imports based on generation mode
        if self.generation_mode == 'full':
            # Full generation mode - creative imports
            component_code.append(self._generate_full_mode_imports(required_imports))
        elif self.generation_mode == 'template':
            # Template mode - minimal imports
            component_code.append(self._generate_template_mode_imports())
        else:
            # Mixed mode - balanced imports with WintEHR integration
            component_code.append(self._generate_mixed_mode_imports(required_imports))
        
        component_code.append("")
        
        # Helper functions
        component_code.append(ComponentTemplate.generate_helper_functions())
        component_code.append("")
        
        # Component definition
        component_code.append(f"const {component_name} = ({{ patientId }}) => {{")
        
        # State and effects based on generation mode
        if self.generation_mode == 'full':
            component_code.append(self._generate_full_mode_state(query_results, data_structure))
        elif self.generation_mode == 'template':
            component_code.append(self._generate_template_mode_state(query_results))
        else:
            component_code.append(self._generate_mixed_mode_state(query_results, data_structure))
        
        component_code.append("")
        
        # Data processing
        component_code.append(self._generate_data_processing(query_results, data_structure))
        component_code.append("")
        
        # Render sections
        component_code.append("  return (")
        component_code.append("    <Box sx={{ p: 3 }}>")
        
        # Generate each section
        for section in component_sections:
            section_code = self._generate_section(section, query_results, data_structure)
            component_code.append(section_code)
        
        component_code.append("    </Box>")
        component_code.append("  );")
        component_code.append("};")
        component_code.append("")
        component_code.append(f"export default {component_name};")
        
        return "\n".join(component_code)
    
    def _identify_primary_data(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> Optional[QueryResult]:
        """Identify the primary data source from query results"""
        if data_structure.primary_entity:
            # Find result matching primary entity
            for result in query_results.values():
                if result.resource_type == data_structure.primary_entity:
                    return result
        
        # Fall back to result with most records
        return max(query_results.values(), key=lambda r: len(r.resources)) if query_results else None
    
    def _determine_component_sections(self, data_structure: DataStructure, ui_suggestions: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Determine which sections to include in the component"""
        sections = []
        
        # Header section with summary stats
        if data_structure.aggregations or data_structure.metrics["total_records"] > 1:
            sections.append({
                "type": "summary_stats",
                "priority": 1
            })
        
        # Main content based on UI pattern
        pattern = ui_suggestions.get("primary_pattern", "population_overview")
        
        if pattern == "timeline_view":
            sections.append({
                "type": "timeline",
                "priority": 2,
                "data_source": "temporal"
            })
        elif pattern == "dashboard":
            sections.append({
                "type": "metric_cards",
                "priority": 2
            })
            sections.append({
                "type": "charts_grid",
                "priority": 3
            })
        elif pattern == "single_entity_details":
            sections.append({
                "type": "detail_cards",
                "priority": 2
            })
            if data_structure.temporal_data:
                sections.append({
                    "type": "trend_charts",
                    "priority": 3
                })
        else:  # population_overview
            sections.append({
                "type": "data_table",
                "priority": 2
            })
            if data_structure.aggregations:
                sections.append({
                    "type": "distribution_charts",
                    "priority": 3
                })
        
        # Add relationship visualization if complex
        if len(data_structure.relationships) > 2:
            sections.append({
                "type": "relationship_view",
                "priority": 4
            })
        
        return sorted(sections, key=lambda s: s["priority"])
    
    def _determine_required_imports(self, sections: List[Dict[str, Any]]) -> Set[str]:
        """Determine which additional imports are needed"""
        imports = set()
        
        for section in sections:
            if section["type"] == "timeline":
                imports.add("timeline")
            elif section["type"] == "data_table":
                imports.add("comparison")
            elif section["type"] in ["charts_grid", "trend_charts", "distribution_charts"]:
                imports.add("charts")
        
        return imports
    
    def _generate_state_management(self, query_results: Dict[str, QueryResult]) -> str:
        """Generate state management code"""
        state_vars = []
        
        # Generate state for each resource type
        for result_id, result in query_results.items():
            state_vars.append(f"  const [{result_id}Data, set{result_id.capitalize()}Data] = useState(null);")
        
        state_vars.append("  const [loading, setLoading] = useState(true);")
        state_vars.append("  const [error, setError] = useState(null);")
        state_vars.append("  const [selectedTab, setSelectedTab] = useState(0);")
        
        # Add mock data initialization (in real app, this would fetch from FHIR)
        state_vars.append("")
        state_vars.append("  useEffect(() => {")
        state_vars.append("    // In production, fetch from FHIR API")
        state_vars.append("    const loadData = async () => {")
        state_vars.append("      try {")
        
        # Initialize with actual query results
        for result_id, result in query_results.items():
            if result.resources:
                # Convert first few resources to display
                sample_data = json.dumps(result.resources[:5], default=str)
                state_vars.append(f"        set{result_id.capitalize()}Data({sample_data});")
        
        state_vars.append("        setLoading(false);")
        state_vars.append("      } catch (err) {")
        state_vars.append("        setError(err.message);")
        state_vars.append("        setLoading(false);")
        state_vars.append("      }")
        state_vars.append("    };")
        state_vars.append("    loadData();")
        state_vars.append("  }, [patientId]);")
        
        return "\n".join(state_vars)
    
    def _generate_data_processing(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate data processing logic"""
        processing = []
        
        # Process aggregations
        if data_structure.aggregations:
            processing.append("  // Process aggregated data")
            processing.append("  const aggregatedMetrics = useMemo(() => {")
            processing.append("    const metrics = {};")
            
            for agg_id, agg_data in data_structure.aggregations.items():
                processing.append(f"    metrics['{agg_id}'] = {json.dumps(agg_data, default=str)};")
            
            processing.append("    return metrics;")
            processing.append("  }, []);")
            processing.append("")
        
        # Process temporal data
        if data_structure.temporal_data:
            processing.append("  // Process temporal data for charts")
            processing.append("  const timeSeriesData = useMemo(() => {")
            processing.append("    const series = {};")
            
            for resource_type, temporal_info in data_structure.temporal_data.items():
                if temporal_info["has_time_series"]:
                    result = next((r for r in query_results.values() if r.resource_type == resource_type), None)
                    if result:
                        processing.append(f"    // Process {resource_type} time series")
                        processing.append(f"    series['{resource_type}'] = [];")
            
            processing.append("    return series;")
            processing.append("  }, []);")
        
        return "\n".join(processing)
    
    def _generate_section(self, section: Dict[str, Any], query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate code for a specific section"""
        section_type = section["type"]
        
        if section_type == "summary_stats":
            return self._generate_summary_stats(query_results, data_structure)
        elif section_type == "timeline":
            return self._generate_timeline(query_results, data_structure)
        elif section_type == "data_table":
            return self._generate_data_table(query_results, data_structure)
        elif section_type == "metric_cards":
            return self._generate_metric_cards(query_results, data_structure)
        elif section_type == "charts_grid":
            return self._generate_charts_grid(query_results, data_structure)
        elif section_type == "detail_cards":
            return self._generate_detail_cards(query_results, data_structure)
        elif section_type == "trend_charts":
            return self._generate_trend_charts(query_results, data_structure)
        else:
            return f"      {{/* {section_type} section */}}"
    
    def _generate_summary_stats(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate summary statistics section"""
        stats = []
        stats.append("      <Grid container spacing={3} sx={{ mb: 3 }}>")
        
        # Total records
        stats.append("        <Grid item xs={12} sm={6} md={3}>")
        stats.append("          <Card>")
        stats.append("            <CardContent>")
        stats.append("              <Typography color=\"textSecondary\" gutterBottom>")
        stats.append("                Total Records")
        stats.append("              </Typography>")
        stats.append(f"              <Typography variant=\"h4\">")
        stats.append(f"                {data_structure.metrics['total_records']}")
        stats.append("              </Typography>")
        stats.append("            </CardContent>")
        stats.append("          </Card>")
        stats.append("        </Grid>")
        
        # Resource types
        stats.append("        <Grid item xs={12} sm={6} md={3}>")
        stats.append("          <Card>")
        stats.append("            <CardContent>")
        stats.append("              <Typography color=\"textSecondary\" gutterBottom>")
        stats.append("                Resource Types")
        stats.append("              </Typography>")
        stats.append(f"              <Typography variant=\"h4\">")
        stats.append(f"                {data_structure.metrics['resource_types_count']}")
        stats.append("              </Typography>")
        stats.append("            </CardContent>")
        stats.append("          </Card>")
        stats.append("        </Grid>")
        
        stats.append("      </Grid>")
        
        return "\n".join(stats)
    
    def _generate_timeline(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate timeline section"""
        timeline = []
        timeline.append("      <Card sx={{ mb: 3 }}>")
        timeline.append("        <CardContent>")
        timeline.append("          <Typography variant=\"h6\" gutterBottom>")
        timeline.append("            Clinical Timeline")
        timeline.append("          </Typography>")
        timeline.append("          <Timeline position=\"alternate\">")
        
        # Add timeline items based on temporal data
        timeline.append("            {{/* Timeline items would be generated from temporal data */}}")
        
        timeline.append("          </Timeline>")
        timeline.append("        </CardContent>")
        timeline.append("      </Card>")
        
        return "\n".join(timeline)
    
    def _generate_data_table(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate data table section"""
        table = []
        
        # Find the primary data source
        primary_result = self._identify_primary_data(query_results, data_structure)
        if not primary_result or not primary_result.resources:
            return "      {{/* No data available for table */}}"
        
        # Get resource type and mapping
        resource_type = primary_result.resource_type
        mapping = self.fhir_mappings.get(resource_type, {})
        display_fields = mapping.get("display_fields", ["id", "status"])
        
        table.append("      <TableContainer component={Paper} sx={{ mb: 3 }}>")
        table.append("        <Table>")
        table.append("          <TableHead>")
        table.append("            <TableRow>")
        
        # Generate column headers based on actual data
        sample_resource = primary_result.resources[0] if primary_result.resources else {}
        columns = self._extract_table_columns(sample_resource, display_fields)
        
        for col in columns:
            table.append(f"              <TableCell>{col['label']}</TableCell>")
        
        table.append("            </TableRow>")
        table.append("          </TableHead>")
        table.append("          <TableBody>")
        table.append("            {loading ? (")
        table.append("              <TableRow>")
        table.append(f"                <TableCell colSpan={{{len(columns)}}} align=\"center\">")
        table.append("                  <CircularProgress />")
        table.append("                </TableCell>")
        table.append("              </TableRow>")
        table.append("            ) : (")
        table.append("              <>")
        table.append("                {{/* Rows would be generated from data */}}")
        table.append("              </>")
        table.append("            )}")
        table.append("          </TableBody>")
        table.append("        </Table>")
        table.append("      </TableContainer>")
        
        return "\n".join(table)
    
    def _extract_table_columns(self, sample_resource: Dict[str, Any], display_fields: List[str]) -> List[Dict[str, str]]:
        """Extract table columns from sample resource"""
        columns = []
        
        for field in display_fields:
            if "." in field:
                # Nested field
                parts = field.split(".")
                if parts[0] in sample_resource:
                    columns.append({
                        "field": field,
                        "label": parts[-1].title().replace("_", " ")
                    })
            elif field in sample_resource:
                columns.append({
                    "field": field,
                    "label": field.title().replace("_", " ")
                })
        
        return columns
    
    def _generate_metric_cards(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate metric cards section"""
        cards = []
        cards.append("      <Grid container spacing={3} sx={{ mb: 3 }}>")
        
        # Generate cards based on aggregations
        if data_structure.aggregations:
            for agg_id, agg_data in data_structure.aggregations.items():
                cards.append("        <Grid item xs={12} sm={6} md={4}>")
                cards.append("          <Card>")
                cards.append("            <CardContent>")
                cards.append("              <Typography color=\"textSecondary\" gutterBottom>")
                cards.append(f"                {agg_id.replace('_', ' ').title()}")
                cards.append("              </Typography>")
                cards.append("              <Typography variant=\"h5\">")
                cards.append(f"                {json.dumps(agg_data, default=str)}")
                cards.append("              </Typography>")
                cards.append("            </CardContent>")
                cards.append("          </Card>")
                cards.append("        </Grid>")
        
        cards.append("      </Grid>")
        
        return "\n".join(cards)
    
    def _generate_charts_grid(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate charts grid section"""
        charts = []
        charts.append("      <Grid container spacing={3}>")
        
        # Add charts based on data structure
        if data_structure.temporal_data:
            charts.append("        <Grid item xs={12} md={6}>")
            charts.append("          <Card>")
            charts.append("            <CardContent>")
            charts.append("              <Typography variant=\"h6\" gutterBottom>")
            charts.append("                Trends Over Time")
            charts.append("              </Typography>")
            charts.append("              <ResponsiveContainer width=\"100%\" height={300}>")
            charts.append("                <LineChart data={[]}>")
            charts.append("                  <CartesianGrid strokeDasharray=\"3 3\" />")
            charts.append("                  <XAxis dataKey=\"date\" />")
            charts.append("                  <YAxis />")
            charts.append("                  <ChartTooltip />")
            charts.append("                  <Legend />")
            charts.append("                  <Line type=\"monotone\" dataKey=\"value\" stroke=\"#8884d8\" />")
            charts.append("                </LineChart>")
            charts.append("              </ResponsiveContainer>")
            charts.append("            </CardContent>")
            charts.append("          </Card>")
            charts.append("        </Grid>")
        
        charts.append("      </Grid>")
        
        return "\n".join(charts)
    
    def _generate_detail_cards(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate detail cards section"""
        details = []
        
        # Generate a card for each resource type
        for result in query_results.values():
            if result.resources:
                details.append(f"      <Card sx={{ mb: 2 }}>")
                details.append("        <CardContent>")
                details.append("          <Typography variant=\"h6\" gutterBottom>")
                details.append(f"            {result.resource_type}")
                details.append("          </Typography>")
                details.append("          <Divider sx={{ my: 1 }} />")
                
                # Add resource-specific content
                mapping = self.fhir_mappings.get(result.resource_type, {})
                display_fields = mapping.get("display_fields", ["id", "status"])
                
                details.append("          {{/* Resource details would be displayed here */}}")
                
                details.append("        </CardContent>")
                details.append("      </Card>")
        
        return "\n".join(details)
    
    def _generate_trend_charts(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate trend charts section"""
        trends = []
        
        trends.append("      <Card sx={{ mt: 3 }}>")
        trends.append("        <CardContent>")
        trends.append("          <Typography variant=\"h6\" gutterBottom>")
        trends.append("            Clinical Trends")
        trends.append("          </Typography>")
        trends.append("          <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)}>")
        
        # Add tabs for different metrics
        tab_index = 0
        for resource_type, temporal_info in data_structure.temporal_data.items():
            if temporal_info["has_time_series"]:
                trends.append(f"            <Tab label=\"{resource_type}\" />")
                tab_index += 1
        
        trends.append("          </Tabs>")
        trends.append("          <Box sx={{ mt: 2 }}>")
        trends.append("            {{/* Chart content based on selected tab */}}")
        trends.append("          </Box>")
        trends.append("        </CardContent>")
        trends.append("      </Card>")
        
        return "\n".join(trends)
    
    def _generate_full_mode_imports(self, required_imports: Set[str]) -> str:
        """Generate imports for full generation mode with creative components"""
        imports = [
            "import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';",
            "import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip, Tab, Tabs, Divider, Button, Stack, Avatar, AvatarGroup, Badge, LinearProgress, Skeleton } from '@mui/material';",
            "import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, AreaChart, Area } from 'recharts';",
            "import { format, parseISO, differenceInYears, differenceInDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';",
            "import { TrendingUp, TrendingDown, Warning, CheckCircle, Error as ErrorIcon, LocalHospital, Favorite, Medication, Science, Timeline as TimelineIcon, Assessment } from '@mui/icons-material';",
            "import { motion, AnimatePresence } from 'framer-motion';",
            "import { useSpring, animated } from '@react-spring/web';"
        ]
        
        # Add WintEHR hooks for FHIR data
        imports.extend([
            "import { usePatientResources } from '../../../hooks/useFHIRResources';",
            "import { useFHIRClient } from '../../../contexts/FHIRClientContext';",
            "import { useMedicationResolver } from '../../../hooks/useMedicationResolver';",
            "import { useWebSocket } from '../../../contexts/WebSocketContext';"
        ])
        
        return "\n".join(imports)
    
    def _generate_mixed_mode_imports(self, required_imports: Set[str]) -> str:
        """Generate imports for mixed mode with WintEHR integration"""
        imports = [
            "import React, { useState, useEffect, useMemo } from 'react';",
            "import { Box, Card, CardContent, Typography, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, CircularProgress, IconButton, Tooltip } from '@mui/material';",
            "import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';",
            "import { format, parseISO } from 'date-fns';",
            "import { TrendingUp, TrendingDown, Warning, CheckCircle } from '@mui/icons-material';",
            "",
            "// WintEHR imports",
            "import { usePatientResources } from '../../../hooks/useFHIRResources';",
            "import { useFHIRClient } from '../../../contexts/FHIRClientContext';",
            "import { fhirService } from '../../../services/fhirService';"
        ]
        
        return "\n".join(imports)
    
    def _generate_template_mode_imports(self) -> str:
        """Generate minimal imports for template mode"""
        imports = [
            "import React from 'react';",
            "import { Box, Card, CardContent, Typography, Grid } from '@mui/material';",
            "import { usePatientResources } from '../../../hooks/useFHIRResources';"
        ]
        
        return "\n".join(imports)
    
    def _generate_full_mode_state(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate state management for full generation mode with animations and real-time updates"""
        state_vars = []
        
        # Map query results to resource types
        resource_types = set()
        for result in query_results.values():
            if result.resource_type:
                resource_types.add(result.resource_type)
        
        # Generate FHIR data hooks
        state_vars.append("  // FHIR data hooks")
        for resource_type in resource_types:
            state_vars.append(f"  const {{ resources: {resource_type.lower()}s, loading: loading{resource_type}, error: error{resource_type}, refetch: refetch{resource_type} }} = usePatientResources(patientId, '{resource_type}');")
        
        state_vars.append("")
        state_vars.append("  // Local state")
        state_vars.append("  const [selectedTimeRange, setSelectedTimeRange] = useState('6months');")
        state_vars.append("  const [selectedMetric, setSelectedMetric] = useState('all');")
        state_vars.append("  const [expandedSections, setExpandedSections] = useState({});")
        state_vars.append("  const [realTimeData, setRealTimeData] = useState({});")
        state_vars.append("")
        
        # Add WebSocket for real-time updates
        state_vars.append("  // Real-time updates")
        state_vars.append("  const { subscribe, unsubscribe } = useWebSocket();")
        state_vars.append("")
        state_vars.append("  useEffect(() => {")
        state_vars.append("    if (patientId) {")
        state_vars.append("      const subscription = subscribe('patient-updates', (data) => {")
        state_vars.append("        if (data.patientId === patientId) {")
        state_vars.append("          setRealTimeData(prev => ({ ...prev, [data.resourceType]: data }));")
        
        for resource_type in resource_types:
            state_vars.append(f"          if (data.resourceType === '{resource_type}') refetch{resource_type}();")
        
        state_vars.append("        }")
        state_vars.append("      });")
        state_vars.append("      return () => unsubscribe(subscription);")
        state_vars.append("    }")
        state_vars.append("  }, [patientId]);")
        
        # Add loading state
        state_vars.append("")
        state_vars.append("  const isLoading = " + " || ".join([f"loading{rt}" for rt in resource_types]) + ";")
        state_vars.append("  const hasError = " + " || ".join([f"error{rt}" for rt in resource_types]) + ";")
        
        return "\n".join(state_vars)
    
    def _generate_mixed_mode_state(self, query_results: Dict[str, QueryResult], data_structure: DataStructure) -> str:
        """Generate state management for mixed mode using WintEHR patterns"""
        state_vars = []
        
        # Extract resource types
        resource_types = set()
        for result in query_results.values():
            if result.resource_type:
                resource_types.add(result.resource_type)
        
        # Use standard WintEHR hooks
        state_vars.append("  // FHIR data hooks")
        for resource_type in resource_types:
            state_vars.append(f"  const {{ resources: {resource_type.lower()}s, loading: loading{resource_type} }} = usePatientResources(patientId, '{resource_type}');")
        
        state_vars.append("")
        state_vars.append("  // Combined loading state")
        state_vars.append("  const loading = " + " || ".join([f"loading{rt}" for rt in resource_types]) + ";")
        state_vars.append("")
        state_vars.append("  // Process data for display")
        state_vars.append("  const processedData = useMemo(() => {")
        state_vars.append("    if (loading) return null;")
        state_vars.append("    return {")
        
        for resource_type in resource_types:
            state_vars.append(f"      {resource_type.lower()}: {resource_type.lower()}s || [],")
        
        state_vars.append("    };")
        state_vars.append("  }, [" + ", ".join([f"{rt.lower()}s" for rt in resource_types]) + ", loading]);")
        
        return "\n".join(state_vars)
    
    def _generate_template_mode_state(self, query_results: Dict[str, QueryResult]) -> str:
        """Generate minimal state for template mode"""
        state_vars = []
        
        # Just basic data hooks
        resource_types = set()
        for result in query_results.values():
            if result.resource_type:
                resource_types.add(result.resource_type)
        
        state_vars.append("  // Data hooks")
        for resource_type in resource_types:
            state_vars.append(f"  const {{ resources: {resource_type.lower()}Data, loading }} = usePatientResources(patientId, '{resource_type}');")
        
        return "\n".join(state_vars)

def generate_component_from_query_results(
    query_results: Dict[str, QueryResult],
    query_plan: Dict[str, Any],
    component_name: str = "GeneratedComponent"
) -> str:
    """Main entry point for component generation"""
    
    # Analyze data relationships
    mapper = DataRelationshipMapper()
    data_structure = mapper.analyze_query_results(query_results, query_plan)
    ui_suggestions = mapper.suggest_ui_structure()
    
    # Generate component
    generator = QueryDrivenGenerator()
    component_code = generator.generate_component(
        query_results,
        data_structure,
        ui_suggestions,
        component_name
    )
    
    return component_code