/**
 * Progressive Loader Service
 * Handles progressive loading of UI components and data
 */

import fhirDataOrchestrator from './FHIRDataOrchestrator';
import componentGenerator from './ComponentGenerator';

class ProgressiveLoader {
  constructor() {
    this.loadingPhases = ['skeleton', 'layout', 'content', 'data'];
    this.listeners = new Set();
    this.currentLoads = new Map();
  }

  /**
   * Add progress listener
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
        // Progressive loader listener error
      }
    });
  }

  /**
   * Start progressive loading for a specification
   */
  async startProgressiveLoad(specification, context = {}) {
    const loadId = `load-${Date.now()}`;
    
    this.currentLoads.set(loadId, {
      specification,
      context,
      startTime: Date.now(),
      phase: 'skeleton'
    });
    
    try {
      // Phase 1: Skeleton loading
      this.notifyListeners('phase_start', { loadId, phase: 'skeleton' });
      await this.loadSkeletonPhase(specification, context);
      this.notifyListeners('phase_complete', { loadId, phase: 'skeleton' });
      
      // Phase 2: Layout loading
      this.notifyListeners('phase_start', { loadId, phase: 'layout' });
      await this.loadLayoutPhase(specification, context);
      this.notifyListeners('phase_complete', { loadId, phase: 'layout' });
      
      // Phase 3: Content loading
      this.notifyListeners('phase_start', { loadId, phase: 'content' });
      await this.loadContentPhase(specification, context);
      this.notifyListeners('phase_complete', { loadId, phase: 'content' });
      
      // Phase 4: Data loading
      this.notifyListeners('phase_start', { loadId, phase: 'data' });
      await this.loadDataPhase(specification, context);
      this.notifyListeners('phase_complete', { loadId, phase: 'data' });
      
      // Complete
      this.notifyListeners('load_complete', { 
        loadId, 
        duration: Date.now() - this.currentLoads.get(loadId).startTime 
      });
      
      return {
        success: true,
        loadId,
        duration: Date.now() - this.currentLoads.get(loadId).startTime
      };
      
    } catch (error) {
      this.notifyListeners('load_error', { loadId, error: error.message });
      return {
        success: false,
        loadId,
        error: error.message
      };
    } finally {
      this.currentLoads.delete(loadId);
    }
  }

  /**
   * Load skeleton phase
   */
  async loadSkeletonPhase(specification, context) {
    // Simulate skeleton loading delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Create skeleton components
    const skeletonComponents = this.createSkeletonComponents(specification.layout?.structure);
    
    return {
      phase: 'skeleton',
      components: skeletonComponents
    };
  }

  /**
   * Load layout phase
   */
  async loadLayoutPhase(specification, context) {
    // Simulate layout loading delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Validate layout structure
    const layoutValidation = this.validateLayoutStructure(specification.layout);
    
    if (!layoutValidation.valid) {
      throw new Error(`Invalid layout: ${layoutValidation.errors.join(', ')}`);
    }
    
    return {
      phase: 'layout',
      structure: specification.layout.structure,
      validation: layoutValidation
    };
  }

  /**
   * Load content phase
   */
  async loadContentPhase(specification, context) {
    // Generate components
    const components = await this.generateComponents(specification);
    
    return {
      phase: 'content',
      components
    };
  }

  /**
   * Load data phase
   */
  async loadDataPhase(specification, context) {
    // Load data for all data sources
    const dataResults = await this.loadDataSources(specification.dataSources, context);
    
    return {
      phase: 'data',
      data: dataResults
    };
  }

  /**
   * Create skeleton components
   */
  createSkeletonComponents(structure) {
    if (!structure) return [];
    
    const skeletons = [];
    
    const traverse = (node) => {
      if (node.type && node.props?.id) {
        skeletons.push({
          id: node.props.id,
          type: node.type,
          skeleton: true
        });
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    
    traverse(structure);
    return skeletons;
  }

  /**
   * Validate layout structure
   */
  validateLayoutStructure(layout) {
    const errors = [];
    
    if (!layout) {
      errors.push('Layout is required');
    }
    
    if (!layout.type) {
      errors.push('Layout type is required');
    }
    
    if (!layout.structure) {
      errors.push('Layout structure is required');
    }
    
    // Validate component hierarchy
    const componentIds = new Set();
    const validateHierarchy = (node, path = '') => {
      if (node.props?.id) {
        if (componentIds.has(node.props.id)) {
          errors.push(`Duplicate component ID: ${node.props.id}`);
        }
        componentIds.add(node.props.id);
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child, index) => {
          validateHierarchy(child, `${path}[${index}]`);
        });
      }
    };
    
    if (layout.structure) {
      validateHierarchy(layout.structure);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      componentCount: componentIds.size
    };
  }

  /**
   * Generate components
   */
  async generateComponents(specification) {
    const components = {};
    
    const traverse = (node) => {
      if (node.type && node.props?.id) {
        components[node.props.id] = {
          type: node.type,
          props: node.props,
          dataBinding: node.dataBinding
        };
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    
    if (specification.layout?.structure) {
      traverse(specification.layout.structure);
    }
    
    // Generate placeholder code for each component
    for (const [componentId, component] of Object.entries(components)) {
      component.code = this.generatePlaceholderCode(component);
    }
    
    // Use component generator to create components
    const results = await componentGenerator.generateComponents(components);
    
    return results;
  }

  /**
   * Generate placeholder code
   */
  generatePlaceholderCode(component) {
    return `
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const ${component.type}Component = ({ ...props }) => {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6">
        ${component.props.title || component.type}
      </Typography>
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          This is a placeholder for the ${component.type} component.
        </Typography>
      </Box>
    </Paper>
  );
};

export default ${component.type}Component;
`;
  }

  /**
   * Load data sources
   */
  async loadDataSources(dataSources, context) {
    if (!dataSources || !Array.isArray(dataSources)) {
      return {};
    }
    
    const dataResults = {};
    
    // Load data sources in parallel
    const loadPromises = dataSources.map(async (dataSource) => {
      try {
        const result = await fhirDataOrchestrator.fetchData(dataSource, context);
        dataResults[dataSource.id] = result;
      } catch (error) {
        dataResults[dataSource.id] = {
          success: false,
          error: error.message
        };
      }
    });
    
    await Promise.allSettled(loadPromises);
    
    return dataResults;
  }

  /**
   * Get current loading status
   */
  getLoadingStatus() {
    const currentLoads = Array.from(this.currentLoads.values());
    
    return {
      activeLoads: currentLoads.length,
      loads: currentLoads.map(load => ({
        phase: load.phase,
        duration: Date.now() - load.startTime
      }))
    };
  }

  /**
   * Cancel loading
   */
  cancelLoad(loadId) {
    if (this.currentLoads.has(loadId)) {
      this.currentLoads.delete(loadId);
      this.notifyListeners('load_cancelled', { loadId });
      return true;
    }
    return false;
  }

  /**
   * Get load statistics
   */
  getLoadStats() {
    return {
      totalLoads: this.currentLoads.size,
      phases: this.loadingPhases,
      listeners: this.listeners.size
    };
  }
}

// Create singleton instance
const progressiveLoader = new ProgressiveLoader();

export default progressiveLoader;