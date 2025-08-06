/**
 * Simple Orchestrator for UI Composer
 * Handles the flow: analyze -> generate -> display
 */

import { uiComposerService } from '../../../services/uiComposerService';
import componentRegistry from '../utils/componentRegistry';

class SimpleOrchestrator {
  constructor() {
    this.listeners = new Set();
    this.sessionId = null;
  }

  /**
   * Process user request
   */
  async processRequest(request, context = {}) {
    try {
      // Step 1: Analyze the request
      this.notifyListeners('phase_change', { phase: 'analyzing', progress: 0, message: 'Analyzing your request...' });
      
      const analyzeResult = await uiComposerService.analyzeRequest(request, {...context, model: context.model}, context.method);
      
      if (!analyzeResult.success) {
        throw new Error(analyzeResult.error || 'Analysis failed');
      }
      
      // Track session ID
      if (analyzeResult.session_id) {
        this.sessionId = analyzeResult.session_id;
      }
      
      // Add method and model to specification for downstream use
      analyzeResult.specification.method = context.method;
      analyzeResult.specification.model = context.model;
      analyzeResult.specification._isFromOrchestrator = true;
      
      // Step 2: Generate components
      this.notifyListeners('phase_change', { phase: 'generating', progress: 50, message: 'Generating components...' });
      
      const generateResult = await uiComposerService.generateUI(analyzeResult.specification, true, context.method);
      
      if (!generateResult.success) {
        throw new Error(generateResult.error || 'Generation failed');
      }
      
      // Step 3: Register components
      this.notifyListeners('phase_change', { phase: 'registering', progress: 75, message: 'Preparing preview...' });
      
      // Clear previous components
      componentRegistry.clear();
      
      // Register each component with cleaned code
      for (const [componentId, code] of Object.entries(generateResult.components)) {
        // Clean markdown if present
        let cleanCode = code;
        if (typeof code === 'string' && code.includes('```')) {
          const codeBlockRegex = /```(?:jsx?|javascript|typescript|tsx?)?\n?([\s\S]*?)```/g;
          const matches = [...code.matchAll(codeBlockRegex)];
          if (matches.length > 0) {
            cleanCode = matches[0][1].trim();
          }
        }
        
        componentRegistry.register(componentId, cleanCode, {
          type: 'generated',
          timestamp: new Date().toISOString()
        });
      }
      
      this.notifyListeners('phase_change', { phase: 'complete', progress: 100, message: 'UI generated successfully!' });
      
      return {
        success: true,
        specification: analyzeResult.specification,
        components: generateResult.components
      };
      
    } catch (error) {
      this.notifyListeners('error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add event listener
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        // Listener error silently handled
      }
    });
  }
}

export default SimpleOrchestrator;