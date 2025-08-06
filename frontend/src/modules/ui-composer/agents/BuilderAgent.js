/**
 * Builder Agent - Converts UI specifications into React components
 */

import { COMPONENT_TYPES, CHART_TYPES, GRID_TYPES } from '../utils/uiSpecSchema';

class BuilderAgent {
  constructor() {
    this.status = 'idle';
    this.lastBuild = null;
  }

  /**
   * Build components from UI specification
   */
  async buildComponents(specification) {
    try {
      this.status = 'building';
      
      const components = {};
      
      // Check if we have components array directly in specification
      if (specification.components && specification.components.length > 0) {
        // Build from components array
        for (const component of specification.components) {
          await this.buildComponentsRecursive(component, components, specification);
        }
      } else if (specification.layout?.structure?.children) {
        // Build from layout structure
        await this.buildComponentsRecursive(specification.layout.structure, components, specification);
      } else {
        // No components to build
        return {
          success: true,
          components: {},
          specification
        };
      }
      
      this.lastBuild = {
        specification,
        components,
        timestamp: new Date().toISOString()
      };
      
      this.status = 'complete';
      
      return {
        success: true,
        components,
        specification
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
   * Build components recursively
   */
  async buildComponentsRecursive(componentSpec, components, specification) {
    if (!componentSpec || !componentSpec.type) {
      return;
    }
    
    const componentId = componentSpec.props?.id || `component-${Date.now()}`;
    
    // Use Claude API to generate component
    const componentCode = await this.generateComponentWithClaude(componentSpec, specification);
    
    components[componentId] = {
      id: componentId,
      type: componentSpec.type,
      props: componentSpec.props,
      code: componentCode,
      dataBinding: componentSpec.dataBinding,
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'BuilderAgent'
      }
    };
    
    // Process children
    if (componentSpec.children && Array.isArray(componentSpec.children)) {
      for (const child of componentSpec.children) {
        await this.buildComponentsRecursive(child, components, specification);
      }
    }
  }

  /**
   * Generate component using Claude API
   */
  async generateComponentWithClaude(componentSpec, specification) {
    // Check if we already have the code from the backend
    // The backend should have already generated all components when we analyzed the request
    
    // Import component registry to check if code exists
    const componentRegistry = (await import('../utils/componentRegistry')).default;
    
    // Check if component is already registered with code
    const existingComponent = componentRegistry.get(componentSpec.id);
    if (existingComponent && existingComponent.code) {
      return existingComponent.code;
    }
    
    // If not, we need to call the generate endpoint
    // But this should be done in batch, not per component
    const { uiComposerService } = await import('../../../services/uiComposerService');
    
    // Check if this is being called as part of the main flow
    // If so, just return placeholder and let the orchestrator handle batch generation
    if (specification._isFromOrchestrator) {
      return `// Placeholder for ${componentSpec.type} component`;
    }
    
    // Otherwise, generate just this component
    const requestSpec = {
      ...specification,
      components: [componentSpec]
    };
    
    const result = await uiComposerService.generateUI(requestSpec, true, specification.method);
    
    if (!result.success) {
      throw new Error(result.error || 'Component generation failed');
    }
    
    // Get the generated code
    const code = result.components?.main || Object.values(result.components || {})[0];
    
    if (!code) {
      throw new Error('No component code generated');
    }
    
    return code;
  }

  /**
   * Build component generation prompt
   */
  buildComponentPrompt(componentSpec, specification) {
    // Check if we have rich data context from agent pipeline
    const hasAgentPipeline = specification.metadata?.agentPipeline?.enabled;
    const dataContext = specification.metadata?.agentPipeline?.dataAnalysis;
    const resourceType = componentSpec.dataBinding?.resourceType;
    
    let dataContextSection = '';
    if (hasAgentPipeline && dataContext) {
      dataContextSection = `
REAL FHIR DATA CONTEXT:
${JSON.stringify(dataContext, null, 2)}

COMPONENT-SPECIFIC DATA:`;
      
      if (resourceType && dataContext.sampleData?.[resourceType]) {
        const sampleData = dataContext.sampleData[resourceType];
        dataContextSection += `
- Resource Type: ${resourceType}
- Available Records: ${sampleData.count}
- Sample Data Structure: ${JSON.stringify(sampleData.examples?.[0] || {}, null, 2)}
- Value Ranges: ${JSON.stringify(sampleData.valueRanges || {}, null, 2)}
- Date Range: ${JSON.stringify(sampleData.dateRange || {}, null, 2)}`;
      }
      
      if (dataContext.recommendations?.components) {
        const componentRecs = dataContext.recommendations.components
          .filter(rec => rec.type === componentSpec.type || rec.dataSource === resourceType)
          .slice(0, 3);
        if (componentRecs.length > 0) {
          dataContextSection += `

COMPONENT RECOMMENDATIONS:
${componentRecs.map(rec => `- ${rec.type}: ${rec.purpose} (Priority: ${rec.priority})`).join('\n')}`;
        }
      }
      
      if (dataContext.uiHints) {
        dataContextSection += `

UI GENERATION HINTS:
- Layout: ${dataContext.uiHints.layout}
- Emphasis: ${dataContext.uiHints.emphasis?.join(', ') || 'None'}
- Data Quality: ${dataContext.dataQuality?.volume} volume, ${(dataContext.dataQuality?.completeness * 100).toFixed(0)}% complete
${dataContext.uiHints.warnings?.length ? `- Warnings: ${dataContext.uiHints.warnings.join('; ')}` : ''}`;
      }
    }

    return `
Generate a React component for a clinical UI based on the following specification:

Component Type: ${componentSpec.type}
Component Props: ${JSON.stringify(componentSpec.props, null, 2)}
Data Binding: ${JSON.stringify(componentSpec.dataBinding, null, 2)}
${hasAgentPipeline ? '\n🤖 AGENT PIPELINE ENABLED - Use real FHIR data context below' : '\n⚠️  AGENT PIPELINE DISABLED - Using basic specification'}

${dataContextSection}

Overall UI Specification:
${JSON.stringify(specification, null, 2)}

Requirements:
1. Use Material-UI components (@mui/material, @mui/icons-material)
2. Follow WintEHR patterns and conventions
3. Include proper error handling and loading states
4. Use hooks for data fetching (assume useFHIRResources hook is available)
5. Include proper TypeScript types if applicable
6. Ensure clinical data safety and accuracy
7. Make the component responsive and accessible
8. Include proper FHIR data transformations
${hasAgentPipeline ? `9. **CRITICAL**: Use the REAL data context provided above - NO mock data
10. **CRITICAL**: Implement component based on actual data structure and ranges shown
11. **CRITICAL**: Handle the specific data volume and quality indicated
12. **CRITICAL**: Follow the component recommendations and UI hints provided` : `9. Use appropriate default data handling patterns`}

Available imports:
- React hooks (useState, useEffect, useMemo, useCallback)
- Material-UI components
- FHIR client hooks (useFHIRResources, useFHIRClient)
- Clinical data helpers from '../utils/clinicalDataHelpers'

Generate a complete, functional React component that follows these patterns:

\`\`\`jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert 
} from '@mui/material';
import { useFHIRResources } from '../../../hooks/useFHIRResources';
import { extractPatientDemographics } from '../utils/clinicalDataHelpers';

const GeneratedComponent = ({ ...props }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data fetching logic here
  
  // Loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }
  
  // Main component rendering
  return (
    <Box>
      {/* Component content */}
    </Box>
  );
};

export default GeneratedComponent;
\`\`\`

Focus on:
- Clinical accuracy and safety
- Proper data validation
- User-friendly error messages
- Responsive design
- Accessibility compliance
- Performance optimization
`;
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      status: this.status,
      lastBuild: this.lastBuild
    };
  }

  /**
   * Reset agent
   */
  reset() {
    this.status = 'idle';
    this.lastBuild = null;
  }
}

export default BuilderAgent;