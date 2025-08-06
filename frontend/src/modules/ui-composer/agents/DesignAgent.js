/**
 * Design Agent - Analyzes natural language requests and creates UI specifications
 */

import { 
  createDefaultUISpec, 
  createComponentSpec, 
  createDataSourceSpec,
  createChartSpec,
  createGridSpec,
  createSummarySpec,
  COMPONENT_TYPES,
  LAYOUT_TYPES,
  DATA_SCOPES,
  CHART_TYPES,
  GRID_TYPES
} from '../utils/uiSpecSchema';

class DesignAgent {
  constructor() {
    this.status = 'idle';
    this.lastAnalysis = null;
  }

  /**
   * Analyze natural language request and create UI specification
   */
  async analyzeRequest(request, context = {}) {
    try {
      this.status = 'analyzing';
      
      // Use Claude API to analyze the request
      const analysis = await this.analyzeWithClaude(request, context);
      
      if (!analysis.success) {
        throw new Error(analysis.error);
      }
      
      // Convert analysis to UI specification
      const specification = this.createSpecificationFromAnalysis(analysis.data);
      
      this.lastAnalysis = analysis;
      this.status = 'complete';
      
      return {
        success: true,
        specification,
        analysis: analysis.data,
        reasoning: analysis.reasoning
      };
      
    } catch (error) {
      this.status = 'error';
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Use backend API to analyze the request
   */
  async analyzeWithClaude(request, context) {
    // Import the UI Composer service
    const { uiComposerService } = await import('../../../services/uiComposerService');
    
    // Use the backend API to analyze the request
    const result = await uiComposerService.analyzeRequest(request, context, context.method);
    
    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }
    
    return {
      success: true,
      data: result.analysis || {},
      reasoning: result.reasoning || 'Analysis completed successfully'
    };
  }

  /**
   * Build analysis prompt for Claude
   */
  buildAnalysisPrompt(request, context) {
    // Check if we have rich FHIR context from the agent pipeline
    const hasAgentPipeline = context.agentPipelineUsed && context.fhirData;
    const fhirContext = context.fhirContext || '';
    
    return `
You are a clinical UI design expert. Analyze the following request and create a detailed UI specification for a healthcare application.

Request: "${request}"

Context:
- Current patient: ${context.patientId || 'Not specified'}
- Available FHIR resources: ${context.availableResources?.join(', ') || 'All standard FHIR resources'}
- User role: ${context.userRole || 'clinician'}
- Clinical setting: ${context.clinicalSetting || 'general practice'}
${hasAgentPipeline ? '- Agent Pipeline: ENABLED - Real FHIR data analysis completed' : '- Agent Pipeline: DISABLED - Using basic FHIR context'}

${fhirContext ? `\nREAL FHIR DATA ANALYSIS:
${fhirContext}

IMPORTANT: Use the above REAL data analysis to inform your UI design decisions. The data shown represents actual FHIR resources available in the database.` : ''}

Please analyze this request and respond with a JSON object containing:

{
  "intent": "brief description of what the user wants",
  "scope": "population|patient|encounter",
  "layoutType": "dashboard|report|focused-view",
  "requiredData": ["list of FHIR resource types needed"],
  "components": [
    {
      "type": "chart|grid|summary|form|timeline|stat|container|text",
      "purpose": "what this component will show",
      "dataBinding": {
        "resourceType": "FHIR resource type",
        "filters": ["any filters needed"],
        "aggregation": "how data should be aggregated"
      },
      "displayProperties": {
        "title": "component title",
        "chartType": "if chart: line|bar|pie|scatter|area",
        "gridType": "if grid: patient-list|result-list|medication-list|generic-table",
        "columns": ["if grid: column definitions"],
        "grouping": "how to group data"
      }
    }
  ],
  "layout": {
    "structure": "how components should be arranged",
    "responsive": "mobile considerations"
  }
}

Focus on:
1. Clinical accuracy and safety
2. Appropriate data visualization
3. User workflow optimization
4. Performance considerations
5. Accessibility requirements

Ensure all data comes from FHIR resources and follows clinical best practices.
`;
  }

  /**
   * Parse Claude's response
   */
  parseClaudeResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      
      const analysisData = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!analysisData.intent || !analysisData.scope || !analysisData.components) {
        throw new Error('Invalid analysis data structure');
      }
      
      return analysisData;
      
    } catch (error) {
      throw new Error(`Failed to parse Claude response: ${error.message}`);
    }
  }



  /**
   * Convert analysis to UI specification
   */
  createSpecificationFromAnalysis(analysis) {
    const spec = createDefaultUISpec(
      this.generateDashboardName(analysis.intent),
      analysis.intent
    );
    
    // Update metadata
    spec.metadata.clinicalContext.scope = analysis.scope;
    spec.metadata.clinicalContext.dataRequirements = analysis.requiredData;
    
    // Add agent pipeline metadata if available
    if (this.lastAnalysis?.data?.agentPipelineUsed) {
      spec.metadata.agentPipeline = {
        enabled: true,
        dataAnalysis: this.lastAnalysis.data.fhirData,
        queryPlan: this.lastAnalysis.data.queryPlan,
        executionResults: this.lastAnalysis.data.executionResults
      };
    }
    
    // Update layout type
    spec.layout.type = analysis.layoutType;
    
    // Create data sources with enhanced information
    const dataSources = analysis.requiredData.map(resourceType => {
      const dataSource = createDataSourceSpec(resourceType);
      
      // Enhance with real data information if available
      if (this.lastAnalysis?.data?.fhirData?.resourceSummary?.[resourceType]) {
        const resourceInfo = this.lastAnalysis.data.fhirData.resourceSummary[resourceType];
        dataSource.metadata = {
          ...dataSource.metadata,
          recordCount: resourceInfo.recordCount,
          purpose: resourceInfo.purpose,
          hasRealData: true
        };
      }
      
      return dataSource;
    });
    spec.dataSources = dataSources;
    
    // Create components
    const components = analysis.components.map(comp => {
      const dataSource = dataSources.find(ds => ds.resourceType === comp.dataBinding.resourceType);
      
      switch (comp.type) {
        case COMPONENT_TYPES.CHART:
          return createChartSpec(
            comp.displayProperties.chartType || CHART_TYPES.LINE,
            comp.displayProperties.title,
            dataSource?.id,
            'date',
            'value',
            comp.displayProperties
          );
          
        case COMPONENT_TYPES.GRID:
          return createGridSpec(
            comp.displayProperties.gridType || GRID_TYPES.GENERIC_TABLE,
            comp.displayProperties.title,
            dataSource?.id,
            comp.displayProperties.columns || ['name', 'status'],
            comp.displayProperties
          );
          
        case COMPONENT_TYPES.SUMMARY:
          return createSummarySpec(
            comp.displayProperties.title,
            dataSource?.id,
            'count',
            'id',
            comp.displayProperties
          );
          
        default:
          return createComponentSpec(comp.type, comp.displayProperties);
      }
    });
    
    // Add components to layout
    spec.layout.structure.children = components;
    
    // Also add components array for backend compatibility
    spec.components = components.map(comp => ({
      id: comp.props?.id || `component-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: comp.type,
      props: comp.props || {},
      dataBinding: comp.dataBinding || null,
      children: comp.children || []
    }));
    
    return spec;
  }

  /**
   * Generate dashboard name from intent
   */
  generateDashboardName(intent) {
    const timestamp = new Date().toLocaleString();
    return `${intent} - ${timestamp}`;
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      status: this.status,
      lastAnalysis: this.lastAnalysis
    };
  }

  /**
   * Reset agent
   */
  reset() {
    this.status = 'idle';
    this.lastAnalysis = null;
  }
}

export default DesignAgent;