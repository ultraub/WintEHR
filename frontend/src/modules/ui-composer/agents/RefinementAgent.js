/**
 * Refinement Agent - Handles UI modifications based on user feedback
 */

import { 
  updateComponentInSpec, 
  addComponentToSpec, 
  findComponentById,
  COMPONENT_TYPES 
} from '../utils/uiSpecSchema';

class RefinementAgent {
  constructor() {
    this.status = 'idle';
    this.lastRefinement = null;
    this.refinementHistory = [];
  }

  /**
   * Refine UI based on user feedback
   */
  async refineUI(specification, feedback, context = {}) {
    try {
      this.status = 'refining';
      
      // Analyze feedback to determine changes needed
      const analysis = await this.analyzeFeedback(feedback, specification, context);
      
      if (!analysis.success) {
        throw new Error(analysis.error);
      }
      
      // Apply changes to specification
      const refinedSpec = await this.applyChanges(specification, analysis.changes);
      
      // Track refinement history
      const refinementEntry = {
        timestamp: new Date().toISOString(),
        feedback,
        changes: analysis.changes,
        originalSpec: specification,
        refinedSpec
      };
      
      this.refinementHistory.push(refinementEntry);
      this.lastRefinement = refinementEntry;
      this.status = 'complete';
      
      return {
        success: true,
        specification: refinedSpec,
        changes: analysis.changes,
        specificationChanged: analysis.changes.length > 0
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
   * Analyze feedback to determine what changes are needed
   */
  async analyzeFeedback(feedback, specification, context) {
    // Use Claude API to analyze feedback
    const analysis = await this.analyzeFeedbackWithClaude(feedback, specification, context);
    
    return {
      success: true,
      changes: analysis.changes,
      reasoning: analysis.reasoning
    };
  }

  /**
   * Analyze feedback using backend API
   */
  async analyzeFeedbackWithClaude(feedback, specification, context) {
    // Import the UI Composer service
    const { uiComposerService } = await import('../../../services/uiComposerService');
    
    // Use the backend API to refine the UI
    const result = await uiComposerService.refineUI(
      feedback.text,
      specification,
      feedback.type || 'general',
      feedback.componentId || null,
      specification.method
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Refinement failed');
    }
    
    // Return the changes analysis
    return {
      changes: result.changes || [],
      reasoning: result.reasoning || 'Refinement completed'
    };
  }

  /**
   * Build feedback analysis prompt
   */
  buildFeedbackAnalysisPrompt(feedback, specification, context) {
    return `
You are a UI refinement expert. Analyze the following user feedback and determine what changes need to be made to the UI specification.

User Feedback: "${feedback.text}"
Feedback Type: ${feedback.type || 'general'}
Component ID: ${feedback.componentId || 'not specified'}

Current UI Specification:
${JSON.stringify(specification, null, 2)}

Context:
- Selected component: ${feedback.selectedComponent || 'none'}
- User intent: ${feedback.intent || 'modification'}
- Previous changes: ${context.previousChanges || 'none'}

Please analyze the feedback and respond with a JSON object containing:

{
  "changes": [
    {
      "type": "update|add|remove|modify",
      "target": "component|layout|data|styling",
      "componentId": "id of component to change",
      "property": "property to change",
      "value": "new value",
      "reasoning": "why this change is needed"
    }
  ],
  "reasoning": "overall reasoning for the changes"
}

Types of changes you can make:
- update: Modify existing component properties
- add: Add new component to the layout
- remove: Remove existing component
- modify: Change component structure or behavior

Common feedback patterns:
- "Change the chart type" -> update chartType property
- "Add a filter" -> add filter component
- "Remove this component" -> remove component
- "Make it bigger" -> update size properties
- "Show more data" -> modify data binding or pagination
- "Different color" -> update styling properties

Focus on:
1. Clinical safety and accuracy
2. User experience improvements
3. Technical feasibility
4. Maintaining UI consistency
`;
  }

  /**
   * Apply changes to specification
   */
  async applyChanges(specification, changes) {
    let refinedSpec = JSON.parse(JSON.stringify(specification));
    
    for (const change of changes) {
      refinedSpec = await this.applyChange(refinedSpec, change);
    }
    
    return refinedSpec;
  }

  /**
   * Apply a single change to specification
   */
  async applyChange(specification, change) {
    switch (change.type) {
      case 'update':
        return this.applyUpdateChange(specification, change);
      case 'add':
        return this.applyAddChange(specification, change);
      case 'remove':
        return this.applyRemoveChange(specification, change);
      case 'modify':
        return this.applyModifyChange(specification, change);
      default:
        return specification;
    }
  }

  /**
   * Apply update change
   */
  applyUpdateChange(specification, change) {
    if (change.componentId) {
      const component = findComponentById(specification, change.componentId);
      if (component) {
        const updates = {};
        updates[change.property] = change.value;
        return updateComponentInSpec(specification, change.componentId, updates);
      }
    }
    return specification;
  }

  /**
   * Apply add change
   */
  applyAddChange(specification, change) {
    if (change.componentType) {
      const newComponent = {
        type: change.componentType,
        props: {
          id: `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: change.title || `New ${change.componentType}`,
          ...change.props
        },
        children: []
      };
      
      // Add to root container
      const rootContainer = specification.layout.structure;
      return addComponentToSpec(specification, rootContainer.props.id, newComponent);
    }
    return specification;
  }

  /**
   * Apply remove change
   */
  applyRemoveChange(specification, change) {
    if (change.componentId) {
      // Remove component from specification tree
      const removeFromTree = (node) => {
        if (node.children) {
          node.children = node.children.filter(child => 
            child.props.id !== change.componentId
          );
          
          node.children.forEach(child => removeFromTree(child));
        }
      };
      
      const newSpec = JSON.parse(JSON.stringify(specification));
      removeFromTree(newSpec.layout.structure);
      return newSpec;
    }
    return specification;
  }

  /**
   * Apply modify change
   */
  applyModifyChange(specification, change) {
    // More complex modifications can be implemented here
    return this.applyUpdateChange(specification, change);
  }

  /**
   * Get refinement history
   */
  getHistory() {
    return [...this.refinementHistory];
  }

  /**
   * Get last refinement
   */
  getLastRefinement() {
    return this.lastRefinement;
  }

  /**
   * Clear refinement history
   */
  clearHistory() {
    this.refinementHistory = [];
    this.lastRefinement = null;
  }

  /**
   * Undo last refinement
   */
  undoLastRefinement() {
    if (this.refinementHistory.length > 0) {
      const lastRefinement = this.refinementHistory.pop();
      this.lastRefinement = this.refinementHistory[this.refinementHistory.length - 1] || null;
      return lastRefinement.originalSpec;
    }
    return null;
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      status: this.status,
      lastRefinement: this.lastRefinement,
      historyCount: this.refinementHistory.length
    };
  }

  /**
   * Reset agent
   */
  reset() {
    this.status = 'idle';
    this.lastRefinement = null;
    this.refinementHistory = [];
  }
}

export default RefinementAgent;