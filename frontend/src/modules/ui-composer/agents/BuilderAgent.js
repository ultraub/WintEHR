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
      
      // Build components recursively
      await this.buildComponentsRecursive(specification.layout.structure, components, specification);
      
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
    if (!window.claude || !window.claude.complete) {
      throw new Error('Claude is not available. Please ensure you are running in Claude Code environment with window.claude.complete accessible.');
    }
    
    const prompt = this.buildComponentPrompt(componentSpec, specification);
    
    // Use window.claude.complete to access local Claude instance
    const response = await window.claude.complete(prompt);
    
    // Extract React component code from response
    const codeMatch = response.match(/```(?:jsx?|typescript?)?\n([\s\S]*?)\n```/);
    if (!codeMatch) {
      throw new Error('No component code found in Claude response. Response should contain code wrapped in triple backticks.');
    }
    
    return codeMatch[1];
  }

  /**
   * Build component generation prompt
   */
  buildComponentPrompt(componentSpec, specification) {
    return `
Generate a React component for a clinical UI based on the following specification:

Component Type: ${componentSpec.type}
Component Props: ${JSON.stringify(componentSpec.props, null, 2)}
Data Binding: ${JSON.stringify(componentSpec.dataBinding, null, 2)}

Overall UI Specification:
${JSON.stringify(specification, null, 2)}

Requirements:
1. Use Material-UI components (@mui/material, @mui/icons-material)
2. Follow MedGenEMR patterns and conventions
3. Include proper error handling and loading states
4. Use hooks for data fetching (assume useFHIRResources hook is available)
5. Include proper TypeScript types if applicable
6. Ensure clinical data safety and accuracy
7. Make the component responsive and accessible
8. Include proper FHIR data transformations

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