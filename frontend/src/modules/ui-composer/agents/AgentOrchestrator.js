/**
 * Agent Orchestrator for coordinating multi-agent workflow
 */

import DesignAgent from './DesignAgent';
import BuilderAgent from './BuilderAgent';
import RefinementAgent from './RefinementAgent';

class AgentOrchestrator {
  constructor() {
    this.designAgent = new DesignAgent();
    this.builderAgent = new BuilderAgent();
    this.refinementAgent = new RefinementAgent();
    
    this.conversationHistory = [];
    this.currentPhase = 'idle';
    this.listeners = new Set();
  }

  /**
   * Add status listener
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of status changes
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        // Ignore listener errors
      }
    });
  }

  /**
   * Process a natural language request through the agent workflow
   */
  async processRequest(request, context = {}) {
    try {
      this.currentPhase = 'analyzing';
      this.notifyListeners('phase_change', { phase: 'analyzing', progress: 0 });
      
      // Step 1: Design Agent analyzes request and creates specification
      this.notifyListeners('agent_start', { agent: 'design', message: 'Analyzing request and creating UI specification...' });
      
      // Pass method from context to agents
      const method = context.method || null;
      
      const designResult = await this.designAgent.analyzeRequest(request, context);
      
      if (!designResult.success) {
        throw new Error(`Design agent failed: ${designResult.error}`);
      }
      
      this.notifyListeners('agent_complete', { agent: 'design', result: designResult });
      this.currentPhase = 'designing';
      this.notifyListeners('phase_change', { phase: 'designing', progress: 33 });
      
      // Step 2: Builder Agent converts specification to React components
      this.notifyListeners('agent_start', { agent: 'builder', message: 'Generating React components...' });
      
      // Add method to specification for downstream use
      const specWithMethod = {
        ...designResult.specification,
        method
      };
      
      const buildResult = await this.builderAgent.buildComponents(specWithMethod);
      
      if (!buildResult.success) {
        throw new Error(`Builder agent failed: ${buildResult.error}`);
      }
      
      this.notifyListeners('agent_complete', { agent: 'builder', result: buildResult });
      this.currentPhase = 'building';
      this.notifyListeners('phase_change', { phase: 'building', progress: 66 });
      
      // Step 3: Compile and validate generated components
      const compilationResult = await this.compileComponents(buildResult.components);
      
      if (!compilationResult.success) {
        throw new Error(`Component compilation failed: ${compilationResult.error}`);
      }
      
      this.currentPhase = 'complete';
      this.notifyListeners('phase_change', { phase: 'complete', progress: 100 });
      
      // Add to conversation history
      this.conversationHistory.push({
        timestamp: new Date().toISOString(),
        request,
        context,
        designResult,
        buildResult,
        compilationResult
      });
      
      // Ensure specification includes components array
      const finalSpecification = {
        ...designResult.specification,
        components: Object.entries(buildResult.components || {}).map(([id, component]) => ({
          id,
          ...component
        }))
      };
      
      return {
        success: true,
        specification: finalSpecification,
        components: buildResult.components,
        compiledComponents: compilationResult.components,
        conversationId: this.conversationHistory.length - 1
      };
      
    } catch (error) {
      this.currentPhase = 'error';
      this.notifyListeners('error', { error: error.message });
      
      return {
        success: false,
        error: error.message,
        phase: this.currentPhase
      };
    }
  }

  /**
   * Refine existing specification based on feedback
   */
  async refineSpecification(specification, feedback, context = {}) {
    try {
      this.currentPhase = 'refining';
      this.notifyListeners('phase_change', { phase: 'refining', progress: 0 });
      this.notifyListeners('agent_start', { agent: 'refinement', message: 'Processing feedback and refining UI...' });
      
      // Add method to specification if provided in context
      const specWithMethod = {
        ...specification,
        method: context.method || specification.method
      };
      
      const refinementResult = await this.refinementAgent.refineUI(specWithMethod, feedback, context);
      
      if (!refinementResult.success) {
        throw new Error(`Refinement agent failed: ${refinementResult.error}`);
      }
      
      this.notifyListeners('agent_complete', { agent: 'refinement', result: refinementResult });
      this.notifyListeners('phase_change', { phase: 'refining', progress: 50 });
      
      // If specification changed, rebuild components
      if (refinementResult.specificationChanged) {
        this.notifyListeners('agent_start', { agent: 'builder', message: 'Rebuilding components after refinement...' });
        
        const buildResult = await this.builderAgent.buildComponents(refinementResult.specification);
        
        if (!buildResult.success) {
          throw new Error(`Builder agent failed during refinement: ${buildResult.error}`);
        }
        
        this.notifyListeners('agent_complete', { agent: 'builder', result: buildResult });
        this.notifyListeners('phase_change', { phase: 'refining', progress: 75 });
        
        // Compile refined components
        const compilationResult = await this.compileComponents(buildResult.components);
        
        if (!compilationResult.success) {
          throw new Error(`Component compilation failed during refinement: ${compilationResult.error}`);
        }
        
        this.currentPhase = 'complete';
        this.notifyListeners('phase_change', { phase: 'complete', progress: 100 });
        
        return {
          success: true,
          specification: refinementResult.specification,
          components: buildResult.components,
          compiledComponents: compilationResult.components,
          changes: refinementResult.changes
        };
      } else {
        this.currentPhase = 'complete';
        this.notifyListeners('phase_change', { phase: 'complete', progress: 100 });
        
        return {
          success: true,
          specification: refinementResult.specification,
          changes: refinementResult.changes
        };
      }
      
    } catch (error) {
      this.currentPhase = 'error';
      this.notifyListeners('error', { error: error.message });
      
      return {
        success: false,
        error: error.message,
        phase: this.currentPhase
      };
    }
  }

  /**
   * Compile generated components for runtime use
   */
  async compileComponents(components) {
    try {
      const compiledComponents = {};
      
      for (const [componentId, componentData] of Object.entries(components)) {
        try {
          // Validate component code
          if (!componentData.code || typeof componentData.code !== 'string') {
            throw new Error(`Invalid component code for ${componentId}`);
          }
          
          // Basic syntax validation
          if (!this.validateComponentSyntax(componentData.code)) {
            throw new Error(`Invalid React syntax in component ${componentId}`);
          }
          
          // Create component factory
          const componentFactory = this.createComponentFactory(componentData.code);
          
          compiledComponents[componentId] = {
            ...componentData,
            factory: componentFactory,
            compiled: true,
            compiledAt: new Date().toISOString()
          };
          
        } catch (error) {
          compiledComponents[componentId] = {
            ...componentData,
            compiled: false,
            error: error.message,
            compiledAt: new Date().toISOString()
          };
        }
      }
      
      return {
        success: true,
        components: compiledComponents
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Basic syntax validation for React components
   */
  validateComponentSyntax(code) {
    try {
      // Check for basic React component structure
      if (!code.includes('React') && !code.includes('import React')) {
        return false;
      }
      
      // Check for export statement
      if (!code.includes('export default') && !code.includes('export {')) {
        return false;
      }
      
      // Check for return statement or arrow function return
      if (!code.includes('return') && !code.includes('=>')) {
        return false;
      }
      
      // Basic JSX validation
      if (code.includes('<') && code.includes('>')) {
        // Check for matching JSX tags (basic check)
        const openTags = (code.match(/</g) || []).length;
        const closeTags = (code.match(/>/g) || []).length;
        if (openTags !== closeTags) {
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Create component factory for dynamic rendering
   */
  createComponentFactory(code) {
    // Return a function that can create the component
    return (props = {}) => {
      try {
        // This is a placeholder - in a real implementation, you'd need
        // a safe way to execute the generated code
        // For now, we'll return a placeholder component
        return {
          type: 'DynamicComponent',
          props: {
            ...props,
            generatedCode: code
          }
        };
      } catch (error) {
        return {
          type: 'ErrorComponent',
          props: {
            error: error.message
          }
        };
      }
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      currentPhase: this.currentPhase,
      conversationLength: this.conversationHistory.length,
      agents: {
        design: this.designAgent.getStatus(),
        builder: this.builderAgent.getStatus(),
        refinement: this.refinementAgent.getStatus()
      }
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.currentPhase = 'idle';
    this.notifyListeners('history_cleared', {});
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Get specific conversation entry
   */
  getConversation(id) {
    return this.conversationHistory[id] || null;
  }
}

export default AgentOrchestrator;